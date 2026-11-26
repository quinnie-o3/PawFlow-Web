import { test } from "node:test";
import { strict as assert } from "node:assert";
import type {
  ProviderService,
  ServiceCategoryOption,
} from "../provider-workspace/liveApi";
import {
  INITIAL_SERVICE_DIALOG_SESSION,
  SERVICE_DURATION_MAX,
  SERVICE_NAME_MAX,
  applyLocalServiceMutation,
  buildCategoryFilterOptions,
  buildCreateServicePayload,
  buildUpdateServicePatch,
  closeServiceDialogSession,
  enterServiceUncertainSession,
  filterServices,
  formatDuration,
  formatPrice,
  hasServiceDraftChanges,
  isServiceCategoryInactive,
  keepServiceCreateStillUnknown,
  keepServiceUncertainOnLifecycleLock,
  openCreateServiceDialogSession,
  openEditServiceDialogSession,
  parseDurationMinutesInput,
  parsePriceInput,
  reconcileServiceCreate,
  reconcileServiceUpdate,
  recoverAbortedServiceMutation,
  recoverAbortedServiceReconcile,
  reopenPendingServiceUncertainSession,
  serviceToDraft,
  validateServiceDraft,
} from "./serviceLogic";
import type { ServiceDraft } from "./types";

const ACTIVE_CATEGORIES: readonly ServiceCategoryOption[] = [
  { id: "1", name: "Grooming", description: "Cắt tỉa và tạo kiểu" },
  { id: "2", name: "Vệ sinh", description: "Tắm và làm sạch" },
  { id: "3", name: "Trông giữ", description: null },
];

function makeService(
  overrides: Partial<ProviderService> = {},
): ProviderService {
  return {
    id: "101",
    providerId: "10",
    categoryId: "1",
    name: "Tắm & cắt tỉa cơ bản",
    price: "280000.00",
    durationMinutes: 60,
    description: "Tắm sấy, chải lông và cắt móng.",
    status: "ACTIVE",
    createdAt: "2026-11-20T08:00:00.000Z",
    updatedAt: "2026-11-20T08:00:00.000Z",
    category: {
      id: "1",
      name: "Grooming",
      description: "Cắt tỉa và tạo kiểu",
      status: "ACTIVE",
    },
    ...overrides,
  };
}

function makeDraft(overrides: Partial<ServiceDraft> = {}): ServiceDraft {
  return {
    categoryId: "1",
    name: "Chăm sóc móng",
    price: "90000",
    durationMinutes: "30",
    description: "Vệ sinh móng nhẹ nhàng.",
    ...overrides,
  };
}

test("Name validation enforces trimmed 1..200 character bounds", () => {
  for (const empty of ["", "   ", "\n\t"]) {
    const errors = validateServiceDraft(
      makeDraft({ name: empty }),
      ACTIVE_CATEGORIES,
    );
    assert.ok(errors.name, `expected error for ${JSON.stringify(empty)}`);
  }

  assert.equal(
    validateServiceDraft(makeDraft({ name: " A " }), ACTIVE_CATEGORIES).name,
    undefined,
  );
  assert.equal(
    validateServiceDraft(
      makeDraft({ name: `  ${"a".repeat(SERVICE_NAME_MAX)}  ` }),
      ACTIVE_CATEGORIES,
    ).name,
    undefined,
  );
  assert.ok(
    validateServiceDraft(
      makeDraft({ name: "a".repeat(SERVICE_NAME_MAX + 1) }),
      ACTIVE_CATEGORIES,
    ).name,
  );
});

