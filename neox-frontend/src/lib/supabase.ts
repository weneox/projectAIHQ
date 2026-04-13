// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

/**
 * ✅ ƏSAS FIX:
 * Supabase env yoxdursa app heç vaxt “ağ səhifə” olmasın.
 * createClient(url="") crash edir, ona görə yalnız env varsa yaradacağıq.
 */
export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

// DEV-də xəbərdarlıq
if (import.meta.env.DEV && !supabase) {
  console.warn("[SUPABASE DISABLED] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}
