import { test } from "node:test";
import { strict as assert } from "node:assert";
import type {
  ProviderService,
  ServiceCategoryOption,
} from "../provider-workspace/liveApi";
import {
  SERVICE_DURATION_MAX,
  SERVICE_NAME_MAX,
  applyLocalServiceMutation,
  buildCategoryFilterOptions,
  buildCreateServicePayload,
  buildUpdateServicePatch,
  filterServices,
  formatDuration,
  formatPrice,
  hasServiceDraftChanges,
  isServiceCategoryInactive,
  parseDurationMinutesInput,
  parsePriceInput,
  reconcileServiceCreate,
  reconcileServiceUpdate,
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

test("Price parsing accepts 0..9999999999.99 with <=2 decimals and aligns with liveApi float precision", () => {
  assert.deepEqual(parsePriceInput("0"), { numeric: 0, canonical: "0.00" });
  assert.deepEqual(parsePriceInput("0.00"), { numeric: 0, canonical: "0.00" });
  assert.deepEqual(parsePriceInput(" 150000 "), {
    numeric: 150000,
    canonical: "150000.00",
  });
  assert.deepEqual(parsePriceInput("0090000.5"), {
    numeric: 90000.5,
    canonical: "90000.50",
  });
  assert.deepEqual(parsePriceInput("19.99"), {
    numeric: 19.99,
    canonical: "19.99",
  });
  assert.deepEqual(parsePriceInput("9999999999.99"), {
    numeric: 9999999999.99,
    canonical: "9999999999.99",
  });

  // Edge near-ceiling float64 precision drift rejected cleanly before liveApi.ts.
  assert.equal(parsePriceInput("9999999999.95"), null);
  assert.ok(
    validateServiceDraft(
      makeDraft({ price: "9999999999.95" }),
      ACTIVE_CATEGORIES,
    ).price,
  );

  for (const invalid of [
    "",
    " ",
    "-1",
    "-0.01",
    "10000000000",
    "10000000000.00",
    "10.123",
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
  assert.deepEqual(patch.input, { price: 300000 });
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
      price: 0,
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
  assert.equal(
    hasServiceDraftChanges(existing, { ...unchanged, price: "9999999999.95" }),
    true,
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

test("reconcileServiceCreate detects newly created service without duplicating and ignores pre-existing matches", () => {
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

  // Same fields already existed before submit -> NOT a confirmation of the new POST.
  assert.deepEqual(
    reconcileServiceCreate(expected, ["101"], [preExisting], "APPROVED"),
    { outcome: "not-created" },
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
    "APPROVED",
  );
  assert.equal(created.outcome, "created");
  if (created.outcome === "created") {
    assert.equal(created.service.id, "205");
  }

  // Partial mismatch (different price) -> not-created.
  const mismatch = makeService({
    ...newlyCreated,
    price: "190000.00",
  });
  assert.deepEqual(
    reconcileServiceCreate(expected, ["101"], [mismatch], "APPROVED"),
    { outcome: "not-created" },
  );

  // Provider became REJECTED or SUSPENDED while request outcome was unknown.
  assert.deepEqual(
    reconcileServiceCreate(expected, ["101"], [preExisting], "REJECTED"),
    { outcome: "forbidden-lifecycle", approvalStatus: "REJECTED" },
  );
  assert.deepEqual(
    reconcileServiceCreate(expected, ["101"], [preExisting], "SUSPENDED"),
    { outcome: "forbidden-lifecycle", approvalStatus: "SUSPENDED" },
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
