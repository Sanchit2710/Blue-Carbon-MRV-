export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase's dashboard now names this key "publishable"; the older name is "anon". Accept both.
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);
