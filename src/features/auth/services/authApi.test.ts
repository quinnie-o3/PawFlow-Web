import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AuthApiError, describeAuthError, MAX_RETRY_AFTER_SECONDS, normalizeApiMessage, parseRetryAfterSeconds, resolveAuthUrl, type AuthFetch } from "./authApi";
import { loginCustomer } from "./loginCustomer";
import { registerCustomer } from "./registerCustomer";
import { FORGOT_PASSWORD_GENERIC_MESSAGE, requestPasswordReset, resetPassword } from "./passwordRecovery";
import { createProtectedSubmitter, SubmitBlockedError } from "../turnstile/protectedSubmit";
import { TURNSTILE_ACTIONS } from "../turnstile/turnstileConfig";

const API = "http://localhost:8000/api/bff";
const session = { generation: "11111111-1111-4111-8111-111111111111", user: {id:"1",role:"CUSTOMER",status:"ACTIVE",fullName:"Customer",email:"a@example.com",phone:null,emailVerified:false} };

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

function fakeFetch(responses: Array<() => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const fetchImpl: AuthFetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra request");
    return next();
  };
  return { fetchImpl, calls };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => () =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const turnstileError = (status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  json(status, { statusCode: status, error: status === 503 ? "Service Unavailable" : "Forbidden", message: "English text", code, ...extra }, headers);

async function captureError(promise: Promise<unknown>): Promise<AuthApiError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof AuthApiError, `expected AuthApiError, got ${String(error)}`);
    return error;
  }
  assert.fail("expected the request to fail");
}

function readSource(relative: string) {
  // Compiled tests run from a temp dir; resolve from the repository root (cwd).
  return readFileSync(join(process.cwd(), relative), "utf8");
}

/* ------------------------------------------------------------- contracts */

test("URL: endpoints are relative to NEXT_PUBLIC_API_URL without duplicating /api", () => {
  assert.equal(resolveAuthUrl(API, "/auth/login"), "http://localhost:8000/api/bff/auth/login");
  assert.equal(resolveAuthUrl(`${API}/`, "/auth/login"), "http://localhost:8000/api/bff/auth/login");
});

