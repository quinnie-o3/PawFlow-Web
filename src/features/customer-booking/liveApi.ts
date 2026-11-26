import {
  createApiClient,
  type ApiFetch,
  type ApiResponse,
  type RequestOptions,
} from "../../lib/api/transport";
import {
  ApiError,
  isRequestCancelled,
  throwIfCancelled,
} from "../../lib/api/errors";
import {
  QueryCache,
  queryFreshness,
  queryKeys,
} from "../../lib/api/queryCache";
import { bffRequest, privateCache } from "../session/client";
import { decodeSlot, type Slot } from "../public-catalog/api";
import { validId } from "../public-catalog/query";
import type { BookingStatus } from "./model";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const IDEMPOTENT_REPLAYED_HEADER = "Idempotent-Replayed";
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
export const PUBLIC_SLOT_TIMEOUT_MS = 8000;

export const LIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type LiveBookingStatus = BookingStatus;

export type LiveBookingPetType = Readonly<{
  id: string;
  name: string;
}>;

export type LiveBookingPet = Readonly<{
  id: string;
  name: string;
  breed: string | null;
  petType: LiveBookingPetType;
}>;

export type LiveBookingProvider = Readonly<{
  id: string;
  businessName: string;
  address: string;
}>;

export type LiveBookingService = Readonly<{
  id: string;
  name: string;
  /** Current service duration (not a booking-time snapshot). */
  durationMinutes: number;
}>;

export type LiveBookingSlot = Readonly<{
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
}>;

export type LiveBookingStatusLog = Readonly<{
  id: string;
  oldStatus: LiveBookingStatus | null;
  newStatus: LiveBookingStatus;
  reason: string | null;
  createdAt: string;
}>;

export type LiveCustomerBooking = Readonly<{
  id: string;
  status: LiveBookingStatus;
  /** Service price snapshot taken at booking time; NUMERIC(12,2) string. */
  bookedPrice: string;
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  service: LiveBookingService;
  slot: LiveBookingSlot;
  pet: LiveBookingPet;
  provider: LiveBookingProvider;
}>;

export type LiveCustomerBookingDetail = Readonly<
  LiveCustomerBooking & {
    statusLogs: readonly LiveBookingStatusLog[];
  }
>;

export type LiveAvailabilitySlot = Slot;

export type CreateBookingInput = Readonly<{
  petId: string;
  slotId: string;
  customerNote?: string | null;
}>;

export type CreateBookingResult = Readonly<{
  booking: LiveCustomerBooking;
  idempotentReplayed: boolean;
}>;

export type CancelBookingInput = Readonly<{
  reason?: string | null;
}>;

export type LiveBookingOperation =
  | "create-booking"
  | "list-bookings"
  | "get-booking"
  | "cancel-booking"
  | "get-public-slot";

export type LiveBookingOutcome =
  | "definite-failure"
  | "in-progress"
  | "unknown";

export type LiveBookingErrorCategory =
  | "auth"
  | "permission"
  | "validation"
  | "availability"
  | "idempotency"
  | "conflict"
  | "not-found"
  | "rate-limit"
  | "uncertain"
  | "transient"
  | "config";

export type LiveBookingErrorCode =
  | "INVALID_INPUT"
  | "INVALID_IDEMPOTENCY_KEY"
  | "INVALID_REQUEST"
  | "SESSION_ENDED"
  | "SESSION_BUSY"
  | "CSRF_REJECTED"
  | "CUSTOMER_REQUIRED"
  | "PET_UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "SLOT_UNAVAILABLE"
  | "SLOT_STARTED"
  | "SLOT_FULL"
  | "SLOT_CLOSED"
  | "SLOT_OUTSIDE_WORKING_HOURS"
  | "SLOT_TOO_SHORT"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "IDEMPOTENCY_CONFLICT"
  | "BOOKING_NOT_FOUND"
  | "RESOURCE_NOT_FOUND"
  | "CANCEL_STATUS"
  | "CANCEL_TIME"
  | "NO_RESERVED_CAPACITY"
  | "BOOKING_CONFLICT"
  | "RATE_LIMITED"
  | "RATE_LIMIT_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "INVALID_RESPONSE"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR";

