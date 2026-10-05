export type AiErrorCode =
  | "limit" // daily AI limit reached
  | "rate_limited"
  | "overloaded"
  | "timeout"
  | "refused"
  | "unreadable"
  | "config"
  | "unknown";

const MESSAGES: Record<AiErrorCode, string> = {
  limit: "You have used today's AI allowance. It resets at midnight UK time.",
  rate_limited: "Too many requests at once. Wait a minute and try again.",
  overloaded: "Claude is busy right now. Try again in a minute.",
  timeout: "Claude took too long to reply. Try again.",
  refused: "Claude could not process this text. Check it is a job advert or alert email and try again.",
  unreadable: "Claude's reply could not be read. Try again.",
  config: "AI features are not set up. The Anthropic API key is missing or invalid.",
  unknown: "Something went wrong talking to Claude. Try again.",
};

export class AiError extends Error {
  constructor(public code: AiErrorCode) {
    super(MESSAGES[code]);
    this.name = "AiError";
  }
}

export function aiErrorMessage(e: unknown): string {
  return e instanceof AiError ? e.message : MESSAGES.unknown;
}
