---
name: Supabase Expert
description: Database and backend knowledge for business operators — table design, auth setup, row-level security, storage, and edge functions explained in plain English. Not a developer guide — domain expertise for building your backend on Supabase.
---

# Supabase Expert

You are an expert at helping non-technical business operators design, build, and manage their backend on Supabase. You understand databases, authentication, security, and storage deeply, and can translate business needs into the right Supabase setup — without jargon.

**This skill is NOT about connecting to Supabase** — Normies handles that via the Supabase MCP source or API source. This skill gives you the domain knowledge to do great work once connected.

## When to Use This Skill

- User needs to design a database (tables, columns, relationships)
- User asks about user authentication or login setup
- User wants to understand or set up row-level security (who can see what)
- User needs file storage or image uploads
- User asks about edge functions, webhooks, or scheduled jobs
- User mentions Supabase in any context — backend, database, or auth questions

## Database Design for Operators

### Think Spreadsheets with Superpowers

If you've used a spreadsheet, you already understand 80% of how a database works:

| Spreadsheet Concept | Database Equivalent | What's Different |
|---------------------|-------------------|-----------------|
| **Workbook** | Database | One per project |
| **Sheet/Tab** | Table | Has strict rules about what goes in each column |
| **Column header** | Column (with a type) | Each column only accepts one kind of data (text, numbers, dates, etc.) |
| **Row** | Row (record) | One item in your collection |
| **Cell** | Field value | The actual data in one column of one row |
| **VLOOKUP between sheets** | Foreign key relationship | Links one table to another — but way more reliable than VLOOKUP |

### Key Differences from Spreadsheets

**Columns have types** — In a spreadsheet, any cell can hold anything. In a database, you declare what type each column holds:

| Type | What It Stores | Example Values |
|------|---------------|----------------|
| `text` | Words, sentences, any string | "Jane Smith", "This is a description" |
| `int4` / `int8` | Whole numbers | 42, 1000, -5 |
| `numeric` | Decimal numbers (precise) | 29.99, 0.005 |
| `bool` | True or false | true, false |
| `timestamptz` | Date + time (with timezone) | 2026-02-11T15:00:00Z |
| `date` | Date only | 2026-02-11 |
| `uuid` | Unique identifier | a1b2c3d4-e5f6-7890-abcd-ef1234567890 |
| `jsonb` | Structured data (flexible) | {"color": "blue", "size": "large"} |

**Every table should have a primary key** — a column that uniquely identifies each row. Supabase uses `id` (UUID) by default. Think of it as an invisible, permanent row number that never changes.

**Relationships connect tables** — instead of duplicating data, you reference rows in other tables. This is the superpower that makes databases better than spreadsheets for business data.

### Relationships Explained

There are three types of relationships. Here's when to use each:

**One-to-Many (the most common)**
One record in Table A connects to many records in Table B.

- One customer → many orders
- One project → many tasks
- One author → many blog posts

How it works: the "many" table has a column pointing back to the "one" table.

```sql
-- A customer can have many orders
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),  -- points to the customer
  total numeric not null,
  status text default 'pending',
  created_at timestamptz default now()
);
```

**Many-to-Many**
Records in Table A can connect to many records in Table B, and vice versa.

- Products ↔ Categories (a product can be in many categories, a category has many products)
- Students ↔ Courses
- Users ↔ Roles

How it works: a "junction table" sits in the middle, connecting both sides.

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

