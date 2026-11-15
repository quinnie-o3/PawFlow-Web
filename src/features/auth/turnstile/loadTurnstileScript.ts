import { TURNSTILE_SCRIPT_ID, TURNSTILE_SCRIPT_URL } from "./turnstileConfig";

export type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  size?: "normal" | "flexible" | "compact";
  theme?: "auto" | "light" | "dark";
  language?: string;
  "response-field"?: boolean;
  "refresh-expired"?: "auto" | "manual" | "never";
  "refresh-timeout"?: "auto" | "manual" | "never";
  retry?: "auto" | "never";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: (errorCode?: string) => boolean | void;
  "timeout-callback"?: () => void;
};

/** The subset of `window.turnstile` this app uses. */
export type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | null | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

type ScriptLike = {
  id: string;
  src: string;
  async: boolean;
  defer: boolean;
  addEventListener: (type: "load" | "error", listener: () => void) => void;
  removeEventListener: (type: "load" | "error", listener: () => void) => void;
  remove: () => void;
};

/** Minimal DOM surface, injectable for tests. */
export type ScriptHost = {
  getTurnstile: () => TurnstileApi | undefined;
  findScript: (id: string) => ScriptLike | null;
  createScript: () => ScriptLike;
  appendScript: (script: ScriptLike) => void;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export const TURNSTILE_SCRIPT_TIMEOUT_MS = 15_000;

let pending: Promise<TurnstileApi> | null = null;

function browserHost(): ScriptHost {
  return {
    getTurnstile: () => (window as unknown as { turnstile?: TurnstileApi }).turnstile,
    findScript: (id) => document.getElementById(id) as unknown as ScriptLike | null,
    createScript: () => document.createElement("script") as unknown as ScriptLike,
    appendScript: (script) => document.head.appendChild(script as unknown as HTMLScriptElement),
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  };
}

/**
 * Loads the official Turnstile script once per page (explicit rendering).
 * Concurrent callers share one promise; a failed load is forgotten so the user can retry.
 */
export function loadTurnstileScript(host: ScriptHost = browserHost(), timeoutMs = TURNSTILE_SCRIPT_TIMEOUT_MS): Promise<TurnstileApi> {
  const ready = host.getTurnstile();
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;

  pending = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = host.findScript(TURNSTILE_SCRIPT_ID);
    const script = existing ?? host.createScript();

    const cleanup = () => {
      host.clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const fail = (message: string) => {
      cleanup();
      script.remove();
      pending = null;
      reject(new Error(message));
    };
    const onLoad = () => {
      const api = host.getTurnstile();
      if (!api) {
        fail("Turnstile script loaded without exposing window.turnstile");
        return;
      }
      cleanup();
      resolve(api);
    };
    const onError = () => fail("Turnstile script failed to load");
    const timer = host.setTimeout(() => fail("Turnstile script load timed out"), timeoutMs);

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      host.appendScript(script);
    }
  });

  return pending;
}

/** Test helper: forget the cached load promise. */
export function resetTurnstileScriptLoaderForTests() {
  pending = null;
}
