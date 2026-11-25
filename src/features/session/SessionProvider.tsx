"use client";
import { Activity, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  subscribe,
  snapshot,
  serverSnapshot,
  connectSessionEvents,
  bootstrap,
  retrySession,
  clearClient,
  hasPendingLogout,
} from "./client";
import { roleHome } from "./model";
export const useSession = () =>
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
export default function SessionProvider({ children }: { children: ReactNode }) {
  const state = useSession(),
    path = usePathname();
  const identity = state.session?.user
    ? `${state.session.generation}:${state.session.user.id}:${state.session.user.role}`
    : null;
  const [boundary, setBoundary] = useState<{ identity: string | null; key: number }>({ identity: null, key: 0 });
  if (boundary.identity !== identity) {
    // Initial bootstrap must not remount public forms after they consume a URL fragment.
    setBoundary({ identity, key: boundary.identity === null && boundary.key === 0 ? 0 : boundary.key + 1 });
  }
  useEffect(() => {
    const disconnect = connectSessionEvents();
    void bootstrap();
    const focus = () => {
      void bootstrap();
    };
    const visible = () => {
      if (document.visibilityState === "visible") focus();
    };
    // A visible idle tab must eventually observe revocation performed on another device.
    const refresh = window.setInterval(() => {
      if (snapshot().session?.user) visible();
    }, 60000);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        clearClient(hasPendingLogout() ? "error" : "pending");
        focus();
      }
    };
    window.addEventListener("pageshow", pageShow);
    return () => {
      disconnect();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
      window.clearInterval(refresh);
      window.removeEventListener("pageshow", pageShow);
    };
  }, []);
  useEffect(() => {
    void bootstrap();
  }, [path]);
  const customer = /^\/(account|bookings|notifications)(\/|$)/.test(path);
  const role = customer
    ? "CUSTOMER"
    : path.startsWith("/dashboard")
      ? "PROVIDER_OWNER"
      : path.startsWith("/admin")
        ? "ADMIN"
        : path.startsWith("/staff")
          ? "PROVIDER_STAFF"
          : null;
  const content = (failure: ReactNode = null) => <>
    {failure}
    <Activity key={/^\/(reset-password|verify-email)$/.test(path) ? "recovery" : boundary.key} mode={failure ? "hidden" : "visible"}>
      {children}
    </Activity>
  </>;
  if (role || path === "/security") {
    const frame = (body: ReactNode) => (
      <main className="mx-auto w-full max-w-xl space-y-4 p-8">{body}</main>
    );
    if (state.status === "pending")
      return frame(<p role="status">Đang khôi phục phiên…</p>);
    const failed = state.status === "error";
    const failure = failed ? frame(
        <>
          <p role="alert">Không thể xác minh phiên.</p>
          <button onClick={() => void retrySession().catch(() => {})}>
            Thử lại
          </button>
        </>,
      ) : null;
    if (failed && !state.session?.user) return failure;
    if (!state.session?.user)
      return frame(
        <>
          <p>Vui lòng đăng nhập để tiếp tục.</p>
          <Link href="/login">Đăng nhập</Link>
        </>,
      );
    if (role && state.session.user.role !== role)
      return frame(
        <>
          <p role="alert">Bạn không có quyền truy cập trang này.</p>
          <Link href="/security">Bảo mật tài khoản</Link>
          <Link href={roleHome(state.session.user.role)}>Về trang của tôi</Link>
        </>,
      );
    return content(failure);
  }
  return content();
}
