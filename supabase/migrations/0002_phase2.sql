-- Phase 2: tighten write paths, evidence storage, duplicate lookup, audit helper, maintenance schedule.

-- ───── projects: no is_demo self-flagging; core fields locked once submitted ─────
drop policy projects_insert on projects;
create policy projects_insert on projects for insert
  with check (is_org_member(organization_id) and status = 'draft' and not is_demo);

create function guard_project_edit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then return new; end if;
  if new.is_demo is distinct from old.is_demo or new.organization_id is distinct from old.organization_id then
    raise exception 'is_demo / organization_id are not editable';
  end if;
  if old.status not in ('draft', 'requires_more_evidence') and (
       (new.name, new.description, new.ecosystem, new.region, new.species, new.area_hectares, new.planting_date,
        new.stewardship_start, new.stewardship_end, new.stewardship_responsible)
       is distinct from
       (old.name, old.description, old.ecosystem, old.region, old.species, old.area_hectares, old.planting_date,
        old.stewardship_start, old.stewardship_end, old.stewardship_responsible)) then
    raise exception 'project is locked while %', old.status;
  end if;
  return new;
end $$;
create trigger projects_edit_guard before update on projects for each row execute function guard_project_edit();

-- boundaries: owner may write only while project is editable
drop policy boundaries_write on project_boundaries;
create policy boundaries_write on project_boundaries for all
  using (exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)
                 and p.status in ('draft', 'requires_more_evidence')))
  with check (exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)
                 and p.status in ('draft', 'requires_more_evidence')));

-- ───── maintenance: owner may only submit; admin reviews ─────
drop policy maint_write on maintenance_reports;
create policy maint_admin on maintenance_reports for all using (is_admin()) with check (is_admin());
create policy maint_owner_update on maintenance_reports for update
  using (exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)));

create function guard_maintenance_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then return new; end if;
  if old.status not in ('scheduled', 'missed') then raise exception 'report already %', old.status; end if;
  if (new.project_id, new.due_date, new.reviewed_by, new.review_notes)
     is distinct from (old.project_id, old.due_date, old.reviewed_by, old.review_notes) then
    raise exception 'only notes may be edited';
  end if;
  new.status := 'submitted'; new.submitted_by := auth.uid(); new.submitted_at := now();
  return new;
end $$;
create trigger maintenance_guard before update on maintenance_reports for each row execute function guard_maintenance_update();

-- Admin creates the stewardship schedule (called on approval in Phase 3). Default: annual x 10.
create function generate_maintenance_schedule(p_project uuid, p_every_months int default 12, p_count int default 10)
returns int language plpgsql security definer set search_path = public as $$
declare s date; n int := 0;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select coalesce(stewardship_start, current_date) into s from projects where id = p_project;
  if not found then raise exception 'unknown project'; end if;
  if exists (select 1 from maintenance_reports where project_id = p_project) then raise exception 'schedule exists'; end if;
  for i in 1..p_count loop
    insert into maintenance_reports (project_id, due_date) values (p_project, s + make_interval(months => i * p_every_months));
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───── audit helper: actor is always the caller; no direct client inserts ─────
create function log_audit(p_action text, p_entity text, p_entity_id uuid, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity, entity_id, detail)
  select auth.uid(), p_action, p_entity, p_entity_id, p_detail where auth.uid() is not null $$;

-- ───── cross-org duplicate lookup: returns counts only, never other orgs' rows ─────
create function evidence_duplicate_counts(p_project uuid, p_sha256 text, p_phash text)
returns table (exact_dupes int, similar int) language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from evidence_files e where e.sha256 = p_sha256),
    (select count(*)::int from evidence_files e
       where p_phash is not null and e.perceptual_hash is not null and e.sha256 <> p_sha256
         and bit_count(('x' || e.perceptual_hash)::bit(64) # ('x' || p_phash)::bit(64)) <= 8)
  where exists (select 1 from projects p where p.id = p_project and is_org_member(p.organization_id)) $$;

-- ───── private evidence bucket; path = <project_id>/<file> ─────
insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 10485760) on conflict (id) do nothing;

create policy evidence_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'evidence' and exists (select 1 from projects p
    where p.id::text = (storage.foldername(name))[1] and is_org_member(p.organization_id)));
create policy evidence_obj_read on storage.objects for select to authenticated using (
  bucket_id = 'evidence' and (is_admin() or exists (select 1 from projects p
    where p.id::text = (storage.foldername(name))[1] and is_org_member(p.organization_id))));

-- ───── atomic project + boundary creation (security invoker: RLS applies) ─────
create function create_project(
  p_org uuid, p_name text, p_description text, p_ecosystem ecosystem_type, p_region text, p_species text,
  p_area numeric, p_planting date, p_stewardship_start date, p_boundary jsonb)
returns uuid language plpgsql as $$
declare pid uuid;
begin
  insert into projects (organization_id, name, description, ecosystem, region, species, area_hectares,
                        planting_date, stewardship_start, stewardship_end)
  values (p_org, p_name, p_description, p_ecosystem, p_region, p_species, p_area, p_planting,
          p_stewardship_start, p_stewardship_start + interval '10 years')
  returning id into pid;
  insert into project_boundaries (project_id, geojson) values (pid, p_boundary);
  return pid;
end $$;
