"use server";

import exifr from "exifr";
import sharp from "sharp";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/(auth)/actions";
import { distanceM, parseBoundary, pointInPolygon } from "@/lib/evidence/geo";
import { flagLabel } from "@/lib/evidence/flags";
import { dHash, sha256 } from "@/lib/evidence/hash";
import { createClient } from "@/lib/supabase/server";
import { verifyMessage } from "ethers";
import { walletLinkMessage } from "@/lib/chain/link";
import { requireRole } from "@/lib/auth";

const MAX_BYTES = 25 * 1024 * 1024; // originals are kept untouched; no recompression
const MIN_LONG_EDGE = 1600; // below this a "photo" is usually a screenshot or a re-compressed copy
const GPS_MISMATCH_M = 250;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// ───────── organization ─────────
const orgSchema = z.object({
  name: z.string().trim().min(2),
  type: z.enum(["ngo", "panchayat"]),
  region: z.string().trim().min(2),
  contact_email: z.string().email(),
  contact_phone: z.preprocess(blank, z.string().trim().max(30).optional()),
});

export async function createOrganization(_: FormState, form: FormData): Promise<FormState> {
  const parsed = orgSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  const { data: org, error } = await supabase.from("organizations").insert({ ...parsed.data, created_by: user.id }).select("id").single();
  if (error) return { error: error.message };
  const { error: mErr } = await supabase.from("organization_members").insert({ organization_id: org.id, user_id: user.id });
  if (mErr) return { error: mErr.message };
  await supabase.rpc("log_audit", { p_action: "organization.create", p_entity: "organization", p_entity_id: org.id });
  redirect("/ngo");
}

// ───────── project ─────────
const projectSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(3),
  description: z.preprocess(blank, z.string().trim().max(4000).optional()),
  ecosystem: z.enum(["mangrove", "seagrass", "salt_marsh", "other"]),
  region: z.string().trim().min(2),
  species: z.preprocess(blank, z.string().trim().max(200).optional()),
  area_hectares: z.coerce.number().positive().max(1_000_000),
  planting_date: z.coerce.date(),
  stewardship_start: z.coerce.date(),
});
const day = (d: Date) => d.toISOString().slice(0, 10);

export async function createProject(_: FormState, form: FormData): Promise<FormState> {
  const parsed = projectSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const boundary = parseBoundary(String(form.get("boundary") ?? ""));
  if (!boundary.ok) return { error: boundary.error };
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  const p = parsed.data;
  const { data: id, error } = await supabase.rpc("create_project", {
    p_org: p.organization_id, p_name: p.name, p_description: p.description ?? null, p_ecosystem: p.ecosystem,
    p_region: p.region, p_species: p.species ?? null, p_area: p.area_hectares,
    p_planting: day(p.planting_date), p_stewardship_start: day(p.stewardship_start), p_boundary: boundary.polygon,
  });
  if (error) return { error: error.message };
  await supabase.rpc("log_audit", { p_action: "project.create", p_entity: "project", p_entity_id: id });
  redirect(`/ngo/projects/${id}`);
}

