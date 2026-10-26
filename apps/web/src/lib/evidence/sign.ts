import type { SupabaseClient } from "@supabase/supabase-js";

// Short-lived links to private evidence: one to view, one that downloads the untouched original.
export async function signEvidence<T extends { storage_path: string }>(supabase: SupabaseClient, rows: T[]) {
  if (!rows.length) return rows.map((r) => ({ ...r, url: undefined as string | undefined, downloadUrl: undefined as string | undefined }));
  const paths = rows.map((r) => r.storage_path);
  // One request; Storage serves the same signed URL as an attachment when `download` is added.
  const { data } = await supabase.storage.from("evidence").createSignedUrls(paths, 600);
  const v = new Map((data ?? []).map((u) => [u.path, u.signedUrl] as const));
  return rows.map((r) => {
    const url = v.get(r.storage_path) ?? undefined;
    return { ...r, url, downloadUrl: url ? `${url}&download=` : undefined };
  });
}
