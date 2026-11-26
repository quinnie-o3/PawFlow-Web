import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, isRequestCancelled } from "../../lib/api/errors";
import {
  QueryCache,
  queryFreshness,
  queryKeys,
} from "../../lib/api/queryCache";
import {
  handleBff,
  type BffHandlerDeps,
} from "../../lib/server/bff/handler";
import {
  SessionBusy,
  SessionEnded,
  sessionHash,
  type Session,
} from "../../lib/server/bff/store";
import {
  acceptSession,
  clearClient,
  privateCache,
  snapshot,
} from "../session/client";
import type { SessionView } from "../session/model";
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_KEY_PATTERN,
  IDEMPOTENT_REPLAYED_HEADER,
  LiveBookingApiError,
  bookingRequestFingerprint,
  classifyBookingError,
  createCustomerBookingApi,
  createIdempotencyKey,
  decodeCreateBookingResult,
  decodeCustomerBooking,
  decodeCustomerBookingDetail,
  decodeCustomerBookings,
  decodePublicAvailabilitySlot,
  isValidIdempotencyKey,
  normalizeBookingNote,
} from "./liveApi";

const APP_ORIGIN = "https://app.example";
const UPSTREAM_API = "https://api.example/api";
const COOKIE_VALUE = "a".repeat(43);
const GENERATION = "11111111-1111-4111-8111-111111111111";
const VALID_KEY = "3f0c8a52-6c1e-4f5b-9a7e-2d4b8c1e9f00";

const customerView = (
  id = "20",
  generation = GENERATION,
): SessionView => ({
  generation,
  user: {
    id,
    role: "CUSTOMER",
    status: "ACTIVE",
    email: "customer@example.test",
    fullName: "Customer QA",
    phone: null,
    emailVerified: true,
  },
});

const rawBookingFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "9007199254740993",
  status: "PENDING_CONFIRMATION",
  bookedPrice: "150000.00",
  customerNote: "Please be gentle",
  createdAt: "2026-11-02T07:05:30.250Z",
  updatedAt: "2026-11-02T07:05:30.250Z",
  service: {
    id: "5",
    name: "Full grooming",
    durationMinutes: 60,
  },
  slot: {
    id: "12",
    slotDate: "2026-11-05",
    startTime: "09:00:00",
    endTime: "10:00:00",
  },
  pet: {
    id: "8",
    name: "Milo",
    breed: "Corgi",
    petType: { id: "1", name: "Dog" },
  },
  provider: {
    id: "3",
    businessName: "Paw Spa",
    address: "1 Nguyen Hue, District 1",
  },
  ...overrides,
});

const rawBookingDetailFixture = (overrides: Record<string, unknown> = {}) => ({
  ...rawBookingFixture(overrides),
  statusLogs: [
    {
      id: "77",
      oldStatus: null,
      newStatus: "PENDING_CONFIRMATION",
      reason: null,
      createdAt: "2026-11-02T07:05:30.250Z",
    },
  ],
});

const rawPublicSlotFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "12",
  slotDate: "2026-12-01",
  startTime: "09:00:00",
  endTime: "10:00:00",
  capacity: 3,
  bookedCount: 1,
  service: {
    id: "5",
    name: "Full grooming",
    description: null,
    price: "150000.00",
    durationMinutes: 60,
    category: { id: "1", name: "Grooming", description: null },
  },
  provider: {
    id: "3",
    businessName: "Paw Spa",
    address: "1 Nguyen Hue, District 1",
    description: null,
    ratingAvg: "4.50",
    ratingCount: 2,
  },
  ...overrides,
});

function createFakeBffStore(
  options: {
    active?: boolean;
    busy?: boolean;
    revoked?: boolean;
  } = {},
): NonNullable<BffHandlerDeps["store"]> & { revokedCalls: number } {
  const row: Session = {
    id_hash: sessionHash(COOKIE_VALUE),
    generation: GENERATION,
    previous_id_hash: null,
    previous_generation: null,
    state: options.revoked ? "revoked" : "active",
    user_id: "20",
    backend_session_id: "22222222-2222-4222-8222-222222222222",
    tokens: "sealed",
    access_expires_at: new Date(Date.now() + 60_000),
    expires_at: new Date(Date.now() + 300_000),
    operation_id: null,
    lease_until: null,
  };
  let isRevoked = Boolean(options.revoked);
  const store: NonNullable<BffHandlerDeps["store"]> & { revokedCalls: number } =
    {
      revokedCalls: 0,
      async read(id: string) {
        if (options.active === false) return null;
        return id === row.id_hash
          ? { ...row, state: isRevoked ? "revoked" : row.state }
          : null;
      },
      async create() {
        return { cookie: COOKIE_VALUE, row };
      },
      async access() {
        if (options.busy) throw new SessionBusy();
        if (isRevoked) throw new SessionEnded();
        return row;
      },
      open() {
        return {
          accessToken: "secret-upstream-jwt",
          refreshToken: "r".repeat(43),
        };
      },
      async assertCurrent() {
        if (isRevoked) throw new SessionEnded();
      },
      async revoke() {
        isRevoked = true;
        store.revokedCalls++;
      },
      async end() {
        isRevoked = true;
        return row;
      },
      async beginLogin() {
        return row;
      },
      async activate() {
        return { row, cookie: COOKIE_VALUE };
      },
      async failLogin() {},
      async revokeUser() {
        isRevoked = true;
      },
      async revokeBackend() {
        isRevoked = true;
      },
    };
  return store;
}

