import { vi, formatMessage } from "@/lib/locale";
import { formatAvailabilityDate, formatRanges, localDate } from "../availabilityLogic";
import type { DateException } from "../types";
import styles from "../availability.module.css";

export default function ExceptionList({ exceptions, now, onEdit, onAdd }: {
  exceptions: DateException[]; now: string; onEdit: (exception: DateException) => void; onAdd: () => void;
}) {
  return <section className={`${styles.card} ${styles.exceptionsCard}`} aria-labelledby="exceptions-title">
    <div className={styles.sectionHeading}><h2 id="exceptions-title">{vi.provider.availability.exception.title}</h2><p>{vi.provider.availability.exceptions.description}</p></div>
    {exceptions.length ? <ul className={styles.exceptionList}>{exceptions.map((exception) => <li key={exception.id}>
      <button type="button" onClick={() => onEdit(exception)} aria-label={formatMessage(vi.provider.availability.exceptions.viewLabel, { date: formatAvailabilityDate(exception.date) })}>
        <strong>{formatAvailabilityDate(exception.date)}</strong><span>{exception.ranges.length ? formatMessage(vi.provider.availability.exceptions.hours, { ranges: formatRanges(exception.ranges) }) : vi.provider.availability.exception.closedAllDay}</span>
        {exception.date < localDate(now) && <small>{vi.provider.availability.labels.historical}</small>}
      </button>
    </li>)}</ul> : <p className={styles.empty}>{vi.provider.availability.exceptions.empty}</p>}
    <p className={styles.hint}>{vi.provider.availability.exceptions.heldNote}</p>
    <button type="button" className={styles.outlineButton} onClick={onAdd}>{vi.provider.availability.exceptions.add}</button>
  </section>;
}
