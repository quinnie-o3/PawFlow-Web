"use client";

import { vi } from "@/lib/locale";
import ProviderLifecycleBanner from "../../provider-workspace/components/ProviderLifecycleBanner";
import { formatRange } from "../data/dashboardAnalytics";
import { useProviderDashboard } from "../useProviderDashboard";
import BookingRequestsPreview from "./BookingRequestsPreview";
import MetricsGrid from "./MetricsGrid";
import OperationalAlerts from "./OperationalAlerts";
import OverviewIntro from "./OverviewIntro";
import PriorityStrip from "./PriorityStrip";
import WeeklyStatusChart from "./WeeklyStatusChart";
import styles from "../dashboard.module.css";

export default function ProviderDashboardOverview() {
  const vm = useProviderDashboard();
  const { profileState, sessionBoundary } = vm;
  const facilityName = profileState.profile?.businessName ?? null;
  const formattedPeriod = formatRange(vm.range);
  const showContent =
    sessionBoundary.mode === "owner" && !sessionBoundary.hidePrivateData;

  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-4" lang="vi">
      <div
        className={`${styles.providerTab} flex min-h-[54px] items-center justify-center rounded-[5px] border-b-2 px-6 py-3 text-center text-[18px] font-semibold leading-[22px] text-[#f2e2ff]`}
      >
        {vi.provider.dashboard.page.providerTab}
      </div>

      <OverviewIntro
        summary={{
          providerName: showContent ? facilityName : null,
          reportingPeriod: formattedPeriod,
        }}
        preset={vm.preset}
        range={vm.range}
        showControls={showContent && profileState.status !== "not-found"}
        refreshing={
          vm.dashboardReloading ||
          vm.bookingsReloading ||
          profileState.reloading
        }
        refreshDisabled={
          vm.cooldownSeconds > 0 || sessionBoundary.lockActions
        }
        onSelectPreset={vm.selectPreset}
        onApply={vm.applyCustomRange}
        onRefresh={() => void vm.refreshAll()}
      />

      {sessionBoundary.mode === "session-pending" ? (
        <section className={styles.blockCard} role="status" aria-busy="true">
          <p className="text-[13px] text-[var(--text-secondary)]">
            {vi.provider.workspace.session.pending}
          </p>
        </section>
      ) : sessionBoundary.mode === "session-error" ? (
        <section className={styles.blockError} role="alert">
          <h2>{vi.provider.workspace.session.errorTitle}</h2>
          <p>{vi.provider.workspace.session.errorDescription}</p>
        </section>
      ) : sessionBoundary.mode === "unauthenticated" ? (
        <section className={styles.blockError} role="alert">
          <p>{vi.provider.workspace.session.unauthenticated}</p>
        </section>
      ) : sessionBoundary.mode === "wrong-role" ? (
        <section className={styles.blockError} role="alert">
          <p>{vi.provider.workspace.session.wrongRole}</p>
        </section>
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          <ProviderLifecycleBanner
            status={profileState.status}
            profile={profileState.profile}
            error={profileState.error}
            refreshError={profileState.refreshError}
            reloading={profileState.reloading}
            cooldownSeconds={vm.cooldownSeconds}
            onReload={() => void profileState.reload()}
          />

          {profileState.status === "not-found" ? (
            <section className={styles.blockCard}>
              <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
                {vi.provider.dashboard.page.profileRequiredTitle}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                {vi.provider.dashboard.page.profileRequiredDescription}
              </p>
            </section>
          ) : (
            <>
              <PriorityStrip
                status={vm.bookingsStatus}
                priority={vm.priority}
                error={vm.bookingsError}
                reloading={vm.bookingsReloading}
                cooldownSeconds={vm.cooldownSeconds}
                onRetry={() => void vm.retryBookings()}
              />

              <div aria-live="polite">
                <MetricsGrid
                  status={vm.dashboardStatus}
                  metrics={vm.metrics}
                  error={vm.dashboardError}
                  reloading={vm.dashboardReloading}
                  cooldownSeconds={vm.cooldownSeconds}
                  onRetry={() => void vm.retryDashboard()}
                />
              </div>

              <div className={styles.operationalGrid}>
                <WeeklyStatusChart
                  status={vm.bookingsStatus}
                  data={vm.chartSeries}
                  period={formattedPeriod}
                  facilityName={facilityName}
                  error={vm.bookingsError}
                  reloading={vm.bookingsReloading}
                  cooldownSeconds={vm.cooldownSeconds}
                  onRetry={() => void vm.retryBookings()}
                />
                <OperationalAlerts
                  status={vm.dashboardStatus}
                  alerts={vm.alerts}
                  hasData={vm.hasAnalyticsData}
                  allowDialog={vm.allowDialogs}
                  error={vm.dashboardError}
                  reloading={vm.dashboardReloading}
                  cooldownSeconds={vm.cooldownSeconds}
                  onRetry={() => void vm.retryDashboard()}
                />
              </div>

              <BookingRequestsPreview
                status={vm.bookingsStatus}
                requests={vm.pendingPreview.items}
                totalPending={vm.pendingPreview.totalPending}
                facilityName={facilityName}
                allowDialog={vm.allowDialogs}
                error={vm.bookingsError}
                reloading={vm.bookingsReloading}
                cooldownSeconds={vm.cooldownSeconds}
                onRetry={() => void vm.retryBookings()}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
