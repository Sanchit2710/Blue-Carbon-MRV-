import type { SupabaseClient } from "@supabase/supabase-js";

// Short-lived links to private evidence: one to view, one that downloads the untouched original.
export async function signEvidence<T extends { storage_path: string }>(supabase: SupabaseClient, rows: T[]) {
  if (!rows.length) return rows.map((r) => ({ ...r, url: undefined as string | undefined, downloadUrl: undefined as string | undefined }));
  const paths = rows.map((r) => r.storage_path);
  const [view, dl] = await Promise.all([
    supabase.storage.from("evidence").createSignedUrls(paths, 600),
    supabase.storage.from("evidence").createSignedUrls(paths, 600, { download: true }),
  ]);
  const v = new Map((view.data ?? []).map((u) => [u.path, u.signedUrl] as const));
  const d = new Map((dl.data ?? []).map((u) => [u.path, u.signedUrl] as const));
  return rows.map((r) => ({ ...r, url: v.get(r.storage_path) ?? undefined, downloadUrl: d.get(r.storage_path) ?? undefined }));
}
