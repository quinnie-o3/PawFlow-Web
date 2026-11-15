/**
 * Shared request + error normalisation for the public auth endpoints
 * (login, register, forgot-password, reset-password).
 *
 * These endpoints are never retried and never trigger a JWT refresh:
 * a 401 here means "wrong credentials", and a 403 TURNSTILE_* means
 * "solve the challenge again", neither of which a refresh token can fix.
 */

import { formatMessage, vi } from "../../../lib/locale";

export type AuthFlow = "login" | "register" | "forgotPassword" | "resetPassword";

export const AUTH_ENDPOINTS: Record<AuthFlow, string> = {
  login: "/auth/login",
  register: "/auth/register",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
};

export type AuthErrorCode =
  | "TURNSTILE_REQUIRED"
  | "TURNSTILE_INVALID"
  | "TURNSTILE_EXPIRED"
  | "TURNSTILE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "RATE_LIMIT_UNAVAILABLE";

const KNOWN_CODES: ReadonlySet<string> = new Set<AuthErrorCode>([
  "TURNSTILE_REQUIRED",
  "TURNSTILE_INVALID",
  "TURNSTILE_EXPIRED",
  "TURNSTILE_UNAVAILABLE",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
]);

export type AuthApiErrorKind = "http" | "network" | "config" | "invalid-response";

/** Upper bound for any server-provided wait, so a bad value can never block the form forever. */
export const MAX_RETRY_AFTER_SECONDS = 15 * 60;

export class AuthApiError extends Error {
  readonly kind: AuthApiErrorKind;
  readonly status: number | null;
  /** Stable backend `code`, when it is one this client understands. */
  readonly code: AuthErrorCode | null;
  /** Raw backend `code` (for diagnostics only). */
  readonly rawCode: string | null;
  readonly retryAfterSeconds: number | null;
  /** Backend `message`, normalised to a string (may be English; not shown for known codes). */
  readonly serverMessage: string | null;

  constructor(
    message: string,
    init: {
      kind: AuthApiErrorKind;
      status?: number | null;
      code?: string | null;
      retryAfterSeconds?: number | null;
      serverMessage?: string | null;
    },
  ) {
    super(message);
    this.name = "AuthApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.rawCode = init.code ?? null;
    this.code = init.code && KNOWN_CODES.has(init.code) ? (init.code as AuthErrorCode) : null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.serverMessage = init.serverMessage ?? null;
  }

  get isTurnstileError(): boolean {
    return this.code !== null && this.code.startsWith("TURNSTILE_");
  }
}

/** `message` may be a string or (for DTO validation) an array of strings. */
export function normalizeApiMessage(message: unknown): string | null {
  if (typeof message === "string") return message.trim() || null;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === "string" && m.trim() !== "").map((m) => m.trim());
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

function clampSeconds(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.max(Math.ceil(seconds), 1), MAX_RETRY_AFTER_SECONDS);
}

/**
 * Retry delay in whole seconds from the `Retry-After` header (delta-seconds or HTTP-date),
 * falling back to the body's `retryAfterSeconds`. Invalid values are ignored; results are
 * clamped to [1, MAX_RETRY_AFTER_SECONDS].
 */
export function parseRetryAfterSeconds(header: string | null | undefined, bodyValue: unknown, now: number = Date.now()): number | null {
  const raw = header?.trim();
  if (raw) {
    if (/^\d+$/.test(raw)) {
      const fromHeader = clampSeconds(Number(raw));
      if (fromHeader !== null) return fromHeader;
    } else {
      const date = Date.parse(raw);
      if (!Number.isNaN(date)) {
        return clampSeconds(Math.max((date - now) / 1000, 1));
      }
    }
  }
  if (typeof bodyValue === "number") return clampSeconds(bodyValue);
  if (typeof bodyValue === "string" && /^\d+$/.test(bodyValue.trim())) return clampSeconds(Number(bodyValue));
  return null;
}

const FLOW_FALLBACK: Record<AuthFlow, string> = {
  login: vi.auth.errors.loginFailed,
  register: vi.auth.errors.registerFailed,
  forgotPassword: vi.auth.errors.forgotPasswordFailed,
  resetPassword: vi.auth.errors.resetPasswordFailed,
};