// ───────── evidence ─────────
export async function uploadEvidence(_: FormState, form: FormData): Promise<FormState> {
  const projectId = z.string().uuid().safeParse(form.get("project_id"));
  const file = form.get("file");
  if (!projectId.success) return { error: "Invalid project" };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
  if (file.size > MAX_BYTES) return { error: "File is larger than 25 MB. Upload the original photo, not a video or a burst." };

  // Browser geolocation at capture time (optional, client-supplied, so treated as a hint like EXIF).
  const device = z.object({
    device_lat: z.coerce.number().min(-90).max(90),
    device_lng: z.coerce.number().min(-180).max(180),
    device_accuracy_m: z.coerce.number().min(0).max(100_000),
  }).safeParse({ device_lat: blank(form.get("device_lat")), device_lng: blank(form.get("device_lng")), device_accuracy_m: blank(form.get("device_accuracy_m")) });
  const dev = device.success ? device.data : null;

  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  const { data: project } = await supabase.from("projects").select("id, planting_date").eq("id", projectId.data).single();
  if (!project) return { error: "Project not found" };
  const { data: bRow } = await supabase.from("project_boundaries").select("geojson").eq("project_id", project.id).single();
  const boundary = bRow ? parseBoundary(JSON.stringify(bRow.geojson)) : null;

  // Content sniffing: client-declared MIME is not trusted.
  const buf = Buffer.from(await file.arrayBuffer());
  const isPdf = buf.subarray(0, 5).toString() === "%PDF-";
  let kind: "photo" | "document" = "document";
  let mime = "application/pdf";
  let width: number | null = null, height: number | null = null;
  if (!isPdf) {
    try {
      const meta = await sharp(buf).metadata();
      mime = `image/${meta.format}`;
      width = meta.autoOrient?.width ?? meta.width ?? null;
      height = meta.autoOrient?.height ?? meta.height ?? null;
    } catch { return { error: "Unsupported file: upload a JPEG, PNG, WebP or PDF" }; }
    if (!IMAGE_TYPES.includes(mime)) return { error: "Unsupported image type: use JPEG, PNG or WebP" };
    kind = "photo";
  }

  const hash = sha256(buf);
  const flags: string[] = [];
  let lat: number | null = null, lng: number | null = null, capturedAt: Date | null = null;
  let exifSummary: Record<string, unknown> | null = null, phash: string | null = null;

  if (kind === "photo") {
    // exifr: `pick` suppresses GPS, so read GPS separately. Time is raw text: EXIF has no timezone, treat as UTC (day-level checks only).
    const [exif, gps] = await Promise.all([
      exifr.parse(buf, { pick: ["Make", "Model", "Software", "DateTimeOriginal"], reviveValues: false }).catch(() => null),
      exifr.gps(buf).catch(() => null),
    ]);
    phash = await dHash(buf);
    if (typeof gps?.latitude === "number" && typeof gps?.longitude === "number") { lat = gps.latitude; lng = gps.longitude; }
    const m = typeof exif?.DateTimeOriginal === "string" && /^(\d{4}):(\d\d):(\d\d)[ T](\d\d):(\d\d):(\d\d)/.exec(exif.DateTimeOriginal);
    if (m) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])); if (!isNaN(+d)) capturedAt = d; }
    exifSummary = exif ? { make: exif.Make, model: exif.Model, software: exif.Software } : null;

    if (lat === null) flags.push("missing_gps");
    if (lat === null && dev) flags.push("location_from_device");
    if (lat !== null && dev && distanceM(lat, lng!, dev.device_lat, dev.device_lng) > GPS_MISMATCH_M + dev.device_accuracy_m) flags.push("device_gps_mismatch");
    // Boundary check uses photo GPS, else the phone's location.
    const [checkLat, checkLng] = lat !== null ? [lat, lng!] : dev ? [dev.device_lat, dev.device_lng] : [null, null];
    if (checkLat !== null && boundary?.ok && !pointInPolygon(checkLng!, checkLat, boundary.polygon)) flags.push("outside_boundary");
    if (width && height && Math.max(width, height) < MIN_LONG_EDGE) flags.push("low_resolution");
    if (!capturedAt) flags.push("missing_capture_time");
    else if (+capturedAt > Date.now() + 864e5 || capturedAt.getUTCFullYear() < 2000) flags.push("capture_time_implausible");
    else if (project.planting_date && capturedAt < new Date(project.planting_date)) flags.push("captured_before_planting");

    const { data: dup } = await supabase.rpc("evidence_duplicate_counts", { p_project: project.id, p_sha256: hash, p_phash: phash });
    if (dup?.[0]?.exact_dupes > 0) flags.push("exact_duplicate");
    if (dup?.[0]?.similar > 0) flags.push("similar_image");
  }

  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `${project.id}/${hash.slice(0, 16)}-${safeName}`;
  const up = await supabase.storage.from("evidence").upload(path, buf, { contentType: mime, upsert: false });
  if (up.error) return { error: up.error.message.includes("exists") ? "This exact file is already uploaded for this project" : up.error.message };

  const { error } = await supabase.from("evidence_files").insert({
    project_id: project.id, uploaded_by: user.id, kind, storage_path: path, sha256: hash, perceptual_hash: phash,
    mime_type: mime, size_bytes: buf.length, exif: exifSummary, gps_lat: lat, gps_lng: lng,
    captured_at: capturedAt?.toISOString() ?? null, flags, width, height,
    device_lat: dev?.device_lat ?? null, device_lng: dev?.device_lng ?? null, device_accuracy_m: dev?.device_accuracy_m ?? null,
  });
  if (error) {
    await supabase.storage.from("evidence").remove([path]);
    return { error: error.message };
  }
  await supabase.rpc("log_audit", { p_action: "evidence.upload", p_entity: "project", p_entity_id: project.id, p_detail: { sha256: hash, flags } });
  revalidatePath(`/ngo/projects/${project.id}`);
  return { notice: flags.length ? `Saved at full quality. The verifier will see: ${flags.map(flagLabel).join("; ")}.` : "Saved at full quality. No automatic flags." };
}

