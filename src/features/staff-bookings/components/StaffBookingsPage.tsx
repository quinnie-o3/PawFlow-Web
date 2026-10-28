"use client";

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
      setClockError("Nhập ngày giờ hợp lệ theo Asia/Ho_Chi_Minh (UTC+7).");
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
    <div className={styles.staffTab}>NHÂN VIÊN · PAWCARE STUDIO</div>
    <div className={styles.intro}><div><h1>Lịch hẹn</h1><p>Lịch của PawCare Studio trong phạm vi nhân viên được phân công.</p></div>
      <button type="button" className={styles.permissionsButton} onClick={() => setShowPermissions(true)}><ShieldCheck size={18} aria-hidden="true" />Quyền Staff</button>
    </div>
    <p className={styles.mockNotice}>Dữ liệu mô phỏng trong phiên · Thời gian mô phỏng: {formatStaffBookingDate(new Date(state.now).toISOString())} · Asia/Ho_Chi_Minh (UTC+7). Tải lại hoặc rời trang sẽ mất thay đổi.</p>
    {state.result && <p role={state.result.outcome === "error" ? "alert" : "status"}
      className={state.result.outcome === "error" ? styles.operationError : styles.operationSuccess}>{state.result.message}</p>}
    <StaffBookingsToolbar filters={filters} onChange={setFilters} />
    <section className={styles.listCard} aria-labelledby="staff-bookings-title" aria-busy={state.phase === "loading"}>
      <div className={styles.listHeading}><h2 id="staff-bookings-title">Danh sách lịch hẹn</h2><p>Chọn một lịch để xem thông tin khách, thú cưng và trạng thái.</p></div>
      {state.phase === "loading" ? <p role="status" className={styles.feedback}><LoaderCircle size={22} aria-hidden="true" />Đang tải lịch hẹn…</p> : state.phase === "error" ?
        <div className={styles.error}><p role="alert"><AlertCircle size={20} aria-hidden="true" />Không thể tải danh sách lịch hẹn mô phỏng.</p><button type="button" className={styles.secondaryButton} onClick={retry}>Thử lại</button></div> :
        <StaffBookingsList bookings={visible} total={scoped.length} filtered={filtered} onOpen={openBooking} onClear={clearFilters} />}
      <p className={styles.listNote}>Chờ xác nhận → Đã xác nhận / Từ chối. Đã xác nhận → Hoàn thành / Không đến theo điều kiện thời gian. Lịch kết thúc chỉ xem kết quả.</p>
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
