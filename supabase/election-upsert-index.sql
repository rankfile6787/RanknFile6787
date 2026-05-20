create unique index if not exists election_materials_unique_seed_idx
  on public.election_materials(candidate_name, position, material_kind);
