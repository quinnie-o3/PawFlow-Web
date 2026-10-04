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

export default function Header() {
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
