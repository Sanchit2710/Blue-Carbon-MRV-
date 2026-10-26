-- BlueCarbon MRV — Phase 1 schema. Postgres / Supabase.
-- Credit quantities: proposed -> approved -> issued -> (sold/available) -> retired.
-- 1 credit = 1 tCO2e ONLY if the chosen methodology allows (see docs/credit-lifecycle.md).

create type user_role as enum ('ngo', 'company', 'admin');
create type org_type as enum ('ngo', 'panchayat', 'company', 'verifier');
create type project_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'requires_more_evidence');
create type ecosystem_type as enum ('mangrove', 'seagrass', 'salt_marsh', 'other');
create type decision_type as enum ('approve', 'reject', 'request_more_evidence');
create type tx_status as enum ('pending', 'confirmed', 'failed');
create type maintenance_status as enum ('scheduled', 'submitted', 'verified', 'missed', 'flagged');

create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── identity ─────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'company',
  full_name text,
  wallet_address text check (wallet_address ~* '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type org_type not null,
  contact_email text,
  contact_phone text,
  region text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on organization_members (user_id);

-- ───────────── helpers (security definer: avoid RLS recursion) ─────────────
create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create function is_org_member(org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members where organization_id = org and user_id = auth.uid()) $$;

-- ───────────── projects ─────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  name text not null,
  description text,
  ecosystem ecosystem_type not null,
  region text not null,
  species text,
  area_hectares numeric(12,2) check (area_hectares > 0),
  planting_date date,
  status project_status not null default 'draft',
  is_demo boolean not null default false,
  -- ten-year stewardship; responsibility parties are separate by design
  stewardship_start date,
  stewardship_end date,
  stewardship_responsible text default 'registering organization',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on projects (organization_id);
create index on projects (status);

create table project_boundaries (
  project_id uuid primary key references projects(id) on delete cascade,
  geojson jsonb not null,            -- GeoJSON Polygon/MultiPolygon, WGS84
  created_at timestamptz not null default now()
);

-- ───────────── evidence & verification ─────────────
create table evidence_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  kind text not null check (kind in ('photo', 'document')),
  storage_path text not null,        -- Supabase Storage / IPFS CID (Phase 2)
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  perceptual_hash text,
  mime_type text not null,
  size_bytes bigint not null,
  exif jsonb,
  gps_lat double precision,
  gps_lng double precision,
  captured_at timestamptz,
  flags jsonb not null default '[]', -- e.g. missing_gps, outside_boundary, duplicate_of
  created_at timestamptz not null default now()
);
create index on evidence_files (project_id);
create index on evidence_files (sha256);

create table verification_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('geofence', 'duplicate', 'satellite', 'model')),
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index on verification_reports (project_id);

create table verification_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  decision decision_type not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index on verification_decisions (project_id);

create table maintenance_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  due_date date not null,
  status maintenance_status not null default 'scheduled',
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  notes text,
  reviewed_by uuid references profiles(id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on maintenance_reports (project_id, due_date);

-- ───────────── credits & market ─────────────
create table credit_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  methodology text not null,
  verification_ref text not null,
  period_start date not null,
  period_end date not null,
  proposed_qty numeric(14,2) not null check (proposed_qty >= 0),
  approved_qty numeric(14,2) not null default 0,
  issued_qty numeric(14,2) not null default 0,
  retired_qty numeric(14,2) not null default 0,
  onchain_batch_id text unique,      -- duplicate-issuance guard mirrors contract
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  check (approved_qty <= proposed_qty),
  check (issued_qty <= approved_qty),
  check (retired_qty <= issued_qty),
  unique (project_id, period_start, period_end)  -- no overlapping duplicate period for same project
);

create table marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references credit_batches(id) on delete cascade,
  seller_org_id uuid not null references organizations(id),
  quantity_available numeric(14,2) not null check (quantity_available >= 0),
  price_per_credit numeric(12,2) not null check (price_per_credit > 0),
  currency text not null default 'USD',
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table blockchain_transactions (
  id uuid primary key default gen_random_uuid(),
  chain_id integer not null,
  tx_hash text unique,
  kind text not null check (kind in ('issue', 'purchase', 'transfer', 'retire', 'register')),
  status tx_status not null default 'pending',
  from_address text,
  to_address text,
  error text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references marketplace_listings(id),
  buyer_org_id uuid not null references organizations(id),
  quantity numeric(14,2) not null check (quantity > 0),
  total_price numeric(14,2) not null,
  status tx_status not null default 'pending',   -- only 'confirmed' counts as a sale
  is_demo boolean not null default false,
  transaction_id uuid references blockchain_transactions(id),
  created_at timestamptz not null default now()
);
create index on purchases (buyer_org_id);

