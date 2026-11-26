import { test } from "node:test";
import { strict as assert } from "node:assert";
import type {
  ProviderAvailabilitySlot,
  ProviderService,
  ProviderWorkingHour,
} from "../provider-workspace/liveApi";
import {
  applyLocalSlotMutation,
  applyLocalWorkingHourMutation,
  buildCreateSlotPayload,
  buildUpdateSlotPatch,
  buildWorkingHourMutationPlan,
  canReopenSlot,
  captureVietnamClock,
  closeSlotDialogSession,
  closeWorkingHoursDialogSession,
  DISPLAY_WEEKDAYS,
  enterSlotUncertainSession,
  findAffectedBookedSlotsForWorkingHourChange,
  findExactInactiveWorkingHour,
  findOverlappingWorkingHour,
  formatAvailabilityDate,
  formatTimeHhMm,
  getDayOfWeek,
  getDayOfWeekLabel,
  groupWorkingHoursByDay,
  hasSlotDraftChanges,
  hasSlotStarted,
  hasWorkingHourDraftChanges,
  INITIAL_SLOT_DIALOG_SESSION,
  INITIAL_WORKING_HOURS_SESSION,
  isSlotBookableUnderSchedule,
  localDate,
  openCreateSlotDialogSession,
  openEditSlotDialogSession,
  openWorkingHoursDialogSession,
  reconcileSlotCancel,
  reconcileSlotCreate,
  reconcileSlotUpdate,
  reconcileWorkingHourCreate,
  reconcileWorkingHourDeactivate,
  reconcileWorkingHourUpdate,
  recoverAbortedSlotMutation,
  recoverAbortedSlotReconcile,
  recoverAbortedWorkingHoursMutation,
  recoverAbortedWorkingHoursReconcile,
  reopenPendingSlotSession,
  reopenPendingWorkingHoursSession,
  resolveSlotService,
  slotCoversServiceDuration,
  slotFitsWorkingHours,
  slotToDraft,
  suggestSlotEndTime,
  summarizeAvailability,
  validateSlotDraft,
  validateWorkingHourDraft,
  workingHourToDraft,
} from "./availabilityLogic";

const NOW = "2026-10-15T10:00:00+07:00"; // Thursday (dayOfWeek = 4)

const SERVICES: readonly ProviderService[] = [
  {
    id: "101",
    providerId: "10",
    categoryId: "1",
    name: "Tắm & cắt tỉa",
    price: "250000.00",
    durationMinutes: 90,
    description: null,
    status: "ACTIVE",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    category: { id: "1", name: "Grooming", description: null, status: "ACTIVE" },
  },
  {
    id: "102",
    providerId: "10",
    categoryId: "1",
    name: "Spa thư giãn",
    price: "180000.00",
    durationMinutes: 60,
    description: null,
    status: "ACTIVE",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    category: { id: "1", name: "Grooming", description: null, status: "ACTIVE" },
  },
  {
    id: "103",
    providerId: "10",
    categoryId: "1",
    name: "Khám cũ tạm ẩn",
    price: "150000.00",
    durationMinutes: 45,
    description: null,
    status: "INACTIVE",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    category: { id: "1", name: "Grooming", description: null, status: "ACTIVE" },
  },
];

