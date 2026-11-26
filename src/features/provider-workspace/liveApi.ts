import {
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
  type QueryKey,
  queryFreshness,
  queryKeys,
} from "../../lib/api/queryCache";
import { bffRequest, privateCache } from "../session/client";
import { createPublicApi, type Category } from "../public-catalog/api";
import { validId } from "../public-catalog/query";

export const PUBLIC_CATEGORIES_TIMEOUT_MS = 8000;

export const PROVIDER_APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;
export type ProviderApprovalStatus =
  (typeof PROVIDER_APPROVAL_STATUSES)[number];

export const PROVIDER_SERVICE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ProviderServiceStatus = (typeof PROVIDER_SERVICE_STATUSES)[number];

export const PROVIDER_SLOT_STATUSES = ["OPEN", "CLOSED", "CANCELLED"] as const;
export type ProviderSlotStatus = (typeof PROVIDER_SLOT_STATUSES)[number];

export const PROVIDER_BOOKING_STATUSES = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type ProviderBookingStatus = (typeof PROVIDER_BOOKING_STATUSES)[number];

export const DSS_ALERT_CODES = [
  "PEAK_HOUR_DEMAND",
  "HIGH_SERVICE_CANCELLATION",
  "UNDERUSED_SERVICE",
  "FREQUENT_RETURNING_CUSTOMER",
  "LOW_RATING",
] as const;
export type DssAlertCode = (typeof DSS_ALERT_CODES)[number];

export const DSS_ALERT_SEVERITIES = ["INFO", "WARNING"] as const;
export type DssAlertSeverity = (typeof DSS_ALERT_SEVERITIES)[number];

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ServiceCategoryOption = Category;

export type ProviderProfile = Readonly<{
  id: string;
  ownerId: string;
  businessName: string;
  address: string;
  phone: string | null;
  description: string | null;
  approvalStatus: ProviderApprovalStatus;
  ratingAvg: string;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}>;

