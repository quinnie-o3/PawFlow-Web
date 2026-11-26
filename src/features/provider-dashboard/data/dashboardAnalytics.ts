import { formatMessage, vi } from "../../../lib/locale";
import {
  isValidCalendarDate,
  type ProviderBooking,
  type ProviderDashboard,
  type ProviderDssAlert,
} from "../../provider-workspace/liveApi";
import {
  formatBookingSlotRange,
  formatCalendarDate,
  formatVndAmount,
} from "../../provider-bookings/bookingLogic";
import type {
  DashboardRangePreset,
  DateRange,
  DssAlertLookups,
  LocalizedDssAlert,
  MetricCardData,
  PrioritySummary,
  SetupHintsCounts,
  WeeklyStatusPoint,
} from "../types";

export const DASHBOARD_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function getVietnamTodayDate(nowMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function addDashboardCalendarDays(
  calendarDate: string,
  deltaDays: number,
): string {
  const value = new Date(`${calendarDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + deltaDays);
  return value.toISOString().slice(0, 10);
}

export function createPresetDateRange(
  preset: Exclude<DashboardRangePreset, "custom">,
  nowMs: number,
): DateRange {
  const end = getVietnamTodayDate(nowMs);
  const delta = preset === "7d" ? -6 : preset === "90d" ? -89 : -29;
  return {
    start: addDashboardCalendarDays(end, delta),
    end,
  };
}

export function validateDashboardDateRange(range: DateRange): string | null {
  if (!isValidCalendarDate(range.start) || !isValidCalendarDate(range.end)) {
    return vi.provider.dashboard.intro.invalidRange;
  }
  if (range.start > range.end) {
    return vi.provider.dashboard.intro.invalidRange;
  }
  return null;
}

export function formatDate(date: string): string {
  return formatCalendarDate(date);
}

export function formatShortDayMonth(date: string): string {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}`;
}

export function formatCalendarMonth(month: string): string {
  const parts = month.split("-");
  if (parts.length !== 2) return month;
  return `${parts[1]}/${parts[0]}`;
}

export function formatRange(range: DateRange): string {
  if (range.start === range.end) {
    return formatDate(range.start);
  }
  if (range.start.slice(0, 7) === range.end.slice(0, 7)) {
    return `${range.start.slice(8)}–${formatDate(range.end)}`;
  }
  return `${formatDate(range.start)} – ${formatDate(range.end)}`;
}

export function formatBookingPreviewSlot(booking: ProviderBooking): string {
  return formatBookingSlotRange(booking.slot);
}

function formatViNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString("vi-VN", {
    maximumFractionDigits: fractionDigits,
  });
}

function formatViRating(value: number): string {
  return value.toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

/** Builds the 6 authoritative KPI cards directly from GET /dashboard/provider. */
export function buildDashboardMetricCards(
  dashboard: ProviderDashboard,
): MetricCardData[] {
  const m = vi.provider.dashboard.metrics;
  const vol = dashboard.bookingVolumeByStatus;
  const cancel = dashboard.cancellationRate;
  const topService = dashboard.popularServices[0] ?? null;
  const extraServices = Math.max(0, dashboard.popularServices.length - 1);
  const rating = dashboard.averageRating;

  const cancellationValue =
    cancel.rate === null ? "N/A" : `${formatViNumber(cancel.rate, 2)}%`;
  const cancellationDescription =
    cancel.resolvedBookings > 0
      ? formatMessage(m.resolvedDescription, {
          cancelled: cancel.cancelledBookings,
          resolved: cancel.resolvedBookings,
        })
      : m.noResolvedDescription;

  const popularValue = topService ? topService.serviceName : "N/A";
  const popularDescription = topService
    ? extraServices > 0
      ? formatMessage(m.completedDescriptionWithMore, {
          count: topService.completedBookings,
          more: extraServices,
        })
      : formatMessage(m.completedDescription, {
          count: topService.completedBookings,
        })
    : m.noCompletedBookings;

  const ratingValue =
    rating.average === null ? "N/A" : `${formatViRating(rating.average)} / 5`;
  const ratingDescription =
    rating.reviewCount > 0
      ? formatMessage(m.ratingDescription, { count: rating.reviewCount })
      : m.noRatingsDescription;

  return [
    {
      id: "recognized-revenue",
      title: m.recognizedRevenue,
      icon: "payment",
      value: formatVndAmount(dashboard.recordedRevenue.amount),
      description: m.revenueDescription,
    },
    {
      id: "appointment-status",
      title: m.appointmentStatus,
      icon: "calendar",
      value: String(vol.total),
      description: vol.total > 0 ? m.totalBookingsDescription : m.noData,
      breakdown: [
        {
          label: m.statusShort.COMPLETED,
          value: String(vol.COMPLETED),
          tone: "success",
        },
        {
          label: m.statusShort.CONFIRMED,
          value: String(vol.CONFIRMED),
          tone: "info",
        },
        {
          label: m.statusShort.PENDING_CONFIRMATION,
          value: String(vol.PENDING_CONFIRMATION),
          tone: "pending",
        },
        {
          label: m.statusShort.CANCELLED,
          value: String(vol.CANCELLED),
          tone: "danger",
        },
        {
          label: m.statusShort.NO_SHOW,
          value: String(vol.NO_SHOW),
          tone: "warning",
        },
        {
          label: m.statusShort.REJECTED,
          value: String(vol.REJECTED),
          tone: "danger",
        },
      ],
    },
    {
      id: "cancellation-rate",
      title: m.cancellationRate,
      icon: "notification",
      value: cancellationValue,
      description: cancellationDescription,
    },
    {
      id: "popular-service",
      title: m.popularService,
      icon: "stack",
      value: popularValue,
      description: popularDescription,
    },
    {
      id: "returning-customers",
      title: m.returningCustomers,
      icon: "cards",
      value: String(dashboard.returningCustomers.count),
      description: m.returningDescription,
    },
    {
      id: "average-rating",
      title: m.averageRating,
      icon: "chart",
      value: ratingValue,
      description: ratingDescription,
    },
  ];
}

function resolveServiceLabel(
  serviceId: string,
  serviceNames: ReadonlyMap<string, string>,
): string {
  const name = serviceNames.get(serviceId);
  if (name) {
    return formatMessage(vi.provider.dashboard.alerts.serviceWithId, {
      serviceName: name,
      serviceId,
    });
  }
  return formatMessage(vi.provider.dashboard.alerts.serviceFallback, {
    serviceId,
  });
}

function resolveCustomerLabel(
  customerId: string,
  customerNames: ReadonlyMap<string, string>,
): string {
  const name = customerNames.get(customerId);
  if (name) {
    return formatMessage(vi.provider.dashboard.alerts.customerWithId, {
      customerName: name,
      customerId,
    });
  }
  return formatMessage(vi.provider.dashboard.alerts.customerFallback, {
    customerId,
  });
}

/**
 * Translates all 5 backend DssAlertCode variants strictly from `code`, `severity`,
 * and structured `context` via locale/vi.json. Never renders raw English server strings.
 */
export function localizeDssAlert(
  alert: ProviderDssAlert,
  lookups: DssAlertLookups,
): LocalizedDssAlert {
  const alertsLocale = vi.provider.dashboard.alerts;
  const severityLabel = alertsLocale.severity[alert.severity];
  const allScope = lookups.facilityName
    ? formatMessage(alertsLocale.allServicesScope, {
        facilityName: lookups.facilityName,
      })
    : alertsLocale.allServicesScopeFallback;

  switch (alert.code) {
    case "PEAK_HOUR_DEMAND": {
      const copy = alertsLocale.codes.PEAK_HOUR_DEMAND;
      const dateLabel = formatDate(alert.context.date);
      const percentage = formatViNumber(alert.context.percentage, 2);
      return {
        id: `PEAK_HOUR_DEMAND:${alert.context.date}`,
        code: alert.code,
        severity: alert.severity,
        severityLabel,
        title: copy.title,
        summary: formatMessage(copy.summary, {
          percentage,
          date: dateLabel,
          peak: alert.context.peakAcceptedBookings,
          total: alert.context.totalAcceptedBookings,
        }),
        period: dateLabel,
        scope: allScope,
        metric: formatMessage(copy.metric, {
          peak: alert.context.peakAcceptedBookings,
          total: alert.context.totalAcceptedBookings,
          percentage,
        }),
        threshold: copy.threshold,
        recommendation: copy.recommendation,
      };
    }

    case "HIGH_SERVICE_CANCELLATION": {
      const copy = alertsLocale.codes.HIGH_SERVICE_CANCELLATION;
      const serviceLabel = resolveServiceLabel(
        alert.context.serviceId,
        lookups.serviceNames,
      );
      const monthLabel = formatCalendarMonth(alert.context.month);
      const percentage = formatViNumber(alert.context.percentage, 2);
      return {
        id: `HIGH_SERVICE_CANCELLATION:${alert.context.month}:${alert.context.serviceId}`,
        code: alert.code,
        severity: alert.severity,
        severityLabel,
        title: copy.title,
        summary: formatMessage(copy.summary, {
          serviceLabel,
          percentage,
          month: monthLabel,
          cancelled: alert.context.cancelledBookings,
          resolved: alert.context.resolvedBookings,
        }),
        period: monthLabel,
        scope: serviceLabel,
        metric: formatMessage(copy.metric, {
          cancelled: alert.context.cancelledBookings,
          resolved: alert.context.resolvedBookings,
          percentage,
        }),
        threshold: copy.threshold,
        recommendation: copy.recommendation,
      };
    }

    case "UNDERUSED_SERVICE": {
      const copy = alertsLocale.codes.UNDERUSED_SERVICE;
      const serviceLabel = resolveServiceLabel(
        alert.context.serviceId,
        lookups.serviceNames,
      );
      const monthLabel = formatCalendarMonth(alert.context.month);
      const average = formatViNumber(alert.context.comparisonAverage, 2);
      return {
        id: `UNDERUSED_SERVICE:${alert.context.month}:${alert.context.serviceId}`,
        code: alert.code,
        severity: alert.severity,
        severityLabel,
        title: copy.title,
        summary: formatMessage(copy.summary, {
          serviceLabel,
          completed: alert.context.completedBookings,
          month: monthLabel,
          average,
        }),
        period: monthLabel,
        scope: serviceLabel,
        metric: formatMessage(copy.metric, {
          completed: alert.context.completedBookings,
          average,
        }),
        threshold: copy.threshold,
        recommendation: copy.recommendation,
      };
    }

    case "FREQUENT_RETURNING_CUSTOMER": {
      const copy = alertsLocale.codes.FREQUENT_RETURNING_CUSTOMER;
      const customerLabel = resolveCustomerLabel(
        alert.context.customerId,
        lookups.customerNames,
      );
      const fromLabel = formatDate(alert.context.from);
      const toLabel = formatDate(alert.context.to);
      return {
        id: `FREQUENT_RETURNING_CUSTOMER:${alert.context.customerId}:${alert.context.from}:${alert.context.to}`,
        code: alert.code,
        severity: alert.severity,
        severityLabel,
        title: copy.title,
        summary: formatMessage(copy.summary, {
          customerLabel,
          count: alert.context.completedBookings,
          from: fromLabel,
          to: toLabel,
        }),
        period: `${fromLabel} – ${toLabel}`,
        scope: customerLabel,
        metric: formatMessage(copy.metric, {
          count: alert.context.completedBookings,
        }),
        threshold: copy.threshold,
        recommendation: copy.recommendation,
      };
    }

    case "LOW_RATING": {
      const copy = alertsLocale.codes.LOW_RATING;
      const fromLabel = formatDate(alert.context.from);
      const toLabel = formatDate(alert.context.to);
      const average = formatViRating(alert.context.average);
      return {
        id: `LOW_RATING:${alert.context.from}:${alert.context.to}`,
        code: alert.code,
        severity: alert.severity,
        severityLabel,
        title: copy.title,
        summary: formatMessage(copy.summary, {
          average,
          count: alert.context.reviewCount,
          from: fromLabel,
          to: toLabel,
        }),
        period: `${fromLabel} – ${toLabel}`,
        scope: allScope,
        metric: formatMessage(copy.metric, {
          average,
          count: alert.context.reviewCount,
        }),
        threshold: copy.threshold,
        recommendation: copy.recommendation,
      };
    }
  }
}

export function buildPrioritySummary(
  bookings: readonly ProviderBooking[],
  todayDate: string,
  setupCounts: SetupHintsCounts | null = null,
): PrioritySummary {
  let waitingCount = 0;
  let todayCount = 0;

  for (const booking of bookings) {
    if (booking.status === "PENDING_CONFIRMATION") {
      waitingCount += 1;
    }
    if (
      booking.slot.slotDate === todayDate &&
      (booking.status === "PENDING_CONFIRMATION" ||
        booking.status === "CONFIRMED")
    ) {
      todayCount += 1;
    }
  }

  return {
    title: vi.provider.dashboard.priority.title,
    todayDate,
    waitingCount,
    todayCount,
    waitingRequests: formatMessage(
      vi.provider.dashboard.priority.waitingRequests,
      { count: String(waitingCount).padStart(2, "0") },
    ),
    todayAppointments: formatMessage(
      vi.provider.dashboard.priority.todayAppointments,
      { count: String(todayCount).padStart(2, "0") },
    ),
    missingActiveServices:
      setupCounts !== null && setupCounts.activeServices === 0,
    missingUpcomingOpenSlots:
      setupCounts !== null && setupCounts.upcomingOpenSlots === 0,
  };
}

export function buildBookingRequestsPreview(
  bookings: readonly ProviderBooking[],
  limit = 5,
): { items: ProviderBooking[]; totalPending: number } {
  const pending = bookings
    .filter((booking) => booking.status === "PENDING_CONFIRMATION")
    .sort((a, b) => {
      if (b.createdAt !== a.createdAt) {
        return b.createdAt < a.createdAt ? -1 : 1;
      }
      return b.id.localeCompare(a.id);
    });
  return {
    items: pending.slice(0, Math.max(0, limit)),
    totalPending: pending.length,
  };
}

function diffDaysInclusive(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

/**
 * Computes compact, responsive chart buckets from real GET /bookings/provider
 * rows filtered by `slot.slotDate` within [range.start, range.end] (Asia/Ho_Chi_Minh).
 *
 * Adaptive grouping caps bar groups to <= 7 so mobile 390×844 never overflows horizontally:
 * - <= 7 days: daily buckets (DD/MM)
 * - 8..42 days: weekly 7-day buckets (Tuần 1..Tuần 6)
 * - > 42 days (e.g. 90-day preset or wide custom range): at most 6 equal segments (Chặng 1..6)
 */
export function buildStatusSeriesFromBookings(
  bookings: readonly ProviderBooking[],
  range: DateRange,
): WeeklyStatusPoint[] {
  const totalDays = diffDaysInclusive(range.start, range.end);
  if (totalDays <= 0) return [];

  const inRange = bookings.filter(
    (booking) =>
      booking.slot.slotDate >= range.start &&
      booking.slot.slotDate <= range.end,
  );
  if (inRange.length === 0) return [];

  const bucketDays =
    totalDays <= 7 ? 1 : totalDays <= 42 ? 7 : Math.ceil(totalDays / 6);
  const bucketCount = Math.ceil(totalDays / bucketDays);
  const startMs = Date.parse(`${range.start}T00:00:00.000Z`);

  const buckets: {
    key: string;
    label: string;
    rangeLabel: string;
    completed: number;
    other: number;
  }[] = [];

  for (let index = 0; index < bucketCount; index++) {
    const bucketStart = addDashboardCalendarDays(
      range.start,
      index * bucketDays,
    );
    const rawBucketEnd = addDashboardCalendarDays(
      range.start,
      (index + 1) * bucketDays - 1,
    );
    const bucketEnd = rawBucketEnd > range.end ? range.end : rawBucketEnd;

    let label: string;
    let rangeLabel: string;
    if (bucketDays === 1) {
      label = formatShortDayMonth(bucketStart);
      rangeLabel = formatDate(bucketStart);
    } else if (bucketDays === 7) {
      label = formatMessage(vi.provider.dashboard.chart.week, {
        number: index + 1,
      });
      rangeLabel = `${formatShortDayMonth(bucketStart)}–${formatShortDayMonth(bucketEnd)}`;
    } else {
      label = formatMessage(vi.provider.dashboard.chart.segment, {
        number: index + 1,
      });
      rangeLabel = `${formatShortDayMonth(bucketStart)}–${formatShortDayMonth(bucketEnd)}`;
    }

    buckets.push({
      key: `${bucketStart}:${bucketEnd}`,
      label,
      rangeLabel,
      completed: 0,
      other: 0,
    });
  }

  for (const booking of inRange) {
    const dayOffset = Math.floor(
      (Date.parse(`${booking.slot.slotDate}T00:00:00.000Z`) - startMs) /
        86_400_000,
    );
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(dayOffset / bucketDays)),
    );
    if (booking.status === "COMPLETED") {
      buckets[bucketIndex].completed += 1;
    } else {
      buckets[bucketIndex].other += 1;
    }
  }

  return buckets;
}
