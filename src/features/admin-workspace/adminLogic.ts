import { matchesSearch, normalizeSearch } from "../../lib/search";
import type { AdminFilters, AdminRecord } from "./types";

export const defaultAdminFilters: AdminFilters = { query: "", group: "all", from: "", to: "" };

export function invalidAdminDateRange(filters: AdminFilters): boolean {
  return Boolean(filters.from && filters.to && filters.from > filters.to);
}

export function filterAdminRecords(records: readonly AdminRecord[], filters: AdminFilters): AdminRecord[] {
  if (invalidAdminDateRange(filters)) return [];
  const query = normalizeSearch(filters.query);
  return records.filter((record) =>
    (filters.group === "all" || record.tags.includes(filters.group)) &&
    matchesSearch(query, [record.id, record.title, ...record.cells]) &&
    (!filters.from || Boolean(record.date && record.date >= filters.from)) &&
    (!filters.to || Boolean(record.date && record.date <= filters.to)),
  );
}
