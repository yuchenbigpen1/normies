# Common Supabase Schemas

Ready-to-use table designs for common business needs. Copy and paste into the Supabase SQL Editor.

## Starter: Profiles + Auth

Every Supabase app needs this. Links your business data to Supabase Auth users.

```sql
-- Profiles table (extends auth.users with business data)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  company text,
  role text default 'member' check (role in ('admin', 'editor', 'member', 'viewer')),
  avatar_url text,
  phone text,
  timezone text default 'UTC',
  preferences jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-update updated_at on any change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- RLS
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can view all profiles"
  on profiles for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
```

## E-Commerce: Products + Orders

A complete order system for selling products.

```sql
-- Products
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  compare_at_price numeric check (compare_at_price >= 0),
  currency text default 'usd',
  sku text unique,
  barcode text,
  stock_quantity int default 0 check (stock_quantity >= 0),
  low_stock_threshold int default 5,
  is_active bool default true,
  category text,
  tags text[] default '{}',
  image_url text,
  images text[] default '{}',
  weight_grams int,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_products_category on products(category);
create index idx_products_active on products(is_active) where is_active = true;
create index idx_products_sku on products(sku) where sku is not null;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

-- Orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number serial,
  customer_id uuid references profiles(id),
  status text default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'refunded')),
  subtotal numeric not null default 0 check (subtotal >= 0),
  tax numeric default 0 check (tax >= 0),
  shipping_cost numeric default 0 check (shipping_cost >= 0),
  discount numeric default 0 check (discount >= 0),
  total numeric not null check (total >= 0),
  currency text default 'usd',
  shipping_name text,
  shipping_address jsonb,
  billing_address jsonb,
  payment_method text,
  payment_reference text,
  notes text,
  internal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_orders_customer on orders(customer_id);
create index idx_orders_status on orders(status);
create index idx_orders_created on orders(created_at desc);

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

-- Order Items
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  subtotal numeric generated always as (quantity * unit_price) stored
);

create index idx_order_items_order on order_items(order_id);

-- RLS for orders (customers see only their own)
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "Customers can view own orders"
  on orders for select to authenticated
  using (customer_id = auth.uid());

create policy "Customers can create orders"
  on orders for insert to authenticated
  with check (customer_id = auth.uid());

create policy "Admins can view all orders"
  on orders for select to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update orders"
  on orders for update to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "View own order items"
  on order_items for select to authenticated
  using (
    exists (select 1 from orders where orders.id = order_id and orders.customer_id = auth.uid())
  );

create policy "Admins can view all order items"
  on order_items for select to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Products are publicly readable
alter table products enable row level security;

create policy "Anyone can view active products"
  on products for select to anon, authenticated
  using (is_active = true);

create policy "Admins can manage products"
  on products for all to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
```

## SaaS: Teams + Members

For apps where users belong to organizations or teams.

```sql
-- Teams/Organizations
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid references profiles(id),
  plan text default 'free' check (plan in ('free', 'starter', 'pro', 'enterprise')),
  max_members int default 5,
  logo_url text,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_teams_slug on teams(slug);
create index idx_teams_owner on teams(owner_id);

create trigger teams_updated_at
  before update on teams
  for each row execute function update_updated_at();

-- Team Members (junction table)
create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  invited_by uuid references profiles(id),
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

create index idx_team_members_user on team_members(user_id);

-- Team Invitations
create table team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  email text not null,
  role text default 'member' check (role in ('admin', 'member', 'viewer')),
  invited_by uuid references profiles(id),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create index idx_invitations_token on team_invitations(token);
create index idx_invitations_email on team_invitations(email);

-- RLS: Team members can see their teams
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invitations enable row level security;

create policy "Members can view their teams"
  on teams for select to authenticated
  using (
    id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "Owners can update their teams"
  on teams for update to authenticated
  using (owner_id = auth.uid());

create policy "Authenticated users can create teams"
  on teams for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Members can view team membership"
  on team_members for select to authenticated
  using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "Admins can manage team members"
  on team_members for all to authenticated
  using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Admins can manage invitations"
  on team_invitations for all to authenticated
  using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
```

## Content: Blog / CMS

For content management — blog posts, articles, pages.

