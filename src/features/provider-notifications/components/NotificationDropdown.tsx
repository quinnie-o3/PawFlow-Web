"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatNotificationDateTime, selectRecentNotifications } from "../notificationLogic";
import { markAllNotificationsRead, useNotificationsStore } from "../notificationsStore";
import { NotificationIcon } from "./NotificationsList";
import styles from "../notificationDropdown.module.css";

const viewportGutter = 16;

export default function NotificationDropdown() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const notifications = useNotificationsStore();
  const unreadCount = notifications.filter((item) => item.readAt === null).length;
  const recent = selectRecentNotifications(notifications);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (root.current?.contains(document.activeElement)) trigger.current?.focus();
      setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // Right-aligned to the bell by default; shift right only when the panel would leave the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const element = panel.current;
      const anchor = root.current;
      if (!element || !anchor) return;
      const anchorRight = anchor.getBoundingClientRect().right;
      const overflow = viewportGutter - (anchorRight - element.offsetWidth);
      const room = document.documentElement.clientWidth - viewportGutter - anchorRight;
      element.style.setProperty("--panel-shift", `${Math.max(0, Math.min(overflow, room))}px`);
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  return <div ref={root} className={styles.root}
    onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={styles.trigger}
      aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined}
      onClick={() => setOpen((value) => !value)}>
      <Bell aria-hidden="true" focusable="false" size={20} strokeWidth={2} />
    </button>
    {open && <div ref={panel} id={`${id}-panel`} role="dialog" aria-labelledby={`${id}-title`} className={styles.panel}>
      <div className={styles.heading}>
        <h2 id={`${id}-title`}>Thông báo</h2>
        <button type="button" className={styles.readAll} disabled={unreadCount === 0} onClick={() => markAllNotificationsRead()}>
          <CheckCheck aria-hidden="true" focusable="false" size={18} strokeWidth={2} />Đánh dấu tất cả là đã đọc
        </button>
      </div>
      {recent.items.length === 0 ? <p className={styles.empty}>Chưa có thông báo</p>
        : <ul className={styles.list} aria-label="Thông báo gần đây">
          {recent.items.map((item) => <li key={item.id}>
            <Link href={`/dashboard/notifications/details/${encodeURIComponent(item.id)}`} prefetch={false}
              className={`${styles.item}${item.readAt === null ? ` ${styles.unread}` : ""}`} onClick={() => setOpen(false)}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.icon}><NotificationIcon kind={item.kind} /></span>
              <span className={styles.text}>
                <span className={styles.title}>{item.title}{item.readAt === null && <span className={styles.srOnly}> · Chưa đọc</span>}</span>
                <span className={styles.body}>{item.body}</span>
              </span>
              <time className={styles.time} dateTime={item.createdAt}>{formatNotificationDateTime(item.createdAt)}</time>
            </Link>
          </li>)}
        </ul>}
      {recent.hasMore && <Link href="/dashboard/notifications" prefetch={false} className={styles.viewAll} onClick={() => setOpen(false)}>Xem tất cả thông báo</Link>}
      <p className={styles.srOnly} role="status">{unreadCount === 0 ? "Tất cả thông báo đã được đánh dấu là đã đọc" : ""}</p>
    </div>}
  </div>;
}