export type ProviderWorkingHour = Readonly<{
  id: string;
  providerId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type ProviderServiceCategoryRef = Readonly<{
  id: string;
  name: string;
  description: string | null;
  status: ProviderServiceStatus;
}>;

export type ProviderService = Readonly<{
  id: string;
  providerId: string;
  categoryId: string;
  name: string;
  /** NUMERIC(12,2) serialized as a string. */
  price: string;
  durationMinutes: number;
  description: string | null;
  status: ProviderServiceStatus;
  createdAt: string;
  updatedAt: string;
  /** Always populated on GET endpoints; null on POST/PATCH responses without relation join. */
  category: ProviderServiceCategoryRef | null;
}>;

export type ProviderAvailabilityServiceRef = Readonly<{
  id: string;
  categoryId: string;
  name: string;
  price: string;
  durationMinutes: number;
  description: string | null;
  status: ProviderServiceStatus;
}>;

export type ProviderAvailabilitySlot = Readonly<{
  id: string;
  providerId: string;
  serviceId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  status: ProviderSlotStatus;
  createdAt: string;
  updatedAt: string;
  /** Always populated on GET endpoints; null on POST/PATCH responses without relation join. */
  service: ProviderAvailabilityServiceRef | null;
}>;

export type ProviderBookingCustomer = Readonly<{
  id: string;
  fullName: string;
}>;

export type ProviderBookingPetType = Readonly<{
  id: string;
  name: string;
}>;

export type ProviderBookingPet = Readonly<{
  id: string;
  name: string;
  breed: string | null;
  birthDate: string | null;
  /** NUMERIC(6,2) serialized as a string. */
  weight: string | null;
  healthNote: string | null;
  petType: ProviderBookingPetType;
}>;

export type ProviderBookingService = Readonly<{
  id: string;
  name: string;
  durationMinutes: number;
}>;

export type ProviderBookingSlot = Readonly<{
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
}>;

export type ProviderBookingStatusLog = Readonly<{
  id: string;
  oldStatus: ProviderBookingStatus | null;
  newStatus: ProviderBookingStatus;
  reason: string | null;
  createdAt: string;
}>;

export type ProviderBooking = Readonly<{
  id: string;
  status: ProviderBookingStatus;
  /** NUMERIC(12,2) price snapshot taken at booking time. */
  bookedPrice: string;
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  service: ProviderBookingService;
  slot: ProviderBookingSlot;
  customer: ProviderBookingCustomer;
  pet: ProviderBookingPet;
}>;

export type ProviderBookingDetail = Readonly<
  ProviderBooking & {
    statusLogs: readonly ProviderBookingStatusLog[];
  }
>;

export type PeakHourDemandAlertContext = Readonly<{
  date: string;
  peakAcceptedBookings: number;
  totalAcceptedBookings: number;
  percentage: number;
}>;

export type HighServiceCancellationAlertContext = Readonly<{
  month: string;
  serviceId: string;
  cancelledBookings: number;
  resolvedBookings: number;
  percentage: number;
}>;

export type UnderusedServiceAlertContext = Readonly<{
  month: string;
  serviceId: string;
  completedBookings: number;
  comparisonAverage: number;
}>;

export type FrequentReturningCustomerAlertContext = Readonly<{
  customerId: string;
  completedBookings: number;
  from: string;
  to: string;
}>;

export type LowRatingAlertContext = Readonly<{
  from: string;
  to: string;
  reviewCount: number;
  average: number;
}>;

export type ProviderDssAlert =
  | Readonly<{
      code: "PEAK_HOUR_DEMAND";
      severity: DssAlertSeverity;
      message: string;
      recommendation: string;
      context: PeakHourDemandAlertContext;
    }>
  | Readonly<{
      code: "HIGH_SERVICE_CANCELLATION";
      severity: DssAlertSeverity;
      message: string;
      recommendation: string;
      context: HighServiceCancellationAlertContext;
    }>
  | Readonly<{
      code: "UNDERUSED_SERVICE";
      severity: DssAlertSeverity;
      message: string;
      recommendation: string;
      context: UnderusedServiceAlertContext;
    }>
  | Readonly<{
      code: "FREQUENT_RETURNING_CUSTOMER";
      severity: DssAlertSeverity;
      message: string;
      recommendation: string;
      context: FrequentReturningCustomerAlertContext;
    }>
  | Readonly<{
      code: "LOW_RATING";
      severity: DssAlertSeverity;
      message: string;
      recommendation: string;
      context: LowRatingAlertContext;
    }>;

export type ProviderDashboardBookingVolume = Readonly<
  Record<ProviderBookingStatus, number> & {
    total: number;
  }
>;

export type ProviderDashboardPopularService = Readonly<{
  serviceId: string;
  serviceName: string;
  completedBookings: number;
}>;

export type ProviderDashboard = Readonly<{
  providerId: string;
  period: Readonly<{
    from: string;
    to: string;
  }>;
  bookingVolumeByStatus: ProviderDashboardBookingVolume;
  cancellationRate: Readonly<{
    cancelledBookings: number;
    resolvedBookings: number;
    rate: number | null;
  }>;
  popularServices: readonly ProviderDashboardPopularService[];
  returningCustomers: Readonly<{
    count: number;
  }>;
  recordedRevenue: Readonly<{
    amount: string;
  }>;
  averageRating: Readonly<{
    reviewCount: number;
    average: number | null;
  }>;
  alerts: readonly ProviderDssAlert[];
}>;

export type UpdateProviderProfileInput = Readonly<{
  businessName?: string;
  address?: string;
  phone?: string | null;
  description?: string | null;
}>;

export type CreateWorkingHourInput = Readonly<{
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}>;

export type UpdateWorkingHourInput = Readonly<{
  dayOfWeek?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}>;

export type CreateServiceInput = Readonly<{
  categoryId: string;
  name: string;
  /** Canonical NUMERIC(12,2) decimal string ("0.00" .. "9999999999.99"). */
  price: string;
  durationMinutes: number;
  description?: string | null;
}>;

export type UpdateServiceInput = Readonly<{
  categoryId?: string;
  name?: string;
  /** Canonical NUMERIC(12,2) decimal string ("0.00" .. "9999999999.99"). */
  price?: string;
  durationMinutes?: number;
  description?: string | null;
  status?: ProviderServiceStatus;
}>;

export type CreateAvailabilitySlotInput = Readonly<{
  serviceId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
}>;

export type UpdateAvailabilitySlotInput = Readonly<{
  serviceId?: string;
  slotDate?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  status?: ProviderSlotStatus;
}>;

export type ProviderBookingReasonInput = Readonly<{
  reason?: string | null;
}>;

export type ProviderDashboardQuery = Readonly<{
  from: string;
  to: string;
}>;

export type ProviderWorkspaceOperation =
  | "get-profile"
  | "update-profile"
  | "list-working-hours"
  | "create-working-hour"
  | "update-working-hour"
  | "deactivate-working-hour"
  | "list-categories"
  | "list-services"
  | "get-service"
  | "create-service"
  | "update-service"
  | "deactivate-service"
  | "list-availability"
  | "get-availability"
  | "create-availability"
  | "update-availability"
  | "deactivate-availability"
  | "list-bookings"
  | "get-booking"
  | "confirm-booking"
  | "reject-booking"
  | "complete-booking"
  | "no-show-booking"
  | "get-dashboard";

export type ProviderApiOutcome =
  | "definite-failure"
  | "unknown"
  | "session-busy"
  | "rate-limited"
  | "session-ended";

export type ProviderApiErrorCategory =
  | "auth"
  | "permission"
  | "lifecycle"
  | "validation"
  | "conflict"
  | "not-found"
  | "rate-limit"
  | "uncertain"
  | "transient"
  | "config";

export type ProviderApiErrorCode =
  | "INVALID_INPUT"
  | "INVALID_REQUEST"
  | "INVALID_QUERY"
  | "INVALID_DATE_RANGE"
  | "INVALID_TIME_RANGE"
  | "SESSION_ENDED"
  | "SESSION_BUSY"
  | "CSRF_REJECTED"
  | "PROVIDER_PROFILE_NOT_FOUND"
  | "PROVIDER_SUSPENDED_READONLY"
  | "PROVIDER_REJECTED_FORBIDDEN"
  | "PROVIDER_SUSPENDED_FORBIDDEN"
  | "PROVIDER_CONFIRM_FORBIDDEN"
  | "STAFF_ASSOCIATION_REQUIRED"
  | "FORBIDDEN_ROLE"
  | "WORKING_HOUR_NOT_FOUND"
  | "WORKING_HOUR_DUPLICATE"
  | "WORKING_HOUR_OVERLAP"
  | "WORKING_HOUR_HAS_ACTIVE_BOOKINGS"
  | "SERVICE_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS"
  | "SLOT_NOT_FOUND"
  | "SERVICE_INACTIVE"
  | "SLOT_IN_PAST"
  | "SLOT_STARTED"
  | "SLOT_DUPLICATE"
  | "SLOT_TOO_SHORT"
  | "SLOT_OUTSIDE_WORKING_HOURS"
  | "SLOT_HAS_BOOKINGS_LOCKED_FIELDS"
  | "SLOT_CAPACITY_BELOW_BOOKED"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_NOT_PENDING"
  | "BOOKING_NOT_CONFIRMED"
  | "NO_RESERVED_CAPACITY"
  | "NO_SHOW_TIME"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "RATE_LIMIT_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "INVALID_RESPONSE"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR";

export type ProviderApiErrorInfo = Readonly<{
  code: ProviderApiErrorCode;
  category: ProviderApiErrorCategory;
  outcome: ProviderApiOutcome;
  status: number | null;
  retryAfterSeconds: number | null;
  /** Caller should reload authoritative server state via GET rather than auto-retrying mutations. */
  shouldReconcile: boolean;
}>;

export class ProviderWorkspaceApiError extends Error {
  readonly code: ProviderApiErrorCode;
  readonly category: ProviderApiErrorCategory;
  readonly outcome: ProviderApiOutcome;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly shouldReconcile: boolean;
  readonly causeError: unknown;

  constructor(info: ProviderApiErrorInfo, causeError?: unknown) {
    super(info.code);
    this.name = "ProviderWorkspaceApiError";
    this.code = info.code;
    this.category = info.category;
    this.outcome = info.outcome;
    this.status = info.status;
    this.retryAfterSeconds = info.retryAfterSeconds;
    this.shouldReconcile = info.shouldReconcile;
    this.causeError = causeError;
  }
}

export type BffRequester = (
  path: string,
  options?: RequestOptions,
  decode?: (body: unknown) => unknown,
) => Promise<ApiResponse<unknown>>;

export type ProviderWorkspaceApiConfig = Readonly<{
  bffRequestImpl?: BffRequester;
  cache?: QueryCache | null;
  publicApiUrl?: string;
  publicFetchImpl?: ApiFetch;
}>;

const APPROVAL_STATUS_SET = new Set<string>(PROVIDER_APPROVAL_STATUSES);
const SERVICE_STATUS_SET = new Set<string>(PROVIDER_SERVICE_STATUSES);
const SLOT_STATUS_SET = new Set<string>(PROVIDER_SLOT_STATUSES);
const BOOKING_STATUS_SET = new Set<string>(PROVIDER_BOOKING_STATUSES);
const ALERT_SEVERITY_SET = new Set<string>(DSS_ALERT_SEVERITIES);

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const TIME_HH_MM_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TIME_HH_MM_ZERO_SEC_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:00$/;
const TIME_OF_DAY_FLEXIBLE_PATTERN =
  /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const TIME_OF_DAY_STRICT_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const NUMERIC_PRICE_PATTERN = /^\d{1,10}\.\d{2}$/;
const NUMERIC_REVENUE_PATTERN = /^\d{1,18}\.\d{2}$/;
const NUMERIC_RATING_PATTERN = /^[0-5](?:\.\d{1,2})?$/;
const NUMERIC_WEIGHT_PATTERN = /^\d{1,4}(?:\.\d{1,2})?$/;
const PRICE_DECIMAL_INPUT_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const MAX_INT32 = 2147483647;
const MAX_PRICE_CENTS = BigInt("999999999999");
const BIGINT_ZERO = BigInt(0);
const BIGINT_HUNDRED = BigInt(100);

const KNOWN_ERROR_CODES = new Set<ProviderApiErrorCode>([
  "INVALID_INPUT",
  "INVALID_REQUEST",
  "INVALID_QUERY",
  "INVALID_DATE_RANGE",
  "INVALID_TIME_RANGE",
  "SESSION_ENDED",
  "SESSION_BUSY",
  "CSRF_REJECTED",
  "PROVIDER_PROFILE_NOT_FOUND",
  "PROVIDER_SUSPENDED_READONLY",
  "PROVIDER_REJECTED_FORBIDDEN",
  "PROVIDER_SUSPENDED_FORBIDDEN",
  "PROVIDER_CONFIRM_FORBIDDEN",
  "STAFF_ASSOCIATION_REQUIRED",
  "FORBIDDEN_ROLE",
  "WORKING_HOUR_NOT_FOUND",
  "WORKING_HOUR_DUPLICATE",
  "WORKING_HOUR_OVERLAP",
  "WORKING_HOUR_HAS_ACTIVE_BOOKINGS",
  "SERVICE_NOT_FOUND",
  "CATEGORY_NOT_FOUND",
  "SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS",
  "SLOT_NOT_FOUND",
  "SERVICE_INACTIVE",
  "SLOT_IN_PAST",
  "SLOT_STARTED",
  "SLOT_DUPLICATE",
  "SLOT_TOO_SHORT",
  "SLOT_OUTSIDE_WORKING_HOURS",
  "SLOT_HAS_BOOKINGS_LOCKED_FIELDS",
  "SLOT_CAPACITY_BELOW_BOOKED",
  "BOOKING_NOT_FOUND",
  "BOOKING_NOT_PENDING",
  "BOOKING_NOT_CONFIRMED",
  "NO_RESERVED_CAPACITY",
  "NO_SHOW_TIME",
  "RESOURCE_NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "NETWORK_ERROR",
  "SERVER_ERROR",
  "INVALID_RESPONSE",
  "CONFIG_ERROR",
  "UNKNOWN_ERROR",
]);

const MUTATION_OPERATIONS = new Set<ProviderWorkspaceOperation>([
  "update-profile",
  "create-working-hour",
  "update-working-hour",
  "deactivate-working-hour",
  "create-service",
  "update-service",
  "deactivate-service",
  "create-availability",
  "update-availability",
  "deactivate-availability",
  "confirm-booking",
  "reject-booking",
  "complete-booking",
  "no-show-booking",
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

function asBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw invalidResponse();
  return value;
}

function asId(value: unknown): string {
  if (!validId(value)) throw invalidResponse();
  return value;
}

function asInt(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw invalidResponse();
  }
  return value;
}

function asFiniteNumber(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw invalidResponse();
  }
  return value;
}

