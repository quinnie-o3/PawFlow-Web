"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { isRequestCancelled } from "@/lib/api/errors";
import { formatMessage, vi } from "@/lib/locale";
import {
  classifyProviderError,
  listMyServices,
  listWorkingHours,
  type ProviderApiErrorInfo,
  type ProviderService,
  type ProviderWorkingHour,
} from "@/features/provider-workspace/liveApi";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import {
  summarizeLiveServices,
  summarizeLiveWorkingHours,
} from "../profileLogic";
import styles from "../profile.module.css";

const MAX_PREVIEW_SERVICES = 6;

type ScopedFetchState<T> = Readonly<{
  identity: string | null;
  nonce: number;
  status: "ready" | "error" | null;
  data: T | null;
  error: ProviderApiErrorInfo | null;
}>;

const EMPTY_SERVICES_STATE: ScopedFetchState<ProviderService[]> = {
  identity: null,
  nonce: -1,
  status: null,
  data: null,
  error: null,
};

const EMPTY_HOURS_STATE: ScopedFetchState<ProviderWorkingHour[]> = {
  identity: null,
  nonce: -1,
  status: null,
  data: null,
  error: null,
};

export default function ProfileModulesOverview({
  identity,
  enabled,
  hidePrivateData,
}: {
  identity: string | null;
  enabled: boolean;
  hidePrivateData: boolean;
}) {
  const [servicesNonce, setServicesNonce] = useState(0);
  const [hoursNonce, setHoursNonce] = useState(0);
  const [servicesState, setServicesState] =
    useState<ScopedFetchState<ProviderService[]>>(EMPTY_SERVICES_STATE);
  const [hoursState, setHoursState] =
    useState<ScopedFetchState<ProviderWorkingHour[]>>(EMPTY_HOURS_STATE);
  const [servicesCooldownUntil, setServicesCooldownUntil] = useState<
    number | null
  >(null);
  const [hoursCooldownUntil, setHoursCooldownUntil] = useState<number | null>(
    null,
  );
  const [nowMs, setNowMs] = useState(0);

  const activeCooldownUntil = Math.max(
    servicesCooldownUntil ?? 0,
    hoursCooldownUntil ?? 0,
  );

  useEffect(() => {
    if (activeCooldownUntil <= 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= activeCooldownUntil) {
        window.clearInterval(timer);
      }
    }, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeCooldownUntil]);

  // Purge stale private summaries from memory asynchronously when identity clears.
  useEffect(() => {
    if (identity !== null) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setServicesState(EMPTY_SERVICES_STATE);
      setHoursState(EMPTY_HOURS_STATE);
      setServicesCooldownUntil(null);
      setHoursCooldownUntil(null);
    });
    return () => {
      cancelled = true;
    };
  }, [identity]);

  useEffect(() => {
    if (!enabled || hidePrivateData || !identity) return;
    const controller = new AbortController();
    const targetIdentity = identity;
    const targetNonce = servicesNonce;

    listMyServices({ signal: controller.signal }).then(
      (items) => {
        if (controller.signal.aborted) return;
        setServicesState({
          identity: targetIdentity,
          nonce: targetNonce,
          status: "ready",
          data: items,
          error: null,
        });
      },
      (err) => {
        if (isRequestCancelled(err) || controller.signal.aborted) return;
        const info = classifyProviderError(err, "list-services");
        if (info.retryAfterSeconds && info.retryAfterSeconds > 0) {
          const now = Date.now();
          setNowMs(now);
          setServicesCooldownUntil(now + info.retryAfterSeconds * 1000);
        }
        setServicesState({
          identity: targetIdentity,
          nonce: targetNonce,
          status: "error",
          data: null,
          error: info,
        });
      },
    );

    return () => {
      controller.abort();
    };
  }, [enabled, hidePrivateData, identity, servicesNonce]);

  useEffect(() => {
    if (!enabled || hidePrivateData || !identity) return;
    const controller = new AbortController();
    const targetIdentity = identity;
    const targetNonce = hoursNonce;

    listWorkingHours({ signal: controller.signal }).then(
      (items) => {
        if (controller.signal.aborted) return;
        setHoursState({
          identity: targetIdentity,
          nonce: targetNonce,
          status: "ready",
          data: items,
          error: null,
        });
      },
      (err) => {
        if (isRequestCancelled(err) || controller.signal.aborted) return;
        const info = classifyProviderError(err, "list-working-hours");
        if (info.retryAfterSeconds && info.retryAfterSeconds > 0) {
          const now = Date.now();
          setNowMs(now);
          setHoursCooldownUntil(now + info.retryAfterSeconds * 1000);
        }
        setHoursState({
          identity: targetIdentity,
          nonce: targetNonce,
          status: "error",
          data: null,
          error: info,
        });
      },
    );

    return () => {
      controller.abort();
    };
  }, [enabled, hidePrivateData, identity, hoursNonce]);

  if (hidePrivateData || !enabled || !identity) {
    return null;
  }

  const modulesLocale = vi.provider.profile.modules;
  const servicesCooldown =
    servicesCooldownUntil && servicesCooldownUntil > nowMs
      ? Math.ceil((servicesCooldownUntil - nowMs) / 1000)
      : 0;
  const hoursCooldown =
    hoursCooldownUntil && hoursCooldownUntil > nowMs
      ? Math.ceil((hoursCooldownUntil - nowMs) / 1000)
      : 0;

  const servicesFresh =
    servicesState.identity === identity && servicesState.nonce === servicesNonce;
  const hoursFresh =
    hoursState.identity === identity && hoursState.nonce === hoursNonce;

  const servicesSummary =
    servicesFresh && servicesState.status === "ready" && servicesState.data
      ? summarizeLiveServices(servicesState.data)
      : null;

  const hoursSummary =
    hoursFresh && hoursState.status === "ready" && hoursState.data
      ? summarizeLiveWorkingHours(hoursState.data)
      : null;

  const extraActiveServices = servicesSummary
    ? Math.max(0, servicesSummary.activeServices.length - MAX_PREVIEW_SERVICES)
    : 0;

  return (
    <>
      <div className={styles.modules}>
        <section
          className={`${styles.card} ${styles.moduleCard}`}
          aria-labelledby="profile-services-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="profile-services-title">{modulesLocale.servicesTitle}</h2>
            <Link
              className={styles.outlineButton}
              href="/dashboard/services"
              prefetch={false}
            >
              {modulesLocale.servicesLink}
              <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </div>

          {!servicesFresh || servicesState.status === null ? (
            <p className={styles.help} role="status">
              {modulesLocale.servicesLoading}
            </p>
          ) : servicesState.status === "error" ? (
            <div className={styles.moduleError} role="alert">
              <p>
                {servicesState.error
                  ? getProviderErrorMessage(
                      servicesState.error,
                      servicesCooldown,
                    )
                  : modulesLocale.servicesError}
              </p>
              <button
                type="button"
                className={styles.outlineButton}
                disabled={servicesCooldown > 0}
                onClick={() => setServicesNonce((current) => current + 1)}
              >
                <RefreshCw aria-hidden="true" size={14} />
                {modulesLocale.retrySection}
              </button>
            </div>
          ) : servicesSummary && servicesSummary.totalCount === 0 ? (
            <p className={styles.help}>{modulesLocale.servicesEmpty}</p>
          ) : (
            servicesSummary && (
              <>
                <div className={styles.moduleStats}>
                  <strong>
                    {formatMessage(modulesLocale.servicesSummary, {
                      active: servicesSummary.activeCount,
                      inactive: servicesSummary.inactiveCount,
                    })}
                  </strong>
                  {servicesSummary.categoryNames.length > 0 && (
                    <span className={styles.help}>
                      {formatMessage(modulesLocale.servicesCategories, {
                        categories: servicesSummary.categoryNames.join(", "),
                      })}
                    </span>
                  )}
                </div>
                {servicesSummary.activeServices.length === 0 ? (
                  <p className={styles.help}>
                    {modulesLocale.servicesNoActive}
                  </p>
                ) : (
                  <>
                    <ul className={styles.services}>
                      {servicesSummary.activeServices
                        .slice(0, MAX_PREVIEW_SERVICES)
                        .map((service) => (
                          <li key={service.id}>{service.name}</li>
                        ))}
                    </ul>
                    {extraActiveServices > 0 && (
                      <p className={styles.help}>
                        {formatMessage(modulesLocale.servicesMore, {
                          count: extraActiveServices,
                        })}
                      </p>
                    )}
                  </>
                )}
              </>
            )
          )}
        </section>

        <section
          className={`${styles.card} ${styles.moduleCard}`}
          aria-labelledby="profile-hours-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="profile-hours-title">{modulesLocale.hoursTitle}</h2>
            <Link
              className={styles.outlineButton}
              href="/dashboard/availability"
              prefetch={false}
            >
              {modulesLocale.hoursLink}
              <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </div>

          {!hoursFresh || hoursState.status === null ? (
            <p className={styles.help} role="status">
              {modulesLocale.hoursLoading}
            </p>
          ) : hoursState.status === "error" ? (
            <div className={styles.moduleError} role="alert">
              <p>
                {hoursState.error
                  ? getProviderErrorMessage(hoursState.error, hoursCooldown)
                  : modulesLocale.hoursError}
              </p>
              <button
                type="button"
                className={styles.outlineButton}
                disabled={hoursCooldown > 0}
                onClick={() => setHoursNonce((current) => current + 1)}
              >
                <RefreshCw aria-hidden="true" size={14} />
                {modulesLocale.retrySection}
              </button>
            </div>
          ) : hoursSummary && hoursSummary.openDaysCount === 0 ? (
            <p className={styles.help}>{modulesLocale.hoursEmpty}</p>
          ) : (
            hoursSummary && (
              <>
                <div className={styles.moduleStats}>
                  <strong>
                    {formatMessage(modulesLocale.hoursSummary, {
                      openDays: hoursSummary.openDaysCount,
                    })}
                  </strong>
                </div>
                <dl className={styles.hours}>
                  {hoursSummary.groups.map((group) => (
                    <div key={group.key}>
                      <dt>{group.label}</dt>
                      <dd>{group.hours}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )
          )}
        </section>
      </div>
      <p className={styles.help}>{modulesLocale.liveHint}</p>
    </>
  );
}
