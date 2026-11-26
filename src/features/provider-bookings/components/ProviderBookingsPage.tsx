"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { getProviderErrorMessage } from "../../provider-workspace/lifecycle";
import ProviderLifecycleBanner from "../../provider-workspace/components/ProviderLifecycleBanner";
import {
  BOOKING_STATUS_LABELS,
  filterProviderBookings,
  formatBookingSlotRange,
  formatVndAmount,
  parseStatusFilterParam,
  PROVIDER_BOOKING_STATUS_ORDER,
  summarizeProviderBookings,
  validateBookingDateFilter,
} from "../bookingLogic";
import type { ProviderBookingStatus } from "../../provider-workspace/liveApi";
import { useProviderBookings } from "../useProviderBookings";
import BookingDetailsDialog from "./BookingDetailsDialog";
import BookingStatusBadge from "./BookingStatusBadge";
import styles from "../bookings.module.css";

export default function ProviderBookingsPage() {
  const vm = useProviderBookings();
  const { profileState, sessionBoundary } = vm;
  const searchParams = useSearchParams();

  const statusParam: ProviderBookingStatus | "all" = parseStatusFilterParam(
    searchParams.get("status"),
  );
  const urlQuery = searchParams.get("q") ?? "";

  // IME-safe local input state: stays in sync with external URL ?q= navigation
  // while never calling history.replaceState mid Vietnamese composition.
  const [searchDraft, setSearchDraft] = useState<{
    baseUrlQuery: string;
    value: string;
  }>(() => ({ baseUrlQuery: urlQuery, value: urlQuery }));
  const [isComposing, setIsComposing] = useState(false);
  const composingRef = useRef(false);

  const displayedSearch = isComposing
    ? searchDraft.value
    : searchDraft.baseUrlQuery === urlQuery
      ? searchDraft.value
      : urlQuery;

  const committedQuery = isComposing ? urlQuery : displayedSearch;
  const debouncedQuery = useDebouncedSearch(committedQuery);

  function updateUrlParams(
    next: { status: ProviderBookingStatus | "all"; query: string },
    replace = false,
  ) {
    const url = new URL(window.location.href);
    if (next.status === "all") url.searchParams.delete("status");
    else url.searchParams.set("status", next.status);
    if (next.query) url.searchParams.set("q", next.query);
    else url.searchParams.delete("q");
    window.history[replace ? "replaceState" : "pushState"](
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  function handleStatusChange(nextStatus: ProviderBookingStatus | "all") {
    updateUrlParams({ status: nextStatus, query: displayedSearch }, false);
  }

  function handleSearchChange(nextValue: string, nativeIsComposing: boolean) {
    if (composingRef.current || nativeIsComposing) {
      setSearchDraft((prev) => ({ ...prev, value: nextValue }));
      return;
    }
    setSearchDraft({ baseUrlQuery: nextValue, value: nextValue });
    updateUrlParams({ status: statusParam, query: nextValue }, true);
  }

  function handleCompositionStart() {
    composingRef.current = true;
    setIsComposing(true);
    setSearchDraft({ baseUrlQuery: urlQuery, value: displayedSearch });
  }

  function handleCompositionEnd(nextValue: string) {
    composingRef.current = false;
    setIsComposing(false);
    setSearchDraft({ baseUrlQuery: nextValue, value: nextValue });
    updateUrlParams({ status: statusParam, query: nextValue }, true);
  }

  function clearAllFilters() {
    composingRef.current = false;
    setIsComposing(false);
    setSearchDraft({ baseUrlQuery: "", value: "" });
    updateUrlParams({ status: "all", query: "" }, false);
    vm.setDateRange("", "");
  }

  const dateValidationError = validateBookingDateFilter(
    vm.dateFilters.fromDate,
    vm.dateFilters.toDate,
  );
  const visible = filterProviderBookings(vm.bookings, {
    status: statusParam,
    query: debouncedQuery,
    fromDate: vm.dateFilters.fromDate,
    toDate: vm.dateFilters.toDate,
  });
  const summary = summarizeProviderBookings(vm.bookings);
  const selectedSummary = vm.selectedBookingId
    ? vm.bookings.find((item) => item.id === vm.selectedBookingId) ?? null
    : null;
  const facilityName = profileState.profile?.businessName ?? "";
  const showContent =
    sessionBoundary.mode === "owner" && !sessionBoundary.hidePrivateData;

  return (
    <div className={styles.page} lang="vi">
      <div className={styles.providerTab}>
        {vi.provider.bookings.page.providerTab}
      </div>

      <header className={styles.intro}>
        <div>
          <h1 id="bookings-title" tabIndex={-1}>
            {vi.provider.bookings.page.title}
          </h1>
          <p>
            {facilityName
              ? formatMessage(vi.provider.bookings.page.description, {
                  facilityName,
                })
              : vi.provider.bookings.page.descriptionFallback}
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
              onClick={() => void vm.reloadAll()}
            >
              <RefreshCw aria-hidden="true" size={14} />
              {vm.reloading
                ? vi.provider.bookings.page.refreshing
                : vi.provider.bookings.page.refresh}
            </button>
          )}
          <Link
            href="/dashboard/availability"
            prefetch={false}
            className={styles.availabilityLink}
          >
            {vi.provider.bookings.page.availability}
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
              <h2>{vi.provider.bookings.page.profileRequiredTitle}</h2>
              <p>{vi.provider.bookings.page.profileRequiredDescription}</p>
            </section>
          ) : (
            <>
              {vm.listStatus === "ready" && (
                <div
                  className={styles.summaries}
                  aria-label={vi.provider.bookings.summary.region}
                >
                  {summary.map((item) => (
                    <article key={item.status}>
                      <h2>{item.title}</h2>
                      <p className={styles.summaryCount}>
                        {String(item.count).padStart(2, "0")}
                      </p>
                      <p>
                        {item.status === "PENDING_CONFIRMATION"
                          ? vi.provider.bookings.summary.priority
                          : item.status === "CONFIRMED"
                            ? vi.provider.bookings.summary.confirmed
                            : vi.provider.bookings.summary.excludesCancelled}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              <div
                className={styles.filters}
                role="group"
                aria-label={vi.provider.bookings.filters.status}
              >
                <button
                  type="button"
                  aria-pressed={statusParam === "all"}
                  onClick={() => handleStatusChange("all")}
                >
                  {vi.common.actions.all}
                </button>
                {PROVIDER_BOOKING_STATUS_ORDER.map((status) => (
                  <button
                    type="button"
                    key={status}
                    aria-pressed={statusParam === status}
                    onClick={() => handleStatusChange(status)}
                  >
                    {BOOKING_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>

              <div className={styles.searchAndDates}>
                <label className={styles.search}>
                  <span className={styles.srOnly}>
                    {vi.provider.bookings.filters.searchLabel}
                  </span>
                  <Search
                    aria-hidden="true"
                    focusable="false"
                    size={15}
                    strokeWidth={2}
                    className={styles.searchIcon}
                  />
                  <input
                    type="search"
                    placeholder={vi.provider.bookings.filters.searchPlaceholder}
                    value={displayedSearch}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={(event) =>
                      handleCompositionEnd(event.currentTarget.value)
                    }
                    onChange={(event) =>
                      handleSearchChange(
                        event.target.value,
                        Boolean(
                          (event.nativeEvent as { isComposing?: boolean })
                            .isComposing,
                        ),
                      )
                    }
                  />
                </label>

                <div
                  className={styles.dateFilters}
                  role="group"
                  aria-label={vi.provider.bookings.filters.dateRangeLabel}
                >
                  <label className={styles.dateField}>
                    <span>{vi.provider.bookings.filters.fromDate}</span>
                    <input
                      type="date"
                      value={vm.dateFilters.fromDate}
                      aria-invalid={Boolean(dateValidationError)}
                      onChange={(event) =>
                        vm.setDateRange(
                          event.target.value,
                          vm.dateFilters.toDate,
                        )
                      }
                    />
                  </label>
                  <label className={styles.dateField}>
                    <span>{vi.provider.bookings.filters.toDate}</span>
                    <input
                      type="date"
                      value={vm.dateFilters.toDate}
                      aria-invalid={Boolean(dateValidationError)}
                      onChange={(event) =>
                        vm.setDateRange(
                          vm.dateFilters.fromDate,
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  {(vm.dateFilters.fromDate || vm.dateFilters.toDate) && (
                    <button
                      type="button"
                      className={styles.clearDateButton}
                      onClick={() => vm.setDateRange("", "")}
                    >
                      {vi.provider.bookings.filters.clearDates}
                    </button>
                  )}
                </div>
              </div>

              {dateValidationError && (
                <p role="alert" className={styles.error}>
                  {dateValidationError}
                </p>
              )}

              <section
                className={styles.listCard}
                aria-labelledby="bookings-list-title"
              >
                <div className={styles.listHeading}>
                  <h2 id="bookings-list-title">
                    {vi.provider.bookings.list.title}
                  </h2>
                  <p>{vi.provider.bookings.list.description}</p>
                </div>

                {vm.feedback && !vm.showDetailDialog && (
                  <p
                    role={vm.feedback.tone === "error" ? "alert" : "status"}
                    className={
                      vm.feedback.tone === "error"
                        ? styles.error
                        : vm.feedback.tone === "warning"
                          ? styles.warning
                          : styles.success
                    }
                  >
                    {vm.feedback.message}
                  </p>
                )}

                {vm.refreshError && (
                  <div className={styles.error} role="alert">
                    {getProviderErrorMessage(
                      vm.refreshError,
                      vm.cooldownSeconds,
                    )}
                  </div>
                )}

                {vm.listStatus === "loading" ? (
                  <div className={styles.stateBox} role="status" aria-busy="true">
                    <p>{vi.provider.bookings.list.loading}</p>
                  </div>
                ) : vm.listStatus === "error" ? (
                  <div className={styles.errorBox} role="alert">
                    <h3>{vi.provider.bookings.list.errorTitle}</h3>
                    <p>
                      {vm.listError
                        ? getProviderErrorMessage(
                            vm.listError,
                            vm.cooldownSeconds,
                          )
                        : vi.provider.workspace.errors.UNKNOWN_ERROR}
                    </p>
                    <button
                      type="button"
                      className={styles.softButton}
                      disabled={vm.cooldownSeconds > 0 || vm.reloading}
                      onClick={vm.retryList}
                    >
                      <RefreshCw aria-hidden="true" size={14} />
                      {vi.provider.bookings.list.retry}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className={styles.resultCount} role="status">
                      {formatMessage(vi.provider.bookings.list.resultCount, {
                        visible: visible.length,
                        total: vm.bookings.length,
                      })}
                    </p>

                    {visible.length > 0 ? (
                      <div
                        className={styles.tableFrame}
                        tabIndex={0}
                        role="region"
                        aria-label={vi.provider.bookings.list.region}
                      >
                        <table>
                          <colgroup>
                            <col style={{ width: 90 }} />
                            <col style={{ width: 175 }} />
                            <col style={{ width: 185 }} />
                            <col style={{ width: 165 }} />
                            <col style={{ width: 110 }} />
                            <col style={{ width: 125 }} />
                            <col style={{ width: 115 }} />
                          </colgroup>
                          <thead>
                            <tr>
                              {[
                                vi.provider.bookings.list.bookingId,
                                vi.provider.bookings.list.customerAndPet,
                                vi.provider.bookings.labels.service,
                                vi.provider.bookings.list.time,
                                vi.provider.bookings.list.price,
                                vi.provider.bookings.labels.status,
                                vi.provider.bookings.list.actions,
                              ].map((label) => (
                                <th scope="col" key={label}>
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((booking) => (
                              <tr key={booking.id}>
                                <th scope="row">#{booking.id}</th>
                                <td>
                                  <strong>{booking.customer.fullName}</strong>
                                  <span className={styles.rowSub}>
                                    {booking.pet.name} ({booking.pet.petType.name})
                                  </span>
                                </td>
                                <td>{booking.service.name}</td>
                                <td>{formatBookingSlotRange(booking.slot)}</td>
                                <td>{formatVndAmount(booking.bookedPrice)}</td>
                                <td>
                                  <BookingStatusBadge status={booking.status} />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className={styles.detailButton}
                                    aria-label={formatMessage(
                                      vi.provider.bookings.list.detailsLabel,
                                      { bookingId: booking.id },
                                    )}
                                    onClick={() => vm.openBooking(booking.id)}
                                  >
                                    {vi.provider.bookings.list.viewDetails}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={styles.empty}>
                        <h3>
                          {vm.bookings.length === 0
                            ? vi.provider.bookings.empty.noBookings
                            : displayedSearch.trim() ||
                                vm.dateFilters.fromDate ||
                                vm.dateFilters.toDate
                              ? vi.provider.bookings.empty.noResults
                              : vi.provider.bookings.empty.noStatusResults}
                        </h3>
                        <p>
                          {vm.bookings.length === 0
                            ? vi.provider.bookings.empty.noBookingsDescription
                            : vi.provider.bookings.empty.noResultsDescription}
                        </p>
                        {vm.bookings.length > 0 && (
                          <button
                            className={styles.softButton}
                            type="button"
                            onClick={clearAllFilters}
                          >
                            {vi.provider.bookings.empty.clearFilters}
                          </button>
                        )}
                      </div>
                    )}
                    <p className={styles.listNote}>
                      {vi.provider.bookings.list.statusNote}
                    </p>
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}

      {vm.showDetailDialog && vm.selectedBookingId && (
        <BookingDetailsDialog
          key={vm.selectedBookingId}
          bookingId={vm.selectedBookingId}
          facilityName={facilityName || vi.provider.bookings.page.title}
          summaryBooking={selectedSummary}
          detailState={vm.detailState}
          permissions={profileState.permissions}
          draftState={vm.draftState}
          feedback={vm.feedback}
          cooldownSeconds={vm.cooldownSeconds}
          locked={sessionBoundary.lockActions}
          onRetryDetail={() => vm.retryDetail(vm.selectedBookingId!)}
          onReloadList={vm.retryList}
          onBeginAction={(action) =>
            vm.beginAction(vm.selectedBookingId!, action)
          }
          onCancelAction={vm.cancelAction}
          onReasonChange={vm.updateReason}
          onSubmitAction={(action, reason) =>
            void vm.submitAction(vm.selectedBookingId!, action, reason)
          }
          onReconcileUnknown={() => void vm.reconcileUnknown()}
          onClose={vm.closeBooking}
        />
      )}
    </div>
  );
}
