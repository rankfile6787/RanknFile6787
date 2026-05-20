alter table public.election_materials
  add column if not exists display_order integer not null default 0;

create index if not exists election_materials_public_order_idx
  on public.election_materials(status, material_kind, display_order, candidate_name);
