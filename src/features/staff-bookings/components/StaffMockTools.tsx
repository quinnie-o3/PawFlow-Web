import { vi } from "@/lib/locale";
import type { StaffMockScenario } from "../types";
import styles from "../staffBookings.module.css";

export default function StaffMockTools({ clockInput, clockError, simulateFailure, disabled, onClockInputChange, onApplyClock, onFailureChange, onScenario, onReset }: {
  clockInput: string;
  clockError: string;
  simulateFailure: boolean;
  disabled: boolean;
  onClockInputChange: (value: string) => void;
  onApplyClock: () => void;
  onFailureChange: (enabled: boolean) => void;
  onScenario: (scenario: StaffMockScenario) => void;
  onReset: () => void;
}) {
  return <details className={styles.mockTools}>
    <summary>{vi.staff.bookings.mockTools.title}</summary>
    <p>{vi.staff.bookings.mockTools.description}</p>
    <form className={styles.clockForm} noValidate onSubmit={(event) => { event.preventDefault(); onApplyClock(); }}>
      <label className={styles.field}>{vi.staff.bookings.mockTools.clockLabel}<input type="datetime-local" value={clockInput} onChange={(event) => onClockInputChange(event.target.value)}
          disabled={disabled} aria-invalid={!!clockError} aria-describedby={clockError ? "staff-clock-error" : undefined} />
      </label>
      <button type="submit" className={styles.secondaryButton} disabled={disabled}>{vi.staff.bookings.mockTools.applyClock}</button>
    </form>
    {clockError && <p id="staff-clock-error" role="alert" className={styles.operationError}>{clockError}</p>}
    <label className={styles.check}><input type="checkbox" checked={simulateFailure} disabled={disabled}
      onChange={(event) => onFailureChange(event.target.checked)} />{vi.staff.bookings.mockTools.simulateOperationError}</label>
    <p>{vi.staff.bookings.mockTools.resetDescription}</p>
    <div className={styles.mockButtons}>
      <button type="button" disabled={disabled} onClick={() => onScenario("error")}>{vi.staff.bookings.mockTools.simulateLoadError}</button>
      <button type="button" disabled={disabled} onClick={() => onScenario("empty")}>{vi.staff.bookings.mockTools.emptyList}</button>
      <button type="button" disabled={disabled} onClick={onReset}>{vi.staff.bookings.mockTools.restoreFixtures}</button>
    </div>
  </details>;
}
