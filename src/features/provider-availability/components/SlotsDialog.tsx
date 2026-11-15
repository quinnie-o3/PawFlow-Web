import { vi, formatMessage } from "@/lib/locale";
import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { formatAvailabilityDate, heldSeats, isHistorical, slotStart } from "../availabilityLogic";
import type { AvailabilityState } from "../types";
import styles from "../availability.module.css";

export default function SlotsDialog({ state, now, onSelect, onCreate, onClose }: {
  state: AvailabilityState; now: string; onSelect: (id: string) => void; onCreate: () => void; onClose: () => void;
}) {
  return <DashboardDialog title={vi.provider.availability.slots.title} onClose={onClose}>
    <div className={styles.editorForm}>
      <p className={styles.notice}>{vi.provider.availability.slots.note}</p>
      <button type="button" className={styles.primaryButton} onClick={onCreate}>{vi.provider.availability.slot.create}</button>
      {state.slots.length === 0 ? <p className={styles.empty}>{vi.provider.availability.slots.empty}</p> : <ul className={styles.slotList}>
        {[...state.slots].sort((a, b) => slotStart(a) - slotStart(b)).map((slot) => {
          const held = heldSeats(slot.id, state.reservations);
          return <li key={slot.id}><button type="button" onClick={() => onSelect(slot.id)} aria-label={formatMessage(vi.provider.availability.slots.viewLabel, { slotId: slot.id })}>
            <strong>{formatAvailabilityDate(slot.date)} · {slot.start}–{slot.end}</strong>
            <span>{formatMessage(vi.provider.availability.slots.summary, { serviceName: state.services.find((item) => item.id === slot.serviceId)?.name ?? "", held, capacity: slot.capacity })}</span>
            <small>{isHistorical(slot, now) ? vi.provider.availability.labels.historical : !slot.open ? vi.provider.availability.slots.closed : held >= slot.capacity ? vi.provider.availability.slots.full : vi.provider.availability.slots.open}</small>
          </button></li>;
        })}
      </ul>}
    </div>
  </DashboardDialog>;
}
