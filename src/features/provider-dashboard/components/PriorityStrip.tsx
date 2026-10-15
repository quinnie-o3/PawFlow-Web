import type { PrioritySummary } from "../types";
import { LinkIcon } from "./icons";
import styles from "../dashboard.module.css";
import { formatDate } from "../data/dashboardAnalytics";
import { sampleToday } from "../data/providerDashboardMock";

type PriorityStripProps = {
  priority: PrioritySummary;
};

export default function PriorityStrip({ priority }: PriorityStripProps) {
  return (
    <section className={`${styles.priorityStrip} flex flex-col gap-4 rounded-[12px] p-5 text-white sm:flex-row sm:items-center sm:justify-between`}>
      <div>
        <h2 className="text-[16px] font-bold leading-5">{priority.title}</h2>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] leading-[18px] text-white/80">
          <span>{priority.waitingRequests}</span>
          <span>{priority.todayAppointments}</span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-white/80">Hôm nay: {formatDate(sampleToday)} · Dữ liệu mô phỏng</p>
      </div>

      <button
        type="button"
        onClick={() => {
          const heading = document.getElementById("booking-requests-title");
          heading?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
          heading?.focus({ preventScroll: true });
        }}
        className={`${styles.primaryAction} inline-flex h-[38px] w-fit shrink-0 items-center gap-2 rounded-[6px] bg-white px-4 text-[14px] font-bold leading-[18px] transition-colors hover:bg-[var(--surface-primary)]`}
      >
        Xem yêu cầu
        <LinkIcon className="h-4 w-4" />
      </button>
    </section>
  );
}
