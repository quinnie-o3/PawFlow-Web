import { summarizeAvailability } from "../availabilityLogic";
import { availabilityMockNow } from "../data/providerAvailabilityMock";
import type { AvailabilityState } from "../types";
import styles from "../availability.module.css";

export default function AvailabilitySummary({ state }: { state: AvailabilityState }) {
  const summary = summarizeAvailability(state, availabilityMockNow);
  return <div className={styles.summaries}>
    {[
      { title: "Khung giờ đang mở", count: summary.open, note: "Còn chỗ trong 7 ngày tới" },
      { title: "Lịch đang giữ chỗ", count: summary.heldBookings, note: "Chờ xác nhận + Đã xác nhận" },
      { title: "Ngày ngoại lệ", count: summary.exceptions, note: "Đã đóng hoặc điều chỉnh giờ" },
    ].map((item) => <article key={item.title}>
      <h2>{item.title}</h2><p className={styles.summaryCount}>{String(item.count).padStart(2, "0")}</p><p>{item.note}</p>
    </article>)}
  </div>;
}
