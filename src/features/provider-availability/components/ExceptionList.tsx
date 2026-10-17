import { formatAvailabilityDate, formatRanges, localDate } from "../availabilityLogic";
import type { DateException } from "../types";
import styles from "../availability.module.css";

export default function ExceptionList({ exceptions, now, onEdit, onAdd }: {
  exceptions: DateException[]; now: string; onEdit: (exception: DateException) => void; onAdd: () => void;
}) {
  return <section className={`${styles.card} ${styles.exceptionsCard}`} aria-labelledby="exceptions-title">
    <div className={styles.sectionHeading}><h2 id="exceptions-title">Ngày ngoại lệ</h2><p>Đóng hoặc thay đổi giờ theo ngày.</p></div>
    {exceptions.length ? <ul className={styles.exceptionList}>{exceptions.map((exception) => <li key={exception.id}>
      <button type="button" onClick={() => onEdit(exception)} aria-label={`Xem ngoại lệ ${formatAvailabilityDate(exception.date)}`}>
        <strong>{formatAvailabilityDate(exception.date)}</strong><span>{exception.ranges.length ? `Chỉ nhận ${formatRanges(exception.ranges)}` : "Đóng cả ngày"}</span>
        {exception.date < localDate(now) && <small>Lịch sử · chỉ đọc</small>}
      </button>
    </li>)}</ul> : <p className={styles.empty}>Chưa có ngày ngoại lệ.</p>}
    <p className={styles.hint}>Không xóa slot có lịch đang giữ chỗ; không giảm sức chứa dưới số chỗ đã đặt.</p>
    <button type="button" className={styles.outlineButton} onClick={onAdd}>Thêm ngoại lệ</button>
  </section>;
}
