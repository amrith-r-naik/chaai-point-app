import { createClient } from "@supabase/supabase-js";

// Use Expo public env vars; set in app config or .env
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase env not set: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_ANON_KEY || ""
);