export type LiveBookingErrorInfo = Readonly<{
  code: LiveBookingErrorCode;
  category: LiveBookingErrorCategory;
  outcome: LiveBookingOutcome;
  status: number | null;
  retryAfterSeconds: number | null;
  /** Safe to retry the exact same create request with the same Idempotency-Key. */
  canRetryWithSameKey: boolean;
  /** Caller should reload availability slots / quote before submitting again. */
  shouldRefreshAvailability: boolean;
  /** Caller should reload customer bookings to verify authoritative state. */
  shouldRefreshBookings: boolean;
}>;

export class LiveBookingApiError extends Error {
  readonly code: LiveBookingErrorCode;
  readonly category: LiveBookingErrorCategory;
  readonly outcome: LiveBookingOutcome;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly canRetryWithSameKey: boolean;
  readonly shouldRefreshAvailability: boolean;
  readonly shouldRefreshBookings: boolean;
  readonly causeError: unknown;

  constructor(info: LiveBookingErrorInfo, causeError?: unknown) {
    super(info.code);
    this.name = "LiveBookingApiError";
    this.code = info.code;
    this.category = info.category;
    this.outcome = info.outcome;
    this.status = info.status;
    this.retryAfterSeconds = info.retryAfterSeconds;
    this.canRetryWithSameKey = info.canRetryWithSameKey;
    this.shouldRefreshAvailability = info.shouldRefreshAvailability;
    this.shouldRefreshBookings = info.shouldRefreshBookings;
    this.causeError = causeError;
  }
}

export type BffRequester = (
  path: string,
  options?: RequestOptions,
  decode?: (body: unknown) => unknown,
) => Promise<ApiResponse<unknown>>;

export type CustomerBookingApiConfig = Readonly<{
  bffRequestImpl?: BffRequester;
  cache?: QueryCache | null;
  publicApiUrl?: string;
  publicFetchImpl?: ApiFetch;
}>;

const STATUS_SET = new Set<string>(LIVE_BOOKING_STATUSES);
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const NUMERIC_PRICE_PATTERN = /^\d{1,10}\.\d{2}$/;

const UPSTREAM_MESSAGE_CODES: Readonly<
  Record<string, Readonly<Record<string, LiveBookingErrorCode>>>
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

const KNOWN_CODES = new Set<LiveBookingErrorCode>([
  "INVALID_INPUT",
  "INVALID_IDEMPOTENCY_KEY",
  "INVALID_REQUEST",
  "SESSION_ENDED",
  "SESSION_BUSY",
  "CSRF_REJECTED",
  "CUSTOMER_REQUIRED",
  "PET_UNAVAILABLE",
  "PROVIDER_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "SLOT_UNAVAILABLE",
  "SLOT_STARTED",
  "SLOT_FULL",
  "SLOT_CLOSED",
  "SLOT_OUTSIDE_WORKING_HOURS",
  "SLOT_TOO_SHORT",
  "IDEMPOTENCY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
  "BOOKING_NOT_FOUND",
  "RESOURCE_NOT_FOUND",
  "CANCEL_STATUS",
  "CANCEL_TIME",
  "NO_RESERVED_CAPACITY",
  "BOOKING_CONFLICT",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "NETWORK_ERROR",
  "SERVER_ERROR",
  "INVALID_RESPONSE",
  "CONFIG_ERROR",
  "UNKNOWN_ERROR",
]);

function invalidResponse(status: number | null = null): ApiError {
  return new ApiError("invalid-response", status);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidResponse();
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value !== "string") throw invalidResponse();
  return value;
}

function asNullableString(value: unknown): string | null {
  return value === null ? null : asString(value);
}

function asId(value: unknown): string {
  if (!validId(value)) throw invalidResponse();
  return value;
}

function asPositiveInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw invalidResponse();
  }
  return value;
}

function asPrice(value: unknown): string {
  const s = asString(value);
  if (!NUMERIC_PRICE_PATTERN.test(s)) throw invalidResponse();
  return s;
}

function asStatus(value: unknown): LiveBookingStatus {
  const s = asString(value);
  if (!STATUS_SET.has(s)) throw invalidResponse();
  return s as LiveBookingStatus;
}

function asIsoTimestamp(value: unknown): string {
  const s = asString(value);
  if (!ISO_TIMESTAMP_PATTERN.test(s) || !Number.isFinite(Date.parse(s))) {
    throw invalidResponse();
  }
  return s;
}

function asCalendarDate(value: unknown): string {
  const s = asString(value);
  if (
    !CALENDAR_DATE_PATTERN.test(s) ||
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s
  ) {
    throw invalidResponse();
  }
  return s;
}

