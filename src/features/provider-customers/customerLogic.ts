import type { CustomerFilters, CustomerGroup, CustomerRecord, CustomersMockData, CustomersReport, ReportingRange } from "./types";

export const customersTimeZone = "Asia/Ho_Chi_Minh";
export const customerGroupLabels: Record<CustomerGroup, string> = {
  returning: "Quay lại",
  new: "Mới",
  outsidePeriod: "Không có lịch hoàn thành trong kỳ",
  noCompleted: "Chưa có lịch hoàn thành",
};

export function normalizeCustomerSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi-VN").trim();
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateReportingRange(range: ReportingRange): string | null {
  if (!validDate(range.start) || !validDate(range.end)) return "Nhập đầy đủ ngày bắt đầu và ngày kết thúc hợp lệ.";
  if (range.start > range.end) return "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.";
  return null;
}

/** Inclusive local dates become [start, next-day midnight) in Vietnam. */
export function reportingBounds(range: ReportingRange) {
  const error = validateReportingRange(range);
  if (error) throw new Error(error);
  return {
    start: Date.parse(`${range.start}T00:00:00+07:00`),
    endExclusive: Date.parse(`${range.end}T00:00:00+07:00`) + 86_400_000,
  };
}

export function currentMockMonth(now: string): ReportingRange {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: customersTimeZone, year: "numeric", month: "2-digit" }).formatToParts(new Date(now));
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${lastDay}` };
}

export function formatCustomerDate(value: string) {
  return value.split("-").reverse().join("/");
}

export function formatCustomerDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: customersTimeZone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

/** Scope first; names never act as customer or pet identifiers. */
export function buildCustomerRecords(data: CustomersMockData, facilityId: string, range: ReportingRange, now: string): CustomerRecord[] {
  const { start, endExclusive } = reportingBounds(range);
  const nowTime = Date.parse(now);
  const scopedBookings = data.bookings.filter((booking) => booking.facilityId === facilityId);
  const bookingsByCustomer = new Map<string, typeof scopedBookings>();
  for (const booking of scopedBookings) {
    const list = bookingsByCustomer.get(booking.customerId) ?? [];
    list.push(booking);
    bookingsByCustomer.set(booking.customerId, list);
  }
  return data.customers.flatMap<CustomerRecord>((customer) => {
    const bookings = bookingsByCustomer.get(customer.id);
    if (!bookings?.length) return [];
    const completed = bookings.filter((booking) => booking.status === "completed");
    const inPeriod = completed.some((booking) => Date.parse(booking.scheduledAt) >= start && Date.parse(booking.scheduledAt) < endExclusive);
    const prior = completed.some((booking) => Date.parse(booking.scheduledAt) < start);
    const served = completed.filter((booking) => Date.parse(booking.scheduledAt) <= nowTime)
      .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt));
    const petIds = new Set(bookings.map((booking) => booking.petId));
    return [{
      customer,
      pets: data.pets.filter((pet) => pet.customerId === customer.id && petIds.has(pet.id)),
      bookings: [...bookings].sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt) || a.id.localeCompare(b.id)),
      completedCount: completed.length,
      lastServedAt: served[0]?.scheduledAt ?? null,
      group: inPeriod ? (prior ? "returning" : "new") : (completed.length ? "outsidePeriod" : "noCompleted"),
    }];
  });
}

export function summarizeCustomers(records: CustomerRecord[], range: ReportingRange): CustomersReport {
  const { start, endExclusive } = reportingBounds(range);
  const servedCustomerIds = new Set<string>();
  const returningCustomerIds = new Set<string>();
  const servedPetIds = new Set<string>();
  for (const record of records) {
    for (const booking of record.bookings) {
      const time = Date.parse(booking.scheduledAt);
      if (booking.status !== "completed" || time < start || time >= endExclusive) continue;
      servedCustomerIds.add(record.customer.id);
      servedPetIds.add(booking.petId);
      if (record.bookings.some((item) => item.status === "completed" && Date.parse(item.scheduledAt) < start)) returningCustomerIds.add(record.customer.id);
    }
  }
  return { servedCustomers: servedCustomerIds.size, returningCustomers: returningCustomerIds.size, servedPets: servedPetIds.size };
}

export function filterCustomers(records: CustomerRecord[], filters: CustomerFilters) {
  const query = normalizeCustomerSearch(filters.query);
  return records.filter((record) => (filters.group === "all" || record.group === filters.group) &&
    normalizeCustomerSearch([record.customer.id, record.customer.name, ...record.pets.map((pet) => pet.name)].join(" ")).includes(query));
}
