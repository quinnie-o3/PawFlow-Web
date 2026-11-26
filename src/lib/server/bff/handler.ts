import { isIP } from "node:net";
import { apiBaseUrl } from "../../api/config";
import { createApiClient } from "../../api/transport";
import { ApiError } from "../../api/errors";
import { decodeUser } from "../../../features/session/model";
import {
  sessionStore,
  sessionHash,
  SessionEnded,
  SessionBusy,
  type Session,
  type SessionStore,
  type Tokens,
} from "./store";

const MAX_BIGINT_ID = BigInt("9223372036854775807");
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function validBigIntId(value: string): boolean {
  return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= MAX_BIGINT_ID;
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1) return false;
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDashboardRange(request: Request): { from: string; to: string } {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (key !== "from" && key !== "to") {
      throw new ApiError("http", 400, "INVALID_QUERY");
    }
  }
  const fromValues = params.getAll("from");
  const toValues = params.getAll("to");
  if (fromValues.length > 1 || toValues.length > 1) {
    throw new ApiError("http", 400, "INVALID_QUERY");
  }
  if (fromValues.length !== 1 || toValues.length !== 1) {
    throw new ApiError("http", 400, "INVALID_DATE_RANGE");
  }
  const [from] = fromValues;
  const [to] = toValues;
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
    throw new ApiError("http", 400, "INVALID_DATE_RANGE");
  }
  return { from, to };
}

function isBookingPath(path: string): boolean {
  if (path === "bookings" || path === "bookings/mine") return true;
  const detail = /^bookings\/mine\/([1-9]\d{0,18})(?:\/cancel)?$/.exec(path);
  return detail !== null && validBigIntId(detail[1]);
}

function isProviderPath(path: string): boolean {
  if (
    path === "providers/me" ||
    path === "providers/working-hours" ||
    path === "services" ||
    path === "services/mine" ||
    path === "availability" ||
    path === "availability/mine" ||
    path === "bookings/provider" ||
    path === "dashboard/provider"
  ) {
    return true;
  }
  const workingHour = /^providers\/working-hours\/([1-9]\d{0,18})$/.exec(path);
  if (workingHour) return validBigIntId(workingHour[1]);
  const service = /^services\/mine\/([1-9]\d{0,18})$/.exec(path);
  if (service) return validBigIntId(service[1]);
  const slot = /^availability\/mine\/([1-9]\d{0,18})$/.exec(path);
  if (slot) return validBigIntId(slot[1]);
  const booking =
    /^bookings\/provider\/([1-9]\d{0,18})(?:\/(?:confirm|reject|complete|no-show))?$/.exec(
      path,
    );
  return booking !== null && validBigIntId(booking[1]);
}

// Exact public PawFlow-API booking exception messages mapped to stable machine
// codes so BFF error responses stay sanitized without losing conflict semantics.
const BOOKING_ERROR_CODES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  "400": {
    "The selected availability slot is in the past": "SLOT_STARTED",
    "The selected availability slot has already started": "SLOT_STARTED",
    "The selected service is not active": "SERVICE_UNAVAILABLE",
    "The selected service category is not active": "SERVICE_UNAVAILABLE",
    "The selected provider is not approved for booking": "PROVIDER_UNAVAILABLE",
    'Idempotency-Key must be 16-128 characters long and contain only letters, digits, "-" or "_" (for example a UUID)':
      "INVALID_IDEMPOTENCY_KEY",
  },
  "404": {
    "Availability slot not found": "SLOT_UNAVAILABLE",
    "Active pet belonging to the customer was not found": "PET_UNAVAILABLE",
    "Service for this availability slot was not found": "SERVICE_UNAVAILABLE",
    "Provider not found": "PROVIDER_UNAVAILABLE",
    "Booking not found": "BOOKING_NOT_FOUND",
  },
  "409": {
    "Availability slot is full": "SLOT_FULL",
    "Availability slot is not open for booking": "SLOT_CLOSED",
    "The selected availability slot is outside the provider's working hours":
      "SLOT_OUTSIDE_WORKING_HOURS",
    "The selected availability slot is shorter than the service duration":
      "SLOT_TOO_SHORT",
    "A booking request with this Idempotency-Key is still being processed; retry the same request":
      "IDEMPOTENCY_IN_PROGRESS",
    "This Idempotency-Key was already used for a different booking request":
      "IDEMPOTENCY_CONFLICT",
    "Only pending confirmation or confirmed bookings can be cancelled":
      "CANCEL_STATUS",
    "Bookings can only be cancelled before the appointment starts":
      "CANCEL_TIME",
    "Availability slot has no reserved capacity to release":
      "NO_RESERVED_CAPACITY",
  },
};

