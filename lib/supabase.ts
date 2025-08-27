import { createClient } from "@supabase/supabase-js";

// Use Expo public env vars; set in app config or EAS env/secrets
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""
).trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase env not set: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Export a real client when configured, otherwise a lazy stub that throws on use
function createStub() {
  const thrower = () => {
    throw new Error(
      "Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  };
  const chain = () => ({
    select: thrower,
    upsert: thrower,
    eq: thrower,
    in: thrower,
    or: thrower,
    order: thrower,
    limit: thrower,
    gte: thrower,
    maybeSingle: thrower,
  });
  return {
    from: chain,
    storage: {
      from: () => ({ upload: thrower, list: thrower }),
    },
    auth: {
      signInWithPassword: thrower,
      signOut: thrower,
      getSession: thrower,
    },
  } as any;
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createStub();
