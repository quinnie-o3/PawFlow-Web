// HTTP policy tests with real isolated PostgreSQL and simulated upstream responses.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
const url = process.env.BFF_DATABASE_URL;
if (
  !url ||
  !/^pawflow_bff_qa(?:_|$)/.test(new URL(url).pathname.slice(1)) ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("Use an isolated local pawflow_bff_qa database");
process.env.NODE_ENV = "production";
process.env.BFF_APP_ORIGIN = "https://app.example";
process.env.PAWFLOW_API_URL = "https://api.example/api";
process.env.BFF_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const root = process.env.BFF_HTTP_BUILD || "/tmp/pawflow-account-tests/src";
const { handleBff, clientHeaders } = await import(
  path.resolve(root, "lib/server/bff/handler.js")
);
const { sessionStore } = await import(
  path.resolve(root, "lib/server/bff/store.js")
);
let calls = [],
  mode = "ok",
  release,
  entered;
const original = globalThis.fetch;
const user = {
  id: "42",
  role: "CUSTOMER",
  status: "ACTIVE",
  fullName: "HTTP QA",
  email: "qa@example.test",
  phone: null,
  emailVerified: false,
};
const backendId = randomUUID();
globalThis.fetch = async (url, init) => {
  const endpoint = new URL(url).pathname;
  calls.push([endpoint, init.method]);
  assert.equal(init.cache, "no-store");
  assert.equal(init.redirect, "error");
  if (endpoint.endsWith("/auth/login"))
    return Response.json({
      accessToken: "private-access",
      refreshToken: "a".repeat(43),
      tokenType: "Bearer",
      expiresIn: 60,
      refreshTokenExpiresAt: new Date(Date.now() + 120000).toISOString(),
      user,
    });
  if (endpoint.endsWith("/auth/me")) return Response.json({ user });
  if (endpoint.endsWith("/auth/sessions"))
    return Response.json([{ id: backendId, current: true }]);
  if (endpoint.endsWith("/users/me") && mode === "late") {
    entered();
    await new Promise((resolve) => {
      release = resolve;
    });
  }
  if (endpoint.endsWith("/users/me") && mode === "reject")
    return Response.json(
      { message: "backend private detail" },
      { status: 401 },
    );
  if (endpoint.endsWith("/users/me"))
    return Response.json({ ...user, accessToken: "must never reach browser" });
  if (endpoint.endsWith("/auth/logout"))
    return new Response(null, { status: 204 });
  throw new Error("Unexpected upstream operation");
};
let cookie = "",
  generation = "";
function request(path, method = "POST", body = {}, headers = {}) {
  return handleBff(
    new Request("https://app.example/api/bff/" + path, {
      method,
      headers: {
        origin: "https://app.example",
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
        cookie,
        "x-bff-generation": generation,
        ...headers,
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    }),
    path,
  );
}
async function login() {
  const init = await request("session");
  cookie = init.headers.get("set-cookie").split(";")[0];
  assert.match(init.headers.get("set-cookie"), /HttpOnly/);
  assert.match(init.headers.get("set-cookie"), /Secure/);
  assert.match(init.headers.get("set-cookie"), /SameSite=Lax/);
  assert(cookie.startsWith("__Host-"));
  generation = (await init.json()).generation;
  const auth = await request("auth/login", "POST", {
    email: "qa@example.test",
    password: "not-a-real-password",
    turnstileToken: "single-use",
  });
  assert.equal(auth.status, 200);
  const value = await auth.text();
  assert(!value.includes("accessToken"));
  assert(!value.includes("refreshToken"));
  assert(!value.includes("private-access"));
  const previousCookie = cookie, previousGeneration = generation;
  cookie = auth.headers.get("set-cookie").split(";")[0];
  generation = JSON.parse(value).generation;
  assert.notEqual(cookie, previousCookie);
  assert.notEqual(generation, previousGeneration);
  assert.equal((await request("users/me", "GET", {}, { cookie: previousCookie, "x-bff-generation": previousGeneration })).status, 401);
  return { value, previousCookie, previousGeneration };
}
try {
  const forged = new Request("https://app.example", {
    headers: {
      "x-forwarded-for": "203.0.113.8",
      "x-pawflow-client-ip": "203.0.113.9",
    },
  });
  assert.equal(clientHeaders(forged)["X-Forwarded-For"], undefined);
  process.env.BFF_TRUST_PROXY_HEADERS = "true";
  assert.equal(clientHeaders(forged)["X-Forwarded-For"], "203.0.113.9");
  assert.throws(() =>
    clientHeaders(
      new Request("https://app.example", {
        headers: { "x-pawflow-client-ip": "203.0.113.9, 203.0.113.8" },
      }),
    ),
  );
  delete process.env.BFF_TRUST_PROXY_HEADERS;
  console.log(
    "PASS client-IP forwarding is opt-in and accepts one ingress-normalized IP",
  );
  assert.equal(
    (await request("session", "POST", {}, { origin: "https://evil.example" }))
      .status,
    403,
  );
  assert.equal(
    (await request("session", "POST", {}, { "sec-fetch-site": "cross-site" }))
      .status,
    403,
  );
  assert.equal(
    (await request("session", "POST", { large: "x".repeat(17000) })).status,
    413,
  );
  assert.equal(calls.length, 0);
  console.log("PASS origin, Fetch Metadata and body bounds before upstream");
  await login();
  console.log(
    "PASS opaque secure cookie and login identity projection without tokens",
  );
  let result = await request("users/me", "GET");
  assert.equal(result.status, 200);
  assert.match(result.headers.get("cache-control"), /no-store/);
  assert(!(await result.text()).includes("accessToken"));
  const count = calls.length;
  assert.equal((await request("arbitrary-host", "GET")).status, 404);
  assert.equal(
    (await request("users/me", "PATCH", { role: "ADMIN" })).status,
    400,
  );
  assert.equal(
    (await request("users/me", "GET", {}, { "x-bff-generation": randomUUID() }))
      .status,
    401,
  );
  assert.equal(calls.length, count);
  console.log(
    "PASS response projection, operation/field allowlist and generation fence",
  );
  mode = "reject";
  const before = calls.length;
  result = await request("users/me", "PATCH", { fullName: "Draft kept" });
  assert.equal(result.status, 401);
  assert.equal(calls.length, before + 1);
  assert(!(await result.text()).includes("private detail"));
  console.log(
    "PASS failed mutation has one upstream call, no retry and sanitized error",
  );
  mode = "ok";
  const rotation = await login();
  assert.equal((await request("auth/logout", "POST", {}, { cookie: rotation.previousCookie, "x-bff-generation": rotation.previousGeneration })).status, 200);
  assert.equal((await request("users/me", "GET")).status, 401);
  console.log("PASS pre-login logout fences rotated successor without authorizing old cookie");
  await login();
  mode = "late";
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const late = request("users/me", "GET");
  await started;
  assert.equal((await request("auth/logout")).status, 200);
  assert.equal((await (await request("auth/logout")).json()).revoked, false);
  release();
  assert.equal((await late).status, 401);
  console.log("PASS late private response rejected after logout");
} finally {
  globalThis.fetch = original;
  await sessionStore().pool.end();
}
