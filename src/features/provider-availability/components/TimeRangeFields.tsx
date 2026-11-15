import { vi, formatMessage } from "@/lib/locale";
import type { TimeRange } from "../types";
import styles from "../availability.module.css";

export default function TimeRangeFields({ ranges, label, onChange }: {
  ranges: TimeRange[]; label: string; onChange: (ranges: TimeRange[]) => void;
}) {
  return <div className={styles.rangeFields}>
    {ranges.map((range, index) => <div className={styles.rangeRow} key={index}>
      <label>{vi.provider.availability.labels.start}<input type="time" aria-label={formatMessage(vi.provider.availability.ranges.startLabel, { day: label, number: index + 1 })} value={range.start} onChange={(event) => onChange(ranges.map((item, i) => i === index ? { ...item, start: event.target.value } : item))} required /></label>
      <label>{vi.provider.availability.labels.end}<input type="time" aria-label={formatMessage(vi.provider.availability.ranges.endLabel, { day: label, number: index + 1 })} value={range.end} onChange={(event) => onChange(ranges.map((item, i) => i === index ? { ...item, end: event.target.value } : item))} required /></label>
      <button type="button" className={styles.textButton} aria-label={formatMessage(vi.provider.availability.ranges.deleteLabel, { number: index + 1, day: label })} onClick={() => onChange(ranges.filter((_, i) => i !== index))}>{vi.common.actions.delete}</button>
    </div>)}
    <button type="button" className={styles.textButton} onClick={() => onChange([...ranges, { start: "", end: "" }])} aria-label={formatMessage(vi.provider.availability.ranges.addLabel, { day: label })}>{vi.provider.availability.ranges.add}</button>
  </div>;
}