-- Junction table connects products and categories
create table product_categories (
  product_id uuid references products(id),
  category_id uuid references categories(id),
  primary key (product_id, category_id)
);
```

**One-to-One**
One record in Table A connects to exactly one record in Table B.

- One user → one profile (separate table for optional details)
- One order → one shipping address

Less common — often you can just add columns to the original table instead.

### Column Best Practices

**Always include these columns in every table:**

```sql
id uuid primary key default gen_random_uuid(),
created_at timestamptz default now(),
updated_at timestamptz default now()
```

- `id` — unique identifier, auto-generated
- `created_at` — when the record was created, auto-set
- `updated_at` — when it was last changed (update via trigger or application code)

**Naming conventions:**
- Table names: plural, lowercase, underscores (`customers`, `order_items`)
- Column names: lowercase, underscores (`first_name`, `created_at`)
- Foreign keys: singular table name + `_id` (`customer_id`, `product_id`)

**When to use `jsonb`:**
- For flexible data that doesn't have a fixed structure (tags, metadata, preferences)
- When the structure varies per row
- **Don't overuse it** — if every row has the same fields, those should be regular columns

See [references/common-schemas.md](references/common-schemas.md) for ready-to-use table designs for common business needs.

## Common Business Schemas

Here are the most common setups for business operators. Each one is ready to use — just pick what fits your needs.

### User Profiles

Supabase Auth creates a `auth.users` table automatically when someone signs up. But you'll want a `profiles` table in your public schema for business data about each user:

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  role text default 'member',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create a profile when someone signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

**Why a separate profiles table?** The `auth.users` table is managed by Supabase and shouldn't be modified directly. Your `profiles` table is yours — add whatever business fields you need.

### Products and Inventory

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  currency text default 'usd',
  sku text unique,
  stock_quantity int default 0 check (stock_quantity >= 0),
  is_active bool default true,
  category text,
  image_url text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for common lookups
create index idx_products_category on products(category);
create index idx_products_active on products(is_active) where is_active = true;
```

### Orders

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id),
  status text default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'refunded')),
  total numeric not null check (total >= 0),
  currency text default 'usd',
  shipping_address jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity int not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  subtotal numeric generated always as (quantity * unit_price) stored
);

-- Index for common lookups
create index idx_orders_customer on orders(customer_id);
create index idx_orders_status on orders(status);
create index idx_order_items_order on order_items(order_id);
```

### Content Management (Blog/CMS)

```sql
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id),
  title text not null,
  slug text unique not null,
  content text,
  excerpt text,
  status text default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  cover_image_url text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_posts_slug on posts(slug);
create index idx_posts_status on posts(status);
create index idx_posts_author on posts(author_id);
```

## Authentication

Auth is how users prove who they are (login). Supabase Auth handles this for you — you don't need to build a login system from scratch.

### Auth Methods

| Method | How It Works | Best For |
|--------|-------------|----------|
| **Email + Password** | User signs up with email and password | Most apps — the default choice |
| **Magic Link** | User enters email, receives a clickable login link | Simpler UX, no passwords to forget |
| **Social Login** | Login with Google, GitHub, Apple, etc. | Consumer apps where you want easy signup |
| **Phone (OTP)** | User gets a code via SMS | Mobile-first apps |

**Recommendation for most operators:** Start with Email + Password. Add social login (Google) if your users expect it. Magic links are great for internal tools where you want zero password management.

### How Auth Works in Supabase

1. **User signs up** → Supabase creates a record in `auth.users` with a unique `id`
2. **User logs in** → Supabase returns a JWT token (a secure "pass" that proves who they are)
3. **User makes requests** → The token is sent with every request so Supabase knows who's asking
4. **Row-Level Security** uses this identity to decide what data they can see

### Auth Setup Steps

**Email + Password (in the Supabase Dashboard):**
1. Go to Authentication → Providers → Email
2. Enable "Email" provider (on by default)
3. Configure email confirmation (recommended: require confirmation)
4. Set up email templates (Authentication → Email Templates)

**Social Login (e.g., Google):**
1. Go to the Google Cloud Console → create OAuth credentials
2. Copy the Client ID and Client Secret
3. In Supabase Dashboard → Authentication → Providers → Google
4. Paste the credentials, set the redirect URL
5. Supabase handles the rest — login, token management, session refresh

**Magic Links:**
1. Already available with Email provider enabled
2. Users call `signInWithOtp({ email })` instead of `signInWithPassword`
3. They receive an email with a login link — click it, they're in

### Auth Best Practices

- **Always require email confirmation** for public-facing apps (prevents fake signups)
- **Set up a profiles table** linked to `auth.users` (see schema above) for business data
- **Use the built-in password recovery** — don't build your own "forgot password" flow
- **Session duration** is configurable in Dashboard → Authentication → Settings (default: 1 hour access token, 1 week refresh)
- **Never store passwords yourself** — Supabase Auth handles password hashing and storage

## Row-Level Security (RLS)

RLS is the most important security concept in Supabase. It answers the question: **who can see and do what with each row in your database?**

### Why RLS Matters

Without RLS, anyone with your Supabase URL and public key can read/write all your data. That's a security disaster.

With RLS, you set rules like:
- "Users can only see their own orders"
- "Anyone can read published blog posts, but only authors can edit their own"
- "Admins can see everything"

**Think of RLS as an invisible bouncer** for each table. Every time someone tries to read or write data, the bouncer checks the rules and only lets through what's allowed.

### How to Enable RLS

```sql
-- Enable RLS on a table (ALWAYS do this for every table with user data)
alter table orders enable row level security;
```

**Critical:** When you enable RLS on a table with no policies, **nobody can read or write anything**. You must add policies after enabling RLS.

### RLS Policies in Plain English

Every policy has four parts:
1. **Name** — a descriptive label
2. **Operation** — what action (SELECT, INSERT, UPDATE, DELETE)
3. **Who** — which users this applies to (often "authenticated users")
4. **Rule** — the condition that must be true

### Common RLS Patterns

**Pattern 1: Users can only see their own data**

The most common pattern. Each row has a `user_id` column, and users can only see rows where `user_id` matches their login.

```sql
-- Users can read their own orders
create policy "Users can view own orders"
  on orders for select
  to authenticated
  using (customer_id = auth.uid());

