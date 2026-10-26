-- DEMONSTRATION DATA ONLY. All rows flagged is_demo = true. Not real projects, areas or prices.
-- Run after migrations: supabase db reset  (or paste in SQL editor).
with o as (
  insert into organizations (name, type, region) values ('Demo Sundarbans Collective', 'ngo', 'West Bengal') returning id
), p as (
  insert into projects (organization_id, name, description, ecosystem, region, species, area_hectares, planting_date, status, is_demo)
  select id, '[DEMO] Sundarbans Mangrove Restoration', 'Sample project for UI development.', 'mangrove', 'West Bengal', 'Rhizophora mucronata', 120, '2024-07-01', 'approved', true from o
  returning id, organization_id
), b as (
  insert into credit_batches (project_id, methodology, verification_ref, period_start, period_end, proposed_qty, approved_qty, issued_qty)
  select id, '[DEMO] placeholder methodology', '[DEMO] ref-0001', '2024-07-01', '2025-06-30', 1000, 800, 800 from p returning id, project_id
)
insert into marketplace_listings (batch_id, seller_org_id, quantity_available, price_per_credit, is_demo)
select b.id, p.organization_id, 800, 12.50, true from b join p on p.id = b.project_id;