type UpstreamCall = {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
};

async function withLiveBffHarness(
  upstreamHandler: (call: UpstreamCall) => Promise<Response> | Response,
  run: (ctx: {
    upstreamCalls: UpstreamCall[];
    store: ReturnType<typeof createFakeBffStore>;
    api: ReturnType<typeof createCustomerBookingApi>;
  }) => Promise<void>,
  storeOptions?: Parameters<typeof createFakeBffStore>[0],
) {
  const oldFetch = globalThis.fetch;
  const oldWindow = globalThis.window;
  const oldApiUrl = process.env.PAWFLOW_API_URL;
  const oldOrigin = process.env.BFF_APP_ORIGIN;
  const store = createFakeBffStore(storeOptions);
  const upstreamCalls: UpstreamCall[] = [];

  process.env.PAWFLOW_API_URL = UPSTREAM_API;
  process.env.BFF_APP_ORIGIN = APP_ORIGIN;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: APP_ORIGIN } },
  });
  acceptSession(customerView());

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(`${APP_ORIGIN}/api/bff/`)) {
      const bffPath = url.slice(`${APP_ORIGIN}/api/bff/`.length);
      const headers = new Headers(init?.headers);
      headers.set("origin", APP_ORIGIN);
      headers.set("sec-fetch-site", "same-origin");
      headers.set("cookie", `pawflow-session=${COOKIE_VALUE}`);
      const bffReq = new Request(url, {
        method: init?.method ?? "GET",
        headers,
        body: init?.body,
      });
      return handleBff(bffReq, bffPath, { store });
    }
    if (url.startsWith(UPSTREAM_API)) {
      const call: UpstreamCall = {
        url,
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? init.body : null,
      };
      upstreamCalls.push(call);
      return upstreamHandler(call);
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const api = createCustomerBookingApi();
    await run({ upstreamCalls, store, api });
  } finally {
    globalThis.fetch = oldFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: oldWindow,
    });
    if (oldApiUrl === undefined) delete process.env.PAWFLOW_API_URL;
    else process.env.PAWFLOW_API_URL = oldApiUrl;
    if (oldOrigin === undefined) delete process.env.BFF_APP_ORIGIN;
    else process.env.BFF_APP_ORIGIN = oldOrigin;
    clearClient();
  }
}

test("idempotency key generation, validation, note normalization, and canonical fingerprint", () => {
  const first = createIdempotencyKey();
  const second = createIdempotencyKey();
  assert.match(first, IDEMPOTENCY_KEY_PATTERN);
  assert.match(second, IDEMPOTENCY_KEY_PATTERN);
  assert.notEqual(first, second);
  assert.equal(isValidIdempotencyKey(VALID_KEY), true);
  assert.equal(isValidIdempotencyKey("a".repeat(16)), true);
  assert.equal(isValidIdempotencyKey("a".repeat(128)), true);
  for (const invalid of [
    "",
    "short-key",
    "a".repeat(15),
    "a".repeat(129),
    "3f0c8a52-6c1e-4f5b-9a7e-2d4b8c1e9f00, other",
    "3f0c8a52 6c1e 4f5b 9a7e 2d4b8c1e9f00",
    1234567890123456,
  ]) {
    assert.equal(isValidIdempotencyKey(invalid), false);
  }
  assert.equal(normalizeBookingNote(undefined), null);
  assert.equal(normalizeBookingNote(null), null);
  assert.equal(normalizeBookingNote("   "), null);
  assert.equal(normalizeBookingNote("  Gentle please  "), "Gentle please");
  assert.equal(
    bookingRequestFingerprint({ petId: "8", slotId: "12", customerNote: "   " }),
    bookingRequestFingerprint({ petId: "8", slotId: "12", customerNote: null }),
  );
  assert.equal(
    bookingRequestFingerprint({ petId: "8", slotId: "12", customerNote: " hi " }),
    bookingRequestFingerprint({ petId: "8", slotId: "12", customerNote: "hi" }),
  );
});

