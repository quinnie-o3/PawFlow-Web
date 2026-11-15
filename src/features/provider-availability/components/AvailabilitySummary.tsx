import { vi } from "@/lib/locale";
import { summarizeAvailability } from "../availabilityLogic";
import { availabilityMockNow } from "../data/providerAvailabilityMock";
import type { AvailabilityState } from "../types";
import styles from "../availability.module.css";

export default function AvailabilitySummary({ state }: { state: AvailabilityState }) {
  const summary = summarizeAvailability(state, availabilityMockNow);
  return <div className={styles.summaries}>
    {[
      { title: vi.provider.availability.summary.openSlots, count: summary.open, note: vi.provider.availability.summary.openSlotsNote },
      { title: vi.provider.availability.summary.heldBookings, count: summary.heldBookings, note: vi.provider.availability.summary.heldBookingsNote },
      { title: vi.provider.availability.exception.title, count: summary.exceptions, note: vi.provider.availability.summary.exceptionsNote },
    ].map((item) => <article key={item.title}>
      <h2>{item.title}</h2><p className={styles.summaryCount}>{String(item.count).padStart(2, "0")}</p><p>{item.note}</p>
    </article>)}
  </div>;
}
