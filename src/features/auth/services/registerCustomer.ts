import { AuthApiError, postAuthJson, type PostAuthJsonOptions } from "./authApi";

/** Body of `POST /auth/register` (backend `RegisterDto`). */
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
}
