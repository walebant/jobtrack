import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for server components, server actions and route handlers.
// Uses the signed-in user's session cookies, so Supabase RLS applies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a server component, which cannot set cookies.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

// The verified JWT claims of the signed-in user, or null when signed out.
export async function getClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims;
}