function asPrice(value: unknown): string {
  const s = asString(value);
  if (!NUMERIC_PRICE_PATTERN.test(s)) throw invalidResponse();
  return s;
}

function asRevenueAmount(value: unknown): string {
  const s = asString(value);
  if (!NUMERIC_REVENUE_PATTERN.test(s)) throw invalidResponse();
  return s;
}

function asRatingAvg(value: unknown): string {
  const s = asString(value);
  if (!NUMERIC_RATING_PATTERN.test(s) || Number(s) > 5) {
    throw invalidResponse();
  }
  return s;
}

function asNullableWeight(value: unknown): string | null {
  if (value === null) return null;
  const s = asString(value);
  if (!NUMERIC_WEIGHT_PATTERN.test(s)) throw invalidResponse();
  return s;
}

export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }
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

const VIETNAM_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function asCalendarDate(value: unknown): string {
  if (!isValidCalendarDate(value)) throw invalidResponse();
  return value;
}

/**
 * Normalizes PEAK_HOUR_DEMAND.context.date from either YYYY-MM-DD or a
 * node-postgres raw DATE ISO timestamp (e.g. "2026-11-23T17:00:00.000Z"
 * under TZ=Asia/Ho_Chi_Minh or "2026-11-24T00:00:00.000Z" under TZ=UTC)
 * into a validated YYYY-MM-DD calendar date in Asia/Ho_Chi_Minh.
 */
function asDssCalendarDate(value: unknown): string {
  if (isValidCalendarDate(value)) return value;
  const s = asString(value);
  if (!ISO_TIMESTAMP_PATTERN.test(s)) throw invalidResponse();
  const parsedMs = Date.parse(s);
  if (!Number.isFinite(parsedMs)) throw invalidResponse();
  // Reject non-existent calendar dates (e.g. 2026-02-30T00:00:00.000Z) that Date.parse silently rolls over.
  if (!isValidCalendarDate(s.slice(0, 10))) throw invalidResponse();
  const parts = VIETNAM_DATE_FORMATTER.formatToParts(new Date(parsedMs));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const calendarDate = `${year}-${month}-${day}`;
  if (!isValidCalendarDate(calendarDate)) throw invalidResponse();
  return calendarDate;
}

function asNullableCalendarDate(value: unknown): string | null {
  return value === null ? null : asCalendarDate(value);
}

function asCalendarMonth(value: unknown): string {
  const s = asString(value);
  if (!CALENDAR_MONTH_PATTERN.test(s)) throw invalidResponse();
  return s;
}

function asIsoTimestamp(value: unknown): string {
  const s = asString(value);
  if (!ISO_TIMESTAMP_PATTERN.test(s) || !Number.isFinite(Date.parse(s))) {
    throw invalidResponse();
  }
  return s;
}

function parseTimeOfDayToSeconds(value: string): number | null {
  if (!TIME_OF_DAY_FLEXIBLE_PATTERN.test(value)) return null;
  const parts = value.split(":").map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  const seconds = parts[2] ?? 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function asTimeOfDayFlexible(value: unknown): string {
  const s = asString(value);
  if (!TIME_OF_DAY_FLEXIBLE_PATTERN.test(s)) throw invalidResponse();
  return s;
}

function asTimeOfDayStrict(value: unknown): string {
  const s = asString(value);
  if (!TIME_OF_DAY_STRICT_PATTERN.test(s)) throw invalidResponse();
  return s;
}

/**
 * Normalizes HH:mm or HH:mm:00 inputs to strict HH:mm required by NestJS DTOs.
 * Rejects non-zero seconds (e.g. 09:00:30) or malformed values by returning null.
 */
export function normalizeTimeToHhMm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (TIME_HH_MM_PATTERN.test(value)) return value;
  if (TIME_HH_MM_ZERO_SEC_PATTERN.test(value)) return value.slice(0, 5);
  return null;
}

export function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function asApprovalStatus(value: unknown): ProviderApprovalStatus {
  const s = asString(value);
  if (!APPROVAL_STATUS_SET.has(s)) throw invalidResponse();
  return s as ProviderApprovalStatus;
}

function asServiceStatus(value: unknown): ProviderServiceStatus {
  const s = asString(value);
  if (!SERVICE_STATUS_SET.has(s)) throw invalidResponse();
  return s as ProviderServiceStatus;
}

function asSlotStatus(value: unknown): ProviderSlotStatus {
  const s = asString(value);
  if (!SLOT_STATUS_SET.has(s)) throw invalidResponse();
  return s as ProviderSlotStatus;
}

function asBookingStatus(value: unknown): ProviderBookingStatus {
  const s = asString(value);
  if (!BOOKING_STATUS_SET.has(s)) throw invalidResponse();
  return s as ProviderBookingStatus;
}

function asAlertSeverity(value: unknown): DssAlertSeverity {
  const s = asString(value);
  if (!ALERT_SEVERITY_SET.has(s)) throw invalidResponse();
  return s as DssAlertSeverity;
}

export function decodeProviderProfile(value: unknown): ProviderProfile {
  const o = asObject(value);
  return {
    id: asId(o.id),
    ownerId: asId(o.ownerId),
    businessName: asString(o.businessName),
    address: asString(o.address),
    phone: asNullableString(o.phone),
    description: asNullableString(o.description),
    approvalStatus: asApprovalStatus(o.approvalStatus),
    ratingAvg: asRatingAvg(o.ratingAvg),
    ratingCount: asInt(o.ratingCount, 0),
    createdAt: asIsoTimestamp(o.createdAt),
    updatedAt: asIsoTimestamp(o.updatedAt),
  };
}

export function decodeWorkingHour(
  value: unknown,
  expectedId?: string,
): ProviderWorkingHour {
  const o = asObject(value);
  const startTime = asTimeOfDayFlexible(o.startTime);
  const endTime = asTimeOfDayFlexible(o.endTime);
  const startSeconds = parseTimeOfDayToSeconds(startTime);
  const endSeconds = parseTimeOfDayToSeconds(endTime);
  if (
    startSeconds === null ||
    endSeconds === null ||
    endSeconds <= startSeconds
  ) {
    throw invalidResponse();
  }
  const id = asId(o.id);
  if (expectedId !== undefined && id !== expectedId) throw invalidResponse();
  return {
    id,
    providerId: asId(o.providerId),
    dayOfWeek: asInt(o.dayOfWeek, 0, 6) as DayOfWeek,
    startTime,
    endTime,
    isActive: asBoolean(o.isActive),
    createdAt: asIsoTimestamp(o.createdAt),
    updatedAt: asIsoTimestamp(o.updatedAt),
  };
}

export function decodeWorkingHours(value: unknown): ProviderWorkingHour[] {
  if (!Array.isArray(value)) throw invalidResponse();
  const items = value.map((item) => decodeWorkingHour(item));
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw invalidResponse();
  }
  return items;
}

function decodeServiceCategoryRef(value: unknown): ProviderServiceCategoryRef {
  const o = asObject(value);
  return {
    id: asId(o.id),
    name: asString(o.name),
    description: asNullableString(o.description),
    status: asServiceStatus(o.status),
  };
}

export function decodeProviderService(
  value: unknown,
  options: { requireCategory?: boolean; expectedId?: string } = {},
): ProviderService {
  const o = asObject(value);
  const id = asId(o.id);
  if (options.expectedId !== undefined && id !== options.expectedId) {
    throw invalidResponse();
  }
  const categoryId = asId(o.categoryId);
  let category: ProviderServiceCategoryRef | null = null;
  if (options.requireCategory) {
    category = decodeServiceCategoryRef(o.category);
  } else if (o.category !== undefined && o.category !== null) {
    category = decodeServiceCategoryRef(o.category);
  }
  if (category !== null && category.id !== categoryId) {
    throw invalidResponse();
  }
  return {
    id,
    providerId: asId(o.providerId),
    categoryId,
    name: asString(o.name),
    price: asPrice(o.price),
    durationMinutes: asInt(o.durationMinutes, 1, MAX_INT32),
    description: asNullableString(o.description),
    status: asServiceStatus(o.status),
    createdAt: asIsoTimestamp(o.createdAt),
    updatedAt: asIsoTimestamp(o.updatedAt),
    category,
  };
}

export function decodeProviderServices(value: unknown): ProviderService[] {
  if (!Array.isArray(value)) throw invalidResponse();
  const items = value.map((item) =>
    decodeProviderService(item, { requireCategory: true }),
  );
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw invalidResponse();
  }
  return items;
}

