"use client";

import { useReducer, useState } from "react";
import Link from "next/link";
import { availabilityCommandError, availabilityReducer, formatAvailabilityDate, formatRanges, localDate, upcomingSlots, weeklyHours } from "../availabilityLogic";
import { availabilityMockNow, createAvailabilityMock } from "../data/providerAvailabilityMock";
import type { AvailabilityCommand, AvailabilitySlot, DateException, WeeklySchedule } from "../types";
import AvailabilitySummary from "./AvailabilitySummary";
import ExceptionList from "./ExceptionList";
import UpcomingSlots from "./UpcomingSlots";
import WeeklyScheduleView from "./WeeklySchedule";
import WeeklyHoursDialog from "./WeeklyHoursDialog";
import ExceptionDialog from "./ExceptionDialog";
import SlotDialog from "./SlotDialog";
import SlotsDialog from "./SlotsDialog";
import styles from "../availability.module.css";

type Dialog = { type: "weekly"; schedule: WeeklySchedule } | { type: "exception"; initial: DateException; blockDay: boolean } | { type: "slot"; initial: AvailabilitySlot } | { type: "slots" } | null;

export default function ProviderAvailabilityPage() {
  const [state, dispatch] = useReducer(availabilityReducer, false, createAvailabilityMock);
  const [dialog, setDialog] = useState<Dialog>(null);
  const now = availabilityMockNow;
  const today = localDate(now);
  const currentDays = weeklyHours(state, today);
  const activeSchedule = [...state.schedules].filter((schedule) => schedule.effectiveFrom <= today).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

  function openDialog(next: Dialog) { dispatch({ type: "clearFeedback" }); setDialog(next); }
  function closeDialog() {
    setDialog(null);
    // Shared dialog restores its trigger; a deleted row or replaced modal needs a fallback.
    window.requestAnimationFrame(() => { if (document.activeElement === document.body) document.getElementById("availability-title")?.focus(); });
  }
  function submit(command: AvailabilityCommand, simulateFailure: boolean) {
    const valid = !availabilityCommandError(state, command, now) && !simulateFailure;
    dispatch({ type: "command", command, now, simulateFailure });
    return valid;
  }
  function selectSlot(id: string) {
    const slot = state.slots.find((item) => item.id === id);
    if (slot) openDialog({ type: "slot", initial: slot });
  }
  function createSlot() {
    openDialog({ type: "slot", initial: { id: `mock-${crypto.randomUUID()}`, serviceId: "", date: today, start: "", end: "", capacity: 1, open: true } });
  }
  function createException(blockDay: boolean) {
    openDialog({ type: "exception", initial: { id: `mock-${crypto.randomUUID()}`, date: "", ranges: [] }, blockDay });
  }

  return <div className={styles.page}>
    <div className={styles.providerTab}>DÀNH CHO PROVIDER</div>
    <div className={styles.intro}>
      <div><h1 id="availability-title" tabIndex={-1}>Lịch khả dụng</h1><p>Thiết lập khung giờ để khách có thể đặt lịch phù hợp</p></div>
      <button type="button" className={styles.blockButton} onClick={() => createException(true)}>Chặn ngày</button>
    </div>
    <AvailabilitySummary state={state} />
    {state.feedback && !dialog && <p role={state.feedback.outcome === "error" ? "alert" : "status"} className={state.feedback.outcome === "error" ? styles.error : styles.success}>{state.feedback.message}</p>}
    <div className={styles.scheduleGrid}>
      <WeeklyScheduleView days={currentDays} />
      <ExceptionList now={now} exceptions={state.exceptions} onEdit={(exception) => openDialog({ type: "exception", initial: exception, blockDay: false })} onAdd={() => createException(false)} />
    </div>
    <div className={styles.rulesGrid}>
      <section className={styles.card} aria-labelledby="booking-rules-title">
        <h2 id="booking-rules-title">Quy tắc nhận lịch</h2>
        <p>Thời lượng mỗi lượt: theo từng dịch vụ</p><p>Số chỗ trong cùng khung: theo năng lực cơ sở</p><p>Ngày đóng: không tạo slot mới để khách chọn</p>
        <button type="button" className={styles.textButton} onClick={() => openDialog({ type: "weekly", schedule: activeSchedule })}>Chỉnh sửa giờ mở cửa</button>
        <nav className={styles.slotActions} aria-label="Thông tin liên quan đến lịch khả dụng">
          <Link href="/dashboard/services" prefetch={false} className={styles.textButton}>Xem dịch vụ</Link>
          <Link href="/dashboard/profile" prefetch={false} className={styles.textButton}>Hồ sơ cơ sở</Link>
        </nav>
      </section>
      <UpcomingSlots slots={upcomingSlots(state, now)} reservations={state.reservations} onSelect={selectSlot} onShowAll={() => openDialog({ type: "slots" })} />
    </div>
    <div className={styles.slotActions}><button type="button" className={styles.outlineButton} onClick={createSlot}>Tạo slot thủ công</button><button type="button" className={styles.outlineButton} onClick={() => openDialog({ type: "slots" })}>Quản lý slot ({state.slots.length})</button></div>
    <details className={styles.history}>
      <summary>Lịch sử giờ tuần ({state.schedules.length}) · đang áp dụng từ {formatAvailabilityDate(activeSchedule.effectiveFrom)}</summary>
      {state.schedules.map((schedule) => <details key={schedule.effectiveFrom}>
        <summary>Từ {formatAvailabilityDate(schedule.effectiveFrom)}{schedule.effectiveFrom > today ? " · sắp có hiệu lực" : ""}</summary>
        <ul>{schedule.days.map((day) => <li key={day.weekday}>{day.label}: {formatRanges(day.ranges)}</li>)}</ul>
        {schedule.effectiveFrom >= today && <button type="button" className={styles.textButton} onClick={() => openDialog({ type: "weekly", schedule })}>Sửa cấu hình từ {formatAvailabilityDate(schedule.effectiveFrom)}</button>}
      </details>)}
    </details>
    <div className={styles.mockNote}>
      <p>Dữ liệu mô phỏng · Provider Owner · Đồng hồ cố định: 15/10/2026 10:00 (Asia/Ho_Chi_Minh).</p>
      <p>Chỉ lưu trong phiên mở trang; tải lại hoặc rời trang sẽ mất thay đổi. Booking độc lập với FE-007, chưa đồng bộ API. Mỗi booking giữ một chỗ; chưa hỗ trợ nguồn lực dùng chung.</p>
    </div>
    <details className={styles.mockTools}>
      <summary>Dữ liệu mô phỏng và trạng thái rỗng</summary>
      <p>Khôi phục mẫu hoặc thử không có slot/ngoại lệ sẽ thay thế dữ liệu phiên hiện tại.</p>
      <div className={styles.slotActions}><button type="button" className={styles.softButton} onClick={() => dispatch({ type: "reset", state: createAvailabilityMock(true) })}>Thử dữ liệu rỗng</button><button type="button" className={styles.softButton} onClick={() => dispatch({ type: "reset", state: createAvailabilityMock() })}>Khôi phục mẫu</button></div>
    </details>

    {dialog?.type === "weekly" && <WeeklyHoursDialog state={state} initial={dialog.schedule} now={now} onSubmit={submit} onClose={closeDialog} />}
    {dialog?.type === "exception" && <ExceptionDialog state={state} initial={dialog.initial} blockDay={dialog.blockDay} now={now} onSubmit={submit} onClose={closeDialog} />}
    {dialog?.type === "slot" && <SlotDialog state={state} initial={dialog.initial} now={now} onSubmit={submit} onClose={closeDialog} />}
    {dialog?.type === "slots" && <SlotsDialog state={state} now={now} onSelect={selectSlot} onCreate={createSlot} onClose={closeDialog} />}
  </div>;
}