```sql
-- Posts / Articles
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id),
  title text not null,
  slug text unique not null,
  content text,
  excerpt text,
  status text default 'draft'
    check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  cover_image_url text,
  category text,
  tags text[] default '{}',
  seo_title text,
  seo_description text,
  reading_time_minutes int,
  view_count int default 0,
  is_featured bool default false,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_posts_slug on posts(slug);
create index idx_posts_status on posts(status);
create index idx_posts_author on posts(author_id);
create index idx_posts_published on posts(published_at desc) where status = 'published';
create index idx_posts_category on posts(category);

create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();

-- Comments
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  author_id uuid references profiles(id),
  parent_id uuid references comments(id) on delete cascade,
  content text not null,
  is_approved bool default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_comments_post on comments(post_id);
create index idx_comments_parent on comments(parent_id);

create trigger comments_updated_at
  before update on comments
  for each row execute function update_updated_at();

-- RLS
alter table posts enable row level security;
alter table comments enable row level security;

-- Anyone can read published posts
create policy "Public can read published posts"
  on posts for select to anon, authenticated
  using (status = 'published');

-- Authors can see all their own posts (including drafts)
create policy "Authors can view own posts"
  on posts for select to authenticated
  using (author_id = auth.uid());

-- Authors can create posts
create policy "Authors can create posts"
  on posts for insert to authenticated
  with check (author_id = auth.uid());

-- Authors can edit their own posts
create policy "Authors can update own posts"
  on posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Anyone can read approved comments on published posts
create policy "Public can read approved comments"
  on comments for select to anon, authenticated
  using (
    is_approved = true
    and exists (select 1 from posts where posts.id = post_id and posts.status = 'published')
  );

-- Authenticated users can create comments
create policy "Users can create comments"
  on comments for insert to authenticated
  with check (author_id = auth.uid());
```

## CRM-Lite: Contacts + Deals

A simple customer relationship tracker.

```sql
-- Contacts
create table contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  first_name text not null,
  last_name text,
  email text,
  phone text,
  company text,
  job_title text,
  source text check (source in ('website', 'referral', 'cold_outreach', 'event', 'social', 'other')),
  status text default 'lead'
    check (status in ('lead', 'qualified', 'customer', 'churned', 'inactive')),
  tags text[] default '{}',
  notes text,
  last_contacted_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_contacts_owner on contacts(owner_id);
create index idx_contacts_email on contacts(email);
create index idx_contacts_status on contacts(status);
create index idx_contacts_company on contacts(company);

create trigger contacts_updated_at
  before update on contacts
  for each row execute function update_updated_at();

-- Deals / Opportunities
create table deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id),
  owner_id uuid references profiles(id),
  title text not null,
  value numeric check (value >= 0),
  currency text default 'usd',
  stage text default 'discovery'
    check (stage in ('discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability int default 0 check (probability >= 0 and probability <= 100),
  expected_close_date date,
  actual_close_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_deals_contact on deals(contact_id);
create index idx_deals_owner on deals(owner_id);
create index idx_deals_stage on deals(stage);

create trigger deals_updated_at
  before update on deals
  for each row execute function update_updated_at();

-- Activities / Interactions
create table activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  user_id uuid references profiles(id),
  type text not null check (type in ('email', 'call', 'meeting', 'note', 'task')),
  subject text,
  description text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_activities_contact on activities(contact_id);
create index idx_activities_deal on activities(deal_id);

-- RLS: Users see their own contacts and deals
alter table contacts enable row level security;
alter table deals enable row level security;
alter table activities enable row level security;

create policy "Users can view own contacts"
  on contacts for select to authenticated
  using (owner_id = auth.uid());

create policy "Users can manage own contacts"
  on contacts for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Users can view own deals"
  on deals for select to authenticated
  using (owner_id = auth.uid());

create policy "Users can manage own deals"
  on deals for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Users can view activities for own contacts"
  on activities for select to authenticated
  using (
    contact_id in (select id from contacts where owner_id = auth.uid())
  );

create policy "Users can create activities for own contacts"
  on activities for insert to authenticated
  with check (
    contact_id in (select id from contacts where owner_id = auth.uid())
  );
```

## Useful Helper Functions

These functions are used across multiple schemas above.

```sql
-- Auto-update updated_at timestamp (if not already created)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Generate a URL-friendly slug from text
create or replace function generate_slug(input text)
returns text as $$
begin
  return lower(regexp_replace(regexp_replace(input, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
end;
$$ language plpgsql;

-- Check if current user has a specific role
create or replace function user_has_role(required_role text)
returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid()
    and role = required_role
  );
end;
$$ language plpgsql security definer;

-- Check if current user is a member of a team
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
```
