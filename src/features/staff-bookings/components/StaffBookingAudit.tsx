import { vi, formatMessage } from "@/lib/locale";
import { formatStaffBookingDate, staffStatusLabels } from "../staffBookingLogic";
import type { StaffAuditEntry } from "../types";
import styles from "../staffBookings.module.css";

export default function StaffBookingAudit({ logs }: { logs: readonly StaffAuditEntry[] }) {
  return <section className={styles.listCard} aria-labelledby="staff-audit-title">
    <div className={styles.listHeading}><h2 id="staff-audit-title">{formatMessage(vi.staff.bookings.audit.title, { count: logs.length })}</h2>
      <p>{vi.staff.bookings.audit.description}</p></div>
    {logs.length === 0 ? <p className={styles.listNote}>{vi.staff.bookings.audit.empty}</p> :
      <ol className={styles.auditList}>{[...logs].reverse().map((log) => <li key={log.id}>
        <h3>#{log.id} · {log.bookingId} · {log.outcome === "success" ? vi.staff.bookings.audit.success : vi.staff.bookings.audit.failure}</h3>
        <p>{log.actor} · {log.occurredAt ? formatStaffBookingDate(log.occurredAt) : vi.staff.bookings.audit.unknownTime} (UTC+7)</p>
        <p>{formatMessage(vi.staff.bookings.audit.transition, { previous: log.previousStatus ? staffStatusLabels[log.previousStatus] : vi.staff.bookings.audit.outOfScope, next: log.nextStatus ? staffStatusLabels[log.nextStatus] : vi.staff.bookings.audit.outOfScope })}</p>
        <p>{formatMessage(vi.staff.bookings.audit.requested, { status: staffStatusLabels[log.requestedStatus], confirmed: log.confirmedActualOutcome ? vi.staff.bookings.audit.yes : vi.staff.bookings.audit.no })}</p>
        <p className={styles.notes}>{formatMessage(vi.staff.bookings.audit.reason, { reason: log.reason || vi.staff.bookings.audit.none })}</p>
        <p className={log.outcome === "error" ? styles.auditError : styles.auditSuccess}>{log.message}</p>
      </li>)}</ol>}
  </section>;
}
