import { vi } from "@/lib/locale";
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
    const issue = !closed && draft.ranges.length === 0 ? vi.provider.availability.exception.requiredRange : availabilityCommandError(state, command, now);
    setError(issue ?? "");
    if (!issue) onSubmit(command, simulateFailure);
  }
  const deleteCommand: AvailabilityCommand = { type: "deleteException", exceptionId: initial.id };
  const deleteError = existing ? availabilityCommandError(state, deleteCommand, now) : null;
  return <DashboardDialog title={blockDay ? vi.provider.availability.exception.blockDay : vi.provider.availability.exception.title} onClose={onClose}>
    <form className={styles.editorForm} noValidate onSubmit={submit}>
      <p className={styles.notice}>{vi.provider.availability.exception.note}</p>
      {historical && <p className={styles.notice}>{vi.provider.availability.exception.historical}</p>}
      <fieldset disabled={historical} className={styles.formFields}>
        <label className={styles.fieldLabel}>{vi.provider.availability.exception.title}<input type="date" min={localDate(now)} value={draft.date} disabled={!!existing} required onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        <label className={styles.fieldLabel}>{vi.provider.availability.exception.hours}<select value={closed ? "closed" : "custom"} onChange={(event) => setClosed(event.target.value === "closed")}>
          <option value="closed">{vi.provider.availability.exception.closedAllDay}</option><option value="custom">{vi.provider.availability.exception.customHours}</option>
        </select></label>
        {!closed && <TimeRangeFields label={vi.provider.availability.exception.rangeLabel} ranges={draft.ranges} onChange={(ranges) => setDraft({ ...draft, ranges })} />}
      </fieldset>
      <p className={styles.hint}>{vi.provider.availability.exception.bookingNote}</p>
      <AvailabilityFeedback error={error} feedback={state.feedback} />
      {!historical && <><label className={styles.checkboxLabel}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} />{vi.provider.availability.mock.failSave}</label>
        <button type="submit" className={styles.primaryButton}>{vi.provider.availability.exception.save}</button></>}
      {existing && <div className={styles.dangerArea}>
        <button type="button" className={styles.outlineButton} disabled={!!deleteError} aria-describedby={deleteError ? "delete-exception-reason" : undefined} onClick={() => setConfirmDelete(true)}>{vi.provider.availability.exception.delete}</button>
        {deleteError && <p id="delete-exception-reason" className={styles.hint}>{deleteError}</p>}
        {confirmDelete && <div className={styles.confirmation}><p>{vi.provider.availability.exception.deletePrompt}</p>
          <button type="button" className={styles.primaryButton} onClick={() => { if (onSubmit(deleteCommand, simulateFailure)) onClose(); }}>{vi.provider.availability.exception.confirmDelete}</button>
          <button type="button" className={styles.softButton} onClick={() => setConfirmDelete(false)}>{vi.provider.availability.exception.keep}</button>
        </div>}
      </div>}
      <button type="button" className={styles.softButton} onClick={onClose}>{vi.common.actions.close}</button>
    </form>
  </DashboardDialog>;
}
