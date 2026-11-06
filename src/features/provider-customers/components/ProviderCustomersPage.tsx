"use client";

import { vi, formatMessage } from "@/lib/locale";

import Link from "next/link";
import { formatCustomerDateTime } from "../customerLogic";
import { customersMockFacility, customersMockNow } from "../data/providerCustomersMock";
import { useCustomersMock } from "../useCustomersMock";
import CustomerDetailsDialog from "./CustomerDetailsDialog";
import CustomerProfile from "./CustomerProfile";
import CustomersList from "./CustomersList";
import CustomersReportingPeriod from "./CustomersReportingPeriod";
import CustomersSummary from "./CustomersSummary";
import CustomersToolbar from "./CustomersToolbar";
import styles from "../customers.module.css";

export default function ProviderCustomersPage() {
  const customers = useCustomersMock();
  function closeDialog() {
    customers.closeDialog();
    window.requestAnimationFrame(() => {
      if (document.activeElement === document.body) document.getElementById("customers-title")?.focus();
    });
  }
  return <div className={styles.page} lang="vi">
    <div className={styles.providerTab}>{vi.provider.customers.page.providerTab}</div>
    <header className={styles.intro}>
      <div><h1 id="customers-title" tabIndex={-1}>{vi.provider.customers.page.title}</h1><p>{formatMessage(vi.provider.customers.page.description, { facilityName: customersMockFacility.name })}</p></div>
      <Link href="/dashboard/bookings" className={styles.bookingLink}>{vi.provider.customers.page.bookings}</Link>
    </header>
    <p className={styles.mockNote}>{formatMessage(vi.provider.customers.mock.clock, { time: formatCustomerDateTime(customersMockNow) })}</p>
    <CustomersReportingPeriod range={customers.range} onApply={customers.setRange} />
    <CustomersSummary report={customers.report} />
    <CustomersToolbar filters={customers.filters} onChange={customers.setFilters} />
    <CustomersList records={customers.visibleRecords} total={customers.records.length} onSelect={customers.openCustomer}
      onClearFilters={() => customers.setFilters({ query: "", group: "all" })} />
    {customers.selected && <CustomerProfile record={customers.selected} onOpen={customers.openCustomer} />}
    <details className={styles.mockTools}>
      <summary>{vi.provider.customers.mock.title}</summary>
      <p>{vi.provider.customers.mock.note}</p>
      <div className={styles.scenarios}><button type="button" className={styles.softButton} onClick={() => customers.reset(true)}>{vi.provider.customers.mock.empty}</button><button type="button" className={styles.softButton} onClick={() => customers.reset(false)}>{vi.provider.customers.mock.restore}</button></div>
    </details>
    {customers.dialogOpen && customers.selected && <CustomerDetailsDialog record={customers.selected} onClose={closeDialog} />}
  </div>;
}
