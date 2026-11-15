import { AuthApiError, postAuthJson, type PostAuthJsonOptions } from "./authApi";

/** Body of `POST /auth/login` (backend `LoginDto`). */
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

  const body = rawBody as LoginCustomerResponseBody | null;

  if (!body || typeof body.accessToken !== "string" || !body.accessToken) {
    throw new LoginCustomerError("API đăng nhập không trả về accessToken.");
  }

  return {
    accessToken: body.accessToken,
    message: typeof body.message === "string" ? body.message : undefined,
  };
}
