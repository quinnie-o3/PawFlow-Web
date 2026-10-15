import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { formatAvailabilityDate, heldSeats, isHistorical, slotStart } from "../availabilityLogic";
import type { AvailabilityState } from "../types";
import styles from "../availability.module.css";

export default function SlotsDialog({ state, now, onSelect, onCreate, onClose }: {
  state: AvailabilityState; now: string; onSelect: (id: string) => void; onCreate: () => void; onClose: () => void;
}) {
  return <DashboardDialog title="Quản lý slot" onClose={onClose}>
    <div className={styles.editorForm}>
      <p className={styles.notice}>Slot tạo thủ công · Asia/Ho_Chi_Minh. Không tự sinh từ giờ tuần.</p>
      <button type="button" className={styles.primaryButton} onClick={onCreate}>Tạo slot thủ công</button>
      {state.slots.length === 0 ? <p className={styles.empty}>Chưa có slot. Tạo slot thủ công để bắt đầu.</p> : <ul className={styles.slotList}>
        {[...state.slots].sort((a, b) => slotStart(a) - slotStart(b)).map((slot) => {
          const held = heldSeats(slot.id, state.reservations);
          return <li key={slot.id}><button type="button" onClick={() => onSelect(slot.id)} aria-label={`Xem slot ${slot.id}`}>
            <strong>{formatAvailabilityDate(slot.date)} · {slot.start}–{slot.end}</strong>
            <span>{state.services.find((item) => item.id === slot.serviceId)?.name} · {held}/{slot.capacity} chỗ</span>
            <small>{isHistorical(slot, now) ? "Lịch sử · chỉ đọc" : !slot.open ? "Đã đóng" : held >= slot.capacity ? "Hết chỗ · không nhận lịch mới" : "Đang mở · còn chỗ"}</small>
          </button></li>;
        })}
      </ul>}
    </div>
  </DashboardDialog>;
}
