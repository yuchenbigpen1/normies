# Row-Level Security (RLS) Patterns

Ready-to-use RLS policy patterns for common business scenarios. Each pattern includes the SQL and a plain-English explanation.

## Quick Reference

| Pattern | Use When | Complexity |
|---------|----------|------------|
| Own data only | Users should only see their own records | Simple |
| Public read, private write | Anyone can browse, only logged-in users can create | Simple |
| Role-based access | Admins see everything, others see their own | Medium |
| Team-based access | Users see data belonging to their team | Medium |
| Hierarchical roles | Admin > Editor > Viewer with cascading permissions | Medium |
| Row-level sharing | Specific rows shared with specific users | Complex |
| Time-based access | Content visible only after/before a date | Simple |

---

## Pattern 1: Own Data Only

**Plain English:** "Users can only see and manage their own records."

The most common pattern. Every table has a column linking rows to a user.

```sql
-- Enable RLS
alter table tasks enable row level security;

-- Users can read their own tasks
create policy "Users read own tasks"
  on tasks for select
  to authenticated
  using (user_id = auth.uid());

-- Users can create tasks (assigned to themselves)
create policy "Users create own tasks"
  on tasks for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can update their own tasks
create policy "Users update own tasks"
  on tasks for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete their own tasks
create policy "Users delete own tasks"
  on tasks for delete
  to authenticated
  using (user_id = auth.uid());
```

**Why `using` AND `with check` on UPDATE?**
- `using` controls which rows you can see/target (the WHERE filter)
- `with check` controls what values the new row can have (validation)
- Together they mean: "you can only edit your own rows, and the result must still be your own"

---

## Pattern 2: Public Read, Private Write

**Plain English:** "Anyone (even not logged in) can read, but only logged-in users can create and edit their own content."

Great for: product catalogs, blog posts, public directories.

```sql
alter table products enable row level security;

-- Anyone can read (including anonymous visitors)
create policy "Public read access"
  on products for select
  to anon, authenticated
  using (true);

-- Only authenticated users can create
create policy "Auth users can create"
  on products for insert
  to authenticated
  with check (true);

-- Only the creator can update
create policy "Creators can update own"
  on products for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Only the creator can delete
create policy "Creators can delete own"
  on products for delete
  to authenticated
  using (created_by = auth.uid());
```

### Variation: Public Read with Status Filter

Only published items are public; drafts are visible only to the author.

```sql
-- Public can see published items only
create policy "Public read published"
  on posts for select
  to anon, authenticated
  using (status = 'published');

-- Authors can see all their own posts (including drafts)
create policy "Authors read own posts"
  on posts for select
  to authenticated
  using (author_id = auth.uid());
```

**How multiple SELECT policies interact:** Postgres uses OR logic — if ANY select policy matches, the row is visible. So a published post is visible to everyone, AND an author's draft is visible to that author.

---

## Pattern 3: Role-Based Access

**Plain English:** "Admins can see everything. Regular users can only see their own data."

Requires a `profiles` table with a `role` column.

```sql
alter table orders enable row level security;

-- Admins: full read access
create policy "Admins read all"
  on orders for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Admins: full write access
create policy "Admins write all"
  on orders for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Regular users: read own only
create policy "Users read own"
  on orders for select
  to authenticated
  using (customer_id = auth.uid());

-- Regular users: create own only
create policy "Users create own"
  on orders for insert
  to authenticated
  with check (customer_id = auth.uid());
```

### Helper Function (Cleaner Policies)

If you check roles in many tables, create a helper:

```sql
create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Then use in policies:
create policy "Admins read all"
  on orders for select
  to authenticated
  using (is_admin());
```

**Why `security definer`?** It means the function runs with the permissions of the user who created it (usually the database owner), not the calling user. This lets the function read the profiles table even if the calling user's RLS would normally restrict it.

---

## Pattern 4: Team-Based Access

**Plain English:** "Users can see all data belonging to their team. They can only modify data they created."

Requires a `team_members` junction table.

```sql
alter table projects enable row level security;

-- Team members can read all team projects
create policy "Team members read projects"
  on projects for select
  to authenticated
  using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid()
    )
  );

-- Team members can create projects for their teams
create policy "Team members create projects"
  on projects for insert
  to authenticated
  with check (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid()
    )
  );

-- Only project creator or team admin can update
create policy "Creator or admin can update"
  on projects for update
  to authenticated
  using (
    created_by = auth.uid()
    or team_id in (
      select team_id from team_members
      where user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Only team admin can delete
create policy "Admin can delete"
  on projects for delete
  to authenticated
  using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );
```

### Helper Function for Team Checks

```sql
create or replace function user_is_team_member(target_team_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from team_members
    where team_id = target_team_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

create or replace function user_is_team_admin(target_team_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from team_members
    where team_id = target_team_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  );
end;
$$ language plpgsql security definer;

-- Cleaner policies using helpers:
create policy "Team members read"
  on projects for select
  to authenticated
  using (user_is_team_member(team_id));
```

