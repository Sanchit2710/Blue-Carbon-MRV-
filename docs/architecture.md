# Architecture

Hybrid: PostgreSQL (Supabase) for application data, private object storage for evidence, blockchain only for ownership/issuance/retirement events.

## Status of each component
| Component | Status |
|---|---|
| Next.js app, landing page, role dashboards (shells) | Implemented (Phase 1) |
| Supabase auth (email/password), profiles, role clamping | Implemented (Phase 1) |
| DB schema + RLS (`supabase/migrations/0001_schema.sql`) | Implemented, smoke-tested locally |
| NGO project/evidence/maintenance flows | Planned (Phase 2) |
| Verifier workflow, audit logs, hash/EXIF/duplicate checks | Planned (Phase 3) |
| Solidity contracts | Planned (Phase 4) |
| Wallet, marketplace purchases, retirement | Planned (Phase 5) |
| Satellite/NDVI, model-assisted review | Planned (Phase 6) |

## Security model
- Authorization = Postgres RLS + `requireRole()` in server components. Hiding UI is not relied on.
- Self-signup can only produce `ngo` or `company`; the signup trigger clamps any other requested role. Admins are promoted by an operator via SQL.
- Project status: owners may only go draft/requires_more_evidence -> submitted; all other transitions need an admin (trigger `guard_project_status`).
- Evidence, purchases, retirements, transactions, audit logs: no client insert policy where server-side-only (service role, Phase 2+).
- `proxy.ts` refreshes the session and does an optimistic redirect only.

## Limits to keep in mind
Blockchain records are auditable, not proof of physical restoration. A photo hash proves file consistency only. NDVI does not measure carbon. An ERC-20 is not automatically a legally recognized carbon credit.