test("Price parsing accepts 0..9999999999.99 with <=2 decimals via string + BigInt without float drift", () => {
  assert.deepEqual(parsePriceInput("0"), {
    canonical: "0.00",
    cents: BigInt(0),
  });
  assert.deepEqual(parsePriceInput("0.00"), {
    canonical: "0.00",
    cents: BigInt(0),
  });
  assert.deepEqual(parsePriceInput(" 150000 "), {
    canonical: "150000.00",
    cents: BigInt(15000000),
  });
  assert.deepEqual(parsePriceInput("0090000.5"), {
    canonical: "90000.50",
    cents: BigInt(9000050),
  });
  assert.deepEqual(parsePriceInput("19.99"), {
    canonical: "19.99",
    cents: BigInt(1999),
  });
  assert.deepEqual(parsePriceInput("9999999999.95"), {
    canonical: "9999999999.95",
    cents: BigInt("999999999995"),
  });
  assert.deepEqual(parsePriceInput("9999999999.99"), {
    canonical: "9999999999.99",
    cents: BigInt("999999999999"),
  });

  // Near-ceiling values previously broken by float64 rounding now pass exact BigInt validation.
  assert.equal(
    validateServiceDraft(
      makeDraft({ price: "9999999999.95" }),
      ACTIVE_CATEGORIES,
    ).price,
    undefined,
  );
  assert.deepEqual(
    buildCreateServicePayload(makeDraft({ price: "9999999999.95" }))?.input.price,
    "9999999999.95",
  );

  for (const invalid of [
    "",
    " ",
    "-1",
    "-0.01",
    "10000000000",
    "10000000000.00",
    "10.123",
    "12.345",
    ".5",
    "90.000 ₫",
    "9,000",
    "1e5",
    "0x10",
    "NaN",
    "Infinity",
    "abc",
  ]) {
    assert.equal(parsePriceInput(invalid), null, `should reject ${invalid}`);
  }
});

test("Duration validation enforces positive int32 minutes without decimal or day unit", () => {
  assert.equal(parseDurationMinutesInput("1"), 1);
  assert.equal(parseDurationMinutesInput(" 045 "), 45);
  assert.equal(
    parseDurationMinutesInput(String(SERVICE_DURATION_MAX)),
    SERVICE_DURATION_MAX,
  );

  for (const invalid of [
    "",
    " \n ",
    "0",
    "-30",
    "30.5",
    "30.0",
    String(SERVICE_DURATION_MAX + 1),
    "99999999999",
    "30 phút",
    "1 ngày",
    "1e2",
    "NaN",
    "Infinity",
  ]) {
    assert.equal(
      parseDurationMinutesInput(invalid),
      null,
      `should reject duration ${invalid}`,
    );
  }
});

test("Price and duration formatters keep exact precision in vi-VN", () => {
  assert.equal(formatPrice("0.00"), "0 ₫");
  assert.equal(formatPrice("280000.00"), "280.000 ₫");
  assert.equal(formatPrice("90000.50"), "90.000,5 ₫");
  assert.equal(formatPrice("90000.25"), "90.000,25 ₫");
  assert.equal(formatPrice("9999999999.99"), "9.999.999.999,99 ₫");
  assert.equal(formatDuration(1), "1 phút");
  assert.equal(formatDuration(90), "90 phút");
});

test("Create requires active category; edit permits keeping unchanged INACTIVE category via sparse PATCH", () => {
  assert.ok(
    validateServiceDraft(makeDraft({ categoryId: "" }), ACTIVE_CATEGORIES)
      .categoryId,
  );
  assert.ok(
    validateServiceDraft(makeDraft({ categoryId: "99" }), ACTIVE_CATEGORIES)
      .categoryId,
  );
  assert.ok(
    validateServiceDraft(makeDraft({ categoryId: "abc" }), ACTIVE_CATEGORIES)
      .categoryId,
  );

  const inactiveCategoryService = makeService({
    categoryId: "99",
    category: {
      id: "99",
      name: "Spa cũ",
      description: null,
      status: "INACTIVE",
    },
  });
  assert.equal(
    isServiceCategoryInactive(inactiveCategoryService, ACTIVE_CATEGORIES, true),
    true,
  );

  // Keeping the existing INACTIVE category while editing price passes validation and omits categoryId in sparse PATCH.
  const draftKeepingCategory: ServiceDraft = {
    ...serviceToDraft(inactiveCategoryService),
    price: "300000",
  };
  assert.deepEqual(
    validateServiceDraft(
      draftKeepingCategory,
      ACTIVE_CATEGORIES,
      inactiveCategoryService,
    ),
    {},
  );
  const patch = buildUpdateServicePatch(
    inactiveCategoryService,
    draftKeepingCategory,
  );
  assert.deepEqual(patch.input, { price: "300000.00" });
  assert.deepEqual(patch.expected, { canonicalPrice: "300000.00" });

  // Switching to another non-active category is rejected; switching to an active category succeeds.
  assert.ok(
    validateServiceDraft(
      { ...draftKeepingCategory, categoryId: "88" },
      ACTIVE_CATEGORIES,
      inactiveCategoryService,
    ).categoryId,
  );
  assert.deepEqual(
    validateServiceDraft(
      { ...draftKeepingCategory, categoryId: "2" },
      ACTIVE_CATEGORIES,
      inactiveCategoryService,
    ),
    {},
  );
});

