"use client";

import { vi, formatMessage } from "@/lib/locale";

import { useState } from "react";
import { AlertCircle, LoaderCircle, ShieldCheck } from "lucide-react";
import { mockStaffContext } from "../data/staffBookingsMock";
import { filterStaffBookings, findStaffBooking, formatStaffBookingDate, formatStaffMockTime, parseStaffMockTime, scopeStaffBookings } from "../staffBookingLogic";
import { useStaffBookingsMock } from "../hooks/useStaffBookingsMock";
import { staffMockNow } from "../staffBookingSession";
import type { StaffBookingFilters, StaffMockScenario } from "../types";
import StaffBookingDetails from "./StaffBookingDetails";
import StaffBookingsList from "./StaffBookingsList";
import StaffBookingsToolbar from "./StaffBookingsToolbar";
import StaffPermissionsDialog from "./StaffPermissionsDialog";
import StaffMockTools from "./StaffMockTools";
import StaffBookingAudit from "./StaffBookingAudit";
import styles from "../staffBookings.module.css";

export default function StaffBookingsPage() {
  const { state, dispatch, load, retry, reset, submit } = useStaffBookingsMock();
  const [filters, setFilters] = useState<StaffBookingFilters>({ query: "", status: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [clockInput, setClockInput] = useState(formatStaffMockTime(staffMockNow));
  const [clockError, setClockError] = useState("");
  const processing = state.pendingCommand !== null;
  const scoped = scopeStaffBookings(state.bookings, mockStaffContext);
  const visible = filterStaffBookings(state.bookings, mockStaffContext, filters);
  const selected = selectedId ? findStaffBooking(state.bookings, mockStaffContext, selectedId) : undefined;
  const filtered = filters.query.trim() !== "" || filters.status !== "all";

  function clearFilters() { setFilters({ query: "", status: "all" }); }
  function simulate(scenario: StaffMockScenario) {
    setSelectedId(null);
    clearFilters();
    load(scenario);
  }

  function restore() {
    setSelectedId(null);
    setShowPermissions(false);
    clearFilters();
    setClockInput(formatStaffMockTime(staffMockNow));
    setClockError("");
    reset();
  }

  function applyClock() {
    const now = parseStaffMockTime(clockInput);
    if (!Number.isFinite(now)) {
      setClockError(vi.staff.bookings.page.invalidMockTime);
      return;
    }
    setClockError("");
    dispatch({ type: "clock", now });
  }

  function openBooking(id: string) {
    dispatch({ type: "clearResult" });
    setSelectedId(id);
  }

  return <div className={styles.page}>
    <div className={styles.staffTab}>{formatMessage(vi.staff.bookings.page.roleTab, { facility: "PAWCARE STUDIO" })}</div>
    <div className={styles.intro}><div><h1>{vi.staff.bookings.page.title}</h1><p>{formatMessage(vi.staff.bookings.page.description, { facility: "PawCare Studio" })}</p></div>
      <button type="button" className={styles.permissionsButton} onClick={() => setShowPermissions(true)}><ShieldCheck size={18} aria-hidden="true" />{vi.staff.bookings.page.permissions}</button>
    </div>
    <p className={styles.mockNotice}>{formatMessage(vi.staff.bookings.page.mockNotice, { time: formatStaffBookingDate(new Date(state.now).toISOString()) })}</p>
    {state.result && <p role={state.result.outcome === "error" ? "alert" : "status"}
      className={state.result.outcome === "error" ? styles.operationError : styles.operationSuccess}>{state.result.message}</p>}
    <StaffBookingsToolbar filters={filters} onChange={setFilters} />
    <section className={styles.listCard} aria-labelledby="staff-bookings-title" aria-busy={state.phase === "loading"}>
      <div className={styles.listHeading}><h2 id="staff-bookings-title">{vi.staff.bookings.page.listTitle}</h2><p>{vi.staff.bookings.page.listDescription}</p></div>
      {state.phase === "loading" ? <p role="status" className={styles.feedback}><LoaderCircle size={22} aria-hidden="true" />{vi.staff.bookings.page.loading}</p> : state.phase === "error" ?
        <div className={styles.error}><p role="alert"><AlertCircle size={20} aria-hidden="true" />{vi.staff.bookings.page.loadError}</p><button type="button" className={styles.secondaryButton} onClick={retry}>{vi.common.actions.retry}</button></div> :
        <StaffBookingsList bookings={visible} total={scoped.length} filtered={filtered} onOpen={openBooking} onClear={clearFilters} />}
      <p className={styles.listNote}>{vi.staff.bookings.page.transitionRules}</p>
    </section>
    <StaffBookingAudit logs={state.logs} />
    <StaffMockTools clockInput={clockInput} clockError={clockError} simulateFailure={state.simulateFailure} disabled={processing}
      onClockInputChange={(value) => { setClockInput(value); setClockError(""); }} onApplyClock={applyClock}
      onFailureChange={(enabled) => dispatch({ type: "failure", enabled })} onScenario={simulate} onReset={restore} />
    {selected && <StaffBookingDetails key={selected.id} booking={selected} now={state.now} processing={processing}
      result={state.result?.bookingId === selected.id ? state.result : null}
      onStartAction={() => dispatch({ type: "clearResult" })} onSubmit={submit} onClose={() => { if (!processing) setSelectedId(null); }} />}
    {showPermissions && <StaffPermissionsDialog onClose={() => setShowPermissions(false)} />}
  </div>;
}
