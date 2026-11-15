import { AuthApiError, postAuthJson, type PostAuthJsonOptions } from "./authApi";

/** Body of `POST /auth/login` (backend `LoginDto`). */
import { vi } from "@/lib/locale";
export type LoginCustomerPayload = {
  email: string;
  password: string;
  /** Fresh, single-use token from a Turnstile widget rendered with action `login`. */
  turnstileToken: string;
};

export type LoginCustomerResponse = {
  accessToken: string;
  message?: string;
};

type LoginCustomerResponseBody = {
  accessToken?: unknown;
  message?: unknown;
};

/** Kept for existing callers; every auth failure is an AuthApiError. */
export class LoginCustomerError extends AuthApiError {
  constructor(message: string) {
    super(message, { kind: "invalid-response" });
    this.name = "LoginCustomerError";
  }
}

export async function loginCustomer(payload: LoginCustomerPayload, options: PostAuthJsonOptions = {}): Promise<LoginCustomerResponse> {
  const { body: rawBody } = await postAuthJson(
    "login",
    { email: payload.email, password: payload.password, turnstileToken: payload.turnstileToken },
    { credentials: "include", ...options },
  );
export async function loginCustomer(payload: LoginCustomerPayload): Promise<LoginCustomerResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new LoginCustomerError(vi.auth.errors.loginApiMissing);
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = rawBody as LoginCustomerResponseBody | null;
  const body = await response.json().catch(() => null) as LoginCustomerResponseBody | null;

  if (!response.ok) {
    throw new LoginCustomerError(typeof body?.message === "string" ? body.message : vi.auth.errors.loginFailed);
  }

  if (!body || typeof body.accessToken !== "string" || !body.accessToken) {
    throw new LoginCustomerError(vi.auth.errors.accessTokenMissing);
  }

  return {
    accessToken: body.accessToken,
    message: typeof body.message === "string" ? body.message : undefined,
  };
}