test("queryCache booking keys keep freshness 0 and isolate prefix invalidations", () => {
  assert.equal(queryFreshness.bookings, 0);
  assert.equal(queryFreshness.availability, 0);
  assert.deepEqual(queryKeys.bookings.all(), ["v1", "bookings"]);
  assert.deepEqual(queryKeys.bookings.mine(), ["v1", "bookings", "mine", "list"]);
  assert.deepEqual(queryKeys.bookings.detail("42"), [
    "v1",
    "bookings",
    "mine",
    "detail",
    "42",
  ]);

  const cache = new QueryCache();
  cache.changeSession("20");
  cache.write(cache.ticket(queryKeys.bookings.mine()), ["list"], 30_000, 0);
  cache.write(cache.ticket(queryKeys.bookings.detail("1")), "one", 30_000, 0);
  cache.write(cache.ticket(queryKeys.bookings.detail("10")), "ten", 30_000, 0);
  cache.write(cache.ticket(queryKeys.notifications.unread()), 3, 30_000, 0);

  cache.invalidate(queryKeys.bookings.detail("1"));
  assert.equal(cache.read(queryKeys.bookings.detail("1"), 0), undefined);
  assert.equal(cache.read(queryKeys.bookings.detail("10"), 0), "ten");
  assert.deepEqual(cache.read(queryKeys.bookings.mine(), 0), ["list"]);

  cache.invalidate(queryKeys.bookings.all());
  assert.equal(cache.read(queryKeys.bookings.mine(), 0), undefined);
  assert.equal(cache.read(queryKeys.bookings.detail("10"), 0), undefined);
  assert.equal(cache.read(queryKeys.notifications.unread(), 0), 3);
});

test("decoders preserve BIGINT IDs, numeric prices, and reject unsafe shapes or replay mismatches", () => {
  const decoded = decodeCustomerBooking(rawBookingFixture());
  assert.equal(decoded.id, "9007199254740993");
  assert.equal(decoded.bookedPrice, "150000.00");
  assert.equal(decoded.service.durationMinutes, 60);

  const detail = decodeCustomerBookingDetail(
    rawBookingDetailFixture(),
    "9007199254740993",
  );
  assert.equal(detail.statusLogs.length, 1);
  assert.equal(detail.statusLogs[0].oldStatus, null);

  assert.throws(() =>
    decodeCustomerBookingDetail(rawBookingDetailFixture(), "999"),
  );
  assert.throws(() =>
    decodeCustomerBookings([rawBookingFixture(), rawBookingFixture()]),
  );

  for (const invalid of [
    rawBookingFixture({ id: 42 }),
    rawBookingFixture({ id: "9223372036854775808" }),
    rawBookingFixture({ bookedPrice: 150000 }),
    rawBookingFixture({ bookedPrice: "150000.5" }),
    rawBookingFixture({ status: "UNKNOWN" }),
    rawBookingFixture({ createdAt: "not-a-date" }),
    rawBookingFixture({
      slot: {
        id: "12",
        slotDate: "2026-02-30",
        startTime: "09:00:00",
        endTime: "10:00:00",
      },
    }),
    rawBookingFixture({
      slot: {
        id: "12",
        slotDate: "2026-11-05",
        startTime: "10:00:00",
        endTime: "09:00:00",
      },
    }),
  ]) {
    assert.throws(() => decodeCustomerBooking(invalid));
  }

  const fromBody = decodeCreateBookingResult({
    ...rawBookingFixture(),
    idempotentReplayed: true,
  });
  assert.equal(fromBody.idempotentReplayed, true);
  assert.equal("idempotentReplayed" in fromBody.booking, false);

  const fromHeader = decodeCreateBookingResult(
    rawBookingFixture(),
    new Headers({ [IDEMPOTENT_REPLAYED_HEADER]: "true" }),
  );
  assert.equal(fromHeader.idempotentReplayed, true);

  const defaultFalse = decodeCreateBookingResult(rawBookingFixture());
  assert.equal(defaultFalse.idempotentReplayed, false);

  assert.throws(() =>
    decodeCreateBookingResult(
      { ...rawBookingFixture(), idempotentReplayed: true },
      new Headers({ [IDEMPOTENT_REPLAYED_HEADER]: "false" }),
    ),
  );
  assert.throws(() =>
    decodeCreateBookingResult({
      ...rawBookingFixture(),
      idempotentReplayed: "true",
    }),
  );
  assert.throws(() =>
    decodeCreateBookingResult(
      rawBookingFixture(),
      new Headers({ [IDEMPOTENT_REPLAYED_HEADER]: "yes" }),
    ),
  );
});

