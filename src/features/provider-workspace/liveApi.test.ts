import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../lib/api/errors";
import { QueryCache, queryFreshness, queryKeys } from "../../lib/api/queryCache";
import {
  handleBff,
  type BffHandlerDeps,
} from "../../lib/server/bff/handler";
import {
  SessionBusy,
  SessionEnded,
  type Session,
} from "../../lib/server/bff/store";
import {
  classifyProviderError,
  createProviderWorkspaceApi,
  decodeProviderAvailabilitySlot,
  decodeProviderAvailabilitySlots,
  decodeProviderBooking,
  decodeProviderBookingDetail,
  decodeProviderBookings,
  decodeProviderDashboard,
  decodeProviderProfile,
  decodeProviderService,
  decodeProviderServices,
  decodeWorkingHour,
  decodeWorkingHours,
  normalizeTimeToHhMm,
  ProviderWorkspaceApiError,
  type BffRequester,
} from "./liveApi";

const BFF_ORIGIN = "https://app.example";
const API_ORIGIN = "https://api.example/api";
const TEST_COOKIE_VALUE = "a".repeat(43);
const TEST_GENERATION = "11111111-1111-4111-8111-111111111111";

const SAMPLE_PROFILE = {
  id: "3",
  ownerId: "30",
  businessName: "PawCare Center",
  address: "123 Nguyen Van Linh, Q7, TP.HCM",
  phone: "0901234567",
  description: "Full pet grooming",
  approvalStatus: "APPROVED" as const,
  ratingAvg: "4.85",
  ratingCount: 12,
  createdAt: "2026-10-01T02:00:00.000Z",
  updatedAt: "2026-10-02T03:00:00.000Z",
};

const SAMPLE_WORKING_HOUR = {
  id: "11",
  providerId: "3",
  dayOfWeek: 1,
  startTime: "08:00:00",
  endTime: "17:00:00",
  isActive: true,
  createdAt: "2026-10-01T02:00:00.000Z",
  updatedAt: "2026-10-02T03:00:00.000Z",
};

const SAMPLE_CATEGORY = {
  id: "2",
  name: "Grooming",
  description: "Bath and trim",
  status: "ACTIVE" as const,
};

const SAMPLE_SERVICE_MUTATION = {
  id: "5",
  providerId: "3",
  categoryId: "2",
  name: "Full Grooming",
  price: "150000.00",
  durationMinutes: 60,
  description: "Bath and nail trim",
  status: "ACTIVE" as const,
  createdAt: "2026-10-01T02:00:00.000Z",
  updatedAt: "2026-10-02T03:00:00.000Z",
};

const SAMPLE_SERVICE_GET = {
  ...SAMPLE_SERVICE_MUTATION,
  category: SAMPLE_CATEGORY,
};

const SAMPLE_SLOT_MUTATION = {
  id: "12",
  providerId: "3",
  serviceId: "5",
  slotDate: "2026-11-10",
  startTime: "09:00:00",
  endTime: "10:00:00",
  capacity: 3,
  bookedCount: 1,
  status: "OPEN" as const,
  createdAt: "2026-10-01T02:00:00.000Z",
  updatedAt: "2026-10-02T03:00:00.000Z",
};

const SAMPLE_SLOT_GET = {
  ...SAMPLE_SLOT_MUTATION,
  service: {
    id: "5",
    categoryId: "2",
    name: "Full Grooming",
    price: "150000.00",
    durationMinutes: 60,
    description: "Bath and nail trim",
    status: "ACTIVE" as const,
  },
};

const SAMPLE_PROVIDER_BOOKING = {
  id: "100",
  status: "PENDING_CONFIRMATION" as const,
  bookedPrice: "150000.00",
  customerNote: "Gentle please",
  createdAt: "2026-11-02T07:05:30.250Z",
  updatedAt: "2026-11-02T07:05:30.250Z",
  service: {
    id: "5",
    name: "Full Grooming",
    durationMinutes: 60,
  },
  slot: {
    id: "12",
    slotDate: "2026-11-10",
    startTime: "09:00:00",
    endTime: "10:00:00",
  },
  customer: {
    id: "20",
    fullName: "Nguyen Van A",
  },
  pet: {
    id: "8",
    name: "Milo",
    breed: "Corgi",
    birthDate: "2022-05-01",
    weight: "12.50",
    healthNote: "Allergic to oat shampoo",
    petType: {
      id: "1",
      name: "Dog",
    },
  },
};

const SAMPLE_PROVIDER_BOOKING_DETAIL = {
  ...SAMPLE_PROVIDER_BOOKING,
  statusLogs: [
    {
      id: "77",
      oldStatus: null,
      newStatus: "PENDING_CONFIRMATION" as const,
      reason: null,
      createdAt: "2026-11-02T07:05:30.250Z",
    },
  ],
};

const SAMPLE_DASHBOARD = {
  providerId: "3",
  period: {
    from: "2026-10-01",
    to: "2026-10-31",
  },
  bookingVolumeByStatus: {
    PENDING_CONFIRMATION: 2,
    CONFIRMED: 3,
    REJECTED: 1,
    COMPLETED: 6,
    CANCELLED: 2,
    NO_SHOW: 1,
    total: 15,
  },
  cancellationRate: {
    cancelledBookings: 2,
    resolvedBookings: 9,
    rate: 22.22,
  },
  popularServices: [
    {
      serviceId: "5",
      serviceName: "Full Grooming",
      completedBookings: 6,
    },
  ],
  returningCustomers: {
    count: 4,
  },
  recordedRevenue: {
    amount: "900000.00",
  },
  averageRating: {
    reviewCount: 5,
    average: 3.8,
  },
  alerts: [
    {
      code: "PEAK_HOUR_DEMAND",
      severity: "WARNING",
      message: "50% of accepted bookings on 2026-10-15 start between 17:00 and 20:00.",
      recommendation: "Review staffing or slot availability during the identified peak period.",
      context: {
        date: "2026-10-15",
        peakAcceptedBookings: 3,
        totalAcceptedBookings: 6,
        percentage: 50,
      },
    },
    {
      code: "HIGH_SERVICE_CANCELLATION",
      severity: "WARNING",
      message: "Full Grooming had a 40% cancellation rate in 2026-10.",
      recommendation: "Review pricing, duration, scheduling conditions, and recent feedback for this service.",
      context: {
        month: "2026-10",
        serviceId: "5",
        cancelledBookings: 2,
        resolvedBookings: 5,
        percentage: 40,
      },
    },
    {
      code: "UNDERUSED_SERVICE",
      severity: "INFO",
      message: "Nail Trim completed 1 bookings in 2026-10, more than 30% below comparable active services.",
      recommendation: "Review promotion, bundling, pricing, or service presentation for this service.",
      context: {
        month: "2026-10",
        serviceId: "6",
        completedBookings: 1,
        comparisonAverage: 5.5,
      },
    },
    {
      code: "FREQUENT_RETURNING_CUSTOMER",
      severity: "INFO",
      message: "Customer 20 completed at least 3 bookings in the previous two months.",
      recommendation: "Consider an appropriate retention action.",
      context: {
        customerId: "20",
        completedBookings: 4,
        from: "2026-08-31",
        to: "2026-10-31",
      },
    },
    {
      code: "LOW_RATING",
      severity: "WARNING",
      message: "Visible reviews averaged 3.8 over the 30 days ending 2026-10-31.",
      recommendation: "Review recent customer feedback.",
      context: {
        from: "2026-10-02",
        to: "2026-10-31",
        reviewCount: 5,
        average: 3.8,
      },
    },
  ],
};

