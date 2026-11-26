"use client";

import {
  AlertTriangle,
  Check,
  Circle,
  Lock,
  RefreshCw,
} from "lucide-react";
import { vi } from "@/lib/locale";
import type {
  ProviderApiErrorInfo,
  ProviderProfile,
} from "../liveApi";
import {
  getProviderErrorMessage,
  getProviderLifecycleCopy,
  type ProviderLifecycleTone,
} from "../lifecycle";
import type { ProviderProfileLoadStatus } from "../useProviderProfile";
import styles from "./ProviderWorkspace.module.css";

const BANNER_TONE_CLASS: Readonly<Record<ProviderLifecycleTone, string>> = {
  approved: styles.bannerApproved,
  pending: styles.bannerPending,
  rejected: styles.bannerRejected,
  suspended: styles.bannerSuspended,
};

const BADGE_TONE_CLASS: Readonly<Record<ProviderLifecycleTone, string>> = {
  approved: styles.badgeApproved,
  pending: styles.badgePending,
  rejected: styles.badgeRejected,
  suspended: styles.badgeSuspended,
};

export default function ProviderLifecycleBanner({
  status,
  profile,
  error,
  refreshError,
  reloading = false,
  cooldownSeconds = 0,
  onReload,
}: {
  status: ProviderProfileLoadStatus;
  profile: ProviderProfile | null;
  error?: ProviderApiErrorInfo | null;
  refreshError?: ProviderApiErrorInfo | null;
  reloading?: boolean;
  cooldownSeconds?: number;
  onReload?: () => void;
}) {
  const lifecycleLocale = vi.provider.workspace.lifecycle;

  if (status === "idle" || status === "loading") {
    return (
      <section
        className={styles.banner}
        aria-busy="true"
        aria-label={lifecycleLocale.loading}
      >
        <div role="status">
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonLine} />
          <p className="sr-only">{lifecycleLocale.loading}</p>
        </div>
      </section>
    );
  }

  if (status === "not-found") {
    return (
      <section
        className={`${styles.banner} ${styles.bannerNotFound}`}
        aria-labelledby="provider-lifecycle-title"
      >
        <div className={styles.bannerHeader}>
          <div className={styles.bannerCopy}>
            <h2 id="provider-lifecycle-title">
              {lifecycleLocale.notFound.title}
            </h2>
            <p>{lifecycleLocale.notFound.description}</p>
          </div>
          <span className={`${styles.badge} ${styles.badgeNeutral}`}>
            <AlertTriangle aria-hidden="true" size={13} />
            {lifecycleLocale.notFound.badge}
          </span>
        </div>
        {onReload && (
          <div className={styles.bannerActions}>
            <button
              type="button"
              className={styles.actionButton}
              disabled={reloading || cooldownSeconds > 0}
              onClick={onReload}
            >
              <RefreshCw aria-hidden="true" size={14} />
              {reloading
                ? lifecycleLocale.reloading
                : lifecycleLocale.notFound.reload}
            </button>
          </div>
        )}
      </section>
    );
  }

  if (status === "error" || !profile) {
    const message = error
      ? getProviderErrorMessage(error, cooldownSeconds)
      : vi.provider.workspace.errors.UNKNOWN_ERROR;
    return (
      <section
        className={`${styles.banner} ${styles.bannerError}`}
        aria-labelledby="provider-lifecycle-title"
      >
        <div className={styles.bannerHeader}>
          <div className={styles.bannerCopy}>
            <h2 id="provider-lifecycle-title">{lifecycleLocale.errorTitle}</h2>
            <p role="alert">{message}</p>
          </div>
        </div>
        {onReload && (
          <div className={styles.bannerActions}>
            <button
              type="button"
              className={styles.actionButton}
              disabled={reloading || cooldownSeconds > 0}
              onClick={onReload}
            >
              <RefreshCw aria-hidden="true" size={14} />
              {reloading ? lifecycleLocale.reloading : lifecycleLocale.retry}
            </button>
          </div>
        )}
      </section>
    );
  }

  const copy = getProviderLifecycleCopy(
    profile.approvalStatus,
    profile.businessName,
  );
  const { permissions } = copy;
  const capabilities = [
    {
      key: "profile",
      label: lifecycleLocale.capabilities.profile,
      allowed: permissions.canUpdateProfile,
    },
    {
      key: "resources",
      label: lifecycleLocale.capabilities.resources,
      allowed: permissions.canManageResources,
    },
    {
      key: "confirm",
      label: lifecycleLocale.capabilities.confirmBookings,
      allowed: permissions.canConfirmBookings,
    },
  ] as const;

  return (
    <section
      className={`${styles.banner} ${BANNER_TONE_CLASS[copy.tone]}`}
      aria-labelledby="provider-lifecycle-title"
    >
      <div className={styles.bannerHeader}>
        <div className={styles.bannerCopy}>
          <h2 id="provider-lifecycle-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <span className={`${styles.badge} ${BADGE_TONE_CLASS[copy.tone]}`}>
          <Circle
            aria-hidden="true"
            focusable="false"
            size={7}
            fill="currentColor"
          />
          {copy.badge}
        </span>
      </div>

      <ul
        className={styles.capabilities}
        aria-label={lifecycleLocale.permissionsLabel}
      >
        {capabilities.map((item) => (
          <li
            key={item.key}
            className={`${styles.capabilityChip} ${
              item.allowed ? styles.capabilityAllowed : styles.capabilityLocked
            }`}
          >
            {item.allowed ? (
              <Check aria-hidden="true" size={13} />
            ) : (
              <Lock aria-hidden="true" size={13} />
            )}
            <span>
              {item.label}:{" "}
              {item.allowed
                ? lifecycleLocale.capabilities.allowed
                : lifecycleLocale.capabilities.locked}
            </span>
          </li>
        ))}
      </ul>

      {refreshError && (
        <div className={styles.inlineAlert} role="alert">
          {getProviderErrorMessage(refreshError, cooldownSeconds)}
        </div>
      )}
    </section>
  );
}
