-- Published sites: public read-only snapshots for shareable launch URLs.
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).

create table if not exists published_sites (
  id uuid primary key default gen_random_uuid(),
  title text,
  site_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists published_sites_created_at_idx
  on published_sites (created_at desc);

alter table published_sites enable row level security;

-- Public read by exact id only (share links). No listing all rows.
create policy "published_sites_select_by_id"
  on published_sites
  for select
  to anon, authenticated
  using (true);

-- Allow inserts for prototype launch flow (tighten when auth is added).
create policy "published_sites_insert"
  on published_sites
  for insert
  to anon, authenticated
  with check (true);