---

## Pattern 5: Hierarchical Roles

**Plain English:** "Admins can do everything. Editors can read and write. Viewers can only read."

```sql
alter table documents enable row level security;

-- Viewers, Editors, and Admins can read
create policy "All roles can read"
  on documents for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('viewer', 'editor', 'admin')
    )
  );

-- Editors and Admins can create
create policy "Editors+ can create"
  on documents for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('editor', 'admin')
    )
  );

-- Editors can update their own; Admins can update any
create policy "Editors own, Admins all"
  on documents for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Only Admins can delete
create policy "Admins can delete"
  on documents for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
```

---

## Pattern 6: Row-Level Sharing

**Plain English:** "The owner can share specific rows with specific users."

Requires a sharing/permissions table.

```sql
-- Sharing table
create table document_shares (
  document_id uuid references documents(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  permission text default 'view' check (permission in ('view', 'edit')),
  shared_by uuid references profiles(id),
  created_at timestamptz default now(),
  primary key (document_id, user_id)
);

alter table document_shares enable row level security;

-- Document owner or shared users can read
create policy "Owner and shared users can read"
  on documents for select
  to authenticated
  using (
    created_by = auth.uid()
    or id in (
      select document_id from document_shares
      where user_id = auth.uid()
    )
  );

-- Owner and users with 'edit' permission can update
create policy "Owner and editors can update"
  on documents for update
  to authenticated
  using (
    created_by = auth.uid()
    or id in (
      select document_id from document_shares
      where user_id = auth.uid()
      and permission = 'edit'
    )
  );

-- Only the owner can share
create policy "Owner can manage shares"
  on document_shares for all
  to authenticated
  using (
    document_id in (
      select id from documents
      where created_by = auth.uid()
    )
  );

-- Shared users can see their own share records
create policy "Users can see own shares"
  on document_shares for select
  to authenticated
  using (user_id = auth.uid());
```

---

## Pattern 7: Time-Based Access

**Plain English:** "Content is only visible after its publish date" or "Access expires after a certain date."

```sql
-- Posts visible only after published_at date
create policy "Published posts are public"
  on posts for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at <= now()
  );

-- Time-limited access (e.g., course content expires)
create policy "Active enrollment access"
  on course_content for select
  to authenticated
  using (
    exists (
      select 1 from enrollments
      where enrollments.course_id = course_content.course_id
      and enrollments.user_id = auth.uid()
      and enrollments.expires_at > now()
    )
  );
```

---

## Storage Policies

RLS for file uploads works on the `storage.objects` table.

### Public Bucket (Anyone Can Read)

```sql
-- Anyone can read files in the public-images bucket
create policy "Public read images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'public-images');

-- Authenticated users can upload to public-images
create policy "Auth upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'public-images');
```

### Private Bucket (User's Own Files)

Organize files by user ID: `bucket-name/{user-id}/filename.ext`

```sql
-- Users can read their own files
create policy "Users read own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can upload to their own folder
create policy "Users upload own files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
create policy "Users delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

### Team Shared Bucket

Files shared within a team: `bucket-name/{team-id}/filename.ext`

```sql
-- Team members can read team files
create policy "Team members read files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'team-files'
    and (storage.foldername(name))[1]::uuid in (
      select team_id from team_members
      where user_id = auth.uid()
    )
  );

-- Team members can upload to team folder
create policy "Team members upload files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'team-files'
    and (storage.foldername(name))[1]::uuid in (
      select team_id from team_members
      where user_id = auth.uid()
    )
  );
```

---

## Debugging RLS

When policies aren't working as expected:

### 1. Check if RLS is enabled

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public';
```

If `rowsecurity` is `false`, RLS is not enabled on that table.

### 2. List all policies on a table

```sql
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where tablename = 'your_table_name';
```

### 3. Test as a specific user

In the Supabase SQL Editor, you can temporarily switch to a user's context:

```sql
-- Set the role to an authenticated user
set request.jwt.claims = '{"sub": "user-uuid-here", "role": "authenticated"}';
set role authenticated;

-- Now run queries to see what this user would see
select * from orders;

-- Reset when done
reset role;
set request.jwt.claims = '';
```

### 4. Common debugging checklist

- Is RLS enabled on the table? (`alter table ... enable row level security`)
- Are there any policies at all? (no policies = no access)
- Does the policy use the correct column name? (e.g., `user_id` vs `customer_id`)
- Is the policy for the right operation? (`select` vs `insert` vs `update` vs `delete`)
- Is the policy for the right role? (`to authenticated` vs `to anon`)
- For INSERT/UPDATE: did you include `with check`?
- For UPDATE: did you include both `using` AND `with check`?