// ───────── submit for review ─────────
export async function submitProject(_: FormState, form: FormData): Promise<FormState> {
  const id = z.string().uuid().safeParse(form.get("project_id"));
  if (!id.success) return { error: "Invalid project" };
  const { supabase } = await currentUser();
  const { count } = await supabase.from("evidence_files").select("id", { count: "exact", head: true }).eq("project_id", id.data).eq("kind", "photo");
  if (!count) return { error: "Upload at least one field photograph before submitting" };
  const { data, error } = await supabase.from("projects").update({ status: "submitted" }).eq("id", id.data).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Project not found or not submittable" };
  await supabase.rpc("log_audit", { p_action: "project.submit", p_entity: "project", p_entity_id: id.data });
  revalidatePath(`/ngo/projects/${id.data}`);
  return { notice: "Submitted for verification." };
}

// ───────── maintenance ─────────
export async function submitMaintenance(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ report_id: z.string().uuid(), project_id: z.string().uuid(), notes: z.string().trim().min(10, "Describe the site condition (10+ characters)").max(4000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase } = await currentUser();
  const { data, error } = await supabase.from("maintenance_reports").update({ notes: parsed.data.notes }).eq("id", parsed.data.report_id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Report not found" };
  await supabase.rpc("log_audit", { p_action: "maintenance.submit", p_entity: "maintenance_report", p_entity_id: parsed.data.report_id });
  revalidatePath(`/ngo/projects/${parsed.data.project_id}`);
  return { notice: "Maintenance report submitted." };
}

// ───────── wallet ─────────
// The NGO signs a message with MetaMask; the signature proves they control the address credits go to.
export async function linkWallet(input: { address: string; signature: string; issuedAt: string }): Promise<FormState> {
  const p = await requireRole("ngo");
  if (!p.org) return { error: "Set up your organisation first." };
  const v = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), signature: z.string().regex(/^0x[0-9a-fA-F]+$/), issuedAt: z.string().datetime() }).safeParse(input);
  if (!v.success) return { error: "Invalid wallet details." };
  const age = Date.now() - Date.parse(v.data.issuedAt);
  if (age < -60_000 || age > 10 * 60_000) return { error: "That signature has expired. Please try again." };
  let signer: string;
  try { signer = verifyMessage(walletLinkMessage(v.data.address, p.org.id, v.data.issuedAt), v.data.signature); }
  catch { return { error: "The signature couldn’t be verified." }; }
  if (signer.toLowerCase() !== v.data.address.toLowerCase()) return { error: "The signature doesn’t match that wallet." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({ wallet_address: signer }).eq("id", p.org.id).select("id");
  if (error) return { error: error.message.replace(/^.*?exception: /i, "") };
  if (!data?.length) return { error: "Organisation not found." };
  await supabase.rpc("log_audit", { p_action: "organization.link_wallet", p_entity: "organization", p_entity_id: p.org.id, p_detail: { address: signer } });
  revalidatePath("/ngo");
  return { notice: "Wallet linked. Credits for your approved projects will be issued to it." };
}