-- Users can create their own orders
create policy "Users can create own orders"
  on orders for insert
  to authenticated
  with check (customer_id = auth.uid());
```

`auth.uid()` is a built-in function that returns the current logged-in user's ID.

**Pattern 2: Public read, authenticated write**

Great for content that anyone can browse but only logged-in users can create.

```sql
-- Anyone can read published posts
create policy "Public can read published posts"
  on posts for select
  to anon, authenticated
  using (status = 'published');

-- Authors can create posts
create policy "Authors can create posts"
  on posts for insert
  to authenticated
  with check (author_id = auth.uid());

-- Authors can edit their own posts
create policy "Authors can update own posts"
  on posts for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
```

**Pattern 3: Role-based access**

For apps where different users have different permission levels (admin, editor, viewer).

```sql
-- Admins can see all orders
create policy "Admins can view all orders"
  on orders for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Regular users can only see their own
create policy "Users can view own orders"
  on orders for select
  to authenticated
  using (customer_id = auth.uid());
```

**Pattern 4: Team/organization access**

For apps where users belong to teams and can see all team data.

```sql
-- Users can see data belonging to their team
create policy "Team members can view team data"
  on projects for select
  to authenticated
  using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid()
    )
  );
```

See [references/rls-patterns.md](references/rls-patterns.md) for more patterns and detailed examples.

### RLS Best Practices

1. **Enable RLS on every table that stores user data** — no exceptions
2. **Start restrictive, then open up** — it's safer to add access than to restrict it later
3. **Test policies by logging in as different users** — verify they only see what they should
4. **Use `auth.uid()` in policies** — it always returns the current user's ID
5. **Keep policies simple** — complex policies are hard to debug and slow down queries
6. **Name policies descriptively** — "Users can view own orders" is better than "policy_1"
7. **Don't forget DELETE policies** — if users can create data, decide who can delete it

### Common RLS Mistakes

| Mistake | What Happens | How to Fix |
|---------|-------------|------------|
| Enable RLS but add no policies | Nobody can access the table at all | Add at least a SELECT policy |
| Forget to enable RLS | Everyone can read/write everything | Always enable RLS after creating tables |
| Policy references wrong column | Wrong users get access | Double-check the column name in `using()` |
| Missing `with check` on INSERT/UPDATE | Users can insert/update rows they shouldn't own | Add `with check` clauses |
| Overly complex policies | Slow queries, hard to debug | Break into simpler policies — Postgres ORs them together |

## Storage (File Uploads)

Supabase Storage lets users upload and manage files — images, documents, videos, anything.

### How Storage Works

Storage is organized into **buckets** (like folders):

```
Storage
├── avatars/          (bucket - profile pictures)
│   ├── user1.jpg
│   └── user2.png
├── product-images/   (bucket - product photos)
│   ├── shoe-red.jpg
│   └── shoe-blue.jpg
└── documents/        (bucket - private files)
    ├── invoice-001.pdf
    └── contract.docx
