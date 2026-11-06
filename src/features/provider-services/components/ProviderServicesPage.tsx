"use client";

import { vi, formatMessage } from "@/lib/locale";

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
    <div className={styles.providerTab}>{vi.provider.services.page.providerTab}</div>
    <header className={styles.intro}>
      <div><h1 id="services-title" tabIndex={-1}>{vi.provider.services.page.title}</h1><p>{formatMessage(vi.provider.services.page.description, { facilityName: "PawCare Studio" })}</p></div>
      <button type="button" className={styles.addButton} onClick={openCreate}>{vi.provider.services.page.addService}</button>
    </header>
    <ServicesSummary services={state.services} />
    <ServicesToolbar filters={filters} onChange={setFilters} />
    {!dialog && <ServicesFeedback feedback={state.feedback} focus={false} />}
    <ServicesList services={filterServices(state.services, filters)} total={state.services.length}
      onSelect={(id) => { clearFeedback(); setDialog({ type: "edit", id }); }} onCreate={openCreate} onClearFilters={() => setFilters({ query: "", status: "all" })} />
    <ServicesGuidance />
    <p className={styles.mockNote}>{vi.provider.services.page.mockNote}</p>
    <details className={styles.mockTools}>
      <summary>{vi.provider.services.mock.title}</summary>
      <p>{vi.provider.services.mock.description}</p>
      <div className={styles.scenarios}><button type="button" className={styles.softButton} onClick={() => resetScenario(true)}>{vi.provider.services.mock.empty}</button><button type="button" className={styles.softButton} onClick={() => resetScenario(false)}>{vi.provider.services.mock.restore}</button></div>
    </details>
    {dialog && <ServiceDialog key={dialog.type === "create" ? "create" : dialog.id} service={selected} categories={state.categories} onSubmit={submit} onClose={closeDialog} />}
  </div>;
}
