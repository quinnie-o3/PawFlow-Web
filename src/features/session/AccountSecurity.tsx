"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  bffRequest,
  apiMessage,
  clearClient,
  notifySessionChange,
  logout,
} from "./client";
import { useSession } from "./SessionProvider";
import { isRequestCancelled } from "../../lib/api/errors";
import CustomerDialog from "../customer-shell/components/CustomerDialog";
import VerificationResend from "./VerificationResend";
import styles from "../customer-account/account.module.css";
import ui from "../customer-shell/customerShell.module.css";

type Device = {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
};
function decodeDevices(body: unknown): Device[] {
  if (!Array.isArray(body)) throw new Error("Invalid sessions");
  return body.map((value) => {
    if (
      !value ||
      typeof value.id !== "string" ||
      typeof value.current !== "boolean" ||
      ![value.createdAt, value.lastUsedAt, value.expiresAt].every(
        (v) => typeof v === "string" && Number.isFinite(Date.parse(v)),
      )
    )
      throw new Error("Invalid session");
    return {
      id: value.id,
      current: value.current,
      createdAt: value.createdAt,
      lastUsedAt: value.lastUsedAt,
      expiresAt: value.expiresAt,
      userAgent: typeof value.userAgent === "string" ? value.userAgent : null,
      ipAddress: typeof value.ipAddress === "string" ? value.ipAddress : null,
    };
  });
}
const time = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
export default function AccountSecurity() {
  const session = useSession(),
    router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [password, setPassword] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false),
    request = useRef<AbortController | null>(null);
  async function load() {
    request.current?.abort();
    const c = new AbortController();
    request.current = c;
    setLoading(true);
    setError(null);
    try {
      const result = await bffRequest("/auth/sessions", { signal: c.signal });
      setDevices(decodeDevices(result.body));
    } catch (e) {
      if (!isRequestCancelled(e)) setError(apiMessage(e));
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load();
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, []);
  function ended() {
    clearClient();
    notifySessionChange();
    router.replace("/login");
  }
  async function action(
    path: string,
    method: "POST" | "DELETE",
    body: unknown = {},
    end = false,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await bffRequest(path, { method, body });
      if (end) {
        ended();
        return;
      }
      setNotice("Đã cập nhật phiên đăng nhập.");
      await load();
    } catch (e) {
      if (!isRequestCancelled(e)) setError(apiMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("newPassword") !== data.get("confirm")) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    await action(
      "/auth/change-password",
      "POST",
      {
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
      },
      true,
    );
  }
  return (
    <>
      <section className={styles.security} aria-labelledby="security-title">
        <h2 id="security-title">Mật khẩu và phiên đăng nhập</h2>
        <VerificationResend />
        <div className="my-4 flex flex-wrap gap-3">
          <button
            className={ui.secondaryButton}
            onClick={() => {
              setError(null);
              setPassword(true);
            }}
          >
            Đổi mật khẩu
          </button>
          <button
            className={ui.secondaryButton}
            disabled={busy}
            onClick={() => void action("/auth/logout-all", "POST", {}, true)}
          >
            Đăng xuất tất cả phiên
          </button>
          <button
            className={ui.secondaryButton}
            disabled={busy}
            onClick={async () => {
              try {
                const ok = await logout();
                if (!ok)
                  window.alert(
                    "Đã kết thúc phiên trên trình duyệt này. Chưa xác nhận thu hồi phiên ở máy chủ.",
                  );
                router.replace("/login");
              } catch {
                window.alert(
                  "Không thể xác nhận đăng xuất ở máy chủ. Vui lòng thử lại khi có kết nối.",
                );
              }
            }}
          >
            Đăng xuất
          </button>
        </div>
        <h3 className="font-semibold">Các phiên đang hoạt động</h3>
        {loading && <p role="status">Đang tải phiên…</p>}
        {!loading && !devices.length && <p>Không có phiên để hiển thị.</p>}
        <ul className="my-3 space-y-3">
          {devices.map((device) => (
            <li key={device.id} className="break-words rounded border p-3">
              <p>
                {device.current
                  ? "Phiên hiện tại"
                  : (device.userAgent ?? "Thiết bị không xác định")}
              </p>
              <p>Hoạt động: {time(device.lastUsedAt)} (UTC+7)</p>
              <p>Hết hạn: {time(device.expiresAt)}</p>
              <button
                disabled={busy}
                className={ui.secondaryButton}
                onClick={() =>
                  void action(
                    `/auth/sessions/${device.id}`,
                    "DELETE",
                    {},
                    device.current,
                  )
                }
              >
                Thu hồi {device.current ? "phiên này" : "phiên"}
              </button>
            </li>
          ))}
        </ul>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button
          disabled={busy || loading}
          className={ui.secondaryButton}
          onClick={() => void load()}
        >
          Tải lại danh sách phiên
        </button>
      </section>
      {password && session.session?.user && (
        <CustomerDialog
          title="Đổi mật khẩu"
          description="Đổi mật khẩu sẽ kết thúc tất cả phiên, gồm phiên này. Bạn cần đăng nhập lại."
          busy={busy}
          onClose={() => {
            if (!busy) setPassword(false);
          }}
        >
          <form onSubmit={changePassword} className={styles.form}>
            <fieldset disabled={busy} className={styles.fields}>
              <label className={styles.field}>
                Mật khẩu hiện tại
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={72}
                />
              </label>
              <label className={styles.field}>
                Mật khẩu mới
                <input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                />
              </label>
              <label className={styles.field}>
                Xác nhận mật khẩu mới
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                />
              </label>
            </fieldset>
            {error && <p role="alert">{error}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={ui.secondaryButton}
                disabled={busy}
                onClick={() => setPassword(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={ui.primaryButton}
                disabled={busy}
              >
                {busy ? "Đang lưu…" : "Lưu mật khẩu"}
              </button>
            </div>
          </form>
        </CustomerDialog>
      )}
    </>
  );
}
