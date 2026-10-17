export type LoginCustomerPayload = {
  email: string;
  password: string;
};

export type LoginCustomerResponse = {
  accessToken: string;
  message?: string;
};

type LoginCustomerResponseBody = {
  accessToken?: unknown;
  message?: unknown;
};

export class LoginCustomerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginCustomerError";
  }
}

export async function loginCustomer(payload: LoginCustomerPayload): Promise<LoginCustomerResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new LoginCustomerError("Chưa cấu hình địa chỉ API đăng nhập.");
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null) as LoginCustomerResponseBody | null;

  if (!response.ok) {
    throw new LoginCustomerError(typeof body?.message === "string" ? body.message : "Không thể đăng nhập. Vui lòng thử lại.");
  }

  if (!body || typeof body.accessToken !== "string" || !body.accessToken) {
    throw new LoginCustomerError("API đăng nhập không trả về accessToken.");
  }

  return {
    accessToken: body.accessToken,
    message: typeof body.message === "string" ? body.message : undefined,
  };
}
