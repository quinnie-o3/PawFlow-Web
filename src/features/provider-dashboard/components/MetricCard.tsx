import type { MetricCardData, MetricTone } from "../types";
import {
  CancellationIcon,
  CardsIcon,
  ChartIcon,
  MetricCalendarIcon,
  PaymentIcon,
  StackIcon,
} from "./icons";

const metricIcons = {
  payment: PaymentIcon,
  calendar: MetricCalendarIcon,
  notification: CancellationIcon,
  cards: CardsIcon,
  stack: StackIcon,
  chart: ChartIcon,
};

const breakdownToneClass: Record<MetricTone, string> = {
  success: "text-[#16653d]",
  danger: "text-[#ae3942]",
  info: "text-[#3025a7]",
  warning: "text-[#6f00c6]",
  pending: "text-[#8a5300]",
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

      <p
        className={`${
          metric.id === "popular-service" ? "text-[22px] leading-[30px]" : "text-[26px] leading-[34px]"
        } mt-3 break-words font-bold tabular-nums text-[var(--text-primary)]`}
      >
        {metric.value}
      </p>

      {metric.breakdown ? (
        <p className="mt-2 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] font-semibold leading-[16px]">
          {metric.breakdown.map((item, index) => (
            <span key={item.label} className={breakdownToneClass[item.tone]}>
              {index > 0 ? "· " : ""}
              {item.label}: {item.value}
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