```

### Bucket Types

| Type | Who Can Access | Use Case |
|------|---------------|----------|
| **Public** | Anyone with the URL | Product images, blog photos, marketing assets |
| **Private** | Only authenticated users (with RLS) | User documents, invoices, private uploads |

### Creating a Bucket

```sql
-- In the Supabase Dashboard: Storage → New Bucket
-- Or via SQL:
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);  -- true = public bucket
```

### Storage Policies (Like RLS for Files)

Storage uses the same RLS system as tables. You set policies on `storage.objects`:

```sql
-- Anyone can view files in the public avatars bucket
create policy "Public avatar access"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- Users can upload their own avatar
create policy "Users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatar
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
create policy "Users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

**Pattern:** Organize files by user ID as a folder name: `avatars/{user_id}/photo.jpg`. Then the policy checks that the folder matches the logged-in user.

### Signed URLs

For private files, you generate a **signed URL** — a temporary link that expires after a set time.

- Signed URLs let you share private files without making the bucket public
- Set expiration time (e.g., 1 hour, 1 day)
- Great for invoices, contracts, and other sensitive documents

### Storage Best Practices

- **Use public buckets** for product images, logos, and marketing assets
- **Use private buckets** for user documents, invoices, and uploaded files
- **Organize by user ID** (`bucket/user-id/filename`) for easy RLS policies
- **Set file size limits** on buckets to prevent abuse (Dashboard → Storage → Bucket settings)
- **Use image transformations** — Supabase can resize/crop images on the fly (append query params to the URL)

## Edge Functions

Edge Functions are small pieces of code that run on Supabase's servers. Think of them as custom actions your app can perform — like sending an email, processing a payment, or responding to a webhook.

### When Operators Need Edge Functions

| Use Case | Why an Edge Function? |
|----------|---------------------|
| **Webhook receiver** | Accept incoming data from Stripe, Shopify, etc. |
| **Scheduled job** | Run something every hour/day (cleanup, reports, syncs) |
| **Custom API endpoint** | Create a specific action your app or automation can call |
| **Third-party API call** | Call external APIs with secrets that shouldn't be in the browser |
| **Data processing** | Transform, validate, or enrich data before storing it |

### How Edge Functions Work

1. You write a small function (in TypeScript/JavaScript)
2. Deploy it to Supabase
3. It gets a URL you can call from anywhere
4. It runs on Supabase's servers (not in the user's browser)

### Basic Edge Function Structure

```typescript
// supabase/functions/hello-world/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const { name } = await req.json();

  return new Response(
    JSON.stringify({ message: `Hello, ${name}!` }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

### Edge Function + Database

Edge Functions can read/write your Supabase database directly:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // Bypasses RLS — use carefully
  );

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending");

  return new Response(JSON.stringify(data));
});
```

**Important:** Edge Functions using the `SERVICE_ROLE_KEY` bypass RLS — they can see all data. Only use this for server-side operations, never expose this key to browsers.

### Edge Functions vs. n8n

For business operators, **n8n is usually the better choice** for automations:

| Feature | Edge Functions | n8n |
|---------|--------------|-----|
| Visual builder | No (code only) | Yes (drag and drop) |
| Complexity | Requires coding | Low-code |
| Speed | Very fast (< 50ms) | Slower but fine for most workflows |
| Scheduling | Via cron triggers | Built-in scheduling UI |
| Best for | Performance-critical webhooks, custom API logic | Business automations, data sync, notifications |

**Rule of thumb:** Use n8n for business automations. Use Edge Functions when you need something very fast, very custom, or that n8n can't handle.

## Supabase + n8n Patterns

Combining Supabase (your database/backend) with n8n (your automation engine) is powerful. Here are the most useful patterns.

### Pattern 1: Database Webhook → n8n Workflow

When data changes in Supabase, trigger an n8n workflow.

**Setup:**
1. Create a database webhook in Supabase (Database → Webhooks)
2. Point it to your n8n webhook trigger URL
3. Select which events to listen for (INSERT, UPDATE, DELETE)

**Example workflows:**
- New order inserted → Send confirmation email + Slack notification
- Customer profile updated → Sync to CRM
- Order status changed to "shipped" → Send tracking email

### Pattern 2: n8n Scheduled Sync

Run n8n workflows on a schedule to pull/push data from Supabase.

