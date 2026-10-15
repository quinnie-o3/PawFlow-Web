import { useState, type FormEvent } from "react";
import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { availabilityCommandError, localDate } from "../availabilityLogic";
import type { AvailabilityCommand, AvailabilityState, DateException } from "../types";
import AvailabilityFeedback from "./AvailabilityFeedback";
import TimeRangeFields from "./TimeRangeFields";
import styles from "../availability.module.css";

export default function ExceptionDialog({ state, initial, blockDay, now, onSubmit, onClose }: {
  state: AvailabilityState; initial: DateException; blockDay: boolean; now: string;
  onSubmit: (command: AvailabilityCommand, simulateFailure: boolean) => boolean; onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [closed, setClosed] = useState(initial.ranges.length === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const existing = state.exceptions.find((item) => item.id === initial.id);
  const historical = !!existing && existing.date < localDate(now);
  function submit(event: FormEvent) {
    event.preventDefault();
    const command: AvailabilityCommand = { type: existing ? "updateException" : "createException", exception: { ...draft, ranges: closed ? [] : draft.ranges } };
    const issue = !closed && draft.ranges.length === 0 ? "Vui lòng thêm ít nhất một khoảng giờ nhận lịch." : availabilityCommandError(state, command, now);
    setError(issue ?? "");
    if (!issue) onSubmit(command, simulateFailure);
  }
  const deleteCommand: AvailabilityCommand = { type: "deleteException", exceptionId: initial.id };
  const deleteError = existing ? availabilityCommandError(state, deleteCommand, now) : null;
  return <DashboardDialog title={blockDay ? "Chặn ngày" : "Ngày ngoại lệ"} onClose={onClose}>
    <form className={styles.editorForm} noValidate onSubmit={submit}>
      <p className={styles.notice}>Asia/Ho_Chi_Minh · Một ngoại lệ mỗi ngày, thay thế toàn bộ giờ tuần. Xóa ngoại lệ sẽ dùng lại giờ tuần có hiệu lực.</p>
      {historical && <p className={styles.notice}>Dữ liệu lịch sử chỉ đọc; không được sửa hoặc xóa.</p>}
      <fieldset disabled={historical} className={styles.formFields}>
        <label className={styles.fieldLabel}>Ngày ngoại lệ<input type="date" min={localDate(now)} value={draft.date} disabled={!!existing} required onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        <label className={styles.fieldLabel}>Giờ nhận lịch<select value={closed ? "closed" : "custom"} onChange={(event) => setClosed(event.target.value === "closed")}>
          <option value="closed">Đóng cả ngày</option><option value="custom">Thay đổi giờ theo ngày</option>
        </select></label>
        {!closed && <TimeRangeFields label="Ngoại lệ" ranges={draft.ranges} onChange={(ranges) => setDraft({ ...draft, ranges })} />}
      </fieldset>
      <p className={styles.hint}>Mọi slot của ngày này đều phải nằm trong giờ mới. Không tự hủy hoặc chuyển booking.</p>
      <AvailabilityFeedback error={error} feedback={state.feedback} />
      {!historical && <><label className={styles.checkboxLabel}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} />Mô phỏng lỗi khi lưu</label>
        <button type="submit" className={styles.primaryButton}>Lưu ngoại lệ</button></>}
      {existing && <div className={styles.dangerArea}>
        <button type="button" className={styles.outlineButton} disabled={!!deleteError} aria-describedby={deleteError ? "delete-exception-reason" : undefined} onClick={() => setConfirmDelete(true)}>Xóa ngoại lệ</button>
        {deleteError && <p id="delete-exception-reason" className={styles.hint}>{deleteError}</p>}
        {confirmDelete && <div className={styles.confirmation}><p>Xóa ngoại lệ và quay về giờ tuần của ngày này?</p>
          <button type="button" className={styles.primaryButton} onClick={() => { if (onSubmit(deleteCommand, simulateFailure)) onClose(); }}>Xác nhận xóa ngoại lệ</button>
          <button type="button" className={styles.softButton} onClick={() => setConfirmDelete(false)}>Giữ ngoại lệ</button>
        </div>}
      </div>}
      <button type="button" className={styles.softButton} onClick={onClose}>Đóng</button>
    </form>
  </DashboardDialog>;
}
