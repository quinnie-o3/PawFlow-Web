"use client";

import { vi, formatMessage } from "@/lib/locale";

import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { notificationsMockFacility, notificationsMockOwner } from "../data/providerNotificationsMock";
import { useNotificationsMock } from "../useNotificationsMock";
import type { NotificationCommand } from "../types";
import NotificationDetailsDialog from "./NotificationDetailsDialog";
import NotificationsFeedback from "./NotificationsFeedback";
import NotificationsList from "./NotificationsList";
import NotificationsMockTools from "./NotificationsMockTools";
import NotificationsToolbar from "./NotificationsToolbar";
import styles from "../notifications.module.css";

export default function ProviderNotificationsPage() {
  const notifications = useNotificationsMock();
  const { state } = notifications;
  const trigger = useRef<HTMLElement | null>(null);
  const busy = state.loadStatus === "loading" || !!state.pending;
  useEffect(() => {
    if (state.pending || !state.feedback || state.selectedId) return;
    const frame = window.requestAnimationFrame(() => {
      if (document.activeElement === document.body) document.getElementById("notifications-title")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.pending, state.feedback, state.selectedId]);

  function submit(command: NotificationCommand) {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    notifications.submit(command);
  }
  function closeDialog() {
    notifications.close();
    window.requestAnimationFrame(() => {
      const target = trigger.current;
      if (target?.isConnected && !target.matches(":disabled")) target.focus();
      else document.getElementById("notifications-title")?.focus();
    });
  }
  return <div className={styles.page} lang="vi">
    <div className={styles.providerTab}>{vi.provider.notifications.page.providerTab}</div>
    <header className={styles.intro}>
      <div><h1 id="notifications-title" tabIndex={-1}>{vi.provider.notifications.page.title}</h1><p>{formatMessage(vi.provider.notifications.page.description, { facilityName: notificationsMockFacility })}</p></div>
      <p className={styles.unreadCount} role="status" aria-label={vi.provider.notifications.page.unreadLabel}>{state.loadStatus === "ready" ? formatMessage(vi.provider.notifications.page.unreadCount, { count: String(notifications.unreadCount).padStart(2, "0") }) : state.loadStatus === "loading" ? vi.provider.notifications.page.loadingShort : vi.provider.notifications.page.loadUnavailable}</p>
    </header>
    <p className={styles.mockNote}>{formatMessage(vi.provider.notifications.page.mockNote, { ownerName: notificationsMockOwner, facilityName: notificationsMockFacility })}</p>
    <section className={styles.listCard} aria-labelledby="notifications-list-title" aria-busy={busy}>
      <div className={styles.listHeading}><h2 id="notifications-list-title">{vi.provider.notifications.page.listTitle}</h2><p>{formatMessage(vi.provider.notifications.page.scopeDescription, { facilityName: notificationsMockFacility })}</p></div>
      <NotificationsToolbar filter={notifications.filter} onFilter={notifications.setFilter} unreadCount={notifications.unreadCount} disabled={busy || state.loadStatus !== "ready"} onReadAll={() => submit({ type: "readAll" })} />
      {state.loadStatus === "loading" ? <p className={styles.loading} role="status"><LoaderCircle aria-hidden="true" size={22} />{vi.provider.notifications.page.loading}</p>
        : state.loadStatus === "error" ? <div className={styles.empty}>
          <h3>{vi.provider.notifications.page.loadFailed}</h3><p role="alert">{state.feedback?.message}</p><button type="button" className={styles.softButton} onClick={() => notifications.load()}>{vi.provider.notifications.page.retryLoad}</button>
        </div> : <>
          {state.feedback && <NotificationsFeedback feedback={state.feedback} canRetry={!!state.failedCommand && !busy} onRetry={notifications.retry} />}
          {state.pending && <p className={styles.pending} role="status">{state.pending.command.type === "open" ? vi.provider.notifications.page.opening : vi.provider.notifications.page.updatingRead}</p>}
          <NotificationsList notifications={notifications.visible} total={notifications.all.length} disabled={busy}
            pendingId={state.pending?.command.type === "readAll" ? undefined : state.pending?.command.id}
            onOpen={(id) => submit({ type: "open", id })} onRead={(id) => submit({ type: "read", id })} onClear={() => notifications.setFilter("all")} />
          <p className={styles.resultCount} role="status">{formatMessage(vi.provider.notifications.page.resultCount, { visible: notifications.visible.length, total: notifications.all.length })}</p>
        </>}
    </section>
    <section className={styles.guidance} aria-labelledby="notifications-scope-title">
      <h2 id="notifications-scope-title">{vi.provider.notifications.page.accessTitle}</h2>
      <p>{formatMessage(vi.provider.notifications.page.accessDescription, { facilityName: notificationsMockFacility })}</p>
      <p>{vi.provider.notifications.page.bulkReadExplanation}</p>
    </section>
    <NotificationsMockTools disabled={busy} failNextUpdate={notifications.failNextUpdate} onFailNextUpdate={notifications.setFailNextUpdate} onLoad={notifications.load} />
    {notifications.selected && <NotificationDetailsDialog notification={notifications.selected} onClose={closeDialog} />}
  </div>;
}