test("POST /bookings through real bffRequest + handleBff forwards Idempotency-Key, reads Idempotent-Replayed, and strips secret fields", async () => {
  let replayMode: "false" | "true" | "absent" = "false";
  await withLiveBffHarness(
    (call) => {
      assert.equal(call.method, "POST");
      assert.equal(call.url, `${UPSTREAM_API}/bookings`);
      assert.equal(call.headers.get("authorization"), "Bearer secret-upstream-jwt");
      const headers = new Headers();
      if (replayMode !== "absent") {
        headers.set(IDEMPOTENT_REPLAYED_HEADER, replayMode);
      }
      return Response.json(
        {
          ...rawBookingFixture({ customerNote: "Trimmed" }),
          customerId: "20",
          accessToken: "must-not-leak",
          provider: {
            id: "3",
            businessName: "Paw Spa",
            address: "1 Nguyen Hue",
            phone: "0900000000",
            ownerId: "99",
          },
          pet: {
            id: "8",
            ownerId: "20",
            name: "Milo",
            breed: "Corgi",
            petType: { id: "1", name: "Dog", extra: "hidden" },
          },
          slot: {
            id: "12",
            slotDate: "2026-11-05",
            startTime: "09:00:00",
            endTime: "10:00:00",
            capacity: 5,
            bookedCount: 1,
          },
        },
        { status: 201, headers },
      );
    },
    async ({ upstreamCalls, api }) => {
      const created = await api.createBooking(
        { petId: "8", slotId: "12", customerNote: "  Trimmed  " },
        { idempotencyKey: VALID_KEY },
      );
      assert.equal(created.idempotentReplayed, false);
      assert.equal(created.booking.id, "9007199254740993");
      assert.equal(created.booking.customerNote, "Trimmed");
      assert.equal("idempotentReplayed" in created.booking, false);
      assert.equal("customerId" in created.booking, false);
      assert.equal("phone" in created.booking.provider, false);
      assert.equal("ownerId" in created.booking.pet, false);
      assert.equal("capacity" in created.booking.slot, false);
      assert.equal(upstreamCalls[0].headers.get(IDEMPOTENCY_KEY_HEADER), VALID_KEY);
      assert.deepEqual(JSON.parse(upstreamCalls[0].body!), {
        petId: "8",
        slotId: "12",
        customerNote: "Trimmed",
      });

      replayMode = "true";
      const replayed = await api.createBooking(
        { petId: "8", slotId: "12", customerNote: "Trimmed" },
        { idempotencyKey: VALID_KEY },
      );
      assert.equal(replayed.idempotentReplayed, true);
      assert.equal(replayed.booking.id, created.booking.id);

      replayMode = "absent";
      const noHeader = await api.createBooking({ petId: "8", slotId: "12" });
      assert.equal(noHeader.idempotentReplayed, false);
      assert.equal(upstreamCalls[2].headers.get(IDEMPOTENCY_KEY_HEADER), null);
    },
  );
});

