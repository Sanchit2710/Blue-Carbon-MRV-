# Connect a real Supabase project and test end to end

## 1. Create the project
supabase.com -> New project (free tier is fine). Save the database password somewhere private; the app does not need it.

## 2. Auth settings
Authentication -> Providers -> Email: turn **Confirm email** off for local testing (otherwise signup waits for a confirmation mail and free-tier mail is rate limited). Turn it back on before any real use.

## 3. Apply the schema (in order)
SQL Editor -> paste and run, one file at a time:
1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_phase2.sql` (creates the private `evidence` bucket + storage policies)
3. `supabase/migrations/0003_phase3.sql`

Or with the CLI: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`.
If 0002 errors on `storage.objects` policies, create a **private** bucket named `evidence` in Storage and add the two policies from the end of 0002 through the Storage -> Policies UI.

## 4. Environment
Project Settings -> API: copy **Project URL** and the **anon / publishable** key.
```bash
cd apps/web && cp .env.example .env.local   # fill the two values
npm install && npm run dev                   # http://localhost:3000
```
Never put the `service_role` key in `.env.local` or anywhere in this app; it bypasses RLS and is not used.

## 5. Create test users
Use three different emails (separate browser profiles or private windows keep sessions apart):
- NGO user: sign up as "NGO / Panchayat".
- Company user: sign up as "Company".
- Verifier: sign up (any role), then promote in the SQL editor:
```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'verifier@example.com');
```
The verifier must NOT belong to the NGO's organization (conflict-of-interest check).

## 6. Walkthrough checklist
1. NGO: register organization -> New project. Replace the placeholder boundary with a polygon around where your test photo was taken (GeoJSON, `[lng, lat]`, first point = last point).
2. NGO: upload (a) an original phone photo with location on, (b) a screenshot or re-exported image. Expect (a) no flags if inside the boundary, (b) `missing_gps`, `missing_capture_time`. Upload (a) again under a second project to see `exact_duplicate`.
3. NGO: Submit for verification. Project becomes locked.
4. Verifier: `/admin` -> open project -> check counts, map, evidence thumbnails -> Start review -> Request more evidence (with a reason).
5. NGO: sees the feedback, uploads more, resubmits.
6. Verifier: Approve. NGO project page now lists 10 annual maintenance milestones.
7. NGO: submit one maintenance report. Verifier: `/admin/maintenance` -> verify or flag it.
8. Overdue test: in SQL `update maintenance_reports set due_date = current_date - 3 where id = (select id from maintenance_reports where status='scheduled' limit 1);` then click "Mark overdue milestones as missed".
9. `/admin/audit` shows every step with actor and reason.
10. Optional: run `supabase/seed.sql` for a labelled demo project on the landing page (it is flagged `is_demo`).

## 7. Security spot checks
- Logged in as the company user, open `/admin` and `/ngo`: both redirect to `/company`.
- With only the anon key: `curl "$URL/rest/v1/evidence_files?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` returns `[]`.
- As NGO, try approving your own project through the REST API: it must fail (`status change ... not permitted`).

## Troubleshooting
- Upload says "new row violates row-level security policy": storage policies from 0002 are missing, or the bucket is not named `evidence`.
- Login loops back to `/login`: env values missing/incorrect; restart `npm run dev` after editing `.env.local`.
- "Check your email" after signup: Confirm email is still on.
