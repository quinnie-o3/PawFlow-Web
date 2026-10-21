"use client";

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
    <div className={styles.providerTab}>DÀNH CHO PROVIDER</div>
    <header className={styles.intro}>
      <div><h1 id="customers-title" tabIndex={-1}>Khách hàng</h1><p>Chỉ hiển thị khách đã phát sinh lịch với {customersMockFacility.name}</p></div>
      <Link href="/dashboard/bookings" className={styles.bookingLink}>Lịch hẹn</Link>
    </header>
    <p className={styles.mockNote}>Dữ liệu mô phỏng · Chủ cơ sở · Đồng hồ mô phỏng: {formatCustomerDateTime(customersMockNow)} · Asia/Ho_Chi_Minh</p>
    <CustomersReportingPeriod range={customers.range} onApply={customers.setRange} />
    <CustomersSummary report={customers.report} />
    <CustomersToolbar filters={customers.filters} onChange={customers.setFilters} />
    <CustomersList records={customers.visibleRecords} total={customers.records.length} onSelect={customers.openCustomer}
      onClearFilters={() => customers.setFilters({ query: "", group: "all" })} />
    {customers.selected && <CustomerProfile record={customers.selected} onOpen={customers.openCustomer} />}
    <details className={styles.mockTools}>
      <summary>Dữ liệu mô phỏng và trạng thái rỗng</summary>
      <p>Mock riêng của Khách hàng, chưa API, không đồng bộ với Lịch hẹn hoặc module khác. Tải lại hoặc rời trang khôi phục dữ liệu và kỳ mặc định. Khách trùng tên được phân biệt bằng mã khách hàng.</p>
      <div className={styles.scenarios}><button type="button" className={styles.softButton} onClick={() => customers.reset(true)}>Thử danh sách rỗng</button><button type="button" className={styles.softButton} onClick={() => customers.reset(false)}>Khôi phục mẫu</button></div>
    </details>
    {customers.dialogOpen && customers.selected && <CustomerDetailsDialog record={customers.selected} onClose={closeDialog} />}
  </div>;
}
