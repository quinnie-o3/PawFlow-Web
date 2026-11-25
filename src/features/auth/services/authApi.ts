/**
 * Shared request + error normalisation for the public auth endpoints
 * (login, register, forgot-password, reset-password).
 *
 * These endpoints are never retried and never trigger a JWT refresh:
 * a 401 here means "wrong credentials", and a 403 TURNSTILE_* means
 * "solve the challenge again", neither of which a refresh token can fix.
 */

import { bffRequest } from "../../session/client";
import { formatMessage, vi } from "../../../lib/locale";
import { createApiClient } from "../../../lib/api/transport";
import { apiUrl } from "../../../lib/api/config";
import { ApiError, isRequestCancelled, MAX_RETRY_AFTER_SECONDS, normalizeApiMessage, parseRetryAfterSeconds } from "../../../lib/api/errors";
export { MAX_RETRY_AFTER_SECONDS, normalizeApiMessage, parseRetryAfterSeconds };

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
  signal?: AbortSignal;
};

export function resolveAuthUrl(base: string, path: string): string {
  return apiUrl(base, path);
}

/**
 * POSTs a JSON body to an auth endpoint (exactly once) and returns the parsed body.
 * Throws AuthApiError for configuration, network and HTTP failures.
 */
export async function postAuthJson(flow: AuthFlow, payload: object, options: PostAuthJsonOptions = {}): Promise<{ status: number; body: unknown }> {
  try {
    const response = await (options.apiUrl || options.fetchImpl || typeof window === "undefined" ? createApiClient({ apiUrl: options.apiUrl, fetchImpl: options.fetchImpl }).request : bffRequest)(AUTH_ENDPOINTS[flow], {
      method: "POST", body: payload, credentials: options.credentials, signal: options.signal,
    });
    return { status: response.status, body: response.body };
  } catch (error) {
    if (isRequestCancelled(error)) throw error;
    if (error instanceof ApiError) {
      const mapped = new AuthApiError(error.kind === "invalid-response" ? vi.auth.errors.server : "", {
        kind: error.kind, status: error.status, code: error.code, serverMessage: error.serverMessage,
        retryAfterSeconds: error.status === 429 || error.status === 503 ? error.retryAfterSeconds : null,
      });
      throw withDescription(mapped, flow);
    }
    throw error;
  }
}

function withDescription(error: AuthApiError, flow: AuthFlow): AuthApiError {
  error.message = describeAuthError(error, flow);
  return error;
}
