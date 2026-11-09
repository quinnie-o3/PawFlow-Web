import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogMock, MOCK_NOW } from "./data/catalogMock";
import { availabilityLabel, formatDateOnly, formatDuration, formatPrice, formatRating, hasAvailability, mockEligibility, moneyMinor, remaining, slotInstant, slotState, validDateOnly } from "./catalogLogic";

test("Money preserves zero, decimals, unknown values and invalid data", () => {
  assert.equal(moneyMinor(null), null); assert.equal(moneyMinor("NaN"), null); assert.equal(moneyMinor("-5"), null); assert.equal(moneyMinor("1.001"), null);
  assert.equal(moneyMinor("0.00"), 0); assert.equal(moneyMinor("250000.25"), 25000025);
  assert.match(formatPrice(null), /Chưa/); assert.match(formatPrice("0.00"), /0/); assert.match(formatPrice("250000.25"), /250\.000,25/);
});
test("Missing duration and rating never become zero", () => {
  const catalog = createCatalogMock();
  assert.equal(formatDuration(null), "Chưa có thời lượng"); assert.equal(formatDuration(60), "60 phút");
  assert.equal(formatRating(catalog.providers[5]), "Chưa có dữ liệu đánh giá"); assert.equal(formatRating(catalog.providers[6]), "Chưa có đánh giá");
});
test("Date-only is validated by the calendar and displayed without host timezone conversion", () => {
  assert.equal(validDateOnly("2026-02-29"), false); assert.equal(validDateOnly("2028-02-29"), true); assert.equal(validDateOnly("2026-11-04T00:00Z"), false);
  assert.equal(formatDateOnly("2026-11-04"), "04/11/2026"); assert.equal(formatDateOnly("bad"), "Chưa có ngày");
});
test("Slot instants use Vietnam offset and exclude started slots including at exact start", () => {
  const slot = createCatalogMock().slots[1];
  assert.equal(slotInstant(slot), Date.parse("2026-11-04T07:00:00Z")); assert.equal(slotState(slot, MOCK_NOW), "available");
  assert.equal(slotState(slot, "2026-11-04T07:00:00Z"), "past"); assert.equal(slotState({ ...slot, date: "2026-02-30" }, MOCK_NOW), "unknown");
});
test("Availability distinguishes past, full, closed and unknown capacity", () => {
  const data = createCatalogMock();
  assert.equal(slotState(data.slots[0], MOCK_NOW), "past"); assert.equal(slotState(data.slots[3], MOCK_NOW), "full"); assert.equal(slotState(data.slots[6], MOCK_NOW), "closed"); assert.equal(slotState(data.slots[8], MOCK_NOW), "unknown");
  assert.equal(remaining({ ...data.slots[1], booked: -1 }), null); assert.equal(remaining({ ...data.slots[1], booked: 10 }), null);
});
test("No published schedule differs from full schedule, unknown schedule and only past slots", () => {
  const data = createCatalogMock(); const svc = data.services[0];
  assert.match(availabilityLabel(svc, [], MOCK_NOW), /Chưa có lịch công bố/);
  assert.match(availabilityLabel(svc, [data.slots[0]], MOCK_NOW), /Chưa có lịch sắp tới/);
  assert.match(availabilityLabel(svc, [data.slots[3]], MOCK_NOW), /Hết chỗ/);
  assert.match(availabilityLabel({ ...svc, schedule: "unknown" }, [], MOCK_NOW), /Chưa biết lịch/);
  assert.match(availabilityLabel(svc, [data.slots[8]], MOCK_NOW), /Chưa biết số chỗ/);
});
test("Availability requires the same provider/service and known schedule", () => {
  const data = createCatalogMock(); const service = data.services[0];
  assert.equal(hasAvailability(data, service, MOCK_NOW), true);
  assert.equal(hasAvailability(data, { ...service, providerId: "wrong" }, MOCK_NOW), false);
  assert.equal(hasAvailability(data, { ...service, schedule: "unknown" }, MOCK_NOW), false);
  assert.equal(hasAvailability(data, service, "2026-11-06T00:00:00+07:00"), false);
});
test("Fixture species and missing pet affect explanation without hiding public details", () => {
  const data = createCatalogMock(); const catOnly = data.providers[2];
  assert.match(mockEligibility(catOnly, "dog"), /chưa phù hợp/); assert.match(mockEligibility(catOnly, "cat"), /phù hợp/); assert.match(mockEligibility(catOnly, "none"), /vẫn có thể xem/); assert.match(mockEligibility(data.providers[5], "dog"), /Chưa có thông tin/);
});
test("Fixtures are isolated per caller", () => { const one = createCatalogMock(); one.providers[0].name = "changed"; assert.equal(createCatalogMock().providers[0].name, "Pet House"); });

test("Vietnam midnight changes availability at the exact instant without shifting a date-only label", () => {
  const slot = { ...createCatalogMock().slots[1], date: "2026-11-05", start: "00:00", end: "01:00" };
  assert.equal(slotState(slot, "2026-11-04T16:59:59.999Z"), "available");
  assert.equal(slotState(slot, "2026-11-04T17:00:00.000Z"), "past");
  assert.equal(formatDateOnly(slot.date), "05/11/2026");
  assert.equal(slotState({ ...slot, end: "24:00" }, MOCK_NOW), "unknown");
  assert.equal(slotState({ ...slot, end: "00:00" }, MOCK_NOW), "unknown");
});
