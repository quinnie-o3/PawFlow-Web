import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROVIDER_APPROVAL_STATUSES } from "./liveApi";
import {
  evaluateProviderSessionBoundary,
  getProviderErrorMessage,
  getProviderErrorMessageByCode,
  getProviderLifecycleCopy,
  getProviderLifecyclePermissions,
  isProfileNotFoundError,
  PROVIDER_API_ERROR_CODES,
  type ProviderSessionSnapshot,
} from "./lifecycle";

const OWNER_USER = {
  id: "30",
  role: "PROVIDER_OWNER" as const,
  fullName: "Nguyễn Minh Anh",
  email: "owner@pawcare.example",
  phone: "0901234567",
};

const OWNER_GEN_1: ProviderSessionSnapshot = {
  status: "authenticated",
  session: { generation: "gen-1", user: OWNER_USER },
};

const OWNER_GEN_2: ProviderSessionSnapshot = {
  status: "authenticated",
  session: { generation: "gen-2", user: OWNER_USER },
};

describe("Provider lifecycle permission matrix (provider-lifecycle.policy.ts)", () => {
  it("matches backend authorization rules for APPROVED, PENDING, REJECTED and SUSPENDED", () => {
    const approved = getProviderLifecyclePermissions("APPROVED");
    assert.equal(approved.canReadOwnData, true);
    assert.equal(approved.canUpdateProfile, true);
    assert.equal(approved.canManageResources, true);
    assert.equal(approved.canConfirmBookings, true);
    assert.equal(approved.canWindDownBookings, true);
    assert.equal(approved.canRespondToReviews, true);
    assert.equal(approved.isPubliclyVisible, true);
    assert.equal(approved.isReadOnly, false);

    const pending = getProviderLifecyclePermissions("PENDING");
    assert.equal(pending.canReadOwnData, true);
    assert.equal(pending.canUpdateProfile, true);
    assert.equal(pending.canManageResources, true);
    assert.equal(pending.canConfirmBookings, false);
    assert.equal(pending.canWindDownBookings, true);
    assert.equal(pending.canRespondToReviews, false);
    assert.equal(pending.isPubliclyVisible, false);
    assert.equal(pending.isReadOnly, false);

    const rejected = getProviderLifecyclePermissions("REJECTED");
    assert.equal(rejected.canReadOwnData, true);
    assert.equal(rejected.canUpdateProfile, true);
    assert.equal(rejected.canManageResources, false);
    assert.equal(rejected.canConfirmBookings, false);
    assert.equal(rejected.canWindDownBookings, true);
    assert.equal(rejected.canRespondToReviews, false);
    assert.equal(rejected.isPubliclyVisible, false);
    assert.equal(rejected.isReadOnly, false);

    const suspended = getProviderLifecyclePermissions("SUSPENDED");
    assert.equal(suspended.canReadOwnData, true);
    assert.equal(suspended.canUpdateProfile, false);
    assert.equal(suspended.canManageResources, false);
    assert.equal(suspended.canConfirmBookings, false);
    assert.equal(suspended.canWindDownBookings, true);
    assert.equal(suspended.canRespondToReviews, false);
    assert.equal(suspended.isPubliclyVisible, false);
    assert.equal(suspended.isReadOnly, true);
  });

  it("provides localized banner copy interpolating facility name for every approval status", () => {
    for (const status of PROVIDER_APPROVAL_STATUSES) {
      const copy = getProviderLifecycleCopy(status, "PawCare Center");
      assert.ok(copy.badge.length > 0, `${status} badge missing`);
      assert.ok(
        copy.title.includes("PawCare Center"),
        `${status} title must interpolate facilityName`,
      );
      assert.ok(copy.description.length > 0, `${status} description missing`);
      assert.equal(copy.permissions.status, status);
    }
  });
});

