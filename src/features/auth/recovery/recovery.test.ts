import assert from "node:assert/strict";
import test from "node:test";
import { recoveryTokenFromFragment } from "./fragment";
import { recoveryProxy } from "./recoveryProxy";

test("recovery links accept one opaque fragment token and reject malformed or duplicate values", () => {
  const token = "a".repeat(43);
  assert.equal(recoveryTokenFromFragment(`#token=${token}`), token);
  assert.equal(
    recoveryTokenFromFragment(`#token=${token}&token=${token}`),
    null,
  );
  assert.equal(recoveryTokenFromFragment("#token=short"), null);
  assert.equal(recoveryTokenFromFragment(""), null);
});

test("recovery proxy blocks cross-origin, unknown operations and injected fields before forwarding", async () => {
  let calls = 0;
  const upstream: typeof fetch = async () => {
    calls++;
    return new Response(null, { status: 204 });
  };
  const make = (origin: string, body: object) =>
    new Request("https://app.example/api/recovery/auth/reset-password", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await recoveryProxy(
        make("https://evil.example", {}),
        "reset-password",
        upstream,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await recoveryProxy(
        make("https://app.example", {}),
        "constructor",
        upstream,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await recoveryProxy(
        make("https://app.example", { token: "x", extra: "x" }),
        "reset-password",
        upstream,
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
});

test("recovery proxy targets the configured fixed endpoint once, passes retry metadata and filters response", async () => {
  const previous = process.env.PAWFLOW_API_URL;
  process.env.PAWFLOW_API_URL = "https://api.example/api";
  try {
    let calls = 0;
    const upstream: typeof fetch = async (url, init) => {
      calls++;
      assert.equal(url, "https://api.example/api/auth/forgot-password");
      assert.equal(init?.method, "POST");
      assert.equal(init?.cache, "no-store");
      return Response.json(
        { code: "RATE_LIMITED", retryAfterSeconds: 7, secret: "do not return" },
        { status: 429, headers: { "Retry-After": "7" } },
      );
    };
    const request = new Request(
      "https://app.example/api/recovery/auth/forgot-password",
      {
        method: "POST",
        headers: {
          origin: "https://app.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.test",
          turnstileToken: "single-use",
        }),
      },
    );
    const response = await recoveryProxy(request, "forgot-password", upstream);
    assert.equal(calls, 1);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "7");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      code: "RATE_LIMITED",
      retryAfterSeconds: 7,
    });
  } finally {
    if (previous === undefined) delete process.env.PAWFLOW_API_URL;
    else process.env.PAWFLOW_API_URL = previous;
  }
});

test("server recovery requires its own API target instead of the public client fallback", async () => {
  const previous = process.env.PAWFLOW_API_URL,
    publicPrevious = process.env.NEXT_PUBLIC_API_URL;
  delete process.env.PAWFLOW_API_URL;
  process.env.NEXT_PUBLIC_API_URL = "https://public-client.example/api";
  let calls = 0;
  try {
    const request = new Request(
      "https://app.example/api/recovery/auth/forgot-password",
      {
        method: "POST",
        headers: {
          origin: "https://app.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "qa@example.test",
          turnstileToken: "one-use",
        }),
      },
    );
    assert.equal(
      (
        await recoveryProxy(request, "forgot-password", async () => {
          calls++;
          return Response.json({});
        })
      ).status,
      503,
    );
    assert.equal(calls, 0);
  } finally {
    if (previous === undefined) delete process.env.PAWFLOW_API_URL;
    else process.env.PAWFLOW_API_URL = previous;
    if (publicPrevious === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = publicPrevious;
  }
});