function asTimeOfDay(value: unknown): string {
  const s = asString(value);
  if (!TIME_OF_DAY_PATTERN.test(s)) throw invalidResponse();
  return s;
}

function decodeBookingSlot(value: unknown): LiveBookingSlot {
  const o = asObject(value);
  const slotDate = asCalendarDate(o.slotDate);
  const startTime = asTimeOfDay(o.startTime);
  const endTime = asTimeOfDay(o.endTime);
  if (endTime <= startTime) throw invalidResponse();
  return {
    id: asId(o.id),
    slotDate,
    startTime,
    endTime,
  };
}

function decodeStatusLog(value: unknown): LiveBookingStatusLog {
  const o = asObject(value);
  return {
    id: asId(o.id),
    oldStatus: o.oldStatus === null ? null : asStatus(o.oldStatus),
    newStatus: asStatus(o.newStatus),
    reason: asNullableString(o.reason),
    createdAt: asIsoTimestamp(o.createdAt),
  };
}

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && IDEMPOTENCY_KEY_PATTERN.test(value);
}

export function createIdempotencyKey(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  throw new LiveBookingApiError(
    errorInfoFromCode("INVALID_IDEMPOTENCY_KEY", "create-booking", null, null),
  );
}

/** Matches PawFlow-API CreateBookingDto & CancelBookingDto trim-to-null transform. */
export function normalizeBookingNote(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Canonical wire fingerprint matching PawFlow-API `fingerprintCreateBookingRequest`. */
export function bookingRequestFingerprint(input: CreateBookingInput): string {
  return JSON.stringify([
    "POST /bookings",
    input.petId,
    input.slotId,
    normalizeBookingNote(input.customerNote),
  ]);
}

export function decodeCustomerBooking(value: unknown): LiveCustomerBooking {
  const o = asObject(value);
  const service = asObject(o.service);
  const pet = asObject(o.pet);
  const petType = asObject(pet.petType);
  const provider = asObject(o.provider);
  return {
    id: asId(o.id),
    status: asStatus(o.status),
    bookedPrice: asPrice(o.bookedPrice),
    customerNote: asNullableString(o.customerNote),
    createdAt: asIsoTimestamp(o.createdAt),
    updatedAt: asIsoTimestamp(o.updatedAt),
    service: {
      id: asId(service.id),
      name: asString(service.name),
      durationMinutes: asPositiveInt(service.durationMinutes),
    },
    slot: decodeBookingSlot(o.slot),
    pet: {
      id: asId(pet.id),
      name: asString(pet.name),
      breed: asNullableString(pet.breed),
      petType: {
        id: asId(petType.id),
        name: asString(petType.name),
      },
    },
    provider: {
      id: asId(provider.id),
      businessName: asString(provider.businessName),
      address: asString(provider.address),
    },
  };
}

export function decodeCustomerBookings(value: unknown): LiveCustomerBooking[] {
  if (!Array.isArray(value)) throw invalidResponse();
  const items = value.map(decodeCustomerBooking);
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw invalidResponse();
  }
  return items;
}

export function decodeCustomerBookingDetail(
  value: unknown,
  expectedId?: string,
): LiveCustomerBookingDetail {
  const booking = decodeCustomerBooking(value);
  if (expectedId !== undefined && booking.id !== expectedId) {
    throw invalidResponse();
  }
  const o = asObject(value);
  if (!Array.isArray(o.statusLogs)) throw invalidResponse();
  const statusLogs = o.statusLogs.map(decodeStatusLog);
  if (new Set(statusLogs.map((log) => log.id)).size !== statusLogs.length) {
    throw invalidResponse();
  }
  return {
    ...booking,
    statusLogs,
  };
}

type DecodedCreateBody = Readonly<{
  booking: LiveCustomerBooking;
  bodyReplayed: boolean | null;
}>;

function decodeCreateBookingBody(value: unknown): DecodedCreateBody {
  const o = asObject(value);
  const booking = decodeCustomerBooking(o);
  let bodyReplayed: boolean | null = null;
  if (
    Object.hasOwn(o, "idempotentReplayed") &&
    o.idempotentReplayed !== undefined
  ) {
    if (typeof o.idempotentReplayed !== "boolean") throw invalidResponse();
    bodyReplayed = o.idempotentReplayed;
  }
  return { booking, bodyReplayed };
}

