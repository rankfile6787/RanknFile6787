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

alter table public.managed_documents enable row level security;
alter table public.election_materials enable row level security;

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
