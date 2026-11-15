/**
 * Shared request + error normalisation for the public auth endpoints
 * (login, register, forgot-password, reset-password).
 *
 * These endpoints are never retried and never trigger a JWT refresh:
 * a 401 here means "wrong credentials", and a 403 TURNSTILE_* means
 * "solve the challenge again", neither of which a refresh token can fix.
 */

export type AuthFlow = "login" | "register" | "forgotPassword" | "resetPassword";

export const AUTH_ENDPOINTS: Record<AuthFlow, string> = {
  login: "/auth/login",
  register: "/auth/register",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
};

export type AuthErrorCode =
  | "TURNSTILE_REQUIRED"
  | "TURNSTILE_INVALID"
  | "TURNSTILE_EXPIRED"
  | "TURNSTILE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "RATE_LIMIT_UNAVAILABLE";

const KNOWN_CODES: ReadonlySet<string> = new Set<AuthErrorCode>([
  "TURNSTILE_REQUIRED",
  "TURNSTILE_INVALID",
  "TURNSTILE_EXPIRED",
  "TURNSTILE_UNAVAILABLE",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
]);

export type AuthApiErrorKind = "http" | "network" | "config" | "invalid-response";

/** Upper bound for any server-provided wait, so a bad value can never block the form forever. */
export const MAX_RETRY_AFTER_SECONDS = 15 * 60;

export class AuthApiError extends Error {
  readonly kind: AuthApiErrorKind;
  readonly status: number | null;
  /** Stable backend `code`, when it is one this client understands. */
  readonly code: AuthErrorCode | null;
  /** Raw backend `code` (for diagnostics only). */
  readonly rawCode: string | null;
  readonly retryAfterSeconds: number | null;
  /** Backend `message`, normalised to a string (may be English; not shown for known codes). */
  readonly serverMessage: string | null;

  constructor(
    message: string,
    init: {
      kind: AuthApiErrorKind;
      status?: number | null;
      code?: string | null;
      retryAfterSeconds?: number | null;
      serverMessage?: string | null;
    },
  ) {
    super(message);
    this.name = "AuthApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.rawCode = init.code ?? null;
    this.code = init.code && KNOWN_CODES.has(init.code) ? (init.code as AuthErrorCode) : null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.serverMessage = init.serverMessage ?? null;
  }

  get isTurnstileError(): boolean {
    return this.code !== null && this.code.startsWith("TURNSTILE_");
  }
}

/** `message` may be a string or (for DTO validation) an array of strings. */
export function normalizeApiMessage(message: unknown): string | null {
  if (typeof message === "string") return message.trim() || null;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === "string" && m.trim() !== "").map((m) => m.trim());
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

function clampSeconds(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.max(Math.ceil(seconds), 1), MAX_RETRY_AFTER_SECONDS);
}

/**
 * Retry delay in whole seconds from the `Retry-After` header (delta-seconds or HTTP-date),
 * falling back to the body's `retryAfterSeconds`. Invalid values are ignored; results are
 * clamped to [1, MAX_RETRY_AFTER_SECONDS].
 */
export function parseRetryAfterSeconds(header: string | null | undefined, bodyValue: unknown, now: number = Date.now()): number | null {
  const raw = header?.trim();
  if (raw) {
    if (/^\d+$/.test(raw)) {
      const fromHeader = clampSeconds(Number(raw));
      if (fromHeader !== null) return fromHeader;
    } else {
      const date = Date.parse(raw);
      if (!Number.isNaN(date)) {
        return clampSeconds(Math.max((date - now) / 1000, 1));
      }
    }
  }
  if (typeof bodyValue === "number") return clampSeconds(bodyValue);
  if (typeof bodyValue === "string" && /^\d+$/.test(bodyValue.trim())) return clampSeconds(Number(bodyValue));
  return null;
}

const FLOW_FALLBACK: Record<AuthFlow, string> = {
  login: "Không thể đăng nhập. Vui lòng thử lại.",
  register: "Không thể đăng ký tài khoản. Vui lòng thử lại.",
  forgotPassword: "Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.",
  resetPassword: "Không thể đặt lại mật khẩu. Vui lòng thử lại.",
};

const CONFIG_MESSAGE: Record<AuthFlow, string> = {
  login: "Chưa cấu hình địa chỉ API đăng nhập.",
  register: "Chưa cấu hình địa chỉ API đăng ký.",
  forgotPassword: "Chưa cấu hình địa chỉ API khôi phục mật khẩu.",
  resetPassword: "Chưa cấu hình địa chỉ API đặt lại mật khẩu.",
};

