import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createAdminDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  // prepare: false is required by Supabase's transaction pooler.
  const client = postgres(url, { prepare: false, max: 5 });
  return drizzle({ client, schema });
}

type AdminDb = ReturnType<typeof createAdminDb>;
export type Tx = Parameters<Parameters<AdminDb["transaction"]>[0]>[0];

// One connection pool per server process, reused across hot reloads in dev.
const g = globalThis as unknown as { __jobtrackDb?: AdminDb };

// Connects as the database owner and BYPASSES row level security.
// Only for migrations, tests and Phase 2 background jobs.
// Request code must use withUser (or userDb in lib/db/user.ts).
export function adminDb(): AdminDb {
  g.__jobtrackDb ??= createAdminDb();
  return g.__jobtrackDb;
}

export type JwtClaims = { sub: string; role?: string; [key: string]: unknown };

// Runs fn in a transaction as the given user, with the "authenticated" role and
// their JWT claims set, so every query is filtered by the RLS policies.
export function withUser<T>(claims: JwtClaims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return adminDb().transaction(async (tx) => {
    await tx.execute(sql`
      select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
             set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}
