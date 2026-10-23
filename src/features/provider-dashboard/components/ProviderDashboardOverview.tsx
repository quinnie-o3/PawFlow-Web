"use client";

import { useState } from "react";
import { bookingRequests, dailySamples, initialReportingRange, prioritySummary, providerName } from "../data/providerDashboardMock";
import { formatRange, summarizeDashboard } from "../data/dashboardAnalytics";
import BookingRequestsPreview from "./BookingRequestsPreview";
import MetricsGrid from "./MetricsGrid";
import OperationalAlerts from "./OperationalAlerts";
import OverviewIntro from "./OverviewIntro";
import PriorityStrip from "./PriorityStrip";
import WeeklyStatusChart from "./WeeklyStatusChart";
import styles from "../dashboard.module.css";

export default function ProviderDashboardOverview() {
  const [range, setRange] = useState(initialReportingRange);
  const report = summarizeDashboard(dailySamples, range);
  return (
    <div className="mx-auto flex w-full flex-col gap-2.5">
      <div className={`${styles.providerTab} flex min-h-[54px] items-center justify-center rounded-[5px] border-b-2 px-6 py-3 text-center text-[18px] font-semibold leading-[22px] text-[#f2e2ff]`}>
        DÀNH CHO PROVIDER
      </div>
      <div className="flex flex-col gap-6">
        <OverviewIntro summary={{ providerName, reportingPeriod: formatRange(range) }} range={range} onApply={setRange} />
        <PriorityStrip priority={prioritySummary} />
        <div aria-live="polite">
          <MetricsGrid metrics={report.metrics} />
        </div>
        <div className={styles.operationalGrid}>
          <WeeklyStatusChart data={report.chart} period={formatRange(range)} />
          <OperationalAlerts alerts={report.alerts} hasData={report.hasData} />
        </div>
      </div>
      <BookingRequestsPreview requests={bookingRequests} />
    </div>
  );
}
