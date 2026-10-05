import { sql } from "drizzle-orm";
import { adminDb } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";
import { AiError } from "./errors";

export function dailyAiLimit() {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 100;
}

// Counts one AI call for today (UK date). Throws AiError("limit") once the
// daily limit is reached. Runs as the server because users cannot write ai_usage.
export async function consumeAiCall(userId: string): Promise<number> {
  const limit = dailyAiLimit();
  const rows = await adminDb()
    .insert(aiUsage)
    .values({ userId, calls: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { calls: sql`${aiUsage.calls} + 1` },
      setWhere: sql`${aiUsage.calls} < ${limit}`,
    })
    .returning({ calls: aiUsage.calls });
  if (rows.length === 0) throw new AiError("limit");
  return rows[0].calls;
}
