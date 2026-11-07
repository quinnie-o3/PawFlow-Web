import { vi } from "../../../lib/locale";
import type { AuthField, AuthFieldErrors } from "../types";

export class AuthRequestError extends Error {
  constructor(message: string, readonly status?: number, readonly fieldErrors: AuthFieldErrors = {}) {
    super(message);
    this.name = "AuthRequestError";
  }
}

export function describeAuthError(body: unknown, status: number) {
  const message = body && typeof body === "object" && "message" in body ? body.message : undefined;
  const messages = typeof message === "string" ? [message] : Array.isArray(message) ? message.filter((x): x is string => typeof x === "string") : [];
  const fields: AuthFieldErrors = {};
  if (status === 400) {
    for (const field of ["fullName", "email", "phone", "password"] as AuthField[]) {
      const matching = messages.filter((text) => text.startsWith(`${field} `));
      if (matching.length) fields[field] = matching.join("\n");
    }
  }
  // Only these exact messages exist in the current backend. Do not infer an account state from 401/403.
  let text: string;
  if (status === 401 && messages.includes("Invalid email or password")) text = vi.auth.feedback.invalidCredentials;
  else if (status === 401 && messages.includes("Account is not active")) text = vi.auth.feedback.accountNotActive;
  else if (status === 409 && messages.includes("Email is already registered")) {
    text = vi.auth.feedback.emailConflict;
    fields.email = text;
  } else if (status === 429) text = vi.auth.feedback.tooManyRequests;
  else if (status >= 500) text = vi.auth.feedback.serverError;
  else text = messages.join("\n") || (status === 403 ? vi.auth.feedback.forbidden : vi.auth.feedback.requestFailed);
  return { message: text, fieldErrors: fields };
}

export async function readAuthBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function readAccessToken(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("accessToken" in body)) return;
  return typeof body.accessToken === "string" && body.accessToken.trim() ? body.accessToken : undefined;
}
