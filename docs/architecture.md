# Architecture

Hybrid: PostgreSQL (Supabase) for application data, private object storage for evidence, blockchain only for ownership/issuance/retirement events.

## Status of each component
| Component | Status |
|---|---|
| Next.js app, landing page, role dashboards (shells) | Implemented (Phase 1) |
| Supabase auth (email/password), profiles, role clamping | Implemented (Phase 1) |
| DB schema + RLS (`supabase/migrations/0001_schema.sql`) | Implemented, smoke-tested locally |
| NGO org + project registration, evidence upload (SHA-256, EXIF GPS/time, boundary check, dHash similarity, exact-duplicate flag), maintenance report submission | Implemented (Phase 2), SQL + unit tested; not exercised against live Supabase |
| Evidence storage | Supabase private bucket `evidence`, originals up to 25 MB. IPFS NOT integrated |
| In-app camera capture with phone GPS, full-quality originals, download original, resolution checks | Implemented (see docs/ui-and-field-features.md); migration 0004 |
| UI redesign: shadcn/ui, landing hero, split-screen auth, sidebar dashboards | Implemented |
| Verifier queue, project review (start review / approve / reject / request more evidence), maintenance review + missed-deadline marking, audit log viewer | Implemented (Phase 3), SQL tested; not exercised against live Supabase |
| Solidity contracts (BlueCarbonRegistry) | Implemented, 19 tests; deployed to Sepolia (see docs/contracts.md) |
| NGO wallet link (signed message), verifier issuance via MetaMask with server-side receipt checks | Implemented (migration 0005); not yet exercised end to end in a browser |
| Marketplace contract (fixed-price listings, atomic ETH settlement), NGO listing/cancel, company purchase, holdings from on-chain balances, retirement with public certificate | Implemented (Phase 5, migration 0006, 26 contract tests); marketplace not yet deployed to Sepolia |
| Satellite/NDVI, model-assisted review | Planned (Phase 6) |

## Security model
- Authorization = Postgres RLS + `requireRole()` in server components. Hiding UI is not relied on.
- Self-signup can only produce `ngo` or `company`; the signup trigger clamps any other requested role. Admins are promoted by an operator via SQL.
- Project status: owners may only go draft/requires_more_evidence -> submitted; all other transitions need an admin (trigger `guard_project_status`).
- Evidence, purchases, retirements, transactions, audit logs: no client insert policy where server-side-only (service role, Phase 2+).
- `proxy.ts` refreshes the session and does an optimistic redirect only.

## Phase 2 notes
- Evidence flags are hints for verifiers (`missing_gps`, `outside_boundary`, `missing_capture_time`, `capture_time_implausible`, `captured_before_planting`, `exact_duplicate`, `similar_image`). Nothing is auto-approved or auto-rejected.
- Duplicate lookup crosses organizations via a security-definer function that returns counts only.
- Projects are locked for the owner once submitted; maintenance reports can only be moved to `submitted` by the owner. The 10-year schedule is created by `generate_maintenance_schedule()` (admin; wired into approval in Phase 3).
- Boundary entry is pasted GeoJSON (placeholder example prefilled); no map UI yet.
- Perceptual hash is a 64-bit dHash, Hamming distance <= 8 counts as similar. Heuristic only.

## Phase 3 notes
- Decisions run through security-definer SQL functions (`start_review`, `review_project`, `review_maintenance`, `mark_missed_maintenance`): decision row, status change, monitoring schedule (on approve) and audit entry commit atomically.
- Reviewers cannot review projects/reports of an organization they belong to (conflict-of-interest check). Rejected is final. A reason of 10+ characters is mandatory.
- `log_audit()` only accepts a fixed set of NGO action names from non-admins, so decision entries cannot be forged.
- Approval does not issue or quantify credits. `verification_reports` (geofence/satellite/model snapshots) is still unused; the review page computes check counts live from evidence flags.
- Boundary view is a schematic SVG (no basemap). Evidence files open through 5-minute signed URLs.

## On-chain issuance (Phase 4b)
- NGOs link a wallet by signing a message (`walletLinkMessage`); the server verifies the signature, then stores it on the organisation. The wallet locks once a project is registered on-chain.
- The verifier's own MetaMask signs `registerProject` and `issueBatch`. The verifier wallet must hold `VERIFIER_ROLE` on the contract; the app checks this before asking for a signature.
- The server never trusts the browser: `confirmRegistration` / `confirmIssuance` fetch the receipt via `SEPOLIA_RPC_URL`, require success and the registry address, and match the emitted event (project id, batch id, quantity in hundredths, recipient) to the prepared batch before updating `credit_batches.issued_qty`.
- On-chain project id = project UUID left-aligned in bytes32; batch id = the contract's `batchIdOf`. The derivation is unit-tested against the deployed contract.

## Marketplace and retirement (Phase 5)
- `BlueCarbonMarketplace` holds no credits: sellers approve it as operator; `buy` transfers from the seller and pays them in one transaction, so a listing can never sell more than the seller still holds (retired or moved credits make the purchase revert).
- Listings, purchases and retirements are written only by the server with `SUPABASE_SECRET_KEY`, after it matches the transaction's event (listing id, buyer/seller = the organisation's linked wallet, quantities). There are no client insert policies on these tables.
- Company holdings come from live `balanceOf` reads; retirement certificates (`/retirements/[id]`) are public and link to the transaction.
- Prices are Sepolia test ETH. Purchase terms state that buying doesn't transfer site-maintenance responsibility.

## Tests
- `cd apps/web && npm test` — boundary validation, point-in-polygon, Hamming distance.
- SQL: load `supabase/tests/stubs.sql`, then migrations 0001-0006, then `rls_smoke.sql`, `phase2_smoke.sql`, `phase3_smoke.sql`, `phase4_smoke.sql` and `phase5_smoke.sql` on a scratch Postgres.

## Limits to keep in mind
Blockchain records are auditable, not proof of physical restoration. A photo hash proves file consistency only. NDVI does not measure carbon. An ERC-20 is not automatically a legally recognized carbon credit.
