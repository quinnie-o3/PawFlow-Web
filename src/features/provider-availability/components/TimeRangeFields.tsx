import type { TimeRange } from "../types";
import styles from "../availability.module.css";

export default function TimeRangeFields({ ranges, label, onChange }: {
  ranges: TimeRange[]; label: string; onChange: (ranges: TimeRange[]) => void;
}) {
  return <div className={styles.rangeFields}>
    {ranges.map((range, index) => <div className={styles.rangeRow} key={index}>
      <label>Bắt đầu<input type="time" aria-label={`${label} bắt đầu ${index + 1}`} value={range.start} onChange={(event) => onChange(ranges.map((item, i) => i === index ? { ...item, start: event.target.value } : item))} required /></label>
      <label>Kết thúc<input type="time" aria-label={`${label} kết thúc ${index + 1}`} value={range.end} onChange={(event) => onChange(ranges.map((item, i) => i === index ? { ...item, end: event.target.value } : item))} required /></label>
      <button type="button" className={styles.textButton} aria-label={`Xóa khoảng ${index + 1} ${label}`} onClick={() => onChange(ranges.filter((_, i) => i !== index))}>Xóa</button>
    </div>)}
    <button type="button" className={styles.textButton} onClick={() => onChange([...ranges, { start: "", end: "" }])} aria-label={`Thêm khoảng giờ ${label}`}>+ Thêm khoảng giờ</button>
  </div>;
}
