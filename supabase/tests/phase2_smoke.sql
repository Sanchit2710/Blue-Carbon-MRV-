-- Needs 0001 + 0002 applied. Supabase provides auth.* and storage.*; stub them for plain Postgres (see docs/testing note in README).
begin;
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"role":"ngo"}'),
  ('00000000-0000-0000-0000-00000000000d', '{"role":"ngo"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"role":"ngo"}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
grant all on all tables in schema public to authenticated, anon;
grant usage on schema public to authenticated, anon; grant usage on schema auth to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
create temp table ctx (pid uuid, org uuid, rid uuid);
grant all on ctx to authenticated;
do $$ declare org uuid; pid uuid; begin
  insert into organizations (name, type, created_by) values ('A', 'ngo', auth.uid()) returning id into org;
  insert into organization_members values (org, auth.uid());
  pid := create_project(org, 'P', null, 'mangrove', 'X', null, 10, '2024-01-01', '2024-02-01',
         '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}');
  insert into ctx values (pid, org, null);
  assert (select stewardship_end from projects where id = pid) = '2034-02-01', 'stewardship end';
  assert (select count(*) from project_boundaries where project_id = pid) = 1, 'boundary';
  begin insert into projects (organization_id, name, ecosystem, region, is_demo) values (org, 'D', 'mangrove', 'X', true);
    raise exception 'FAIL is_demo insert'; exception when insufficient_privilege or check_violation then null; end;
  insert into evidence_files (project_id, uploaded_by, kind, storage_path, sha256, perceptual_hash, mime_type, size_bytes)
    values (pid, auth.uid(), 'photo', 'x', repeat('a', 64), '0000000000000000', 'image/jpeg', 1);
  update projects set name = 'P2' where id = pid;           -- editable while draft
  update projects set status = 'submitted' where id = pid;
  begin update projects set name = 'hacked' where id = pid; raise exception 'FAIL edit after submit';
  exception when others then assert sqlerrm like 'project is locked%', sqlerrm; end;
  begin update projects set is_demo = true where id = pid; raise exception 'FAIL is_demo update';
  exception when others then assert sqlerrm like 'is_demo%', sqlerrm; end;
end $$;

-- admin creates schedule
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ begin
  assert generate_maintenance_schedule((select pid from ctx)) = 10, 'schedule size';
  begin perform generate_maintenance_schedule((select pid from ctx)); raise exception 'FAIL dup schedule';
  exception when others then assert sqlerrm = 'schedule exists', sqlerrm; end;
  update ctx set rid = (select id from maintenance_reports order by due_date limit 1);
end $$;

-- owner may only submit
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ begin
  begin perform generate_maintenance_schedule((select pid from ctx)); raise exception 'FAIL non-admin schedule';
  exception when others then assert sqlerrm = 'admin only', sqlerrm; end;
  update maintenance_reports set status = 'verified', notes = 'trust me', review_notes = 'ok' where id = (select rid from ctx);
  -- trigger rewrites status; reviewer fields must be rejected
exception when others then assert sqlerrm like 'only notes%', sqlerrm;
end $$;
do $$ begin
  update maintenance_reports set status = 'verified', notes = 'trees alive' where id = (select rid from ctx);
  assert (select status from maintenance_reports where id = (select rid from ctx)) = 'submitted', 'owner self-verified';
  begin update maintenance_reports set notes = 'again' where id = (select rid from ctx); raise exception 'FAIL resubmit';
  exception when others then assert sqlerrm like 'report already%', sqlerrm; end;
end $$;

-- cross-org duplicate counts: other org sees counts for its own project only, never rows
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
do $$ declare org uuid; pid uuid; r record; begin
  insert into organizations (name, type, created_by) values ('B', 'ngo', auth.uid()) returning id into org;
  insert into organization_members values (org, auth.uid());
  pid := create_project(org, 'Q', null, 'seagrass', 'Y', null, 5, '2024-01-01', '2024-02-01',
         '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}');
  select * into r from evidence_duplicate_counts(pid, repeat('a', 64), 'ffffffffffffffff');
  assert r.exact_dupes = 1, 'exact dup across orgs';
  select * into r from evidence_duplicate_counts(pid, repeat('b', 64), '0000000000000003');
  assert r.similar = 1, 'similar by hamming';
  select * into r from evidence_duplicate_counts(pid, repeat('b', 64), 'ffffffffffffffff');
  assert r.similar = 0, 'not similar';
  assert (select count(*) from evidence_duplicate_counts((select c.pid from ctx c), repeat('a', 64), null)) = 0, 'non-member probe must return nothing';
  assert (select count(*) from evidence_files) = 0, 'other org evidence leaked';
end $$;
rollback;
select 'PHASE2_SMOKE_OK';
