// Fills BlueCarbon with clearly labelled DEMONSTRATION data so the whole flow can be shown:
// NGOs and their projects at every stage, evidence, verifier decisions, monitoring, credits,
// listings, simulated purchases and a retirement. Every row is flagged is_demo; demo trades have no
// transaction hash and the UI labels them "simulated, not on-chain".
//
//   cd apps/web
//   node --env-file=.env.local scripts/seed-demo.ts           # create (skips if already seeded)
//   node --env-file=.env.local scripts/seed-demo.ts --reset   # remove all demo data and demo accounts
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. Demo account passwords are written to
// .demo-accounts.local.json (git-ignored), never printed, and reused on every later run (or set DEMO_PASSWORD).
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { dHash, sha256 } from "../src/lib/evidence/hash.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const DOMAIN = "bluecarbon.test"; // reserved TLD: these addresses can never receive mail
const unsplash = (id: string, w = 1800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=85`;
const PHOTOS = {
  forest: "1589556183130-530470785fab", lone: "1764101919176-467e40fd27d5", creek: "1618288389681-f135edea12db",
  roots: "1784751449882-c2c28ca2dd78", underwater: "1717292741426-d050f4f25503", shore: "1779399642977-7c6bfd7bc472",
};

const accounts = {
  verifier: { email: `demo-verifier@${DOMAIN}`, name: "Asha Verma (Demo verifier)", role: "ngo" as const, admin: true },
  ngo1: { email: `demo-sundarbans@${DOMAIN}`, name: "Rahul Mondal (Demo)", role: "ngo" as const },
  ngo2: { email: `demo-coromandel@${DOMAIN}`, name: "Kavitha Raman (Demo)", role: "ngo" as const },
  co1: { email: `demo-konkan@${DOMAIN}`, name: "Neha Kulkarni (Demo)", role: "company" as const },
  co2: { email: `demo-deccan@${DOMAIN}`, name: "Arjun Reddy (Demo)", role: "company" as const },
};

// Throws on any Supabase error. Inserts without .select() return no data, so callers ignore the value.
const must = <T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
};
const square = (lat: number, lng: number, d: number) => ({ type: "Polygon", coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]] });
const addYears = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + n); return d.toISOString().slice(0, 10); };

async function demoUserIds() {
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    ids.push(...data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`)).map((u) => u.id));
    if (data.users.length < 200) return ids;
  }
}

async function reset() {
  const { data: projects } = await db.from("projects").select("id").eq("is_demo", true);
  const pids = (projects ?? []).map((p) => p.id);
  const { data: batches } = await db.from("credit_batches").select("id").eq("is_demo", true);
  const bids = (batches ?? []).map((b) => b.id);
  const { data: listings } = bids.length ? await db.from("marketplace_listings").select("id").in("batch_id", bids) : { data: [] };
  const lids = (listings ?? []).map((l) => l.id);
  const { data: evidence } = pids.length ? await db.from("evidence_files").select("storage_path").in("project_id", pids) : { data: [] };
  if (evidence?.length) await db.storage.from("evidence").remove(evidence.map((e) => e.storage_path));
  if (bids.length) await db.from("credit_retirements").delete().in("batch_id", bids);
  if (lids.length) await db.from("purchases").delete().in("listing_id", lids);
  if (bids.length) { await db.from("marketplace_listings").delete().in("batch_id", bids); await db.from("credit_batches").delete().in("id", bids); }
  if (pids.length) {
    for (const t of ["maintenance_reports", "verification_decisions", "verification_reports", "evidence_files", "project_boundaries", "blockchain_transactions"]) await db.from(t).delete().in("project_id", pids);
    await db.from("audit_logs").delete().in("entity_id", pids);
    await db.from("projects").delete().in("id", pids);
  }
  const { data: orgs } = await db.from("organizations").select("id").eq("is_demo", true);
  const oids = (orgs ?? []).map((o) => o.id);
  if (oids.length) { await db.from("audit_logs").delete().in("entity_id", oids); await db.from("organization_members").delete().in("organization_id", oids); await db.from("organizations").delete().in("id", oids); }
  const users = await demoUserIds();
  if (users.length) await db.from("audit_logs").delete().in("actor_id", users);
  for (const id of users) await db.auth.admin.deleteUser(id);
  console.log(`Removed demo data: ${pids.length} projects, ${bids.length} credit batches, ${oids.length} organisations, ${users.length} demo accounts.`);
}

