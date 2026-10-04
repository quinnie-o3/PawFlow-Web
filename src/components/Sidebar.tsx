"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserAvatar from "@/components/ui/UserAvatar";

const sidebarItems = [
  { label: "Tổng quan", href: "/dashboard" },
  { label: "Lịch hẹn", href: "/dashboard/bookings" },
  { label: "Lịch khả dụng", href: "/dashboard/availability" },
  { label: "Dịch vụ", href: "/dashboard/services" },
  { label: "Khách hàng", href: "/dashboard/customers" },
  { label: "Thông báo", href: "/dashboard/notifications" },
  { label: "Hồ sơ cơ sở", href: "/dashboard/profile" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="relative flex w-[285px] shrink-0 self-stretch flex-col overflow-hidden rounded-[24px] bg-[#6F00C6] p-[18px]"
      style={{ fontFamily: "var(--font-be-vietnam-pro)" }}
    >
      <div className="relative mb-[20px] flex h-[68px] w-full items-center gap-[12px] px-[10px]">
        <Image
          src="/sidebar-logo.png"
          alt=""
          width={78}
          height={78}
          className="h-[34px] w-[34px] object-contain"
        />
        <Image
          src="/webname.png"
          alt="PawFlow"
          width={317}
          height={82}
          className="h-auto w-[126px]"
        />
      </div>

      <div
        className="mb-[18px] flex w-full items-center gap-[15px]"
        role="group"
        aria-label="Hồ sơ người dùng"
      >
        <UserAvatar size={54} />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[4px]">
          <p className="whitespace-nowrap text-[18px] font-bold leading-[24px] text-white">
            Dane Nguyen
          </p>
          <div className="flex items-center gap-[4px] text-[13px] leading-[22px]">
            <span className="text-white">Dashboard</span>
            <span className="whitespace-nowrap font-semibold text-[#D6CCFF]">
              Nhà cung cấp
            </span>
          </div>
        </div>
      </div>

      <nav className="flex w-full flex-col gap-1">
        {sidebarItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-[44px] items-center px-[14px] transition-colors ${
                isActive
                  ? "rounded-[22px] bg-[#F6F8FA]"
                  : "border-b border-white/[0.22]"
              }`}
            >
              <span
                className={`whitespace-nowrap text-[16px] leading-[20px] ${
                  isActive
                    ? "font-bold text-[#3025A7]"
                    : "font-semibold text-white"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