**Example workflows:**
- Every morning → Pull yesterday's orders from Supabase → Generate summary → Post to Slack
- Every hour → Check for orders stuck in "processing" for > 2 hours → Alert team
- Weekly → Export customer data → Update Google Sheet for reporting

### Pattern 3: n8n as API Middleware

Use n8n to connect Supabase with services that don't have direct integrations.

**Example:**
- Stripe payment succeeded (webhook to n8n) → Create order in Supabase → Send receipt email
- Shopify order created → Transform data → Insert into Supabase orders table
- Typeform submission → Validate data → Insert into Supabase leads table

### Connecting n8n to Supabase

n8n has a built-in Supabase node. To set it up:

1. **Get your credentials from Supabase Dashboard:**
   - Project URL: Settings → API → Project URL
   - Service Role Key: Settings → API → Service Role Key (for full access)
   - Anon Key: Settings → API → Anon Key (for RLS-restricted access)

2. **In n8n:** Add Supabase credentials with the URL and key

3. **Available operations:** Get rows, insert rows, update rows, delete rows, upsert

**Security tip:** Use the Anon Key when the workflow acts as a specific user. Use the Service Role Key when the workflow needs admin access to all data (e.g., background jobs, reports).

## Supabase Dashboard Guide

The Supabase Dashboard is where you manage everything. Here's what each section does:

| Section | What It Does | When You'll Use It |
|---------|-------------|-------------------|
| **Table Editor** | Create and edit tables, view/edit data directly | Building your database, checking data |
| **SQL Editor** | Run SQL queries directly | Custom queries, creating policies, advanced operations |
| **Authentication** | Manage users, configure login providers | Setting up auth, managing users |
| **Storage** | Manage file buckets and uploads | File storage, image hosting |
| **Edge Functions** | Deploy and manage server functions | Custom API endpoints, webhooks |
| **Database** | Roles, extensions, webhooks, backups | Database administration |
| **API Docs** | Auto-generated API documentation | Reference for your specific tables |
| **Settings** | Project settings, API keys, billing | Configuration, key management |

### Most Important Settings

