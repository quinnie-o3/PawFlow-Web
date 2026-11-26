import assert from "node:assert/strict";
import test from "node:test";
import type {
  ProviderBooking,
  ProviderDashboard,
  ProviderDssAlert,
} from "../../provider-workspace/liveApi";
import {
  buildBookingRequestsPreview,
  buildDashboardMetricCards,
  buildPrioritySummary,
  buildStatusSeriesFromBookings,
  createPresetDateRange,
  getVietnamTodayDate,
  localizeDssAlert,
  validateDashboardDateRange,
} from "./dashboardAnalytics";

function makeDashboard(
  overrides: Partial<ProviderDashboard> = {},
): ProviderDashboard {
  return {
    providerId: "42",
    period: { from: "2026-11-01", to: "2026-11-30" },
    bookingVolumeByStatus: {
      PENDING_CONFIRMATION: 3,
      CONFIRMED: 5,
      REJECTED: 1,
      COMPLETED: 12,
      CANCELLED: 4,
      NO_SHOW: 2,
      total: 27,
    },
    cancellationRate: {
      cancelledBookings: 4,
      resolvedBookings: 18,
      rate: 22.22,
    },
    popularServices: [
      { serviceId: "101", serviceName: "Grooming toàn diện", completedBookings: 8 },
      { serviceId: "102", serviceName: "Tắm & vệ sinh", completedBookings: 4 },
    ],
    returningCustomers: { count: 6 },
    recordedRevenue: { amount: "4850000.00" },
    averageRating: { reviewCount: 9, average: 4.67 },
    alerts: [],
    ...overrides,
  };
}

function makeBooking(overrides: Partial<ProviderBooking> = {}): ProviderBooking {
  return {
    id: "5001",
    status: "PENDING_CONFIRMATION",
    bookedPrice: "250000.00",
    customerNote: null,
    createdAt: "2026-11-20T03:00:00.000Z",
    updatedAt: "2026-11-20T03:00:00.000Z",
    service: { id: "101", name: "Grooming toàn diện", durationMinutes: 90 },
    slot: {
      id: "900",
      slotDate: "2026-11-26",
      startTime: "09:00:00",
      endTime: "10:30:00",
    },
    customer: { id: "8001", fullName: "Hà Linh" },
    pet: {
      id: "7001",
      name: "Miu",
      breed: "Anh lông ngắn",
      birthDate: null,
      weight: null,
      healthNote: null,
      petType: { id: "2", name: "Mèo" },
    },
    ...overrides,
  };
}

test("buildDashboardMetricCards formats all 6 KPIs and handles null rate, null rating, empty popularServices, and large BigInt revenue", () => {
  const full = buildDashboardMetricCards(makeDashboard());
  assert.equal(full.length, 6);
  assert.equal(full.find((c) => c.id === "recognized-revenue")?.value, "4.850.000 ₫");
  assert.equal(full.find((c) => c.id === "appointment-status")?.value, "27");
  assert.equal(full.find((c) => c.id === "appointment-status")?.breakdown?.length, 6);
  assert.equal(full.find((c) => c.id === "cancellation-rate")?.value, "22,22%");
  assert.equal(full.find((c) => c.id === "popular-service")?.value, "Grooming toàn diện");
  assert.equal(full.find((c) => c.id === "returning-customers")?.value, "6");
  assert.equal(full.find((c) => c.id === "average-rating")?.value, "4,67 / 5");

  const emptyMetrics = buildDashboardMetricCards(
    makeDashboard({
      bookingVolumeByStatus: {
        PENDING_CONFIRMATION: 0,
        CONFIRMED: 0,
        REJECTED: 0,
        COMPLETED: 0,
        CANCELLED: 0,
        NO_SHOW: 0,
        total: 0,
      },
      cancellationRate: { cancelledBookings: 0, resolvedBookings: 0, rate: null },
      popularServices: [],
      returningCustomers: { count: 0 },
      recordedRevenue: { amount: "9999999999999.50" },
      averageRating: { reviewCount: 0, average: null },
    }),
  );
  assert.equal(emptyMetrics.find((c) => c.id === "recognized-revenue")?.value, "9.999.999.999.999,50 ₫");
  assert.equal(emptyMetrics.find((c) => c.id === "cancellation-rate")?.value, "N/A");
  assert.equal(emptyMetrics.find((c) => c.id === "popular-service")?.value, "N/A");
  assert.equal(emptyMetrics.find((c) => c.id === "average-rating")?.value, "N/A");
});

