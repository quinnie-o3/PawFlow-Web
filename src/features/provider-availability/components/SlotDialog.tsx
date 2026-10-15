import { useState, type FormEvent } from "react";
import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { availabilityCommandError, dateError, effectiveHours, formatAvailabilityDate, formatRanges, heldSeats, isHistorical, localDate } from "../availabilityLogic";
import type { AvailabilityCommand, AvailabilitySlot, AvailabilityState } from "../types";
import AvailabilityFeedback from "./AvailabilityFeedback";
import styles from "../availability.module.css";

export default function SlotDialog({ initial, state, now, onSubmit, onClose }: {
  initial: AvailabilitySlot; state: AvailabilityState; now: string;
  onSubmit: (command: AvailabilityCommand, simulateFailure: boolean) => boolean; onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [capacity, setCapacity] = useState(String(initial.capacity));
  const [error, setError] = useState("");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [confirm, setConfirm] = useState<"closeSlot" | "deleteSlot" | null>(null);
  const existing = state.slots.find((slot) => slot.id === initial.id);
  const held = heldSeats(initial.id, state.reservations);
  const historical = !!existing && isHistorical(existing, now);
  const protectedFields = historical || held > 0;
  const service = state.services.find((item) => item.id === draft.serviceId);
  function submit(event: FormEvent) {
    event.preventDefault();
    const command: AvailabilityCommand = { type: existing ? "updateSlot" : "createSlot", slot: { ...draft, capacity: capacity.trim() ? Number(capacity) : NaN } };
    const issue = availabilityCommandError(state, command, now);
    setError(issue ?? "");
    if (!issue) onSubmit(command, simulateFailure);
  }
  function destructiveCommand(type: "closeSlot" | "deleteSlot"): AvailabilityCommand { return { type, slotId: initial.id }; }
  return <DashboardDialog title={existing ? `Quản lý slot ${formatAvailabilityDate(existing.date)} ${existing.start}` : "Tạo slot thủ công"} onClose={onClose}>
    <form className={styles.editorForm} noValidate onSubmit={submit}>
      <p className={styles.notice}>Mỗi slot thuộc một dịch vụ, có sức chứa riêng. Không chia sẻ sức chứa giữa dịch vụ hoặc nhân viên.</p>
      {historical && <p className={styles.notice}>Slot đã bắt đầu hoặc thuộc lịch sử; chỉ được xem.</p>}
      {!!held && <p className={styles.notice}>Đang giữ {held} chỗ (Chờ xác nhận + Đã xác nhận). {historical ? "Dữ liệu lịch sử chỉ đọc." : "Chỉ được sửa sức chứa, tối thiểu bằng số chỗ đang giữ."}</p>}
      <fieldset disabled={protectedFields} className={styles.formFields}>
        <label className={styles.fieldLabel}>Dịch vụ<select value={draft.serviceId} required onChange={(event) => setDraft({ ...draft, serviceId: event.target.value })}>
          <option value="">Chọn dịch vụ</option>{state.services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.durationMinutes} phút</option>)}
        </select></label>
        <label className={styles.fieldLabel}>Ngày<input type="date" value={draft.date} min={localDate(now)} required onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        <div className={styles.rangeRow}>
          <label>Bắt đầu<input type="time" aria-label="Giờ bắt đầu slot" value={draft.start} required onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
          <label>Kết thúc<input type="time" aria-label="Giờ kết thúc slot" value={draft.end} required onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
        </div>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={draft.open} onChange={(event) => setDraft({ ...draft, open: event.target.checked })} />Mở nhận lịch</label>
      </fieldset>
      <p className={styles.hint}>{service ? `Độ dài slot phải bằng ${service.durationMinutes} phút. ` : ""}Giờ có hiệu lực: {!dateError(draft.date) ? formatRanges(effectiveHours(state, draft.date)) : "Chưa chọn ngày"} (Asia/Ho_Chi_Minh).</p>
      <label className={styles.fieldLabel}>Sức chứa<input type="number" min={Math.max(1, held)} step="1" value={capacity} disabled={historical} required onChange={(event) => setCapacity(event.target.value)} /></label>
      {existing && <p className={styles.hint}>{held}/{existing.capacity} chỗ đang giữ{held >= existing.capacity ? " · Hết chỗ, không nhận booking mới" : ""}.</p>}
      <AvailabilityFeedback error={error} feedback={state.feedback} />
      {!historical && <><label className={styles.checkboxLabel}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} />Mô phỏng lỗi khi lưu</label>
        <button type="submit" className={styles.primaryButton}>Lưu slot</button></>}
      {existing && <div className={styles.dangerArea}>
        <div className={styles.formActions}>{(["closeSlot", "deleteSlot"] as const).map((type) => {
          const reason = availabilityCommandError(state, destructiveCommand(type), now);
          return <div key={type}><button type="button" className={styles.outlineButton} disabled={!!reason || (type === "closeSlot" && !existing.open)} aria-describedby={`${type}-reason`} onClick={() => { setConfirm(type); setError(""); }}>{type === "closeSlot" ? "Đóng slot" : "Xóa slot"}</button>
            <p id={`${type}-reason`} className={styles.hint}>{reason ?? (type === "closeSlot" && !existing.open ? "Slot đã đóng." : "Chỉ áp dụng khi không còn booking giữ chỗ.")}</p></div>;
        })}</div>
        {confirm && <div className={styles.confirmation}><p>{confirm === "deleteSlot" ? "Xóa" : "Đóng"} slot {formatAvailabilityDate(existing.date)} {existing.start}?</p>
          <button type="button" className={styles.primaryButton} onClick={() => {
            if (onSubmit(destructiveCommand(confirm), simulateFailure)) {
              setConfirm(null);
              if (confirm === "deleteSlot") onClose(); else setDraft({ ...draft, open: false });
            }
          }}>Xác nhận {confirm === "deleteSlot" ? "xóa" : "đóng"} slot</button>
          <button type="button" className={styles.softButton} onClick={() => setConfirm(null)}>Giữ slot</button>
        </div>}
      </div>}
      {existing && <details className={styles.reservations}><summary>Booking mô phỏng trong slot</summary>
        <p>Chỉ Chờ xác nhận (Pending Confirmation) và Đã xác nhận (Confirmed) chiếm chỗ; mỗi booking một chỗ.</p>
        <ul>{state.reservations.filter((item) => item.slotId === initial.id).map((item) => <li key={item.id}>{item.id} · {item.status}</li>)}</ul>
        {!state.reservations.some((item) => item.slotId === initial.id) && <p>Chưa có booking.</p>}
      </details>}
      <button type="button" className={styles.softButton} onClick={onClose}>Đóng</button>
    </form>
  </DashboardDialog>;
}
