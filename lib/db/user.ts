import { redirect } from "next/navigation";
import { getClaims } from "@/lib/supabase/server";
import { withUser, type Tx } from "./index";

// Runs fn as the signed-in user with RLS applied. Sends signed-out visitors to /login.
export async function userDb<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  return withUser(claims, fn);
}
