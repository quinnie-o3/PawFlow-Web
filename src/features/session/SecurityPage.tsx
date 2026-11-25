"use client";
import Link from "next/link";
import AccountSecurity from "./AccountSecurity";
import { useSession } from "./SessionProvider";
import { roleHome } from "./model";
import ui from "../customer-shell/customerShell.module.css";
export default function SecurityPage() {
  const user = useSession().session?.user;
  if (!user) return null;
  return (
    <div className={ui.surface}>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold">Bảo mật tài khoản</h1>
        <Link className="underline" href={roleHome(user.role)}>
          Về trang của tôi
        </Link>
        <AccountSecurity />
      </main>
    </div>
  );
}