test("Create payload and sparse update patch handle description trim->null and prevent empty PATCH", () => {
  const created = buildCreateServicePayload(
    makeDraft({
      name: "  Cắt móng  ",
      price: "0",
      durationMinutes: "15",
      description: "   \n ",
    }),
  );
  assert.deepEqual(created, {
    input: {
      categoryId: "1",
      name: "Cắt móng",
      price: "0.00",
      durationMinutes: 15,
      description: null,
    },
    expected: {
      categoryId: "1",
      name: "Cắt móng",
      canonicalPrice: "0.00",
      durationMinutes: 15,
      description: null,
    },
  });

  const existing = makeService({ price: "280000.00", durationMinutes: 60 });
  const unchanged = serviceToDraft(existing);
  assert.equal(unchanged.price, "280000");
  assert.equal(hasServiceDraftChanges(existing, unchanged), false);
  assert.deepEqual(buildUpdateServicePatch(existing, unchanged).input, {});

  // Equivalent numeric representations must not trigger an empty PATCH.
  assert.equal(
    hasServiceDraftChanges(existing, {
      ...unchanged,
      price: "280000.00",
      durationMinutes: "060",
      name: `  ${existing.name}  `,
    }),
    false,
  );

  // Invalid user edits still count as changes so Save exposes field validation errors.
  assert.equal(
    hasServiceDraftChanges(existing, { ...unchanged, price: "" }),
    true,
  );
  // Valid near-ceiling BigInt price change produces exact canonical string patch.
  assert.equal(
    hasServiceDraftChanges(existing, { ...unchanged, price: "9999999999.95" }),
    true,
  );
  assert.deepEqual(
    buildUpdateServicePatch(existing, { ...unchanged, price: "9999999999.95" })
      .input,
    { price: "9999999999.95" },
  );

  // Clearing an existing description sends explicit null.
  const clearDesc = buildUpdateServicePatch(existing, {
    ...unchanged,
    description: "   ",
  });
  assert.deepEqual(clearDesc.input, { description: null });
  assert.deepEqual(clearDesc.expected, { description: null });
});

test("Category filter options and service filtering combine status, categoryId and Vietnamese search", () => {
  const services: ProviderService[] = [
    makeService({
      id: "101",
      name: "Chăm sóc tạo kiểu",
      categoryId: "1",
      status: "ACTIVE",
    }),
    makeService({
      id: "102",
      name: "Vệ sinh tai & móng",
      categoryId: "2",
      description: null,
      status: "INACTIVE",
      category: {
        id: "2",
        name: "Vệ sinh",
        description: null,
        status: "ACTIVE",
      },
    }),
    makeService({
      id: "103",
      name: "Spa thảo mộc",
      categoryId: "99",
      description: "Thư giãn toàn thân",
      status: "ACTIVE",
      category: {
        id: "99",
        name: "Spa cũ",
        description: null,
        status: "INACTIVE",
      },
    }),
  ];

  const options = buildCategoryFilterOptions(services, ACTIVE_CATEGORIES, true);
  assert.equal(options.length, 4);
  assert.equal(options.at(-1)?.id, "99");
  assert.equal(options.at(-1)?.inactive, true);

  assert.deepEqual(
    filterServices(
      services,
      { status: "ACTIVE", categoryId: "", query: "  tao kieu " },
      ACTIVE_CATEGORIES,
    ).map((item) => item.id),
    ["101"],
  );
  assert.deepEqual(
    filterServices(
      services,
      { status: "INACTIVE", categoryId: "2", query: "ve sinh" },
      ACTIVE_CATEGORIES,
    ).map((item) => item.id),
    ["102"],
  );
  assert.deepEqual(
    filterServices(
      services,
      { status: "ALL", categoryId: "99", query: "thu gian" },
      ACTIVE_CATEGORIES,
    ).map((item) => item.id),
    ["103"],
  );
  assert.deepEqual(
    filterServices(
      services,
      { status: "ACTIVE", categoryId: "2", query: "" },
      ACTIVE_CATEGORIES,
    ),
    [],
  );
});

