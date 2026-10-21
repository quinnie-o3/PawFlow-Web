"use client";

import { useEffect, useReducer, useState } from "react";
import { createNotificationsMockData, notificationsMockNow, notificationsMockScope } from "./data/providerNotificationsMock";
import { createNotificationsState, notificationsReducer, selectNotifications } from "./notificationLogic";
import type { NotificationCommand, NotificationFilter } from "./types";

export function useNotificationsMock() {
  const [state, dispatch] = useReducer(notificationsReducer, undefined, createNotificationsState);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [failNextUpdate, setFailNextUpdate] = useState(false);
  useEffect(() => {
    if (!state.loadRequest) return;
    const request = state.loadRequest;
    const timer = window.setTimeout(() => dispatch({ type: "loaded", source: createNotificationsMockData(request.empty, request.longContent), scope: notificationsMockScope }), 350);
    return () => window.clearTimeout(timer);
  }, [state.loadRequest]);
  useEffect(() => {
    if (!state.pending) return;
    const timer = window.setTimeout(() => dispatch({ type: "resolve", scope: notificationsMockScope, now: notificationsMockNow }), 350);
    return () => window.clearTimeout(timer);
  }, [state.pending]);

  function submit(command: NotificationCommand) {
    if (state.pending || state.loadStatus !== "ready") return;
    dispatch({ type: "submit", command, simulateFailure: failNextUpdate });
    setFailNextUpdate(false);
  }
  function load(options: { empty?: boolean; longContent?: boolean; simulateFailure?: boolean } = {}) {
    dispatch({ type: "load", ...options });
    setFilter("all");
    setFailNextUpdate(false);
  }
  const selection = selectNotifications(state.notifications, notificationsMockScope, filter);
  return { state, ...selection, filter, setFilter, failNextUpdate, setFailNextUpdate, submit, load,
    selected: selection.all.find((item) => item.id === state.selectedId),
    retry: () => { if (state.failedCommand) submit(state.failedCommand); },
    close: () => dispatch({ type: "close" }),
  };
}
