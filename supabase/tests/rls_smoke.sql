-- Smoke test for RLS and guards. Needs stub roles anon/authenticated + auth.users/auth.uid() (Supabase provides these).
-- Run on a DB after 0001_schema.sql only (no seed): psql -v ON_ERROR_STOP=1 -f rls_smoke.sql
begin;
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"role":"ngo"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"role":"admin"}'),   -- must be clamped to company
  ('00000000-0000-0000-0000-00000000000c', '{"role":"ngo"}');
do $$ begin
  assert (select role from profiles where id = '00000000-0000-0000-0000-00000000000b') = 'company', 'admin signup not clamped';
end $$;
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c'; -- operator promotion (superuser)
grant all on all tables in schema public to authenticated, anon; grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ declare org uuid; pid uuid; begin
  insert into organizations (name, type, created_by) values ('T', 'ngo', auth.uid()) returning id into org;
  insert into organization_members values (org, auth.uid());
  insert into projects (organization_id, name, ecosystem, region) values (org, 'P', 'mangrove', 'X') returning id into pid;
  update projects set status = 'submitted' where id = pid;                       -- allowed
  begin update projects set status = 'approved' where id = pid; raise exception 'FAIL self-approve allowed';
  exception when others then assert sqlerrm like 'status change%', sqlerrm; end;
  begin update profiles set role = 'admin' where id = auth.uid();
    assert (select role from profiles where id = auth.uid()) = 'ngo', 'self role escalation';
  exception when others then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ begin
  update projects set status = 'approved';                                       -- admin allowed
  assert (select count(*) from projects where status = 'approved') = 1, 'admin approve failed';
end $$;

reset role; set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  assert (select count(*) from projects) = 1, 'anon should see approved project';
  assert (select count(*) from evidence_files) = 0, 'anon sees evidence';
end $$;
rollback;
select 'RLS_SMOKE_OK';