function decodeAvailabilityServiceRef(
  value: unknown,
): ProviderAvailabilityServiceRef {
  const o = asObject(value);
  return {
    id: asId(o.id),
    categoryId: asId(o.categoryId),
    name: asString(o.name),
    price: asPrice(o.price),
    durationMinutes: asInt(o.durationMinutes, 1, MAX_INT32),
    description: asNullableString(o.description),
    status: asServiceStatus(o.status),
  };
}

export function decodeProviderAvailabilitySlot(
  value: unknown,
  options: { requireService?: boolean; expectedId?: string } = {},
): ProviderAvailabilitySlot {
  const o = asObject(value);
  const id = asId(o.id);
  if (options.expectedId !== undefined && id !== options.expectedId) {
    throw invalidResponse();
  }
  const serviceId = asId(o.serviceId);
  const slotDate = asCalendarDate(o.slotDate);
  const startTime = asTimeOfDayFlexible(o.startTime);
  const endTime = asTimeOfDayFlexible(o.endTime);
  const startSeconds = parseTimeOfDayToSeconds(startTime);
  const endSeconds = parseTimeOfDayToSeconds(endTime);
  if (
    startSeconds === null ||
    endSeconds === null ||
    endSeconds <= startSeconds
  ) {
    throw invalidResponse();
  }
  const capacity = asInt(o.capacity, 1, MAX_INT32);
  const bookedCount = asInt(o.bookedCount, 0, capacity);

  let service: ProviderAvailabilityServiceRef | null = null;
  if (options.requireService) {
    service = decodeAvailabilityServiceRef(o.service);
  } else if (o.service !== undefined && o.service !== null) {
    service = decodeAvailabilityServiceRef(o.service);
  }
  if (service !== null && service.id !== serviceId) {
    throw invalidResponse();
  }

  return {
    id,
    providerId: asId(o.providerId),
    serviceId,
    slotDate,
    startTime,
    endTime,
    capacity,
    bookedCount,
    status: asSlotStatus(o.status),
    createdAt: asIsoTimestamp(o.createdAt),
    updatedAt: asIsoTimestamp(o.updatedAt),
    service,
  };
}

export function decodeProviderAvailabilitySlots(
  value: unknown,
): ProviderAvailabilitySlot[] {
  if (!Array.isArray(value)) throw invalidResponse();
  const items = value.map((item) =>
    decodeProviderAvailabilitySlot(item, { requireService: true }),
  );
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw invalidResponse();
  }
  return items;
}

function decodeBookingSlot(value: unknown): ProviderBookingSlot {
  const o = asObject(value);
  const slotDate = asCalendarDate(o.slotDate);
  const startTime = asTimeOfDayStrict(o.startTime);
  const endTime = asTimeOfDayStrict(o.endTime);
  if (endTime <= startTime) throw invalidResponse();
  return {
    id: asId(o.id),
    slotDate,
    startTime,
    endTime,
  };
}

function decodeBookingStatusLog(value: unknown): ProviderBookingStatusLog {
  const o = asObject(value);
  return {
    id: asId(o.id),
    oldStatus: o.oldStatus === null ? null : asBookingStatus(o.oldStatus),
    newStatus: asBookingStatus(o.newStatus),
    reason: asNullableString(o.reason),
    createdAt: asIsoTimestamp(o.createdAt),
  };
}

export function decodeProviderBooking(
  value: unknown,
  expectedId?: string,
): ProviderBooking {
  const o = asObject(value);
  const id = asId(o.id);
  if (expectedId !== undefined && id !== expectedId) throw invalidResponse();
  const service = asObject(o.service);
  const customer = asObject(o.customer);
  const pet = asObject(o.pet);
  const petType = asObject(pet.petType);
  return {
    id,
    status: asBookingStatus(o.status),
    bookedPrice: asPrice(o.bookedPrice),
    customerNote: asNullableString(o.customerNote),
    createdAt: asIsoTimestamp(o.createdAt),
    updatedAt: asIsoTimestamp(o.updatedAt),
    service: {
      id: asId(service.id),
      name: asString(service.name),
      durationMinutes: asInt(service.durationMinutes, 1, MAX_INT32),
    },
    slot: decodeBookingSlot(o.slot),
    customer: {
      id: asId(customer.id),
      fullName: asString(customer.fullName),
    },
    pet: {
      id: asId(pet.id),
      name: asString(pet.name),
      breed: asNullableString(pet.breed),
      birthDate: asNullableCalendarDate(pet.birthDate),
      weight: asNullableWeight(pet.weight),
      healthNote: asNullableString(pet.healthNote),
      petType: {
        id: asId(petType.id),
        name: asString(petType.name),
      },
    },
  };
}

export function decodeProviderBookings(value: unknown): ProviderBooking[] {
  if (!Array.isArray(value)) throw invalidResponse();
  const items = value.map((item) => decodeProviderBooking(item));
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw invalidResponse();
  }
  return items;
}

export function decodeProviderBookingDetail(
  value: unknown,
  expectedId?: string,
): ProviderBookingDetail {
  const booking = decodeProviderBooking(value, expectedId);
  const o = asObject(value);
  if (!Array.isArray(o.statusLogs)) throw invalidResponse();
  const statusLogs = o.statusLogs.map(decodeBookingStatusLog);
  if (new Set(statusLogs.map((log) => log.id)).size !== statusLogs.length) {
    throw invalidResponse();
  }
  return {
    ...booking,
    statusLogs,
  };
}

function decodeDssAlert(value: unknown): ProviderDssAlert {
  const o = asObject(value);
  const code = asString(o.code);
  const severity = asAlertSeverity(o.severity);
  const message = asString(o.message);
  const recommendation = asString(o.recommendation);
  const ctx = asObject(o.context);

  switch (code) {
    case "PEAK_HOUR_DEMAND": {
      const totalAcceptedBookings = asInt(ctx.totalAcceptedBookings, 1);
      const peakAcceptedBookings = asInt(
        ctx.peakAcceptedBookings,
        0,
        totalAcceptedBookings,
      );
      return {
        code,
        severity,
        message,
        recommendation,
        context: {
          date: asDssCalendarDate(ctx.date),
          peakAcceptedBookings,
          totalAcceptedBookings,
          percentage: asFiniteNumber(ctx.percentage, 0, 100),
        },
      };
    }
    case "HIGH_SERVICE_CANCELLATION": {
      const resolvedBookings = asInt(ctx.resolvedBookings, 1);
      const cancelledBookings = asInt(
        ctx.cancelledBookings,
        0,
        resolvedBookings,
      );
      return {
        code,
        severity,
        message,
        recommendation,
        context: {
          month: asCalendarMonth(ctx.month),
          serviceId: asId(ctx.serviceId),
          cancelledBookings,
          resolvedBookings,
          percentage: asFiniteNumber(ctx.percentage, 0, 100),
        },
      };
    }
    case "UNDERUSED_SERVICE": {
      return {
        code,
        severity,
        message,
        recommendation,
        context: {
          month: asCalendarMonth(ctx.month),
          serviceId: asId(ctx.serviceId),
          completedBookings: asInt(ctx.completedBookings, 0),
          comparisonAverage: asFiniteNumber(
            ctx.comparisonAverage,
            0,
            Number.MAX_SAFE_INTEGER,
          ),
        },
      };
    }
    case "FREQUENT_RETURNING_CUSTOMER": {
      const from = asCalendarDate(ctx.from);
      const to = asCalendarDate(ctx.to);
      if (from > to) throw invalidResponse();
      return {
        code,
        severity,
        message,
        recommendation,
        context: {
          customerId: asId(ctx.customerId),
          completedBookings: asInt(ctx.completedBookings, 1),
          from,
          to,
        },
      };
    }
    case "LOW_RATING": {
      const from = asCalendarDate(ctx.from);
      const to = asCalendarDate(ctx.to);
      if (from > to) throw invalidResponse();
      return {
        code,
        severity,
        message,
        recommendation,
        context: {
          from,
          to,
          reviewCount: asInt(ctx.reviewCount, 1),
          average: asFiniteNumber(ctx.average, 0, 5),
        },
      };
    }
    default:
      throw invalidResponse();
  }
}