test("reconcileServiceCreate always returns still-unknown until a matching new ID appears regardless of lifecycle status", () => {
  const expected = {
    categoryId: "1",
    name: "Tắm spa",
    canonicalPrice: "180000.00",
    durationMinutes: 45,
    description: null,
  };
  const preExisting = makeService({
    id: "101",
    categoryId: "1",
    name: "Tắm spa",
    price: "180000.00",
    durationMinutes: 45,
    description: null,
    status: "ACTIVE",
  });

  // Same fields already existed before submit -> stays still-unknown (never unlocks blind duplicate POST).
  assert.deepEqual(
    reconcileServiceCreate(expected, ["101"], [preExisting]),
    { outcome: "still-unknown" },
  );

  // New ID not in preSubmitIds with exact normalized fields -> created!
  const newlyCreated = makeService({
    ...preExisting,
    id: "205",
  });
  const created = reconcileServiceCreate(
    expected,
    ["101"],
    [newlyCreated, preExisting],
  );
  assert.equal(created.outcome, "created");
  if (created.outcome === "created") {
    assert.equal(created.service.id, "205");
  }

  // Partial mismatch (different price) -> still-unknown (wait and re-check).
  const mismatch = makeService({
    ...newlyCreated,
    price: "190000.00",
  });
  assert.deepEqual(
    reconcileServiceCreate(expected, ["101"], [mismatch]),
    { outcome: "still-unknown" },
  );
});

test("reconcileServiceUpdate handles field updates, deactivate/reactivate, missing ID and lifecycle lock", () => {
  const updated = makeService({
    id: "101",
    price: "320000.00",
    durationMinutes: 90,
    status: "INACTIVE",
  });

  const savedFields = reconcileServiceUpdate(
    "101",
    { canonicalPrice: "320000.00", durationMinutes: 90 },
    [updated],
    "APPROVED",
  );
  assert.equal(savedFields.outcome, "saved");

  const savedStatus = reconcileServiceUpdate(
    "101",
    { status: "INACTIVE" },
    [updated],
    "PENDING",
  );
  assert.equal(savedStatus.outcome, "saved");

  assert.deepEqual(
    reconcileServiceUpdate("999", { status: "INACTIVE" }, [updated], "APPROVED"),
    { outcome: "not-found" },
  );

  assert.deepEqual(
    reconcileServiceUpdate(
      "101",
      { status: "ACTIVE" },
      [updated],
      "SUSPENDED",
    ),
    { outcome: "forbidden-lifecycle", approvalStatus: "SUSPENDED" },
  );

  const notSaved = reconcileServiceUpdate(
    "101",
    { status: "ACTIVE" },
    [updated],
    "APPROVED",
  );
  assert.equal(notSaved.outcome, "not-saved");
});

test("applyLocalServiceMutation hydrates missing category on POST/PATCH fallback and updates status on DELETE", () => {
  const existing = makeService({ id: "101", categoryId: "1" });
  const createdRaw: ProviderService = {
    ...makeService({ id: "102", categoryId: "2", name: "Tắm nhanh" }),
    category: null,
  };
  const afterCreate = applyLocalServiceMutation(
    [existing],
    { kind: "create", service: createdRaw },
    ACTIVE_CATEGORIES,
  );
  assert.equal(afterCreate[0].id, "102");
  assert.equal(afterCreate[0].category?.name, "Vệ sinh");
  assert.equal(afterCreate[0].category?.status, "ACTIVE");

  const afterDeactivate = applyLocalServiceMutation(
    afterCreate,
    { kind: "deactivate", serviceId: "101" },
    ACTIVE_CATEGORIES,
  );
  assert.equal(
    afterDeactivate.find((item) => item.id === "101")?.status,
    "INACTIVE",
  );
});

