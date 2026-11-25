import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptSession,
  bffRequest,
  clearClient,
  privateCache,
  snapshot,
} from "./client";
import type { SessionView } from "./model";
const view = (id: string): SessionView => ({
  generation: `generation-${id}`,
  user: {
    id,
    role: "CUSTOMER",
    status: "ACTIVE",
    email: "qa@example.test",
    fullName: "QA",
    phone: null,
    emailVerified: false,
  },
});
test("client drops late private response and cache after account switch; no mutation replay", async () => {
  const oldFetch = globalThis.fetch,
    oldWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://app.example" } },
  });
  let release: (response: Response) => void = () => {},
    calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Promise<Response>((resolve) => {
      release = resolve;
    });
  };
  try {
    acceptSession(view("1"));
    const ticket = privateCache.ticket(["account"]);
    privateCache.write(ticket, { private: "old" }, 30000);
    const pending = bffRequest("/users/me", {
      method: "PATCH",
      body: { fullName: "New" },
    });
    await Promise.resolve();
    acceptSession(view("2"));
    release(Response.json({ id: "1" }));
    await assert.rejects(
      pending,
      (error: unknown) => error instanceof Error && error.name === "AbortError",
    );
    assert.equal(calls, 1);
    assert.equal(privateCache.read(["account"]), undefined);
    assert.equal(snapshot().session?.user?.id, "2");
    const epoch = snapshot().epoch;
    acceptSession(view("2"));
    assert.equal(
      snapshot().epoch,
      epoch,
      "same identity bootstrap preserves draft mount",
    );
  } finally {
    globalThis.fetch = oldFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: oldWindow,
    });
    clearClient();
  }
});

test("uncertain logout fences bootstrap and persists a non-credential retry marker", async () => {
  const { logout, bootstrap, hasPendingLogout, connectSessionEvents } =
    await import("./client");
  const oldFetch = globalThis.fetch,
    oldWindow = globalThis.window;
  const values = new Map<string, string>(),
    reads: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "https://app.example" },
      localStorage: {
        getItem: (key: string) => {
          reads.push(key);
          return values.get(key) ?? null;
        },
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      sessionStorage: { removeItem: () => {} },
    },
  });
  let disconnect = connectSessionEvents(),
    calls = 0;
  try {
    acceptSession(view("3"));
    globalThis.fetch = async () => {
      calls++;
      throw new Error("offline");
    };
    await assert.rejects(logout());
    assert.equal(snapshot().status, "error");
    assert(hasPendingLogout());
    await bootstrap();
    assert.equal(calls, 1, "no automatic retry or old-session bootstrap");
    disconnect();
    disconnect = connectSessionEvents();
    await bootstrap();
    assert.equal(calls, 1);
    assert(
      reads.every((key) => key === "pawflow.pending-logout"),
      "legacy token is not read",
    );
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ revoked: true });
    };
    assert.equal(await logout(), true);
    assert.equal(calls, 2);
    assert.equal(values.size, 0);
    assert(!hasPendingLogout());
    acceptSession(view("4"));
    globalThis.fetch = async () =>
      Response.json({ code: "SESSION_ENDED" }, { status: 401 });
    assert.equal(
      await logout(),
      false,
      "an already-ended BFF does not prove backend revocation",
    );
    assert(!hasPendingLogout());
  } finally {
    disconnect();
    globalThis.fetch = oldFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: oldWindow,
    });
    clearClient();
  }
});

test("backend role change invalidates the private scope even with the same user and generation", () => {
  const customer = view("9");
  acceptSession(customer);
  const epoch = snapshot().epoch;
  privateCache.write(
    privateCache.ticket(["private"]),
    { value: "customer" },
    30000,
  );
  acceptSession({
    ...customer,
    user: { ...customer.user!, role: "PROVIDER_OWNER" },
  });
  assert(snapshot().epoch > epoch);
  assert.equal(privateCache.read(["private"]), undefined);
  clearClient();
});

test("a new identity epoch supersedes a pending bootstrap instead of waiting forever", async () => {
  const { bootstrap } = await import("./client");
  const oldFetch = globalThis.fetch,
    oldWindow = globalThis.window,
    descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "https://app.example" } },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  const releases: ((response: Response) => void)[] = [];
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => releases.push(resolve));
  try {
    clearClient("pending");
    const first = bootstrap();
    await Promise.resolve();
    clearClient("pending");
    const second = bootstrap();
    await Promise.resolve();
    assert.equal(releases.length, 2);
    releases[0](Response.json(view("1")));
    await first;
    assert.equal(snapshot().status, "pending");
    releases[1](Response.json(view("2")));
    await second;
    assert.equal(snapshot().session?.user?.id, "2");
  } finally {
    globalThis.fetch = oldFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: oldWindow,
    });
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    clearClient();
  }
});

test("transient revalidation keeps the draft epoch hidden until verification; 401 discards it", async () => {
  const { bootstrap } = await import("./client");
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://app.example" } } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  try {
    acceptSession(view("12"));
    const epoch = snapshot().epoch;
    globalThis.fetch = async () => { throw new Error("offline"); };
    await bootstrap();
    assert.equal(snapshot().status, "error");
    assert.equal(snapshot().epoch, epoch);
    globalThis.fetch = async () => Response.json(view("12"));
    await bootstrap();
    assert.equal(snapshot().status, "authenticated");
    assert.equal(snapshot().epoch, epoch);
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    await bootstrap();
    assert.equal(snapshot().session, null);
    assert(snapshot().epoch > epoch);
  } finally {
    globalThis.fetch = oldFetch;
    Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    clearClient();
  }
});