function resolveReplayedFlag(
  bodyReplayed: boolean | null,
  headers?: Headers | null,
): boolean {
  const rawHeader = headers?.get(IDEMPOTENT_REPLAYED_HEADER)?.trim() ?? null;
  let headerReplayed: boolean | null = null;
  if (rawHeader !== null) {
    if (rawHeader !== "true" && rawHeader !== "false") throw invalidResponse();
    headerReplayed = rawHeader === "true";
  }
  if (
    headerReplayed !== null &&
    bodyReplayed !== null &&
    headerReplayed !== bodyReplayed
  ) {
    throw invalidResponse();
  }
  return headerReplayed ?? bodyReplayed ?? false;
}

export function decodeCreateBookingResult(
  body: unknown,
  headers?: Headers | null,
): CreateBookingResult {
  const decoded = decodeCreateBookingBody(body);
  return {
    booking: decoded.booking,
    idempotentReplayed: resolveReplayedFlag(decoded.bodyReplayed, headers),
  };
}

/**
 * Reuses `decodeSlot` (`bookedCount < capacity`) from `public-catalog/api.ts`,
 * since `GET /api/availability/public/:id` returns 404 for non-bookable slots.
 */
export function decodePublicAvailabilitySlot(
  value: unknown,
  expectedSlotId?: string,
): LiveAvailabilitySlot {
  let slot: LiveAvailabilitySlot;
  try {
    slot = decodeSlot(value);
  } catch {
    throw invalidResponse();
  }
  if (expectedSlotId !== undefined && slot.id !== expectedSlotId) {
    throw invalidResponse();
  }
  return slot;
}

function isMutationOperation(operation: LiveBookingOperation): boolean {
  return operation === "create-booking" || operation === "cancel-booking";
}

function errorInfoFromCode(
  code: LiveBookingErrorCode,
  operation: LiveBookingOperation,
  status: number | null,
  retryAfterSeconds: number | null,
): LiveBookingErrorInfo {
  const mutation = isMutationOperation(operation);
  const isCreate = operation === "create-booking";

  switch (code) {
    case "INVALID_INPUT":
    case "INVALID_IDEMPOTENCY_KEY":
    case "INVALID_REQUEST":
      return {
        code,
        category: "validation",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: false,
      };
    case "SESSION_ENDED":
    case "CSRF_REJECTED":
      return {
        code,
        category: "auth",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: false,
      };
    case "SESSION_BUSY":
      return {
        code,
        category: "auth",
        outcome: "definite-failure",
        status,
        retryAfterSeconds,
        canRetryWithSameKey: isCreate,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: false,
      };
    case "CUSTOMER_REQUIRED":
      return {
        code,
        category: "permission",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: false,
      };
    case "PET_UNAVAILABLE":
      return {
        code,
        category: "availability",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: false,
      };
    case "PROVIDER_UNAVAILABLE":
    case "SERVICE_UNAVAILABLE":
    case "SLOT_UNAVAILABLE":
    case "SLOT_STARTED":
    case "SLOT_FULL":
    case "SLOT_CLOSED":
    case "SLOT_OUTSIDE_WORKING_HOURS":
    case "SLOT_TOO_SHORT":
      return {
        code,
        category: "availability",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: true,
        shouldRefreshBookings: false,
      };
    case "IDEMPOTENCY_IN_PROGRESS":
      return {
        code,
        category: "idempotency",
        outcome: "in-progress",
        status,
        retryAfterSeconds,
        canRetryWithSameKey: true,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: true,
      };
    case "IDEMPOTENCY_CONFLICT":
      return {
        code,
        category: "idempotency",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: true,
      };
    case "BOOKING_NOT_FOUND":
      return {
        code,
        category: "not-found",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: true,
      };
    case "RESOURCE_NOT_FOUND":
      return {
        code,
        category: "not-found",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: isCreate,
        shouldRefreshBookings: false,
      };
    case "CANCEL_STATUS":
    case "CANCEL_TIME":
    case "NO_RESERVED_CAPACITY":
      return {
        code,
        category: "conflict",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: true,
      };
    case "BOOKING_CONFLICT":
      return {
        code,
        category: "conflict",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: isCreate,
        shouldRefreshBookings: operation === "cancel-booking",
      };
    case "RATE_LIMITED":
    case "RATE_LIMIT_UNAVAILABLE":
      return {
        code,
        category: "rate-limit",
        outcome: "definite-failure",
        status,
        retryAfterSeconds,
        canRetryWithSameKey: isCreate,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: false,
      };
    case "CONFIG_ERROR":
      return {
        code,
        category: "config",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        canRetryWithSameKey: false,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: false,
      };
    case "NETWORK_ERROR":
    case "SERVER_ERROR":
    case "INVALID_RESPONSE":
    case "UNKNOWN_ERROR":
      return {
        code,
        category: mutation ? "uncertain" : "transient",
        outcome: mutation ? "unknown" : "definite-failure",
        status,
        retryAfterSeconds,
        canRetryWithSameKey: isCreate,
        shouldRefreshAvailability: false,
        shouldRefreshBookings: mutation,
      };
  }
}

