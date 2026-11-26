import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  ProviderProfile,
  ProviderService,
  ProviderWorkingHour,
} from "../provider-workspace/liveApi";
import {
  INITIAL_PROFILE_DIALOG_SESSION,
  buildProfileUpdatePatch,
  closeProfileDialogSession,
  enterProfileUncertainSession,
  formatCompactTime,
  formatProfileRating,
  formatProfileTimestamp,
  hasProfileDraftChanges,
  openProfileEditorSession,
  profileToFormValues,
  reconcileProfileUpdate,
  recoverAbortedProfileReconcile,
  recoverAbortedProfileSave,
  reopenPendingProfileUncertainSession,
  summarizeLiveServices,
  summarizeLiveWorkingHours,
} from "./profileLogic";
import {
  normalizeProfileDraft,
  profileFieldLimits,
  validateProfileDraft,
} from "./profileValidation";
import type { ProfileFormValues } from "./types";

const BASE_PROFILE: ProviderProfile = {
  id: "3",
  ownerId: "30",
  businessName: "PawCare Center",
  address: "123 Nguyễn Văn Linh, Quận 7, TP.HCM",
  phone: "0901234567",
  description: "Chăm sóc thú cưng theo lịch hẹn",
  approvalStatus: "APPROVED",
  ratingAvg: "4.85",
  ratingCount: 12,
  createdAt: "2026-10-01T02:00:00.000Z",
  updatedAt: "2026-10-02T03:30:00.000Z",
};

function draft(overrides: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return { ...profileToFormValues(BASE_PROFILE), ...overrides };
}

describe("Provider profile validation (exact UpdateProviderDto parity)", () => {
  it("validates businessName trimmed length 2..200 inclusive", () => {
    assert.equal(profileFieldLimits.businessNameMin, 2);
    assert.equal(profileFieldLimits.businessNameMax, 200);

    for (const length of [2, 200]) {
      const result = validateProfileDraft(
        draft({ businessName: `  ${"đ".repeat(length)}  ` }),
        "all",
      );
      assert.equal(result.businessName, undefined);
    }

    for (const invalid of ["", "   ", "a", "đ".repeat(201)]) {
      const result = validateProfileDraft(
        draft({ businessName: invalid }),
        "all",
      );
      assert.ok(result.businessName, `Expected error for length ${invalid.length}`);
    }
  });

  it("validates address trimmed minLength 5 without artificial maxLength cap", () => {
    assert.equal(
      validateProfileDraft(draft({ address: "  12345  " }), "all").address,
      undefined,
    );
    assert.equal(
      validateProfileDraft(draft({ address: "ô".repeat(500) }), "all").address,
      undefined,
    );

    for (const invalid of ["", "     ", "1234"]) {
      assert.ok(validateProfileDraft(draft({ address: invalid }), "all").address);
    }
  });

  it("treats phone as optional (empty -> null) with max 20 chars and no artificial VN regex", () => {
    for (const valid of [
      "",
      "   ",
      "0901234567",
      "028 3812 3456",
      "+84 901-234-567",
      "1".repeat(20),
    ]) {
      assert.equal(
        validateProfileDraft(draft({ phone: valid }), "all").phone,
        undefined,
        valid,
      );
    }
    assert.ok(
      validateProfileDraft(draft({ phone: "1".repeat(21) }), "all").phone,
    );
  });

  it("treats description as optional (empty -> null) and preserves internal line breaks", () => {
    const normalized = normalizeProfileDraft(
      draft({
        businessName: "  PawCare  ",
        description: "  Dòng 1\n  Dòng 2  ",
        address: "  123 Đường A, Q1  ",
        phone: "   ",
      }),
    );
    assert.deepEqual(normalized, {
      businessName: "PawCare",
      description: "Dòng 1\n  Dòng 2",
      address: "123 Đường A, Q1",
      phone: null,
    });
    assert.equal(
      validateProfileDraft(draft({ description: "   " }), "all").description,
      undefined,
    );
    assert.equal(
      validateProfileDraft(draft({ description: "ả".repeat(3000) }), "all")
        .description,
      undefined,
    );
  });

  it("validates only fields belonging to the active edit section", () => {
    const invalidAll: ProfileFormValues = {
      businessName: " ",
      description: "",
      address: "123",
      phone: "1".repeat(25),
    };
    assert.deepEqual(
      Object.keys(validateProfileDraft(invalidAll, "facility")),
      ["businessName"],
    );
    assert.deepEqual(
      Object.keys(validateProfileDraft(invalidAll, "contact")).sort(),
      ["address", "phone"],
    );
  });
});

