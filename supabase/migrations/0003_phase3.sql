-- Phase 3: verifier workflow. All decisions go through security-definer functions so
-- decision + status change + schedule + audit entry happen atomically and cannot be forged.

-- ───── audit hardening: non-admins may only log known NGO/company actions ─────
create or replace function log_audit(p_action text, p_entity text, p_entity_id uuid, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not is_admin() and p_action not in
     ('organization.create', 'project.create', 'project.submit', 'evidence.upload', 'maintenance.submit') then
    raise exception 'audit action % is reserved', p_action;
  end if;
  insert into audit_logs (actor_id, action, entity, entity_id, detail) values (auth.uid(), p_action, p_entity, p_entity_id, p_detail);
end $$;

create function _audit(p_action text, p_entity text, p_entity_id uuid, p_detail jsonb) returns void
language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity, entity_id, detail) values (auth.uid(), p_action, p_entity, p_entity_id, p_detail) $$;
revoke execute on function _audit(text, text, uuid, jsonb) from public, anon, authenticated;

-- ───── submitted -> under_review ─────
create function start_review(p_project uuid) returns void language plpgsql security definer set search_path = public as $$
declare pr projects%rowtype;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into pr from projects where id = p_project for update;
  if not found then raise exception 'unknown project'; end if;
  if pr.status <> 'submitted' then raise exception 'project is %, not awaiting review', pr.status; end if;
  if is_org_member(pr.organization_id) then raise exception 'conflict of interest: reviewer belongs to the project organization'; end if;
  update projects set status = 'under_review' where id = p_project;
  perform _audit('project.start_review', 'project', p_project, null);
end $$;

-- ───── decision: approve / reject / request_more_evidence ─────
create function review_project(p_project uuid, p_decision decision_type, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare pr projects%rowtype;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'reason must be at least 10 characters'; end if;
  select * into pr from projects where id = p_project for update;
  if not found then raise exception 'unknown project'; end if;
  if pr.status not in ('submitted', 'under_review') then raise exception 'project is %, not reviewable', pr.status; end if;
  if is_org_member(pr.organization_id) then raise exception 'conflict of interest: reviewer belongs to the project organization'; end if;

  insert into verification_decisions (project_id, reviewer_id, decision, reason) values (p_project, auth.uid(), p_decision, trim(p_reason));
  update projects set status = (case p_decision
      when 'approve' then 'approved' when 'reject' then 'rejected' else 'requires_more_evidence' end)::project_status
    where id = p_project;
  -- Approval opens the stewardship monitoring schedule. It does NOT issue credits.
  if p_decision = 'approve' and not exists (select 1 from maintenance_reports where project_id = p_project) then
    perform generate_maintenance_schedule(p_project);
  end if;
  perform _audit('project.' || p_decision, 'project', p_project, jsonb_build_object('reason', trim(p_reason), 'from', pr.status));
end $$;

-- ───── maintenance review ─────
create function review_maintenance(p_report uuid, p_outcome maintenance_status, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
declare r maintenance_reports%rowtype; org uuid;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_outcome not in ('verified', 'flagged') then raise exception 'outcome must be verified or flagged'; end if;
  if length(trim(coalesce(p_notes, ''))) < 5 then raise exception 'notes required'; end if;
  select * into r from maintenance_reports where id = p_report for update;
  if not found then raise exception 'unknown report'; end if;
  if r.status <> 'submitted' then raise exception 'report is %, not awaiting review', r.status; end if;
  select organization_id into org from projects where id = r.project_id;
  if is_org_member(org) then raise exception 'conflict of interest: reviewer belongs to the project organization'; end if;
  update maintenance_reports set status = p_outcome, reviewed_by = auth.uid(), review_notes = trim(p_notes) where id = p_report;
  perform _audit('maintenance.' || p_outcome, 'maintenance_report', p_report, jsonb_build_object('project_id', r.project_id));
end $$;

-- Marks overdue unsubmitted milestones as missed. No penalties: a flag for follow-up only.
create function mark_missed_maintenance() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  with u as (update maintenance_reports set status = 'missed' where status = 'scheduled' and due_date < current_date returning 1)
  select count(*) into n from u;
  if n > 0 then perform _audit('maintenance.mark_missed', 'maintenance_report', null, jsonb_build_object('count', n)); end if;
  return n;
end $$;