const CONFIG_MESSAGE: Record<AuthFlow, string> = {
  login: vi.auth.errors.loginApiMissing,
  register: vi.auth.errors.registerApiMissing,
  forgotPassword: vi.auth.errors.forgotPasswordApiMissing,
  resetPassword: vi.auth.errors.resetPasswordApiMissing,
};

function waitText(seconds: number | null) {
  return seconds ? formatMessage(vi.auth.errors.waitSeconds, { seconds }) : vi.auth.errors.waitUnknown;
}

/** User-facing message from the locale. Branches on HTTP status and the stable `code`, never on English text. */
export function describeAuthError(error: AuthApiError, flow: AuthFlow): string {
  const errors = vi.auth.errors;
  switch (error.code) {
    case "TURNSTILE_REQUIRED":
      return errors.turnstileRequired;
    case "TURNSTILE_INVALID":
      return errors.turnstileInvalid;
    case "TURNSTILE_EXPIRED":
      return errors.turnstileExpired;
    case "TURNSTILE_UNAVAILABLE":
      return formatMessage(errors.turnstileUnavailable, { wait: waitText(error.retryAfterSeconds) });
    case "RATE_LIMITED":
      return formatMessage(errors.rateLimited, { wait: waitText(error.retryAfterSeconds) });
    case "RATE_LIMIT_UNAVAILABLE":
      return formatMessage(errors.rateLimitUnavailable, { wait: waitText(error.retryAfterSeconds) });
  }

  if (error.kind === "config") return CONFIG_MESSAGE[flow];
  if (error.kind === "network") return errors.network;
  if (error.kind === "invalid-response") return error.message;

  const status = error.status ?? 0;
  if (status === 400) {
    if (flow === "resetPassword") return errors.resetLinkInvalid;
    return error.serverMessage ? formatMessage(errors.validationWithDetail, { detail: error.serverMessage }) : errors.validation;
  }
  if (status === 401 && flow === "login") return errors.invalidCredentials;
  if (status === 409 && flow === "register") return errors.emailTaken;
  if (status === 403) return errors.forbidden;
  if (status === 429) return formatMessage(errors.rateLimited, { wait: waitText(error.retryAfterSeconds) });
  if (status >= 500) return errors.server;
  return FLOW_FALLBACK[flow];
}

export type AuthFetch = (input: string, init: RequestInit) => Promise<Response>;

export type PostAuthJsonOptions = {
  fetchImpl?: AuthFetch;
  apiUrl?: string | undefined;
  credentials?: RequestCredentials;
};

export function resolveAuthUrl(apiUrl: string, path: string): string {
  return `${apiUrl.replace(/\/+$/, "")}${path}`;
}

/**
 * POSTs a JSON body to an auth endpoint (exactly once) and returns the parsed body.
 * Throws AuthApiError for configuration, network and HTTP failures.
 */
export async function postAuthJson(flow: AuthFlow, payload: object, options: PostAuthJsonOptions = {}): Promise<{ status: number; body: unknown }> {
  const apiUrl = options.apiUrl ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new AuthApiError(CONFIG_MESSAGE[flow], { kind: "config" });
  }

  const fetchImpl = options.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init));

  let response: Response;
  try {
    response = await fetchImpl(resolveAuthUrl(apiUrl, AUTH_ENDPOINTS[flow]), {
      method: "POST",
      credentials: options.credentials,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    const error = new AuthApiError("", { kind: "network" });
    throw withDescription(error, flow);
  }

  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const error = new AuthApiError("", {
      kind: "http",
      status: response.status,
      code: typeof record.code === "string" ? record.code : null,
      serverMessage: normalizeApiMessage(record.message),
      retryAfterSeconds:
        response.status === 429 || response.status === 503
          ? parseRetryAfterSeconds(response.headers.get("Retry-After"), record.retryAfterSeconds)
          : null,
    });
    throw withDescription(error, flow);
  }

  return { status: response.status, body };
}

function withDescription(error: AuthApiError, flow: AuthFlow): AuthApiError {
  error.message = describeAuthError(error, flow);
  return error;
}
