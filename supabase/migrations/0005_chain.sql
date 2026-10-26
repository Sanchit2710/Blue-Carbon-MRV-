-- Phase 4b: on-chain issuance on Sepolia. The chain is the record of ownership; these columns mirror
-- what the server has independently confirmed from transaction receipts.

-- Credits are minted to the organisation's wallet (linked by a signed message in the app).
alter table organizations add column wallet_address text check (wallet_address ~ '^0x[0-9a-fA-F]{40}$');

alter table projects
  add column onchain_project_id text check (onchain_project_id ~ '^0x[0-9a-f]{64}$'),
  add column onchain_owner text check (onchain_owner ~ '^0x[0-9a-fA-F]{40}$');

alter table credit_batches add column chain_id integer;

alter table blockchain_transactions
  add column project_id uuid references projects(id),
  add column batch_id uuid references credit_batches(id);
create index on blockchain_transactions (project_id);

-- Once any project of the org is registered on-chain, only an admin may change the wallet:
-- credits already point at the registered owner address.
create function guard_org_wallet() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.wallet_address is distinct from old.wallet_address and not is_admin()
     and exists (select 1 from projects where organization_id = old.id and onchain_owner is not null) then
    raise exception 'wallet is locked: a project is already registered on-chain to %', old.wallet_address;
  end if;
  return new;
end $$;
create trigger organizations_wallet_guard before update on organizations for each row execute function guard_org_wallet();

-- On-chain registration fields are written only by verifiers (after the server checks the receipt).
create function guard_project_chain_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and (new.onchain_project_id, new.onchain_owner) is distinct from (old.onchain_project_id, old.onchain_owner) then
    raise exception 'on-chain registration fields are set by verifiers only';
  end if;
  return new;
end $$;
create trigger projects_chain_guard before update on projects for each row execute function guard_project_chain_fields();

-- Batches only for approved projects.
create function guard_batch_project() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from projects where id = new.project_id and status = 'approved') then
    raise exception 'credits can only be issued for approved projects';
  end if;
  return new;
end $$;
create trigger credit_batches_project_guard before insert on credit_batches for each row execute function guard_batch_project();

-- Transactions: admin records them; members of the related project's organisation can read them.
drop policy tx_read on blockchain_transactions;
create policy tx_read on blockchain_transactions for select using (
  is_admin() or exists (select 1 from projects p where p.id = project_id and is_org_member(p.organization_id)));
create policy tx_admin_write on blockchain_transactions for insert with check (is_admin());
create policy tx_admin_update on blockchain_transactions for update using (is_admin()) with check (is_admin());

-- Non-admin audit actions now include linking a wallet.
create or replace function log_audit(p_action text, p_entity text, p_entity_id uuid, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not is_admin() and p_action not in
     ('organization.create', 'organization.link_wallet', 'project.create', 'project.submit', 'evidence.upload', 'maintenance.submit') then
    raise exception 'audit action % is reserved', p_action;
  end if;
  insert into audit_logs (actor_id, action, entity, entity_id, detail) values (auth.uid(), p_action, p_entity, p_entity_id, p_detail);
end $$;