test("login: request body matches LoginDto and carries turnstileToken in the JSON body only", async () => {
  const { fetchImpl, calls } = fakeFetch([json(200, session)]);
  const result = await loginCustomer({ email: "a@example.com", password: "password1", turnstileToken: "tok-login" }, { fetchImpl, apiUrl: API });
  assert.deepEqual(result, session);
  assert.equal("accessToken" in result, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${API}/auth/login`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, undefined);
  assert.deepEqual(calls[0].body, { email: "a@example.com", password: "password1", turnstileToken: "tok-login" });
  const headers = calls[0].init.headers as Record<string, string>;
  assert.deepEqual(Object.keys(headers).sort(), ["Accept", "Content-Type"], "token is not sent as a header");
  assert.ok(!calls[0].url.includes("tok-login"), "token is not in the URL");
});

test("register: request body matches RegisterDto (fullName, email, optional phone, password, turnstileToken)", async () => {
  const { fetchImpl, calls } = fakeFetch([json(201, session), json(201, session)]);
  await registerCustomer({ fullName: "Nguyễn Văn A", email: "a@example.com", phone: " 0901234567 ", password: "password1", turnstileToken: "tok-reg" }, { fetchImpl, apiUrl: API });
  await registerCustomer({ fullName: "B", email: "b@example.com", phone: "  ", password: "password1", turnstileToken: "tok-reg-2" }, { fetchImpl, apiUrl: API });
  assert.equal(calls[0].url, `${API}/auth/register`);
  assert.deepEqual(calls[0].body, { fullName: "Nguyễn Văn A", email: "a@example.com", phone: "0901234567", password: "password1", turnstileToken: "tok-reg" });
  assert.deepEqual(calls[1].body, { fullName: "B", email: "b@example.com", password: "password1", turnstileToken: "tok-reg-2" });
});

test("forgot-password: body is {email, turnstileToken} and the UI message is generic", async () => {
  const { fetchImpl, calls } = fakeFetch([json(202, { message: "If an account with this e-mail exists..." }), json(202, { message: "anything else" })]);
  const known = await requestPasswordReset({ email: "known@example.com", turnstileToken: "tok-fp" }, { fetchImpl, apiUrl: API });
  const unknown = await requestPasswordReset({ email: "nobody@example.com", turnstileToken: "tok-fp-2" }, { fetchImpl, apiUrl: API });
  assert.equal(calls[0].url, `${API}/auth/forgot-password`);
  assert.deepEqual(calls[0].body, { email: "known@example.com", turnstileToken: "tok-fp" });
  assert.equal(known.message, FORGOT_PASSWORD_GENERIC_MESSAGE);
  assert.equal(unknown.message, known.message, "identical message whatever the address");
});

test("reset-password: reset token and Turnstile token are separate fields; 204 is success", async () => {
  const { fetchImpl, calls } = fakeFetch([json(204, null)]);
  await resetPassword({ token: "reset-link-token", newPassword: "NewPassword123", turnstileToken: "tok-rp" }, { fetchImpl, apiUrl: API });
  assert.equal(calls[0].url, `${API}/auth/reset-password`);
  assert.deepEqual(calls[0].body, { token: "reset-link-token", newPassword: "NewPassword123", turnstileToken: "tok-rp" });
  assert.notEqual(calls[0].body.token, calls[0].body.turnstileToken);
});

test("actions: constants match the backend and each form wires its own action", () => {
  assert.deepEqual(TURNSTILE_ACTIONS, { login: "login", register: "register", forgotPassword: "forgot_password", resetPassword: "reset_password" });
  assert.match(readSource("src/components/auth/LoginForm.tsx"), /useTurnstileProtectedSubmit\(TURNSTILE_ACTIONS\.login\)/);
  assert.match(readSource("src/components/auth/RegisterForm.tsx"), /useTurnstileProtectedSubmit\(TURNSTILE_ACTIONS\.register\)/);
});

/* ---------------------------------------------------------------- errors */

test("errors: TURNSTILE_REQUIRED / INVALID / EXPIRED map to Vietnamese prompts by code", async () => {
  for (const [code, pattern] of [
    ["TURNSTILE_REQUIRED", /hoàn tất bước xác minh/],
    ["TURNSTILE_INVALID", /không hợp lệ/],
    ["TURNSTILE_EXPIRED", /hết hạn/],
  ] as const) {
    const { fetchImpl } = fakeFetch([turnstileError(403, code)]);
    const error = await captureError(loginCustomer({ email: "a@example.com", password: "password1", turnstileToken: "t" }, { fetchImpl, apiUrl: API }));
    assert.equal(error.status, 403);
    assert.equal(error.code, code);
    assert.equal(error.isTurnstileError, true);
    assert.match(error.message, pattern);
    assert.ok(!error.message.includes("English"), "never shows the English server text for known codes");
  }
});

test("errors: TURNSTILE_UNAVAILABLE uses Retry-After (header first, then body)", async () => {
  const { fetchImpl } = fakeFetch([turnstileError(503, "TURNSTILE_UNAVAILABLE", { retryAfterSeconds: 5 }, { "Retry-After": "7" }), turnstileError(503, "TURNSTILE_UNAVAILABLE", { retryAfterSeconds: 5 })]);
  const withHeader = await captureError(registerCustomer({ fullName: "A B", email: "a@example.com", password: "password1", turnstileToken: "t" }, { fetchImpl, apiUrl: API }));
  assert.equal(withHeader.code, "TURNSTILE_UNAVAILABLE");
  assert.equal(withHeader.retryAfterSeconds, 7);
  assert.match(withHeader.message, /tạm thời gián đoạn.*7 giây/);
  const bodyOnly = await captureError(registerCustomer({ fullName: "A B", email: "a@example.com", password: "password1", turnstileToken: "t" }, { fetchImpl, apiUrl: API }));
  assert.equal(bodyOnly.retryAfterSeconds, 5);
});

test("errors: RATE_LIMITED reports the wait time", async () => {
  const { fetchImpl } = fakeFetch([json(429, { statusCode: 429, message: "Too many", code: "RATE_LIMITED", retryAfterSeconds: 42 }, { "Retry-After": "42" })]);
  const error = await captureError(requestPasswordReset({ email: "a@example.com", turnstileToken: "t" }, { fetchImpl, apiUrl: API }));
  assert.equal(error.code, "RATE_LIMITED");
  assert.equal(error.retryAfterSeconds, 42);
  assert.match(error.message, /quá nhiều lần.*42 giây/);
});

test("errors: validation message arrays are normalised; 401/409 keep their existing meaning", async () => {
  assert.equal(normalizeApiMessage(["email must be an email", " password too short "]), "email must be an email; password too short");
  assert.equal(normalizeApiMessage("single"), "single");
  assert.equal(normalizeApiMessage(42), null);

  const { fetchImpl } = fakeFetch([
    json(400, { statusCode: 400, message: ["email must be an email"], error: "Bad Request" }),
    json(401, { statusCode: 401, message: "Invalid credentials" }),
    json(409, { statusCode: 409, message: "Email exists" }),
    json(400, { statusCode: 400, message: "Invalid or expired password reset token" }),
  ]);
  const validation = await captureError(loginCustomer({ email: "x", password: "password1", turnstileToken: "t" }, { fetchImpl, apiUrl: API }));
  assert.equal(validation.serverMessage, "email must be an email");
  assert.match(validation.message, /chưa hợp lệ: email must be an email/);
  const credentials = await captureError(loginCustomer({ email: "a@example.com", password: "password1", turnstileToken: "t" }, { fetchImpl, apiUrl: API }));
  assert.match(credentials.message, /Email hoặc mật khẩu không đúng/);
  const duplicate = await captureError(registerCustomer({ fullName: "A B", email: "a@example.com", password: "password1", turnstileToken: "t" }, { fetchImpl, apiUrl: API }));
  assert.match(duplicate.message, /đã được sử dụng/);
  const badReset = await captureError(resetPassword({ token: "x", newPassword: "password1", turnstileToken: "t" }, { fetchImpl, apiUrl: API }));
  assert.match(badReset.message, /Liên kết đặt lại mật khẩu/);
});

test("errors: network failure and missing API URL become friendly errors", async () => {
  const offline: AuthFetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  const network = await captureError(loginCustomer({ email: "a@example.com", password: "password1", turnstileToken: "t" }, { fetchImpl: offline, apiUrl: API }));
  assert.equal(network.kind, "network");
  assert.match(network.message, /Không thể kết nối/);

  const previous = process.env.NEXT_PUBLIC_API_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
  try {
    const config = await captureError(loginCustomer({ email: "a@example.com", password: "password1", turnstileToken: "t" }, { fetchImpl: offline }));
    assert.equal(config.kind, "config");
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_API_URL = previous;
  }
});

test("Retry-After: delta-seconds, HTTP-date, body fallback, invalid values and upper bound", () => {
  const now = Date.parse("2026-11-15T10:00:00Z");
  assert.equal(parseRetryAfterSeconds("5", undefined, now), 5);
  assert.equal(parseRetryAfterSeconds("Sun, 15 Nov 2026 10:00:30 GMT", undefined, now), 30);
  assert.equal(parseRetryAfterSeconds("Sun, 15 Nov 2026 09:00:00 GMT", undefined, now), 1, "past date → minimal wait");
  assert.equal(parseRetryAfterSeconds("soon", 9, now), 9, "invalid header falls back to body");
  assert.equal(parseRetryAfterSeconds(null, "12", now), 12);
  assert.equal(parseRetryAfterSeconds(null, -3, now), null);
  assert.equal(parseRetryAfterSeconds(null, Number.POSITIVE_INFINITY, now), null);
  assert.equal(parseRetryAfterSeconds("999999999", undefined, now), MAX_RETRY_AFTER_SECONDS, "never waits forever");
  assert.equal(parseRetryAfterSeconds(null, null, now), null);
  assert.match(describeAuthError(new AuthApiError("", { kind: "http", status: 429, code: "RATE_LIMITED" }), "login"), /sau ít phút/);
});

/* ------------------------------------------------- lifecycle + refresh */

function loginHarness(responses: Array<() => Response | Promise<Response>>) {
  const { fetchImpl, calls } = fakeFetch(responses);
  let token: string | null = null;
  let resets = 0;
  const submitter = createProtectedSubmitter({
    takeToken: () => { const t = token; token = null; return t; },
    resetChallenge: () => { resets += 1; },
  });
  const attempt = () => submitter.submit((turnstileToken) => loginCustomer({ email: "a@example.com", password: "password1", turnstileToken }, { fetchImpl, apiUrl: API }));
  return { calls, attempt, solve: (t: string) => (token = t), resets: () => resets };
}

test("login lifecycle: challenge resets after a failed login and the next attempt needs a new token", async () => {
  const h = loginHarness([json(401, { statusCode: 401, message: "Invalid credentials" }), json(200, session)]);
  h.solve("token-1");
  await assert.rejects(h.attempt(), AuthApiError);
  assert.equal(h.resets(), 1);

  await assert.rejects(h.attempt(), (e: unknown) => e instanceof SubmitBlockedError && e.reason === "missing-token");
  assert.equal(h.calls.length, 1, "no request without a new token");

  h.solve("token-2");
  await h.attempt();
  assert.deepEqual(h.calls.map((c) => c.body.turnstileToken), ["token-1", "token-2"]);
  assert.equal(h.resets(), 2);
});

test("login lifecycle: 403 Turnstile errors never trigger /auth/refresh or an automatic retry", async () => {
  for (const code of ["TURNSTILE_REQUIRED", "TURNSTILE_INVALID", "TURNSTILE_EXPIRED"]) {
    const h = loginHarness([turnstileError(403, code)]);
    h.solve("token");
    await assert.rejects(h.attempt(), (e: unknown) => e instanceof AuthApiError && e.code === code);
    assert.equal(h.calls.length, 1);
    assert.ok(h.calls.every((c) => !c.url.includes("/auth/refresh")));
  }
  const h = loginHarness([turnstileError(503, "TURNSTILE_UNAVAILABLE", { retryAfterSeconds: 5 })]);
  h.solve("token");
  await assert.rejects(h.attempt(), AuthApiError);
  assert.equal(h.calls.length, 1, "503 is not silently retried with the consumed token");
});

test("registration lifecycle: duplicate submission is blocked and the challenge resets after failure", async () => {
  const { fetchImpl, calls } = fakeFetch([
    () => new Promise<Response>((resolve) => setTimeout(() => resolve(json(409, { statusCode: 409, message: "exists" })()), 5)),
  ]);
  let token: string | null = "reg-token";
  let resets = 0;
  const submitter = createProtectedSubmitter({ takeToken: () => { const t = token; token = null; return t; }, resetChallenge: () => { resets += 1; } });
  const send = (turnstileToken: string) => registerCustomer({ fullName: "A B", email: "a@example.com", password: "password1", turnstileToken }, { fetchImpl, apiUrl: API });

  const first = submitter.submit(send);
  token = "second-token";
  await assert.rejects(submitter.submit(send), (e: unknown) => e instanceof SubmitBlockedError && e.reason === "in-flight");
  await assert.rejects(first, (e: unknown) => e instanceof AuthApiError && e.status === 409);
  assert.equal(calls.length, 1);
  assert.equal(resets, 1);
});

test("security: the token is never written to storage or logged by auth code", () => {
  for (const file of [
    "src/features/auth/services/authApi.ts",
    "src/features/auth/services/loginCustomer.ts",
    "src/features/auth/services/registerCustomer.ts",
    "src/features/auth/services/passwordRecovery.ts",
    "src/features/auth/hooks/useTurnstileProtectedSubmit.ts",
    "src/components/auth/TurnstileWidget.tsx",
    "src/features/auth/turnstile/turnstileController.ts",
  ]) {
    const source = readSource(file);
    assert.ok(!/localStorage|sessionStorage|console\.(log|info|warn|error|debug)/.test(source), `${file} must not persist or log tokens`);
    assert.ok(!/TURNSTILE_SECRET/.test(source), `${file} must not reference the secret key`);
  }
});