test("handleBff attaches Idempotent-Replayed HTTP header and JSON field only on POST bookings when upstream sends it", async () => {
  const oldFetch = globalThis.fetch;
  const oldApiUrl = process.env.PAWFLOW_API_URL;
  const oldOrigin = process.env.BFF_APP_ORIGIN;
  process.env.PAWFLOW_API_URL = UPSTREAM_API;
  process.env.BFF_APP_ORIGIN = APP_ORIGIN;
  const store = createFakeBffStore();
  let sendHeader: string | null = "true";

  globalThis.fetch = async () =>
    Response.json(rawBookingFixture(), {
      status: 201,
      headers: sendHeader ? { [IDEMPOTENT_REPLAYED_HEADER]: sendHeader } : {},
    });

  const makeReq = (path: string, method: string, body?: unknown, headers?: Record<string, string>) =>
    handleBff(
      new Request(`${APP_ORIGIN}/api/bff/${path}`, {
        method,
        headers: {
          origin: APP_ORIGIN,
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
          cookie: `pawflow-session=${COOKIE_VALUE}`,
          "x-bff-generation": GENERATION,
          ...headers,
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
      }),
      path,
      { store },
    );

  try {
    const withReplay = await makeReq(
      "bookings",
      "POST",
      { petId: "8", slotId: "12" },
      { [IDEMPOTENCY_KEY_HEADER]: VALID_KEY },
    );
    assert.equal(withReplay.status, 201);
    assert.equal(withReplay.headers.get(IDEMPOTENT_REPLAYED_HEADER), "true");
    const withReplayBody = (await withReplay.json()) as Record<string, unknown>;
    assert.equal(withReplayBody.idempotentReplayed, true);

    sendHeader = null;
    const withoutHeader = await makeReq("bookings", "POST", {
      petId: "8",
      slotId: "12",
    });
    assert.equal(withoutHeader.status, 201);
    assert.equal(withoutHeader.headers.get(IDEMPOTENT_REPLAYED_HEADER), null);
    const withoutHeaderBody = (await withoutHeader.json()) as Record<string, unknown>;
    assert.equal("idempotentReplayed" in withoutHeaderBody, false);

    sendHeader = "invalid-boolean";
    const badHeader = await makeReq(
      "bookings",
      "POST",
      { petId: "8", slotId: "12" },
      { [IDEMPOTENCY_KEY_HEADER]: VALID_KEY },
    );
    assert.equal(badHeader.status, 503);

    // Non-allowlisted paths, extra fields, and invalid Idempotency-Key fail before upstream.
    let upstreamHit = false;
    globalThis.fetch = async () => {
      upstreamHit = true;
      return Response.json({});
    };
    assert.equal(
      (await makeReq("bookings", "POST", { petId: "8", slotId: "12", bookedPrice: "0.00" })).status,
      400,
    );
    assert.equal(
      (
        await makeReq(
          "bookings",
          "POST",
          { petId: "8", slotId: "12" },
          { [IDEMPOTENCY_KEY_HEADER]: "short" },
        )
      ).status,
      400,
    );
    assert.equal(
      (await makeReq("bookings/mine/12/cancel", "POST", { status: "CANCELLED" })).status,
      400,
    );
    for (const [path, method] of [
      ["bookings", "GET"],
      ["bookings/provider", "GET"],
      ["bookings/mine/0", "GET"],
      ["bookings/mine/9223372036854775808", "GET"],
      ["bookings/mine/12", "DELETE"],
    ] as const) {
      assert.equal((await makeReq(path, method)).status, 404, `${method} ${path}`);
    }
    assert.equal(upstreamHit, false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldApiUrl === undefined) delete process.env.PAWFLOW_API_URL;
    else process.env.PAWFLOW_API_URL = oldApiUrl;
    if (oldOrigin === undefined) delete process.env.BFF_APP_ORIGIN;
    else process.env.BFF_APP_ORIGIN = oldOrigin;
  }
});

test("listMyBookings, getMyBookingDetail, and cancelMyBooking enforce IDs, strip secrets, and fence stale reads", async () => {
  let resolveSlowList!: (response: Response) => void;
  let slowMode = false;

  await withLiveBffHarness(
    (call) => {
      if (call.method === "GET" && call.url === `${UPSTREAM_API}/bookings/mine`) {
        if (slowMode) {
          return new Promise<Response>((resolve) => {
            resolveSlowList = resolve;
          });
        }
        return Response.json([rawBookingFixture()]);
      }
      if (
        call.method === "GET" &&
        call.url === `${UPSTREAM_API}/bookings/mine/9007199254740993`
      ) {
        return Response.json({
          ...rawBookingDetailFixture(),
          statusLogs: [
            {
              id: "77",
              oldStatus: null,
              newStatus: "PENDING_CONFIRMATION",
              changedBy: "20",
              reason: null,
              createdAt: "2026-11-02T07:05:30.250Z",
            },
          ],
        });
      }
      if (
        call.method === "POST" &&
        call.url === `${UPSTREAM_API}/bookings/mine/9007199254740993/cancel`
      ) {
        return Response.json(rawBookingFixture({ status: "CANCELLED" }), {
          status: 201,
        });
      }
      throw new Error(`Unexpected upstream call: ${call.method} ${call.url}`);
    },
    async ({ upstreamCalls, api }) => {
      const list = await api.listMyBookings();
      assert.equal(list.length, 1);
      assert.equal(list[0].id, "9007199254740993");
      assert.equal(privateCache.read(queryKeys.bookings.mine()), undefined);

      const detail = await api.getMyBookingDetail("9007199254740993");
      assert.equal(detail.statusLogs[0].id, "77");
      assert.equal("changedBy" in detail.statusLogs[0], false);

      // Start a slow list read, then cancel a booking before the read resolves.
      slowMode = true;
      const staleRead = api.listMyBookings();
      await Promise.resolve();
      const cancelled = await api.cancelMyBooking("9007199254740993", {
        reason: "  Schedule changed  ",
      });
      assert.equal(cancelled.status, "CANCELLED");
      const cancelCall = upstreamCalls.find((c) => c.url.endsWith("/cancel"));
      assert.deepEqual(JSON.parse(cancelCall!.body!), {
        reason: "Schedule changed",
      });

      resolveSlowList(Response.json([rawBookingFixture({ status: "PENDING_CONFIRMATION" })]));
      await assert.rejects(staleRead, isRequestCancelled);

      // Invalid IDs fail client-side without calling fetch.
      const countBefore = upstreamCalls.length;
      await assert.rejects(
        api.getMyBookingDetail("../provider/1"),
        (e: unknown) => e instanceof LiveBookingApiError && e.code === "INVALID_INPUT",
      );
      await assert.rejects(
        api.cancelMyBooking("0"),
        (e: unknown) => e instanceof LiveBookingApiError && e.code === "INVALID_INPUT",
      );
      await assert.rejects(
        api.createBooking({ petId: "abc", slotId: "12" }),
        (e: unknown) => e instanceof LiveBookingApiError && e.code === "INVALID_INPUT",
      );
      await assert.rejects(
        api.createBooking({ petId: "8", slotId: "12" }, { idempotencyKey: "bad" }),
        (e: unknown) =>
          e instanceof LiveBookingApiError && e.code === "INVALID_IDEMPOTENCY_KEY",
      );
      assert.equal(upstreamCalls.length, countBefore);
    },
  );
});

test("BFF sanitizes upstream errors and liveApi classifies all booking conflicts, rate limits, and uncertain outcomes without auto-retry", async () => {
  const cases: Array<{
    name: string;
    operation: "create" | "cancel" | "detail";
    response: () => Response | Promise<Response>;
    expectedCode: string;
    expectedOutcome: "definite-failure" | "in-progress" | "unknown";
    expectedCategory: string;
    canRetryWithSameKey: boolean;
    shouldRefreshAvailability: boolean;
    shouldRefreshBookings: boolean;
    retryAfter?: number | null;
  }> = [
    {
      name: "VT-02/VT-09 409 slot full",
      operation: "create",
      response: () =>
        Response.json(
          { statusCode: 409, message: "Availability slot is full", error: "Conflict" },
          { status: 409 },
        ),
      expectedCode: "SLOT_FULL",
      expectedOutcome: "definite-failure",
      expectedCategory: "availability",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: true,
      shouldRefreshBookings: false,
    },
    {
      name: "409 slot closed",
      operation: "create",
      response: () =>
        Response.json(
          { message: "Availability slot is not open for booking" },
          { status: 409 },
        ),
      expectedCode: "SLOT_CLOSED",
      expectedOutcome: "definite-failure",
      expectedCategory: "availability",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: true,
      shouldRefreshBookings: false,
    },
    {
      name: "409 outside working hours",
      operation: "create",
      response: () =>
        Response.json(
          {
            message:
              "The selected availability slot is outside the provider's working hours",
          },
          { status: 409 },
        ),
      expectedCode: "SLOT_OUTSIDE_WORKING_HOURS",
      expectedOutcome: "definite-failure",
      expectedCategory: "availability",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: true,
      shouldRefreshBookings: false,
    },
    {
      name: "409 slot too short",
      operation: "create",
      response: () =>
        Response.json(
          {
            message:
              "The selected availability slot is shorter than the service duration",
          },
          { status: 409 },
        ),
      expectedCode: "SLOT_TOO_SHORT",
      expectedOutcome: "definite-failure",
      expectedCategory: "availability",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: true,
      shouldRefreshBookings: false,
    },
    {
      name: "409 idempotency in progress",
      operation: "create",
      response: () =>
        Response.json(
          {
            message:
              "A booking request with this Idempotency-Key is still being processed; retry the same request",
          },
          { status: 409 },
        ),
      expectedCode: "IDEMPOTENCY_IN_PROGRESS",
      expectedOutcome: "in-progress",
      expectedCategory: "idempotency",
      canRetryWithSameKey: true,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: true,
    },
    {
      name: "409 idempotency conflict",
      operation: "create",
      response: () =>
        Response.json(
          {
            message:
              "This Idempotency-Key was already used for a different booking request",
          },
          { status: 409 },
        ),
      expectedCode: "IDEMPOTENCY_CONFLICT",
      expectedOutcome: "definite-failure",
      expectedCategory: "idempotency",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: true,
    },
    {
      name: "400 slot already started",
      operation: "create",
      response: () =>
        Response.json(
          { message: "The selected availability slot has already started" },
          { status: 400 },
        ),
      expectedCode: "SLOT_STARTED",
      expectedOutcome: "definite-failure",
      expectedCategory: "availability",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: true,
      shouldRefreshBookings: false,
    },
    {
      name: "404 pet unavailable",
      operation: "create",
      response: () =>
        Response.json(
          { message: "Active pet belonging to the customer was not found" },
          { status: 404 },
        ),
      expectedCode: "PET_UNAVAILABLE",
      expectedOutcome: "definite-failure",
      expectedCategory: "availability",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: false,
    },
    {
      name: "VT-04 404 another customer's booking",
      operation: "detail",
      response: () =>
        Response.json({ message: "Booking not found" }, { status: 404 }),
      expectedCode: "BOOKING_NOT_FOUND",
      expectedOutcome: "definite-failure",
      expectedCategory: "not-found",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: true,
    },
    {
      name: "403 non-customer role",
      operation: "create",
      response: () =>
        Response.json({ message: "Forbidden resource" }, { status: 403 }),
      expectedCode: "CUSTOMER_REQUIRED",
      expectedOutcome: "definite-failure",
      expectedCategory: "permission",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: false,
    },
    {
      name: "429 rate limited preserves Retry-After",
      operation: "create",
      response: () =>
        Response.json(
          { code: "RATE_LIMITED", retryAfterSeconds: 45 },
          { status: 429, headers: { "Retry-After": "45" } },
        ),
      expectedCode: "RATE_LIMITED",
      expectedOutcome: "definite-failure",
      expectedCategory: "rate-limit",
      canRetryWithSameKey: true,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: false,
      retryAfter: 45,
    },
    {
      name: "503 rate limit store unavailable stays definite-failure",
      operation: "create",
      response: () =>
        Response.json(
          { code: "RATE_LIMIT_UNAVAILABLE", retryAfterSeconds: 10 },
          { status: 503, headers: { "Retry-After": "10" } },
        ),
      expectedCode: "RATE_LIMIT_UNAVAILABLE",
      expectedOutcome: "definite-failure",
      expectedCategory: "rate-limit",
      canRetryWithSameKey: true,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: false,
      retryAfter: 10,
    },
    {
      name: "503 generic upstream error on create has unknown outcome",
      operation: "create",
      response: () =>
        Response.json(
          { message: "internal secret stack trace" },
          { status: 503 },
        ),
      expectedCode: "SERVER_ERROR",
      expectedOutcome: "unknown",
      expectedCategory: "uncertain",
      canRetryWithSameKey: true,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: true,
    },
    {
      name: "409 cancel status conflict",
      operation: "cancel",
      response: () =>
        Response.json(
          {
            message:
              "Only pending confirmation or confirmed bookings can be cancelled",
          },
          { status: 409 },
        ),
      expectedCode: "CANCEL_STATUS",
      expectedOutcome: "definite-failure",
      expectedCategory: "conflict",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: true,
    },
    {
      name: "BR-07 409 cancel at or after appointment start",
      operation: "cancel",
      response: () =>
        Response.json(
          {
            statusCode: 409,
            message:
              "Bookings can only be cancelled before the appointment starts",
            error: "Conflict",
          },
          { status: 409 },
        ),
      expectedCode: "CANCEL_TIME",
      expectedOutcome: "definite-failure",
      expectedCategory: "conflict",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: true,
    },
    {
      name: "500 cancel error has unknown outcome and never retries with idempotency key",
      operation: "cancel",
      response: () =>
        Response.json({ message: "db reset" }, { status: 500 }),
      expectedCode: "SERVER_ERROR",
      expectedOutcome: "unknown",
      expectedCategory: "uncertain",
      canRetryWithSameKey: false,
      shouldRefreshAvailability: false,
      shouldRefreshBookings: true,
    },
  ];

  for (const tc of cases) {
    await withLiveBffHarness(
      () => tc.response(),
      async ({ upstreamCalls, api }) => {
        const action =
          tc.operation === "create"
            ? () =>
                api.createBooking(
                  { petId: "8", slotId: "12" },
                  { idempotencyKey: VALID_KEY },
                )
            : tc.operation === "cancel"
              ? () => api.cancelMyBooking("9007199254740993")
              : () => api.getMyBookingDetail("9007199254740993");

        await assert.rejects(action, (error: unknown) => {
          assert(error instanceof LiveBookingApiError, tc.name);
          assert.equal(error.code, tc.expectedCode, tc.name);
          assert.equal(error.outcome, tc.expectedOutcome, tc.name);
          assert.equal(error.category, tc.expectedCategory, tc.name);
          assert.equal(error.canRetryWithSameKey, tc.canRetryWithSameKey, tc.name);
          assert.equal(
            error.shouldRefreshAvailability,
            tc.shouldRefreshAvailability,
            tc.name,
          );
          assert.equal(
            error.shouldRefreshBookings,
            tc.shouldRefreshBookings,
            tc.name,
          );
          if (tc.retryAfter !== undefined) {
            assert.equal(error.retryAfterSeconds, tc.retryAfter, tc.name);
          }
          assert.equal(
            error.message.includes("secret"),
            false,
            `${tc.name} must not leak upstream text`,
          );
          return true;
        });
        assert.equal(upstreamCalls.length, 1, `${tc.name} must never auto-retry`);
      },
    );
  }
});

test("401 ends client session and 409 SESSION_BUSY stays definite-failure", async () => {
  await withLiveBffHarness(
    () => Response.json({ message: "Unauthorized" }, { status: 401 }),
    async ({ api, store }) => {
      await assert.rejects(
        api.createBooking({ petId: "8", slotId: "12" }, { idempotencyKey: VALID_KEY }),
        (error: unknown) =>
          error instanceof LiveBookingApiError &&
          error.code === "SESSION_ENDED" &&
          error.category === "auth" &&
          error.outcome === "definite-failure",
      );
      assert.equal(store.revokedCalls, 1);
      assert.equal(snapshot().session, null);
    },
  );

  await withLiveBffHarness(
    () => Response.json(rawBookingFixture()),
    async ({ api, upstreamCalls }) => {
      await assert.rejects(
        api.createBooking({ petId: "8", slotId: "12" }, { idempotencyKey: VALID_KEY }),
        (error: unknown) =>
          error instanceof LiveBookingApiError &&
          error.code === "SESSION_BUSY" &&
          error.category === "auth" &&
          error.canRetryWithSameKey === true,
      );
      assert.equal(upstreamCalls.length, 0);
    },
    { busy: true },
  );
});

test("getPublicAvailabilitySlot omits credentials/auth, reuses decodeSlot, handles 404/429/timeout/cancel", async () => {
  let calls = 0;
  const api = createCustomerBookingApi({
    publicApiUrl: UPSTREAM_API,
    publicFetchImpl: async (url, init) => {
      calls++;
      assert.equal(url, `${UPSTREAM_API}/availability/public/12`);
      assert.equal(init.credentials, "omit");
      assert.equal(
        Object.keys(init.headers ?? {}).some(
          (k) => k.toLowerCase() === "authorization",
        ),
        false,
      );
      return Response.json(rawPublicSlotFixture());
    },
  });

  const slot = await api.getPublicAvailabilitySlot("12");
  assert.equal(slot.id, "12");
  assert.equal(slot.bookedCount, 1);
  assert.equal(slot.capacity, 3);
  assert.equal(calls, 1);

  // Full slot (bookedCount >= capacity) rejected via reused decodeSlot.
  assert.throws(() =>
    decodePublicAvailabilitySlot(
      rawPublicSlotFixture({ capacity: 2, bookedCount: 2 }),
      "12",
    ),
  );
  assert.throws(() => decodePublicAvailabilitySlot(rawPublicSlotFixture(), "99"));

  // Invalid / traversal slot IDs fail client-side before fetch.
  const before = calls;
  for (const badId of ["0", "abc", "../auth/me", "9223372036854775808"]) {
    await assert.rejects(
      api.getPublicAvailabilitySlot(badId),
      (e: unknown) =>
        e instanceof LiveBookingApiError && e.code === "INVALID_INPUT",
    );
  }
  assert.equal(calls, before);

  // 404 maps to SLOT_UNAVAILABLE.
  const notFoundApi = createCustomerBookingApi({
    publicApiUrl: UPSTREAM_API,
    publicFetchImpl: async () =>
      Response.json({ message: "Not found" }, { status: 404 }),
  });
  await assert.rejects(
    notFoundApi.getPublicAvailabilitySlot("12"),
    (e: unknown) =>
      e instanceof LiveBookingApiError &&
      e.code === "SLOT_UNAVAILABLE" &&
      e.category === "availability" &&
      e.shouldRefreshAvailability === true,
  );

  // Long Retry-After (e.g. 3600s) is preserved for public availability endpoint.
  const rateLimitedApi = createCustomerBookingApi({
    publicApiUrl: UPSTREAM_API,
    publicFetchImpl: async () =>
      Response.json(
        { code: "RATE_LIMITED", retryAfterSeconds: 3600 },
        { status: 429, headers: { "Retry-After": "3600" } },
      ),
  });
  await assert.rejects(
    rateLimitedApi.getPublicAvailabilitySlot("12"),
    (e: unknown) =>
      e instanceof LiveBookingApiError &&
      e.code === "RATE_LIMITED" &&
      e.retryAfterSeconds === 3600,
  );

  // Timeout is classified as NETWORK_ERROR, distinct from caller AbortError.
  const hangingApi = createCustomerBookingApi({
    publicApiUrl: UPSTREAM_API,
    publicFetchImpl: () => new Promise<Response>(() => {}),
  });
  await assert.rejects(
    hangingApi.getPublicAvailabilitySlot("12", { timeoutMs: 10 }),
    (e: unknown) =>
      e instanceof LiveBookingApiError &&
      e.code === "NETWORK_ERROR" &&
      e.category === "transient" &&
      e.outcome === "definite-failure",
  );

  const controller = new AbortController();
  const pending = hangingApi.getPublicAvailabilitySlot("12", {
    signal: controller.signal,
    timeoutMs: 5000,
  });
  controller.abort();
  await assert.rejects(pending, isRequestCancelled);
});

test("classifyBookingError distinguishes read vs mutation for network/invalid-response and preserves cancellation", () => {
  const createNet = classifyBookingError(
    new ApiError("network"),
    "create-booking",
  );
  assert.equal(createNet.code, "NETWORK_ERROR");
  assert.equal(createNet.outcome, "unknown");
  assert.equal(createNet.category, "uncertain");
  assert.equal(createNet.canRetryWithSameKey, true);

  const listNet = classifyBookingError(
    new ApiError("network"),
    "list-bookings",
  );
  assert.equal(listNet.code, "NETWORK_ERROR");
  assert.equal(listNet.outcome, "definite-failure");
  assert.equal(listNet.category, "transient");
  assert.equal(listNet.canRetryWithSameKey, false);

  const cancelInvalid = classifyBookingError(
    new ApiError("invalid-response", 201),
    "cancel-booking",
  );
  assert.equal(cancelInvalid.code, "INVALID_RESPONSE");
  assert.equal(cancelInvalid.outcome, "unknown");
  assert.equal(cancelInvalid.canRetryWithSameKey, false);
  assert.equal(cancelInvalid.shouldRefreshBookings, true);

  const cancelTimeFromMessage = classifyBookingError(
    new ApiError(
      "http",
      409,
      null,
      "Bookings can only be cancelled before the appointment starts",
    ),
    "cancel-booking",
  );
  assert.equal(cancelTimeFromMessage.code, "CANCEL_TIME");
  assert.equal(cancelTimeFromMessage.category, "conflict");
  assert.equal(cancelTimeFromMessage.outcome, "definite-failure");
  assert.equal(cancelTimeFromMessage.canRetryWithSameKey, false);
  assert.equal(cancelTimeFromMessage.shouldRefreshAvailability, false);
  assert.equal(cancelTimeFromMessage.shouldRefreshBookings, true);

  const cancelTimeFromCode = classifyBookingError(
    new ApiError("http", 409, "CANCEL_TIME"),
    "cancel-booking",
  );
  assert.equal(cancelTimeFromCode.code, "CANCEL_TIME");
  assert.equal(cancelTimeFromCode.category, "conflict");
  assert.equal(cancelTimeFromCode.shouldRefreshBookings, true);
});
