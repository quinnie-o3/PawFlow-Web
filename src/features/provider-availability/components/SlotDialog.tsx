import { vi, formatMessage } from "@/lib/locale";
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
  return <DashboardDialog title={existing ? formatMessage(vi.provider.availability.slot.title, { date: formatAvailabilityDate(existing.date), start: existing.start }) : vi.provider.availability.slot.create} onClose={onClose}>
    <form className={styles.editorForm} noValidate onSubmit={submit}>
      <p className={styles.notice}>{vi.provider.availability.slot.note}</p>
      {historical && <p className={styles.notice}>{vi.provider.availability.slot.historical}</p>}
      {!!held && <p className={styles.notice}>{historical ? formatMessage(vi.provider.availability.slot.heldHistoricalNote, { held }) : formatMessage(vi.provider.availability.slot.heldEditableNote, { held })}</p>}
      <fieldset disabled={protectedFields} className={styles.formFields}>
        <label className={styles.fieldLabel}>{vi.provider.availability.slot.service}<select value={draft.serviceId} required onChange={(event) => setDraft({ ...draft, serviceId: event.target.value })}>
          <option value="">{vi.provider.availability.slot.chooseService}</option>{state.services.map((item) => <option key={item.id} value={item.id}>{formatMessage(vi.provider.availability.slot.serviceOption, { serviceName: item.name, minutes: item.durationMinutes })}</option>)}
        </select></label>
        <label className={styles.fieldLabel}>{vi.provider.availability.slot.date}<input type="date" value={draft.date} min={localDate(now)} required onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        <div className={styles.rangeRow}>
          <label>{vi.provider.availability.labels.start}<input type="time" aria-label={vi.provider.availability.slot.startLabel} value={draft.start} required onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
          <label>{vi.provider.availability.labels.end}<input type="time" aria-label={vi.provider.availability.slot.endLabel} value={draft.end} required onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
        </div>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={draft.open} onChange={(event) => setDraft({ ...draft, open: event.target.checked })} />{vi.provider.availability.slot.open}</label>
      </fieldset>
      <p className={styles.hint}>{service ? formatMessage(vi.provider.availability.slot.hoursHintWithDuration, { minutes: service.durationMinutes, ranges: !dateError(draft.date) ? formatRanges(effectiveHours(state, draft.date)) : vi.provider.availability.slot.noDate }) : formatMessage(vi.provider.availability.slot.hoursHint, { ranges: !dateError(draft.date) ? formatRanges(effectiveHours(state, draft.date)) : vi.provider.availability.slot.noDate })}</p>
      <label className={styles.fieldLabel}>{vi.provider.availability.slot.capacity}<input type="number" min={Math.max(1, held)} step="1" value={capacity} disabled={historical} required onChange={(event) => setCapacity(event.target.value)} /></label>
      {existing && <p className={styles.hint}>{held >= existing.capacity ? formatMessage(vi.provider.availability.slot.capacityFullHint, { held, capacity: existing.capacity }) : formatMessage(vi.provider.availability.slot.capacityHint, { held, capacity: existing.capacity })}</p>}
      <AvailabilityFeedback error={error} feedback={state.feedback} />
      {!historical && <><label className={styles.checkboxLabel}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} />{vi.provider.availability.mock.failSave}</label>
        <button type="submit" className={styles.primaryButton}>{vi.provider.availability.slot.save}</button></>}
      {existing && <div className={styles.dangerArea}>
        <div className={styles.formActions}>{(["closeSlot", "deleteSlot"] as const).map((type) => {
          const reason = availabilityCommandError(state, destructiveCommand(type), now);
          return <div key={type}><button type="button" className={styles.outlineButton} disabled={!!reason || (type === "closeSlot" && !existing.open)} aria-describedby={`${type}-reason`} onClick={() => { setConfirm(type); setError(""); }}>{type === "closeSlot" ? vi.provider.availability.slot.close : vi.provider.availability.slot.delete}</button>
            <p id={`${type}-reason`} className={styles.hint}>{reason ?? (type === "closeSlot" && !existing.open ? vi.provider.availability.slot.alreadyClosed : vi.provider.availability.slot.noHeldBookings)}</p></div>;
        })}</div>
        {confirm && <div className={styles.confirmation}><p>{formatMessage(confirm === "deleteSlot" ? vi.provider.availability.slot.deletePrompt : vi.provider.availability.slot.closePrompt, { date: formatAvailabilityDate(existing.date), start: existing.start })}</p>
          <button type="button" className={styles.primaryButton} onClick={() => {
            if (onSubmit(destructiveCommand(confirm), simulateFailure)) {
              setConfirm(null);
              if (confirm === "deleteSlot") onClose(); else setDraft({ ...draft, open: false });
            }
          }}>{confirm === "deleteSlot" ? vi.provider.availability.slot.confirmDelete : vi.provider.availability.slot.confirmClose}</button>
          <button type="button" className={styles.softButton} onClick={() => setConfirm(null)}>{vi.provider.availability.slot.keep}</button>
        </div>}
      </div>}
      {existing && <details className={styles.reservations}><summary>{vi.provider.availability.slot.reservationsTitle}</summary>
        <p>{vi.provider.availability.slot.reservationsNote}</p>
        <ul>{state.reservations.filter((item) => item.slotId === initial.id).map((item) => <li key={item.id}>{item.id} · {item.status}</li>)}</ul>
        {!state.reservations.some((item) => item.slotId === initial.id) && <p>{vi.provider.availability.slot.noBookings}</p>}
      </details>}
      <button type="button" className={styles.softButton} onClick={onClose}>{vi.common.actions.close}</button>
    </form>
  </DashboardDialog>;
}