function bookingErrorCode(path: string, error: ApiError): string | null {
  if (
    !isBookingPath(path) ||
    error.kind !== "http" ||
    error.status === null ||
    !error.serverMessage
  )
    return null;
  const byStatus = BOOKING_ERROR_CODES[String(error.status)];
  if (!byStatus) return null;
  return Object.hasOwn(byStatus, error.serverMessage)
    ? byStatus[error.serverMessage]
    : null;
}

// Exact and anchored-regex public PawFlow-API provider exception messages mapped
// to stable machine codes; raw upstream messages and 5xx details never leak.
const PROVIDER_ERROR_CODES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  "400": {
    "Availability slots can only use active services": "SERVICE_INACTIVE",
    "slotDate cannot be in the past": "SLOT_IN_PAST",
    "The availability slot has already started; its start time must be in the future":
      "SLOT_STARTED",
    "startTime must be earlier than endTime": "INVALID_TIME_RANGE",
    "The reporting period start date must not be after the end date":
      "INVALID_DATE_RANGE",
  },
  "403": {
    "A SUSPENDED provider cannot update its profile":
      "PROVIDER_SUSPENDED_READONLY",
    "A REJECTED provider cannot manage services, availability or staff":
      "PROVIDER_REJECTED_FORBIDDEN",
    "A SUSPENDED provider cannot manage services, availability or staff":
      "PROVIDER_SUSPENDED_FORBIDDEN",
    "Active provider staff association is required":
      "STAFF_ASSOCIATION_REQUIRED",
    "You do not have permission to access this resource": "FORBIDDEN_ROLE",
    "You do not have permission to manage provider bookings": "FORBIDDEN_ROLE",
    "Authenticated user is required": "FORBIDDEN_ROLE",
    "Forbidden resource": "FORBIDDEN_ROLE",
  },
  "404": {
    "Provider profile not found": "PROVIDER_PROFILE_NOT_FOUND",
    "Provider working-hour record not found": "WORKING_HOUR_NOT_FOUND",
    "Service not found": "SERVICE_NOT_FOUND",
    "Active service category not found": "CATEGORY_NOT_FOUND",
    "Availability slot not found": "SLOT_NOT_FOUND",
    "Booking not found": "BOOKING_NOT_FOUND",
  },
  "409": {
    "This working-hour entry already exists": "WORKING_HOUR_DUPLICATE",
    "An identical availability slot already exists": "SLOT_DUPLICATE",
    "The slot must fit entirely within one of the provider's active working hours for that day":
      "SLOT_OUTSIDE_WORKING_HOURS",
    "Cannot change service, date, or time of a slot that already has bookings":
      "SLOT_HAS_BOOKINGS_LOCKED_FIELDS",
    "capacity cannot be lower than bookedCount": "SLOT_CAPACITY_BELOW_BOOKED",
    "Only a pending confirmation booking can be updated": "BOOKING_NOT_PENDING",
    "Only a confirmed booking can be updated": "BOOKING_NOT_CONFIRMED",
    "Availability slot has no reserved capacity to release":
      "NO_RESERVED_CAPACITY",
  },
};

const PROVIDER_ERROR_PATTERNS: Readonly<
  Record<string, readonly Readonly<{ pattern: RegExp; code: string }>[]>
> = {
  "403": [
    {
      pattern:
        /^A (?:PENDING|REJECTED|SUSPENDED) provider cannot confirm bookings$/,
      code: "PROVIDER_CONFIRM_FORBIDDEN",
    },
  ],
  "409": [
    {
      pattern:
        /^This working-hour entry overlaps the active entry \d{2}:\d{2}(?::\d{2})?-\d{2}:\d{2}(?::\d{2})? on the same day\. Adjacent entries are allowed; deactivate or change the other entry first\.$/,
      code: "WORKING_HOUR_OVERLAP",
    },
    {
      pattern:
        /^This working-hour change would leave [1-9]\d* active booking\(s\) outside working hours\. Cancel or reschedule them first\.$/,
      code: "WORKING_HOUR_HAS_ACTIVE_BOOKINGS",
    },
    {
      pattern:
        /^durationMinutes cannot exceed the length of [1-9]\d* upcoming slot\(s\) that already have active bookings$/,
      code: "SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS",
    },
    {
      pattern:
        /^The slot must last at least [1-9]\d* minutes, the duration of its service$/,
      code: "SLOT_TOO_SHORT",
    },
    {
      // Reserved for BR-08 if the backend adds a time-window check on no-show.
      pattern:
        /^(?:A booking|Bookings) can only be marked as no-show (?:at or after|after|once) the (?:scheduled )?appointment(?: start)? time(?: has been reached or passed)?\.?$/i,
      code: "NO_SHOW_TIME",
    },
  ],
};

