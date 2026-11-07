import { vi } from "@/lib/locale";
import type { MetricCardData } from "../types";
import MetricCard from "./MetricCard";

type MetricsGridProps = {
  metrics: MetricCardData[];
};

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label={vi.provider.dashboard.metrics.region}
    >
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </section>
  );
}
