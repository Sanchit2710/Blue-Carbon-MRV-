-- Phase 5: marketplace, purchases and retirement. Listing, purchase and retirement rows are written
-- only by the server with the service key, after it has confirmed the transaction receipt on-chain.

-- Prices are in (test) ETH: widen precision.
alter table marketplace_listings
  alter column price_per_credit type numeric(30,18),
  alter column currency set default 'SepoliaETH',
  add column onchain_listing_id bigint unique,
  add column price_wei_per_unit text,
  add column seller_address text,
  add column chain_id integer,
  add column tx_hash text unique;

alter table purchases
  alter column total_price type numeric(30,18),
  add column buyer_address text,
  add column tx_hash text unique;

alter table credit_retirements
  add column holder_address text,
  add column tx_hash text unique;

-- Cross-table checks as security-definer helpers: policies on purchases and listings that query
-- each other directly would recurse.
create function is_listing_seller(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from marketplace_listings where id = l and is_org_member(seller_org_id)) $$;
create function bought_from_listing(l uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from purchases where listing_id = l and is_org_member(buyer_org_id)) $$;

-- Sellers see purchases of their listings; retirements are public (they are public on-chain anyway).
create policy purchases_seller_read on purchases for select using (is_listing_seller(listing_id));
create policy retire_public_read on credit_retirements for select using (true);
-- Buyers keep seeing listings they bought from after they sell out or are cancelled.
create policy listings_buyer_read on marketplace_listings for select using (bought_from_listing(id));

-- Only NGO accounts register projects (a company account could otherwise create an NGO-type org).
drop policy projects_insert on projects;
create policy projects_insert on projects for insert with check (
  is_org_member(organization_id) and status = 'draft' and not is_demo
  and exists (select 1 from profiles where id = auth.uid() and role = 'ngo'));

-- Organisation type follows the account role.
create function guard_org_type() returns trigger language plpgsql security definer set search_path = public as $$
declare r user_role;
begin
  select role into r from profiles where id = auth.uid();
  if r = 'company' and new.type <> 'company' then raise exception 'company accounts create company organisations'; end if;
  if r = 'ngo' and new.type not in ('ngo', 'panchayat') then raise exception 'NGO accounts create NGO or panchayat organisations'; end if;
  return new;
end $$;
create trigger organizations_type_guard before insert on organizations for each row execute function guard_org_type();