const UNKNOWN_SERVICE_ERROR = {
  code: "NETWORK_ERROR",
  category: "uncertain",
  outcome: "unknown",
  status: null,
  retryAfterSeconds: null,
  shouldReconcile: true,
} as const;

test("R1: 503 same-identity abort releases busy flags into uncertain state; 401/logout/identity switch purges 100%", () => {
  const identityA = "gen-1:30:PROVIDER_OWNER";
  const identityB = "gen-2:31:PROVIDER_OWNER";
  const draft = makeDraft({ name: "Spa VIP", price: "9999999999.95" });
  const payload = buildCreateServicePayload(draft)!;

  const opened = openCreateServiceDialogSession(
    INITIAL_SERVICE_DIALOG_SESSION,
    identityA,
  );
  const submitting = {
    ...opened,
    editor: opened.editor
      ? { ...opened.editor, draft, saving: true }
      : null,
  };

  // Same-identity 503 hides <Activity> and aborts fetch -> clears busy & enters uncertain (never unlocks blind POST).
  const recovered = recoverAbortedServiceMutation(submitting, {
    attemptIdentity: identityA,
    liveIdentity: identityA,
    mode: "create",
    serviceId: null,
    draft,
    confirmStatus: null,
    uncertain: {
      kind: "create",
      expected: payload.expected,
      preSubmitIds: ["101"],
    },
    error: UNKNOWN_SERVICE_ERROR,
  });
  assert.equal(recovered.editor?.saving, false);
  assert.equal(recovered.editor?.updatingStatus, false);
  assert.equal(recovered.editor?.reconciling, false);
  assert.deepEqual(recovered.editor?.draft, draft);
  assert.equal(recovered.pendingUncertain?.identity, identityA);
  assert.equal(recovered.editor?.uncertain?.kind, "create");

  // Reconcile GET aborted under same-identity 503 releases reconciling=false without dropping pendingUncertain.
  const reconciling = {
    ...recovered,
    editor: recovered.editor ? { ...recovered.editor, reconciling: true } : null,
  };
  const recoveredReconcile = recoverAbortedServiceReconcile(
    reconciling,
    identityA,
    identityA,
  );
  assert.equal(recoveredReconcile.editor?.reconciling, false);
  assert.notEqual(recoveredReconcile.pendingUncertain, null);

  // 401/logout (liveIdentity=null) or account switch purges 100% of draft/uncertain immediately.
  assert.deepEqual(
    recoverAbortedServiceMutation(submitting, {
      attemptIdentity: identityA,
      liveIdentity: null,
      mode: "create",
      serviceId: null,
      draft,
      confirmStatus: null,
      uncertain: {
        kind: "create",
        expected: payload.expected,
        preSubmitIds: ["101"],
      },
      error: UNKNOWN_SERVICE_ERROR,
    }),
    INITIAL_SERVICE_DIALOG_SESSION,
  );
  assert.deepEqual(
    recoverAbortedServiceReconcile(reconciling, identityA, identityB),
    INITIAL_SERVICE_DIALOG_SESSION,
  );
});