async function seed() {
  const { count } = await db.from("projects").select("id", { count: "exact", head: true }).eq("is_demo", true);
  if (count) { console.log("Demo data already exists. Run with --reset first to recreate it."); return; }

  // ── accounts ──
  // Same password every run: DEMO_PASSWORD if set, else the one already saved, else a new random one.
  const saved = existsSync(".demo-accounts.local.json") ? (JSON.parse(readFileSync(".demo-accounts.local.json", "utf8")).password as string | undefined) : undefined;
  const password = process.env.DEMO_PASSWORD || saved || `Demo-${randomBytes(6).toString("hex")}`;
  const ids: Record<keyof typeof accounts, string> = {} as never;
  for (const [k, a] of Object.entries(accounts) as [keyof typeof accounts, (typeof accounts)[keyof typeof accounts]][]) {
    const { data, error } = await db.auth.admin.createUser({ email: a.email, password, email_confirm: true, user_metadata: { full_name: a.name, role: a.role } });
    if (error) throw new Error(`create ${a.email}: ${error.message}`);
    ids[k] = data.user.id;
    if ("admin" in a) must(await db.from("profiles").update({ role: "admin" }).eq("id", data.user.id), "promote verifier");
  }
  writeFileSync(".demo-accounts.local.json", JSON.stringify({ note: "DEMO accounts for local demonstrations only.", password, accounts: Object.fromEntries(Object.entries(accounts).map(([k, a]) => [k, { email: a.email, role: "admin" in a ? "verifier (admin)" : a.role }])) }, null, 2));

  // ── organisations (fictional, marked Demo). No wallet: link a real MetaMask test account for a live demo. ──
  const org = async (name: string, type: string, region: string, email: string, owner: string) => {
    const o = must(await db.from("organizations").insert({ name, type, region, contact_email: email, created_by: owner, is_demo: true }).select("id").single(), `org ${name}`);
    must(await db.from("organization_members").insert({ organization_id: o.id, user_id: owner }), "member");
    return o as { id: string };
  };
  const sundarbans = await org("Sundarbans Tidal Restoration Collective (Demo)", "ngo", "West Bengal", accounts.ngo1.email, ids.ngo1);
  const coromandel = await org("Coromandel Coast Panchayat Network (Demo)", "panchayat", "Tamil Nadu", accounts.ngo2.email, ids.ngo2);
  const konkan = await org("Konkan Cement Ltd (Demo)", "company", "Maharashtra", accounts.co1.email, ids.co1);
  const deccan = await org("Deccan Freight Logistics (Demo)", "company", "Telangana", accounts.co2.email, ids.co2);

  // ── projects at every stage ──
  type P = { org: string; owner: string; name: string; desc: string; eco: string; region: string; species: string; ha: number; planted: string; start: string; status: string; lat: number; lng: number; cover: string };
  const defs: Record<string, P> = {
    sundarbans: { org: sundarbans.id, owner: ids.ngo1, name: "Sundarbans tidal mangrove restoration", desc: "Replanting 120 ha of eroded mudflat along the Matla river with locally raised Rhizophora and Avicennia saplings, managed by six village committees.", eco: "mangrove", region: "South 24 Parganas, West Bengal", species: "Rhizophora mucronata, Avicennia marina", ha: 120, planted: "2024-07-01", start: "2024-07-01", status: "approved", lat: 21.95, lng: 88.85, cover: PHOTOS.forest },
    pichavaram: { org: coromandel.id, owner: ids.ngo2, name: "Pichavaram creek mangrove replanting", desc: "Fishbone-canal replanting that restores tidal flow to 45 ha of degraded creek bank near Pichavaram.", eco: "mangrove", region: "Cuddalore, Tamil Nadu", species: "Avicennia marina, Rhizophora apiculata", ha: 45, planted: "2024-10-01", start: "2024-10-01", status: "approved", lat: 11.43, lng: 79.79, cover: PHOTOS.creek },
    mannar: { org: coromandel.id, owner: ids.ngo2, name: "Gulf of Mannar seagrass meadow recovery", desc: "Transplanting Cymodocea and Halodule sprigs into 60 ha of shallow meadow damaged by trawling.", eco: "seagrass", region: "Ramanathapuram, Tamil Nadu", species: "Cymodocea serrulata, Halodule uninervis", ha: 60, planted: "2025-11-15", start: "2025-12-01", status: "under_review", lat: 9.2, lng: 79.15, cover: PHOTOS.underwater },
    chilika: { org: sundarbans.id, owner: ids.ngo1, name: "Chilika lagoon salt marsh pilot", desc: "A 25 ha pilot reconnecting salt marsh to the lagoon's tidal channels.", eco: "salt_marsh", region: "Puri, Odisha", species: "Porteresia coarctata", ha: 25, planted: "2026-01-20", start: "2026-02-01", status: "requires_more_evidence", lat: 19.72, lng: 85.32, cover: PHOTOS.shore },
    bhitarkanika: { org: sundarbans.id, owner: ids.ngo1, name: "Bhitarkanika buffer planting", desc: "Draft: buffer planting along the Brahmani estuary, boundary still being surveyed.", eco: "mangrove", region: "Kendrapara, Odisha", species: "Sonneratia apetala", ha: 30, planted: "2026-08-01", start: "2026-09-01", status: "draft", lat: 20.7, lng: 86.9, cover: PHOTOS.roots },
  };
  const pid: Record<string, string> = {};
  for (const [k, p] of Object.entries(defs)) {
    const row = must(await db.from("projects").insert({
      organization_id: p.org, name: p.name, description: p.desc, ecosystem: p.eco, region: p.region, species: p.species, area_hectares: p.ha,
      planting_date: p.planted, status: p.status, is_demo: true, stewardship_start: p.start, stewardship_end: addYears(p.start, 10),
      cover_url: unsplash(p.cover, 2000), created_at: `${p.planted}T09:00:00Z`,
    }).select("id").single(), `project ${p.name}`);
    pid[k] = row.id;
    must(await db.from("project_boundaries").insert({ project_id: row.id, geojson: square(p.lat, p.lng, 0.005) }), "boundary");
  }

  // ── evidence: real photos (Unsplash licence), stored privately like any upload ──
  const evidence = async (project: string, photo: string, lat: number | null, lng: number | null, taken: string, flags: string[], uploader: string) => {
    const res = await fetch(unsplash(photo, 1800));
    if (!res.ok) throw new Error(`download ${photo}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = sha256(buf);
    const { width, height } = await sharp(buf).metadata();
    const path = `${project}/${hash.slice(0, 16)}-demo-${photo}.jpg`;
    must(await db.storage.from("evidence").upload(path, buf, { contentType: "image/jpeg", upsert: true }), "upload");
    must(await db.from("evidence_files").insert({
      project_id: project, uploaded_by: uploader, kind: "photo", storage_path: path, sha256: hash, perceptual_hash: await dHash(buf),
      mime_type: "image/jpeg", size_bytes: buf.length, width, height, gps_lat: lat, gps_lng: lng,
      captured_at: `${taken}T07:30:00Z`, flags, exif: { make: "Demo", model: "Demo field camera" }, is_demo: true, created_at: `${taken}T12:00:00Z`,
    }), "evidence row");
  };
  await evidence(pid.sundarbans, PHOTOS.forest, 21.951, 88.851, "2024-08-12", [], ids.ngo1);
  await evidence(pid.sundarbans, PHOTOS.roots, 21.948, 88.847, "2024-10-03", [], ids.ngo1);
  await evidence(pid.sundarbans, PHOTOS.lone, null, null, "2024-10-03", ["missing_gps"], ids.ngo1);
  await evidence(pid.pichavaram, PHOTOS.creek, 11.431, 79.792, "2024-12-18", [], ids.ngo2);
  await evidence(pid.pichavaram, PHOTOS.shore, 11.428, 79.788, "2025-02-07", [], ids.ngo2);
  await evidence(pid.mannar, PHOTOS.underwater, 9.21, 79.16, "2026-01-10", [], ids.ngo2);
  await evidence(pid.mannar, PHOTOS.shore, 9.31, 79.25, "2026-01-10", ["outside_boundary"], ids.ngo2);
  await evidence(pid.chilika, PHOTOS.shore, null, null, "2025-12-02", ["missing_gps", "captured_before_planting"], ids.ngo1);

  // ── verifier decisions ──
  const decide = async (project: string, decision: string, reason: string, at: string) =>
    must(await db.from("verification_decisions").insert({ project_id: project, reviewer_id: ids.verifier, decision, reason, created_at: `${at}T10:00:00Z` }).select("id").single(), "decision");
  await decide(pid.sundarbans, "request_more_evidence", "Two photos lack location data. Please add geotagged photos from the northern plots.", "2024-09-20");
  const a1 = await decide(pid.sundarbans, "approve", "Geotagged evidence covers both plot clusters and matches the boundary; survival counts are consistent with the planting plan.", "2024-11-04");
  const a2 = await decide(pid.pichavaram, "approve", "Canal works and replanting are visible in dated, geotagged photos inside the boundary.", "2025-03-11");
  await decide(pid.chilika, "request_more_evidence", "The only photo has no location and predates planting. Please submit dated, geotagged photos of the planted plots.", "2026-03-02");

  // ── ten-year monitoring for approved projects ──
  const schedule = async (project: string, start: string, states: [string, string?, string?][]) => {
    const rows = Array.from({ length: 10 }, (_, i) => {
      const [status, notes, review] = states[i] ?? ["scheduled"];
      return { project_id: project, due_date: addYears(start, i + 1), status, notes: notes ?? null, review_notes: review ?? null,
        submitted_by: notes ? defs[Object.keys(pid).find((k) => pid[k] === project)!].owner : null, submitted_at: notes ? `${addYears(start, i + 1)}T08:00:00Z` : null,
        reviewed_by: review ? ids.verifier : null };
    });
    must(await db.from("maintenance_reports").insert(rows), "maintenance");
  };
  await schedule(pid.sundarbans, "2024-07-01", [["verified", "82% sapling survival across 6 plots; 3 ha replanted after the May cyclone.", "Survival rate supported by plot photos."], ["submitted", "Survival steady at 79%; two plots fenced against cattle grazing."]]);
  await schedule(pid.pichavaram, "2024-10-01", [["verified", "Canal flow restored; 88% survival.", "Consistent with drone survey."], ["missed"]]);

  // ── credits (issued off-chain for the demo; no transaction) ──
  const batch = async (project: string, start: string, end: string, qty: number, ref: string, retired: number) =>
    must(await db.from("credit_batches").insert({ project_id: project, methodology: "VM0033 v2.1, tidal wetland and seagrass restoration (demo)", verification_ref: ref,
      period_start: start, period_end: end, proposed_qty: qty, approved_qty: qty, issued_qty: qty, retired_qty: retired, is_demo: true }).select("id").single(), "batch").id as string;
  const b1 = await batch(pid.sundarbans, "2024-07-01", "2025-06-30", 1200, `BlueCarbon approval ${a1.id.slice(0, 8)} (2024-11-04)`, 100);
  const b2 = await batch(pid.pichavaram, "2024-10-01", "2025-09-30", 400, `BlueCarbon approval ${a2.id.slice(0, 8)} (2025-03-11)`, 50);

  // ── listings, simulated purchases, retirements ──
  const listing = async (b: string, seller: string, qty: number, price: number) =>
    must(await db.from("marketplace_listings").insert({ batch_id: b, seller_org_id: seller, quantity_available: qty, price_per_credit: price, currency: "SepoliaETH", is_demo: true, active: qty > 0 }).select("id").single(), "listing").id as string;
  const l1 = await listing(b1, sundarbans.id, 350, 0.0012); // 800 listed, 450 sold
  const l2 = await listing(b2, coromandel.id, 280, 0.0015); // 400 listed, 120 sold
  must(await db.from("purchases").insert([
    { listing_id: l1, buyer_org_id: konkan.id, quantity: 300, total_price: 0.36, status: "confirmed", is_demo: true, created_at: "2025-08-14T11:00:00Z" },
    { listing_id: l1, buyer_org_id: deccan.id, quantity: 150, total_price: 0.18, status: "confirmed", is_demo: true, created_at: "2025-09-02T11:00:00Z" },
    { listing_id: l2, buyer_org_id: deccan.id, quantity: 120, total_price: 0.18, status: "confirmed", is_demo: true, created_at: "2025-11-20T11:00:00Z" },
  ]), "purchases");
  must(await db.from("credit_retirements").insert([
    { batch_id: b1, org_id: konkan.id, quantity: 100, beneficiary: "Konkan Cement Ltd (Demo)", reason: "FY2025 Scope 1 offset claim (demo)", is_demo: true, created_at: "2026-04-30T09:00:00Z" },
    { batch_id: b2, org_id: deccan.id, quantity: 50, beneficiary: "Deccan Freight Logistics (Demo)", reason: "FY2025 fleet emissions claim (demo)", is_demo: true, created_at: "2026-05-15T09:00:00Z" },
  ]), "retirements");

  // ── audit trail ──
  must(await db.from("audit_logs").insert([
    { actor_id: ids.ngo1, action: "project.submit", entity: "project", entity_id: pid.sundarbans, detail: { demo: true }, created_at: "2024-08-15T10:00:00Z" },
    { actor_id: ids.verifier, action: "project.request_more_evidence", entity: "project", entity_id: pid.sundarbans, detail: { demo: true }, created_at: "2024-09-20T10:00:00Z" },
    { actor_id: ids.verifier, action: "project.approve", entity: "project", entity_id: pid.sundarbans, detail: { demo: true }, created_at: "2024-11-04T10:00:00Z" },
    { actor_id: ids.verifier, action: "project.approve", entity: "project", entity_id: pid.pichavaram, detail: { demo: true }, created_at: "2025-03-11T10:00:00Z" },
    { actor_id: ids.verifier, action: "project.start_review", entity: "project", entity_id: pid.mannar, detail: { demo: true }, created_at: "2026-01-12T10:00:00Z" },
    { actor_id: ids.verifier, action: "project.request_more_evidence", entity: "project", entity_id: pid.chilika, detail: { demo: true }, created_at: "2026-03-02T10:00:00Z" },
  ]), "audit");

  console.log("Demo data created: 5 projects, 2 NGOs, 2 companies, 1 verifier, 8 evidence photos, 2 credit batches, 3 purchases, 2 retirements.");
  console.log("Demo account emails and the shared password are in apps/web/.demo-accounts.local.json (git-ignored).");
}

await (process.argv.includes("--reset") ? reset() : seed());