- **Settings → API** — Your API keys and project URL (you'll need these for connecting)
- **Settings → Authentication** — Configure login providers, email templates, session settings
- **Database → Backups** — Automatic daily backups (check they're running!)
- **Database → Extensions** — Enable PostgreSQL extensions (e.g., `pg_trgm` for text search)

## Common Operator Scenarios

### "I need a simple database for my app"

1. Start with a `profiles` table linked to auth (see schema above)
2. Add your business tables (products, orders, whatever fits)
3. Enable RLS on every table
4. Add policies (start with "users see only their own data")
5. Test by signing up as a user and checking what data is visible

### "Users should only see their own data"

1. Make sure every table has a `user_id` column (or similar, like `customer_id`)
2. Enable RLS: `alter table your_table enable row level security;`
3. Add a select policy: `using (user_id = auth.uid())`
4. Add insert policy: `with check (user_id = auth.uid())`
5. Test it — sign in as different users and verify isolation

### "I need to upload images"

1. Create a storage bucket (public for product images, private for user uploads)
2. Set up storage policies (see Storage section)
3. Organize files by user ID or category
4. Use Supabase's image transformations for thumbnails and resizing

### "I want to send notifications when data changes"

1. Create a database webhook (Database → Webhooks in dashboard)
2. Set up an n8n workflow with a Webhook trigger node
3. Connect the Supabase webhook to the n8n URL
4. Process the event in n8n and send notifications (Slack, email, SMS)

### "I need to migrate from a spreadsheet"

1. Export your spreadsheet as CSV
2. Design proper table structure (separate sheets = separate tables)
3. Create tables in Supabase with correct column types
4. Use the Table Editor to import CSV data
5. Set up relationships between tables (foreign keys replacing VLOOKUPs)
6. Enable RLS and add policies
7. Build views or queries for the same reports you had in spreadsheet

### "My app is slow — how do I speed up queries?"

1. **Add indexes** on columns you filter or sort by frequently
2. **Use `select` to limit columns** — don't fetch everything when you only need a few fields
3. **Paginate results** — don't load all 10,000 rows at once
4. **Check your RLS policies** — overly complex policies slow down every query
5. **Use the SQL Editor's EXPLAIN** to see how queries perform

```sql
-- Add an index on a frequently filtered column
create index idx_orders_status on orders(status);

-- Add a composite index if you often filter by multiple columns
create index idx_orders_customer_status on orders(customer_id, status);
```

## Working with a Supabase MCP Server or API Source

When the user has Supabase connected, here are the most useful operations.

### Reading Data (Safe — No Side Effects)

- List tables and their columns
- Query rows with filters, sorting, and pagination
- Check RLS policies on a table
- View storage buckets and files
- List auth users
- Check database indexes

### Writing Data (Caution — Confirm with User)

Before any write operation, always:
1. Explain what will happen in plain English
2. Get explicit confirmation from the user
3. For destructive operations (DELETE, DROP), double-confirm

**Operations that change things:**
- Create/alter tables and columns
- Insert, update, or delete rows
- Create or modify RLS policies
- Create or delete storage buckets
- Create or deploy edge functions
- Enable/disable database extensions

### Supabase API Basics

The Supabase API is auto-generated from your database schema:

- **Base URL:** `https://{project-ref}.supabase.co`
- **REST API:** `/rest/v1/{table_name}` — CRUD operations on any table
- **Auth API:** `/auth/v1/` — signup, login, token management
- **Storage API:** `/storage/v1/` — file upload, download, management
- **Edge Functions:** `/functions/v1/{function_name}` — invoke custom functions

**Headers for every request:**
```
apikey: {your-anon-or-service-role-key}
Authorization: Bearer {user-jwt-or-service-role-key}
Content-Type: application/json
```

**Common REST API patterns:**

```
# Get all products
GET /rest/v1/products?select=*

# Get products with specific columns
GET /rest/v1/products?select=name,price,category

# Filter: products under $50
GET /rest/v1/products?price=lt.50

# Filter: orders with status "pending"
GET /rest/v1/orders?status=eq.pending

# Sort by created_at descending
GET /rest/v1/orders?order=created_at.desc

# Paginate: 10 items starting from offset 20
GET /rest/v1/orders?limit=10&offset=20

# Insert a row
POST /rest/v1/products
Body: { "name": "Widget", "price": 29.99 }

# Update rows matching a filter
PATCH /rest/v1/products?id=eq.{uuid}
Body: { "price": 39.99 }

# Delete rows matching a filter
DELETE /rest/v1/products?id=eq.{uuid}
```

## Glossary

Quick reference for Supabase terminology that confuses business operators:

| Term | What It Actually Means |
|------|----------------------|
| **RLS** | Row-Level Security — rules that control who can see/edit each row |
| **Policy** | A specific rule in RLS (e.g., "users can read their own orders") |
| **UUID** | A unique ID that looks like `a1b2c3d4-e5f6-7890-abcd-ef1234567890` — used to identify every record |
| **Foreign key** | A column that points to a row in another table (like a VLOOKUP reference) |
| **Migration** | A recorded change to your database structure (adding tables, columns, etc.) |
| **Schema** | The structure of your database — what tables exist, what columns they have |
| **Anon key** | A public API key that respects RLS rules — safe to use in browsers |
| **Service role key** | A private admin key that bypasses all RLS — NEVER expose to browsers |
| **JWT** | A secure token that proves who a user is (like a digital ID card) |
| **Trigger** | An automatic action that runs when data changes (e.g., "when a user signs up, create a profile") |
| **Edge Function** | A small piece of code that runs on Supabase's servers (for webhooks, custom logic) |
| **Bucket** | A container for files in Supabase Storage (like a folder) |
| **Signed URL** | A temporary link to a private file that expires after a set time |
| **PostgREST** | The technology that auto-generates a REST API from your database tables |
| **Realtime** | Supabase's feature that pushes data changes to connected clients instantly |
| **Extension** | An add-on that gives PostgreSQL extra capabilities (text search, geolocation, etc.) |

## Attribution

This skill incorporates patterns and best practices adapted from:
- [Supabase official documentation](https://supabase.com/docs) — guides, API reference, and best practices
- [supabase/agent-skills](https://github.com/supabase/agent-skills) — Postgres best practices (Apache 2.0 License)
- [Nice-Wolf-Studio/claude-code-supabase-skills](https://github.com/Nice-Wolf-Studio/claude-code-supabase-skills) — API operation patterns
- [Supabase community examples](https://github.com/supabase/supabase/tree/master/examples) — schema and auth patterns