test("R2: closing dialog via X/Esc preserves pendingUncertain and blocks duplicate POST on reopen/add/edit until reconciled or identity switch", () => {
  const identityA = "gen-1:30:PROVIDER_OWNER";
  const identityB = "gen-2:31:PROVIDER_OWNER";
  const draft = makeDraft({ name: "Gói tắm thảo dược", price: "220000" });
  const payload = buildCreateServicePayload(draft)!;

  const opened = openCreateServiceDialogSession(
    INITIAL_SERVICE_DIALOG_SESSION,
    identityA,
  );
  const uncertain = enterServiceUncertainSession(opened, {
    attemptIdentity: identityA,
    mode: "create",
    serviceId: null,
    draft,
    confirmStatus: null,
    uncertain: {
      kind: "create",
      expected: payload.expected,
      preSubmitIds: ["101"],
    },
    error: UNKNOWN_SERVICE_ERROR,
  });

  // Closing while idle+uncertain hides dialog UI ONLY and preserves pendingUncertain.
  const closed = closeServiceDialogSession(uncertain);
  assert.equal(closed.dialogOpen, false);
  assert.notEqual(closed.pendingUncertain, null);
  assert.equal(closed.pendingUncertain?.draft.name, "Gói tắm thảo dược");

  // Clicking "Thêm dịch vụ" restores exact pendingUncertain session instead of blank create form.
  const reopenedViaAdd = openCreateServiceDialogSession(closed, identityA);
  assert.equal(reopenedViaAdd.dialogOpen, true);
  assert.equal(reopenedViaAdd.editor?.uncertain?.kind, "create");
  assert.equal(reopenedViaAdd.editor?.draft.name, "Gói tắm thảo dược");
  assert.notEqual(reopenedViaAdd.pendingUncertain, null);

  // Clicking Edit on another service also restores pendingUncertain until reconciled.
  const reopenedViaEdit = openEditServiceDialogSession(
    closed,
    identityA,
    makeService({ id: "101", name: "Dịch vụ khác" }),
  );
  assert.equal(reopenedViaEdit.dialogOpen, true);
  assert.equal(reopenedViaEdit.editor?.uncertain?.kind, "create");
  assert.equal(reopenedViaEdit.editor?.draft.name, "Gói tắm thảo dược");

  // Banner "Xem lại yêu cầu" restores dialog cleanly.
  const reopenedViaBanner = reopenPendingServiceUncertainSession(
    closed,
    identityA,
  );
  assert.equal(reopenedViaBanner.dialogOpen, true);
  assert.equal(reopenedViaBanner.editor?.uncertain?.kind, "create");

  // Switching identity discards stale pendingUncertain immediately.
  const switched = openCreateServiceDialogSession(closed, identityB);
  assert.equal(switched.dialogOpen, true);
  assert.equal(switched.pendingUncertain, null);
  assert.equal(switched.editor?.uncertain, null);
  assert.equal(switched.editor?.identity, identityB);
});

test("R3: POST /services timeout -> GET #1 still-unknown stays locked -> late backend commit -> GET #2 confirms created with 0 duplicates", () => {
  const identity = "gen-1:30:PROVIDER_OWNER";
  const draft = makeDraft({
    name: "Tắm spa siêu cấp",
    price: "9999999999.95",
    durationMinutes: "60",
    description: null as unknown as string,
  });
  const cleanDraft: ServiceDraft = { ...draft, description: "" };
  const payload = buildCreateServicePayload(cleanDraft)!;
  const preExisting = makeService({ id: "101" });

  // Step 1: POST /services times out at BFF 8s -> enters uncertain with preSubmitIds=["101"].
  const session = enterServiceUncertainSession(
    openCreateServiceDialogSession(INITIAL_SERVICE_DIALOG_SESSION, identity),
    {
      attemptIdentity: identity,
      mode: "create",
      serviceId: null,
      draft: cleanDraft,
      confirmStatus: null,
      uncertain: {
        kind: "create",
        expected: payload.expected,
        preSubmitIds: [preExisting.id],
      },
      error: UNKNOWN_SERVICE_ERROR,
    },
  );

  // Step 2: GET #1 arrives before late backend commit finishes -> MUST return still-unknown & keep locked.
  const firstCheck = reconcileServiceCreate(
    payload.expected,
    [preExisting.id],
    [preExisting],
  );
  assert.deepEqual(firstCheck, { outcome: "still-unknown" });

  const afterFirstCheck = keepServiceCreateStillUnknown(
    session,
    identity,
    "Chưa thấy dịch vụ mới trên máy chủ. Đợi vài giây rồi kiểm tra lại.",
  );
  assert.equal(afterFirstCheck.editor?.reconciling, false);
  assert.notEqual(afterFirstCheck.pendingUncertain, null);
  assert.equal(afterFirstCheck.editor?.uncertain?.kind, "create");
  assert.match(afterFirstCheck.editor?.reconcileNote ?? "", /Chưa thấy dịch vụ mới/);

  // Close & reopen between checks keeps reconcileNote and duplicate-POST lock intact.
  const closedThenReopened = reopenPendingServiceUncertainSession(
    closeServiceDialogSession(afterFirstCheck),
    identity,
  );
  assert.notEqual(closedThenReopened.pendingUncertain, null);
  assert.match(
    closedThenReopened.editor?.reconcileNote ?? "",
    /Chưa thấy dịch vụ mới/,
  );

  // Step 3: Late POST commit lands on backend; GET #2 sees new ID=299 -> resolves cleanly as created (0 duplicates).
  const lateCommitted = makeService({
    id: "299",
    categoryId: payload.expected.categoryId,
    name: payload.expected.name,
    price: payload.expected.canonicalPrice,
    durationMinutes: payload.expected.durationMinutes,
    description: payload.expected.description,
    status: "ACTIVE",
  });
  const secondCheck = reconcileServiceCreate(
    payload.expected,
    [preExisting.id],
    [preExisting, lateCommitted],
  );
  assert.equal(secondCheck.outcome, "created");
  if (secondCheck.outcome === "created") {
    assert.equal(secondCheck.service.id, "299");
    assert.equal(secondCheck.service.price, "9999999999.95");
  }
});

