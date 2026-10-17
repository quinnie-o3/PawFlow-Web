"use client";

import Image from "next/image";
import Link from "next/link";
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
  if (provider) {
    return (
      <header className="relative z-30 flex h-[72px] shrink-0 items-center justify-between gap-4 bg-white px-4 xl:h-[120px] xl:px-[120px]">
        <Link href="/dashboard" aria-label="PawFlow Dashboard" className="flex shrink-0 items-center">
          <Image src="/logo.png" alt="" width={60} height={60} className="h-10 w-10 xl:h-[60px] xl:w-[60px]" preload />
          <Image src="/name.png" alt="PawFlow" width={115} height={30} className="h-auto w-[96px] xl:w-[115px]" preload />
        </Link>
        <nav aria-label="Dashboard navigation" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 min-[1440px]:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} prefetch={false} className="py-4">
              <span className="whitespace-nowrap text-[14px] font-bold leading-[22px] text-[var(--text-disabled)] hover:text-[var(--accent-hover)]">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3 xl:gap-[14px]">
          <Link href="/dashboard/notifications" prefetch={false} aria-label="Thông báo" className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] shadow-[var(--shadow-sm)]">
            <Image src="/dashboard/bell.svg" alt="" width={20} height={20} />
          </Link>
          <Link href="/dashboard/profile" prefetch={false} aria-label="Hồ sơ người dùng"><UserAvatar size={44} /></Link>
          <details className="relative min-[1440px]:hidden">
            <summary aria-label="Mở điều hướng" title="Điều hướng" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-[6px] bg-[var(--surface-primary)] text-[var(--accent-hover)] [&::-webkit-details-marker]:hidden">☰</summary>
            <nav aria-label="Điều hướng thu gọn" className="absolute right-0 top-full mt-2 w-[220px] rounded-[8px] bg-white p-2 shadow-lg">
              {navItems.map((item) => <Link key={item.href} href={item.href} prefetch={false} className="block rounded-[6px] px-3 py-2 text-[14px] leading-5 hover:bg-[var(--surface-primary)]">{item.label}</Link>)}
            </nav>
          </details>
        </div>
        <span tabIndex={0} title="Chưa hỗ trợ đổi ngôn ngữ" className="absolute right-7 top-[42px] hidden min-[1440px]:block">
          <button type="button" disabled aria-label="VI / EN: Chưa hỗ trợ đổi ngôn ngữ" className="flex h-9 w-[76px] cursor-not-allowed items-center justify-center rounded-[9px] bg-[var(--surface-primary)] text-[var(--accent-hover)]">
            <span className="text-[12px] font-semibold leading-[18px]">VI / EN</span>
          </button>
        </span>
      </header>
    );
  }

  return (
    <header
      className="relative h-[68px] w-full bg-white"
      style={{ fontFamily: "var(--font-be-vietnam-pro)" }}
    >
      <div className="relative flex h-full items-center px-[72px]">
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
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[50px]"
          aria-label="Dashboard navigation"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-[44px] items-center justify-center whitespace-nowrap text-center text-[14px] font-bold leading-[20px] text-[#999999] transition-colors hover:text-[#410075]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-[14px]">
          <Link
            href="/dashboard/notifications"
            aria-label="Thông báo"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#E5C3FF] text-[#410075] shadow-[0_0_15px_rgba(0,0,0,0.1)]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            >
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </Link>

          <Link href="/dashboard/profile" aria-label="Hồ sơ người dùng">
            <UserAvatar size={44} />
          </Link>
        </div>
      </div>
    </header>
  );
}
