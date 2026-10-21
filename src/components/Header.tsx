"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";

const navItems = [
  { label: "Tổng quan", href: "/dashboard" },
  { label: "Lịch hẹn", href: "/dashboard/bookings" },
  { label: "Lịch khả dụng", href: "/dashboard/availability" },
  { label: "Dịch vụ", href: "/dashboard/services" },
  { label: "Khách hàng", href: "/dashboard/customers" },
  { label: "Thông báo", href: "/dashboard/notifications" },
  { label: "Hồ sơ cơ sở", href: "/dashboard/profile" },
];

export default function Header({ provider = false }: { provider?: boolean }) {
  return (
    <header
      className={`relative h-[68px] w-full bg-white${provider ? " z-30 shrink-0" : ""}`}
      style={{ fontFamily: "var(--font-be-vietnam-pro)" }}
    >
      <div className={provider ? "relative flex h-full min-w-0 items-center px-4 min-[1440px]:px-[72px]" : "relative flex h-full items-center px-[72px]"}>
        <Link
          href="/dashboard"
          className="relative h-[48px] w-[145px] shrink-0"
          aria-label="PawFlow Dashboard"
        >
          <Image
            src="/logo.png"
            alt=""
            width={120}
            height={120}
            className="absolute left-0 top-0 h-[48px] w-[48px]"
            preload
          />
          <Image
            src="/name.png"
            alt="PawFlow"
            width={317}
            height={82}
            className="absolute left-[48px] -top-[6px] h-auto w-[96px]"
            preload
          />
        </Link>

        <nav
          className={`absolute left-1/2 top-1/2 ${provider ? "hidden min-[1440px]:flex" : "flex"} -translate-x-1/2 -translate-y-1/2 items-center gap-[50px]`}
          aria-label="Dashboard navigation"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={provider ? false : undefined}
              className="flex h-[44px] items-center justify-center whitespace-nowrap text-center text-[14px] font-bold leading-[20px] text-[#999999] transition-colors hover:text-[#410075]"
            >
              {provider ? <span className="text-[#999999] hover:text-[#410075]">{item.label}</span> : item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-[14px]">
          <Link
            href="/dashboard/notifications"
            prefetch={provider ? false : undefined}
            aria-label="Thông báo"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#E5C3FF] text-[#410075] shadow-[0_0_15px_rgba(0,0,0,0.1)]"
          >
            <Bell aria-hidden="true" focusable="false" size={20} strokeWidth={2} className={provider ? "text-[var(--color-stone)]" : undefined} />
          </Link>

          <Link href="/dashboard/profile" prefetch={provider ? false : undefined} aria-label="Hồ sơ người dùng">
            <UserAvatar size={44} />
          </Link>
          {provider && <>
            <details className="relative min-[1440px]:hidden">
              <summary aria-label="Mở điều hướng" title="Điều hướng" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-[6px] bg-[var(--surface-primary)] text-[var(--accent-hover)] [&::-webkit-details-marker]:hidden"><Menu aria-hidden="true" focusable="false" size={20} strokeWidth={2} /></summary>
              <nav aria-label="Điều hướng thu gọn" className="absolute right-0 top-full mt-2 w-[220px] rounded-[8px] bg-white p-2 shadow-lg">
                {navItems.map((item) => <Link key={item.href} href={item.href} prefetch={false} className="block rounded-[6px] px-3 py-2 text-[14px] leading-5 hover:bg-[var(--surface-primary)]">{item.label}</Link>)}
              </nav>
            </details>
            <span tabIndex={0} title="Chưa hỗ trợ đổi ngôn ngữ" className="hidden min-[1440px]:block">
              <button type="button" disabled aria-label="VI / EN: Chưa hỗ trợ đổi ngôn ngữ" className="flex h-9 w-[76px] cursor-not-allowed items-center justify-center rounded-[9px] bg-[var(--surface-primary)] text-[var(--accent-hover)]">
                <span className="text-[12px] font-semibold leading-[18px]">VI / EN</span>
              </button>
            </span>
          </>}
        </div>
      </div>
    </header>
  );
}
