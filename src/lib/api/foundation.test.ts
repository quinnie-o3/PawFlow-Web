import test from "node:test";
import assert from "node:assert/strict";
import { postAuthJson, AuthApiError } from "../../features/auth/services/authApi";
import { createProtectedSubmitter } from "../../features/auth/turnstile/protectedSubmit";
import { createApiClient } from "./transport";
import { ApiError, isRequestCancelled, parseRetryAfterSeconds } from "./errors";
import { apiBaseUrl, apiUrl } from "./config";
import { QueryCache, queryKeys } from "./queryCache";
import { createIdentityBoundary, guardDecision } from "./identity";

const base = "https://example.test/api";
test("config rejects missing, credentialed and escaping URLs without echoing values", () => {
  for (const value of ["", "ftp://example.test", "https://user:password@example.test", "https://example.test?key=value"]) {
    assert.throws(() => apiBaseUrl(value), (e: unknown) => e instanceof ApiError && e.kind === "config" && e.message === "config");
  }
  for (const path of ["//other.test", "/../escape", "/%2e%2e/escape", "/x#fragment"]) assert.throws(() => apiUrl(base, path));
  assert.equal(apiUrl(base + "/", "/auth/me"), base + "/auth/me");
});
test("transport handles typed decoding, empty 204/205/200 and malformed success JSON", async () => {
  const decode = (value: unknown) => { if (typeof (value as { id?: unknown })?.id !== "string") throw Error(); return value as { id: string }; };
  const client = createApiClient({ apiUrl: base, fetchImpl: async () => new Response('{"id":"1"}') });
  assert.equal((await client.request("/item", { decode })).body?.id, "1");
  await assert.rejects(client.request("/item", { decode: () => { throw Error(); } }), (e: unknown) => e instanceof ApiError && e.kind === "invalid-response");
  for (const status of [200, 204, 205]) {
    const empty = createApiClient({ apiUrl: base, fetchImpl: async () => new Response(null, { status }) });
    assert.equal((await empty.request("/item")).body, null);
  }
  await assert.rejects(createApiClient({ apiUrl: base, fetchImpl: async () => new Response("<html>") }).request("/item"), (e: unknown) => e instanceof ApiError && e.kind === "invalid-response");
});
test("HTTP status wins over malformed error JSON; network errors are separate; no automatic retries", async () => {
  let calls = 0;
  const client = createApiClient({ apiUrl: base, fetchImpl: async () => { calls++; return new Response("<html>", { status: 503, headers: { "Retry-After": "5" } }); } });
  await assert.rejects(client.request("/item"), (e: unknown) => e instanceof ApiError && e.kind === "http" && e.status === 503 && e.retryAfterSeconds === 5);
  assert.equal(calls, 1);
  await assert.rejects(createApiClient({ apiUrl: base, fetchImpl: async () => { throw Error("offline"); } }).request("/item"), (e: unknown) => e instanceof ApiError && e.kind === "network");
  const errors = createApiClient({ apiUrl: base, fetchImpl: async () => new Response(JSON.stringify({ code: "RATE_LIMITED", message: ["a", " b "], retryAfterSeconds: 3 }), { status: 429 }) });
  await assert.rejects(errors.request("/item"), (e: unknown) => e instanceof ApiError && e.serverMessage === "a; b" && e.retryAfterSeconds === 3);
});
test("Retry-After supports seconds and HTTP dates, bounded and with a body fallback", () => {
  assert.equal(parseRetryAfterSeconds("Thu, 01 Jan 1970 00:00:00 GMT", 8, 0), 1);
  assert.equal(parseRetryAfterSeconds("Thu, 01 Jan 1970 00:00:10 GMT", null, 0), 10);
  assert.equal(parseRetryAfterSeconds("999999", 2), 900);
  assert.equal(parseRetryAfterSeconds("bad", "4"), 4);
  assert.equal(parseRetryAfterSeconds("-1", 4), 4);
  assert.equal(parseRetryAfterSeconds("1.5", 4), 4);
});
test("cancellation before fetch, during fetch, late success and body read stays cancellation", async () => {
  const before = new AbortController(); before.abort();
  let calls = 0;
  await assert.rejects(createApiClient({ apiUrl: base, fetchImpl: async () => { calls++; return new Response("{}"); } }).request("/item", { signal: before.signal }), isRequestCancelled);
  assert.equal(calls, 0);
  const late = new AbortController();
  await assert.rejects(createApiClient({ apiUrl: base, fetchImpl: async (_url, init) => { assert.equal(init.signal, late.signal); late.abort(); return new Response("{}"); } }).request("/item", { signal: late.signal }), isRequestCancelled);
  const during = new AbortController();
  await assert.rejects(createApiClient({ apiUrl: base, fetchImpl: async () => { during.abort(); throw Error("late failure"); } }).request("/item", { signal: during.signal }), isRequestCancelled);
  const body = new AbortController();
  await assert.rejects(createApiClient({ apiUrl: base, fetchImpl: async () => {
    const response = new Response("{}"); response.text = async () => { body.abort(); throw new DOMException("cancel", "AbortError"); }; return response;
  } }).request("/item", { signal: body.signal }), isRequestCancelled);
});
test("cache freshness, invalidation, session switching and late writes are isolated", () => {
  assert.throws(() => new QueryCache(-1), RangeError);
  const cache = new QueryCache(); const list = queryKeys.notifications.list("all", 1, 20, null);
  assert.equal(cache.write(cache.ticket(list), "anonymous", 10, 0), false);
  cache.changeSession("a"); const old = cache.ticket(list);
  assert.equal(cache.write(old, "a", 10, 0), true);
  assert.equal(cache.read(list, 9), "a"); assert.equal(cache.read(list, 10), undefined);
  cache.write(cache.ticket(list), "a", 10, 0); cache.invalidate(queryKeys.notifications.all());
  assert.equal(cache.read(list, 0), undefined); assert.equal(cache.write(old, "late", 10, 0), false);
  const pending = cache.ticket(list); cache.changeSession("b"); cache.changeSession("a");
  assert.equal(cache.write(pending, "previous session", 10, 0), false);
  cache.write(cache.ticket(list), "current", 10, 0); cache.changeSession(null);
  assert.equal(cache.read(list, 0), undefined);
});
test("guard seam waits for backend identity and clears cache at sign-out", () => {
  const boundary = createIdentityBoundary();
  assert.equal(guardDecision(boundary.snapshot()), "pending");
  assert.throws(() => boundary.acceptBackendResponse({ user: { id: "1", role: "ADMIN", status: "SUSPENDED" } }));
  boundary.acceptBackendResponse({ user: { id: "1", role: "CUSTOMER", status: "ACTIVE" } });
  assert.equal(guardDecision(boundary.snapshot(), ["CUSTOMER"]), "allow");
  assert.equal(guardDecision(boundary.snapshot(), ["ADMIN"]), "forbidden");
  boundary.clear(); assert.equal(guardDecision(boundary.snapshot()), "login");
});