function providerErrorCode(path: string, error: ApiError): string | null {
  if (
    !isProviderPath(path) ||
    error.kind !== "http" ||
    error.status === null ||
    error.status >= 500 ||
    !error.serverMessage
  ) {
    return null;
  }
  const statusKey = String(error.status);
  const exactByStatus = PROVIDER_ERROR_CODES[statusKey];
  if (exactByStatus && Object.hasOwn(exactByStatus, error.serverMessage)) {
    return exactByStatus[error.serverMessage];
  }
  const patternsByStatus = PROVIDER_ERROR_PATTERNS[statusKey];
  if (patternsByStatus) {
    for (const entry of patternsByStatus) {
      if (entry.pattern.test(error.serverMessage)) {
        return entry.code;
      }
    }
  }
  return null;
}

const DSS_ALERT_CONTEXT_KEYS: Readonly<Record<string, readonly string[]>> = {
  PEAK_HOUR_DEMAND: [
    "date",
    "peakAcceptedBookings",
    "totalAcceptedBookings",
    "percentage",
  ],
  HIGH_SERVICE_CANCELLATION: [
    "month",
    "serviceId",
    "cancelledBookings",
    "resolvedBookings",
    "percentage",
  ],
  UNDERUSED_SERVICE: [
    "month",
    "serviceId",
    "completedBookings",
    "comparisonAverage",
  ],
  FREQUENT_RETURNING_CUSTOMER: [
    "customerId",
    "completedBookings",
    "from",
    "to",
  ],
  LOW_RATING: ["from", "to", "reviewCount", "average"],
};

export type BffHandlerDeps = {
  store?: Pick<
    SessionStore,
    | "read"
    | "create"
    | "access"
    | "open"
    | "assertCurrent"
    | "revoke"
    | "end"
    | "beginLogin"
    | "activate"
    | "failLogin"
    | "revokeUser"
    | "revokeBackend"
  >;
};

const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
};
const production = () => process.env.NODE_ENV === "production";
const cookieName = () =>
  production() ? "__Host-pawflow-session" : "pawflow-session";