const WORKING_HOURS: readonly ProviderWorkingHour[] = [
  {
    id: "201",
    providerId: "10",
    dayOfWeek: 4, // Thursday
    startTime: "08:00:00",
    endTime: "12:00:00",
    isActive: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "202",
    providerId: "10",
    dayOfWeek: 4, // Thursday adjacent afternoon
    startTime: "12:00:00",
    endTime: "18:00:00",
    isActive: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "203",
    providerId: "10",
    dayOfWeek: 5, // Friday
    startTime: "09:00:00",
    endTime: "17:00:00",
    isActive: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "204",
    providerId: "10",
    dayOfWeek: 4, // Thursday inactive historical shift
    startTime: "18:00:00",
    endTime: "20:00:00",
    isActive: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "205",
    providerId: "10",
    dayOfWeek: 0, // Sunday inactive
    startTime: "09:00:00",
    endTime: "12:00:00",
    isActive: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
];

function makeSlot(
  overrides: Partial<ProviderAvailabilitySlot> = {},
): ProviderAvailabilitySlot {
  const serviceId = overrides.serviceId ?? "102";
  const matchedService = SERVICES.find((item) => item.id === serviceId);
  return {
    id: "301",
    providerId: "10",
    serviceId,
    slotDate: "2026-10-15",
    startTime: "14:00:00",
    endTime: "15:00:00",
    capacity: 3,
    bookedCount: 0,
    status: "OPEN",
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    service: matchedService
      ? {
          id: matchedService.id,
          categoryId: matchedService.categoryId,
          name: matchedService.name,
          price: matchedService.price,
          durationMinutes: matchedService.durationMinutes,
          description: matchedService.description,
          status: matchedService.status,
        }
      : null,
    ...overrides,
  };
}

const SLOTS: readonly ProviderAvailabilitySlot[] = [
  makeSlot({
    id: "301",
    serviceId: "102",
    slotDate: "2026-10-15",
    startTime: "14:00:00",
    endTime: "15:00:00",
    capacity: 3,
    bookedCount: 2,
    status: "OPEN",
  }),
  makeSlot({
    id: "302",
    serviceId: "101",
    slotDate: "2026-10-16",
    startTime: "09:00:00",
    endTime: "11:00:00",
    capacity: 2,
    bookedCount: 0,
    status: "OPEN",
  }),
  makeSlot({
    id: "303",
    serviceId: "103",
    slotDate: "2026-10-16",
    startTime: "13:00:00",
    endTime: "14:00:00",
    capacity: 2,
    bookedCount: 1,
    status: "CLOSED",
  }),
  makeSlot({
    id: "304",
    serviceId: "102",
    slotDate: "2026-10-15",
    startTime: "09:00:00",
    endTime: "10:00:00",
    capacity: 2,
    bookedCount: 1,
    status: "OPEN",
  }),
];

test("Asia/Ho_Chi_Minh clock handles UTC midnight boundary, day-of-week 0..6, and time formatting", () => {
  const utcMidnightBoundary = "2026-10-14T17:00:00.250Z"; // 00:00:00.250 +07:00 on 2026-10-15
  const clock = captureVietnamClock(utcMidnightBoundary);
  assert.equal(clock.today, "2026-10-15");
  assert.equal(clock.hhMm, "00:00");
  assert.equal(clock.secondsOfDay, 0.25);
  assert.equal(localDate(utcMidnightBoundary), "2026-10-15");

  assert.equal(getDayOfWeek("2026-10-18"), 0); // Sunday
  assert.equal(getDayOfWeek("2026-10-19"), 1); // Monday
  assert.equal(getDayOfWeek("2026-10-15"), 4); // Thursday
  assert.equal(getDayOfWeek("2026-02-30"), null);

  assert.equal(formatAvailabilityDate("2026-10-15"), "15/10/2026");
  assert.equal(formatAvailabilityDate("2026-10-15", false), "15/10");
  assert.equal(formatTimeHhMm("08:30:00"), "08:30");
  assert.equal(formatTimeHhMm("08:30:15"), "08:30:15");
});

test("groupWorkingHoursByDay orders Monday..Sunday and separates active vs inactive shifts", () => {
  const grouped = groupWorkingHoursByDay(WORKING_HOURS);
  assert.deepEqual(
    grouped.map((day) => day.dayOfWeek),
    [...DISPLAY_WEEKDAYS],
  );
  assert.equal(grouped[0].label, getDayOfWeekLabel(1));
  assert.equal(grouped[6].dayOfWeek, 0);
  const thursday = grouped.find((day) => day.dayOfWeek === 4)!;
  assert.deepEqual(
    thursday.active.map((item) => item.id),
    ["201", "202"],
  );
  assert.deepEqual(
    thursday.inactive.map((item) => item.id),
    ["204"],
  );
});

test("Working hours allow adjacent intervals and reject active overlap or overnight ranges", () => {
  // Adjacent 18:00-20:00 touches active 12:00-18:00 without overlapping.
  assert.equal(
    findOverlappingWorkingHour(
      { dayOfWeek: 4, startTime: "18:00", endTime: "20:00" },
      WORKING_HOURS,
    ),
    null,
  );
  // Overlapping 11:30-13:00 conflicts with 08:00-12:00.
  const overlap = findOverlappingWorkingHour(
    { dayOfWeek: 4, startTime: "11:30", endTime: "13:00" },
    WORKING_HOURS,
  );
  assert.equal(overlap?.id, "201");

  const overlapErrors = validateWorkingHourDraft(
    { dayOfWeek: 4, startTime: "11:30", endTime: "13:00" },
    WORKING_HOURS,
  );
  assert.ok(overlapErrors.form);
  assert.match(overlapErrors.form!, /08:00–12:00/);

  const overnightErrors = validateWorkingHourDraft(
    { dayOfWeek: 1, startTime: "22:00", endTime: "02:00" },
    WORKING_HOURS,
  );
  assert.ok(overnightErrors.endTime);
});

test("Working-hour mutation plan reactivates matching inactive rows, blocks empty PATCH, and prevents edit collision with inactive rows", () => {
  // Adding Thursday 18:00-20:00 matches inactive id=204 -> reactivate via PATCH { isActive: true }.
  assert.equal(
    findExactInactiveWorkingHour(
      { dayOfWeek: 4, startTime: "18:00", endTime: "20:00" },
      WORKING_HOURS,
    )?.id,
    "204",
  );
  const reactivatePlan = buildWorkingHourMutationPlan(
    { dayOfWeek: 4, startTime: "18:00", endTime: "20:00" },
    WORKING_HOURS,
  );
  assert.equal(reactivatePlan?.kind, "reactivate");
  if (reactivatePlan?.kind === "reactivate") {
    assert.equal(reactivatePlan.workingHourId, "204");
    assert.deepEqual(reactivatePlan.input, { isActive: true });
  }

  // Creating brand new Monday shift -> POST.
  const createPlan = buildWorkingHourMutationPlan(
    { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
    WORKING_HOURS,
  );
  assert.equal(createPlan?.kind, "create");

  // Editing row 201 with identical values -> no-op null (never sends PATCH {}).
  const unchangedDraft = workingHourToDraft(WORKING_HOURS[0]);
  assert.equal(hasWorkingHourDraftChanges(WORKING_HOURS[0], unchangedDraft), false);
  assert.equal(
    buildWorkingHourMutationPlan(unchangedDraft, WORKING_HOURS, WORKING_HOURS[0]),
    null,
  );

  // Editing row 201 to match existing inactive row 204 (Thursday 18:00-20:00) -> blocked with guidance!
  const collideInactiveErrors = validateWorkingHourDraft(
    { dayOfWeek: 4, startTime: "18:00", endTime: "20:00" },
    WORKING_HOURS,
    WORKING_HOURS[0],
  );
  assert.ok(collideInactiveErrors.form);
  assert.equal(
    buildWorkingHourMutationPlan(
      { dayOfWeek: 4, startTime: "18:00", endTime: "20:00" },
      WORKING_HOURS,
      WORKING_HOURS[0],
    ),
    null,
  );

  // Sparse PATCH when editing only endTime of row 201 (08:00-11:30).
  const sparseUpdate = buildWorkingHourMutationPlan(
    { dayOfWeek: 4, startTime: "08:00", endTime: "11:30" },
    WORKING_HOURS,
    WORKING_HOURS[0],
  );
  assert.equal(sparseUpdate?.kind, "update");
  if (sparseUpdate?.kind === "update") {
    assert.deepEqual(sparseUpdate.input, { endTime: "11:30" });
  }

  // Detect future booked slots affected when deactivating Thursday afternoon (202).
  const affected = findAffectedBookedSlotsForWorkingHourChange(
    WORKING_HOURS[1],
    { ...WORKING_HOURS[1], isActive: false },
    WORKING_HOURS,
    SLOTS,
    NOW,
  );
  assert.deepEqual(
    affected.map((item) => item.id),
    ["301"],
  );
});

test("Working-hour unknown reconciliation handles create, update, deactivate, not-found, and lifecycle lock", () => {
  const createdHour: ProviderWorkingHour = {
    id: "299",
    providerId: "10",
    dayOfWeek: 1,
    startTime: "09:00:00",
    endTime: "12:00:00",
    isActive: true,
    createdAt: "2026-10-15T03:00:00.000Z",
    updatedAt: "2026-10-15T03:00:00.000Z",
  };
  const preIds = WORKING_HOURS.map((item) => item.id);

  assert.equal(
    reconcileWorkingHourCreate(
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00", isActive: true },
      preIds,
      [...WORKING_HOURS, createdHour],
      "APPROVED",
    ).outcome,
    "created",
  );
  assert.equal(
    reconcileWorkingHourCreate(
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00", isActive: true },
      preIds,
      WORKING_HOURS,
      "SUSPENDED",
    ).outcome,
    "forbidden-lifecycle",
  );
  assert.equal(
    reconcileWorkingHourCreate(
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00", isActive: true },
      preIds,
      WORKING_HOURS,
      "APPROVED",
    ).outcome,
    "not-created",
  );

  const deactivatedList = applyLocalWorkingHourMutation(WORKING_HOURS, {
    kind: "deactivate",
    workingHourId: "201",
  });
  assert.equal(
    reconcileWorkingHourDeactivate("201", deactivatedList, "APPROVED").outcome,
    "saved",
  );
  assert.equal(
    reconcileWorkingHourUpdate("999", { isActive: true }, WORKING_HOURS).outcome,
    "not-found",
  );
  assert.equal(
    reconcileWorkingHourUpdate(
      "204",
      { isActive: true },
      WORKING_HOURS,
      "REJECTED",
    ).outcome,
    "forbidden-lifecycle",
  );
});

test("Slot creation validates Vietnam clock, >= durationMinutes, single active interval fit, duplicate check, and midnight-safe suggestion", () => {
  // suggestSlotEndTime handles valid times and refuses midnight overflow (> 23:59).
  assert.equal(suggestSlotEndTime("09:00", 90), "10:30");
  assert.equal(suggestSlotEndTime("23:00", 59), "23:59");
  assert.equal(suggestSlotEndTime("23:00", 60), null);
  assert.equal(suggestSlotEndTime("23:30", 90), null);

  // Duration >= service.durationMinutes is ALLOWED (not forced ===), < is REJECTED.
  assert.equal(slotCoversServiceDuration("09:00", "11:00", 90), true);
  assert.equal(slotCoversServiceDuration("09:00", "10:30", 90), true);
  assert.equal(slotCoversServiceDuration("09:00", "10:29", 90), false);

  // Adjacent working intervals (08:00-12:00 and 12:00-18:00) are NOT merged.
  assert.equal(
    slotFitsWorkingHours(
      { slotDate: "2026-10-15", startTime: "11:30", endTime: "12:30" },
      WORKING_HOURS,
    ),
    false,
  );
  assert.equal(
    slotFitsWorkingHours(
      { slotDate: "2026-10-15", startTime: "12:00", endTime: "13:30" },
      WORKING_HOURS,
    ),
    true,
  );

  // Exact start instant (and equivalent UTC instant 03:00Z = 10:00+07:00) has started.
  assert.equal(
    hasSlotStarted({ slotDate: "2026-10-15", startTime: "10:00" }, "2026-10-15T03:00:00Z"),
    true,
  );
  assert.equal(
    hasSlotStarted({ slotDate: "2026-10-15", startTime: "10:01" }, "2026-10-15T03:00:00Z"),
    false,
  );

  const ctx = {
    services: SERVICES,
    workingHours: WORKING_HOURS,
    slots: SLOTS,
    now: NOW,
  };

  // Valid slot longer than service duration (120m > 60m) and partially overlapping another slot of same service (BE only forbids exact duplicate).
  const validLongSlot = {
    serviceId: "102",
    slotDate: "2026-10-15",
    startTime: "14:30",
    endTime: "16:30",
    capacity: "2",
  };
  assert.deepEqual(validateSlotDraft(validLongSlot, ctx), {});
  assert.deepEqual(buildCreateSlotPayload(validLongSlot)?.input, {
    serviceId: "102",
    slotDate: "2026-10-15",
    startTime: "14:30",
    endTime: "16:30",
    capacity: 2,
  });

  // Exact duplicate (serviceId=102, 2026-10-15 14:00-15:00) is rejected.
  assert.ok(
    validateSlotDraft(
      {
        serviceId: "102",
        slotDate: "2026-10-15",
        startTime: "14:00",
        endTime: "15:00",
        capacity: "2",
      },
      ctx,
    ).form,
  );

  // Inactive service rejected on create.
  assert.ok(
    validateSlotDraft(
      {
        serviceId: "103",
        slotDate: "2026-10-16",
        startTime: "10:00",
        endTime: "11:00",
        capacity: "2",
      },
      ctx,
    ).serviceId,
  );

  // Past date and started slot rejected.
  assert.ok(
    validateSlotDraft(
      {
        serviceId: "102",
        slotDate: "2026-10-14",
        startTime: "14:00",
        endTime: "15:00",
        capacity: "2",
      },
      ctx,
    ).slotDate,
  );
  assert.ok(
    validateSlotDraft(
      {
        serviceId: "102",
        slotDate: "2026-10-15",
        startTime: "10:00",
        endTime: "11:00",
        capacity: "2",
      },
      ctx,
    ).startTime,
  );
});

test("Booked slots lock 4 schedule fields, reject capacity < bookedCount, and emit strictly sparse PATCH (never PATCH {})", () => {
  const bookedSlot = SLOTS[0]; // bookedCount=2, capacity=3, future
  const inactiveServiceSlot = SLOTS[2]; // serviceId=103 (INACTIVE), bookedCount=1

  const unchanged = slotToDraft(bookedSlot);
  assert.equal(hasSlotDraftChanges(bookedSlot, unchanged, NOW), false);
  assert.deepEqual(buildUpdateSlotPatch(bookedSlot, unchanged, NOW).input, {});

  // Capacity below bookedCount rejected.
  assert.ok(
    validateSlotDraft(
      { ...unchanged, capacity: "1" },
      {
        services: SERVICES,
        workingHours: WORKING_HOURS,
        slots: SLOTS,
        editingSlot: bookedSlot,
        now: NOW,
      },
    ).capacity,
  );

  // Even if caller tampers with draft schedule fields on a booked slot, sparse PATCH sends ONLY capacity!
  const tamperedDraft = {
    serviceId: "101",
    slotDate: "2026-10-16",
    startTime: "09:00",
    endTime: "11:00",
    capacity: "5",
  };
  assert.deepEqual(
    buildUpdateSlotPatch(bookedSlot, tamperedDraft, NOW).input,
    { capacity: 5 },
  );

  // Editing capacity on a slot whose service is now INACTIVE omits serviceId and passes validation!
  const inactiveDraft = { ...slotToDraft(inactiveServiceSlot), capacity: "4" };
  assert.deepEqual(
    validateSlotDraft(inactiveDraft, {
      services: SERVICES,
      workingHours: WORKING_HOURS,
      slots: SLOTS,
      editingSlot: inactiveServiceSlot,
      now: NOW,
    }),
    {},
  );
  assert.deepEqual(
    buildUpdateSlotPatch(inactiveServiceSlot, inactiveDraft, NOW).input,
    { capacity: 4 },
  );
});

test("Reopen rules enforce not-started, duration, and active working hours while flagging inactive service", () => {
  // Past/started slot cannot reopen.
  const startedClosed = makeSlot({
    id: "310",
    slotDate: "2026-10-15",
    startTime: "09:00:00",
    endTime: "10:00:00",
    status: "CLOSED",
  });
  assert.equal(
    canReopenSlot(startedClosed, SERVICES, WORKING_HOURS, NOW).allowed,
    false,
  );

  // Future slot outside active working hours (Sunday) cannot reopen.
  const sundayClosed = makeSlot({
    id: "311",
    slotDate: "2026-10-18",
    startTime: "09:00:00",
    endTime: "10:00:00",
    status: "CLOSED",
  });
  assert.equal(
    canReopenSlot(sundayClosed, SERVICES, WORKING_HOURS, NOW).allowed,
    false,
  );

  // Future slot shorter than service duration (45m < 90m for service 101) cannot reopen.
  const tooShortCancelled = makeSlot({
    id: "312",
    serviceId: "101",
    slotDate: "2026-10-16",
    startTime: "09:00:00",
    endTime: "09:45:00",
    status: "CANCELLED",
  });
  assert.equal(
    canReopenSlot(tooShortCancelled, SERVICES, WORKING_HOURS, NOW).allowed,
    false,
  );

  // Valid future CLOSED slot with INACTIVE service is allowed by BE (sparse PATCH) with warning flag.
  const inactiveFutureDecision = canReopenSlot(
    SLOTS[2],
    SERVICES,
    WORKING_HOURS,
    NOW,
  );
  assert.equal(inactiveFutureDecision.allowed, true);
  if (inactiveFutureDecision.allowed) {
    assert.equal(inactiveFutureDecision.serviceInactiveWarning, true);
  }
});

test("Slot unknown reconciliation and local fallback merge preserve service metadata cleanly", () => {
  const preIds = SLOTS.map((item) => item.id);
  const createdWithoutRelation = makeSlot({
    id: "399",
    serviceId: "101",
    slotDate: "2026-10-16",
    startTime: "14:00:00",
    endTime: "16:00:00",
    capacity: 2,
    bookedCount: 0,
    status: "OPEN",
    service: null,
  });

  const merged = applyLocalSlotMutation(
    SLOTS,
    { kind: "create", slot: createdWithoutRelation },
    SERVICES,
  );
  const hydrated = merged.find((item) => item.id === "399")!;
  assert.equal(hydrated.service?.name, "Tắm & cắt tỉa");
  assert.equal(resolveSlotService(hydrated, [])?.name, "Tắm & cắt tỉa");

  assert.equal(
    reconcileSlotCreate(
      {
        serviceId: "101",
        slotDate: "2026-10-16",
        startTime: "14:00",
        endTime: "16:00",
        capacity: 2,
      },
      preIds,
      merged,
      "APPROVED",
    ).outcome,
    "created",
  );
  assert.equal(
    reconcileSlotCreate(
      {
        serviceId: "101",
        slotDate: "2026-10-16",
        startTime: "14:00",
        endTime: "16:00",
        capacity: 2,
      },
      preIds,
      SLOTS,
      "REJECTED",
    ).outcome,
    "forbidden-lifecycle",
  );

  const cancelledList = applyLocalSlotMutation(
    SLOTS,
    { kind: "cancel", slotId: "301" },
    SERVICES,
  );
  assert.equal(
    reconcileSlotCancel("301", cancelledList, "APPROVED").outcome,
    "saved",
  );
  assert.equal(
    reconcileSlotUpdate("999", { capacity: 5 }, SLOTS, "APPROVED").outcome,
    "not-found",
  );
});

test("summarizeAvailability computes bookable next-7-days slots, held bookings, and active operating days", () => {
  // Within 7 days of 2026-10-15T10:00+07:00:
  // - 301: OPEN, future (14:00), booked=2/3, service 102 ACTIVE, fits Thursday 12-18 -> bookable! (+2 held)
  // - 302: OPEN, future (16th 09-11), booked=0/2, service 101 ACTIVE, fits Friday 09-17 -> bookable! (+0 held)
  // - 303: CLOSED, future (16th 13-14), booked=1/2 -> not open, (+1 held)
  // - 304: OPEN, already started (15th 09:00 <= 10:00) -> excluded from upcoming 7 days!
  assert.equal(isSlotBookableUnderSchedule(SLOTS[0], WORKING_HOURS, SERVICES, NOW), true);
  assert.equal(isSlotBookableUnderSchedule(SLOTS[1], WORKING_HOURS, SERVICES, NOW), true);
  assert.equal(isSlotBookableUnderSchedule(SLOTS[2], WORKING_HOURS, SERVICES, NOW), false);
  assert.equal(isSlotBookableUnderSchedule(SLOTS[3], WORKING_HOURS, SERVICES, NOW), false);

  const summary = summarizeAvailability(WORKING_HOURS, SLOTS, SERVICES, NOW);
  assert.deepEqual(summary, {
    openSlotsNext7Days: 2,
    heldBookingsNext7Days: 3,
    activeDaysCount: 2,
    activeShiftsCount: 3,
  });
});

const UNKNOWN_AVAILABILITY_ERROR = {
  code: "NETWORK_ERROR",
  category: "uncertain",
  outcome: "unknown",
  status: null,
  retryAfterSeconds: null,
  shouldReconcile: true,
} as const;

test("R1 & R2 working hours: 503 same-identity abort recovers into uncertain, close/reopen preserves guard, 401/switch purges", () => {
  const identityA = "gen-1:30:PROVIDER_OWNER";
  const identityB = "gen-2:31:PROVIDER_OWNER";
  const draft = { dayOfWeek: 1 as const, startTime: "08:30", endTime: "12:00" };
  const uncertainAction = {
    kind: "create" as const,
    expected: {
      dayOfWeek: 1 as const,
      startTime: "08:30",
      endTime: "12:00",
      isActive: true as const,
    },
    preSubmitIds: WORKING_HOURS.map((h) => h.id),
  };

  const opened = openWorkingHoursDialogSession(
    INITIAL_WORKING_HOURS_SESSION,
    identityA,
  );
  const saving = {
    ...opened,
    dialog: opened.dialog ? { ...opened.dialog, draft, saving: true } : null,
  };

  // Same-identity 503 abort releases busy and preserves draft/preSubmitIds in pendingUncertain.
  const recovered = recoverAbortedWorkingHoursMutation(saving, {
    attemptIdentity: identityA,
    liveIdentity: identityA,
    mode: "create",
    editingId: null,
    draft,
    uncertain: uncertainAction,
    error: UNKNOWN_AVAILABILITY_ERROR,
  });
  assert.equal(recovered.dialog?.saving, false);
  assert.equal(recovered.dialog?.mutatingRowId, null);
  assert.equal(recovered.dialog?.reconciling, false);
  assert.notEqual(recovered.pendingUncertain, null);

  // Close hides dialog only; reopen via button or banner restores pendingUncertain.
  const closed = closeWorkingHoursDialogSession(recovered);
  assert.equal(closed.dialogOpen, false);
  assert.notEqual(closed.pendingUncertain, null);

  const reopened = openWorkingHoursDialogSession(closed, identityA);
  assert.equal(reopened.dialogOpen, true);
  assert.equal(reopened.dialog?.uncertain?.kind, "create");
  assert.deepEqual(reopened.dialog?.draft, draft);

  const reopenedBanner = reopenPendingWorkingHoursSession(closed, identityA);
  assert.equal(reopenedBanner.dialogOpen, true);
  assert.equal(reopenedBanner.dialog?.uncertain?.kind, "create");

  // Reconcile abort releases reconciling=false without dropping pendingUncertain.
  const reconciling = {
    ...reopened,
    dialog: reopened.dialog ? { ...reopened.dialog, reconciling: true } : null,
  };
  const afterReconcileAbort = recoverAbortedWorkingHoursReconcile(
    reconciling,
    identityA,
    identityA,
  );
  assert.equal(afterReconcileAbort.dialog?.reconciling, false);
  assert.notEqual(afterReconcileAbort.pendingUncertain, null);

  // 401/logout or identity switch purges 100%.
  assert.deepEqual(
    recoverAbortedWorkingHoursMutation(saving, {
      attemptIdentity: identityA,
      liveIdentity: null,
      mode: "create",
      editingId: null,
      draft,
      uncertain: uncertainAction,
      error: UNKNOWN_AVAILABILITY_ERROR,
    }),
    INITIAL_WORKING_HOURS_SESSION,
  );
  assert.deepEqual(
    recoverAbortedWorkingHoursReconcile(reconciling, identityA, identityB),
    INITIAL_WORKING_HOURS_SESSION,
  );
});

test("R1 & R2 availability slots: 503 same-identity abort recovers into uncertain, close/reopen preserves guard, 401/switch purges", () => {
  const identityA = "gen-1:30:PROVIDER_OWNER";
  const identityB = "gen-2:31:PROVIDER_OWNER";
  const draft = {
    serviceId: "102",
    slotDate: "2026-10-16",
    startTime: "10:00",
    endTime: "11:00",
    capacity: "3",
  };
  const uncertainAction = {
    kind: "create" as const,
    expected: {
      serviceId: "102",
      slotDate: "2026-10-16",
      startTime: "10:00",
      endTime: "11:00",
      capacity: 3,
    },
    preSubmitIds: SLOTS.map((s) => s.id),
  };

  const opened = openCreateSlotDialogSession(
    INITIAL_SLOT_DIALOG_SESSION,
    identityA,
    "2026-10-16",
    "102",
  );
  const saving = {
    ...opened,
    editor: opened.editor ? { ...opened.editor, draft, saving: true } : null,
  };

  const recovered = recoverAbortedSlotMutation(saving, {
    attemptIdentity: identityA,
    liveIdentity: identityA,
    mode: "create",
    slotId: null,
    draft,
    autoEndTime: false,
    confirmAction: null,
    uncertain: uncertainAction,
    error: UNKNOWN_AVAILABILITY_ERROR,
  });
  assert.equal(recovered.editor?.saving, false);
  assert.equal(recovered.editor?.updatingStatus, false);
  assert.equal(recovered.editor?.reconciling, false);
  assert.notEqual(recovered.pendingUncertain, null);

  // Close preserves pendingUncertain; create/edit/banner reopen all restore it.
  const closed = closeSlotDialogSession(recovered);
  assert.equal(closed.dialogOpen, false);
  assert.notEqual(closed.pendingUncertain, null);

  const viaCreate = openCreateSlotDialogSession(
    closed,
    identityA,
    "2026-10-17",
    "101",
  );
  assert.equal(viaCreate.dialogOpen, true);
  assert.equal(viaCreate.editor?.uncertain?.kind, "create");
  assert.deepEqual(viaCreate.editor?.draft, draft);

  const viaEdit = openEditSlotDialogSession(closed, identityA, SLOTS[0]);
  assert.equal(viaEdit.dialogOpen, true);
  assert.equal(viaEdit.editor?.uncertain?.kind, "create");

  const viaBanner = reopenPendingSlotSession(closed, identityA);
  assert.equal(viaBanner.dialogOpen, true);
  assert.equal(viaBanner.editor?.uncertain?.kind, "create");

  // Reconcile abort on same identity keeps pendingUncertain & clears reconciling.
  const reconciling = {
    ...enterSlotUncertainSession(opened, {
      attemptIdentity: identityA,
      mode: "create",
      slotId: null,
      draft,
      autoEndTime: false,
      confirmAction: null,
      uncertain: uncertainAction,
      error: UNKNOWN_AVAILABILITY_ERROR,
    }),
    editor: viaCreate.editor ? { ...viaCreate.editor, reconciling: true } : null,
  };
  const afterReconcileAbort = recoverAbortedSlotReconcile(
    reconciling,
    identityA,
    identityA,
  );
  assert.equal(afterReconcileAbort.editor?.reconciling, false);
  assert.notEqual(afterReconcileAbort.pendingUncertain, null);

  // 401/logout or identity switch purges 100%.
  assert.deepEqual(
    recoverAbortedSlotMutation(saving, {
      attemptIdentity: identityA,
      liveIdentity: null,
      mode: "create",
      slotId: null,
      draft,
      autoEndTime: false,
      confirmAction: null,
      uncertain: uncertainAction,
      error: UNKNOWN_AVAILABILITY_ERROR,
    }),
    INITIAL_SLOT_DIALOG_SESSION,
  );
  assert.deepEqual(
    recoverAbortedSlotReconcile(reconciling, identityA, identityB),
    INITIAL_SLOT_DIALOG_SESSION,
  );
});
