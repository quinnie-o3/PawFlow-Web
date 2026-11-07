import { vi } from "@/lib/locale";
import { AuthRequestError, describeAuthError, readAccessToken, readAuthBody } from "./authError";
export type LoginCustomerPayload = {
  email: string;
  password: string;
};

export type LoginCustomerResponse = {
  accessToken: string;
  message?: string;
};

export class LoginCustomerError extends AuthRequestError {
  constructor(message: string, status?: number, fieldErrors = {}) {
    super(message, status, fieldErrors);
    this.name = "LoginCustomerError";
  }
}

export async function loginCustomer(payload: LoginCustomerPayload, signal?: AbortSignal): Promise<LoginCustomerResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new LoginCustomerError(vi.auth.errors.loginApiMissing);
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    credentials: "include",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await readAuthBody(response);

  if (!response.ok) {
    const error = describeAuthError(body, response.status);
    throw new LoginCustomerError(error.message, response.status, error.fieldErrors);
  }

  const accessToken = readAccessToken(body);
  if (!accessToken) {
    throw new LoginCustomerError(vi.auth.errors.accessTokenMissing);
  }

  return {
    accessToken,
  };
}
