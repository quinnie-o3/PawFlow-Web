import type { MetricCardData, MetricTone } from "../types";
import {
  MetricCalendarIcon,
  CardsIcon,
  ChartIcon,
  NotificationIcon,
  PaymentIcon,
  StackIcon,
} from "./icons";

const metricIcons = {
  payment: PaymentIcon,
  calendar: MetricCalendarIcon,
  notification: NotificationIcon,
  cards: CardsIcon,
  stack: StackIcon,
  chart: ChartIcon,
};

const breakdownToneClass: Record<MetricTone, string> = {
  success: "text-[#56cb24]",
  danger: "text-[#e02d3c]",
  info: "text-[#001aff]",
  warning: "text-[#6f00c6]",
  pending: "text-[#e8a8aa]",
};

type MetricCardProps = {
  metric: MetricCardData;
};

export default function MetricCard({ metric }: MetricCardProps) {
  const Icon = metricIcons[metric.icon];

  return (
    <article className="flex min-h-[134px] min-w-0 flex-col rounded-[12px] bg-white p-5 shadow-[0_2px_8px_rgb(0_0_0_/_0.05)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[14px] font-semibold leading-[18px] text-[var(--text-secondary)]">
          {metric.title}
        </h3>
        <Icon className="h-5 w-5 shrink-0 text-[var(--accent-hover)]" />
      </div>

      <p className={`${metric.id === "popular-service" ? "text-[26px]" : "text-[28px]"} mt-3 font-bold leading-[35px] text-[var(--text-primary)]`}>
        {metric.value}
      </p>

      {metric.breakdown ? (
        <p className="mt-2 flex flex-wrap gap-x-1 gap-y-0.5 text-[11px] font-semibold leading-[15px]">
          {metric.breakdown.map((item, index) => (
            <span key={item.label} className={breakdownToneClass[item.tone]}>
              {index > 0 ? "· " : ""}
              {item.label} {item.value}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-2 text-[12px] leading-4 text-[var(--text-secondary)]">
          {metric.description}
        </p>
      )}
    </article>
  );
}
