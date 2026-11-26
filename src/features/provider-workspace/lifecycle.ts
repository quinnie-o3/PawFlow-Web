import type { BackendRole } from "../../lib/api/identity";
import { formatMessage, vi } from "../../lib/locale";
import type {
  ProviderApiErrorCode,
  ProviderApiErrorInfo,
  ProviderApprovalStatus,
} from "./liveApi";

/**
 * Mirrors PawFlow-API/src/providers/provider-lifecycle.policy.ts exactly:
 *
 * | Status    | Read own | Update profile | Manage services/slots/hours/staff | Confirm bookings | Respond reviews | Public (BR-01) |
 * |-----------|----------|----------------|-----------------------------------|------------------|-----------------|----------------|
 * | PENDING   | yes      | yes            | yes                               | no               | no              | no             |
 * | APPROVED  | yes      | yes            | yes                               | yes              | yes             | yes            |
 * | REJECTED  | yes      | yes            | no                                | no               | no              | no             |
 * | SUSPENDED | yes      | no (readonly)  | no                                | no               | no              | no             |
 *
 * Winding down existing bookings (reject pending, complete or no-show confirmed)
 * remains permitted in every status. Frontend UI guards never replace backend RBAC.
 */
export type ProviderLifecycleTone = "approved" | "pending" | "rejected" | "suspended";

export type ProviderLifecyclePermissions = Readonly<{
  status: ProviderApprovalStatus;
  canReadOwnData: true;
  canUpdateProfile: boolean;
  canManageResources: boolean;
  canConfirmBookings: boolean;
  canWindDownBookings: true;
  canRespondToReviews: boolean;
  isPubliclyVisible: boolean;
  isReadOnly: boolean;
  tone: ProviderLifecycleTone;
}>;

const LIFECYCLE_MATRIX: Readonly<
  Record<ProviderApprovalStatus, ProviderLifecyclePermissions>
> = {
  APPROVED: {
    status: "APPROVED",
    canReadOwnData: true,
    canUpdateProfile: true,
    canManageResources: true,
    canConfirmBookings: true,
    canWindDownBookings: true,
    canRespondToReviews: true,
    isPubliclyVisible: true,
    isReadOnly: false,
    tone: "approved",
  },
  PENDING: {
    status: "PENDING",
    canReadOwnData: true,
    canUpdateProfile: true,
    canManageResources: true,
    canConfirmBookings: false,
    canWindDownBookings: true,
    canRespondToReviews: false,
    isPubliclyVisible: false,
    isReadOnly: false,
    tone: "pending",
  },
  REJECTED: {
    status: "REJECTED",
    canReadOwnData: true,
    canUpdateProfile: true,
    canManageResources: false,
    canConfirmBookings: false,
    canWindDownBookings: true,
    canRespondToReviews: false,
    isPubliclyVisible: false,
    isReadOnly: false,
    tone: "rejected",
  },
  SUSPENDED: {
    status: "SUSPENDED",
    canReadOwnData: true,
    canUpdateProfile: false,
    canManageResources: false,
    canConfirmBookings: false,
    canWindDownBookings: true,
    canRespondToReviews: false,
    isPubliclyVisible: false,
    isReadOnly: true,
    tone: "suspended",
  },
};

export function getProviderLifecyclePermissions(
  status: ProviderApprovalStatus,
): ProviderLifecyclePermissions {
  return LIFECYCLE_MATRIX[status];
}

export type ProviderLifecycleCopy = Readonly<{
  badge: string;
  title: string;
  description: string;
  tone: ProviderLifecycleTone;
  permissions: ProviderLifecyclePermissions;
}>;

export function getProviderLifecycleCopy(
  status: ProviderApprovalStatus,
  facilityName: string,
): ProviderLifecycleCopy {
  const entry = vi.provider.workspace.lifecycle.statuses[status];
  const permissions = getProviderLifecyclePermissions(status);
  return {
    badge: entry.badge,
    title: formatMessage(entry.title, { facilityName }),
    description: entry.description,
    tone: permissions.tone,
    permissions,
  };
}

export type ProviderSessionStatus =
  | "pending"
  | "anonymous"
  | "authenticated"
  | "error";

export type ProviderSessionUser = Readonly<{
  id: string;
  role: BackendRole;
  fullName: string;
  email: string;
  phone: string | null;
}>;

export type ProviderSessionSnapshot = Readonly<{
  status: ProviderSessionStatus;
  session: Readonly<{
    generation: string;
    user: ProviderSessionUser | null;
  }> | null;
}>;

export type ProviderSessionMode =
  | "owner"
  | "session-pending"
  | "session-error"
  | "unauthenticated"
  | "wrong-role";

