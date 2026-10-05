"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) {
    return { status: "error", message: "Enter a valid email address.", email };
  }

  const next = safeNext(String(formData.get("next") ?? ""));
  const origin = await siteOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  if (error) {
    const message =
      error.status === 429
        ? "Too many sign-in emails. Wait a minute and try again."
        : "We could not send the sign-in email. Try again.";
    return { status: "error", message, email };
  }
  return { status: "sent", email };
}

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
