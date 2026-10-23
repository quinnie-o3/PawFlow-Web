import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerRecords, currentMockMonth, filterCustomers, formatCustomerDateTime, reportingBounds, summarizeCustomers, validateReportingRange } from "./customerLogic";
import { createCustomersMockData, customersMockFacility, customersMockNow } from "./data/providerCustomersMock";
import type { CustomerBooking, CustomersMockData, ReportingRange } from "./types";
import type { BookingStatus } from "../provider-bookings/types";

const range: ReportingRange = { start: "2026-10-01", end: "2026-10-31" };
const facilityId = customersMockFacility.id;
const statuses: BookingStatus[] = ["pendingConfirmation", "confirmed", "completed", "cancelled", "rejected", "noShow"];
function booking(overrides: Partial<CustomerBooking> = {}): CustomerBooking {
  return { id: "TEST-1", facilityId, customerId: "C01", petId: "P01", serviceName: "Dịch vụ mẫu", scheduledAt: "2026-10-10T09:00:00+07:00", status: "completed", ...overrides };
}
function withBookings(bookings: CustomerBooking[]): CustomersMockData { return { ...createCustomersMockData(), bookings }; }
function records(data = createCustomersMockData(), period = range, now = customersMockNow) { return buildCustomerRecords(data, facilityId, period, now); }

test("The default report counts distinct served customer and pet IDs at the current facility", () => {
  const result = records();
  assert.equal(result.length, 8);
  assert.deepEqual(summarizeCustomers(result, range), { servedCustomers: 5, returningCustomers: 2, servedPets: 6 });
});

test("Customers without bookings here are excluded, while all six booking statuses remain visible", () => {
  const data = createCustomersMockData();
  data.customers.push({ id: "UNBOOKED", name: "Chưa đặt lịch", email: "", phone: "" });
  const result = records(data);
  assert.ok(!result.some((record) => ["UNBOOKED", "C-OTHER"].includes(record.customer.id)));
  assert.deepEqual(new Set(result.flatMap((record) => record.bookings.map((item) => item.status))), new Set(statuses));
  for (const status of statuses) assert.equal(records(withBookings([booking({ status })])).length, 1);
});

test("A customer's history and pet profiles are limited to their own bookings at this facility", () => {
  const linh = records().find((record) => record.customer.id === "C01")!;
  assert.equal(linh.bookings.length, 8);
  assert.ok(linh.bookings.every((item) => item.facilityId === facilityId && item.customerId === "C01"));
  assert.deepEqual(linh.pets.map((pet) => pet.id), ["P01", "P02"]);
  assert.ok(!linh.pets.some((pet) => ["P-PRIVATE", "P-UNBOOKED"].includes(pet.id)));
});

test("Matching names never merge customer IDs or pet IDs", () => {
  const result = filterCustomers(records(), { query: "HA LINH", group: "all" });
  assert.deepEqual(result.map((record) => record.customer.id), ["C01", "C07"]);
  assert.equal(result[0].customer.name, result[1].customer.name);
  assert.equal(result[0].pets[0].name, result[1].pets[0].name);
  assert.deepEqual(summarizeCustomers(result, range), { servedCustomers: 2, returningCustomers: 1, servedPets: 3 });
  assert.equal(result[1].customer.email, "halinh.khac@example.com");
  assert.deepEqual(result[1].bookings.map((item) => item.id), ["KH-015"]);
});

test("Only Completed contributes to served KPIs and lifetime completion count", () => {
  for (const status of statuses) {
    const result = records(withBookings([booking({ status })]));
    const expected = status === "completed" ? 1 : 0;
    assert.equal(result[0].completedCount, expected);
    assert.deepEqual(summarizeCustomers(result, range), { servedCustomers: expected, returningCustomers: 0, servedPets: expected });
    assert.equal(result[0].group, expected ? "new" : "noCompleted");
  }
});

