import { vi } from "@/lib/locale";
import type { AuthResponse } from "../types";
import { AuthRequestError, describeAuthError, readAccessToken, readAuthBody } from "./authError";
export type RegisterCustomerPayload = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
};

export class RegisterCustomerError extends AuthRequestError {
  constructor(message: string, status?: number, fieldErrors = {}) {
    super(message, status, fieldErrors);
    this.name = "RegisterCustomerError";
  }
}

export async function registerCustomer(payload: RegisterCustomerPayload, signal?: AbortSignal): Promise<AuthResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new RegisterCustomerError(vi.auth.errors.registerApiMissing);
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/register`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await readAuthBody(response);

  if (!response.ok) {
    const error = describeAuthError(body, response.status);
    throw new RegisterCustomerError(error.message, response.status, error.fieldErrors);
  }

  return { accessToken: readAccessToken(body) };
}
