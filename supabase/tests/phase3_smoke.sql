-- Needs stubs.sql + migrations 0001-0003.
begin;
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"role":"ngo"}'),       -- owner
  ('00000000-0000-0000-0000-00000000000c', '{"role":"ngo"}'),       -- becomes admin
  ('00000000-0000-0000-0000-00000000000e', '{"role":"ngo"}');       -- becomes admin who is also a member (conflict)
update profiles set role = 'admin' where id in ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000e');
grant all on all tables in schema public to authenticated, anon;
grant usage on schema public to authenticated, anon; grant usage on schema auth to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;
revoke execute on function _audit(text, text, uuid, jsonb) from public, anon, authenticated;

create temp table ctx (pid uuid, pid2 uuid, rid uuid); grant all on ctx to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ declare org uuid; p1 uuid; p2 uuid; begin
  insert into organizations (name, type, created_by) values ('A', 'ngo', auth.uid()) returning id into org;
  insert into organization_members values (org, auth.uid());
  insert into organization_members select org, '00000000-0000-0000-0000-00000000000e' where false; -- (member row for e added by superuser below)
  p1 := create_project(org, 'P1', null, 'mangrove', 'X', null, 10, '2024-01-01', current_date, '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}');
  p2 := create_project(org, 'P2', null, 'mangrove', 'X', null, 10, '2024-01-01', current_date, '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}');
  update projects set status = 'submitted' where id in (p1, p2);
  insert into ctx values (p1, p2, null);
  begin perform log_audit('project.approve', 'project', p1); raise exception 'FAIL audit forgery';
  exception when others then assert sqlerrm like 'audit action%reserved', sqlerrm; end;
  begin perform review_project(p1, 'approve', 'looks fine to me'); raise exception 'FAIL owner approve';
  exception when others then assert sqlerrm = 'admin only', sqlerrm; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ declare p1 uuid; p2 uuid; begin
  select c.pid, c.pid2 into p1, p2 from ctx c;
  begin perform review_project(p1, 'approve', 'short'); raise exception 'FAIL short reason';
  exception when others then assert sqlerrm like 'reason must%', sqlerrm; end;
  perform start_review(p1);
  assert (select status from projects where id = p1) = 'under_review';
  perform review_project(p1, 'approve', 'Evidence consistent with boundary');
  assert (select status from projects where id = p1) = 'approved', 'approved';
  assert (select count(*) from maintenance_reports where project_id = p1) = 10, 'schedule created on approval';
  assert (select count(*) from verification_decisions where project_id = p1 and reviewer_id = auth.uid()) = 1, 'decision row';
  assert (select count(*) from audit_logs where action = 'project.approve' and entity_id = p1) = 1, 'audit row';
  begin perform review_project(p1, 'reject', 'trying to flip after approval'); raise exception 'FAIL re-review';
  exception when others then assert sqlerrm like 'project is approved%', sqlerrm; end;
  perform review_project(p2, 'request_more_evidence', 'Need photos inside the boundary');
  assert (select status from projects where id = p2) = 'requires_more_evidence', 'rme';
  assert (select count(*) from maintenance_reports where project_id = p2) = 0, 'no schedule without approval';
end $$;

-- owner sees feedback, can resubmit, cannot touch review fields
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ declare p2 uuid; r uuid; begin
  select c.pid2 into p2 from ctx c;
  assert (select count(*) from verification_decisions where project_id = p2) = 1, 'owner sees decision';
  update projects set status = 'submitted' where id = p2;
  select id into r from maintenance_reports order by due_date limit 1;
  update ctx set rid = r;
  update maintenance_reports set notes = 'trees healthy, 85% survival' where id = r;
  assert (select status from maintenance_reports where id = r) = 'submitted';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ declare r uuid; begin
  select c.rid into r from ctx c;
  begin perform review_maintenance(r, 'scheduled', 'nope nope'); raise exception 'FAIL bad outcome';
  exception when others then assert sqlerrm like 'outcome must%', sqlerrm; end;
  perform review_maintenance(r, 'flagged', 'Survival claim unsupported by photos');
  assert (select status from maintenance_reports where id = r) = 'flagged', 'flagged';
  assert (select reviewed_by from maintenance_reports where id = r) = auth.uid(), 'reviewer recorded';
  begin perform review_maintenance(r, 'verified', 'second review attempt'); raise exception 'FAIL re-review maint';
  exception when others then assert sqlerrm like 'report is flagged%', sqlerrm; end;
  assert mark_missed_maintenance() = 0, 'nothing overdue yet';
end $$;

-- overdue marking (superuser backdates a milestone)
reset role;
update maintenance_reports set due_date = current_date - 5 where id = (select id from maintenance_reports where status = 'scheduled' order by due_date limit 1);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ begin
  assert mark_missed_maintenance() = 1, 'one missed';
  assert (select count(*) from maintenance_reports where status = 'missed') = 1;
end $$;

-- conflict of interest: admin who is also org member
reset role;
insert into organization_members select o.id, '00000000-0000-0000-0000-00000000000e' from organizations o;
update projects set status = 'submitted' where id = (select c.pid2 from ctx c);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', true);
do $$ begin
  begin perform review_project((select c.pid2 from ctx c), 'approve', 'approving my own org'); raise exception 'FAIL conflict';
  exception when others then assert sqlerrm like 'conflict of interest%', sqlerrm; end;
end $$;
rollback;
select 'PHASE3_SMOKE_OK';