function waitText(seconds: number | null) {
  return seconds ? `sau ${seconds} giây` : "sau ít phút";
}

/** Vietnamese, user-facing message. Branches on HTTP status and the stable `code`, never on English text. */
export function describeAuthError(error: AuthApiError, flow: AuthFlow): string {
  switch (error.code) {
    case "TURNSTILE_REQUIRED":
      return "Vui lòng hoàn tất bước xác minh chống bot rồi gửi lại.";
    case "TURNSTILE_INVALID":
      return "Xác minh chống bot không hợp lệ. Vui lòng xác minh lại rồi gửi lại.";
    case "TURNSTILE_EXPIRED":
      return "Phiên xác minh đã hết hạn hoặc đã được sử dụng. Vui lòng xác minh lại rồi gửi lại.";
    case "TURNSTILE_UNAVAILABLE":
      return `Dịch vụ xác minh chống bot tạm thời gián đoạn. Vui lòng thử lại ${waitText(error.retryAfterSeconds)}.`;
    case "RATE_LIMITED":
      return `Bạn đã thử quá nhiều lần. Vui lòng thử lại ${waitText(error.retryAfterSeconds)}.`;
    case "RATE_LIMIT_UNAVAILABLE":
      return `Hệ thống đang tạm thời bận. Vui lòng thử lại ${waitText(error.retryAfterSeconds)}.`;
  }

  if (error.kind === "config") return CONFIG_MESSAGE[flow];
  if (error.kind === "network") return "Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.";
  if (error.kind === "invalid-response") return error.message;

  const status = error.status ?? 0;
  if (status === 400) {
    if (flow === "resetPassword") {
      return "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn, hoặc mật khẩu mới chưa đạt yêu cầu.";
    }
    return error.serverMessage ? `Thông tin chưa hợp lệ: ${error.serverMessage}` : "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.";
  }
  if (status === 401 && flow === "login") return "Email hoặc mật khẩu không đúng, hoặc tài khoản không ở trạng thái hoạt động.";
  if (status === 409 && flow === "register") return "Email này đã được sử dụng cho một tài khoản khác.";
  if (status === 403) return "Yêu cầu bị từ chối. Vui lòng tải lại trang và thử lại.";
  if (status === 429) return `Bạn đã thử quá nhiều lần. Vui lòng thử lại ${waitText(error.retryAfterSeconds)}.`;
  if (status >= 500) return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.";
  return FLOW_FALLBACK[flow];
}

export type AuthFetch = (input: string, init: RequestInit) => Promise<Response>;

export type PostAuthJsonOptions = {
  fetchImpl?: AuthFetch;
  apiUrl?: string | undefined;
  credentials?: RequestCredentials;
};

export function resolveAuthUrl(apiUrl: string, path: string): string {
  return `${apiUrl.replace(/\/+$/, "")}${path}`;
}

/**
 * POSTs a JSON body to an auth endpoint (exactly once) and returns the parsed body.
 * Throws AuthApiError for configuration, network and HTTP failures.
 */
export async function postAuthJson(flow: AuthFlow, payload: object, options: PostAuthJsonOptions = {}): Promise<{ status: number; body: unknown }> {
  const apiUrl = options.apiUrl ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new AuthApiError(CONFIG_MESSAGE[flow], { kind: "config" });
  }

  const fetchImpl = options.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init));

  let response: Response;
  try {
    response = await fetchImpl(resolveAuthUrl(apiUrl, AUTH_ENDPOINTS[flow]), {
      method: "POST",
      credentials: options.credentials,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    const error = new AuthApiError("", { kind: "network" });
    throw withDescription(error, flow);
  }

  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const error = new AuthApiError("", {
      kind: "http",
      status: response.status,
      code: typeof record.code === "string" ? record.code : null,
      serverMessage: normalizeApiMessage(record.message),
      retryAfterSeconds:
        response.status === 429 || response.status === 503
          ? parseRetryAfterSeconds(response.headers.get("Retry-After"), record.retryAfterSeconds)
          : null,
    });
    throw withDescription(error, flow);
  }

  return { status: response.status, body };
}

function withDescription(error: AuthApiError, flow: AuthFlow): AuthApiError {
  error.message = describeAuthError(error, flow);
  return error;
}
