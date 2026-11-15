/**
 * Cloudflare Turnstile constants shared by every protected auth form.
 * Mirrors the backend contract (pet-care-project `src/auth/bot-protection/turnstile.config.ts`).
 */
export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_SCRIPT_ID = "cf-turnstile-api";

/** Turnstile tokens are at most 2048 characters (backend rejects longer values). */
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/** One action per protected endpoint; the backend rejects a token whose action differs. */
export const TURNSTILE_ACTIONS = {
  login: "login",
  register: "register",
  forgotPassword: "forgot_password",
  resetPassword: "reset_password",
} as const;

export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];

/**
 * Public site key. `NEXT_PUBLIC_*` values are inlined at build time, so this must be
 * a direct property access (no dynamic lookup). The secret key never belongs here.
 */
export function getTurnstileSiteKey(): string | null {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return siteKey ? siteKey : null;
}

export function isUsableTurnstileToken(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= TURNSTILE_TOKEN_MAX_LENGTH;
}