describe("PATCH /providers/me allowlist builder & unknown-outcome reconciliation", () => {
  it("builds minimal partial patches strictly inside active section and ignores protected fields", () => {
    const hostileDraft = {
      ...draft({
        businessName: "  PawCare Mới  ",
        phone: "   ",
        address: "456 Lê Lợi, Quận 1, TP.HCM",
      }),
      id: "999",
      ownerId: "999",
      approvalStatus: "APPROVED",
      email: "attacker@example.com",
    } as ProfileFormValues;

    const facilityPatch = buildProfileUpdatePatch(
      BASE_PROFILE,
      hostileDraft,
      "facility",
    );
    assert.deepEqual(facilityPatch, { businessName: "PawCare Mới" });

    const contactPatch = buildProfileUpdatePatch(
      BASE_PROFILE,
      hostileDraft,
      "contact",
    );
    assert.deepEqual(contactPatch, {
      address: "456 Lê Lợi, Quận 1, TP.HCM",
      phone: null,
    });

    assert.equal(
      hasProfileDraftChanges(
        BASE_PROFILE,
        draft({ businessName: `  ${BASE_PROFILE.businessName}  ` }),
        "all",
      ),
      false,
    );
  });

  it("reconciles uncertain PATCH outcomes accurately with identical normalization on both sides", () => {
    assert.equal(
      reconcileProfileUpdate(
        { businessName: "  PawCare Mới ", phone: "   " },
        { ...BASE_PROFILE, businessName: "PawCare Mới", phone: null },
      ),
      "saved",
    );

    assert.equal(
      reconcileProfileUpdate(
        { description: null },
        { ...BASE_PROFILE, description: "" },
      ),
      "saved",
    );

    assert.equal(
      reconcileProfileUpdate(
        { businessName: "PawCare Mới" },
        BASE_PROFILE,
      ),
      "not-saved",
    );

    assert.equal(
      reconcileProfileUpdate(
        { businessName: "PawCare Mới" },
        { ...BASE_PROFILE, approvalStatus: "SUSPENDED" },
      ),
      "suspended",
    );
  });
});