test("Reporting boundaries include local midnight and end of final day, excluding adjacent instants", () => {
  const dates = [
    ["2026-09-30T23:59:59.999+07:00", false],
    ["2026-09-30T17:00:00Z", true],
    ["2026-10-31T23:59:59.999+07:00", true],
    ["2026-10-31T17:00:00Z", false],
  ] as const;
  for (const [scheduledAt, included] of dates) {
    const result = records(withBookings([booking({ scheduledAt })]));
    assert.equal(summarizeCustomers(result, range).servedCustomers, included ? 1 : 0, scheduledAt);
  }
});

test("A one-day report covers the entire local day", () => {
  const singleDay = { start: "2026-10-01", end: "2026-10-01" };
  const data = withBookings([booking({ scheduledAt: "2026-10-01T23:59:59+07:00" })]);
  assert.equal(summarizeCustomers(records(data, singleDay), singleDay).servedCustomers, 1);
  assert.equal(reportingBounds(singleDay).endExclusive - reportingBounds(singleDay).start, 86_400_000);
});

test("Returning requires Completed before the first local day; exactly at the boundary is New", () => {
  const data = withBookings([booking({ scheduledAt: "2026-09-30T23:59:59.999+07:00" }), booking({ id: "IN-PERIOD", scheduledAt: "2026-10-01T00:00:00+07:00" })]);
  assert.equal(records(data)[0].group, "returning");
  data.bookings.shift();
  assert.equal(records(data)[0].group, "new");
  data.bookings.push(booking({ id: "SECOND-IN-PERIOD" }));
  assert.equal(records(data)[0].group, "new", "two Completed within the same period do not make a returning customer");
});

test("Prior non-Completed bookings and prior completions at another facility do not make Returning", () => {
  const data = withBookings([
    booking({ scheduledAt: "2026-09-20T09:00:00+07:00", status: "confirmed" }),
    booking({ id: "OTHER", facilityId: "OTHER", scheduledAt: "2026-09-01T09:00:00+07:00" }),
    booking({ id: "CURRENT" }),
  ]);
  assert.equal(records(data)[0].group, "new");
  assert.equal(summarizeCustomers(records(data), range).returningCustomers, 0);
});

test("Changing the period recalculates New/Returning and KPIs but preserves the entire customer list", () => {
  const september = { start: "2026-09-01", end: "2026-09-30" };
  const before = records(undefined, september);
  const after = records();
  assert.deepEqual(before.map((record) => record.customer.id), after.map((record) => record.customer.id));
  assert.equal(before[0].group, "new");
  assert.equal(after[0].group, "returning");
  assert.deepEqual(summarizeCustomers(before, september), { servedCustomers: 3, returningCustomers: 0, servedPets: 3 });
  const november = { start: "2026-11-01", end: "2026-11-30" };
  assert.equal(records(undefined, november)[0].group, "outsidePeriod");
});

test("Customers with no Completed are distinct from customers completed only outside the selected period", () => {
  const result = records();
  assert.equal(result.find((item) => item.customer.id === "C04")!.group, "noCompleted");
  assert.equal(result.find((item) => item.customer.id === "C05")!.group, "outsidePeriod");
  for (const group of ["new", "returning"] as const) {
    assert.ok(filterCustomers(result, { query: "", group }).every((item) => item.group === group));
  }
});

test("Lifetime count and most recent service ignore the reporting period and other statuses", () => {
  const result = records();
  const other = records(undefined, { start: "2026-01-01", end: "2026-01-31" });
  assert.deepEqual(result.map((item) => [item.completedCount, item.lastServedAt]), other.map((item) => [item.completedCount, item.lastServedAt]));
  assert.equal(result[0].completedCount, 3);
  assert.equal(result[0].lastServedAt, "2026-10-10T14:00:00+07:00");
  const noCompleted = result.find((item) => item.customer.id === "C04")!;
  assert.equal(noCompleted.completedCount, 0);
  assert.equal(noCompleted.lastServedAt, null);
});