create table credit_retirements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references credit_batches(id),
  org_id uuid not null references organizations(id),
  quantity numeric(14,2) not null check (quantity > 0),
  beneficiary text,
  reason text,
  transaction_id uuid references blockchain_transactions(id),
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on audit_logs (entity, entity_id);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['profiles','organizations','projects','maintenance_reports','credit_batches','marketplace_listings'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ───────────── signup: create profile; role is CLAMPED (admin only via SQL) ─────────────
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := new.raw_user_meta_data->>'role';
begin
  insert into profiles (id, role, full_name)
  values (new.id,
          case when r = 'ngo' then 'ngo'::user_role else 'company'::user_role end,
          new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Only admins may change a project to a reviewed status; owners may only draft -> submitted.
create function guard_project_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not is_admin() then
    if not (old.status in ('draft','requires_more_evidence') and new.status = 'submitted') then
      raise exception 'status change % -> % not permitted', old.status, new.status;
    end if;
  end if;
  return new;
end $$;
create trigger projects_status_guard before update on projects for each row execute function guard_project_status();

-- ───────────── RLS ─────────────
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table projects enable row level security;
alter table project_boundaries enable row level security;
alter table evidence_files enable row level security;
alter table verification_reports enable row level security;
alter table verification_decisions enable row level security;
alter table maintenance_reports enable row level security;
alter table credit_batches enable row level security;
alter table marketplace_listings enable row level security;
alter table blockchain_transactions enable row level security;
alter table purchases enable row level security;
alter table credit_retirements enable row level security;
alter table audit_logs enable row level security;

-- profiles: self or admin read; self update but never role
create policy profiles_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from profiles p where p.id = auth.uid()));

-- organizations
create policy orgs_read on organizations for select using (is_admin() or is_org_member(id) or created_by = auth.uid());
create policy orgs_insert on organizations for insert with check (created_by = auth.uid());
create policy orgs_update on organizations for update using (is_org_member(id) or is_admin());
create policy members_read on organization_members for select using (user_id = auth.uid() or is_admin());
create policy members_insert on organization_members for insert with check (
  user_id = auth.uid() and exists (select 1 from organizations o where o.id = organization_id and o.created_by = auth.uid()));

-- projects: public may see approved; org members see own; admin sees all (not drafts' private data beyond need)
create policy projects_read on projects for select using (status = 'approved' or is_org_member(organization_id) or is_admin());
create policy projects_insert on projects for insert with check (is_org_member(organization_id) and status = 'draft');
create policy projects_update on projects for update using (is_org_member(organization_id) or is_admin());

create policy boundaries_read on project_boundaries for select using (
  exists (select 1 from projects p where p.id = project_id)); -- inherits projects RLS
create policy boundaries_write on project_boundaries for all
  using (exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)))
  with check (exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)));

-- evidence: owner org + admin only (private)
create policy evidence_read on evidence_files for select using (
  exists (select 1 from projects p where p.id = project_id and (is_org_member(p.organization_id) or is_admin())));
create policy evidence_insert on evidence_files for insert with check (
  uploaded_by = auth.uid() and exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)));

-- verification: admin writes; owner org reads
create policy vreports_read on verification_reports for select using (
  exists (select 1 from projects p where p.id = project_id and (is_org_member(p.organization_id) or is_admin())));
create policy vreports_write on verification_reports for insert with check (is_admin());
create policy vdecisions_read on verification_decisions for select using (
  exists (select 1 from projects p where p.id = project_id and (is_org_member(p.organization_id) or is_admin())));
create policy vdecisions_write on verification_decisions for insert with check (is_admin() and reviewer_id = auth.uid());

-- maintenance
create policy maint_read on maintenance_reports for select using (
  exists (select 1 from projects p where p.id = project_id and (is_org_member(p.organization_id) or is_admin())));
create policy maint_write on maintenance_reports for all
  using (is_admin() or exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)))
  with check (is_admin() or exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)));

-- credits: batches readable for visible projects; only admin writes (issuance authority)
create policy batches_read on credit_batches for select using (
  exists (select 1 from projects p where p.id = project_id));
create policy batches_write on credit_batches for all using (is_admin()) with check (is_admin());
create policy listings_read on marketplace_listings for select using (
  active and exists (select 1 from credit_batches b where b.id = batch_id) or is_org_member(seller_org_id) or is_admin());
create policy listings_write on marketplace_listings for all using (is_admin()) with check (is_admin());

-- purchases / retirements / tx: buyer org + admin read; writes via server (service role) in Phase 5
create policy purchases_read on purchases for select using (is_org_member(buyer_org_id) or is_admin());
create policy retire_read on credit_retirements for select using (is_org_member(org_id) or is_admin());
create policy tx_read on blockchain_transactions for select using (is_admin());
create policy audit_read on audit_logs for select using (is_admin());
-- audit_logs / transactions / purchases / retirements have no client insert policy: service role only.
