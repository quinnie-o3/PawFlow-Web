import { createApiClient, type RequestOptions } from "../../lib/api/transport";
import { ApiError, throwIfCancelled } from "../../lib/api/errors";
import { QueryCache } from "../../lib/api/queryCache";
import { decodeSession, type SessionView } from "./model";
export type ClientState = {
  status: "pending" | "anonymous" | "authenticated" | "error";
  session: SessionView | null;
  epoch: number;
};
let state: ClientState = { status: "pending", session: null, epoch: 0 };
const initial = state,
  listeners = new Set<() => void>(),
  controllers = new Set<AbortController>();
export const privateCache = new QueryCache();
let channel: BroadcastChannel | undefined;
let ending = false;
let pendingLogout: string | null = null;
const logoutKey = "pawflow.pending-logout";
export const hasPendingLogout = () => ending;
function rememberLogout(generation: string | null) {
  pendingLogout = generation;
  try {
    if (generation === null) window.localStorage.removeItem(logoutKey);
    else window.localStorage.setItem(logoutKey, generation);
  } catch {
    /* In-memory fence still protects this tab if storage is unavailable. */
  }
}
const emit = () => listeners.forEach((fn) => fn());
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const snapshot = () => state;
export const serverSnapshot = () => initial;
export function clearClient(status: ClientState["status"] = "anonymous") {
  controllers.forEach((c) => c.abort());
  controllers.clear();
  privateCache.changeSession(null);
  state = { status, session: null, epoch: state.epoch + 1 };
  emit();
}
export function notifySessionChange() {
  channel?.postMessage("changed");
}
export function acceptSession(view: SessionView) {
  if (
    state.session?.generation === view.generation &&
    state.session.user?.id === view.user?.id &&
    state.session.user?.role === view.user?.role
  ) {
    state = {
      ...state,
      status: view.user ? "authenticated" : "anonymous",
      session: view,
    };
    emit();
    return;
  }
  clearClient(view.user ? "authenticated" : "anonymous");
  state = { ...state, session: view };
  privateCache.changeSession(view.user?.id ?? null);
  emit();
}
export function connectSessionEvents() {
  try {
    window.localStorage.removeItem("pawflow.access-token");
    window.sessionStorage.removeItem("pawflow.access-token");
  } catch {
    /* Legacy credentials are never read or trusted. */
  }
  try {
    pendingLogout = window.localStorage.getItem(logoutKey);
    ending = pendingLogout !== null;
    if (ending) clearClient("error");
  } catch {}
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("pawflow-session");
    channel.onmessage = (event) => {
      try {
        pendingLogout = window.localStorage.getItem(logoutKey);
      } catch {}
      ending = event.data === "ending" || pendingLogout !== null;
      clearClient(ending ? "error" : "pending");
      if (!ending) void bootstrap();
    };
  }
  return () => {
    channel?.close();
    channel = undefined;
  };
}
export async function bffRequest(
  path: string,
  options: RequestOptions = {},
  decode?: (body: unknown) => unknown,
) {
  const epoch = state.epoch,
    controller = new AbortController();
  controllers.add(controller);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 40000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const result = await createApiClient({
      apiUrl: window.location.origin + "/api/bff",
    }).request(path, {
      ...options,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        "x-bff-generation": state.session?.generation ?? "",
        ...options.headers,
      },
    });
    throwIfCancelled(controller.signal);
    if (epoch !== state.epoch)
      throw new DOMException("Session changed", "AbortError");
    return { ...result, body: decode ? decode(result.body) : result.body };
  } catch (error) {
    if (timedOut && epoch === state.epoch && !options.signal?.aborted)
      throw new ApiError("network");
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      epoch === state.epoch
    ) {
      clearClient();
      notifySessionChange();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    controllers.delete(controller);
    options.signal?.removeEventListener("abort", abort);
  }
}
let boot: Promise<SessionView | null> | null = null;
let bootEpoch = -1;
export function bootstrap(): Promise<SessionView | null> {
  if (ending) return Promise.resolve(null);
  if (boot && bootEpoch === state.epoch) return boot;
  const epoch = state.epoch;
  const run = async () => {
    if (epoch !== state.epoch || ending) return null;
    try {
      const result = await bffRequest("/session", { method: "POST", body: {} });
      const view = decodeSession(result.body);
      if (epoch !== state.epoch) return null;
      acceptSession(view);
      return view;
    } catch (error) {
      if (epoch === state.epoch) {
        if (error instanceof ApiError && error.status === 401) clearClient();
        else {
          // Preserve this tab's drafts while the guard hides unverified content.
          // Only a fresh backend identity may reveal it again.
          state = { ...state, status: "error" };
          emit();
        }
      }
      return null;
    }
  };
  // Web Locks only coordinate initial cookie creation in a browser. Refresh correctness is in PostgreSQL.
  const work = (async () =>
    navigator.locks
      ? await navigator.locks.request(
          "pawflow-bootstrap",
          async () => await run(),
        )
      : await run())();
  const promise = work.finally(() => {
    if (boot === promise) boot = null;
  });
  boot = promise;
  bootEpoch = epoch;
  return promise;
}
export async function logout() {
  const generation = pendingLogout ?? state.session?.generation ?? "";
  ending = true;
  rememberLogout(generation);
  clearClient();
  channel?.postMessage("ending");
  try {
    let revoked = true;
    try {
      const result = await createApiClient({
        apiUrl: window.location.origin + "/api/bff",
      }).request("/auth/logout", {
        method: "POST",
        body: {},
        credentials: "same-origin",
        signal: AbortSignal.timeout(25000),
        headers: { "x-bff-generation": generation },
      });
      revoked = (result.body as { revoked?: boolean })?.revoked === true;
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
      revoked = false;
    }
    ending = false;
    rememberLogout(null);
    clearClient();
    notifySessionChange();
    return revoked;
  } catch (error) {
    clearClient("error");
    throw error;
  }
}
export async function retrySession() {
  // Retrying an uncertain logout is always an explicit user action.
  if (ending) await logout();
  return bootstrap();
}
export function apiMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 422)
      return "Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.";
    if (error.status === 401)
      return "Phiên đã kết thúc. Vui lòng đăng nhập lại.";
    if (error.status === 403)
      return "Bạn không có quyền thực hiện thao tác này.";
    if (error.status === 404)
      return "Dữ liệu không tồn tại hoặc bạn không có quyền truy cập.";
    if (error.status === 409)
      return "Dữ liệu hoặc phiên đã thay đổi. Vui lòng tải lại và kiểm tra trước khi thử lại.";
    if (error.retryAfterSeconds)
      return `Vui lòng chờ ${error.retryAfterSeconds} giây trước khi thử lại.`;
  }
  return "Không thể xác nhận kết quả. Dữ liệu nhập được giữ lại; hãy kiểm tra dữ liệu trước khi thử gửi lại.";
}
