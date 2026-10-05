import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { todayUk } from "@/lib/dates";
import { cleanDeep } from "./clean";
import { AiError } from "./errors";
import {
  READ_ADVERT_SYSTEM,
  READ_ALERT_SYSTEM,
  SCORE_FIT_SYSTEM,
  jobBlock,
  profileBlock,
  readAdvertUser,
  readAlertUser,
} from "./prompts";
import { AdvertSchema, AlertSchema, FitSchema, normaliseAdvert, normaliseAlertJob, normaliseFit } from "./schemas";

// Server only: the API key never reaches the browser.
export const MODELS = {
  main: "claude-sonnet-5-5", // adverts, scoring, drafts, feedback
  quick: "claude-haiku-4-5-20251001", // alert email extraction
} as const;

// PRD cost limits on what is sent.
export const MAX_ADVERT_CHARS = 40_000;
export const MAX_EMAIL_CHARS = 40_000;

let client: Anthropic | undefined;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError("config");
  // Keys not scoped to a workspace must name one on every request.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  client ??= new Anthropic({
    maxRetries: 2,
    timeout: 90_000,
    defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined,
  });
  return client;
}

type ParsedReply<T> = { stop_reason: string | null; parsed_output: T | null };

function parsedOrThrow<T>(res: ParsedReply<T>): T {
  if (res.stop_reason === "refusal") throw new AiError("refused");
  if (res.stop_reason === "max_tokens" || res.parsed_output == null) throw new AiError("unreadable");
  return res.parsed_output;
}

// Turns SDK errors into AiErrors with a plain-English message.
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError("config");
    if (e instanceof Anthropic.RateLimitError) throw new AiError("rate_limited");
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiError("timeout");
    if (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503)) throw new AiError("overloaded");
    console.error("[ai] request failed", e);
    throw new AiError("unknown");
  }
}

// Reads a pasted advert: job fields plus essential and desirable criteria.
export async function readAdvert(advert: string) {
  const res = await call(() =>
    anthropic().beta.messages.parse({
      model: MODELS.main,
      max_tokens: 16_000,
      // Extraction needs little reasoning; low effort keeps it well under a minute.
      output_config: { effort: "low", format: betaZodOutputFormat(AdvertSchema) },
      // If a safety filter declines, the API retries on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: READ_ADVERT_SYSTEM,
      messages: [{ role: "user", content: readAdvertUser(advert.slice(0, MAX_ADVERT_CHARS), todayUk()) }],
    }),
  );
  return { advert: normaliseAdvert(cleanDeep(parsedOrThrow(res))), model: res.model };
}

export type ProfileForAi = Parameters<typeof profileBlock>[0];
export type JobForAi = Parameters<typeof jobBlock>[0];

// Scores the candidate against a job's person specification.
export async function scoreFit(profile: ProfileForAi, job: JobForAi) {
  const res = await call(() =>
    anthropic().beta.messages.parse({
      model: MODELS.main,
      max_tokens: 16_000,
      output_config: { effort: "medium", format: betaZodOutputFormat(FitSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SCORE_FIT_SYSTEM },
        // The profile repeats across every score, draft and feedback call, so it is cached.
        { type: "text", text: profileBlock(profile), cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: `Score my fit for this job.\n\n${jobBlock(job)}` }],
    }),
  );
  return { fit: normaliseFit(cleanDeep(parsedOrThrow(res))), model: res.model };
}

// Lists every job in a pasted alert email.
export async function readAlertEmail(email: string) {
  const res = await call(() =>
    anthropic().messages.parse({
      model: MODELS.quick,
      max_tokens: 16_000,
      output_config: { format: zodOutputFormat(AlertSchema) },
      system: READ_ALERT_SYSTEM,
      messages: [{ role: "user", content: readAlertUser(email.slice(0, MAX_EMAIL_CHARS), todayUk()) }],
    }),
  );
  return parsedOrThrow(res)
    .jobs.map((j) => normaliseAlertJob(cleanDeep(j)))
    .filter((j) => j.title);
}
