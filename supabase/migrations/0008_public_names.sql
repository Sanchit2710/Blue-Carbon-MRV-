-- Organisation names are public only where the organisation acts publicly: it has an approved project
-- or a recorded retirement. Contact details and everything else stay private (RLS on organizations).
create function public_org_name(org uuid) returns text language sql stable security definer set search_path = public as $$
  select o.name from organizations o
  where o.id = org
    and (exists (select 1 from projects p where p.organization_id = o.id and p.status = 'approved')
         or exists (select 1 from credit_retirements r where r.org_id = o.id)) $$;
