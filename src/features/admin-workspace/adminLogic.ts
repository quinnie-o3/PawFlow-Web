import type { AdminFilters, AdminRecord } from "./types";

export const defaultAdminFilters: AdminFilters = { query: "", group: "all", from: "", to: "" };

export function normalizeAdminSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
}

export function invalidAdminDateRange(filters: AdminFilters): boolean {
  return Boolean(filters.from && filters.to && filters.from > filters.to);
}

export function filterAdminRecords(records: readonly AdminRecord[], filters: AdminFilters): AdminRecord[] {
  if (invalidAdminDateRange(filters)) return [];
  const query = normalizeAdminSearch(filters.query);
  return records.filter((record) =>
    (filters.group === "all" || record.tags.includes(filters.group)) &&
    (!query || normalizeAdminSearch([record.id, record.title, ...record.cells].join(" ")).includes(query)) &&
    (!filters.from || Boolean(record.date && record.date >= filters.from)) &&
    (!filters.to || Boolean(record.date && record.date <= filters.to)),
  );
}