export function classifyBookingError(
  error: unknown,
  operation: LiveBookingOperation,
): LiveBookingErrorInfo {
  if (error instanceof LiveBookingApiError) {
    return {
      code: error.code,
      category: error.category,
      outcome: error.outcome,
      status: error.status,
      retryAfterSeconds: error.retryAfterSeconds,
      canRetryWithSameKey: error.canRetryWithSameKey,
      shouldRefreshAvailability: error.shouldRefreshAvailability,
      shouldRefreshBookings: error.shouldRefreshBookings,
    };
  }

  if (error instanceof ApiError) {
    if (error.kind === "config") {
      return errorInfoFromCode("CONFIG_ERROR", operation, error.status, null);
    }
    if (error.kind === "network") {
      return errorInfoFromCode("NETWORK_ERROR", operation, error.status, null);
    }
    if (error.kind === "invalid-response") {
      return errorInfoFromCode(
        "INVALID_RESPONSE",
        operation,
        error.status,
        null,
      );
    }

    if (error.code && KNOWN_CODES.has(error.code as LiveBookingErrorCode)) {
      return errorInfoFromCode(
        error.code as LiveBookingErrorCode,
        operation,
        error.status,
        error.retryAfterSeconds,
      );
    }

    if (error.status !== null && error.serverMessage) {
      const byStatus = UPSTREAM_MESSAGE_CODES[String(error.status)];
      if (byStatus && Object.hasOwn(byStatus, error.serverMessage)) {
        return errorInfoFromCode(
          byStatus[error.serverMessage],
          operation,
          error.status,
          error.retryAfterSeconds,
        );
      }
    }

    if (error.status === 401) {
      return errorInfoFromCode("SESSION_ENDED", operation, 401, null);
    }
    if (error.status === 403) {
      return errorInfoFromCode("CUSTOMER_REQUIRED", operation, 403, null);
    }
    if (error.status === 404) {
      const notFoundCode: LiveBookingErrorCode =
        operation === "get-public-slot"
          ? "SLOT_UNAVAILABLE"
          : operation === "get-booking" || operation === "cancel-booking"
            ? "BOOKING_NOT_FOUND"
            : "RESOURCE_NOT_FOUND";
      return errorInfoFromCode(notFoundCode, operation, 404, null);
    }
    if (error.status === 409) {
      return errorInfoFromCode("BOOKING_CONFLICT", operation, 409, null);
    }
    if (
      error.status === 400 ||
      error.status === 413 ||
      error.status === 415 ||
      error.status === 422
    ) {
      return errorInfoFromCode("INVALID_REQUEST", operation, error.status, null);
    }
    if (error.status === 429) {
      return errorInfoFromCode(
        "RATE_LIMITED",
        operation,
        429,
        error.retryAfterSeconds,
      );
    }
    if (error.status !== null && error.status >= 500) {
      return errorInfoFromCode(
        "SERVER_ERROR",
        operation,
        error.status,
        error.retryAfterSeconds,
      );
    }
  }

  return errorInfoFromCode("UNKNOWN_ERROR", operation, null, null);
}

function toLiveBookingError(
  error: unknown,
  operation: LiveBookingOperation,
): LiveBookingApiError {
  if (error instanceof LiveBookingApiError) return error;
  return new LiveBookingApiError(classifyBookingError(error, operation), error);
}

