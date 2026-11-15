import type { TurnstileApi, TurnstileRenderOptions } from "./loadTurnstileScript";
import { isUsableTurnstileToken, type TurnstileAction } from "./turnstileConfig";

export type TurnstileEventHandlers = {
  onToken: (token: string) => void;
  onExpire: () => void;
  onError: (errorCode?: string) => void;
  onTimeout: () => void;
};

export type TurnstileControllerOptions = {
  api: TurnstileApi;
  container: HTMLElement;
  siteKey: string;
  action: TurnstileAction;
  /** Read on every event, so the latest React handlers are used without re-rendering the widget. */
  getHandlers: () => TurnstileEventHandlers;
  size?: TurnstileRenderOptions["size"];
  theme?: TurnstileRenderOptions["theme"];
  language?: string;
};

export type TurnstileController = {
  readonly widgetId: string | null;
  readonly isDestroyed: boolean;
  /** Clears the current challenge and starts a new one. No-op once destroyed. */
  reset: () => void;
  /** Removes the widget. Idempotent; later events from this instance are ignored. */
  destroy: () => void;
};

/**
 * Owns exactly one Turnstile widget. Each controller is an independent instance:
 * events are dropped once it is destroyed (unmount, navigation, Strict Mode re-run),
 * so a late callback from an old widget can never deliver a token to the form.
 */
export function createTurnstileController(options: TurnstileControllerOptions): TurnstileController {
  const { api, container } = options;
  let destroyed = false;
  let widgetId: string | null = null;

  const guard = <Args extends unknown[]>(fn: (handlers: TurnstileEventHandlers, ...args: Args) => void) =>
    (...args: Args) => {
      if (destroyed) return;
      fn(options.getHandlers(), ...args);
    };

  widgetId = api.render(container, {
    sitekey: options.siteKey,
    action: options.action,
    size: options.size ?? "flexible",
    theme: options.theme ?? "light",
    language: options.language ?? "vi",
    // The token is read from the callback only; no hidden `cf-turnstile-response` input.
    "response-field": false,
    // Expiry/timeouts are handled by the form (clear token, then reset explicitly).
    "refresh-expired": "manual",
    "refresh-timeout": "manual",
    retry: "never",
    callback: guard((handlers, token: string) => {
      if (isUsableTurnstileToken(token)) handlers.onToken(token);
      else handlers.onError("invalid-token");
    }),
    "expired-callback": guard((handlers) => handlers.onExpire()),
    "error-callback": (errorCode?: string) => {
      guard((handlers, code?: string) => handlers.onError(code))(errorCode);
      // `true` tells Turnstile the error is handled (no uncaught error in the console).
      return true;
    },
    "timeout-callback": guard((handlers) => handlers.onTimeout()),
  }) ?? null;

  return {
    get widgetId() {
      return widgetId;
    },
    get isDestroyed() {
      return destroyed;
    },
    reset() {
      if (destroyed || widgetId === null) return;
      try {
        api.reset(widgetId);
      } catch {
        // The widget may already have been torn down by Cloudflare; nothing to reset.
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (widgetId === null) return;
      try {
        api.remove(widgetId);
      } catch {
        // Already removed.
      }
      widgetId = null;
    },
  };
}
