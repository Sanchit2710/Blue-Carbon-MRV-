import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Service-key client: bypasses RLS. Used ONLY after the server has confirmed a transaction on-chain
// (listings, purchases, retirements), so these tables can't be written directly from a browser.
export function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not configured on the server");
  return createClient(supabaseUrl!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
