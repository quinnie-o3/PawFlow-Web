import { vi } from "@/lib/locale";
export type RegisterCustomerPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

type RegisterCustomerResponse = {
  message?: string;
};

export class RegisterCustomerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegisterCustomerError";
  }
}

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
