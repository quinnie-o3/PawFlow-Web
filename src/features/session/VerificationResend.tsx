"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "./SessionProvider";
import { apiMessage, bffRequest } from "./client";
import { ApiError, isRequestCancelled } from "../../lib/api/errors";
export default function VerificationResend() {
  const session = useSession();
  const [message, setMessage] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [seconds, setSeconds] = useState(0);
  const request = useRef<AbortController | null>(null),
    lock = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  if (session.status === "pending")
    return <p role="status">Đang xác minh phiên…</p>;
  if (!session.session?.user)
    return (
      <p>
        Đăng nhập để gửi lại email xác minh.{" "}
        <Link href="/login">Đăng nhập</Link>
      </p>
    );
  if (session.session.user.emailVerified) return <p>Email đã được xác minh.</p>;
  async function resend() {
    if (lock.current || seconds) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    const controller = new AbortController();
    request.current = controller;
    try {
      await bffRequest("/auth/verify-email/resend", {
        method: "POST",
        body: {},
        signal: controller.signal,
      });
      setMessage(
        "Yêu cầu đã được tiếp nhận. Vui lòng kiểm tra hộp thư; chưa thể xác nhận email đã được phát.",
      );
      setSeconds(60);
    } catch (e) {
      if (!isRequestCancelled(e)) {
        setMessage(apiMessage(e));
        if (e instanceof ApiError && e.retryAfterSeconds)
          setSeconds(e.retryAfterSeconds);
      }
    } finally {
      lock.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="my-3 space-y-2">
      <p>
        Email chưa xác minh. Bạn vẫn có thể sử dụng tài khoản theo quyền hiện
        có.
      </p>
      <button
        type="button"
        className="rounded border px-3 py-2"
        disabled={busy || seconds > 0}
        onClick={() => void resend()}
      >
        {busy
          ? "Đang gửi…"
          : seconds
            ? `Thử lại sau ${seconds} giây`
            : "Gửi lại email xác minh"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
