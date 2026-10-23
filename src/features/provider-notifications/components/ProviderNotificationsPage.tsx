"use client";

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
    <div className={styles.providerTab}>DÀNH CHO PROVIDER</div>
    <header className={styles.intro}>
      <div><h1 id="notifications-title" tabIndex={-1}>Thông báo</h1><p>Cập nhật liên quan đến lịch hẹn, đánh giá và hồ sơ {notificationsMockFacility}</p></div>
      <p className={styles.unreadCount} role="status" aria-label="Số thông báo chưa đọc của bạn tại cơ sở">{state.loadStatus === "ready" ? `${String(notifications.unreadCount).padStart(2, "0")} chưa đọc` : state.loadStatus === "loading" ? "Đang tải…" : "Chưa tải được"}</p>
    </header>
    <p className={styles.mockNote}>Dữ liệu mô phỏng · {notificationsMockOwner} · Chủ cơ sở · {notificationsMockFacility}</p>
    <section className={styles.listCard} aria-labelledby="notifications-list-title" aria-busy={busy}>
      <div className={styles.listHeading}><h2 id="notifications-list-title">Thông báo của cơ sở</h2><p>Chỉ thông báo gửi cho bạn tại {notificationsMockFacility}.</p></div>
      <NotificationsToolbar filter={notifications.filter} onFilter={notifications.setFilter} unreadCount={notifications.unreadCount} disabled={busy || state.loadStatus !== "ready"} onReadAll={() => submit({ type: "readAll" })} />
      {state.loadStatus === "loading" ? <p className={styles.loading} role="status"><LoaderCircle aria-hidden="true" size={22} />Đang tải thông báo…</p>
        : state.loadStatus === "error" ? <div className={styles.empty}>
          <h3>Không tải được thông báo</h3><p role="alert">{state.feedback?.message}</p><button type="button" className={styles.softButton} onClick={() => notifications.load()}>Thử tải lại</button>
        </div> : <>
          {state.feedback && <NotificationsFeedback feedback={state.feedback} canRetry={!!state.failedCommand && !busy} onRetry={notifications.retry} />}
          {state.pending && <p className={styles.pending} role="status">{state.pending.command.type === "open" ? "Đang mở chi tiết…" : "Đang cập nhật trạng thái đọc…"}</p>}
          <NotificationsList notifications={notifications.visible} total={notifications.all.length} disabled={busy}
            pendingId={state.pending?.command.type === "readAll" ? undefined : state.pending?.command.id}
            onOpen={(id) => submit({ type: "open", id })} onRead={(id) => submit({ type: "read", id })} onClear={() => notifications.setFilter("all")} />
          <p className={styles.resultCount} role="status">Hiển thị {notifications.visible.length} / {notifications.all.length} thông báo của bạn tại cơ sở · Giờ Việt Nam (UTC+07:00)</p>
        </>}
    </section>
    <section className={styles.guidance} aria-labelledby="notifications-scope-title">
      <h2 id="notifications-scope-title">Thông báo & quyền truy cập</h2>
      <p>Danh sách và số chưa đọc chỉ tính thông báo dành cho Owner hiện tại tại {notificationsMockFacility}. Mở chi tiết thành công sẽ đánh dấu thông báo đó đã đọc.</p>
      <p>“Đánh dấu tất cả của tôi tại cơ sở là đã đọc” áp dụng toàn bộ danh sách của bạn tại cơ sở, kể cả thông báo ngoài bộ lọc.</p>
    </section>
    <NotificationsMockTools disabled={busy} failNextUpdate={notifications.failNextUpdate} onFailNextUpdate={notifications.setFailNextUpdate} onLoad={notifications.load} />
    {notifications.selected && <NotificationDetailsDialog notification={notifications.selected} onClose={closeDialog} />}
  </div>;
}