export type ProviderSessionBoundaryDecision = Readonly<{
  mode: ProviderSessionMode;
  /** Non-null when an active or revalidating PROVIDER_OWNER identity is known. */
  identity: string | null;
  canFetchPrivate: boolean;
  hidePrivateData: boolean;
  lockActions: boolean;
  /** True on 401/logout, role change, or identity switch; false on same-identity revalidate error. */
  resetPrivateState: boolean;
  /** Always closes open modals whenever private UI is hidden (including revalidate error) to release top-layer backdrop/scroll lock. */
  closeDialog: boolean;
}>;

export function providerSessionIdentityKey(
  snapshot: ProviderSessionSnapshot,
): string | null {
  const user = snapshot.session?.user;
  if (!user || !snapshot.session) return null;
  return `${snapshot.session.generation}:${user.id}:${user.role}`;
}

export function evaluateProviderSessionBoundary(
  previousIdentity: string | null,
  snapshot: ProviderSessionSnapshot,
): ProviderSessionBoundaryDecision {
  const nextIdentity = providerSessionIdentityKey(snapshot);
  const role = snapshot.session?.user?.role ?? null;

  if (snapshot.status === "authenticated") {
    if (role === "PROVIDER_OWNER" && nextIdentity !== null) {
      const switched =
        previousIdentity !== null && previousIdentity !== nextIdentity;
      return {
        mode: "owner",
        identity: nextIdentity,
        canFetchPrivate: true,
        hidePrivateData: false,
        lockActions: false,
        resetPrivateState: switched,
        closeDialog: switched,
      };
    }
    return {
      mode: snapshot.session?.user ? "wrong-role" : "unauthenticated",
      identity: null,
      canFetchPrivate: false,
      hidePrivateData: true,
      lockActions: true,
      resetPrivateState: true,
      closeDialog: true,
    };
  }

  if (snapshot.status === "error") {
    const sameOwnerDuringRevalidate =
      role === "PROVIDER_OWNER" &&
      nextIdentity !== null &&
      (previousIdentity === null || previousIdentity === nextIdentity);

    if (sameOwnerDuringRevalidate) {
      return {
        mode: "session-error",
        identity: nextIdentity,
        canFetchPrivate: false,
        hidePrivateData: true,
        lockActions: true,
        resetPrivateState: false,
        closeDialog: true,
      };
    }

    return {
      mode: "session-error",
      identity: null,
      canFetchPrivate: false,
      hidePrivateData: true,
      lockActions: true,
      resetPrivateState: true,
      closeDialog: true,
    };
  }

  if (snapshot.status === "pending") {
    const hadSession = previousIdentity !== null;
    return {
      mode: "session-pending",
      identity: null,
      canFetchPrivate: false,
      hidePrivateData: true,
      lockActions: true,
      resetPrivateState: hadSession,
      closeDialog: true,
    };
  }

  return {
    mode: "unauthenticated",
    identity: null,
    canFetchPrivate: false,
    hidePrivateData: true,
    lockActions: true,
    resetPrivateState: true,
    closeDialog: true,
  };
}

export const PROVIDER_API_ERROR_CODES: readonly ProviderApiErrorCode[] = [
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
] as const;