export function decodeProviderDashboard(
  value: unknown,
  expectedPeriod?: ProviderDashboardQuery,
): ProviderDashboard {
  const o = asObject(value);
  const providerId = asId(o.providerId);

  const periodObj = asObject(o.period);
  const from = asCalendarDate(periodObj.from);
  const to = asCalendarDate(periodObj.to);
  if (from > to) throw invalidResponse();
  if (
    expectedPeriod &&
    (from !== expectedPeriod.from || to !== expectedPeriod.to)
  ) {
    throw invalidResponse();
  }

  const volumeObj = asObject(o.bookingVolumeByStatus);
  const bookingVolumeByStatus: ProviderDashboardBookingVolume = {
    PENDING_CONFIRMATION: asInt(volumeObj.PENDING_CONFIRMATION, 0),
    CONFIRMED: asInt(volumeObj.CONFIRMED, 0),
    REJECTED: asInt(volumeObj.REJECTED, 0),
    COMPLETED: asInt(volumeObj.COMPLETED, 0),
    CANCELLED: asInt(volumeObj.CANCELLED, 0),
    NO_SHOW: asInt(volumeObj.NO_SHOW, 0),
    total: asInt(volumeObj.total, 0),
  };
  const sumVolume =
    bookingVolumeByStatus.PENDING_CONFIRMATION +
    bookingVolumeByStatus.CONFIRMED +
    bookingVolumeByStatus.REJECTED +
    bookingVolumeByStatus.COMPLETED +
    bookingVolumeByStatus.CANCELLED +
    bookingVolumeByStatus.NO_SHOW;
  if (sumVolume !== bookingVolumeByStatus.total) throw invalidResponse();

  const cancelObj = asObject(o.cancellationRate);
  const cancelledBookings = asInt(cancelObj.cancelledBookings, 0);
  const resolvedBookings = asInt(cancelObj.resolvedBookings, 0);
  const expectedResolved =
    bookingVolumeByStatus.COMPLETED +
    bookingVolumeByStatus.CANCELLED +
    bookingVolumeByStatus.NO_SHOW;
  if (
    cancelledBookings !== bookingVolumeByStatus.CANCELLED ||
    resolvedBookings !== expectedResolved
  ) {
    throw invalidResponse();
  }
  let rate: number | null;
  if (resolvedBookings === 0) {
    if (cancelObj.rate !== null) throw invalidResponse();
    rate = null;
  } else {
    rate = asFiniteNumber(cancelObj.rate, 0, 100);
  }

  if (!Array.isArray(o.popularServices)) throw invalidResponse();
  const popularServices = o.popularServices.map((item) => {
    const row = asObject(item);
    return {
      serviceId: asId(row.serviceId),
      serviceName: asString(row.serviceName),
      completedBookings: asInt(row.completedBookings, 1),
    };
  });
  if (
    new Set(popularServices.map((item) => item.serviceId)).size !==
    popularServices.length
  ) {
    throw invalidResponse();
  }

  const returningObj = asObject(o.returningCustomers);
  const returningCustomers = { count: asInt(returningObj.count, 0) };

  const revenueObj = asObject(o.recordedRevenue);
  const recordedRevenue = { amount: asRevenueAmount(revenueObj.amount) };

  const ratingObj = asObject(o.averageRating);
  const reviewCount = asInt(ratingObj.reviewCount, 0);
  let average: number | null;
  if (reviewCount === 0) {
    if (ratingObj.average !== null) throw invalidResponse();
    average = null;
  } else {
    average = asFiniteNumber(ratingObj.average, 0, 5);
  }

  if (!Array.isArray(o.alerts)) throw invalidResponse();
  const alerts = o.alerts.map(decodeDssAlert);

  return {
    providerId,
    period: { from, to },
    bookingVolumeByStatus,
    cancellationRate: {
      cancelledBookings,
      resolvedBookings,
      rate,
    },
    popularServices,
    returningCustomers,
    recordedRevenue,
    averageRating: {
      reviewCount,
      average,
    },
    alerts,
  };
}

function isMutationOperation(operation: ProviderWorkspaceOperation): boolean {
  return MUTATION_OPERATIONS.has(operation);
}

function errorInfoFromCode(
  code: ProviderApiErrorCode,
  operation: ProviderWorkspaceOperation,
  status: number | null,
  retryAfterSeconds: number | null,
): ProviderApiErrorInfo {
  const mutation = isMutationOperation(operation);

  switch (code) {
    case "SESSION_ENDED":
      return {
        code,
        category: "auth",
        outcome: "session-ended",
        status,
        retryAfterSeconds: null,
        shouldReconcile: false,
      };
    case "SESSION_BUSY":
      return {
        code,
        category: "auth",
        outcome: "session-busy",
        status,
        retryAfterSeconds,
        shouldReconcile: false,
      };
    case "CSRF_REJECTED":
      return {
        code,
        category: "auth",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        shouldReconcile: false,
      };
    case "RATE_LIMITED":
    case "RATE_LIMIT_UNAVAILABLE":
      return {
        code,
        category: "rate-limit",
        outcome: "rate-limited",
        status,
        retryAfterSeconds,
        shouldReconcile: false,
      };
    case "PROVIDER_SUSPENDED_READONLY":
    case "PROVIDER_REJECTED_FORBIDDEN":
    case "PROVIDER_SUSPENDED_FORBIDDEN":
    case "PROVIDER_CONFIRM_FORBIDDEN":
      return {
        code,
        category: "lifecycle",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        shouldReconcile: true,
      };
    case "STAFF_ASSOCIATION_REQUIRED":
    case "FORBIDDEN_ROLE":
      return {
        code,
        category: "permission",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        shouldReconcile: false,
      };
    case "INVALID_INPUT":
    case "INVALID_REQUEST":
    case "INVALID_QUERY":
    case "INVALID_DATE_RANGE":
    case "INVALID_TIME_RANGE":
    case "SERVICE_INACTIVE":
    case "SLOT_IN_PAST":
    case "SLOT_STARTED":
      return {
        code,
        category: "validation",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        shouldReconcile: code === "SERVICE_INACTIVE",
      };
    case "PROVIDER_PROFILE_NOT_FOUND":
    case "WORKING_HOUR_NOT_FOUND":
    case "SERVICE_NOT_FOUND":
    case "CATEGORY_NOT_FOUND":
    case "SLOT_NOT_FOUND":
    case "BOOKING_NOT_FOUND":
    case "RESOURCE_NOT_FOUND":
      return {
        code,
        category: "not-found",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        shouldReconcile: mutation,
      };
    case "WORKING_HOUR_DUPLICATE":
    case "WORKING_HOUR_OVERLAP":
    case "WORKING_HOUR_HAS_ACTIVE_BOOKINGS":
    case "SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS":
    case "SLOT_DUPLICATE":
    case "SLOT_TOO_SHORT":
    case "SLOT_OUTSIDE_WORKING_HOURS":
    case "SLOT_HAS_BOOKINGS_LOCKED_FIELDS":
    case "SLOT_CAPACITY_BELOW_BOOKED":
    case "BOOKING_NOT_PENDING":
    case "BOOKING_NOT_CONFIRMED":
    case "NO_RESERVED_CAPACITY":
    case "NO_SHOW_TIME":
    case "CONFLICT":
      return {
        code,
        category: "conflict",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        shouldReconcile: true,
      };
    case "CONFIG_ERROR":
      return {
        code,
        category: "config",
        outcome: "definite-failure",
        status,
        retryAfterSeconds: null,
        shouldReconcile: false,
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
        shouldReconcile: mutation,
      };
  }
}

function defaultNotFoundCode(
  operation: ProviderWorkspaceOperation,
): ProviderApiErrorCode {
  switch (operation) {
    case "get-profile":
    case "update-profile":
    case "get-dashboard":
      return "PROVIDER_PROFILE_NOT_FOUND";
    case "update-working-hour":
    case "deactivate-working-hour":
      return "WORKING_HOUR_NOT_FOUND";
    case "get-service":
    case "update-service":
    case "deactivate-service":
      return "SERVICE_NOT_FOUND";
    case "get-availability":
    case "update-availability":
    case "deactivate-availability":
      return "SLOT_NOT_FOUND";
    case "get-booking":
    case "confirm-booking":
    case "reject-booking":
    case "complete-booking":
    case "no-show-booking":
      return "BOOKING_NOT_FOUND";
    default:
      return "RESOURCE_NOT_FOUND";
  }
}