function stubStore(): NonNullable<BffHandlerDeps["store"]> {
  const row: Session = {
    id_hash: "hash-provider-owner",
    generation: TEST_GENERATION,
    state: "active",
    user_id: "30",
    backend_session_id: "22222222-2222-4222-8222-222222222222",
    tokens: "encrypted",
    expires_at: new Date(Date.now() + 3600_000),
    access_expires_at: new Date(Date.now() + 600_000),
    previous_id_hash: null,
    previous_generation: null,
    operation_id: null,
    lease_until: null,
  };
  return {
    read: async () => row,
    create: async () => ({ row, cookie: TEST_COOKIE_VALUE }),
    access: async () => row,
    open: () => ({ accessToken: "provider-access-token", refreshToken: "r".repeat(43) }),
    assertCurrent: async () => {},
    revoke: async () => {},
    end: async () => row,
    beginLogin: async () => row,
    activate: async () => ({ row, cookie: TEST_COOKIE_VALUE }),
    failLogin: async () => {},
    revokeUser: async () => {},
    revokeBackend: async () => {},
  };
}

async function withStubbedBffEnv(
  fetchImpl: typeof fetch,
  run: () => Promise<void>,
) {
  const prevFetch = globalThis.fetch;
  const prevApiUrl = process.env.PAWFLOW_API_URL;
  const prevOrigin = process.env.BFF_APP_ORIGIN;
  const prevNodeEnv = process.env.NODE_ENV;
  globalThis.fetch = fetchImpl;
  process.env.PAWFLOW_API_URL = API_ORIGIN;
  process.env.BFF_APP_ORIGIN = BFF_ORIGIN;
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  try {
    await run();
  } finally {
    globalThis.fetch = prevFetch;
    if (prevApiUrl === undefined) delete process.env.PAWFLOW_API_URL;
    else process.env.PAWFLOW_API_URL = prevApiUrl;
    if (prevOrigin === undefined) delete process.env.BFF_APP_ORIGIN;
    else process.env.BFF_APP_ORIGIN = prevOrigin;
    if (prevNodeEnv === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    } else {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    }
  }
}

function makeBffRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    query?: string;
  } = {},
): Request {
  const method = options.method ?? "GET";
  const url = `${BFF_ORIGIN}/api/bff/${path}${options.query ? `?${options.query}` : ""}`;
  return new Request(url, {
    method,
    headers: {
      origin: BFF_ORIGIN,
      "sec-fetch-site": "same-origin",
      cookie: `pawflow-session=${TEST_COOKIE_VALUE}`,
      "x-bff-generation": TEST_GENERATION,
      ...(method === "GET" ? {} : { "content-type": "application/json" }),
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(options.body ?? {}) }),
  });
}

