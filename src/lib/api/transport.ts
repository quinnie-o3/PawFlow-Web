import { apiBaseUrl, apiUrl } from "./config";
import { ApiError, isRequestCancelled, normalizeApiMessage, parseRetryAfterSeconds, throwIfCancelled } from "./errors";

export type ApiFetch = (input: string, init: RequestInit) => Promise<Response>;
export type ApiResponse<T> = { status: number; body: T | null; headers: Headers };
export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown; signal?: AbortSignal; headers?: Record<string, string>; credentials?: RequestCredentials;
};
type Decoder<T> = (body: unknown) => T;

/** No retries, refresh, token storage, or implicit credentials. Callers own policy. */
export function createApiClient(config: { apiUrl?: string; fetchImpl?: ApiFetch } = {}) {
  async function request<T>(path: string, options: RequestOptions & { decode: Decoder<T> }): Promise<ApiResponse<T>>;
  async function request(path: string, options?: RequestOptions): Promise<ApiResponse<unknown>>;
  async function request(path: string, options: RequestOptions & { decode?: Decoder<unknown> } = {}): Promise<ApiResponse<unknown>> {
    throwIfCancelled(options.signal);
    const url = apiUrl(apiBaseUrl(config.apiUrl), path);
    let response: Response;
    try {
      response = await (config.fetchImpl ?? fetch)(url, {
        method: options.method ?? "GET", signal: options.signal, credentials: options.credentials,
        cache: "no-store",
        headers: { Accept: "application/json", ...(options.body === undefined ? {} : { "Content-Type": "application/json" }), ...options.headers },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      throwIfCancelled(options.signal);
      if (isRequestCancelled(error)) throw error;
      throw new ApiError("network");
    }
    throwIfCancelled(options.signal);
    let text: string;
    try { text = response.status === 204 || response.status === 205 ? "" : await response.text(); }
    catch (error) {
      throwIfCancelled(options.signal);
      if (isRequestCancelled(error)) throw error;
      throw new ApiError("network", response.status);
    }
    throwIfCancelled(options.signal);
    let body: unknown = null;
    let invalidJson = false;
    if (text.trim()) {
      try { body = JSON.parse(text); } catch { invalidJson = true; }
    }
    if (!response.ok) {
      const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
      throw new ApiError("http", response.status, typeof record.code === "string" ? record.code : null,
        normalizeApiMessage(record.message), parseRetryAfterSeconds(response.headers.get("Retry-After"), record.retryAfterSeconds));
    }
    if (invalidJson) throw new ApiError("invalid-response", response.status);
    if (options.decode) {
      try { body = options.decode(body); } catch { throw new ApiError("invalid-response", response.status); }
    }
    return { status: response.status, body, headers: response.headers };
  }
  return { request };
}
