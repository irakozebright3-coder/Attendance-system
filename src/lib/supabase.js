import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only the public URL + anon/publishable key ever reach the browser.
// The service-role key must never be added to frontend environment variables.
export const db = url && key ? createClient(url, key) : null;
export const hasBackend = Boolean(db);
