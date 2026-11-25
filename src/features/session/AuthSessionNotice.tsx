"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "./SessionProvider";
import { logout, bootstrap, hasPendingLogout, retrySession } from "./client";
import { roleHome } from "./model";
export default function AuthSessionNotice() {
  const state = useSession();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  if (!state.session?.user)
    return state.status === "error" ? (
      <div role="alert" className="mb-3 space-y-2">
        <p>
          {hasPendingLogout()
            ? "Chưa xác nhận đăng xuất. Phiên cũ sẽ không được khôi phục."
            : "Không thể xác minh phiên."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await retrySession();
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          Thử lại
        </button>
        {error && <p>Vui lòng kiểm tra kết nối trước khi thử lại.</p>}
      </div>
    ) : null;
  return (
    <div className="mb-3 space-y-2 rounded border p-3">
      <Link className="block underline" href="/security">
        Bảo mật tài khoản
      </Link>
      <p>
        Bạn đang đăng nhập.{" "}
        <Link className="underline" href={roleHome(state.session.user.role)}>
          Về trang của tôi
        </Link>
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await logout();
            await bootstrap();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        Đăng xuất để đổi tài khoản
      </button>
      {error && <p role="alert">Chưa xác nhận đăng xuất. Vui lòng thử lại.</p>}
    </div>
  );
}