test("R3 lifecycle boundary: APPROVED -> POST timeout -> SUSPENDED/REJECTED -> still-unknown keeps pendingUncertain -> APPROVED reactivation still blocks duplicate POST until late commit confirms created", () => {
  const identity = "gen-1:30:PROVIDER_OWNER";
  const draft = makeDraft({
    name: "Tắm trị liệu đặc biệt",
    price: "320000",
    durationMinutes: "45",
    description: "Dùng dầu gội dịu nhẹ",
  });
  const payload = buildCreateServicePayload(draft)!;
  const preExisting = makeService({ id: "101" });

  // 1. While APPROVED, POST /services times out -> pendingUncertain + editor.uncertain locked.
  const initialUncertain = enterServiceUncertainSession(
    openCreateServiceDialogSession(INITIAL_SERVICE_DIALOG_SESSION, identity),
    {
      attemptIdentity: identity,
      mode: "create",
      serviceId: null,
      draft,
      confirmStatus: null,
      uncertain: {
        kind: "create",
        expected: payload.expected,
        preSubmitIds: [preExisting.id],
      },
      error: UNKNOWN_SERVICE_ERROR,
    },
  );
  assert.notEqual(initialUncertain.pendingUncertain, null);

  // 2. Facility transitions to SUSPENDED (and also verified for REJECTED) while POST is still in-flight.
  // GET /services/mine #1 does not yet contain the new record -> MUST return still-unknown (NEVER forbidden-lifecycle).
  for (const lockedStatus of ["SUSPENDED", "REJECTED"] as const) {
    const checkWhileLocked = reconcileServiceCreate(
      payload.expected,
      [preExisting.id],
      [preExisting],
    );
    assert.deepEqual(
      checkWhileLocked,
      { outcome: "still-unknown" },
      `must remain still-unknown under ${lockedStatus}`,
    );
  }

  // Reconcile state transition preserves pendingUncertain & editor.uncertain with reconciling=false.
  const afterSuspendedCheck = keepServiceCreateStillUnknown(
    closeServiceDialogSession(initialUncertain),
    identity,
    "Chưa thấy dịch vụ mới; trạng thái cơ sở đang khóa nhưng vẫn giữ nguyên khóa gửi lặp.",
  );
  assert.equal(afterSuspendedCheck.dialogOpen, false);
  assert.notEqual(afterSuspendedCheck.pendingUncertain, null);
  assert.equal(afterSuspendedCheck.pendingUncertain?.uncertain.kind, "create");
  assert.equal(afterSuspendedCheck.editor?.uncertain?.kind, "create");
  assert.equal(afterSuspendedCheck.editor?.reconciling, false);

  // 3. Facility is reactivated back to APPROVED.
  // Clicking "Thêm dịch vụ" or opening edit MUST restore the pendingUncertain guard (blocking duplicate POST).
  const reopenedAfterApprove = openCreateServiceDialogSession(
    afterSuspendedCheck,
    identity,
  );
  assert.equal(reopenedAfterApprove.dialogOpen, true);
  assert.notEqual(reopenedAfterApprove.pendingUncertain, null);
  assert.equal(reopenedAfterApprove.editor?.uncertain?.kind, "create");
  assert.equal(reopenedAfterApprove.editor?.draft.name, "Tắm trị liệu đặc biệt");

  const editAttemptAfterApprove = openEditServiceDialogSession(
    afterSuspendedCheck,
    identity,
    preExisting,
  );
  assert.equal(editAttemptAfterApprove.editor?.uncertain?.kind, "create");
  assert.notEqual(editAttemptAfterApprove.pendingUncertain, null);

  // 4. First POST commits late -> GET #2 sees new ID=350 -> confirms "created" and clears pendingUncertain.
  const lateService = makeService({
    id: "350",
    categoryId: payload.expected.categoryId,
    name: payload.expected.name,
    price: payload.expected.canonicalPrice,
    durationMinutes: payload.expected.durationMinutes,
    description: payload.expected.description,
    status: "ACTIVE",
  });
  const confirmedAfterApprove = reconcileServiceCreate(
    payload.expected,
    [preExisting.id],
    [preExisting, lateService],
  );
  assert.equal(confirmedAfterApprove.outcome, "created");
  if (confirmedAfterApprove.outcome === "created") {
    assert.equal(confirmedAfterApprove.service.id, "350");
  }

  // 5. Late commit arriving WHILE STILL SUSPENDED is ALSO detected as "created" immediately via GET /services/mine.
  const confirmedWhileStillSuspended = reconcileServiceCreate(
    payload.expected,
    [preExisting.id],
    [preExisting, lateService],
  );
  assert.equal(confirmedWhileStillSuspended.outcome, "created");

  // 6. Update/status uncertain requests also retain pendingUncertain when reconcile hits forbidden-lifecycle.
  const updateUncertain = enterServiceUncertainSession(
    openEditServiceDialogSession(
      INITIAL_SERVICE_DIALOG_SESSION,
      identity,
      preExisting,
    ),
    {
      attemptIdentity: identity,
      mode: "edit",
      serviceId: preExisting.id,
      draft: serviceToDraft({ ...preExisting, price: "310000.00" }),
      confirmStatus: null,
      uncertain: {
        kind: "update",
        serviceId: preExisting.id,
        expected: { canonicalPrice: "310000.00" },
      },
      error: UNKNOWN_SERVICE_ERROR,
    },
  );
  const suspendedUpdateResult = reconcileServiceUpdate(
    preExisting.id,
    { canonicalPrice: "310000.00" },
    [preExisting],
    "SUSPENDED",
  );
  assert.deepEqual(suspendedUpdateResult, {
    outcome: "forbidden-lifecycle",
    approvalStatus: "SUSPENDED",
  });
  const preservedUpdate = keepServiceUncertainOnLifecycleLock(
    updateUncertain,
    identity,
    {
      code: "PROVIDER_SUSPENDED_FORBIDDEN",
      category: "lifecycle",
      outcome: "definite-failure",
      status: 403,
      retryAfterSeconds: null,
      shouldReconcile: false,
    },
    "Giữ nguyên trạng thái chờ đối soát.",
  );
  assert.notEqual(preservedUpdate.pendingUncertain, null);
  assert.equal(preservedUpdate.editor?.uncertain?.kind, "update");
  assert.equal(preservedUpdate.editor?.reconciling, false);
  assert.equal(
    preservedUpdate.editor?.saveError?.code,
    "PROVIDER_SUSPENDED_FORBIDDEN",
  );
});
