import { vi } from "../../lib/locale";
import { matchesSearch, normalizeSearch } from "../../lib/search";
import {
  isValidCalendarDate,
  type ProviderBooking,
  type ProviderBookingSlot,
} from "../provider-workspace/liveApi";
import {
  formatBookingSlotRange,
  formatCalendarDate,
  formatCentsToVnd,
  getSlotBoundsMs,
  parseDecimalAmountToCents,
} from "../provider-bookings/bookingLogic";
import type {
  CustomerFilters,
  CustomerGroup,
  CustomerPeriodPreset,
  CustomerPetProfile,
  CustomerRecord,
  CustomerStatusCounts,
  CustomersReport,
  ReportingRange,
} from "./types";

export const CUSTOMERS_TIME_ZONE = "Asia/Ho_Chi_Minh";

export const CUSTOMER_GROUP_LABELS: Readonly<Record<CustomerGroup, string>> = {
  returning: vi.provider.customers.groups.returning,
  new: vi.provider.customers.groups.new,
  outsidePeriod: vi.provider.customers.groups.outsidePeriod,
  noCompleted: vi.provider.customers.groups.noCompleted,
};

export function validateReportingRange(range: ReportingRange): string | null {
  if (!isValidCalendarDate(range.start) || !isValidCalendarDate(range.end)) {
    return vi.provider.customers.period.invalidDates;
  }
  if (range.start > range.end) {
    return vi.provider.customers.period.endBeforeStart;
  }
  return null;
}

export function getVietnamCalendarDate(nowMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CUSTOMERS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(date: string, deltaDays: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + deltaDays);
  return value.toISOString().slice(0, 10);
}

