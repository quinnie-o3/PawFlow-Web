import { apiBaseUrl, apiUrl } from "../../../lib/api/config";
import { ApiError } from "../../../lib/api/errors";
import {
  trustedOrigin,
  readBody,
  clientHeaders,
} from "../../../lib/server/bff/handler";

const allowed = {
  "forgot-password": ["email", "turnstileToken"],
  "reset-password": ["token", "newPassword", "turnstileToken"],
  "verify-email": ["token"],
} as const;
type Operation = keyof typeof allowed;
const noStore = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

/** Public recovery mutations only. There is no caller-controlled upstream URL. */
export async function recoveryProxy(
  request: Request,
  operation: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!Object.hasOwn(allowed, operation))
    return Response.json(
      { message: "Not found" },
      { status: 404, headers: noStore },
    );
  try {
    if (!trustedOrigin(request))
      return new Response(null, { status: 403, headers: noStore });
  } catch {
    return new Response(null, { status: 503, headers: noStore });
  }
  let payload: unknown;
  try {
    payload = await readBody(request);
  } catch (error) {
    return new Response(null, {
      status: error instanceof ApiError ? (error.status ?? 400) : 400,
      headers: noStore,
    });
  }
  const keys = allowed[operation as Operation] as readonly string[];
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).some((key) => !keys.includes(key))
  ) {
    return Response.json(
      { message: "Invalid request" },
      { status: 400, headers: noStore },
    );
  }
  try {
    const base = apiBaseUrl(process.env.PAWFLOW_API_URL ?? "");
    if (
      process.env.NODE_ENV === "production" &&
      new URL(base).protocol !== "https:"
    )
      throw new Error("Invalid API configuration");
    const response = await fetchImpl(apiUrl(base, `/auth/${operation}`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...clientHeaders(request),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    });
    const headers = new Headers(noStore);
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) headers.set("Retry-After", retryAfter);
    if (response.status === 204 || response.status === 205)
      return new Response(null, { status: response.status, headers });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      /* Invalid backend response is handled below. */
    }
    if (
      response.ok &&
      (!data || typeof data !== "object" || Array.isArray(data))
    )
      return Response.json(
        { message: "Invalid response" },
        { status: 502, headers },
      );
    const source =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    // Allow only error metadata and the public success message; never reflect arbitrary backend fields.
    const body = {
      ...(source.message
        ? {
            message: response.ok
              ? "Yêu cầu đã được tiếp nhận."
              : "Không thể hoàn tất yêu cầu.",
          }
        : {}),
      ...(typeof source.code === "string" ? { code: source.code } : {}),
      ...(typeof source.retryAfterSeconds === "number"
        ? { retryAfterSeconds: source.retryAfterSeconds }
        : {}),
    };
    return Response.json(body, { status: response.status, headers });
  } catch {
    return Response.json(
      { message: "Service unavailable" },
      { status: 503, headers: noStore },
    );
  }
}
