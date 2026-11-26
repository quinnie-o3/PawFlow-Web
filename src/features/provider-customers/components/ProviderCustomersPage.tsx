"use client";

import Link from "next/link";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import ProviderLifecycleBanner from "../../provider-workspace/components/ProviderLifecycleBanner";
import { useProviderCustomers } from "../useProviderCustomers";
import CustomerDetailsDialog from "./CustomerDetailsDialog";
import CustomerProfile from "./CustomerProfile";
import CustomersList from "./CustomersList";
import CustomersReportingPeriod from "./CustomersReportingPeriod";
import CustomersSummary from "./CustomersSummary";
import CustomersToolbar from "./CustomersToolbar";
import styles from "../customers.module.css";

export default function ProviderCustomersPage() {
  const vm = useProviderCustomers();
  const { profileState, sessionBoundary } = vm;
  const facilityName = profileState.profile?.businessName ?? "";
  const showContent =
    sessionBoundary.mode === "owner" && !sessionBoundary.hidePrivateData;

  return (
    <div className={styles.page} lang="vi">
      <div className={styles.providerTab}>
        {vi.provider.customers.page.providerTab}
      </div>

      <header className={styles.intro}>
        <div>
          <h1 id="customers-title" tabIndex={-1}>
            {vi.provider.customers.page.title}
          </h1>
          <p>
            {facilityName
              ? formatMessage(vi.provider.customers.page.description, {
                  facilityName,
                })
              : vi.provider.customers.page.descriptionFallback}
          </p>
        </div>
        <div className={styles.introActions}>
          {showContent && profileState.status !== "not-found" && (
            <button
              type="button"
              className={styles.refreshButton}
              disabled={
                vm.reloading ||
                vm.cooldownSeconds > 0 ||
                sessionBoundary.lockActions
              }
              onClick={() => void vm.reload()}
            >
              <RefreshCw aria-hidden="true" size={14} />
              {vm.reloading
                ? vi.provider.customers.page.refreshing
                : vi.provider.customers.page.refresh}
            </button>
          )}
          <Link
            href="/dashboard/bookings"
            prefetch={false}
            className={styles.bookingLink}
          >
            {vi.provider.customers.page.bookings}
          </Link>
        </div>
      </header>

      {sessionBoundary.mode === "session-pending" ? (
        <section className={styles.stateCard} role="status" aria-busy="true">
          <p>{vi.provider.workspace.session.pending}</p>
        </section>
      ) : sessionBoundary.mode === "session-error" ? (
        <section className={styles.sessionErrorCard} role="alert">
          <h2>{vi.provider.workspace.session.errorTitle}</h2>
          <p>{vi.provider.workspace.session.errorDescription}</p>
        </section>
      ) : sessionBoundary.mode === "unauthenticated" ? (
        <section className={styles.sessionErrorCard} role="alert">
          <p>{vi.provider.workspace.session.unauthenticated}</p>
        </section>
      ) : sessionBoundary.mode === "wrong-role" ? (
        <section className={styles.sessionErrorCard} role="alert">
          <p>{vi.provider.workspace.session.wrongRole}</p>
        </section>
      ) : (
        <>
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
            <section className={styles.stateCard}>
              <h2>{vi.provider.customers.page.profileRequiredTitle}</h2>
              <p>{vi.provider.customers.page.profileRequiredDescription}</p>
            </section>
          ) : (
            <>
              <section
                className={styles.privacyBanner}
                aria-labelledby="customers-privacy-title"
              >
                <ShieldAlert aria-hidden="true" size={18} />
                <div>
                  <h2 id="customers-privacy-title">
                    {vi.provider.customers.privacy.title}
                  </h2>
                  <p>{vi.provider.customers.privacy.description}</p>
                </div>
              </section>

              <CustomersReportingPeriod
                periodMode={vm.periodMode}
                preset={vm.preset}
                range={vm.range}
                onSelectPreset={vm.selectPreset}
                onApply={vm.setRange}
              />

              {vm.listStatus === "ready" && (
                <CustomersSummary report={vm.report} />
              )}

              <CustomersToolbar
                filters={vm.filters}
                onChange={vm.setFilters}
              />

              <CustomersList
                status={vm.listStatus}
                error={vm.listError}
                refreshError={vm.refreshError}
                reloading={vm.reloading}
                cooldownSeconds={vm.cooldownSeconds}
                records={vm.visibleRecords}
                total={vm.records.length}
                onSelect={vm.openCustomer}
                onClearFilters={() =>
                  vm.setFilters({ query: "", group: "all" })
                }
                onRetry={() => void vm.reload()}
              />

              {vm.listStatus === "ready" && vm.selected && (
                <CustomerProfile
                  record={vm.selected}
                  facilityName={facilityName}
                  onOpen={vm.openCustomer}
                />
              )}
            </>
          )}
        </>
      )}

      {vm.showDialog && vm.selected && (
        <CustomerDetailsDialog
          key={vm.selected.customer.id}
          record={vm.selected}
          facilityName={facilityName}
          onClose={vm.closeDialog}
        />
      )}
    </div>
  );
}
