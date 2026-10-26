-- Needs stubs.sql + migrations 0001-0005.
begin;
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"role":"ngo"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"role":"ngo"}'),
  ('00000000-0000-0000-0000-00000000000d', '{"role":"ngo"}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
grant all on all tables in schema public to authenticated, anon;
grant usage on schema public to authenticated, anon; grant usage on schema auth to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;
revoke execute on function _audit(text, text, uuid, jsonb) from public, anon, authenticated;
create temp table ctx (pid uuid, org uuid); grant all on ctx to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ declare org uuid; pid uuid; begin
  insert into organizations (name, type, created_by) values ('A', 'ngo', auth.uid()) returning id into org;
  insert into organization_members values (org, auth.uid());
  pid := create_project(org, 'P', null, 'mangrove', 'X', null, 10, '2024-01-01', current_date, '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}');
  insert into ctx values (pid, org);
  update organizations set wallet_address = '0x19b212Fc41790dCF8A8f1704928Aeda6c6495f8D' where id = org;   -- allowed before registration
  begin update organizations set wallet_address = 'not-an-address' where id = org; raise exception 'FAIL bad address';
  exception when check_violation then null; end;
  perform log_audit('organization.link_wallet', 'organization', org);                                      -- allowed for NGO
  begin insert into credit_batches (project_id, methodology, verification_ref, period_start, period_end, proposed_qty) values (pid, 'm', 'r', '2024-01-01', '2025-01-01', 1);
    raise exception 'FAIL ngo inserted batch'; exception when others then assert sqlerrm like 'credits can only be issued%' or sqlstate = '42501', sqlerrm; end;
  begin insert into blockchain_transactions (chain_id, tx_hash, kind, project_id) values (11155111, '0x01', 'issue', pid);
    raise exception 'FAIL ngo inserted tx'; exception when insufficient_privilege then null; end;
  update projects set status = 'submitted' where id = pid;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ declare pid uuid; begin
  select c.pid into pid from ctx c;
  begin insert into credit_batches (project_id, methodology, verification_ref, period_start, period_end, proposed_qty, approved_qty) values (pid, 'm', 'r', '2024-01-01', '2025-01-01', 10, 10);
    raise exception 'FAIL batch before approval'; exception when others then assert sqlerrm like 'credits can only be issued%', sqlerrm; end;
  perform review_project(pid, 'approve', 'Evidence consistent with boundary');
  insert into credit_batches (project_id, methodology, verification_ref, period_start, period_end, proposed_qty, approved_qty, onchain_batch_id, chain_id)
    values (pid, 'VM0033', 'ref', '2024-01-01', '2025-01-01', 10, 10, '123', 11155111);
  insert into blockchain_transactions (chain_id, tx_hash, kind, status, project_id) values (11155111, '0xabc', 'register', 'confirmed', pid);
  update projects set onchain_project_id = '0x' || repeat('a', 64), onchain_owner = '0x19b212Fc41790dCF8A8f1704928Aeda6c6495f8D' where id = pid;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ declare org uuid; begin
  select c.org into org from ctx c;
  assert (select count(*) from blockchain_transactions) = 1, 'member should read own project tx';
  begin update organizations set wallet_address = '0x0000000000000000000000000000000000000001' where id = org; raise exception 'FAIL wallet change after registration';
  exception when others then assert sqlerrm like 'wallet is locked%', sqlerrm; end;
  begin insert into credit_batches (project_id, methodology, verification_ref, period_start, period_end, proposed_qty) values ((select c.pid from ctx c), 'm', 'r', '2025-01-01', '2026-01-01', 1);
    raise exception 'FAIL ngo inserted batch on approved project'; exception when insufficient_privilege then null; end;
  begin update projects set onchain_owner = '0x0000000000000000000000000000000000000001' where id = (select c.pid from ctx c); raise exception 'FAIL ngo changed onchain owner';
  exception when others then assert sqlerrm like 'on-chain registration fields%' or sqlerrm like 'project is locked%', sqlerrm; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
do $$ begin
  assert (select count(*) from blockchain_transactions) = 0, 'outsider sees tx';
end $$;
rollback;
select 'PHASE4_SMOKE_OK';
