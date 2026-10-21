"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, Building2, CalendarClock, CalendarDays, LayoutDashboard, Users } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";

const sidebarItems = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Lịch hẹn", href: "/dashboard/bookings", icon: CalendarDays },
  { label: "Lịch khả dụng", href: "/dashboard/availability", icon: CalendarClock },
  { label: "Dịch vụ", href: "/dashboard/services", icon: BriefcaseBusiness },
  { label: "Khách hàng", href: "/dashboard/customers", icon: Users },
  { label: "Thông báo", href: "/dashboard/notifications", icon: Bell },
  { label: "Hồ sơ cơ sở", href: "/dashboard/profile", icon: Building2 },
];

export default function Sidebar({ provider = false }: { provider?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={`relative flex ${provider ? "min-h-0 min-w-0 w-full" : "w-[285px] overflow-hidden"} shrink-0 self-stretch flex-col rounded-[24px] bg-[#6F00C6] p-[18px]`}
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

      <nav
        aria-label={provider ? "Điều hướng provider" : undefined}
        className={provider ? "flex min-h-0 min-w-0 w-full flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain" : "flex w-full flex-col gap-1"}
      >
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={provider ? false : undefined}
              aria-current={provider && isActive ? "page" : undefined}
              style={provider && !isActive ? { borderColor: "rgb(255 255 255 / 22%)" } : undefined}
              className={`flex h-[44px] items-center px-[14px] transition-colors ${provider ? "min-w-0 w-full shrink-0 gap-[10px]" : ""} ${
                isActive
                  ? "rounded-[22px] bg-[#F6F8FA]"
                  : "border-b border-white/[0.22]"
              }`}
            >
              {provider && <Icon aria-hidden="true" focusable="false" size={24} strokeWidth={2} className={`shrink-0 ${isActive ? "text-[#3025A7]" : "text-white"}`} />}
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
