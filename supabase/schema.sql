create extension if not exists pgcrypto;

create table if not exists public.comments (
  id text primary key,
  parent_id text references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text not null default 'Rank & File',
  category text not null default 'general' check (category in ('general', 'news', 'questions')),
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  website text,
  ip_hash text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id)
);

create index if not exists comments_status_created_at_idx on public.comments(status, created_at desc);
create index if not exists comments_parent_id_idx on public.comments(parent_id);

create table if not exists public.production_bonus_rows (
  week_ending date primary key,
  coke text,
  primary_area text,
  hot_roll text,
  finishing text,
  plate text,
  plant_avg text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.managed_documents (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('flyers', 'resources')),
  title text not null,
  description text,
  file_url text,
  file_path text,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists managed_documents_section_status_idx
  on public.managed_documents(section, status, created_at desc);

create table if not exists public.election_materials (
  id uuid primary key default gen_random_uuid(),
  candidate_name text not null,
  position text not null,
  material_kind text not null default 'campaign-material'
    check (material_kind in ('incumbent', 'candidate', 'campaign-material')),
  summary text,
  file_url text,
  file_path text,
  external_url text,
  submitter_name text,
  submitter_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id)
);

create index if not exists election_materials_status_position_idx
  on public.election_materials(status, position, created_at desc);

create index if not exists election_materials_public_order_idx
  on public.election_materials(status, material_kind, display_order, candidate_name);

create unique index if not exists election_materials_unique_seed_idx
  on public.election_materials(candidate_name, position, material_kind);

alter table public.comments enable row level security;
alter table public.production_bonus_rows enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.managed_documents enable row level security;
alter table public.election_materials enable row level security;

drop policy if exists "Approved comments are public" on public.comments;
create policy "Approved comments are public"
  on public.comments for select
  to anon, authenticated
  using (status = 'approved');

drop policy if exists "Anyone can submit pending comments" on public.comments;
create policy "Anyone can submit pending comments"
  on public.comments for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists "Bonus rows are public" on public.production_bonus_rows;
create policy "Bonus rows are public"
  on public.production_bonus_rows for select
  to anon, authenticated
  using (true);

drop policy if exists "Published documents are public" on public.managed_documents;
create policy "Published documents are public"
  on public.managed_documents for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Approved election materials are public" on public.election_materials;
create policy "Approved election materials are public"
  on public.election_materials for select
  to anon, authenticated
  using (status = 'approved');

-- Admin writes use the service role from Vercel API routes.
