"use client";

import { useState } from "react";
import type { OperationalAlert } from "../types";
import { LinkIcon, NotificationIcon } from "./icons";
import DashboardDialog from "./DashboardDialog";
import styles from "../dashboard.module.css";

export default function OperationalAlerts({ alerts, hasData }: { alerts: OperationalAlert[]; hasData: boolean }) {
  const [selected, setSelected] = useState<OperationalAlert | null>(null);
  return (
    <section className="min-w-0 rounded-[12px] bg-white p-6 shadow-[0_2px_8px_rgb(0_0_0_/_0.05)]">
      <h2 className="text-[16px] font-bold leading-5 text-[var(--text-primary)]">Cảnh báo vận hành</h2>
      <div className="mt-4 flex flex-col gap-4">
        {alerts.map((alert) => (
          <article key={alert.id} className="rounded-[8px] bg-[var(--surface-primary)] p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[14px] font-bold leading-[18px] text-[var(--accent-hover)]">{alert.title}</h3>
              <NotificationIcon className="h-5 w-5 shrink-0" />
            </div>
            <p className="mt-3 text-[12px] leading-[15px] text-[var(--text-secondary)]">{alert.description}</p>
            <button type="button" onClick={() => setSelected(alert)} className={`${styles.alertAction} mt-3 inline-flex cursor-pointer items-center gap-1 text-[var(--accent-hover)]`}>
              Xem dữ liệu & điều kiện <LinkIcon small className="h-3.5 w-3.5" />
            </button>
          </article>
        ))}
        {!alerts.length && <p className="py-6 text-[14px] leading-5 text-[var(--text-secondary)]">{hasData ? "Không có cảnh báo vượt ngưỡng trong kỳ." : "Chưa có dữ liệu để đánh giá cảnh báo trong kỳ."}</p>}
      </div>
      {selected && <DashboardDialog title={selected.title} onClose={() => setSelected(null)}>
        <dl className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-x-4 gap-y-3">
          <dt className="text-[var(--text-muted)]">Kỳ phân tích</dt><dd>{selected.period}</dd>
          <dt className="text-[var(--text-muted)]">Phạm vi</dt><dd>{selected.serviceScope}</dd>
          <dt className="text-[var(--text-muted)]">Chỉ số</dt><dd>{selected.metric}</dd>
          <dt className="text-[var(--text-muted)]">Tử số / mẫu số</dt><dd>{selected.numerator} / {selected.denominator}</dd>
          <dt className="text-[var(--text-muted)]">Ngưỡng</dt><dd>{selected.threshold}</dd>
          <dt className="text-[var(--text-muted)]">Điều kiện</dt><dd>{selected.condition}</dd>
        </dl>
        <p className="mt-4 text-[12px] leading-[18px] text-[var(--text-muted)]">Phân tích theo kỳ báo cáo đã chọn. Số yêu cầu cần xử lý hôm nay được theo dõi riêng.</p>
      </DashboardDialog>}
    </section>
  );
}
