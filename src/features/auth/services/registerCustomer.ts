import { AuthApiError, postAuthJson, type PostAuthJsonOptions } from "./authApi";

/** Body of `POST /auth/register` (backend `RegisterDto`). */
import { vi } from "@/lib/locale";
export type RegisterCustomerPayload = {
  fullName: string;
  email: string;
  /** Optional in the backend; blank values are omitted from the request. */
  phone?: string;
  password: string;
  /** Fresh, single-use token from a Turnstile widget rendered with action `register`. */
  turnstileToken: string;
};

type RegisterCustomerResponse = {
  message?: string;
};

/** Kept for existing callers; every auth failure is an AuthApiError. */
export class RegisterCustomerError extends AuthApiError {
  constructor(message: string) {
    super(message, { kind: "invalid-response" });
    this.name = "RegisterCustomerError";
  }
}

export function buildRegisterRequestBody(payload: RegisterCustomerPayload) {
  const phone = payload.phone?.trim();
  return {
    fullName: payload.fullName,
    email: payload.email,
    ...(phone ? { phone } : {}),
    password: payload.password,
    turnstileToken: payload.turnstileToken,
  };
}

export async function registerCustomer(payload: RegisterCustomerPayload, options: PostAuthJsonOptions = {}): Promise<RegisterCustomerResponse> {
  const { body } = await postAuthJson("register", buildRegisterRequestBody(payload), options);
  const record = body && typeof body === "object" ? (body as { message?: unknown }) : {};
  return typeof record.message === "string" ? { message: record.message } : {};
export async function registerCustomer(payload: RegisterCustomerPayload): Promise<RegisterCustomerResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new RegisterCustomerError(vi.auth.errors.registerApiMissing);
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null) as RegisterCustomerResponse | { message?: string } | null;

  if (!response.ok) {
    throw new RegisterCustomerError(body?.message ?? vi.auth.errors.registerFailed);
  }

  return body ?? {};
}