export function getVietnamCurrentMonthRange(nowMs: number): ReportingRange {
  const today = getVietnamCalendarDate(nowMs);
  const [yearStr, monthStr] = today.split("-");
  const lastDay = new Date(
    Date.UTC(Number(yearStr), Number(monthStr), 0),
  ).getUTCDate();
  return {
    start: `${yearStr}-${monthStr}-01`,
    end: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function getPresetCustomerRange(
  preset: Exclude<CustomerPeriodPreset, "allTime">,
  nowMs: number,
): ReportingRange {
  const today = getVietnamCalendarDate(nowMs);
  if (preset === "thisMonth") {
    return getVietnamCurrentMonthRange(nowMs);
  }
  const daysBack = preset === "90d" ? 89 : 29;
  return {
    start: addCalendarDays(today, -daysBack),
    end: today,
  };
}

export function formatCustomerDate(calendarDate: string): string {
  return formatCalendarDate(calendarDate);
}

export function formatCustomerSlot(slot: ProviderBookingSlot): string {
  return formatBookingSlotRange(slot);
}

/**
 * Chronological comparison matching Backend SQL:
 * earlierSlot.slotDate < slot.slotDate OR
 * (earlierSlot.slotDate = slot.slotDate AND earlierSlot.startTime < slot.startTime)
 */
export function compareSlotChronology(
  a: Pick<ProviderBookingSlot, "slotDate" | "startTime">,
  b: Pick<ProviderBookingSlot, "slotDate" | "startTime">,
): number {
  if (a.slotDate !== b.slotDate) {
    return a.slotDate < b.slotDate ? -1 : 1;
  }
  if (a.startTime !== b.startTime) {
    return a.startTime < b.startTime ? -1 : 1;
  }
  return 0;
}

function isSlotInRange(
  slotDate: string,
  range: ReportingRange | null,
): boolean {
  if (range === null) return true;
  return slotDate >= range.start && slotDate <= range.end;
}

/**
 * Mirrors PawFlow-API DashboardService.getReturningCustomers SQL exactly:
 * A customer is "returning" for `range` (or all-time when `range === null`) iff
 * there exists a COMPLETED booking `b` of that customer with slotDate in `range`
 * AND there exists another COMPLETED booking `e` of that customer across the
 * provider's entire history with (e.slotDate, e.startTime) strictly earlier than
 * (b.slotDate, b.startTime).
 */
export function classifyCustomerGroup(
  bookings: readonly ProviderBooking[],
  range: ReportingRange | null,
): CustomerGroup {
  const completed = bookings.filter((booking) => booking.status === "COMPLETED");
  if (completed.length === 0) return "noCompleted";

  const inScope = completed.filter((booking) =>
    isSlotInRange(booking.slot.slotDate, range),
  );
  if (inScope.length === 0) return "outsidePeriod";

  const hasEarlierCompleted = inScope.some((booking) =>
    completed.some(
      (earlier) => compareSlotChronology(earlier.slot, booking.slot) < 0,
    ),
  );

  return hasEarlierCompleted ? "returning" : "new";
}

function createEmptyStatusCounts(): {
  PENDING_CONFIRMATION: number;
  CONFIRMED: number;
  REJECTED: number;
  COMPLETED: number;
  CANCELLED: number;
  NO_SHOW: number;
  total: number;
} {
  return {
    PENDING_CONFIRMATION: 0,
    CONFIRMED: 0,
    REJECTED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
    total: 0,
  };
}

/**
 * Aggregates live GET /bookings/provider rows into CustomerRecord[] strictly keyed
 * by customer.id (BIGINT string). Matching names never merge distinct customers or pets.
 */
export function buildLiveCustomerRecords(
  bookings: readonly ProviderBooking[],
  range: ReportingRange | null,
  nowMs: number,
): CustomerRecord[] {
  if (range !== null) {
    const error = validateReportingRange(range);
    if (error) throw new Error(error);
  }

  const byCustomer = new Map<string, ProviderBooking[]>();
  for (const booking of bookings) {
    const existing = byCustomer.get(booking.customer.id);
    if (existing) {
      existing.push(booking);
    } else {
      byCustomer.set(booking.customer.id, [booking]);
    }
  }

  const records: CustomerRecord[] = [];
  for (const [, customerBookings] of byCustomer) {
    // Sort newest slot first, then newest createdAt, then deterministic ID.
    const sortedBookings = [...customerBookings].sort((a, b) => {
      const slotDiff = compareSlotChronology(b.slot, a.slot);
      if (slotDiff !== 0) return slotDiff;
      if (b.createdAt !== a.createdAt) {
        return b.createdAt < a.createdAt ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });

    const latestBooking = sortedBookings[0];
    const counts = createEmptyStatusCounts();
    let totalCompletedSpendCents = BigInt(0);
    const petsById = new Map<string, CustomerPetProfile>();
    let latestCompletedSlot: ProviderBookingSlot | null = null;
    let nextUpcomingSlot: ProviderBookingSlot | null = null;
    let nextUpcomingStartMs = Number.POSITIVE_INFINITY;

    for (const booking of sortedBookings) {
      counts[booking.status] += 1;
      counts.total += 1;

      if (!petsById.has(booking.pet.id)) {
        petsById.set(booking.pet.id, {
          id: booking.pet.id,
          name: booking.pet.name,
          petTypeName: booking.pet.petType.name,
          breed: booking.pet.breed,
          birthDate: booking.pet.birthDate,
          weight: booking.pet.weight,
          healthNote: booking.pet.healthNote,
        });
      }

      if (booking.status === "COMPLETED") {
        totalCompletedSpendCents += parseDecimalAmountToCents(
          booking.bookedPrice,
        );
        if (
          latestCompletedSlot === null ||
          compareSlotChronology(booking.slot, latestCompletedSlot) > 0
        ) {
          latestCompletedSlot = booking.slot;
        }
      }

      if (
        booking.status === "PENDING_CONFIRMATION" ||
        booking.status === "CONFIRMED"
      ) {
        const bounds = getSlotBoundsMs(booking.slot);
        if (
          bounds &&
          bounds.startMs >= nowMs &&
          bounds.startMs < nextUpcomingStartMs
        ) {
          nextUpcomingStartMs = bounds.startMs;
          nextUpcomingSlot = booking.slot;
        }
      }
    }

    const pets = [...petsById.values()].sort(
      (a, b) => a.name.localeCompare(b.name, "vi") || a.id.localeCompare(b.id),
    );

    const statusCounts: CustomerStatusCounts = counts;
    records.push({
      customer: latestBooking.customer,
      pets,
      bookings: sortedBookings,
      statusCounts,
      completedCount: counts.COMPLETED,
      totalCompletedSpendCents,
      totalCompletedSpendFormatted: formatCentsToVnd(totalCompletedSpendCents),
      latestCompletedSlot,
      nextUpcomingSlot,
      group: classifyCustomerGroup(sortedBookings, range),
    });
  }

  return records.sort((a, b) => {
    const latestA = a.bookings[0].slot;
    const latestB = b.bookings[0].slot;
    const slotDiff = compareSlotChronology(latestB, latestA);
    if (slotDiff !== 0) return slotDiff;
    return a.customer.id.localeCompare(b.customer.id);
  });
}

export function summarizeLiveCustomers(
  records: readonly CustomerRecord[],
  range: ReportingRange | null,
): CustomersReport {
  if (range !== null) {
    const error = validateReportingRange(range);
    if (error) throw new Error(error);
  }

  const servedCustomerIds = new Set<string>();
  const returningCustomerIds = new Set<string>();
  const servedPetIds = new Set<string>();

  for (const record of records) {
    let servedInScope = false;
    for (const booking of record.bookings) {
      if (
        booking.status !== "COMPLETED" ||
        !isSlotInRange(booking.slot.slotDate, range)
      ) {
        continue;
      }
      servedInScope = true;
      servedPetIds.add(booking.pet.id);
    }

    if (servedInScope) {
      servedCustomerIds.add(record.customer.id);
      if (record.group === "returning") {
        returningCustomerIds.add(record.customer.id);
      }
    }
  }

  return {
    servedCustomers: servedCustomerIds.size,
    returningCustomers: returningCustomerIds.size,
    servedPets: servedPetIds.size,
  };
}

export function filterLiveCustomers(
  records: readonly CustomerRecord[],
  filters: CustomerFilters,
): CustomerRecord[] {
  const normalizedQuery = normalizeSearch(filters.query);
  return records.filter(
    (record) =>
      (filters.group === "all" || record.group === filters.group) &&
      matchesSearch(normalizedQuery, [
        record.customer.id,
        record.customer.fullName,
        ...record.pets.map((pet) => pet.name),
        ...record.pets.map((pet) => pet.petTypeName),
      ]),
  );
}
