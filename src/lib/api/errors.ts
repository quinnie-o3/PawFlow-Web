export type ApiErrorKind = "http" | "network" | "config" | "invalid-response";

export class ApiError extends Error {
  constructor(readonly kind: ApiErrorKind, readonly status: number | null = null,
    readonly code: string | null = null, readonly serverMessage: string | null = null,
    readonly retryAfterSeconds: number | null = null) {
    super(kind);
    this.name = "ApiError";
  }
}

/** Cancellation is control flow, never a user-facing failure. */
export function isRequestCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
}

export function normalizeApiMessage(message: unknown): string | null {
  if (typeof message === "string") return message.trim() || null;
  if (Array.isArray(message)) {
    const parts = message.filter((item): item is string => typeof item === "string" && !!item.trim()).map(item => item.trim());
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

export const MAX_RETRY_AFTER_SECONDS = 15 * 60;
export function parseRetryAfterSeconds(header: string | null | undefined, bodyValue: unknown, now = Date.now()): number | null {
  const clamp = (value: number) => Number.isFinite(value) && value >= 0 ? Math.min(Math.max(Math.ceil(value), 1), MAX_RETRY_AFTER_SECONDS) : null;
  const raw = header?.trim();
  if (raw) {
    const date = /^[A-Za-z]/.test(raw) ? Date.parse(raw) : NaN;
    const value = /^\d+$/.test(raw) ? Number(raw) : !Number.isNaN(date) ? Math.max((date - now) / 1000, 1) : NaN;
    const seconds = clamp(value);
    if (seconds !== null) return seconds;
  }
  return typeof bodyValue === "number" ? clamp(bodyValue) : typeof bodyValue === "string" && /^\d+$/.test(bodyValue.trim()) ? clamp(Number(bodyValue)) : null;
}