test("Latest served time includes now exactly and never selects a future Completed slot", () => {
  const data = withBookings([
    booking({ id: "AT-NOW", scheduledAt: customersMockNow }),
    booking({ id: "FUTURE", scheduledAt: "2026-10-15T10:00:00.001+07:00" }),
  ]);
  assert.equal(records(data)[0].lastServedAt, customersMockNow);
  data.bookings.shift();
  assert.equal(records(data)[0].lastServedAt, null);
  assert.equal(records(data)[0].completedCount, 1, "lifetime count follows Completed status; the clock cap applies to the latest service time");
});

test("Pet KPI deduplicates by pet ID and excludes pets with only pending/confirmed bookings", () => {
  const data = withBookings([
    booking(), booking({ id: "REPEAT" }), booking({ id: "SECOND-PET", petId: "P02" }),
    booking({ id: "WAITING", customerId: "C02", petId: "P03", status: "confirmed" }),
    booking({ id: "OTHER", petId: "P-PRIVATE", facilityId: "OTHER" }),
  ]);
  assert.equal(summarizeCustomers(records(data), range).servedPets, 2);
  assert.deepEqual(records(data).find((item) => item.customer.id === "C02")!.pets.map((pet) => pet.id), ["P03"], "a pending pet is visible in the scoped profile but is not a served pet");
});

test("Search trims, ignores Vietnamese accents/case, handles Đ, and combines with the period group", () => {
  const result = records();
  assert.equal(filterCustomers(result, { query: "  DUC HUY ", group: "all" })[0].customer.id, "C06");
  assert.equal(filterCustomers(result, { query: "BAP", group: "returning" })[0].customer.id, "C02");
  assert.equal(filterCustomers(result, { query: "c07", group: "new" })[0].customer.id, "C07");
  assert.equal(filterCustomers(result, { query: "halinh", group: "all" }).length, 0);
  assert.equal(filterCustomers(result, { query: "MIU", group: "new" })[0].customer.id, "C07");
  assert.equal(filterCustomers(result, { query: "Thú cưng chỉ ở nơi khác", group: "all" }).length, 0);
});

test("Default month and display use Vietnam time across UTC month/year boundaries and leap February", () => {
  assert.deepEqual(currentMockMonth("2026-09-30T17:00:00Z"), range);
  assert.deepEqual(currentMockMonth("2026-12-31T18:00:00Z"), { start: "2027-01-01", end: "2027-01-31" });
  assert.deepEqual(currentMockMonth("2028-02-15T00:00:00Z"), { start: "2028-02-01", end: "2028-02-29" });
  assert.match(formatCustomerDateTime("2026-09-30T17:00:00Z"), /00:00.*01\/10\/2026/);
});

test("Invalid, missing, impossible, and reversed reporting dates are rejected without normalization", () => {
  for (const invalid of [
    { start: "", end: range.end }, { start: range.start, end: "" },
    { start: "2026-02-30", end: range.end }, { start: "2026-1-1", end: range.end },
    { start: range.end, end: range.start },
  ]) {
    assert.ok(validateReportingRange(invalid));
    assert.throws(() => reportingBounds(invalid));
  }
  assert.equal(validateReportingRange(range), null);
});

test("Empty data yields zero KPIs and derivation leaves source mock data unchanged", () => {
  const empty = records(createCustomersMockData(true));
  assert.deepEqual(empty, []);
  assert.deepEqual(summarizeCustomers(empty, range), { servedCustomers: 0, returningCustomers: 0, servedPets: 0 });
  const data = createCustomersMockData();
  const snapshot = JSON.stringify(data);
  const result = records(data);
  filterCustomers(result, { query: "", group: "all" });
  summarizeCustomers(result, range);
  assert.equal(JSON.stringify(data), snapshot);
  data.customers[0].name = "Changed";
  data.pets[0].name = "Changed";
  data.bookings[0].status = "cancelled";
  const fresh = createCustomersMockData();
  assert.equal(fresh.customers[0].name, "Hà Linh");
  assert.equal(fresh.pets[0].name, "Miu");
  assert.equal(fresh.bookings[0].status, "completed");
});
