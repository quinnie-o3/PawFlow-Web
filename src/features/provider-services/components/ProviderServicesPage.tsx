"use client";

import { useState } from "react";
import { filterServices } from "../serviceLogic";
import { useServicesMock } from "../useServicesMock";
import type { ServiceFilters } from "../types";
import ServiceDialog from "./ServiceDialog";
import ServicesFeedback from "./ServicesFeedback";
import ServicesGuidance from "./ServicesGuidance";
import ServicesList from "./ServicesList";
import ServicesSummary from "./ServicesSummary";
import ServicesToolbar from "./ServicesToolbar";
import styles from "../services.module.css";

export default function ProviderServicesPage() {
  const { state, submit, reset, clearFeedback } = useServicesMock();
  const [filters, setFilters] = useState<ServiceFilters>({ query: "", status: "all" });
  const [dialog, setDialog] = useState<{ type: "create" } | { type: "edit"; id: string } | null>(null);
  const selected = dialog?.type === "edit" ? state.services.find((service) => service.id === dialog.id) : undefined;

  function openCreate() { clearFeedback(); setDialog({ type: "create" }); }
  function closeDialog() {
    setDialog(null);
    window.requestAnimationFrame(() => { if (document.activeElement === document.body) document.getElementById("services-title")?.focus(); });
  }
  function resetScenario(empty: boolean) { reset(empty); setFilters({ query: "", status: "all" }); }

  return <div className={styles.page} lang="vi">
    <div className={styles.providerTab}>DÀNH CHO PROVIDER</div>
    <header className={styles.intro}>
      <div><h1 id="services-title" tabIndex={-1}>Dịch vụ</h1><p>Quản lý dịch vụ khách có thể chọn khi đặt lịch tại PawCare Studio</p></div>
      <button type="button" className={styles.addButton} onClick={openCreate}>Thêm dịch vụ</button>
    </header>
    <ServicesSummary services={state.services} />
    <ServicesToolbar filters={filters} onChange={setFilters} />
    {!dialog && <ServicesFeedback feedback={state.feedback} focus={false} />}
    <ServicesList services={filterServices(state.services, filters)} total={state.services.length}
      onSelect={(id) => { clearFeedback(); setDialog({ type: "edit", id }); }} onCreate={openCreate} onClearFilters={() => setFilters({ query: "", status: "all" })} />
    <ServicesGuidance />
    <p className={styles.mockNote}>Dữ liệu mô phỏng · Chủ cơ sở. Thay đổi chỉ lưu trong lần mở trang này; tải lại hoặc rời trang sẽ khôi phục mẫu.</p>
    <details className={styles.mockTools}>
      <summary>Dữ liệu mô phỏng và trạng thái rỗng</summary>
      <p>Dữ liệu dịch vụ, danh mục và các khung giờ minh họa được quản lý riêng trong màn này. Khôi phục mẫu hoặc thử danh sách rỗng sẽ thay thế các thay đổi hiện tại.</p>
      <div className={styles.scenarios}><button type="button" className={styles.softButton} onClick={() => resetScenario(true)}>Thử danh sách rỗng</button><button type="button" className={styles.softButton} onClick={() => resetScenario(false)}>Khôi phục mẫu</button></div>
    </details>
    {dialog && <ServiceDialog key={dialog.type === "create" ? "create" : dialog.id} service={selected} categories={state.categories} onSubmit={submit} onClose={closeDialog} />}
  </div>;
}
