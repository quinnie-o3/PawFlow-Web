import { vi } from "../../../lib/locale";

export type SubmitBlockReason = "in-flight" | "missing-token" | "cooling-down";

export class SubmitBlockedError extends Error {
  constructor(readonly reason: SubmitBlockReason) {
    super(`Submission blocked: ${reason}`);
    this.name = "SubmitBlockedError";
  }
}

/** Locale explanation for a blocked submission, or null when nothing needs to be shown. */
export function describeSubmitBlock(error: unknown): string | null {
  if (!(error instanceof SubmitBlockedError)) return null;
  switch (error.reason) {
    case "missing-token":
      return vi.auth.turnstile.blocked.missingToken;
    case "cooling-down":
      return vi.auth.turnstile.blocked.coolingDown;
    case "in-flight":
      return null;
  }
}

export type ProtectedSubmitterOptions = {
  /** Returns the current token and invalidates it (single use). Must be synchronous. */
  takeToken: () => string | null;
  /** Starts a new challenge. Called after every attempt, whatever the outcome. */
  resetChallenge: () => void;
  /** Optional extra gate, e.g. an active Retry-After cooldown. */
  isCoolingDown?: () => boolean;
};

export type ProtectedSubmitter = {
  readonly inFlight: boolean;
  submit: <T>(send: (turnstileToken: string) => Promise<T>) => Promise<T>;
};

/**
 * Enforces the Turnstile token lifecycle for one form:
 * one request at a time, a token is consumed before the request starts,
 * and the widget is reset once the request settles (success, HTTP error or network error).
 * Never retries on its own and never resends a consumed token.
 */
export function createProtectedSubmitter(options: ProtectedSubmitterOptions): ProtectedSubmitter {
  let inFlight = false;

  return {
    get inFlight() {
      return inFlight;
    },
    async submit<T>(send: (turnstileToken: string) => Promise<T>): Promise<T> {
      if (inFlight) throw new SubmitBlockedError("in-flight");
      if (options.isCoolingDown?.()) throw new SubmitBlockedError("cooling-down");

      const token = options.takeToken();
      if (!token) throw new SubmitBlockedError("missing-token");

      inFlight = true;
      try {
        return await send(token);
      } finally {
        inFlight = false;
        options.resetChallenge();
      }
    },
  };
}
