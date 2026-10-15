import { useState, type FormEvent } from "react";
import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { availabilityCommandError, formatAvailabilityDate, localDate } from "../availabilityLogic";
import type { AvailabilityCommand, AvailabilityState, WeeklySchedule } from "../types";
import AvailabilityFeedback from "./AvailabilityFeedback";
import TimeRangeFields from "./TimeRangeFields";
import styles from "../availability.module.css";

export default function WeeklyHoursDialog({ state, initial, now, onSubmit, onClose }: {
  state: AvailabilityState; initial: WeeklySchedule; now: string;
  onSubmit: (command: AvailabilityCommand, simulateFailure: boolean) => boolean; onClose: () => void;
}) {
  const [days, setDays] = useState(() => initial.days.map((day) => ({ ...day, ranges: day.ranges.map((range) => ({ ...range })) })));
  const [effectiveFrom, setEffectiveFrom] = useState(initial.effectiveFrom < localDate(now) ? localDate(now) : initial.effectiveFrom);
  const [error, setError] = useState("");
  const [simulateFailure, setSimulateFailure] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    const command: AvailabilityCommand = { type: "saveWeekly", schedule: { effectiveFrom, days } };
    const issue = availabilityCommandError(state, command, now);
    setError(issue ?? "");
    if (!issue) onSubmit(command, simulateFailure);
  }
  return <DashboardDialog title="Chỉnh sửa giờ mở cửa" onClose={onClose}>
    <form className={styles.editorForm} noValidate onSubmit={submit}>
      <p className={styles.notice}>Asia/Ho_Chi_Minh · Giữ lịch sử trước ngày hiệu lực. Không tự sinh, xóa hoặc di chuyển slot.</p>
      <label className={styles.fieldLabel}>Ngày bắt đầu có hiệu lực<input type="date" min={localDate(now)} value={effectiveFrom} required onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
      {state.schedules.some((schedule) => schedule.effectiveFrom === effectiveFrom) && <p className={styles.hint}>Đã có cấu hình từ {formatAvailabilityDate(effectiveFrom)}. Lưu sẽ cập nhật cấu hình của mốc này.</p>}
      {days.map((day, index) => <fieldset className={styles.dayFieldset} key={day.weekday}>
        <legend>{day.label}</legend>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={day.ranges.length > 0} onChange={(event) => setDays(days.map((item, i) => i !== index ? item : { ...item, ranges: event.target.checked ? [{ start: "", end: "" }] : [] }))} />Nhận lịch {day.label}</label>
        {day.ranges.length > 0 && <TimeRangeFields label={day.label} ranges={day.ranges} onChange={(ranges) => setDays(days.map((item, i) => i === index ? { ...item, ranges } : item))} />}
      </fieldset>)}
      <AvailabilityFeedback error={error} feedback={state.feedback} />
      <label className={styles.checkboxLabel}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} />Mô phỏng lỗi khi lưu</label>
      <div className={styles.formActions}><button type="submit" className={styles.primaryButton}>Lưu giờ mở cửa</button><button type="button" className={styles.softButton} onClick={onClose}>Đóng</button></div>
    </form>
  </DashboardDialog>;
}
