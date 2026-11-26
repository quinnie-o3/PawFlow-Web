import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderBooking } from "../provider-workspace/liveApi";
import {
  buildLiveCustomerRecords,
  classifyCustomerGroup,
  filterLiveCustomers,
  getPresetCustomerRange,
  getVietnamCalendarDate,
  getVietnamCurrentMonthRange,
  summarizeLiveCustomers,
  validateReportingRange,
} from "./customerLogic";
import type { ReportingRange } from "./types";

const octRange: ReportingRange = { start: "2026-10-01", end: "2026-10-31" };
const nowMs = Date.parse("2026-10-15T10:00:00+07:00");

function makeBooking(overrides: Partial<ProviderBooking> = {}): ProviderBooking {
  return {
    id: "1001",
    status: "COMPLETED",
    bookedPrice: "250000.00",
    customerNote: null,
    createdAt: "2026-10-01T02:00:00.000Z",
    updatedAt: "2026-10-01T02:00:00.000Z",
    service: { id: "10", name: "Tắm & vệ sinh", durationMinutes: 60 },
    slot: {
      id: "50",
      slotDate: "2026-10-10",
      startTime: "09:00:00",
      endTime: "10:00:00",
    },
    customer: { id: "90071992547409921", fullName: "Hà Linh" },
    pet: {
      id: "7001",
      name: "Miu",
      breed: "Anh lông ngắn",
      birthDate: "2024-02-10",
      weight: "4.10",
      healthNote: "Nhạy cảm tiếng ồn",
      petType: { id: "2", name: "Mèo" },
    },
    ...overrides,
  };
}

test("Matching customer names with distinct BIGINT string IDs are never merged", () => {
  const bookings: ProviderBooking[] = [
    makeBooking({
      id: "1001",
      customer: { id: "90071992547409921", fullName: "Hà Linh" },
      pet: {
        id: "7001",
        name: "Miu",
        breed: "Anh lông ngắn",
        birthDate: null,
        weight: null,
        healthNote: null,
        petType: { id: "2", name: "Mèo" },
      },
    }),
    makeBooking({
      id: "1002",
      customer: { id: "90071992547409922", fullName: "Hà Linh" },
      pet: {
        id: "7002",
        name: "Miu",
        breed: "Anh lông dài",
        birthDate: null,
        weight: null,
        healthNote: null,
        petType: { id: "2", name: "Mèo" },
      },
    }),
  ];

  const records = buildLiveCustomerRecords(bookings, octRange, nowMs);
  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((r) => r.customer.id).sort(),
    ["90071992547409921", "90071992547409922"],
  );
  assert.deepEqual(summarizeLiveCustomers(records, octRange), {
    servedCustomers: 2,
    returningCustomers: 0,
    servedPets: 2,
  });
});