test("public Auth preserves cooldown statuses and cancellation still resets its single-use challenge", async () => {
  for (const status of [401, 403, 429, 503]) {
    await assert.rejects(postAuthJson("login", {}, { apiUrl: base, fetchImpl: async () => new Response("{}", { status, headers: { "Retry-After": "7" } }) }),
      (error: unknown) => error instanceof AuthApiError && error.retryAfterSeconds === (status === 429 || status === 503 ? 7 : null));
  }
  let token: string | null = "fixture-challenge";
  let resets = 0;
  const submit = createProtectedSubmitter({ takeToken: () => { const value = token; token = null; return value; }, resetChallenge: () => { resets++; } });
  const controller = new AbortController();
  await assert.rejects(submit.submit(() => postAuthJson("login", {}, { apiUrl: base, signal: controller.signal,
    fetchImpl: async () => { controller.abort(); throw new Error("cancelled request"); } })), isRequestCancelled);
  assert.equal(resets, 1); assert.equal(token, null);
});


test("late HTTP response cannot refill invalidated cache or a different identity session", async () => {
  const boundary = createIdentityBoundary();
  const key = queryKeys.notifications.unread();
  const user = (id: string) => ({ user: { id, role: "CUSTOMER", status: "ACTIVE" } });
  for (const transition of ["invalidate", "different-user", "same-user-new-session", "logout"] as const) {
    boundary.acceptBackendResponse(user("1"));
    let resolve!: (response: Response) => void;
    const client = createApiClient({ apiUrl: base, fetchImpl: () => new Promise<Response>(done => { resolve = done; }) });
    const ticket = boundary.cache.ticket(key);
    const request = client.request("/notifications/unread-count");
    if (transition === "invalidate") boundary.cache.invalidate(queryKeys.notifications.all());
    else if (transition === "logout") boundary.clear();
    else boundary.acceptBackendResponse(user(transition === "different-user" ? "2" : "1"));
    resolve(new Response('{"unreadCount":9}'));
    const result = await request;
    assert.equal(boundary.cache.write(ticket, result.body, 10_000), false, transition);
    assert.equal(boundary.cache.read(key), undefined, transition);
  }
});

test("separate cache instances and rejected backend identities never expose a previous user's data", () => {
  const first = createIdentityBoundary(); const second = createIdentityBoundary();
  const key = queryKeys.notifications.unread();
  first.acceptBackendResponse({ user: { id: "1", role: "CUSTOMER", status: "ACTIVE" } });
  second.acceptBackendResponse({ user: { id: "2", role: "CUSTOMER", status: "ACTIVE" } });
  first.cache.write(first.cache.ticket(key), 7, 10_000);
  assert.equal(second.cache.read(key), undefined);
  assert.throws(() => first.acceptBackendResponse({ user: { id: "1", role: "CUSTOMER", status: "SUSPENDED" } }));
  assert.equal(first.cache.read(key), undefined);
  assert.equal(guardDecision(first.snapshot()), "login");
});