describe("handleBff provider routes, query forwarding, projections and error mapping", () => {
  it("allows all 22 provider endpoints with exact methods, upstream paths, clean DELETE 204 and field projections", async () => {
    const upstreamCalls: Array<{
      url: string;
      method: string;
      body: string | undefined;
    }> = [];

    await withStubbedBffEnv(
      async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const rawBody = typeof init?.body === "string" ? init.body : undefined;
        upstreamCalls.push({ url, method, body: rawBody });

        if (url === `${API_ORIGIN}/providers/me`) {
          return Response.json({
            ...SAMPLE_PROFILE,
            owner: { passwordHash: "$2b$secret" },
            internalFlag: true,
          });
        }
        if (url === `${API_ORIGIN}/providers/working-hours` && method === "GET") {
          return Response.json([
            { ...SAMPLE_WORKING_HOUR, provider: { secret: "drop" } },
          ]);
        }
        if (url === `${API_ORIGIN}/providers/working-hours` && method === "POST") {
          return Response.json(
            { ...SAMPLE_WORKING_HOUR, startTime: "08:00", endTime: "17:00", extra: 1 },
            { status: 201 },
          );
        }
        if (url === `${API_ORIGIN}/providers/working-hours/11` && method === "PATCH") {
          return Response.json({ ...SAMPLE_WORKING_HOUR, isActive: false, extra: 1 });
        }
        if (url === `${API_ORIGIN}/providers/working-hours/11` && method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (url === `${API_ORIGIN}/services` && method === "POST") {
          return Response.json(
            { ...SAMPLE_SERVICE_MUTATION, provider: { secret: "drop" } },
            { status: 201 },
          );
        }
        if (url === `${API_ORIGIN}/services/mine` && method === "GET") {
          return Response.json([
            {
              ...SAMPLE_SERVICE_GET,
              category: { ...SAMPLE_CATEGORY, createdAt: "2026-01-01T00:00:00Z" },
              extraField: "drop",
            },
          ]);
        }
        if (url === `${API_ORIGIN}/services/mine/5` && method === "GET") {
          return Response.json({
            ...SAMPLE_SERVICE_GET,
            extraField: "drop",
          });
        }
        if (url === `${API_ORIGIN}/services/mine/5` && method === "PATCH") {
          return Response.json({ ...SAMPLE_SERVICE_MUTATION, status: "INACTIVE", extraField: "drop" });
        }
        if (url === `${API_ORIGIN}/services/mine/5` && method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (url === `${API_ORIGIN}/availability` && method === "POST") {
          return Response.json(
            { ...SAMPLE_SLOT_MUTATION, startTime: "09:00", endTime: "10:00", extraField: "drop" },
            { status: 201 },
          );
        }
        if (url === `${API_ORIGIN}/availability/mine` && method === "GET") {
          return Response.json([
            {
              ...SAMPLE_SLOT_GET,
              service: { ...SAMPLE_SLOT_GET.service, providerId: "3", secret: "drop" },
              extraField: "drop",
            },
          ]);
        }
        if (url === `${API_ORIGIN}/availability/mine/12` && method === "GET") {
          return Response.json({ ...SAMPLE_SLOT_GET, extraField: "drop" });
        }
        if (url === `${API_ORIGIN}/availability/mine/12` && method === "PATCH") {
          return Response.json({ ...SAMPLE_SLOT_MUTATION, capacity: 4, extraField: "drop" });
        }
        if (url === `${API_ORIGIN}/availability/mine/12` && method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (url === `${API_ORIGIN}/bookings/provider` && method === "GET") {
          return Response.json([
            {
              ...SAMPLE_PROVIDER_BOOKING,
              customer: {
                ...SAMPLE_PROVIDER_BOOKING.customer,
                email: "hidden@example.test",
                phone: "0999999999",
                passwordHash: "$2b$10$secret",
              },
              pet: {
                ...SAMPLE_PROVIDER_BOOKING.pet,
                ownerId: "20",
              },
            },
          ]);
        }
        if (url === `${API_ORIGIN}/bookings/provider/100` && method === "GET") {
          return Response.json({
            ...SAMPLE_PROVIDER_BOOKING_DETAIL,
            customer: {
              ...SAMPLE_PROVIDER_BOOKING.customer,
              email: "hidden@example.test",
            },
            statusLogs: [
              { ...SAMPLE_PROVIDER_BOOKING_DETAIL.statusLogs[0], changedBy: "20" },
            ],
          });
        }
        if (
          /^https:\/\/api\.example\/api\/bookings\/provider\/100\/(confirm|reject|complete|no-show)$/.test(
            url,
          ) &&
          method === "POST"
        ) {
          return Response.json(
            {
              ...SAMPLE_PROVIDER_BOOKING,
              status: url.endsWith("/confirm")
                ? "CONFIRMED"
                : url.endsWith("/reject")
                  ? "REJECTED"
                  : url.endsWith("/complete")
                    ? "COMPLETED"
                    : "NO_SHOW",
              customer: { ...SAMPLE_PROVIDER_BOOKING.customer, email: "drop@test" },
            },
            { status: 201 },
          );
        }
        if (
          url ===
          `${API_ORIGIN}/dashboard/provider?from=2026-10-01&to=2026-10-31`
        ) {
          return Response.json({
            ...SAMPLE_DASHBOARD,
            internalMetric: "drop",
            alerts: SAMPLE_DASHBOARD.alerts.map((alert) => ({
              ...alert,
              secretAlertField: "drop",
              context: { ...alert.context, internalNote: "drop" },
            })),
          });
        }
        throw new Error(`Unexpected upstream call: ${method} ${url}`);
      },
      async () => {
        const deps = { store: stubStore() };

        const profileRes = await handleBff(makeBffRequest("providers/me"), "providers/me", deps);
        assert.equal(profileRes.status, 200);
        const profileJson = await profileRes.json();
        assert.deepEqual(profileJson, SAMPLE_PROFILE);

        const patchProfileRes = await handleBff(
          makeBffRequest("providers/me", {
            method: "PATCH",
            body: { businessName: "PawCare Center", phone: null },
          }),
          "providers/me",
          deps,
        );
        assert.equal(patchProfileRes.status, 200);

        const whListRes = await handleBff(
          makeBffRequest("providers/working-hours"),
          "providers/working-hours",
          deps,
        );
        assert.equal(whListRes.status, 200);
        assert.deepEqual(await whListRes.json(), [SAMPLE_WORKING_HOUR]);

        const whCreateRes = await handleBff(
          makeBffRequest("providers/working-hours", {
            method: "POST",
            body: { dayOfWeek: 1, startTime: "08:00", endTime: "17:00", isActive: true },
          }),
          "providers/working-hours",
          deps,
        );
        assert.equal(whCreateRes.status, 201);
        assert.equal("extra" in (await whCreateRes.json()), false);

        const whPatchRes = await handleBff(
          makeBffRequest("providers/working-hours/11", {
            method: "PATCH",
            body: { isActive: false },
          }),
          "providers/working-hours/11",
          deps,
        );
        assert.equal(whPatchRes.status, 200);

        const whDelRes = await handleBff(
          makeBffRequest("providers/working-hours/11", { method: "DELETE", body: {} }),
          "providers/working-hours/11",
          deps,
        );
        assert.equal(whDelRes.status, 204);
        assert.equal(await whDelRes.text(), "");

        const svcCreateRes = await handleBff(
          makeBffRequest("services", {
            method: "POST",
            body: {
              categoryId: "2",
              name: "Full Grooming",
              price: 150000,
              durationMinutes: 60,
              description: "Bath and nail trim",
            },
          }),
          "services",
          deps,
        );
        assert.equal(svcCreateRes.status, 201);
        assert.deepEqual(await svcCreateRes.json(), SAMPLE_SERVICE_MUTATION);

        const svcListRes = await handleBff(
          makeBffRequest("services/mine"),
          "services/mine",
          deps,
        );
        assert.equal(svcListRes.status, 200);
        assert.deepEqual(await svcListRes.json(), [SAMPLE_SERVICE_GET]);

        const svcDetailRes = await handleBff(
          makeBffRequest("services/mine/5"),
          "services/mine/5",
          deps,
        );
        assert.equal(svcDetailRes.status, 200);
        assert.deepEqual(await svcDetailRes.json(), SAMPLE_SERVICE_GET);

        const svcPatchRes = await handleBff(
          makeBffRequest("services/mine/5", {
            method: "PATCH",
            body: { status: "INACTIVE" },
          }),
          "services/mine/5",
          deps,
        );
        assert.equal(svcPatchRes.status, 200);
        assert.equal((await svcPatchRes.json()).status, "INACTIVE");

        const svcDelRes = await handleBff(
          makeBffRequest("services/mine/5", { method: "DELETE", body: {} }),
          "services/mine/5",
          deps,
        );
        assert.equal(svcDelRes.status, 204);
        assert.equal(await svcDelRes.text(), "");

        const slotCreateRes = await handleBff(
          makeBffRequest("availability", {
            method: "POST",
            body: {
              serviceId: "5",
              slotDate: "2026-11-10",
              startTime: "09:00",
              endTime: "10:00",
              capacity: 3,
            },
          }),
          "availability",
          deps,
        );
        assert.equal(slotCreateRes.status, 201);
        assert.equal("extraField" in (await slotCreateRes.json()), false);

        const slotListRes = await handleBff(
          makeBffRequest("availability/mine"),
          "availability/mine",
          deps,
        );
        assert.equal(slotListRes.status, 200);
        assert.deepEqual(await slotListRes.json(), [SAMPLE_SLOT_GET]);

        const slotDetailRes = await handleBff(
          makeBffRequest("availability/mine/12"),
          "availability/mine/12",
          deps,
        );
        assert.equal(slotDetailRes.status, 200);
        assert.deepEqual(await slotDetailRes.json(), SAMPLE_SLOT_GET);

        const slotPatchRes = await handleBff(
          makeBffRequest("availability/mine/12", {
            method: "PATCH",
            body: { capacity: 4 },
          }),
          "availability/mine/12",
          deps,
        );
        assert.equal(slotPatchRes.status, 200);

        const slotDelRes = await handleBff(
          makeBffRequest("availability/mine/12", { method: "DELETE", body: {} }),
          "availability/mine/12",
          deps,
        );
        assert.equal(slotDelRes.status, 204);
        assert.equal(await slotDelRes.text(), "");

        const bookingListRes = await handleBff(
          makeBffRequest("bookings/provider"),
          "bookings/provider",
          deps,
        );
        assert.equal(bookingListRes.status, 200);
        const bookingListText = await bookingListRes.text();
        assert.equal(bookingListText.includes("hidden@example.test"), false);
        assert.equal(bookingListText.includes("passwordHash"), false);
        assert.deepEqual(JSON.parse(bookingListText), [SAMPLE_PROVIDER_BOOKING]);

        const bookingDetailRes = await handleBff(
          makeBffRequest("bookings/provider/100"),
          "bookings/provider/100",
          deps,
        );
        assert.equal(bookingDetailRes.status, 200);
        assert.deepEqual(
          await bookingDetailRes.json(),
          SAMPLE_PROVIDER_BOOKING_DETAIL,
        );

        for (const [action, body] of [
          ["confirm", {}],
          ["reject", { reason: "Full" }],
          ["complete", {}],
          ["no-show", { reason: "Did not arrive" }],
        ] as const) {
          const actionRes = await handleBff(
            makeBffRequest(`bookings/provider/100/${action}`, {
              method: "POST",
              body,
            }),
            `bookings/provider/100/${action}`,
            deps,
          );
          assert.equal(actionRes.status, 201);
          const actionText = await actionRes.text();
          assert.equal(actionText.includes("drop@test"), false);
        }

        const dashRes = await handleBff(
          makeBffRequest("dashboard/provider", {
            query: "from=2026-10-01&to=2026-10-31",
          }),
          "dashboard/provider",
          deps,
        );
        assert.equal(dashRes.status, 200);
        const dashJson = await dashRes.json();
        assert.deepEqual(dashJson, SAMPLE_DASHBOARD);

        // Ensure all 3 DELETE calls forwarded without request body upstream.
        const deleteCalls = upstreamCalls.filter((c) => c.method === "DELETE");
        assert.equal(deleteCalls.length, 3);
        for (const call of deleteCalls) {
          assert.equal(call.body, undefined);
        }
        assert.equal(upstreamCalls.length, 23);
      },
    );
  });

  it("blocks disallowed methods, invalid BIGINT IDs, extra fields and invalid dashboard queries before upstream", async () => {
    let upstreamCount = 0;

    await withStubbedBffEnv(
      async () => {
        upstreamCount++;
        return Response.json({});
      },
      async () => {
        const deps = { store: stubStore() };

        // Disallowed methods and non-existent provider cancel route -> 404.
        for (const [path, method] of [
          ["providers/me", "POST"],
          ["providers/me", "DELETE"],
          ["providers/working-hours/11", "GET"],
          ["services", "GET"],
          ["services/mine", "POST"],
          ["availability", "GET"],
          ["availability/mine", "POST"],
          ["bookings/provider", "POST"],
          ["bookings/provider/100/cancel", "POST"],
          ["dashboard/provider", "POST"],
        ] as const) {
          const res = await handleBff(
            makeBffRequest(path, { method, body: {} }),
            path,
            deps,
          );
          assert.equal(res.status, 404, `${method} ${path} should be 404`);
        }

        // Invalid BIGINT IDs -> 404.
        for (const badPath of [
          "providers/working-hours/0",
          "providers/working-hours/abc",
          "services/mine/9223372036854775808",
          "availability/mine/-5",
          "bookings/provider/0/confirm",
          "bookings/provider/9223372036854775808",
        ]) {
          const res = await handleBff(
            makeBffRequest(badPath, {
              method: badPath.endsWith("/confirm") ? "POST" : "GET",
              body: {},
            }),
            badPath,
            deps,
          );
          assert.equal(res.status, 404, `${badPath} should be 404`);
        }

        // Disallowed extra fields -> 400.
        for (const [path, method, body] of [
          ["providers/me", "PATCH", { approvalStatus: "APPROVED" }],
          ["providers/working-hours", "POST", { dayOfWeek: 1, providerId: "9" }],
          ["providers/working-hours/11", "DELETE", { force: true }],
          ["services", "POST", { name: "X", status: "INACTIVE" }],
          ["services/mine/5", "DELETE", { status: "INACTIVE" }],
          ["availability", "POST", { bookedCount: 0 }],
          ["availability/mine/12", "PATCH", { bookedCount: 2 }],
          ["availability/mine/12", "DELETE", { status: "CANCELLED" }],
          ["bookings/provider/100/confirm", "POST", { reason: "unexpected" }],
          ["bookings/provider/100/complete", "POST", { status: "COMPLETED" }],
          ["bookings/provider/100/reject", "POST", { status: "REJECTED" }],
          ["bookings/provider/100/no-show", "POST", { bookedPrice: "0.00" }],
        ] as const) {
          const res = await handleBff(
            makeBffRequest(path, { method, body }),
            path,
            deps,
          );
          assert.equal(res.status, 400, `${method} ${path} extra field -> 400`);
        }

        // Invalid dashboard queries -> 400 with exact machine code before upstream.
        const queryCases: Array<[string, string]> = [
          ["", "INVALID_DATE_RANGE"],
          ["from=2026-10-01", "INVALID_DATE_RANGE"],
          ["to=2026-10-31", "INVALID_DATE_RANGE"],
          ["from=2026-02-29&to=2026-03-01", "INVALID_DATE_RANGE"],
          ["from=2026-10-31&to=2026-10-01", "INVALID_DATE_RANGE"],
          ["from=2026-10-01&to=2026-10-31&providerId=9", "INVALID_QUERY"],
          ["from=2026-10-01&from=2026-10-02&to=2026-10-31", "INVALID_QUERY"],
          ["from=2026-10-01&to=2026-10-30&to=2026-10-31", "INVALID_QUERY"],
        ];
        for (const [query, expectedCode] of queryCases) {
          const res = await handleBff(
            makeBffRequest("dashboard/provider", { query }),
            "dashboard/provider",
            deps,
          );
          assert.equal(res.status, 400, `query "${query}" should be 400`);
          const json = (await res.json()) as { code: string };
          assert.equal(json.code, expectedCode);
        }

        assert.equal(upstreamCount, 0);
      },
    );
  });

  it("rejects null/204 responses on GET/POST/PATCH provider routes and non-204 responses on DELETE with 503", async () => {
    const deps = { store: stubStore() };

    await withStubbedBffEnv(
      async (input, init) => {
        if (init?.method === "DELETE") {
          return Response.json({ deleted: true }, { status: 200 });
        }
        if (String(input).includes("/dashboard/provider")) {
          return Response.json({
            ...SAMPLE_DASHBOARD,
            alerts: [
              {
                code: "UNKNOWN_RULE",
                severity: "INFO",
                message: "x",
                recommendation: "y",
                context: {},
              },
            ],
          });
        }
        return new Response(null, { status: 204 });
      },
      async () => {
        assert.equal(
          (await handleBff(makeBffRequest("providers/me"), "providers/me", deps))
            .status,
          503,
        );
        assert.equal(
          (
            await handleBff(
              makeBffRequest("services", { method: "POST", body: { name: "X" } }),
              "services",
              deps,
            )
          ).status,
          503,
        );
        assert.equal(
          (
            await handleBff(
              makeBffRequest("services/mine/5", { method: "DELETE", body: {} }),
              "services/mine/5",
              deps,
            )
          ).status,
          503,
        );
        assert.equal(
          (
            await handleBff(
              makeBffRequest("dashboard/provider", {
                query: "from=2026-10-01&to=2026-10-31",
              }),
              "dashboard/provider",
              deps,
            )
          ).status,
          503,
        );
      },
    );
  });

  it("maps every static and anchored-regex provider error code without leaking raw upstream text or 5xx details", async () => {
    const cases: Array<{
      path: string;
      method: "GET" | "POST" | "PATCH" | "DELETE";
      query?: string;
      status: number;
      upstreamMessage: string;
      expectedCode: string | null;
    }> = [
      // 404
      {
        path: "providers/me",
        method: "GET",
        status: 404,
        upstreamMessage: "Provider profile not found",
        expectedCode: "PROVIDER_PROFILE_NOT_FOUND",
      },
      {
        path: "providers/working-hours/11",
        method: "PATCH",
        status: 404,
        upstreamMessage: "Provider working-hour record not found",
        expectedCode: "WORKING_HOUR_NOT_FOUND",
      },
      {
        path: "services/mine/5",
        method: "GET",
        status: 404,
        upstreamMessage: "Service not found",
        expectedCode: "SERVICE_NOT_FOUND",
      },
      {
        path: "services",
        method: "POST",
        status: 404,
        upstreamMessage: "Active service category not found",
        expectedCode: "CATEGORY_NOT_FOUND",
      },
      {
        path: "availability/mine/12",
        method: "PATCH",
        status: 404,
        upstreamMessage: "Availability slot not found",
        expectedCode: "SLOT_NOT_FOUND",
      },
      // VT-05 cross-provider booking 404
      {
        path: "bookings/provider/999/confirm",
        method: "POST",
        status: 404,
        upstreamMessage: "Booking not found",
        expectedCode: "BOOKING_NOT_FOUND",
      },
      // 403 lifecycle + RolesGuard + staff
      {
        path: "providers/me",
        method: "PATCH",
        status: 403,
        upstreamMessage: "A SUSPENDED provider cannot update its profile",
        expectedCode: "PROVIDER_SUSPENDED_READONLY",
      },
      {
        path: "services",
        method: "POST",
        status: 403,
        upstreamMessage:
          "A REJECTED provider cannot manage services, availability or staff",
        expectedCode: "PROVIDER_REJECTED_FORBIDDEN",
      },
      {
        path: "availability/mine/12",
        method: "DELETE",
        status: 403,
        upstreamMessage:
          "A SUSPENDED provider cannot manage services, availability or staff",
        expectedCode: "PROVIDER_SUSPENDED_FORBIDDEN",
      },
      {
        path: "bookings/provider/100/confirm",
        method: "POST",
        status: 403,
        upstreamMessage: "A PENDING provider cannot confirm bookings",
        expectedCode: "PROVIDER_CONFIRM_FORBIDDEN",
      },
      {
        path: "bookings/provider/100/confirm",
        method: "POST",
        status: 403,
        upstreamMessage: "A REJECTED provider cannot confirm bookings",
        expectedCode: "PROVIDER_CONFIRM_FORBIDDEN",
      },
      {
        path: "bookings/provider/100/confirm",
        method: "POST",
        status: 403,
        upstreamMessage: "A SUSPENDED provider cannot confirm bookings",
        expectedCode: "PROVIDER_CONFIRM_FORBIDDEN",
      },
      {
        path: "bookings/provider",
        method: "GET",
        status: 403,
        upstreamMessage: "Active provider staff association is required",
        expectedCode: "STAFF_ASSOCIATION_REQUIRED",
      },
      {
        path: "providers/me",
        method: "GET",
        status: 403,
        upstreamMessage: "You do not have permission to access this resource",
        expectedCode: "FORBIDDEN_ROLE",
      },
      {
        path: "bookings/provider",
        method: "GET",
        status: 403,
        upstreamMessage: "You do not have permission to manage provider bookings",
        expectedCode: "FORBIDDEN_ROLE",
      },
      {
        path: "dashboard/provider",
        method: "GET",
        query: "from=2026-10-01&to=2026-10-31",
        status: 403,
        upstreamMessage: "Forbidden resource",
        expectedCode: "FORBIDDEN_ROLE",
      },
      // 409 exact + anchored regex
      {
        path: "providers/working-hours",
        method: "POST",
        status: 409,
        upstreamMessage: "This working-hour entry already exists",
        expectedCode: "WORKING_HOUR_DUPLICATE",
      },
      {
        path: "providers/working-hours",
        method: "POST",
        status: 409,
        upstreamMessage:
          "This working-hour entry overlaps the active entry 08:00:00-12:00:00 on the same day. Adjacent entries are allowed; deactivate or change the other entry first.",
        expectedCode: "WORKING_HOUR_OVERLAP",
      },
      {
        path: "providers/working-hours/11",
        method: "DELETE",
        status: 409,
        upstreamMessage:
          "This working-hour change would leave 3 active booking(s) outside working hours. Cancel or reschedule them first.",
        expectedCode: "WORKING_HOUR_HAS_ACTIVE_BOOKINGS",
      },
      {
        path: "services/mine/5",
        method: "PATCH",
        status: 409,
        upstreamMessage:
          "durationMinutes cannot exceed the length of 2 upcoming slot(s) that already have active bookings",
        expectedCode: "SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS",
      },
      {
        path: "availability",
        method: "POST",
        status: 409,
        upstreamMessage: "An identical availability slot already exists",
        expectedCode: "SLOT_DUPLICATE",
      },
      {
        path: "availability",
        method: "POST",
        status: 409,
        upstreamMessage:
          "The slot must last at least 60 minutes, the duration of its service",
        expectedCode: "SLOT_TOO_SHORT",
      },
      {
        path: "availability",
        method: "POST",
        status: 409,
        upstreamMessage:
          "The slot must fit entirely within one of the provider's active working hours for that day",
        expectedCode: "SLOT_OUTSIDE_WORKING_HOURS",
      },
      {
        path: "availability/mine/12",
        method: "PATCH",
        status: 409,
        upstreamMessage:
          "Cannot change service, date, or time of a slot that already has bookings",
        expectedCode: "SLOT_HAS_BOOKINGS_LOCKED_FIELDS",
      },
      {
        path: "availability/mine/12",
        method: "PATCH",
        status: 409,
        upstreamMessage: "capacity cannot be lower than bookedCount",
        expectedCode: "SLOT_CAPACITY_BELOW_BOOKED",
      },
      {
        path: "bookings/provider/100/confirm",
        method: "POST",
        status: 409,
        upstreamMessage: "Only a pending confirmation booking can be updated",
        expectedCode: "BOOKING_NOT_PENDING",
      },
      {
        path: "bookings/provider/100/complete",
        method: "POST",
        status: 409,
        upstreamMessage: "Only a confirmed booking can be updated",
        expectedCode: "BOOKING_NOT_CONFIRMED",
      },
      {
        path: "bookings/provider/100/reject",
        method: "POST",
        status: 409,
        upstreamMessage:
          "Availability slot has no reserved capacity to release",
        expectedCode: "NO_RESERVED_CAPACITY",
      },
      {
        path: "bookings/provider/100/no-show",
        method: "POST",
        status: 409,
        upstreamMessage:
          "A booking can only be marked as no-show at or after the scheduled appointment time",
        expectedCode: "NO_SHOW_TIME",
      },
      // 400
      {
        path: "availability",
        method: "POST",
        status: 400,
        upstreamMessage: "Availability slots can only use active services",
        expectedCode: "SERVICE_INACTIVE",
      },
      {
        path: "availability",
        method: "POST",
        status: 400,
        upstreamMessage: "slotDate cannot be in the past",
        expectedCode: "SLOT_IN_PAST",
      },
      {
        path: "availability",
        method: "POST",
        status: 400,
        upstreamMessage:
          "The availability slot has already started; its start time must be in the future",
        expectedCode: "SLOT_STARTED",
      },
      {
        path: "providers/working-hours",
        method: "POST",
        status: 400,
        upstreamMessage: "startTime must be earlier than endTime",
        expectedCode: "INVALID_TIME_RANGE",
      },
      {
        path: "dashboard/provider",
        method: "GET",
        query: "from=2026-10-01&to=2026-10-31",
        status: 400,
        upstreamMessage:
          "The reporting period start date must not be after the end date",
        expectedCode: "INVALID_DATE_RANGE",
      },
      // 5xx must NEVER map or leak upstream text
      {
        path: "providers/me",
        method: "GET",
        status: 500,
        upstreamMessage: "Provider profile not found (SQL stack leak)",
        expectedCode: null,
      },
    ];

    const deps = { store: stubStore() };

    for (const testCase of cases) {
      await withStubbedBffEnv(
        async () =>
          Response.json(
            { message: testCase.upstreamMessage },
            { status: testCase.status },
          ),
        async () => {
          const res = await handleBff(
            makeBffRequest(testCase.path, {
              method: testCase.method,
              query: testCase.query,
              body: {},
            }),
            testCase.path,
            deps,
          );
          assert.equal(res.status, testCase.status);
          const rawText = await res.text();
          assert.equal(
            rawText.includes(testCase.upstreamMessage),
            false,
            `Raw upstream message leaked for ${testCase.expectedCode}`,
          );
          const json = JSON.parse(rawText) as { code: string | null };
          assert.equal(
            json.code,
            testCase.expectedCode,
            `Mismatch for ${testCase.status} ${testCase.upstreamMessage}`,
          );
        },
      );
    }
  });
});

describe("provider-workspace strict decoders and time normalization", () => {
  it("normalizes HH:mm and HH:mm:00 and rejects non-zero seconds or bad formats", () => {
    assert.equal(normalizeTimeToHhMm("08:30"), "08:30");
    assert.equal(normalizeTimeToHhMm("08:30:00"), "08:30");
    assert.equal(normalizeTimeToHhMm("23:59:00"), "23:59");
    assert.equal(normalizeTimeToHhMm("08:30:30"), null);
    assert.equal(normalizeTimeToHhMm("8:30"), null);
    assert.equal(normalizeTimeToHhMm("24:00"), null);
    assert.equal(normalizeTimeToHhMm(""), null);
  });

  it("decodes valid provider entities including real PostgreSQL numeric/time shapes and nullable KPIs", () => {
    assert.deepEqual(
      decodeProviderProfile({ ...SAMPLE_PROFILE, ratingAvg: "0" }),
      { ...SAMPLE_PROFILE, ratingAvg: "0" },
    );
    assert.deepEqual(
      decodeWorkingHours([
        SAMPLE_WORKING_HOUR,
        { ...SAMPLE_WORKING_HOUR, id: "12", startTime: "17:00", endTime: "20:00" },
      ]).length,
      2,
    );
    assert.equal(
      decodeProviderService(SAMPLE_SERVICE_MUTATION).category,
      null,
    );
    assert.deepEqual(
      decodeProviderServices([SAMPLE_SERVICE_GET])[0].category,
      SAMPLE_CATEGORY,
    );
    assert.equal(
      decodeProviderAvailabilitySlot({
        ...SAMPLE_SLOT_MUTATION,
        startTime: "09:00",
        endTime: "10:00",
      }).service,
      null,
    );
    assert.equal(
      decodeProviderAvailabilitySlots([SAMPLE_SLOT_GET])[0].service?.id,
      "5",
    );
    assert.deepEqual(
      decodeProviderBookings([
        {
          ...SAMPLE_PROVIDER_BOOKING,
          pet: {
            ...SAMPLE_PROVIDER_BOOKING.pet,
            weight: "12.5",
            birthDate: null,
          },
        },
      ])[0].pet.weight,
      "12.5",
    );
    assert.equal(
      decodeProviderBookingDetail(SAMPLE_PROVIDER_BOOKING_DETAIL, "100")
        .statusLogs.length,
      1,
    );

    const decodedDash = decodeProviderDashboard(SAMPLE_DASHBOARD, {
      from: "2026-10-01",
      to: "2026-10-31",
    });
    assert.equal(decodedDash.alerts.length, 5);
    assert.equal(decodedDash.alerts[0].code, "PEAK_HOUR_DEMAND");

    // Zero-denominator dashboard (N/A metrics -> null rate and null average).
    const emptyDash = decodeProviderDashboard({
      providerId: "3",
      period: { from: "2026-10-01", to: "2026-10-01" },
      bookingVolumeByStatus: {
        PENDING_CONFIRMATION: 1,
        CONFIRMED: 0,
        REJECTED: 0,
        COMPLETED: 0,
        CANCELLED: 0,
        NO_SHOW: 0,
        total: 1,
      },
      cancellationRate: {
        cancelledBookings: 0,
        resolvedBookings: 0,
        rate: null,
      },
      popularServices: [],
      returningCustomers: { count: 0 },
      recordedRevenue: { amount: "0.00" },
      averageRating: { reviewCount: 0, average: null },
      alerts: [],
    });
    assert.equal(emptyDash.cancellationRate.rate, null);
    assert.equal(emptyDash.averageRating.average, null);

    // Real PostgreSQL node-postgres raw DATE serialization on PEAK_HOUR_DEMAND.context.date:
    // accepts YYYY-MM-DD as-is, UTC+7 midnight ISO ("2026-11-23T17:00:00.000Z" -> "2026-11-24"),
    // and UTC midnight ISO ("2026-11-24T00:00:00.000Z" -> "2026-11-24").
    for (const [rawDate, expectedDate] of [
      ["2026-11-24", "2026-11-24"],
      ["2026-11-23T17:00:00.000Z", "2026-11-24"],
      ["2026-11-24T00:00:00.000Z", "2026-11-24"],
    ] as const) {
      const peakDash = decodeProviderDashboard({
        ...SAMPLE_DASHBOARD,
        alerts: [
          {
            code: "PEAK_HOUR_DEMAND",
            severity: "WARNING",
            message: "66.67% of accepted bookings start between 17:00 and 20:00.",
            recommendation: "Review staffing.",
            context: {
              date: rawDate,
              peakAcceptedBookings: 2,
              totalAcceptedBookings: 3,
              percentage: 66.67,
            },
          },
        ],
      });
      assert.equal(peakDash.alerts[0].code, "PEAK_HOUR_DEMAND");
      if (peakDash.alerts[0].code === "PEAK_HOUR_DEMAND") {
        assert.equal(peakDash.alerts[0].context.date, expectedDate);
      }
    }
  });

  it("rejects malformed BIGINT IDs, invalid enums, broken invariants, and mismatched dashboard contexts", () => {
    assert.throws(() =>
      decodeProviderProfile({ ...SAMPLE_PROFILE, id: 3 }),
    );
    assert.throws(() =>
      decodeProviderProfile({ ...SAMPLE_PROFILE, approvalStatus: "ACTIVE" }),
    );
    assert.throws(() =>
      decodeProviderProfile({ ...SAMPLE_PROFILE, ratingAvg: "5.50" }),
    );
    assert.throws(() =>
      decodeWorkingHour({ ...SAMPLE_WORKING_HOUR, dayOfWeek: 7 }),
    );
    assert.throws(() =>
      decodeWorkingHour({
        ...SAMPLE_WORKING_HOUR,
        startTime: "17:00:00",
        endTime: "09:00:00",
      }),
    );
    assert.throws(() =>
      decodeProviderService(SAMPLE_SERVICE_MUTATION, { requireCategory: true }),
    );
    assert.throws(() =>
      decodeProviderService({ ...SAMPLE_SERVICE_MUTATION, price: "150000" }),
    );
    assert.throws(() =>
      decodeProviderAvailabilitySlot({
        ...SAMPLE_SLOT_MUTATION,
        bookedCount: 4,
        capacity: 3,
      }),
    );
    assert.throws(() =>
      decodeProviderAvailabilitySlot(SAMPLE_SLOT_MUTATION, {
        requireService: true,
      }),
    );
    assert.throws(() =>
      decodeProviderBooking(SAMPLE_PROVIDER_BOOKING, "101"),
    );
    assert.throws(() =>
      decodeProviderDashboard(
        {
          ...SAMPLE_DASHBOARD,
          bookingVolumeByStatus: {
            ...SAMPLE_DASHBOARD.bookingVolumeByStatus,
            total: 99,
          },
        },
        { from: "2026-10-01", to: "2026-10-31" },
      ),
    );
    assert.throws(() =>
      decodeProviderDashboard(SAMPLE_DASHBOARD, {
        from: "2026-10-01",
        to: "2026-10-30",
      }),
    );
    assert.throws(() =>
      decodeProviderDashboard({
        ...SAMPLE_DASHBOARD,
        alerts: [
          {
            code: "LOW_RATING",
            severity: "WARNING",
            message: "x",
            recommendation: "y",
            context: { from: "2026-10-31", to: "2026-10-01", reviewCount: 1, average: 3.5 },
          },
        ],
      }),
    );

    // Reject malformed or rollover PEAK_HOUR_DEMAND.context.date strings.
    for (const badDate of [
      "2026-02-30",
      "2026-02-30T00:00:00.000Z",
      "not-a-date",
      "",
      12345,
    ]) {
      assert.throws(() =>
        decodeProviderDashboard({
          ...SAMPLE_DASHBOARD,
          alerts: [
            {
              code: "PEAK_HOUR_DEMAND",
              severity: "WARNING",
              message: "x",
              recommendation: "y",
              context: {
                date: badDate,
                peakAcceptedBookings: 2,
                totalAcceptedBookings: 3,
                percentage: 66.67,
              },
            },
          ],
        }),
      );
    }
  });
});

describe("createProviderWorkspaceApi operations, error taxonomy, cache invalidation and session isolation", () => {
  it("normalizes HH:mm:00 times on mutations, rejects non-zero seconds upfront, and reuses public categories API", async () => {
    const sent: Array<{ path: string; method?: string; body?: unknown }> = [];
    const bffStub: BffRequester = async (path, options, decode) => {
      sent.push({ path, method: options?.method, body: options?.body });
      if (path === "/providers/working-hours" && options?.method === "POST") {
        const raw = { ...SAMPLE_WORKING_HOUR, startTime: "08:00", endTime: "12:00" };
        return { status: 201, body: decode ? decode(raw) : raw, headers: new Headers() };
      }
      if (path === "/availability" && options?.method === "POST") {
        const raw = { ...SAMPLE_SLOT_MUTATION, startTime: "09:00", endTime: "10:00" };
        return { status: 201, body: decode ? decode(raw) : raw, headers: new Headers() };
      }
      throw new Error(`Unexpected call: ${options?.method} ${path}`);
    };

    let categoryCredentials: RequestCredentials | undefined;
    const api = createProviderWorkspaceApi({
      bffRequestImpl: bffStub,
      cache: null,
      publicApiUrl: API_ORIGIN,
      publicFetchImpl: async (_url, init) => {
        categoryCredentials = init.credentials;
        return Response.json([
          { id: "2", name: "Grooming", description: "Bath and trim" },
        ]);
      },
    });

    await api.createWorkingHour({
      dayOfWeek: 1,
      startTime: "08:00:00",
      endTime: "12:00:00",
    });
    assert.deepEqual(sent[0].body, {
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "12:00",
    });

    await api.createAvailabilitySlot({
      serviceId: "5",
      slotDate: "2026-11-10",
      startTime: "09:00:00",
      endTime: "10:00:00",
      capacity: 3,
    });
    assert.deepEqual(sent[1].body, {
      serviceId: "5",
      slotDate: "2026-11-10",
      startTime: "09:00",
      endTime: "10:00",
      capacity: 3,
    });

    // Rejects non-zero seconds and invalid time/date ranges before hitting BFF.
    await assert.rejects(
      () =>
        api.createWorkingHour({
          dayOfWeek: 1,
          startTime: "08:00:30",
          endTime: "12:00",
        }),
      (err: unknown) =>
        err instanceof ProviderWorkspaceApiError &&
        err.code === "INVALID_INPUT" &&
        err.outcome === "definite-failure",
    );
    await assert.rejects(
      () =>
        api.updateAvailabilitySlot("12", {
          startTime: "14:00:00",
          endTime: "14:00:00",
        }),
      (err: unknown) =>
        err instanceof ProviderWorkspaceApiError &&
        err.code === "INVALID_TIME_RANGE" &&
        err.outcome === "definite-failure",
    );
    await assert.rejects(
      () => api.getProviderDashboard({ from: "2026-10-31", to: "2026-10-01" }),
      (err: unknown) =>
        err instanceof ProviderWorkspaceApiError &&
        err.code === "INVALID_DATE_RANGE" &&
        err.outcome === "definite-failure",
    );
    assert.equal(sent.length, 2);

    const categories = await api.listActiveServiceCategories();
    assert.equal(categoryCredentials, "omit");
    assert.deepEqual(categories, [
      { id: "2", name: "Grooming", description: "Bath and trim" },
    ]);
  });

  it("classifies unknown vs definite-failure, session-busy, rate-limited and session-ended accurately", () => {
    const netOnMutation = classifyProviderError(
      new ApiError("network"),
      "confirm-booking",
    );
    assert.equal(netOnMutation.outcome, "unknown");
    assert.equal(netOnMutation.shouldReconcile, true);

    const serverOnMutation = classifyProviderError(
      new ApiError("http", 503),
      "create-service",
    );
    assert.equal(serverOnMutation.outcome, "unknown");
    assert.equal(serverOnMutation.shouldReconcile, true);

    const invalidOnMutation = classifyProviderError(
      new ApiError("invalid-response", 200),
      "reject-booking",
    );
    assert.equal(invalidOnMutation.outcome, "unknown");
    assert.equal(invalidOnMutation.shouldReconcile, true);

    const netOnQuery = classifyProviderError(
      new ApiError("network"),
      "list-bookings",
    );
    assert.equal(netOnQuery.outcome, "definite-failure");
    assert.equal(netOnQuery.shouldReconcile, false);

    const busy = classifyProviderError(
      new ApiError("http", 409, "SESSION_BUSY"),
      "update-profile",
    );
    assert.equal(busy.outcome, "session-busy");
    assert.equal(busy.code, "SESSION_BUSY");

    const rateLimited = classifyProviderError(
      new ApiError("http", 429, "RATE_LIMITED", null, 45),
      "get-dashboard",
    );
    assert.equal(rateLimited.outcome, "rate-limited");
    assert.equal(rateLimited.retryAfterSeconds, 45);

    const sessionEnded = classifyProviderError(
      new ApiError("http", 401, "SESSION_ENDED"),
      "list-services",
    );
    assert.equal(sessionEnded.outcome, "session-ended");

    const lifecycle = classifyProviderError(
      new ApiError("http", 403, "PROVIDER_SUSPENDED_FORBIDDEN"),
      "create-availability",
    );
    assert.equal(lifecycle.outcome, "definite-failure");
    assert.equal(lifecycle.category, "lifecycle");
    assert.equal(lifecycle.shouldReconcile, true);

    // Ensure SessionBusy / SessionEnded instances work smoothly with handler errors too.
    assert.ok(new SessionBusy() instanceof Error);
    assert.ok(new SessionEnded() instanceof Error);
  });

  it("enforces cross-invalidation (including on unknown mutation outcome) and isolates queryKeys.provider across sessions", async () => {
    const cache = new QueryCache();
    cache.changeSession("provider-owner-30");
    assert.equal(queryFreshness.provider, 0);

    // Seed entries with positive TTL to verify exact prefix invalidation behavior.
    const seedAll = () => {
      const now = Date.now();
      cache.write(cache.ticket(queryKeys.provider.profile()), SAMPLE_PROFILE, 60_000, now);
      cache.write(cache.ticket(queryKeys.provider.workingHours()), [SAMPLE_WORKING_HOUR], 60_000, now);
      cache.write(cache.ticket(queryKeys.provider.services()), [SAMPLE_SERVICE_GET], 60_000, now);
      cache.write(cache.ticket(queryKeys.provider.availability()), [SAMPLE_SLOT_GET], 60_000, now);
      cache.write(cache.ticket(queryKeys.provider.bookings()), [SAMPLE_PROVIDER_BOOKING], 60_000, now);
      cache.write(cache.ticket(queryKeys.provider.bookingDetail("100")), SAMPLE_PROVIDER_BOOKING_DETAIL, 60_000, now);
      cache.write(cache.ticket(queryKeys.provider.dashboard("2026-10-01", "2026-10-31")), SAMPLE_DASHBOARD, 60_000, now);
    };

    let failNetwork = false;
    const api = createProviderWorkspaceApi({
      cache,
      bffRequestImpl: async (path, options, decode) => {
        if (failNetwork) throw new ApiError("network");
        if (path === "/bookings/provider/100/reject" && options?.method === "POST") {
          const raw = { ...SAMPLE_PROVIDER_BOOKING, status: "REJECTED" };
          return { status: 201, body: decode ? decode(raw) : raw, headers: new Headers() };
        }
        if (path === "/services/mine/5" && options?.method === "DELETE") {
          return { status: 204, body: decode ? decode(null) : null, headers: new Headers() };
        }
        if (path === "/providers/me" && options?.method === "GET") {
          return { status: 200, body: decode ? decode(SAMPLE_PROFILE) : SAMPLE_PROFILE, headers: new Headers() };
        }
        throw new Error(`Unexpected: ${options?.method} ${path}`);
      },
    });

    // Reject booking invalidates bookings, bookingDetail, availability (capacity released), and dashboardAll, keeping profile.
    seedAll();
    await api.rejectProviderBooking("100", { reason: "Full" });
    assert.equal(cache.read(queryKeys.provider.bookings()), undefined);
    assert.equal(cache.read(queryKeys.provider.bookingDetail("100")), undefined);
    assert.equal(cache.read(queryKeys.provider.availability()), undefined);
    assert.equal(
      cache.read(queryKeys.provider.dashboard("2026-10-01", "2026-10-31")),
      undefined,
    );
    assert.notEqual(cache.read(queryKeys.provider.profile()), undefined);

    // Unknown mutation failure on deactivateService still invalidates services, availability, and dashboardAll.
    seedAll();
    failNetwork = true;
    await assert.rejects(
      () => api.deactivateService("5"),
      (err: unknown) =>
        err instanceof ProviderWorkspaceApiError &&
        err.outcome === "unknown" &&
        err.shouldReconcile === true,
    );
    assert.equal(cache.read(queryKeys.provider.services()), undefined);
    assert.equal(cache.read(queryKeys.provider.availability()), undefined);
    assert.equal(
      cache.read(queryKeys.provider.dashboard("2026-10-01", "2026-10-31")),
      undefined,
    );
    failNetwork = false;

    // Session switch fences an in-flight GET so stale session data cannot land.
    let releaseGet!: () => void;
    const delayedApi = createProviderWorkspaceApi({
      cache,
      bffRequestImpl: async (_path, _options, decode) => {
        await new Promise<void>((resolve) => {
          releaseGet = resolve;
        });
        return {
          status: 200,
          body: decode ? decode(SAMPLE_PROFILE) : SAMPLE_PROFILE,
          headers: new Headers(),
        };
      },
    });
    const inFlight = delayedApi.getProviderProfile();
    cache.changeSession("provider-owner-99");
    releaseGet();
    await assert.rejects(
      () => inFlight,
      (err: unknown) => err instanceof Error && err.name === "AbortError",
    );
    assert.equal(cache.read(queryKeys.provider.profile()), undefined);

    // Caller AbortSignal propagates AbortError cleanly (not wrapped).
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => api.getProviderProfile({ signal: controller.signal }),
      (err: unknown) => err instanceof Error && err.name === "AbortError",
    );
  });
});
