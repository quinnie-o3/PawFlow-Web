"use client";

import { useMemo, useState } from "react";
import { createCustomersMockData, customersMockFacility, customersMockNow } from "./data/providerCustomersMock";
import { buildCustomerRecords, currentMockMonth, filterCustomers, summarizeCustomers } from "./customerLogic";
import type { CustomerFilters, ReportingRange } from "./types";

export function useCustomersMock() {
  const [data, setData] = useState(createCustomersMockData);
  const [range, setRange] = useState<ReportingRange>(() => currentMockMonth(customersMockNow));
  const [filters, setFilters] = useState<CustomerFilters>({ query: "", group: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const records = useMemo(() => buildCustomerRecords(data, customersMockFacility.id, range, customersMockNow), [data, range]);
  const report = useMemo(() => summarizeCustomers(records, range), [records, range]);
  const visibleRecords = useMemo(() => filterCustomers(records, filters), [records, filters]);
  const selected = records.find((record) => record.customer.id === selectedId) ?? records[0];

  function openCustomer(id: string) {
    if (!records.some((record) => record.customer.id === id)) return;
    setSelectedId(id);
    setDialogOpen(true);
  }
  function reset(empty: boolean) {
    setDialogOpen(false);
    setSelectedId(null);
    setData(createCustomersMockData(empty));
    setFilters({ query: "", group: "all" });
  }
  return { records, visibleRecords, report, range, setRange, filters, setFilters, selected, openCustomer, dialogOpen, closeDialog: () => setDialogOpen(false), reset };
}