const PROVIDER_ERROR_MESSAGES: Readonly<Record<ProviderApiErrorCode, string>> = {
  INVALID_INPUT: vi.provider.workspace.errors.INVALID_INPUT,
  INVALID_REQUEST: vi.provider.workspace.errors.INVALID_REQUEST,
  INVALID_QUERY: vi.provider.workspace.errors.INVALID_QUERY,
  INVALID_DATE_RANGE: vi.provider.workspace.errors.INVALID_DATE_RANGE,
  INVALID_TIME_RANGE: vi.provider.workspace.errors.INVALID_TIME_RANGE,
  SESSION_ENDED: vi.provider.workspace.errors.SESSION_ENDED,
  SESSION_BUSY: vi.provider.workspace.errors.SESSION_BUSY,
  CSRF_REJECTED: vi.provider.workspace.errors.CSRF_REJECTED,
  PROVIDER_PROFILE_NOT_FOUND:
    vi.provider.workspace.errors.PROVIDER_PROFILE_NOT_FOUND,
  PROVIDER_SUSPENDED_READONLY:
    vi.provider.workspace.errors.PROVIDER_SUSPENDED_READONLY,
  PROVIDER_REJECTED_FORBIDDEN:
    vi.provider.workspace.errors.PROVIDER_REJECTED_FORBIDDEN,
  PROVIDER_SUSPENDED_FORBIDDEN:
    vi.provider.workspace.errors.PROVIDER_SUSPENDED_FORBIDDEN,
  PROVIDER_CONFIRM_FORBIDDEN:
    vi.provider.workspace.errors.PROVIDER_CONFIRM_FORBIDDEN,
  STAFF_ASSOCIATION_REQUIRED:
    vi.provider.workspace.errors.STAFF_ASSOCIATION_REQUIRED,
  FORBIDDEN_ROLE: vi.provider.workspace.errors.FORBIDDEN_ROLE,
  WORKING_HOUR_NOT_FOUND: vi.provider.workspace.errors.WORKING_HOUR_NOT_FOUND,
  WORKING_HOUR_DUPLICATE: vi.provider.workspace.errors.WORKING_HOUR_DUPLICATE,
  WORKING_HOUR_OVERLAP: vi.provider.workspace.errors.WORKING_HOUR_OVERLAP,
  WORKING_HOUR_HAS_ACTIVE_BOOKINGS:
    vi.provider.workspace.errors.WORKING_HOUR_HAS_ACTIVE_BOOKINGS,
  SERVICE_NOT_FOUND: vi.provider.workspace.errors.SERVICE_NOT_FOUND,
  CATEGORY_NOT_FOUND: vi.provider.workspace.errors.CATEGORY_NOT_FOUND,
  SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS:
    vi.provider.workspace.errors.SERVICE_DURATION_EXCEEDS_BOOKED_SLOTS,
  SLOT_NOT_FOUND: vi.provider.workspace.errors.SLOT_NOT_FOUND,
  SERVICE_INACTIVE: vi.provider.workspace.errors.SERVICE_INACTIVE,
  SLOT_IN_PAST: vi.provider.workspace.errors.SLOT_IN_PAST,
  SLOT_STARTED: vi.provider.workspace.errors.SLOT_STARTED,
  SLOT_DUPLICATE: vi.provider.workspace.errors.SLOT_DUPLICATE,
  SLOT_TOO_SHORT: vi.provider.workspace.errors.SLOT_TOO_SHORT,
  SLOT_OUTSIDE_WORKING_HOURS:
    vi.provider.workspace.errors.SLOT_OUTSIDE_WORKING_HOURS,
  SLOT_HAS_BOOKINGS_LOCKED_FIELDS:
    vi.provider.workspace.errors.SLOT_HAS_BOOKINGS_LOCKED_FIELDS,
  SLOT_CAPACITY_BELOW_BOOKED:
    vi.provider.workspace.errors.SLOT_CAPACITY_BELOW_BOOKED,
  BOOKING_NOT_FOUND: vi.provider.workspace.errors.BOOKING_NOT_FOUND,
  BOOKING_NOT_PENDING: vi.provider.workspace.errors.BOOKING_NOT_PENDING,
  BOOKING_NOT_CONFIRMED: vi.provider.workspace.errors.BOOKING_NOT_CONFIRMED,
  NO_RESERVED_CAPACITY: vi.provider.workspace.errors.NO_RESERVED_CAPACITY,
  NO_SHOW_TIME: vi.provider.workspace.errors.NO_SHOW_TIME,
  RESOURCE_NOT_FOUND: vi.provider.workspace.errors.RESOURCE_NOT_FOUND,
  CONFLICT: vi.provider.workspace.errors.CONFLICT,
  RATE_LIMITED: vi.provider.workspace.errors.RATE_LIMITED,
  RATE_LIMIT_UNAVAILABLE: vi.provider.workspace.errors.RATE_LIMIT_UNAVAILABLE,
  NETWORK_ERROR: vi.provider.workspace.errors.NETWORK_ERROR,
  SERVER_ERROR: vi.provider.workspace.errors.SERVER_ERROR,
  INVALID_RESPONSE: vi.provider.workspace.errors.INVALID_RESPONSE,
  CONFIG_ERROR: vi.provider.workspace.errors.CONFIG_ERROR,
  UNKNOWN_ERROR: vi.provider.workspace.errors.UNKNOWN_ERROR,
};

export function getProviderErrorMessageByCode(
  code: ProviderApiErrorCode,
): string {
  return PROVIDER_ERROR_MESSAGES[code];
}

export function getProviderErrorMessage(
  error: Pick<ProviderApiErrorInfo, "code" | "retryAfterSeconds">,
  cooldownSeconds?: number,
): string {
  const base = PROVIDER_ERROR_MESSAGES[error.code];
  const wait =
    typeof cooldownSeconds === "number" && cooldownSeconds > 0
      ? cooldownSeconds
      : error.retryAfterSeconds && error.retryAfterSeconds > 0
        ? error.retryAfterSeconds
        : 0;
  if (wait > 0) {
    return `${base} ${formatMessage(vi.provider.workspace.errors.retryAfterWait, { seconds: wait })}`;
  }
  return base;
}

export function isProfileNotFoundError(
  error: Pick<ProviderApiErrorInfo, "code"> | null | undefined,
): boolean {
  return error?.code === "PROVIDER_PROFILE_NOT_FOUND";
}
