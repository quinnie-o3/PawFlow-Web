import { isUsableTurnstileToken } from "./turnstileConfig";

/**
 * Widget/token lifecycle as seen by a form.
 * - loading: script/widget not ready yet
 * - pending: widget rendered, waiting for the challenge to produce a token
 * - verified: a fresh, unused token is available
 * - expired / error / timeout: no token; the user can retry
 * - unavailable: widget cannot be shown (missing site key, script blocked)
 */
export type TurnstileStatus = "loading" | "pending" | "verified" | "expired" | "error" | "timeout" | "unavailable";

export type TurnstileTokenState = {
  status: TurnstileStatus;
  token: string | null;
};

export type TurnstileTokenEvent =
  | { type: "ready" }
  | { type: "token"; token: string }
  | { type: "expired" }
  | { type: "error" }
  | { type: "timeout" }
  | { type: "unavailable" }
  /** Token handed to a request: it is single use, so it is dropped immediately. */
  | { type: "consumed" }
  /** Widget reset requested: wait for a new challenge. */
  | { type: "reset" }
  /** Widget is being loaded again from scratch (e.g. after a script failure). */
  | { type: "reload" };

export const initialTurnstileTokenState: TurnstileTokenState = { status: "loading", token: null };

export function turnstileTokenReducer(state: TurnstileTokenState, event: TurnstileTokenEvent): TurnstileTokenState {
  switch (event.type) {
    case "ready":
      return state.status === "loading" ? { status: "pending", token: null } : state;
    case "token":
      return isUsableTurnstileToken(event.token) ? { status: "verified", token: event.token } : { status: "error", token: null };
    case "expired":
      return { status: "expired", token: null };
    case "error":
      return { status: "error", token: null };
    case "timeout":
      return { status: "timeout", token: null };
    case "unavailable":
      return { status: "unavailable", token: null };
    case "consumed":
    case "reset":
      return state.status === "unavailable" || state.status === "loading" ? { ...state, token: null } : { status: "pending", token: null };
    case "reload":
      return { status: "loading", token: null };
  }
}

/** Vietnamese status text for the live region under the widget. */
export function turnstileStatusMessage(status: TurnstileStatus): string {
  switch (status) {
    case "loading":
      return "Đang tải bước xác minh chống bot...";
    case "pending":
      return "Vui lòng hoàn tất bước xác minh để tiếp tục.";
    case "verified":
      return "Đã xác minh. Bạn có thể gửi biểu mẫu.";
    case "expired":
      return "Phiên xác minh đã hết hạn. Vui lòng xác minh lại.";
    case "timeout":
      return "Bước xác minh đã quá thời gian. Vui lòng thử lại.";
    case "error":
      return "Không thể hoàn tất bước xác minh. Vui lòng thử lại.";
    case "unavailable":
      return "Không thể tải bước xác minh chống bot. Vui lòng kiểm tra kết nối hoặc tải lại trang.";
  }
}

export function turnstileNeedsRetry(status: TurnstileStatus): boolean {
  return status === "expired" || status === "error" || status === "timeout" || status === "unavailable";
}
