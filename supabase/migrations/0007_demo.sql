-- Demonstration data support. Every demo row is flagged is_demo and shown as "Demonstration data";
-- demo trades are simulated (no transaction hash) and say so wherever they appear.
alter table organizations add column is_demo boolean not null default false;
alter table credit_batches add column is_demo boolean not null default false;
alter table credit_retirements add column is_demo boolean not null default false;
alter table evidence_files add column is_demo boolean not null default false;

-- Optional public cover photo for a project (https only). Evidence stays private.
alter table projects add column cover_url text check (cover_url ~ '^https://');

-- Public totals for the landing page (approved projects only; counts, no private data).
create function platform_stats() returns table (projects int, hectares numeric, issued numeric, retired numeric, has_demo boolean)
language sql stable security definer set search_path = public as $$
  with p as (select id, area_hectares, is_demo from projects where status = 'approved'),
       b as (select issued_qty, retired_qty from credit_batches where project_id in (select id from p))
  select (select count(*)::int from p),
         (select coalesce(sum(area_hectares), 0) from p),
         (select coalesce(sum(issued_qty), 0) from b),
         (select coalesce(sum(retired_qty), 0) from b),
         (select coalesce(bool_or(is_demo), false) from p) $$;