describe("Live services & working hours summary helpers and formatting", () => {
  it("summarizes live services by status and unique categories", () => {
    const services: ProviderService[] = [
      {
        id: "1",
        providerId: "3",
        categoryId: "10",
        name: "Tắm cơ bản",
        price: "150000.00",
        durationMinutes: 45,
        description: null,
        status: "ACTIVE",
        createdAt: "2026-10-01T02:00:00.000Z",
        updatedAt: "2026-10-01T02:00:00.000Z",
        category: { id: "10", name: "Tắm & Vệ sinh", description: null, status: "ACTIVE" },
      },
      {
        id: "2",
        providerId: "3",
        categoryId: "10",
        name: "Tắm thuốc",
        price: "220000.00",
        durationMinutes: 60,
        description: null,
        status: "INACTIVE",
        createdAt: "2026-10-01T02:00:00.000Z",
        updatedAt: "2026-10-01T02:00:00.000Z",
        category: { id: "10", name: "Tắm & Vệ sinh", description: null, status: "ACTIVE" },
      },
      {
        id: "3",
        providerId: "3",
        categoryId: "11",
        name: "Cắt tỉa tạo kiểu",
        price: "300000.00",
        durationMinutes: 90,
        description: null,
        status: "ACTIVE",
        createdAt: "2026-10-01T02:00:00.000Z",
        updatedAt: "2026-10-01T02:00:00.000Z",
        category: { id: "11", name: "Grooming", description: null, status: "ACTIVE" },
      },
    ];

    const summary = summarizeLiveServices(services);
    assert.equal(summary.totalCount, 3);
    assert.equal(summary.activeCount, 2);
    assert.equal(summary.inactiveCount, 1);
    assert.deepEqual(summary.categoryNames, ["Tắm & Vệ sinh", "Grooming"]);
    assert.deepEqual(
      summary.activeServices.map((s) => s.id),
      ["1", "3"],
    );
  });

  it("maps dayOfWeek 0=Chủ Nhật..6=Thứ Bảy, ignores isActive=false, strips :00 and groups consecutive days", () => {
    const makeHour = (
      id: string,
      dayOfWeek: ProviderWorkingHour["dayOfWeek"],
      startTime: string,
      endTime: string,
      isActive = true,
    ): ProviderWorkingHour => ({
      id,
      providerId: "3",
      dayOfWeek,
      startTime,
      endTime,
      isActive,
      createdAt: "2026-10-01T02:00:00.000Z",
      updatedAt: "2026-10-01T02:00:00.000Z",
    });

    const summary = summarizeLiveWorkingHours([
      makeHour("1", 1, "13:30:00", "17:30:00", true),
      makeHour("2", 1, "08:00:00", "12:00:00", true),
      makeHour("3", 2, "08:00:00", "12:00:00", true),
      makeHour("4", 2, "13:30:00", "17:30:00", true),
      makeHour("5", 6, "09:00:00", "15:00:00", true),
      makeHour("6", 0, "09:00:00", "12:00:00", false), // inactive Sunday must be ignored
    ]);

    assert.equal(summary.openDaysCount, 3);
    assert.equal(summary.activeIntervalCount, 5);
    assert.equal(summary.groups[0].label, "Thứ Hai – Thứ Ba");
    assert.equal(summary.groups[0].hours, "08:00–12:00 · 13:30–17:30");
    assert.equal(summary.groups[1].label, "Thứ Tư – Thứ Sáu");
    assert.equal(summary.groups[1].isOpen, false);
    assert.equal(summary.groups[2].label, "Thứ Bảy");
    assert.equal(summary.groups[2].hours, "09:00–15:00");
    assert.equal(summary.groups[3].label, "Chủ Nhật");
    assert.equal(summary.groups[3].isOpen, false);

    assert.equal(formatCompactTime("08:00:00"), "08:00");
    assert.equal(formatCompactTime("08:00"), "08:00");
  });

  it("formats rating and Asia/Ho_Chi_Minh timestamps accurately", () => {
    assert.equal(formatProfileRating("0.00", 0), "Chưa có đánh giá");
    assert.equal(formatProfileRating("4.85", 12), "4.85 / 5 (12 đánh giá)");
    assert.equal(formatProfileRating("4.50", 2), "4.5 / 5 (2 đánh giá)");
    assert.equal(formatProfileRating("5.00", 1), "5.0 / 5 (1 đánh giá)");
    // 2026-10-01T02:00:00.000Z -> 01/10/2026 09:00 in Asia/Ho_Chi_Minh (UTC+7)
    assert.equal(
      formatProfileTimestamp("2026-10-01T02:00:00.000Z"),
      "01/10/2026 09:00",
    );
  });
});

