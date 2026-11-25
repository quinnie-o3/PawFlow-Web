"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import TurnstileField from "@/components/auth/TurnstileField";
import { useTurnstileProtectedSubmit } from "../hooks/useTurnstileProtectedSubmit";
import { AuthApiError } from "../services/authApi";
import {
  requestPasswordReset,
  resetPassword,
} from "../services/passwordRecovery";
import { TURNSTILE_ACTIONS } from "../turnstile/turnstileConfig";
import { describeSubmitBlock } from "../turnstile/protectedSubmit";
import { createApiClient } from "@/lib/api/transport";
import {
  clearClient,
  notifySessionChange,
  bootstrap,
  apiMessage,
} from "../../session/client";
import { ApiError, isRequestCancelled } from "@/lib/api/errors";
import { recoveryTokenFromFragment } from "./fragment";

type Mode = "forgot" | "reset" | "verify";
const inputStyle = "w-full rounded border border-[var(--border)] bg-white p-3";
const buttonStyle =
  "w-full rounded bg-[var(--accent-hover)] p-3 font-semibold text-white disabled:opacity-60";

export default function RecoveryPage({ mode }: { mode: Mode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(mode === "forgot");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyCooldown, setVerifyCooldown] = useState(0);
  useEffect(() => {
    if (!verifyCooldown) return;
    const timer = setTimeout(
      () => setVerifyCooldown((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [verifyCooldown]);
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);
  const request = useRef<AbortController | null>(null);
  const turnstile = useTurnstileProtectedSubmit(
    mode === "reset"
      ? TURNSTILE_ACTIONS.resetPassword
      : TURNSTILE_ACTIONS.forgotPassword,
  );

  useEffect(() => {
    function readFragment() {
      request.current?.abort();
      const value = recoveryTokenFromFragment(window.location.hash);
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
      setToken(value);
      setError(null);
      setMessage(null);
      setBusy(false);
      setReady(true);
    }
    if (mode !== "forgot") {
      if (!initialized.current) {
        initialized.current = true;
        readFragment();
      }
      window.addEventListener("hashchange", readFragment);
    }
    return () => {
      request.current?.abort();
      window.removeEventListener("hashchange", readFragment);
    };
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || verifyCooldown > 0 || (mode !== "forgot" && !token)) return;
    const form = new FormData(event.currentTarget);
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setMessage(null);
    const apiUrl = `${window.location.origin}/api/recovery`;
    try {
      if (mode === "forgot") {
        const result = await turnstile.submit((turnstileToken) =>
          requestPasswordReset(
            { email: String(form.get("email") ?? ""), turnstileToken },
            { apiUrl, signal: controller.signal },
          ),
        );
        if (!controller.signal.aborted) setMessage(result.message);
      } else if (mode === "reset") {
        const password = String(form.get("password") ?? "");
        if (password !== String(form.get("confirmPassword") ?? "")) {
          setError("Mật khẩu xác nhận không khớp.");
          return;
        }
        await turnstile.submit((turnstileToken) =>
          resetPassword(
            { token: token!, newPassword: password, turnstileToken },
            { apiUrl, signal: controller.signal },
          ),
        );
        if (!controller.signal.aborted) {
          clearClient();
          notifySessionChange();
          setToken(null);
          setMessage("Mật khẩu đã được đặt lại. Vui lòng đăng nhập lại.");
        }
      } else {
        await createApiClient({ apiUrl }).request("/auth/verify-email", {
          method: "POST",
          body: { token },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setToken(null);
          setMessage("Email đã được xác minh.");
          void bootstrap();
          notifySessionChange();
        }
      }
    } catch (cause) {
      if (!isRequestCancelled(cause) && !controller.signal.aborted) {
        if (
          mode === "verify" &&
          cause instanceof ApiError &&
          cause.retryAfterSeconds
        )
          setVerifyCooldown(cause.retryAfterSeconds);
        setError(
          describeSubmitBlock(cause) ??
            (cause instanceof AuthApiError
              ? cause.message
              : mode === "verify"
                ? cause instanceof ApiError && cause.status === 400
                  ? "Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng."
                  : apiMessage(cause)
                : "Không thể hoàn tất yêu cầu. Vui lòng thử lại."),
        );
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const title =
    mode === "forgot"
      ? "Quên mật khẩu"
      : mode === "reset"
        ? "Đặt lại mật khẩu"
        : "Xác minh email";
  return (
    <AuthPageLayout>
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
        <section
          className="w-full space-y-5 rounded-[20px] bg-[var(--surface-primary)] p-6 sm:p-10"
          aria-labelledby="recovery-title"
        >
          <h1
            id="recovery-title"
            className="text-2xl font-bold text-[var(--accent-hover)]"
          >
            {title}
          </h1>
          {!ready && <p role="status">Đang kiểm tra liên kết…</p>}
          {ready && mode !== "forgot" && !token && !message && (
            <p role="alert">
              Liên kết không hợp lệ hoặc không có mã. Vui lòng yêu cầu liên kết
              mới.
            </p>
          )}
          {ready && (mode === "forgot" || token) && !message && (
            <form onSubmit={submit} className="space-y-4">
              {mode === "forgot" && (
                <label className="block space-y-1">
                  <span>Email</span>
                  <input
                    className={inputStyle}
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={255}
                    required
                  />
                </label>
              )}
              {mode === "reset" && (
                <>
                  <label className="block space-y-1">
                    <span>Mật khẩu mới</span>
                    <input
                      className={inputStyle}
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      required
                    />
                  </label>
                  <label className="block space-y-1">
                    <span>Xác nhận mật khẩu</span>
                    <input
                      className={inputStyle}
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      required
                    />
                  </label>
                </>
              )}
              {mode !== "verify" && <TurnstileField turnstile={turnstile} />}
              <button
                className={buttonStyle}
                disabled={
                  busy ||
                  verifyCooldown > 0 ||
                  (mode !== "verify" && !turnstile.canSubmit)
                }
                type="submit"
              >
                {busy
                  ? "Đang xử lý…"
                  : verifyCooldown > 0
                    ? `Thử lại sau ${verifyCooldown} giây`
                    : turnstile.cooldownSeconds > 0 && mode !== "verify"
                      ? `Thử lại sau ${turnstile.cooldownSeconds} giây`
                      : mode === "forgot"
                        ? "Gửi yêu cầu"
                        : mode === "reset"
                          ? "Đặt lại mật khẩu"
                          : "Xác minh email"}
              </button>
            </form>
          )}
          {error && <p role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          <Link
            className="inline-block text-[var(--accent-hover)] underline"
            href="/login"
          >
            Về trang đăng nhập
          </Link>
          {mode === "reset" && !token && !message && (
            <p>
              <Link
                className="text-[var(--accent-hover)] underline"
                href="/forgot-password"
              >
                Yêu cầu liên kết mới
              </Link>
            </p>
          )}
        </section>
      </main>
    </AuthPageLayout>
  );
}