test("localizeDssAlert translates all 5 DSS codes to Vietnamese with dynamic context and never leaks raw English server text", () => {
  const rawEnglishSentinel = "RAW_SERVER_ENGLISH_DO_NOT_RENDER";
  const allAlerts: ProviderDssAlert[] = [
    {
      code: "PEAK_HOUR_DEMAND",
      severity: "WARNING",
      message: `${rawEnglishSentinel}_PEAK_MSG`,
      recommendation: `${rawEnglishSentinel}_PEAK_REC`,
      context: {
        date: "2026-11-18",
        peakAcceptedBookings: 5,
        totalAcceptedBookings: 10,
        percentage: 50,
      },
    },
    {
      code: "HIGH_SERVICE_CANCELLATION",
      severity: "WARNING",
      message: `${rawEnglishSentinel}_CANCEL_MSG`,
      recommendation: `${rawEnglishSentinel}_CANCEL_REC`,
      context: {
        month: "2026-11",
        serviceId: "101",
        cancelledBookings: 3,
        resolvedBookings: 10,
        percentage: 30,
      },
    },
    {
      code: "UNDERUSED_SERVICE",
      severity: "INFO",
      message: `${rawEnglishSentinel}_UNDER_MSG`,
      recommendation: `${rawEnglishSentinel}_UNDER_REC`,
      context: {
        month: "2026-11",
        serviceId: "999",
        completedBookings: 1,
        comparisonAverage: 5.5,
      },
    },
    {
      code: "FREQUENT_RETURNING_CUSTOMER",
      severity: "INFO",
      message: `${rawEnglishSentinel}_CUST_MSG`,
      recommendation: `${rawEnglishSentinel}_CUST_REC`,
      context: {
        customerId: "8001",
        completedBookings: 4,
        from: "2026-09-30",
        to: "2026-11-30",
      },
    },
    {
      code: "LOW_RATING",
      severity: "WARNING",
      message: `${rawEnglishSentinel}_RATING_MSG`,
      recommendation: `${rawEnglishSentinel}_RATING_REC`,
      context: {
        from: "2026-11-01",
        to: "2026-11-30",
        reviewCount: 4,
        average: 3.5,
      },
    },
  ];

  const lookups = {
    facilityName: "PetCare House",
    serviceNames: new Map([["101", "Grooming toàn diện"]]),
    customerNames: new Map([["8001", "Hà Linh"]]),
  };

  const localized = allAlerts.map((alert) => localizeDssAlert(alert, lookups));
  assert.equal(localized.length, 5);

  for (const item of localized) {
    const serialized = JSON.stringify(item);
    assert.ok(
      !serialized.includes(rawEnglishSentinel),
      `Raw English leaked for ${item.code}`,
    );
  }

  assert.match(localized[0].summary, /50%/);
  assert.match(localized[0].summary, /18\/11\/2026/);
  assert.equal(localized[0].severity, "WARNING");

  assert.match(localized[1].summary, /Grooming toàn diện \(#101\)/);
  assert.match(localized[1].summary, /11\/2026/);

  // Fallback when serviceId is not in lookup map
  assert.match(localized[2].summary, /Dịch vụ #999/);
  assert.equal(localized[2].severity, "INFO");

  assert.match(localized[3].summary, /Hà Linh \(#8001\)/);
  assert.match(localized[3].summary, /4 lịch hẹn/);

  assert.match(localized[4].summary, /3,5/);
  assert.match(localized[4].summary, /4 đánh giá/);
});

test("buildPrioritySummary and buildBookingRequestsPreview derive live counts and newest pending ordering", () => {
  const bookings: ProviderBooking[] = [
    makeBooking({
      id: "101",
      status: "PENDING_CONFIRMATION",
      createdAt: "2026-11-25T08:00:00.000Z",
      slot: { id: "s1", slotDate: "2026-11-26", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "102",
      status: "PENDING_CONFIRMATION",
      createdAt: "2026-11-26T01:00:00.000Z",
      slot: { id: "s2", slotDate: "2026-11-27", startTime: "10:00:00", endTime: "11:00:00" },
    }),
    makeBooking({
      id: "103",
      status: "CONFIRMED",
      slot: { id: "s3", slotDate: "2026-11-26", startTime: "14:00:00", endTime: "15:00:00" },
    }),
    makeBooking({
      id: "104",
      status: "CANCELLED",
      slot: { id: "s4", slotDate: "2026-11-26", startTime: "16:00:00", endTime: "17:00:00" },
    }),
  ];

  const priority = buildPrioritySummary(bookings, "2026-11-26", {
    activeServices: 0,
    upcomingOpenSlots: 2,
  });
  assert.equal(priority.waitingCount, 2);
  assert.equal(priority.todayCount, 2);
  assert.equal(priority.missingActiveServices, true);
  assert.equal(priority.missingUpcomingOpenSlots, false);

  const preview = buildBookingRequestsPreview(bookings, 1);
  assert.equal(preview.totalPending, 2);
  assert.deepEqual(
    preview.items.map((item) => item.id),
    ["102"],
  );
});

test("buildStatusSeriesFromBookings adapts bucket count to <= 7 across 7d, 30d, and 90d ranges", () => {
  const bookings: ProviderBooking[] = [
    makeBooking({
      id: "1",
      status: "COMPLETED",
      slot: { id: "s1", slotDate: "2026-11-01", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "2",
      status: "CANCELLED",
      slot: { id: "s2", slotDate: "2026-11-15", startTime: "09:00:00", endTime: "10:00:00" },
    }),
    makeBooking({
      id: "3",
      status: "COMPLETED",
      slot: { id: "s3", slotDate: "2026-11-29", startTime: "09:00:00", endTime: "10:00:00" },
    }),
  ];

  // 7-day range => 7 daily buckets
  const sevenDay = buildStatusSeriesFromBookings(bookings, {
    start: "2026-11-01",
    end: "2026-11-07",
  });
  assert.equal(sevenDay.length, 7);
  assert.equal(sevenDay[0].completed, 1);

  // 30-day range => 5 weekly buckets
  const thirtyDay = buildStatusSeriesFromBookings(bookings, {
    start: "2026-11-01",
    end: "2026-11-30",
  });
  assert.equal(thirtyDay.length, 5);
  assert.equal(
    thirtyDay.reduce((sum, p) => sum + p.completed, 0),
    2,
  );
  assert.equal(
    thirtyDay.reduce((sum, p) => sum + p.other, 0),
    1,
  );

  // 90-day range => capped at 6 compact segment buckets (never overflows mobile 390px)
  const ninetyDay = buildStatusSeriesFromBookings(bookings, {
    start: "2026-09-02",
    end: "2026-11-30",
  });
  assert.ok(ninetyDay.length <= 6);
  assert.equal(
    ninetyDay.reduce((sum, p) => sum + p.completed + p.other, 0),
    3,
  );

  // Out-of-range => empty array
  assert.deepEqual(
    buildStatusSeriesFromBookings(bookings, {
      start: "2026-12-01",
      end: "2026-12-31",
    }),
    [],
  );

  // Vietnam timezone rollover & date validation
  assert.equal(
    getVietnamTodayDate(Date.parse("2026-11-25T17:30:00Z")),
    "2026-11-26",
  );
  assert.deepEqual(
    createPresetDateRange("7d", Date.parse("2026-11-26T09:00:00+07:00")),
    { start: "2026-11-20", end: "2026-11-26" },
  );
  assert.ok(
    validateDashboardDateRange({ start: "2026-11-30", end: "2026-11-01" }),
  );
  assert.equal(
    validateDashboardDateRange({ start: "2026-11-01", end: "2026-11-30" }),
    null,
  );
});