function cookie(value: string, clear = false) {
  return `${cookieName()}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${clear ? 0 : 2592000}${production() ? "; Secure" : ""}`;
}
export function trustedOrigin(request: Request) {
  const origin =
    process.env.BFF_APP_ORIGIN ||
    (!production() ? new URL(request.url).origin : "");
  if (
    !origin ||
    new URL(origin).origin !== origin ||
    (production() && !origin.startsWith("https://"))
  )
    throw new Error("Invalid BFF origin configuration");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    request.headers.get("origin") === origin &&
    (!fetchSite || fetchSite === "same-origin" || fetchSite === "none")
  );
}
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new ApiError("http", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 16384)
    throw new ApiError("http", 413);
  const reader = request.body?.getReader();
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) {
        await reader.cancel();
        throw new ApiError("http", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body;
  } catch {
    throw new ApiError("http", 400);
  }
}
function allowedFields(body: Record<string, unknown>, fields: string[]) {
  if (Object.keys(body).some((key) => !fields.includes(key)))
    throw new ApiError("http", 400);
}
export function clientHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const agent = request.headers.get("user-agent");
  if (agent) headers["User-Agent"] = agent.slice(0, 512);
  // Enable only behind an ingress that overwrites this header and blocks direct origin access.
  if (process.env.BFF_TRUST_PROXY_HEADERS === "true") {
    const ip = request.headers.get("x-pawflow-client-ip");
    if (!ip || !isIP(ip)) throw new ApiError("config");
    headers["X-Forwarded-For"] = ip;
    headers["X-Forwarded-Proto"] = "https";
  }
  return headers;
}
export async function upstream(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
  token?: string,
  client: Record<string, string> = {},
) {
  const base = apiBaseUrl(process.env.PAWFLOW_API_URL ?? "");
  if (production() && new URL(base).protocol !== "https:")
    throw new ApiError("config");
  return createApiClient({
    apiUrl: base,
    fetchImpl: (url, init) => fetch(url, { ...init, redirect: "error" }),
  }).request(path, {
    method,
    body,
    signal: AbortSignal.timeout(8000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...client,
    },
  });
}
function authTokens(body: unknown) {
  const data = body as Record<string, unknown>;
  if (
    !data ||
    typeof data.accessToken !== "string" ||
    !data.accessToken ||
    typeof data.refreshToken !== "string" ||
    !/^[\w-]{43}$/.test(data.refreshToken) ||
    data.tokenType !== "Bearer" ||
    typeof data.expiresIn !== "number" ||
    !Number.isFinite(data.expiresIn) ||
    data.expiresIn <= 0 ||
    typeof data.refreshTokenExpiresAt !== "string"
  )
    throw new ApiError("invalid-response");
  const expires = new Date(data.refreshTokenExpiresAt);
  if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now())
    throw new ApiError("invalid-response");
  return {
    tokens: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    } as Tokens,
    expires,
    accessExpires: new Date(Date.now() + data.expiresIn * 1000),
  };
}
function publicResponse(
  path: string,
  body: unknown,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
): unknown {
  const pick = (value: unknown, keys: readonly string[]) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ApiError("invalid-response");
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      keys.filter((k) => Object.hasOwn(source, k)).map((k) => [k, source[k]]),
    );
  };
  const projectBooking = (value: unknown, includeLogs: boolean) => {
    const base = pick(value, [
      "id",
      "status",
      "bookedPrice",
      "customerNote",
      "createdAt",
      "updatedAt",
    ]);
    const source = value as Record<string, unknown>;
    const petSource = pick(source.pet, ["id", "name", "breed", "petType"]);
    const pet = {
      ...petSource,
      petType: pick(petSource.petType, ["id", "name"]),
    };
    const service = pick(source.service, ["id", "name", "durationMinutes"]);
    const slot = pick(source.slot, ["id", "slotDate", "startTime", "endTime"]);
    const provider = pick(source.provider, ["id", "businessName", "address"]);
    if (!includeLogs) return { ...base, service, slot, pet, provider };
    if (!Array.isArray(source.statusLogs))
      throw new ApiError("invalid-response");
    const statusLogs = source.statusLogs.map((log) =>
      pick(log, ["id", "oldStatus", "newStatus", "reason", "createdAt"]),
    );
    return { ...base, service, slot, pet, provider, statusLogs };
  };
  const projectProvider = (value: unknown) =>
    pick(value, [
      "id",
      "ownerId",
      "businessName",
      "address",
      "phone",
      "description",
      "approvalStatus",
      "ratingAvg",
      "ratingCount",
      "createdAt",
      "updatedAt",
    ]);
  const projectWorkingHour = (value: unknown) =>
    pick(value, [
      "id",
      "providerId",
      "dayOfWeek",
      "startTime",
      "endTime",
      "isActive",
      "createdAt",
      "updatedAt",
    ]);
  const projectService = (value: unknown, requireCategory: boolean) => {
    const base = pick(value, [
      "id",
      "providerId",
      "categoryId",
      "name",
      "price",
      "durationMinutes",
      "description",
      "status",
      "createdAt",
      "updatedAt",
    ]);
    const source = value as Record<string, unknown>;
    if (
      requireCategory ||
      (Object.hasOwn(source, "category") &&
        source.category !== undefined &&
        source.category !== null)
    ) {
      const category = pick(source.category, [
        "id",
        "name",
        "description",
        "status",
      ]);
      return { ...base, category };
    }
    return base;
  };
  const projectAvailabilitySlot = (value: unknown, requireService: boolean) => {
    const base = pick(value, [
      "id",
      "providerId",
      "serviceId",
      "slotDate",
      "startTime",
      "endTime",
      "capacity",
      "bookedCount",
      "status",
      "createdAt",
      "updatedAt",
    ]);
    const source = value as Record<string, unknown>;
    if (
      requireService ||
      (Object.hasOwn(source, "service") &&
        source.service !== undefined &&
        source.service !== null)
    ) {
      const service = pick(source.service, [
        "id",
        "categoryId",
        "name",
        "price",
        "durationMinutes",
        "description",
        "status",
      ]);
      return { ...base, service };
    }
    return base;
  };
  const projectProviderBooking = (value: unknown, includeLogs: boolean) => {
    const base = pick(value, [
      "id",
      "status",
      "bookedPrice",
      "customerNote",
      "createdAt",
      "updatedAt",
    ]);
    const source = value as Record<string, unknown>;
    const service = pick(source.service, ["id", "name", "durationMinutes"]);
    const slot = pick(source.slot, ["id", "slotDate", "startTime", "endTime"]);
    const customer = pick(source.customer, ["id", "fullName"]);
    const petSource = pick(source.pet, [
      "id",
      "name",
      "breed",
      "birthDate",
      "weight",
      "healthNote",
      "petType",
    ]);
    const pet = {
      ...petSource,
      petType: pick(petSource.petType, ["id", "name"]),
    };
    if (!includeLogs) return { ...base, service, slot, customer, pet };
    if (!Array.isArray(source.statusLogs))
      throw new ApiError("invalid-response");
    const statusLogs = source.statusLogs.map((log) =>
      pick(log, ["id", "oldStatus", "newStatus", "reason", "createdAt"]),
    );
    return { ...base, service, slot, customer, pet, statusLogs };
  };
  const projectProviderDashboard = (value: unknown) => {
    const base = pick(value, ["providerId"]);
    const source = value as Record<string, unknown>;
    const period = pick(source.period, ["from", "to"]);
    const bookingVolumeByStatus = pick(source.bookingVolumeByStatus, [
      "PENDING_CONFIRMATION",
      "CONFIRMED",
      "REJECTED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
      "total",
    ]);
    const cancellationRate = pick(source.cancellationRate, [
      "cancelledBookings",
      "resolvedBookings",
      "rate",
    ]);
    if (!Array.isArray(source.popularServices))
      throw new ApiError("invalid-response");
    const popularServices = source.popularServices.map((item) =>
      pick(item, ["serviceId", "serviceName", "completedBookings"]),
    );
    const returningCustomers = pick(source.returningCustomers, ["count"]);
    const recordedRevenue = pick(source.recordedRevenue, ["amount"]);
    const averageRating = pick(source.averageRating, [
      "reviewCount",
      "average",
    ]);
    if (!Array.isArray(source.alerts))
      throw new ApiError("invalid-response");
    const alerts = source.alerts.map((item) => {
      const alertBase = pick(item, [
        "code",
        "severity",
        "message",
        "recommendation",
      ]);
      const alertSource = item as Record<string, unknown>;
      const code = typeof alertBase.code === "string" ? alertBase.code : "";
      if (!Object.hasOwn(DSS_ALERT_CONTEXT_KEYS, code))
        throw new ApiError("invalid-response");
      const context = pick(alertSource.context, DSS_ALERT_CONTEXT_KEYS[code]);
      return { ...alertBase, context };
    });
    return {
      ...base,
      period,
      bookingVolumeByStatus,
      cancellationRate,
      popularServices,
      returningCustomers,
      recordedRevenue,
      averageRating,
      alerts,
    };
  };
  if (
    path === "bookings" ||
    /^bookings\/mine\/[1-9]\d{0,18}\/cancel$/.test(path)
  )
    return projectBooking(body, false);
  if (path === "bookings/mine") {
    if (!Array.isArray(body)) throw new ApiError("invalid-response");
    return body.map((item) => projectBooking(item, false));
  }
  if (/^bookings\/mine\/[1-9]\d{0,18}$/.test(path))
    return projectBooking(body, true);
  if (path === "providers/me") return projectProvider(body);
  if (path === "providers/working-hours") {
    if (method === "GET") {
      if (!Array.isArray(body)) throw new ApiError("invalid-response");
      return body.map(projectWorkingHour);
    }
    return projectWorkingHour(body);
  }
  if (/^providers\/working-hours\/[1-9]\d{0,18}$/.test(path))
    return projectWorkingHour(body);
  if (path === "services/mine") {
    if (!Array.isArray(body)) throw new ApiError("invalid-response");
    return body.map((item) => projectService(item, true));
  }
  if (path === "services") return projectService(body, false);
  if (/^services\/mine\/[1-9]\d{0,18}$/.test(path))
    return projectService(body, method === "GET");
  if (path === "availability/mine") {
    if (!Array.isArray(body)) throw new ApiError("invalid-response");
    return body.map((item) => projectAvailabilitySlot(item, true));
  }
  if (path === "availability") return projectAvailabilitySlot(body, false);
  if (/^availability\/mine\/[1-9]\d{0,18}$/.test(path))
    return projectAvailabilitySlot(body, method === "GET");
  if (path === "bookings/provider") {
    if (!Array.isArray(body)) throw new ApiError("invalid-response");
    return body.map((item) => projectProviderBooking(item, false));
  }
  if (/^bookings\/provider\/[1-9]\d{0,18}$/.test(path))
    return projectProviderBooking(body, true);
  if (
    /^bookings\/provider\/[1-9]\d{0,18}\/(?:confirm|reject|complete|no-show)$/.test(
      path,
    )
  )
    return projectProviderBooking(body, false);
  if (path === "dashboard/provider") return projectProviderDashboard(body);
  if (body === null) return null;
  if (path === "users/me")
    return pick(body, [
      "id",
      "fullName",
      "email",
      "phone",
      "role",
      "status",
      "createdAt",
      "updatedAt",
    ]);
  if (path.startsWith("pets")) {
    const pet = (value: unknown) =>
      pick(value, [
        "id",
        "ownerId",
        "petTypeId",
        "name",
        "breed",
        "birthDate",
        "weight",
        "healthNote",
        "status",
        "createdAt",
        "updatedAt",
      ]);
    return Array.isArray(body) ? body.map(pet) : pet(body);
  }
  if (path === "pet-types") {
    if (!Array.isArray(body)) throw new ApiError("invalid-response");
    return body.map((value) => pick(value, ["id", "name"]));
  }
  if (path === "auth/sessions") {
    if (!Array.isArray(body)) throw new ApiError("invalid-response");
    return body.map((value) =>
      pick(value, [
        "id",
        "createdAt",
        "lastUsedAt",
        "expiresAt",
        "userAgent",
        "ipAddress",
        "current",
      ]),
    );
  }
  return pick(body, ["message", "expiresAt"]);
}
const errorResponse = (error: unknown, path = "") => {
  const status =
    error instanceof SessionEnded
      ? 401
      : error instanceof SessionBusy
        ? 409
        : error instanceof ApiError
          ? error.kind === "invalid-response"
            ? 503
            : (error.status ?? 503)
          : 503;
  const code =
    error instanceof SessionEnded
      ? "SESSION_ENDED"
      : error instanceof SessionBusy
        ? "SESSION_BUSY"
        : error instanceof ApiError
          ? (error.code ??
            bookingErrorCode(path, error) ??
            providerErrorCode(path, error))
          : null;
  const retry = error instanceof ApiError ? error.retryAfterSeconds : null;
  return Response.json(
    {
      message:
        status === 401
          ? "Phiên đăng nhập đã kết thúc."
          : "Không thể hoàn tất yêu cầu.",
      code,
      ...(retry ? { retryAfterSeconds: retry } : {}),
    },
    {
      status,
      headers: {
        ...noStore,
        ...(retry ? { "Retry-After": String(retry) } : {}),
      },
    },
  );
};
export async function handleBff(
  request: Request,
  path: string,
  deps?: BffHandlerDeps,
): Promise<Response> {
  try {
    const backend = (
      path: string,
      method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
      body?: unknown,
      token?: string,
      extraHeaders: Record<string, string> = {},
    ) =>
      upstream(path, method, body, token, {
        ...clientHeaders(request),
        ...extraHeaders,
      });
    const method = request.method as "GET" | "POST" | "PATCH" | "DELETE";
    if (method !== "GET" && !trustedOrigin(request))
      return Response.json(
        { code: "CSRF_REJECTED" },
        { status: 403, headers: noStore },
      );
    const body = method !== "GET" ? await readBody(request) : undefined;
    const raw = request.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName() + "="))
      ?.slice(cookieName().length + 1);
    const store = deps?.store ?? sessionStore();
    let row =
      raw && /^[\w-]{43}$/.test(raw)
        ? await store.read(sessionHash(raw))
        : null;
    const reply = (
      data: unknown,
      status = 200,
      extra: Record<string, string> = {},
    ) =>
      status === 204
        ? new Response(null, { status, headers: { ...noStore, ...extra } })
        : Response.json(data, { status, headers: { ...noStore, ...extra } });
    const access = async (current: Session) =>
      store.access(current.id_hash, current.generation, async (tokens) => {
        const result = await backend("/auth/refresh", "POST", {
          refreshToken: tokens.refreshToken,
        });
        const next = authTokens(result.body);
        const user = decodeUser(
          (await backend("/auth/me", "GET", undefined, next.tokens.accessToken))
            .body,
        );
        if (user.id !== current.user_id) throw new SessionEnded();
        return next;
      });
    if (path === "session" && method === "POST") {
      let newCookie: string | undefined;
      if (!row || row.state === "revoked") {
        const created = await store.create();
        row = created.row;
        newCookie = created.cookie;
      }
      if (row.state === "anonymous")
        return reply(
          { generation: row.generation, user: null },
          200,
          newCookie ? { "Set-Cookie": cookie(newCookie) } : {},
        );
      if (row.state === "authenticating") throw new SessionBusy();
      row = await access(row);
      try {
        const user = decodeUser(
          (
            await backend(
              "/auth/me",
              "GET",
              undefined,
              store.open(row).accessToken,
            )
          ).body,
        );
        if (user.id !== row.user_id) {
          await store.revoke(row.id_hash, row.generation);
          throw new SessionEnded();
        }
        await store.assertCurrent(row);
        return reply({ generation: row.generation, user });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          await store.revoke(row.id_hash, row.generation);
        throw error;
      }
    }
    if (path === "auth/logout" && method === "POST") {
      const generation = request.headers.get("x-bff-generation") ?? "";
      if (!raw || !/^[\w-]{43}$/.test(raw) || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(generation))
        throw new SessionEnded();
      const ended = await store.end(sessionHash(raw), generation);
      let revoked = ended.state !== "revoked";
      if (ended.tokens) {
        try {
          let token = store.open(ended).accessToken;
          if (
            !ended.access_expires_at ||
            ended.access_expires_at.getTime() <= Date.now()
          ) {
            // Only an uncontested active owner can consume this token once after the local fence.
            if (
              ended.state !== "active" ||
              ended.expires_at.getTime() <= Date.now()
            )
              throw new SessionEnded();
            token = authTokens(
              (
                await backend("/auth/refresh", "POST", {
                  refreshToken: store.open(ended).refreshToken,
                })
              ).body,
            ).tokens.accessToken;
          }
          await backend("/auth/logout", "POST", {}, token);
        } catch {
          revoked = false;
        }
      }
      return reply({ revoked }, 200, { "Set-Cookie": cookie("", true) });
    }
    if (
      !row ||
      row.state === "revoked" ||
      request.headers.get("x-bff-generation") !== row.generation
    )
      throw new SessionEnded();
    if (
      (path === "auth/login" || path === "auth/register") &&
      method === "POST"
    ) {
      allowedFields(
        body!,
        path.endsWith("login")
          ? ["email", "password", "turnstileToken"]
          : ["email", "password", "fullName", "phone", "turnstileToken"],
      );
      const claimed = await store.beginLogin(row.id_hash, row.generation);
      let issued: ReturnType<typeof authTokens> | undefined;
      try {
        issued = authTokens((await backend("/" + path, "POST", body)).body);
        const user = decodeUser(
          (
            await backend(
              "/auth/me",
              "GET",
              undefined,
              issued.tokens.accessToken,
            )
          ).body,
        );
        const sessions = (
          await backend(
            "/auth/sessions",
            "GET",
            undefined,
            issued.tokens.accessToken,
          )
        ).body;
        const current = Array.isArray(sessions)
          ? sessions.find((s) => s?.current === true)
          : undefined;
        if (
          !current ||
          typeof current.id !== "string" ||
          !/^[\da-f-]{36}$/i.test(current.id)
        )
          throw new ApiError("invalid-response");
        const activated = await store.activate(
          claimed,
          issued.tokens,
          user.id,
          current.id,
          issued.expires,
          issued.accessExpires,
        );
        return reply(
          { generation: activated.row.generation, user },
          path.endsWith("register") ? 201 : 200,
          { "Set-Cookie": cookie(activated.cookie) },
        );
      } catch (error) {
        if (issued) {
          await store.end(row.id_hash, row.generation);
          try {
            await backend(
              "/auth/logout",
              "POST",
              {},
              issued.tokens.accessToken,
            );
          } catch {}
        } else await store.failLogin(claimed);
        throw error;
      }
    }
    row = await access(row);
    const token = store.open(row).accessToken;
    let endpoint = "",
      fields: string[] = [],
      isProviderDelete = false;
    const extraHeaders: Record<string, string> = {};
    if (path === "users/me" && ["GET", "PATCH"].includes(method)) {
      endpoint = "/users/me";
      fields = ["fullName", "phone"];
    }
    if (path === "pet-types" && method === "GET") endpoint = "/pet-types";
    if (
      (path === "pets" && ["GET", "POST"].includes(method)) ||
      (/^pets\/[1-9]\d*$/.test(path) &&
        ["GET", "PATCH", "DELETE"].includes(method))
    ) {
      endpoint = "/" + path;
      fields = [
        "petTypeId",
        "name",
        "breed",
        "birthDate",
        "weight",
        "healthNote",
      ];
    }
    if (path === "bookings" && method === "POST") {
      endpoint = "/bookings";
      fields = ["petId", "slotId", "customerNote"];
      const idempotencyKey = request.headers.get("idempotency-key");
      if (idempotencyKey !== null) {
        if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey))
          throw new ApiError("http", 400, "INVALID_IDEMPOTENCY_KEY");
        extraHeaders["Idempotency-Key"] = idempotencyKey;
      }
    }
    if (path === "bookings/mine" && method === "GET")
      endpoint = "/bookings/mine";
    const bookingDetail = /^bookings\/mine\/([1-9]\d{0,18})$/.exec(path);
    if (
      bookingDetail &&
      validBigIntId(bookingDetail[1]) &&
      method === "GET"
    )
      endpoint = "/" + path;
    const bookingCancel = /^bookings\/mine\/([1-9]\d{0,18})\/cancel$/.exec(
      path,
    );
    if (
      bookingCancel &&
      validBigIntId(bookingCancel[1]) &&
      method === "POST"
    ) {
      endpoint = "/" + path;
      fields = ["reason"];
    }
    if (path === "providers/me" && ["GET", "PATCH"].includes(method)) {
      endpoint = "/providers/me";
      fields = ["businessName", "address", "phone", "description"];
    }
    if (
      path === "providers/working-hours" &&
      ["GET", "POST"].includes(method)
    ) {
      endpoint = "/providers/working-hours";
      fields = ["dayOfWeek", "startTime", "endTime", "isActive"];
    }
    const providerWorkingHour = /^providers\/working-hours\/([1-9]\d{0,18})$/.exec(
      path,
    );
    if (providerWorkingHour && validBigIntId(providerWorkingHour[1])) {
      if (method === "PATCH") {
        endpoint = `/providers/working-hours/${providerWorkingHour[1]}`;
        fields = ["dayOfWeek", "startTime", "endTime", "isActive"];
      } else if (method === "DELETE") {
        endpoint = `/providers/working-hours/${providerWorkingHour[1]}`;
        fields = [];
        isProviderDelete = true;
      }
    }
    if (path === "services" && method === "POST") {
      endpoint = "/services";
      fields = ["categoryId", "name", "price", "durationMinutes", "description"];
    }
    if (path === "services/mine" && method === "GET")
      endpoint = "/services/mine";
    const providerService = /^services\/mine\/([1-9]\d{0,18})$/.exec(path);
    if (providerService && validBigIntId(providerService[1])) {
      if (method === "GET") {
        endpoint = `/services/mine/${providerService[1]}`;
      } else if (method === "PATCH") {
        endpoint = `/services/mine/${providerService[1]}`;
        fields = [
          "categoryId",
          "name",
          "price",
          "durationMinutes",
          "description",
          "status",
        ];
      } else if (method === "DELETE") {
        endpoint = `/services/mine/${providerService[1]}`;
        fields = [];
        isProviderDelete = true;
      }
    }
    if (path === "availability" && method === "POST") {
      endpoint = "/availability";
      fields = ["serviceId", "slotDate", "startTime", "endTime", "capacity"];
    }
    if (path === "availability/mine" && method === "GET")
      endpoint = "/availability/mine";
    const providerSlot = /^availability\/mine\/([1-9]\d{0,18})$/.exec(path);
    if (providerSlot && validBigIntId(providerSlot[1])) {
      if (method === "GET") {
        endpoint = `/availability/mine/${providerSlot[1]}`;
      } else if (method === "PATCH") {
        endpoint = `/availability/mine/${providerSlot[1]}`;
        fields = [
          "serviceId",
          "slotDate",
          "startTime",
          "endTime",
          "capacity",
          "status",
        ];
      } else if (method === "DELETE") {
        endpoint = `/availability/mine/${providerSlot[1]}`;
        fields = [];
        isProviderDelete = true;
      }
    }
    if (path === "bookings/provider" && method === "GET")
      endpoint = "/bookings/provider";
    const providerBookingDetail = /^bookings\/provider\/([1-9]\d{0,18})$/.exec(
      path,
    );
    if (
      providerBookingDetail &&
      validBigIntId(providerBookingDetail[1]) &&
      method === "GET"
    )
      endpoint = `/bookings/provider/${providerBookingDetail[1]}`;
    const providerBookingAction =
      /^bookings\/provider\/([1-9]\d{0,18})\/(confirm|reject|complete|no-show)$/.exec(
        path,
      );
    if (
      providerBookingAction &&
      validBigIntId(providerBookingAction[1]) &&
      method === "POST"
    ) {
      const action = providerBookingAction[2];
      endpoint = `/bookings/provider/${providerBookingAction[1]}/${action}`;
      fields = action === "reject" || action === "no-show" ? ["reason"] : [];
    }
    if (path === "dashboard/provider" && method === "GET") {
      const { from, to } = parseDashboardRange(request);
      endpoint = `/dashboard/provider?from=${from}&to=${to}`;
    }
    if (path === "auth/sessions" && method === "GET") endpoint = "/" + path;
    if (
      /^auth\/sessions\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
        path,
      ) &&
      method === "DELETE"
    )
      endpoint = "/" + path;
    if (
      [
        "auth/change-password",
        "auth/logout-all",
        "auth/verify-email/resend",
      ].includes(path) &&
      method === "POST"
    ) {
      endpoint = "/" + path;
      fields =
        path === "auth/change-password"
          ? ["currentPassword", "newPassword"]
          : [];
    }
    if (!endpoint) return reply({ message: "Not found" }, 404);
    if (body) allowedFields(body, fields);
    try {
      const result = await backend(
        endpoint,
        method,
        isProviderDelete ? undefined : body,
        token,
        extraHeaders,
      );
      await store.assertCurrent(row);
      if (path === "auth/change-password" || path === "auth/logout-all") {
        await store.revokeUser(row.user_id!);
        return reply(null, 204, { "Set-Cookie": cookie("", true) });
      }
      if (method === "DELETE" && path.startsWith("auth/sessions/")) {
        const id = path.split("/")[2];
        await store.revokeBackend(id, row.user_id!);
        return reply(
          null,
          204,
          id === row.backend_session_id
            ? { "Set-Cookie": cookie("", true) }
            : {},
        );
      }
      if (isProviderDelete) {
        if (result.status !== 204 || result.body !== null)
          throw new ApiError("invalid-response");
        return reply(null, 204);
      }
      // Only endpoints with known, non-secret response shapes reach this branch.
      const projected = publicResponse(path, result.body, method);
      if (path === "bookings" && method === "POST") {
        const rawReplayed =
          result.headers.get("Idempotent-Replayed")?.trim() ?? null;
        if (rawReplayed !== null) {
          if (rawReplayed !== "true" && rawReplayed !== "false")
            throw new ApiError("invalid-response");
          return reply(
            {
              ...(projected as Record<string, unknown>),
              idempotentReplayed: rawReplayed === "true",
            },
            result.status,
            { "Idempotent-Replayed": rawReplayed },
          );
        }
      }
      return reply(projected, result.status);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        await store.revoke(row.id_hash, row.generation);
      throw error;
    }
  } catch (error) {
    return errorResponse(error, path);
  }
}
