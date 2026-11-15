import test from "node:test";
import assert from "node:assert/strict";
import { loadTurnstileScript, resetTurnstileScriptLoaderForTests, type ScriptHost, type TurnstileApi, type TurnstileRenderOptions } from "./loadTurnstileScript";
import { createTurnstileController, type TurnstileEventHandlers } from "./turnstileController";
import { TURNSTILE_ACTIONS, TURNSTILE_SCRIPT_URL, TURNSTILE_TOKEN_MAX_LENGTH } from "./turnstileConfig";
import { initialTurnstileTokenState, turnstileTokenReducer, type TurnstileTokenState } from "./turnstileTokenState";
import { createProtectedSubmitter, describeSubmitBlock, SubmitBlockedError } from "./protectedSubmit";

const SITE_KEY = "test-site-key";

/* ---------------------------------------------------------------- fakes */

type FakeWidget = { id: string; container: unknown; options: TurnstileRenderOptions; removed: boolean; resets: number };

function createFakeTurnstile() {
  const widgets: FakeWidget[] = [];
  const api: TurnstileApi = {
    render(container, options) {
      const widget = { id: `w${widgets.length + 1}`, container, options, removed: false, resets: 0 };
      widgets.push(widget);
      return widget.id;
    },
    reset(id) {
      const widget = widgets.find((w) => w.id === id);
      if (!widget || widget.removed) throw new Error("reset on unknown widget");
      widget.resets += 1;
    },
    remove(id) {
      const widget = widgets.find((w) => w.id === id);
      if (!widget || widget.removed) throw new Error("remove on unknown widget");
      widget.removed = true;
    },
  };
  return { api, widgets, live: () => widgets.filter((w) => !w.removed) };
}

function recordingHandlers() {
  const events: string[] = [];
  const handlers: TurnstileEventHandlers = {
    onToken: (token) => events.push(`token:${token}`),
    onExpire: () => events.push("expired"),
    onError: (code) => events.push(`error:${code ?? ""}`),
    onTimeout: () => events.push("timeout"),
  };
  return { events, handlers };
}