test("Returning formula matches Backend SQL DashboardService.getReturningCustomers exactly", () => {
  // 1) Completed before period + completed in period => returning
  const priorAndInPeriod: ProviderBooking[] = [
    makeBooking({
      id: "1",
      slot: { id: "s1", slotDate: "2026-09-20", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "2",
      slot: { id: "s2", slotDate: "2026-10-05", startTime: "09:00:00", endTime: "10:00:00" },
    }),
  ];
  assert.equal(classifyCustomerGroup(priorAndInPeriod, octRange), "returning");

  // 2) Two COMPLETED bookings at different times WITHIN the same period => returning (matches SQL!)
  const twoWithinSamePeriodDifferentDay: ProviderBooking[] = [
    makeBooking({
      id: "3",
      slot: { id: "s3", slotDate: "2026-10-02", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "4",
      slot: { id: "s4", slotDate: "2026-10-08", startTime: "09:00:00", endTime: "10:00:00" },
    }),
  ];
  assert.equal(classifyCustomerGroup(twoWithinSamePeriodDifferentDay, octRange), "returning");

  // 3) Same slotDate, strictly earlier startTime within the same day => returning (matches SQL!)
  const sameDayEarlierStart: ProviderBooking[] = [
    makeBooking({
      id: "5",
      slot: { id: "s5", slotDate: "2026-10-05", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "6",
      slot: { id: "s6", slotDate: "2026-10-05", startTime: "14:00:00", endTime: "15:00:00" },
    }),
  ];
  assert.equal(classifyCustomerGroup(sameDayEarlierStart, octRange), "returning");

  // 4) Two COMPLETED bookings with identical (slotDate, startTime) and no earlier booking => NOT returning (new)
  const simultaneousOnly: ProviderBooking[] = [
    makeBooking({
      id: "7",
      slot: { id: "s7", slotDate: "2026-10-05", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "8",
      slot: { id: "s8", slotDate: "2026-10-05", startTime: "09:00:00", endTime: "10:00:00" },
    }),
  ];
  assert.equal(classifyCustomerGroup(simultaneousOnly, octRange), "new");

  // 5) Earlier non-COMPLETED booking does NOT qualify as returning
  const earlierCancelled: ProviderBooking[] = [
    makeBooking({
      id: "9",
      status: "CANCELLED",
      slot: { id: "s9", slotDate: "2026-09-01", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "10",
      status: "COMPLETED",
      slot: { id: "s10", slotDate: "2026-10-05", startTime: "09:00:00", endTime: "10:00:00" },
    }),
  ];
  assert.equal(classifyCustomerGroup(earlierCancelled, octRange), "new");

  // 6) All-time mode (range === null) applies the exact same chronological rule
  assert.equal(classifyCustomerGroup(priorAndInPeriod, null), "returning");
  assert.equal(classifyCustomerGroup(simultaneousOnly, null), "new");
  assert.equal(
    classifyCustomerGroup([makeBooking({ id: "11", status: "CONFIRMED" })], null),
    "noCompleted",
  );
  assert.equal(
    classifyCustomerGroup(
      [
        makeBooking({
          id: "12",
          status: "COMPLETED",
          slot: { id: "s12", slotDate: "2026-08-01", startTime: "09:00:00", endTime: "10:00:00" },
        }),
      ],
      octRange,
    ),
    "outsidePeriod",
  );
});

test("BigInt total spend sums only COMPLETED bookedPrice with zero float drift and tracks status counts & upcoming slot", () => {
  const bookings: ProviderBooking[] = [
    makeBooking({
      id: "201",
      status: "COMPLETED",
      bookedPrice: "5000000000.50",
      slot: { id: "s1", slotDate: "2026-10-02", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "202",
      status: "COMPLETED",
      bookedPrice: "5000000000.75",
      slot: { id: "s2", slotDate: "2026-10-12", startTime: "10:00:00", endTime: "11:00:00" },
    }),
    makeBooking({
      id: "203",
      status: "CANCELLED",
      bookedPrice: "999999.00",
      slot: { id: "s3", slotDate: "2026-10-14", startTime: "11:00:00", endTime: "12:00:00" },
    }),
    makeBooking({
      id: "204",
      status: "CONFIRMED",
      bookedPrice: "300000.00",
      slot: { id: "s4", slotDate: "2026-10-20", startTime: "15:00:00", endTime: "16:00:00" },
    }),
    makeBooking({
      id: "205",
      status: "PENDING_CONFIRMATION",
      bookedPrice: "150000.00",
      slot: { id: "s5", slotDate: "2026-10-18", startTime: "08:30:00", endTime: "09:30:00" },
    }),
  ];

  const [record] = buildLiveCustomerRecords(bookings, octRange, nowMs);
  assert.equal(record.completedCount, 2);
  assert.equal(record.statusCounts.total, 5);
  assert.equal(record.statusCounts.CANCELLED, 1);
  assert.equal(record.statusCounts.CONFIRMED, 1);
  assert.equal(record.statusCounts.PENDING_CONFIRMATION, 1);
  assert.equal(record.totalCompletedSpendCents, BigInt("1000000000125"));
  assert.equal(record.totalCompletedSpendFormatted, "10.000.000.001,25 ₫");
  assert.equal(record.latestCompletedSlot?.slotDate, "2026-10-12");
  assert.equal(record.nextUpcomingSlot?.slotDate, "2026-10-18");
});

test("Pet deduplication, Vietnamese accent-insensitive search, and Asia/Ho_Chi_Minh date presets work cleanly", () => {
  const bookings: ProviderBooking[] = [
    makeBooking({
      id: "301",
      customer: { id: "501", fullName: "Đức Huy" },
      pet: {
        id: "801",
        name: "Bắp",
        breed: "Corgi",
        birthDate: "2023-01-01",
        weight: "12.00",
        healthNote: "Không dị ứng",
        petType: { id: "1", name: "Chó" },
      },
    }),
    makeBooking({
      id: "302",
      customer: { id: "501", fullName: "Đức Huy" },
      slot: { id: "s2", slotDate: "2026-10-11", startTime: "11:00:00", endTime: "12:00:00" },
      pet: {
        id: "801",
        name: "Bắp",
        breed: "Corgi",
        birthDate: "2023-01-01",
        weight: "12.50",
        healthNote: "Không dị ứng",
        petType: { id: "1", name: "Chó" },
      },
    }),
  ];

  const records = buildLiveCustomerRecords(bookings, octRange, nowMs);
  assert.equal(records[0].pets.length, 1);
  assert.equal(records[0].pets[0].weight, "12.50");
  assert.equal(
    filterLiveCustomers(records, { query: "DUC HUY", group: "returning" }).length,
    1,
  );
  assert.equal(
    filterLiveCustomers(records, { query: "bap", group: "all" }).length,
    1,
  );
  assert.equal(
    filterLiveCustomers(records, { query: "501", group: "all" }).length,
    1,
  );

  // Vietnam timezone rollover check (2026-09-30T17:00:00Z == 2026-10-01 00:00:00 +07:00)
  assert.equal(getVietnamCalendarDate(Date.parse("2026-09-30T17:00:00Z")), "2026-10-01");
  assert.deepEqual(
    getVietnamCurrentMonthRange(Date.parse("2028-02-15T00:00:00Z")),
    { start: "2028-02-01", end: "2028-02-29" },
  );
  assert.deepEqual(
    getPresetCustomerRange("30d", Date.parse("2026-10-30T10:00:00+07:00")),
    { start: "2026-10-01", end: "2026-10-30" },
  );
  assert.ok(validateReportingRange({ start: "2026-10-31", end: "2026-10-01" }));
  assert.equal(validateReportingRange(octRange), null);
});