describe("Provider session boundary", () => {
  it("shows initial pending loading without triggering private reset or error flash", () => {
    const decision = evaluateProviderSessionBoundary(null, {
      status: "pending",
      session: null,
    });
    assert.deepEqual(decision, {
      mode: "session-pending",
      identity: null,
      canFetchPrivate: false,
      hidePrivateData: true,
      lockActions: true,
      resetPrivateState: false,
      closeDialog: true,
    });
  });

  it("allows owner access and flags reset+close when generation or account switches", () => {
    const first = evaluateProviderSessionBoundary(null, OWNER_GEN_1);
    assert.deepEqual(first, {
      mode: "owner",
      identity: "gen-1:30:PROVIDER_OWNER",
      canFetchPrivate: true,
      hidePrivateData: false,
      lockActions: false,
      resetPrivateState: false,
      closeDialog: false,
    });

    const same = evaluateProviderSessionBoundary(first.identity, OWNER_GEN_1);
    assert.equal(same.resetPrivateState, false);
    assert.equal(same.closeDialog, false);

    const switchedGen = evaluateProviderSessionBoundary(
      first.identity,
      OWNER_GEN_2,
    );
    assert.equal(switchedGen.mode, "owner");
    assert.equal(switchedGen.identity, "gen-2:30:PROVIDER_OWNER");
    assert.equal(switchedGen.resetPrivateState, true);
    assert.equal(switchedGen.closeDialog, true);

    const switchedUser = evaluateProviderSessionBoundary(first.identity, {
      status: "authenticated",
      session: {
        generation: "gen-1",
        user: { ...OWNER_USER, id: "31" },
      },
    });
    assert.equal(switchedUser.resetPrivateState, true);
    assert.equal(switchedUser.closeDialog, true);
  });

  it("closes dialog and hides private data while preserving draft on same-identity revalidate error", () => {
    const revalidateError = evaluateProviderSessionBoundary(
      "gen-1:30:PROVIDER_OWNER",
      {
        status: "error",
        session: { generation: "gen-1", user: OWNER_USER },
      },
    );
    assert.deepEqual(revalidateError, {
      mode: "session-error",
      identity: "gen-1:30:PROVIDER_OWNER",
      canFetchPrivate: false,
      hidePrivateData: true,
      lockActions: true,
      resetPrivateState: false,
      closeDialog: true,
    });

    // Recovering with the exact same identity restores access without resetting draft.
    const recovered = evaluateProviderSessionBoundary(
      revalidateError.identity,
      OWNER_GEN_1,
    );
    assert.equal(recovered.mode, "owner");
    assert.equal(recovered.resetPrivateState, false);
    assert.equal(recovered.closeDialog, false);
  });

  it("resets private state immediately on 401/logout, wrong role, cross-tab pending, or error without matching identity", () => {
    const anonymous = evaluateProviderSessionBoundary(
      "gen-1:30:PROVIDER_OWNER",
      { status: "anonymous", session: null },
    );
    assert.equal(anonymous.resetPrivateState, true);
    assert.equal(anonymous.closeDialog, true);
    assert.equal(anonymous.identity, null);

    const crossTabPending = evaluateProviderSessionBoundary(
      "gen-1:30:PROVIDER_OWNER",
      { status: "pending", session: null },
    );
    assert.equal(crossTabPending.resetPrivateState, true);
    assert.equal(crossTabPending.closeDialog, true);

    const wrongRole = evaluateProviderSessionBoundary(
      "gen-1:30:PROVIDER_OWNER",
      {
        status: "authenticated",
        session: {
          generation: "gen-3",
          user: { ...OWNER_USER, role: "CUSTOMER" },
        },
      },
    );
    assert.equal(wrongRole.mode, "wrong-role");
    assert.equal(wrongRole.resetPrivateState, true);
    assert.equal(wrongRole.closeDialog, true);

    const errorWithoutUser = evaluateProviderSessionBoundary(
      "gen-1:30:PROVIDER_OWNER",
      { status: "error", session: null },
    );
    assert.equal(errorWithoutUser.resetPrivateState, true);
    assert.equal(errorWithoutUser.closeDialog, true);

    const errorDifferentGen = evaluateProviderSessionBoundary(
      "gen-1:30:PROVIDER_OWNER",
      {
        status: "error",
        session: { generation: "gen-2", user: OWNER_USER },
      },
    );
    assert.equal(errorDifferentGen.resetPrivateState, true);
    assert.equal(errorDifferentGen.closeDialog, true);
  });
});

describe("Provider error localization and 404 detection", () => {
  it("maps every single ProviderApiErrorCode to a non-empty Vietnamese message", () => {
    assert.equal(PROVIDER_API_ERROR_CODES.length, 45);
    for (const code of PROVIDER_API_ERROR_CODES) {
      const message = getProviderErrorMessageByCode(code);
      assert.equal(typeof message, "string");
      assert.ok(message.trim().length > 0, `${code} must not be empty`);
      assert.notEqual(message, code, `${code} must be localized, not raw code`);
    }
  });

  it("appends cooldown guidance when retryAfterSeconds or live countdown is positive", () => {
    const fromError = getProviderErrorMessage({
      code: "RATE_LIMITED",
      retryAfterSeconds: 12,
    });
    assert.ok(fromError.includes("12"));

    const fromCountdown = getProviderErrorMessage(
      { code: "RATE_LIMITED", retryAfterSeconds: 12 },
      7,
    );
    assert.ok(fromCountdown.includes("7"));
    assert.equal(fromCountdown.includes("12"), false);

    const noWait = getProviderErrorMessage({
      code: "PROVIDER_SUSPENDED_READONLY",
      retryAfterSeconds: null,
    });
    assert.equal(noWait.includes("giây"), false);
  });

  it("identifies 404 PROVIDER_PROFILE_NOT_FOUND explicitly", () => {
    assert.equal(
      isProfileNotFoundError({ code: "PROVIDER_PROFILE_NOT_FOUND" }),
      true,
    );
    assert.equal(
      isProfileNotFoundError({ code: "RESOURCE_NOT_FOUND" }),
      false,
    );
    assert.equal(isProfileNotFoundError(null), false);
  });
});