function createFakeScriptHost() {
  let turnstile: TurnstileApi | undefined;
  const appended: Array<{ id: string; src: string; async: boolean; defer: boolean; removed: boolean; listeners: Record<string, Array<() => void>> }> = [];
  const timers: Array<{ callback: () => void; cleared: boolean }> = [];
  const host: ScriptHost = {
    getTurnstile: () => turnstile,
    findScript: (id) => (appended.find((s) => s.id === id && !s.removed) as never) ?? null,
    createScript: () => {
      const script = {
        id: "",
        src: "",
        async: false,
        defer: false,
        removed: false,
        listeners: {} as Record<string, Array<() => void>>,
        addEventListener(type: string, listener: () => void) {
          (this.listeners[type] ??= []).push(listener);
        },
        removeEventListener(type: string, listener: () => void) {
          this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener);
        },
        remove() {
          this.removed = true;
        },
      };
      return script as never;
    },
    appendScript: (script) => appended.push(script as never),
    setTimeout: (callback) => {
      const timer = { callback, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (handle) => {
      (handle as { cleared: boolean }).cleared = true;
    },
  };
  const fire = (type: "load" | "error") => appended.forEach((s) => (s.listeners[type] ?? []).slice().forEach((l) => l()));
  return {
    host,
    appended,
    timers,
    setTurnstile: (api: TurnstileApi) => (turnstile = api),
    fire,
  };
}

/* ---------------------------------------------------------- script load */

test("widget: loads the official explicit-render script exactly once for concurrent callers", async () => {
  resetTurnstileScriptLoaderForTests();
  const fake = createFakeScriptHost();
  const first = loadTurnstileScript(fake.host);
  const second = loadTurnstileScript(fake.host);
  assert.equal(first, second);
  assert.equal(fake.appended.length, 1);
  assert.equal(fake.appended[0].src, TURNSTILE_SCRIPT_URL);
  assert.ok(TURNSTILE_SCRIPT_URL.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js"));
  assert.ok(TURNSTILE_SCRIPT_URL.includes("render=explicit"));
  assert.equal(fake.appended[0].async, true);

  const { api } = createFakeTurnstile();
  fake.setTurnstile(api);
  fake.fire("load");
  assert.equal(await first, api);
  assert.equal(fake.timers[0].cleared, true);
  // Already available: resolves without touching the DOM again.
  assert.equal(await loadTurnstileScript(fake.host), api);
  assert.equal(fake.appended.length, 1);
});

test("widget: a failed or timed-out script load rejects and can be retried", async () => {
  resetTurnstileScriptLoaderForTests();
  const fake = createFakeScriptHost();
  const failed = loadTurnstileScript(fake.host);
  fake.fire("error");
  await assert.rejects(failed, /failed to load/);
  assert.equal(fake.appended[0].removed, true);

  const timedOut = loadTurnstileScript(fake.host);
  assert.equal(fake.appended.length, 2, "retry injects a fresh script tag");
  fake.timers[1].callback();
  await assert.rejects(timedOut, /timed out/);

  const loadedWithoutApi = loadTurnstileScript(fake.host);
  fake.fire("load");
  await assert.rejects(loadedWithoutApi, /without exposing/);
  resetTurnstileScriptLoaderForTests();
});

/* ------------------------------------------------------------ controller */

test("widget: renders with the configured site key, action and manual expiry handling", () => {
  const { api, widgets } = createFakeTurnstile();
  const { handlers } = recordingHandlers();
  createTurnstileController({ api, container: {} as HTMLElement, siteKey: SITE_KEY, action: TURNSTILE_ACTIONS.login, getHandlers: () => handlers });
  assert.equal(widgets.length, 1);
  assert.equal(widgets[0].options.sitekey, SITE_KEY);
  assert.equal(widgets[0].options.action, "login");
  assert.equal(widgets[0].options["refresh-expired"], "manual");
  assert.equal(widgets[0].options["response-field"], false);
});

test("widget: success, expiration, error and timeout callbacks reach the latest handlers", () => {
  const { api, widgets } = createFakeTurnstile();
  const first = recordingHandlers();
  const second = recordingHandlers();
  let current = first.handlers;
  createTurnstileController({ api, container: {} as HTMLElement, siteKey: SITE_KEY, action: "register", getHandlers: () => current });
  const options = widgets[0].options;

  options.callback?.("tok-1");
  current = second.handlers; // parent re-rendered with new handlers: no stale closure
  options["expired-callback"]?.();
  assert.equal(options["error-callback"]?.("300010"), true);
  options["timeout-callback"]?.();
  options.callback?.("x".repeat(TURNSTILE_TOKEN_MAX_LENGTH + 1));

  assert.deepEqual(first.events, ["token:tok-1"]);
  assert.deepEqual(second.events, ["expired", "error:300010", "timeout", "error:invalid-token"]);
  assert.equal(widgets.length, 1, "handler changes never re-render the widget");
});

test("widget: reset targets this widget; destroy removes it and ignores late callbacks", () => {
  const { api, widgets } = createFakeTurnstile();
  const { events, handlers } = recordingHandlers();
  const controller = createTurnstileController({ api, container: {} as HTMLElement, siteKey: SITE_KEY, action: "login", getHandlers: () => handlers });

  controller.reset();
  assert.equal(widgets[0].resets, 1);

  controller.destroy();
  controller.destroy(); // idempotent
  controller.reset(); // no throw on destroyed widget
  assert.equal(widgets[0].removed, true);
  assert.equal(controller.isDestroyed, true);

  widgets[0].options.callback?.("late-token");
  widgets[0].options["expired-callback"]?.();
  assert.deepEqual(events, []);
});

test("widget: Strict Mode mount → cleanup → mount leaves exactly one live widget", () => {
  const { api, live, widgets } = createFakeTurnstile();
  const first = recordingHandlers();
  const second = recordingHandlers();
  const container = {} as HTMLElement;
  const a = createTurnstileController({ api, container, siteKey: SITE_KEY, action: "login", getHandlers: () => first.handlers });
  a.destroy();
  const b = createTurnstileController({ api, container, siteKey: SITE_KEY, action: "login", getHandlers: () => second.handlers });

  assert.equal(live().length, 1);
  assert.equal(live()[0].id, b.widgetId);
  // A late token from the first (destroyed) instance is dropped.
  widgets[0].options.callback?.("late-token-from-first-mount");
  widgets[1].options.callback?.("live-token");
  assert.equal(a.isDestroyed, true);
  assert.deepEqual(first.events, []);
  assert.deepEqual(second.events, ["token:live-token"]);
});

test("widget: an old widget's callback after switching auth pages never reaches the new form", () => {
  const { api, widgets } = createFakeTurnstile();
  const loginEvents = recordingHandlers();
  const registerEvents = recordingHandlers();
  const login = createTurnstileController({ api, container: {} as HTMLElement, siteKey: SITE_KEY, action: "login", getHandlers: () => loginEvents.handlers });
  login.destroy(); // navigated away
  createTurnstileController({ api, container: {} as HTMLElement, siteKey: SITE_KEY, action: "register", getHandlers: () => registerEvents.handlers });

  widgets[0].options.callback?.("stale-login-token");
  widgets[1].options.callback?.("register-token");
  assert.deepEqual(loginEvents.events, []);
  assert.deepEqual(registerEvents.events, ["token:register-token"]);
  assert.equal(widgets[1].options.action, "register");
});

/* --------------------------------------------------------- token state */

test("token state: token → consumed drops the token; expiry/error clear it", () => {
  let state: TurnstileTokenState = initialTurnstileTokenState;
  state = turnstileTokenReducer(state, { type: "ready" });
  assert.deepEqual(state, { status: "pending", token: null });
  state = turnstileTokenReducer(state, { type: "token", token: "t1" });
  assert.deepEqual(state, { status: "verified", token: "t1" });
  state = turnstileTokenReducer(state, { type: "consumed" });
  assert.deepEqual(state, { status: "pending", token: null });

  state = turnstileTokenReducer(turnstileTokenReducer(state, { type: "token", token: "t2" }), { type: "expired" });
  assert.deepEqual(state, { status: "expired", token: null });
  state = turnstileTokenReducer(turnstileTokenReducer(state, { type: "token", token: "t3" }), { type: "error" });
  assert.deepEqual(state, { status: "error", token: null });
  assert.deepEqual(turnstileTokenReducer(state, { type: "token", token: "" }), { status: "error", token: null });
  assert.deepEqual(turnstileTokenReducer({ status: "unavailable", token: null }, { type: "reload" }), { status: "loading", token: null });
});

/* ------------------------------------------------------ protected submit */

function submitHarness(initialToken: string | null = "fresh-1") {
  let token: string | null = initialToken;
  let resets = 0;
  const submitter = createProtectedSubmitter({
    takeToken: () => {
      const current = token;
      token = null;
      return current;
    },
    resetChallenge: () => {
      resets += 1;
    },
  });
  return { submitter, giveToken: (t: string) => (token = t), resets: () => resets, peek: () => token };
}

test("submit: blocked without a token and never calls the API", async () => {
  const h = submitHarness(null);
  let calls = 0;
  await assert.rejects(h.submitter.submit(async () => calls++), (e: unknown) => e instanceof SubmitBlockedError && e.reason === "missing-token");
  assert.equal(calls, 0);
  assert.equal(h.resets(), 0);
  assert.match(describeSubmitBlock(new SubmitBlockedError("missing-token")) ?? "", /xác minh/);
});

test("submit: token is invalidated before the request and the widget resets after success and failure", async () => {
  const h = submitHarness("fresh-1");
  let peekDuringRequest: string | null = "unset";
  let resetsDuringRequest = -1;
  await h.submitter.submit(async (token) => {
    assert.equal(token, "fresh-1");
    peekDuringRequest = h.peek();
    resetsDuringRequest = h.resets();
  });
  assert.equal(peekDuringRequest, null, "consumed before the request starts");
  assert.equal(resetsDuringRequest, 0, "no reset while the request is in flight");
  assert.equal(h.resets(), 1);

  h.giveToken("fresh-2");
  await assert.rejects(h.submitter.submit(async () => Promise.reject(new Error("HTTP 401"))), /401/);
  assert.equal(h.resets(), 2, "reset even when the request throws");
});

test("submit: duplicate submission is blocked while a request is in flight", async () => {
  const h = submitHarness("fresh-1");
  let release!: () => void;
  const sent: string[] = [];
  const first = h.submitter.submit((token) => {
    sent.push(token);
    return new Promise<void>((resolve) => (release = resolve));
  });
  h.giveToken("fresh-2");
  await assert.rejects(h.submitter.submit(async (token) => sent.push(token)), (e: unknown) => e instanceof SubmitBlockedError && e.reason === "in-flight");
  assert.equal(h.submitter.inFlight, true);
  release();
  await first;
  assert.deepEqual(sent, ["fresh-1"]);
});

test("submit: a consumed token cannot be reused for the next attempt", async () => {
  const h = submitHarness("only-once");
  const sent: string[] = [];
  await assert.rejects(h.submitter.submit(async (token) => { sent.push(token); throw new Error("403"); }));
  await assert.rejects(h.submitter.submit(async (token) => sent.push(token)), (e: unknown) => e instanceof SubmitBlockedError && e.reason === "missing-token");
  assert.deepEqual(sent, ["only-once"]);
});

test("submit: an active cooldown blocks the attempt without consuming the token", async () => {
  let token: string | null = "fresh";
  const submitter = createProtectedSubmitter({
    takeToken: () => { const t = token; token = null; return t; },
    resetChallenge: () => {},
    isCoolingDown: () => true,
  });
  await assert.rejects(submitter.submit(async () => {}), (e: unknown) => e instanceof SubmitBlockedError && e.reason === "cooling-down");
  assert.equal(token, "fresh");
});
