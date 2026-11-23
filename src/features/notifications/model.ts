/** UI model mirrors the inbox projection; mock records are explicitly separate from API DTO validation. */
export type NotificationTarget = { type: "BOOKING" | "COMPLAINT" | "REVIEW" | "PROVIDER"; id: string };
export type InboxNotification = {
  id: string; type: string; title: string; body: string; createdAt: string;
  readAt: string | null; target: NotificationTarget | null;
};
export type ReadFilter = "all" | "unread" | "read";
export const unreadCount = (items: readonly InboxNotification[]) => items.filter(item => item.readAt === null).length;
export function selectInbox(items: readonly InboxNotification[], filter: ReadFilter) {
  return items.filter(item => filter === "all" || (filter === "unread" ? item.readAt === null : item.readAt !== null));
}
/** Capture IDs when the action starts: arrivals during read-all remain unread. */
export function markCapturedRead(items: readonly InboxNotification[], ids: ReadonlySet<string>, readAt: string) {
  return items.map(item => ids.has(item.id) && item.readAt === null ? { ...item, readAt } : item);
}

export type VerifiedTargets = { providerIds: ReadonlySet<string>; bookingIds: ReadonlySet<string> };
export function notificationDestination(target: NotificationTarget | null, verified: VerifiedTargets):
  { kind: "available"; href: string } | { kind: "none" | "missing" | "unsupported" } {
  if (!target) return { kind: "none" };
  if (target.type === "PROVIDER") return verified.providerIds.has(target.id) ? { kind: "available", href: "/providers/" + encodeURIComponent(target.id) } : { kind: "missing" };
  if (target.type === "BOOKING") return verified.bookingIds.has(target.id) ? { kind: "available", href: "/bookings/" + encodeURIComponent(target.id) } : { kind: "missing" };
  return { kind: "unsupported" };
}


/** A fixed inbox backlink is safe even after the session-only notification has expired. */
export function inboxReturnHref(notificationId: string | null, pathname: string, items: readonly InboxNotification[]): string | null {
  if (!notificationId || !/^[1-9]\d*$/.test(notificationId)) return null;
  const item = items.find(row => row.id === notificationId);
  if (!item) return /^\/(bookings|providers)\/[^/?#]+$/.test(pathname) ? "/notifications" : null;
  const target = item.target;
  const expected = target?.type === "BOOKING" ? "/bookings/" + encodeURIComponent(target.id) :
    target?.type === "PROVIDER" ? "/providers/" + encodeURIComponent(target.id) : null;
  return pathname === expected ? "/notifications" : null;
}
