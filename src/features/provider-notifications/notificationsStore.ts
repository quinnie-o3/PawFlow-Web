import { useSyncExternalStore } from "react";
import { createNotificationsMockData, notificationsMockNow, notificationsMockScope } from "./data/providerNotificationsMock";
import { mergeReadState, selectNotifications } from "./notificationLogic";
import type { ProviderNotification } from "./types";

// Session-only read state shared by the Header dropdown and the Notifications page. Resets on reload.
const initial = selectNotifications(createNotificationsMockData(), notificationsMockScope, "all").all;
let snapshot = initial;
const listeners = new Set<() => void>();

function publish(next: ProviderNotification[]) {
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function getNotificationsSnapshot() {
  return snapshot;
}

export function subscribeNotifications(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function syncNotificationReads(source: readonly ProviderNotification[]) {
  publish(mergeReadState(snapshot, source));
}

export function markAllNotificationsRead(now = notificationsMockNow) {
  syncNotificationReads(snapshot.map((item) => ({ ...item, readAt: item.readAt ?? now })));
}

export function resetNotificationsStore() {
  publish(initial);
}

export function useNotificationsStore() {
  return useSyncExternalStore(subscribeNotifications, getNotificationsSnapshot, () => initial);
}