function validateStringOrNullOptional(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

export function createCustomerBookingApi(
  config: CustomerBookingApiConfig = {},
) {
  const requestBff: BffRequester = config.bffRequestImpl ?? bffRequest;
  const cache = config.cache === undefined ? privateCache : config.cache;

  async function createBooking(
    input: CreateBookingInput,
    options: { idempotencyKey?: string; signal?: AbortSignal } = {},
  ): Promise<CreateBookingResult> {
    throwIfCancelled(options.signal);
    if (
      !validId(input.petId) ||
      !validId(input.slotId) ||
      !validateStringOrNullOptional(input.customerNote)
    ) {
      throw new LiveBookingApiError(
        errorInfoFromCode("INVALID_INPUT", "create-booking", null, null),
      );
    }
    if (
      options.idempotencyKey !== undefined &&
      !isValidIdempotencyKey(options.idempotencyKey)
    ) {
      throw new LiveBookingApiError(
        errorInfoFromCode(
          "INVALID_IDEMPOTENCY_KEY",
          "create-booking",
          null,
          null,
        ),
      );
    }

    const body: Record<string, unknown> = {
      petId: input.petId,
      slotId: input.slotId,
      ...(input.customerNote !== undefined
        ? { customerNote: normalizeBookingNote(input.customerNote) }
        : {}),
    };
    const headers: Record<string, string> = options.idempotencyKey
      ? { [IDEMPOTENCY_KEY_HEADER]: options.idempotencyKey }
      : {};

    try {
      const response = await requestBff(
        "/bookings",
        {
          method: "POST",
          body,
          headers,
          signal: options.signal,
        },
        decodeCreateBookingBody,
      );
      throwIfCancelled(options.signal);
      const decoded = response.body as DecodedCreateBody;
      const result: CreateBookingResult = {
        booking: decoded.booking,
        idempotentReplayed: resolveReplayedFlag(
          decoded.bodyReplayed,
          response.headers,
        ),
      };
      cache?.invalidate(queryKeys.bookings.all());
      return result;
    } catch (error) {
      if (isRequestCancelled(error)) throw error;
      const wrapped = toLiveBookingError(error, "create-booking");
      if (wrapped.outcome === "unknown" || wrapped.outcome === "in-progress") {
        cache?.invalidate(queryKeys.bookings.all());
      }
      throw wrapped;
    }
  }

  async function listMyBookings(
    options: { signal?: AbortSignal } = {},
  ): Promise<LiveCustomerBooking[]> {
    throwIfCancelled(options.signal);
    const ticket = cache ? cache.ticket(queryKeys.bookings.mine()) : null;
    try {
      const response = await requestBff(
        "/bookings/mine",
        { method: "GET", signal: options.signal },
        decodeCustomerBookings,
      );
      throwIfCancelled(options.signal);
      const bookings = response.body as LiveCustomerBooking[];
      if (
        cache &&
        ticket &&
        !cache.write(ticket, bookings, queryFreshness.bookings)
      ) {
        throw new DOMException("Superseded", "AbortError");
      }
      return bookings;
    } catch (error) {
      if (isRequestCancelled(error)) throw error;
      throw toLiveBookingError(error, "list-bookings");
    }
  }

  async function getMyBookingDetail(
    bookingId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<LiveCustomerBookingDetail> {
    throwIfCancelled(options.signal);
    if (!validId(bookingId)) {
      throw new LiveBookingApiError(
        errorInfoFromCode("INVALID_INPUT", "get-booking", null, null),
      );
    }
    const ticket = cache
      ? cache.ticket(queryKeys.bookings.detail(bookingId))
      : null;
    try {
      const response = await requestBff(
        `/bookings/mine/${bookingId}`,
        { method: "GET", signal: options.signal },
        (raw) => decodeCustomerBookingDetail(raw, bookingId),
      );
      throwIfCancelled(options.signal);
      const detail = response.body as LiveCustomerBookingDetail;
      if (
        cache &&
        ticket &&
        !cache.write(ticket, detail, queryFreshness.bookings)
      ) {
        throw new DOMException("Superseded", "AbortError");
      }
      return detail;
    } catch (error) {
      if (isRequestCancelled(error)) throw error;
      throw toLiveBookingError(error, "get-booking");
    }
  }

  async function cancelMyBooking(
    bookingId: string,
    input: CancelBookingInput = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<LiveCustomerBooking> {
    throwIfCancelled(options.signal);
    if (!validId(bookingId) || !validateStringOrNullOptional(input.reason)) {
      throw new LiveBookingApiError(
        errorInfoFromCode("INVALID_INPUT", "cancel-booking", null, null),
      );
    }

    const body: Record<string, unknown> =
      input.reason !== undefined
        ? { reason: normalizeBookingNote(input.reason) }
        : {};

    try {
      const response = await requestBff(
        `/bookings/mine/${bookingId}/cancel`,
        {
          method: "POST",
          body,
          signal: options.signal,
        },
        (raw) => {
          const booking = decodeCustomerBooking(raw);
          if (booking.id !== bookingId) throw invalidResponse();
          return booking;
        },
      );
      throwIfCancelled(options.signal);
      cache?.invalidate(queryKeys.bookings.all());
      return response.body as LiveCustomerBooking;
    } catch (error) {
      if (isRequestCancelled(error)) throw error;
      const wrapped = toLiveBookingError(error, "cancel-booking");
      if (wrapped.outcome === "unknown") {
        cache?.invalidate(queryKeys.bookings.all());
      }
      throw wrapped;
    }
  }

  async function getPublicAvailabilitySlot(
    slotId: string,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<LiveAvailabilitySlot> {
    throwIfCancelled(options.signal);
    if (!validId(slotId)) {
      throw new LiveBookingApiError(
        errorInfoFromCode("INVALID_INPUT", "get-public-slot", null, null),
      );
    }

    const timeoutMs = options.timeoutMs ?? PUBLIC_SLOT_TIMEOUT_MS;
    const controller = new AbortController();
    let timedOut = false;
    let rejectAbort!: (error: unknown) => void;
    const aborted = new Promise<never>((_, reject) => {
      rejectAbort = reject;
    });
    const onCallerAbort = () => {
      controller.abort();
      rejectAbort(new DOMException("Request cancelled", "AbortError"));
    };
    options.signal?.addEventListener("abort", onCallerAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      rejectAbort(new ApiError("network"));
    }, timeoutMs);

    let retryAfter: number | null = null;
    const baseFetch = config.publicFetchImpl ?? fetch;
    const client = createApiClient({
      apiUrl: config.publicApiUrl,
      fetchImpl: async (url, init) => {
        const response = await baseFetch(url, init);
        const raw = response.headers.get("Retry-After")?.trim();
        if (raw && (response.status === 429 || response.status === 503)) {
          const seconds = /^\d+$/.test(raw)
            ? Number(raw)
            : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
          if (Number.isSafeInteger(seconds) && seconds >= 0) {
            retryAfter = Math.max(1, seconds);
          }
        }
        return response;
      },
    });

    const requestPromise = client.request(`/availability/public/${slotId}`, {
      method: "GET",
      credentials: "omit",
      signal: controller.signal,
      decode: (raw) => {
        throwIfCancelled(controller.signal);
        const decoded = decodePublicAvailabilitySlot(raw, slotId);
        throwIfCancelled(controller.signal);
        return decoded;
      },
    });
    // Prevent unhandled rejection if the losing branch rejects after timeout/cancel.
    requestPromise.catch(() => {});

    try {
      const response = await Promise.race([requestPromise, aborted]);
      throwIfCancelled(options.signal);
      if (timedOut) throw new ApiError("network");
      return response.body as LiveAvailabilitySlot;
    } catch (error) {
      if (timedOut && !options.signal?.aborted) {
        throw toLiveBookingError(new ApiError("network"), "get-public-slot");
      }
      if (isRequestCancelled(error) || options.signal?.aborted) {
        throw new DOMException("Request cancelled", "AbortError");
      }
      if (
        error instanceof ApiError &&
        retryAfter !== null &&
        retryAfter > (error.retryAfterSeconds ?? 0)
      ) {
        throw toLiveBookingError(
          new ApiError(
            error.kind,
            error.status,
            error.code,
            error.serverMessage,
            retryAfter,
          ),
          "get-public-slot",
        );
      }
      throw toLiveBookingError(error, "get-public-slot");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  return {
    createBooking,
    listMyBookings,
    getMyBookingDetail,
    cancelMyBooking,
    getPublicAvailabilitySlot,
  };
}

const defaultApi = createCustomerBookingApi();

export const createBooking = defaultApi.createBooking;
export const listMyBookings = defaultApi.listMyBookings;
export const getMyBookingDetail = defaultApi.getMyBookingDetail;
export const cancelMyBooking = defaultApi.cancelMyBooking;
export const getPublicAvailabilitySlot = defaultApi.getPublicAvailabilitySlot;
