-- Needs stubs.sql + migrations 0001-0006. Superuser plays the server's service key.
begin;
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"role":"ngo"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"role":"company"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"role":"ngo"}'),
  ('00000000-0000-0000-0000-00000000000d', '{"role":"company"}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
grant all on all tables in schema public to authenticated, anon;
grant usage on schema public to authenticated, anon; grant usage on schema auth to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;
revoke execute on function _audit(text, text, uuid, jsonb) from public, anon, authenticated;
create temp table ctx (pid uuid, ngo_org uuid, co_org uuid, batch uuid, listing uuid); grant all on ctx to authenticated;

set local role authenticated;
-- company: org type guard, cannot register projects
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
do $$ declare co uuid; begin
  begin insert into organizations (name, type, created_by) values ('Fake NGO', 'ngo', auth.uid()); raise exception 'FAIL company made ngo org';
  exception when others then assert sqlerrm like 'company accounts create company%', sqlerrm; end;
  insert into organizations (name, type, created_by) values ('Acme', 'company', auth.uid()) returning id into co;
  insert into organization_members values (co, auth.uid());
  begin insert into projects (organization_id, name, ecosystem, region) values (co, 'X', 'mangrove', 'Y'); raise exception 'FAIL company created project';
  exception when insufficient_privilege then null; end;
  insert into ctx (co_org) values (co);
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ declare v_org uuid; v_pid uuid; begin
  begin insert into organizations (name, type, created_by) values ('Fake Co', 'company', auth.uid()); raise exception 'FAIL ngo made company org';
  exception when others then assert sqlerrm like 'NGO accounts create NGO%', sqlerrm; end;
  insert into organizations (name, type, created_by) values ('Mangrove NGO', 'ngo', auth.uid()) returning id into v_org;
  insert into organization_members values (v_org, auth.uid());
  v_pid := create_project(v_org, 'P', null, 'mangrove', 'X', null, 10, '2024-01-01', current_date, '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}');
  update projects set status = 'submitted' where id = v_pid;
  update ctx set pid = v_pid, ngo_org = v_org;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ declare b uuid; begin
  perform review_project((select c.pid from ctx c), 'approve', 'Evidence consistent with boundary');
  insert into credit_batches (project_id, methodology, verification_ref, period_start, period_end, proposed_qty, approved_qty, issued_qty, onchain_batch_id)
    values ((select c.pid from ctx c), 'VM0033', 'ref', '2024-01-01', '2025-01-01', 100, 100, 100, '1') returning id into b;
  update ctx set batch = b;
end $$;

-- server (service key) writes listing + purchase + retirement after chain confirmation
reset role;
do $$ declare l uuid; begin
  insert into marketplace_listings (batch_id, seller_org_id, quantity_available, price_per_credit, onchain_listing_id, tx_hash)
    select c.batch, c.ngo_org, 40, 0.001, 1, '0x01' from ctx c returning id into l;
  update ctx set listing = l;
  insert into purchases (listing_id, buyer_org_id, quantity, total_price, status, tx_hash) select c.listing, c.co_org, 40, 0.04, 'confirmed', '0x02' from ctx c;
  update marketplace_listings set active = false, quantity_available = 0 where id = l;  -- sold out
  insert into credit_retirements (batch_id, org_id, quantity, beneficiary, reason, tx_hash) select c.batch, c.co_org, 10, 'Acme', 'FY26', '0x03' from ctx c;
  update credit_batches set retired_qty = 10;
end $$;
set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
do $$ begin
  assert (select count(*) from purchases) = 1, 'buyer sees own purchase';
  assert (select count(*) from marketplace_listings) = 1, 'buyer still sees sold-out listing';
  begin insert into purchases (listing_id, buyer_org_id, quantity, total_price, status) select c.listing, c.co_org, 1, 0, 'confirmed' from ctx c; raise exception 'FAIL company forged purchase';
  exception when insufficient_privilege then null; end;
  begin insert into credit_retirements (batch_id, org_id, quantity) select c.batch, c.co_org, 1 from ctx c; raise exception 'FAIL company forged retirement';
  exception when insufficient_privilege then null; end;
  update credit_batches set retired_qty = 0;   -- RLS: no admin, so no rows change
  assert (select retired_qty from credit_batches limit 1) = 10, 'company changed retired total';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ begin
  assert (select count(*) from purchases) = 1, 'seller sees purchase of its listing';
  begin insert into marketplace_listings (batch_id, seller_org_id, quantity_available, price_per_credit) select c.batch, c.ngo_org, 1, 1 from ctx c; raise exception 'FAIL ngo forged listing';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
do $$ begin
  assert (select count(*) from purchases) = 0, 'other company sees purchase';
  assert (select count(*) from credit_retirements) = 1, 'retirements are public';
end $$;

reset role; set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  assert (select count(*) from credit_retirements) = 1, 'anon can verify a retirement certificate';
  assert (select count(*) from marketplace_listings) = 0, 'anon must not see inactive listings';
end $$;
rollback;
select 'PHASE5_SMOKE_OK';