describe("R1 & R2: 503 same-identity abort recovery and persistent uncertain guard across dialog close/reopen", () => {
  const UNKNOWN_ERROR = {
    code: "NETWORK_ERROR",
    category: "uncertain",
    outcome: "unknown",
    status: null,
    retryAfterSeconds: null,
    shouldReconcile: true,
  } as const;

  it("releases saving/reconciling into uncertain on same-identity 503 abort and purges on 401/logout/switch", () => {
    const identityA = "gen-1:30:PROVIDER_OWNER";
    const identityB = "gen-2:31:PROVIDER_OWNER";
    const editedDraft = draft({ businessName: "PawCare Đổi Tên" });
    const payload = { businessName: "PawCare Đổi Tên" };

    const opened = openProfileEditorSession(
      INITIAL_PROFILE_DIALOG_SESSION,
      identityA,
      "facility",
      BASE_PROFILE,
    );
    const saving = {
      ...opened,
      editor: opened.editor
        ? { ...opened.editor, draft: editedDraft, saving: true }
        : null,
    };

    const recovered = recoverAbortedProfileSave(saving, {
      attemptIdentity: identityA,
      liveIdentity: identityA,
      section: "facility",
      draft: editedDraft,
      payload,
      error: UNKNOWN_ERROR,
    });
    assert.equal(recovered.editor?.saving, false);
    assert.equal(recovered.editor?.reconciling, false);
    assert.deepEqual(recovered.editor?.draft, editedDraft);
    assert.deepEqual(recovered.pendingUncertain?.uncertain.payload, payload);

    const reconciling = {
      ...recovered,
      editor: recovered.editor
        ? { ...recovered.editor, reconciling: true }
        : null,
    };
    const recoveredReconcile = recoverAbortedProfileReconcile(
      reconciling,
      identityA,
      identityA,
    );
    assert.equal(recoveredReconcile.editor?.reconciling, false);
    assert.notEqual(recoveredReconcile.pendingUncertain, null);

    // 401/logout or identity switch purges 100%.
    assert.deepEqual(
      recoverAbortedProfileSave(saving, {
        attemptIdentity: identityA,
        liveIdentity: null,
        section: "facility",
        draft: editedDraft,
        payload,
        error: UNKNOWN_ERROR,
      }),
      INITIAL_PROFILE_DIALOG_SESSION,
    );
    assert.deepEqual(
      recoverAbortedProfileReconcile(reconciling, identityA, identityB),
      INITIAL_PROFILE_DIALOG_SESSION,
    );
  });

  it("preserves pendingUncertain across close/reopen and blocks opening a fresh edit form until reconciled", () => {
    const identityA = "gen-1:30:PROVIDER_OWNER";
    const identityB = "gen-2:31:PROVIDER_OWNER";
    const editedDraft = draft({ businessName: "PawCare Đổi Tên" });
    const payload = { businessName: "PawCare Đổi Tên" };

    const uncertain = enterProfileUncertainSession(
      openProfileEditorSession(
        INITIAL_PROFILE_DIALOG_SESSION,
        identityA,
        "facility",
        BASE_PROFILE,
      ),
      {
        attemptIdentity: identityA,
        section: "facility",
        draft: editedDraft,
        payload,
        error: UNKNOWN_ERROR,
      },
    );

    const closed = closeProfileDialogSession(uncertain);
    assert.equal(closed.dialogOpen, false);
    assert.notEqual(closed.pendingUncertain, null);

    // Clicking Edit on another section restores the pending uncertain request instead of discarding it.
    const reopenedViaOtherSection = openProfileEditorSession(
      closed,
      identityA,
      "contact",
      BASE_PROFILE,
    );
    assert.equal(reopenedViaOtherSection.dialogOpen, true);
    assert.equal(reopenedViaOtherSection.editor?.section, "facility");
    assert.deepEqual(reopenedViaOtherSection.editor?.draft, editedDraft);
    assert.notEqual(reopenedViaOtherSection.editor?.uncertain, null);

    // Banner reopen button restores the exact pending uncertain session.
    const reopenedBanner = reopenPendingProfileUncertainSession(
      closed,
      identityA,
    );
    assert.equal(reopenedBanner.dialogOpen, true);
    assert.notEqual(reopenedBanner.editor?.uncertain, null);

    // Identity switch clears stale pendingUncertain.
    const switched = openProfileEditorSession(
      closed,
      identityB,
      "contact",
      BASE_PROFILE,
    );
    assert.equal(switched.pendingUncertain, null);
    assert.equal(switched.editor?.section, "contact");
    assert.equal(switched.editor?.uncertain, null);
  });
});