export function classifyProviderError(
  error: unknown,
  operation: ProviderWorkspaceOperation,
): ProviderApiErrorInfo {
  if (error instanceof ProviderWorkspaceApiError) {
    return {
      code: error.code,
      category: error.category,
      outcome: error.outcome,
      status: error.status,
      retryAfterSeconds: error.retryAfterSeconds,
      shouldReconcile: error.shouldReconcile,
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

    if (
      error.code &&
      KNOWN_ERROR_CODES.has(error.code as ProviderApiErrorCode)
    ) {
      return errorInfoFromCode(
        error.code as ProviderApiErrorCode,
        operation,
        error.status,
        error.retryAfterSeconds,
      );
    }

    if (error.status === 401) {
      return errorInfoFromCode("SESSION_ENDED", operation, 401, null);
    }
    if (error.status === 403) {
      return errorInfoFromCode("FORBIDDEN_ROLE", operation, 403, null);
    }
    if (error.status === 404) {
      return errorInfoFromCode(
        defaultNotFoundCode(operation),
        operation,
        404,
        null,
      );
    }
    if (error.status === 409) {
      return errorInfoFromCode("CONFLICT", operation, 409, null);
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

function toProviderApiError(
  error: unknown,
  operation: ProviderWorkspaceOperation,
): ProviderWorkspaceApiError {
  if (error instanceof ProviderWorkspaceApiError) return error;
  return new ProviderWorkspaceApiError(
    classifyProviderError(error, operation),
    error,
  );
}

function invalidInputError(
  operation: ProviderWorkspaceOperation,
  code: ProviderApiErrorCode = "INVALID_INPUT",
): ProviderWorkspaceApiError {
  return new ProviderWorkspaceApiError(
    errorInfoFromCode(code, operation, null, null),
  );
}

function isValidNullableStringOptional(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

/**
 * Validates and normalizes service price strictly as a canonical decimal string
 * ("0.00" .. "9999999999.99") using regex + BigInt cents — never IEEE-754 floats.
 */
export function normalizeServicePriceInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!PRICE_DECIMAL_INPUT_PATTERN.test(trimmed)) return null;
  const dotIndex = trimmed.indexOf(".");
  const rawInt = dotIndex === -1 ? trimmed : trimmed.slice(0, dotIndex);
  const rawFrac = dotIndex === -1 ? "" : trimmed.slice(dotIndex + 1);
  const normalizedInt = rawInt.replace(/^0+(?=\d)/, "");
  if (normalizedInt.length > 10) return null;
  const paddedFrac = rawFrac.padEnd(2, "0");
  const cents = BigInt(normalizedInt) * BIGINT_HUNDRED + BigInt(paddedFrac);
  if (cents < BIGINT_ZERO || cents > MAX_PRICE_CENTS) return null;
  return `${normalizedInt}.${paddedFrac}`;
}

function isValidPositiveInt32(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_INT32
  );
}

function isValidDayOfWeek(value: unknown): value is DayOfWeek {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}

function decodeNoContent(value: unknown): undefined {
  if (value !== null) throw invalidResponse();
  return undefined;
}

export function createProviderWorkspaceApi(
  config: ProviderWorkspaceApiConfig = {},
) {
  const requestBff: BffRequester = config.bffRequestImpl ?? bffRequest;
  const cache = config.cache === undefined ? privateCache : config.cache;

  function invalidateBranches(branches: readonly QueryKey[]) {
    if (!cache) return;
    for (const branch of branches) {
      cache.invalidate(branch);
    }
  }

  async function runQuery<T>(
    operation: ProviderWorkspaceOperation,
    key: QueryKey,
    path: string,
    decode: (raw: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T> {
    throwIfCancelled(signal);
    const ticket = cache ? cache.ticket(key) : null;
    try {
      const response = await requestBff(
        path,
        { method: "GET", signal },
        decode,
      );
      throwIfCancelled(signal);
      const data = response.body as T;
      if (
        cache &&
        ticket &&
        !cache.write(ticket, data, queryFreshness.provider)
      ) {
        throw new DOMException("Superseded", "AbortError");
      }
      return data;
    } catch (error) {
      if (isRequestCancelled(error)) throw error;
      throw toProviderApiError(error, operation);
    }
  }

  async function runMutation<T>(
    operation: ProviderWorkspaceOperation,
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
    decode: (raw: unknown) => T,
    invalidations: readonly QueryKey[],
    signal?: AbortSignal,
  ): Promise<T> {
    throwIfCancelled(signal);
    try {
      const response = await requestBff(
        path,
        { method, body, signal },
        decode,
      );
      throwIfCancelled(signal);
      invalidateBranches(invalidations);
      return response.body as T;
    } catch (error) {
      if (isRequestCancelled(error)) throw error;
      const wrapped = toProviderApiError(error, operation);
      if (wrapped.outcome === "unknown") {
        invalidateBranches(invalidations);
      }
      throw wrapped;
    }
  }

  function getProviderProfile(
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderProfile> {
    return runQuery(
      "get-profile",
      queryKeys.provider.profile(),
      "/providers/me",
      decodeProviderProfile,
      options.signal,
    );
  }

  async function updateProviderProfile(
    input: UpdateProviderProfileInput,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderProfile> {
    throwIfCancelled(options.signal);
    const body: Record<string, unknown> = {};

    if (input.businessName !== undefined) {
      if (typeof input.businessName !== "string") {
        throw invalidInputError("update-profile");
      }
      const trimmed = input.businessName.trim();
      if (trimmed.length < 2 || trimmed.length > 200) {
        throw invalidInputError("update-profile");
      }
      body.businessName = trimmed;
    }
    if (input.address !== undefined) {
      if (typeof input.address !== "string") {
        throw invalidInputError("update-profile");
      }
      const trimmed = input.address.trim();
      if (trimmed.length < 5) {
        throw invalidInputError("update-profile");
      }
      body.address = trimmed;
    }
    if (input.phone !== undefined) {
      if (!isValidNullableStringOptional(input.phone)) {
        throw invalidInputError("update-profile");
      }
      const normalized = normalizeOptionalText(input.phone);
      if (normalized !== null && normalized.length > 20) {
        throw invalidInputError("update-profile");
      }
      body.phone = normalized;
    }
    if (input.description !== undefined) {
      if (!isValidNullableStringOptional(input.description)) {
        throw invalidInputError("update-profile");
      }
      body.description = normalizeOptionalText(input.description);
    }

    return runMutation(
      "update-profile",
      "/providers/me",
      "PATCH",
      body,
      decodeProviderProfile,
      [queryKeys.provider.profile()],
      options.signal,
    );
  }

  function listWorkingHours(
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderWorkingHour[]> {
    return runQuery(
      "list-working-hours",
      queryKeys.provider.workingHours(),
      "/providers/working-hours",
      decodeWorkingHours,
      options.signal,
    );
  }

  async function createWorkingHour(
    input: CreateWorkingHourInput,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderWorkingHour> {
    throwIfCancelled(options.signal);
    const startTime = normalizeTimeToHhMm(input.startTime);
    const endTime = normalizeTimeToHhMm(input.endTime);
    if (
      !isValidDayOfWeek(input.dayOfWeek) ||
      startTime === null ||
      endTime === null ||
      (input.isActive !== undefined && typeof input.isActive !== "boolean")
    ) {
      throw invalidInputError("create-working-hour");
    }
    if (endTime <= startTime) {
      throw invalidInputError("create-working-hour", "INVALID_TIME_RANGE");
    }

    const body: Record<string, unknown> = {
      dayOfWeek: input.dayOfWeek,
      startTime,
      endTime,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };

    return runMutation(
      "create-working-hour",
      "/providers/working-hours",
      "POST",
      body,
      (raw) => decodeWorkingHour(raw),
      [queryKeys.provider.workingHours(), queryKeys.provider.availability()],
      options.signal,
    );
  }

  async function updateWorkingHour(
    workingHourId: string,
    input: UpdateWorkingHourInput,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderWorkingHour> {
    throwIfCancelled(options.signal);
    if (!validId(workingHourId)) {
      throw invalidInputError("update-working-hour");
    }

    const body: Record<string, unknown> = {};
    if (input.dayOfWeek !== undefined) {
      if (!isValidDayOfWeek(input.dayOfWeek)) {
        throw invalidInputError("update-working-hour");
      }
      body.dayOfWeek = input.dayOfWeek;
    }

    let normalizedStart: string | null = null;
    if (input.startTime !== undefined) {
      normalizedStart = normalizeTimeToHhMm(input.startTime);
      if (normalizedStart === null) {
        throw invalidInputError("update-working-hour");
      }
      body.startTime = normalizedStart;
    }

    let normalizedEnd: string | null = null;
    if (input.endTime !== undefined) {
      normalizedEnd = normalizeTimeToHhMm(input.endTime);
      if (normalizedEnd === null) {
        throw invalidInputError("update-working-hour");
      }
      body.endTime = normalizedEnd;
    }

    if (
      normalizedStart !== null &&
      normalizedEnd !== null &&
      normalizedEnd <= normalizedStart
    ) {
      throw invalidInputError("update-working-hour", "INVALID_TIME_RANGE");
    }

    if (input.isActive !== undefined) {
      if (typeof input.isActive !== "boolean") {
        throw invalidInputError("update-working-hour");
      }
      body.isActive = input.isActive;
    }

    return runMutation(
      "update-working-hour",
      `/providers/working-hours/${workingHourId}`,
      "PATCH",
      body,
      (raw) => decodeWorkingHour(raw, workingHourId),
      [queryKeys.provider.workingHours(), queryKeys.provider.availability()],
      options.signal,
    );
  }

  async function deactivateWorkingHour(
    workingHourId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    throwIfCancelled(options.signal);
    if (!validId(workingHourId)) {
      throw invalidInputError("deactivate-working-hour");
    }

    await runMutation(
      "deactivate-working-hour",
      `/providers/working-hours/${workingHourId}`,
      "DELETE",
      {},
      decodeNoContent,
      [queryKeys.provider.workingHours(), queryKeys.provider.availability()],
      options.signal,
    );
  }

  async function listActiveServiceCategories(
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<ServiceCategoryOption[]> {
    throwIfCancelled(options.signal);
    const timeoutMs = options.timeoutMs ?? PUBLIC_CATEGORIES_TIMEOUT_MS;
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

    const publicApi = createPublicApi({
      apiUrl: config.publicApiUrl,
      fetchImpl: config.publicFetchImpl,
    });
    const requestPromise = publicApi.categories(controller.signal);
    requestPromise.catch(() => {});

    try {
      const categories = await Promise.race([requestPromise, aborted]);
      throwIfCancelled(options.signal);
      if (timedOut) throw new ApiError("network");
      return categories;
    } catch (error) {
      if (timedOut && !options.signal?.aborted) {
        throw toProviderApiError(new ApiError("network"), "list-categories");
      }
      if (isRequestCancelled(error) || options.signal?.aborted) {
        throw new DOMException("Request cancelled", "AbortError");
      }
      throw toProviderApiError(error, "list-categories");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  function listMyServices(
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderService[]> {
    return runQuery(
      "list-services",
      queryKeys.provider.services(),
      "/services/mine",
      decodeProviderServices,
      options.signal,
    );
  }

  async function getMyService(
    serviceId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderService> {
    throwIfCancelled(options.signal);
    if (!validId(serviceId)) {
      throw invalidInputError("get-service");
    }
    return runQuery(
      "get-service",
      [...queryKeys.provider.services(), "detail", serviceId],
      `/services/mine/${serviceId}`,
      (raw) =>
        decodeProviderService(raw, {
          requireCategory: true,
          expectedId: serviceId,
        }),
      options.signal,
    );
  }

  async function createService(
    input: CreateServiceInput,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderService> {
    throwIfCancelled(options.signal);
    const normalizedPrice = normalizeServicePriceInput(input.price);
    if (
      !validId(input.categoryId) ||
      typeof input.name !== "string" ||
      normalizedPrice === null ||
      !isValidPositiveInt32(input.durationMinutes) ||
      !isValidNullableStringOptional(input.description)
    ) {
      throw invalidInputError("create-service");
    }
    const trimmedName = input.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 200) {
      throw invalidInputError("create-service");
    }

    const body: Record<string, unknown> = {
      categoryId: input.categoryId,
      name: trimmedName,
      price: normalizedPrice,
      durationMinutes: input.durationMinutes,
      ...(input.description !== undefined
        ? { description: normalizeOptionalText(input.description) }
        : {}),
    };

    return runMutation(
      "create-service",
      "/services",
      "POST",
      body,
      (raw) => decodeProviderService(raw, { requireCategory: false }),
      [
        queryKeys.provider.services(),
        queryKeys.provider.availability(),
        queryKeys.provider.dashboardAll(),
      ],
      options.signal,
    );
  }

  async function updateService(
    serviceId: string,
    input: UpdateServiceInput,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderService> {
    throwIfCancelled(options.signal);
    if (!validId(serviceId)) {
      throw invalidInputError("update-service");
    }

    const body: Record<string, unknown> = {};
    if (input.categoryId !== undefined) {
      if (!validId(input.categoryId)) {
        throw invalidInputError("update-service");
      }
      body.categoryId = input.categoryId;
    }
    if (input.name !== undefined) {
      if (typeof input.name !== "string") {
        throw invalidInputError("update-service");
      }
      const trimmed = input.name.trim();
      if (trimmed.length < 1 || trimmed.length > 200) {
        throw invalidInputError("update-service");
      }
      body.name = trimmed;
    }
    if (input.price !== undefined) {
      const normalizedPrice = normalizeServicePriceInput(input.price);
      if (normalizedPrice === null) {
        throw invalidInputError("update-service");
      }
      body.price = normalizedPrice;
    }
    if (input.durationMinutes !== undefined) {
      if (!isValidPositiveInt32(input.durationMinutes)) {
        throw invalidInputError("update-service");
      }
      body.durationMinutes = input.durationMinutes;
    }
    if (input.description !== undefined) {
      if (!isValidNullableStringOptional(input.description)) {
        throw invalidInputError("update-service");
      }
      body.description = normalizeOptionalText(input.description);
    }
    if (input.status !== undefined) {
      if (!SERVICE_STATUS_SET.has(input.status)) {
        throw invalidInputError("update-service");
      }
      body.status = input.status;
    }

    return runMutation(
      "update-service",
      `/services/mine/${serviceId}`,
      "PATCH",
      body,
      (raw) =>
        decodeProviderService(raw, {
          requireCategory: false,
          expectedId: serviceId,
        }),
      [
        queryKeys.provider.services(),
        queryKeys.provider.availability(),
        queryKeys.provider.dashboardAll(),
      ],
      options.signal,
    );
  }

  async function deactivateService(
    serviceId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    throwIfCancelled(options.signal);
    if (!validId(serviceId)) {
      throw invalidInputError("deactivate-service");
    }

    await runMutation(
      "deactivate-service",
      `/services/mine/${serviceId}`,
      "DELETE",
      {},
      decodeNoContent,
      [
        queryKeys.provider.services(),
        queryKeys.provider.availability(),
        queryKeys.provider.dashboardAll(),
      ],
      options.signal,
    );
  }

  function listMyAvailabilitySlots(
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderAvailabilitySlot[]> {
    return runQuery(
      "list-availability",
      queryKeys.provider.availability(),
      "/availability/mine",
      decodeProviderAvailabilitySlots,
      options.signal,
    );
  }

  async function getMyAvailabilitySlot(
    slotId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderAvailabilitySlot> {
    throwIfCancelled(options.signal);
    if (!validId(slotId)) {
      throw invalidInputError("get-availability");
    }
    return runQuery(
      "get-availability",
      [...queryKeys.provider.availability(), "detail", slotId],
      `/availability/mine/${slotId}`,
      (raw) =>
        decodeProviderAvailabilitySlot(raw, {
          requireService: true,
          expectedId: slotId,
        }),
      options.signal,
    );
  }

  async function createAvailabilitySlot(
    input: CreateAvailabilitySlotInput,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderAvailabilitySlot> {
    throwIfCancelled(options.signal);
    const startTime = normalizeTimeToHhMm(input.startTime);
    const endTime = normalizeTimeToHhMm(input.endTime);
    if (
      !validId(input.serviceId) ||
      !isValidCalendarDate(input.slotDate) ||
      startTime === null ||
      endTime === null ||
      !isValidPositiveInt32(input.capacity)
    ) {
      throw invalidInputError("create-availability");
    }
    if (endTime <= startTime) {
      throw invalidInputError("create-availability", "INVALID_TIME_RANGE");
    }

    const body: Record<string, unknown> = {
      serviceId: input.serviceId,
      slotDate: input.slotDate,
      startTime,
      endTime,
      capacity: input.capacity,
    };

    return runMutation(
      "create-availability",
      "/availability",
      "POST",
      body,
      (raw) => decodeProviderAvailabilitySlot(raw, { requireService: false }),
      [queryKeys.provider.availability()],
      options.signal,
    );
  }

  async function updateAvailabilitySlot(
    slotId: string,
    input: UpdateAvailabilitySlotInput,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderAvailabilitySlot> {
    throwIfCancelled(options.signal);
    if (!validId(slotId)) {
      throw invalidInputError("update-availability");
    }

    const body: Record<string, unknown> = {};
    if (input.serviceId !== undefined) {
      if (!validId(input.serviceId)) {
        throw invalidInputError("update-availability");
      }
      body.serviceId = input.serviceId;
    }
    if (input.slotDate !== undefined) {
      if (!isValidCalendarDate(input.slotDate)) {
        throw invalidInputError("update-availability");
      }
      body.slotDate = input.slotDate;
    }

    let normalizedStart: string | null = null;
    if (input.startTime !== undefined) {
      normalizedStart = normalizeTimeToHhMm(input.startTime);
      if (normalizedStart === null) {
        throw invalidInputError("update-availability");
      }
      body.startTime = normalizedStart;
    }

    let normalizedEnd: string | null = null;
    if (input.endTime !== undefined) {
      normalizedEnd = normalizeTimeToHhMm(input.endTime);
      if (normalizedEnd === null) {
        throw invalidInputError("update-availability");
      }
      body.endTime = normalizedEnd;
    }

    if (
      normalizedStart !== null &&
      normalizedEnd !== null &&
      normalizedEnd <= normalizedStart
    ) {
      throw invalidInputError("update-availability", "INVALID_TIME_RANGE");
    }

    if (input.capacity !== undefined) {
      if (!isValidPositiveInt32(input.capacity)) {
        throw invalidInputError("update-availability");
      }
      body.capacity = input.capacity;
    }
    if (input.status !== undefined) {
      if (!SLOT_STATUS_SET.has(input.status)) {
        throw invalidInputError("update-availability");
      }
      body.status = input.status;
    }

    return runMutation(
      "update-availability",
      `/availability/mine/${slotId}`,
      "PATCH",
      body,
      (raw) =>
        decodeProviderAvailabilitySlot(raw, {
          requireService: false,
          expectedId: slotId,
        }),
      [queryKeys.provider.availability()],
      options.signal,
    );
  }

  async function deactivateAvailabilitySlot(
    slotId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    throwIfCancelled(options.signal);
    if (!validId(slotId)) {
      throw invalidInputError("deactivate-availability");
    }

    await runMutation(
      "deactivate-availability",
      `/availability/mine/${slotId}`,
      "DELETE",
      {},
      decodeNoContent,
      [queryKeys.provider.availability()],
      options.signal,
    );
  }

  function listProviderBookings(
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderBooking[]> {
    return runQuery(
      "list-bookings",
      queryKeys.provider.bookings(),
      "/bookings/provider",
      decodeProviderBookings,
      options.signal,
    );
  }

  async function getProviderBookingDetail(
    bookingId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderBookingDetail> {
    throwIfCancelled(options.signal);
    if (!validId(bookingId)) {
      throw invalidInputError("get-booking");
    }
    return runQuery(
      "get-booking",
      queryKeys.provider.bookingDetail(bookingId),
      `/bookings/provider/${bookingId}`,
      (raw) => decodeProviderBookingDetail(raw, bookingId),
      options.signal,
    );
  }

  async function confirmProviderBooking(
    bookingId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderBooking> {
    throwIfCancelled(options.signal);
    if (!validId(bookingId)) {
      throw invalidInputError("confirm-booking");
    }
    return runMutation(
      "confirm-booking",
      `/bookings/provider/${bookingId}/confirm`,
      "POST",
      {},
      (raw) => decodeProviderBooking(raw, bookingId),
      [queryKeys.provider.bookings(), queryKeys.provider.dashboardAll()],
      options.signal,
    );
  }

  async function rejectProviderBooking(
    bookingId: string,
    input: ProviderBookingReasonInput = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderBooking> {
    throwIfCancelled(options.signal);
    if (!validId(bookingId) || !isValidNullableStringOptional(input.reason)) {
      throw invalidInputError("reject-booking");
    }
    const body: Record<string, unknown> =
      input.reason !== undefined
        ? { reason: normalizeOptionalText(input.reason) }
        : {};
    return runMutation(
      "reject-booking",
      `/bookings/provider/${bookingId}/reject`,
      "POST",
      body,
      (raw) => decodeProviderBooking(raw, bookingId),
      [
        queryKeys.provider.bookings(),
        queryKeys.provider.availability(),
        queryKeys.provider.dashboardAll(),
      ],
      options.signal,
    );
  }

  async function completeProviderBooking(
    bookingId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderBooking> {
    throwIfCancelled(options.signal);
    if (!validId(bookingId)) {
      throw invalidInputError("complete-booking");
    }
    return runMutation(
      "complete-booking",
      `/bookings/provider/${bookingId}/complete`,
      "POST",
      {},
      (raw) => decodeProviderBooking(raw, bookingId),
      [queryKeys.provider.bookings(), queryKeys.provider.dashboardAll()],
      options.signal,
    );
  }

  async function noShowProviderBooking(
    bookingId: string,
    input: ProviderBookingReasonInput = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderBooking> {
    throwIfCancelled(options.signal);
    if (!validId(bookingId) || !isValidNullableStringOptional(input.reason)) {
      throw invalidInputError("no-show-booking");
    }
    const body: Record<string, unknown> =
      input.reason !== undefined
        ? { reason: normalizeOptionalText(input.reason) }
        : {};
    return runMutation(
      "no-show-booking",
      `/bookings/provider/${bookingId}/no-show`,
      "POST",
      body,
      (raw) => decodeProviderBooking(raw, bookingId),
      [queryKeys.provider.bookings(), queryKeys.provider.dashboardAll()],
      options.signal,
    );
  }

  async function getProviderDashboard(
    query: ProviderDashboardQuery,
    options: { signal?: AbortSignal } = {},
  ): Promise<ProviderDashboard> {
    throwIfCancelled(options.signal);
    if (
      !isValidCalendarDate(query.from) ||
      !isValidCalendarDate(query.to) ||
      query.from > query.to
    ) {
      throw invalidInputError("get-dashboard", "INVALID_DATE_RANGE");
    }
    return runQuery(
      "get-dashboard",
      queryKeys.provider.dashboard(query.from, query.to),
      `/dashboard/provider?from=${query.from}&to=${query.to}`,
      (raw) => decodeProviderDashboard(raw, query),
      options.signal,
    );
  }

  return {
    getProviderProfile,
    updateProviderProfile,
    listWorkingHours,
    createWorkingHour,
    updateWorkingHour,
    deactivateWorkingHour,
    listActiveServiceCategories,
    listMyServices,
    getMyService,
    createService,
    updateService,
    deactivateService,
    listMyAvailabilitySlots,
    getMyAvailabilitySlot,
    createAvailabilitySlot,
    updateAvailabilitySlot,
    deactivateAvailabilitySlot,
    listProviderBookings,
    getProviderBookingDetail,
    confirmProviderBooking,
    rejectProviderBooking,
    completeProviderBooking,
    noShowProviderBooking,
    getProviderDashboard,
  };
}

const defaultApi = createProviderWorkspaceApi();

export const getProviderProfile = defaultApi.getProviderProfile;
export const updateProviderProfile = defaultApi.updateProviderProfile;
export const listWorkingHours = defaultApi.listWorkingHours;
export const createWorkingHour = defaultApi.createWorkingHour;
export const updateWorkingHour = defaultApi.updateWorkingHour;
export const deactivateWorkingHour = defaultApi.deactivateWorkingHour;
export const listActiveServiceCategories =
  defaultApi.listActiveServiceCategories;
export const listMyServices = defaultApi.listMyServices;
export const getMyService = defaultApi.getMyService;
export const createService = defaultApi.createService;
export const updateService = defaultApi.updateService;
export const deactivateService = defaultApi.deactivateService;
export const listMyAvailabilitySlots = defaultApi.listMyAvailabilitySlots;
export const getMyAvailabilitySlot = defaultApi.getMyAvailabilitySlot;
export const createAvailabilitySlot = defaultApi.createAvailabilitySlot;
export const updateAvailabilitySlot = defaultApi.updateAvailabilitySlot;
export const deactivateAvailabilitySlot =
  defaultApi.deactivateAvailabilitySlot;
export const listProviderBookings = defaultApi.listProviderBookings;
export const getProviderBookingDetail = defaultApi.getProviderBookingDetail;
export const confirmProviderBooking = defaultApi.confirmProviderBooking;
export const rejectProviderBooking = defaultApi.rejectProviderBooking;
export const completeProviderBooking = defaultApi.completeProviderBooking;
export const noShowProviderBooking = defaultApi.noShowProviderBooking;
export const getProviderDashboard = defaultApi.getProviderDashboard;
