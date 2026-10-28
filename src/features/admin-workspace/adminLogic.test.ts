import test from "node:test";
import assert from "node:assert/strict";
import { defaultAdminFilters, filterAdminRecords, invalidAdminDateRange, normalizeAdminSearch } from "./adminLogic";
import { records as users } from "../admin-users/data/mock";
import { records as providers } from "../admin-providers/data/mock";
import { records as categories } from "../admin-categories/data/mock";
import { records as logs } from "../admin-activity-logs/data/mock";

test("Vietnamese names can be found with accents, without accents, mixed case and whitespace", () => {
  for (const query of ["Hà Linh", "ha linh", "  HA   LINH "]) {
    assert.equal(filterAdminRecords(users, { ...defaultAdminFilters, query })[0]?.cells[0], "Hà Linh");
  }
  assert.equal(normalizeAdminSearch("ĐỖ ĐỨC"), "do duc");
});

test("Search and role/status filters intersect rather than replacing one another", () => {
  assert.equal(filterAdminRecords(users, { ...defaultAdminFilters, group: "owner", query: "halinh@example.com" }).length, 0);
  assert.equal(filterAdminRecords(users, { ...defaultAdminFilters, group: "owner", query: "dane@example.com" }).length, 1);
  assert.equal(filterAdminRecords(providers, { ...defaultAdminFilters, group: "pending" }).length, 4);
  assert.equal(filterAdminRecords(providers, { ...defaultAdminFilters, group: "rejected", query: "cozy" }).length, 1);
});

test("Category type and hidden status use explicit fixture tags", () => {
  assert.equal(filterAdminRecords(categories, { ...defaultAdminFilters, group: "pet" }).length, 3);
  assert.equal(filterAdminRecords(categories, { ...defaultAdminFilters, group: "hidden" })[0]?.id, "PET-05");
  assert.equal(filterAdminRecords(categories, { ...defaultAdminFilters, query: "sv-02" }).length, 1);
});

test("Log date boundaries include the full selected dates without timezone conversion", () => {
  assert.equal(filterAdminRecords(logs, { ...defaultAdminFilters, from: "2026-09-28", to: "2026-09-28" }).length, 2);
  assert.equal(filterAdminRecords(logs, { ...defaultAdminFilters, from: "2026-09-29" }).length, 3);
  assert.equal(filterAdminRecords(logs, { ...defaultAdminFilters, to: "2026-09-27" }).length, 1);
});

test("Log actor, state-change classification, query and dates compose", () => {
  const filtered = filterAdminRecords(logs, { query: "Dane", group: "status", from: "2026-09-28", to: "2026-09-29" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].cells[3], "PF-2083");
  assert.equal(filterAdminRecords(logs, { ...defaultAdminFilters, query: "LOG-184" }).length, 1);
});

test("Invalid ranges, missing dates, empty sources and unmatched queries return no rows", () => {
  const filters = { ...defaultAdminFilters, from: "2026-09-30", to: "2026-09-01" };
  assert.equal(invalidAdminDateRange(filters), true);
  assert.deepEqual(filterAdminRecords(logs, filters), []);
  assert.deepEqual(filterAdminRecords(users, { ...defaultAdminFilters, from: "2026-09-01" }), []);
  assert.deepEqual(filterAdminRecords([], defaultAdminFilters), []);
  assert.deepEqual(filterAdminRecords(users, { ...defaultAdminFilters, query: "không tồn tại" }), []);
});

test("Filtering leaves source rows and details unchanged", () => {
  const before = JSON.stringify(users);
  const result = filterAdminRecords(users, defaultAdminFilters);
  result.reverse();
  assert.equal(JSON.stringify(users), before);
  assert.notEqual(result, users);
});
