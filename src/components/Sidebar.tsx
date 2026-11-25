"use client";

import { vi } from "@/lib/locale";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { Bell, BriefcaseBusiness, Building2, CalendarClock, CalendarDays, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Users } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import styles from "./Sidebar.module.css";

const sidebarItems = [
  { label: vi.common.navigation.overview, href: "/dashboard", icon: LayoutDashboard },
  { label: vi.common.navigation.bookings, href: "/dashboard/bookings", icon: CalendarDays },
  { label: vi.common.navigation.availability, href: "/dashboard/availability", icon: CalendarClock },
  { label: vi.common.navigation.services, href: "/dashboard/services", icon: BriefcaseBusiness },
  { label: vi.common.navigation.customers, href: "/dashboard/customers", icon: Users },
  { label: vi.common.navigation.notifications, href: "/dashboard/notifications", icon: Bell },
  { label: vi.common.navigation.providerProfile, href: "/dashboard/profile", icon: Building2 },
];

export default function Sidebar({ provider = false }: { provider?: boolean }) {
  const pathname = usePathname();
  const navigationId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = provider && collapsed;

  return (
    <aside
      className={`relative flex ${provider ? `${styles.provider}${isCollapsed ? ` ${styles.collapsed}` : ""}` : "w-[285px] overflow-hidden"} shrink-0 self-stretch flex-col rounded-[24px] bg-[#6F00C6] p-[18px]`}
      style={{ fontFamily: "var(--font-be-vietnam-pro)" }}
    >
      <div className={provider ? styles.brand : "relative mb-[20px] flex h-[68px] w-full items-center gap-[12px] px-[10px]"}>
        <Image
          src="/sidebar-logo.png"
          alt=""
          width={78}
          height={78}
          className="h-[34px] w-[34px] object-contain"
        />
        {!isCollapsed && <Image
          src="/webname.png"
          alt="PawFlow"
          width={317}
          height={82}
          className="h-auto w-[126px]"
        />}
        {provider && <button
          type="button"
          className={styles.toggle}
          aria-expanded={!isCollapsed}
          aria-controls={navigationId}
          aria-label={isCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
          title={isCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {isCollapsed ? <PanelLeftOpen aria-hidden="true" focusable="false" size={20} strokeWidth={2} /> : <PanelLeftClose aria-hidden="true" focusable="false" size={20} strokeWidth={2} />}
        </button>}
      </div>

      <div
        className={provider ? isCollapsed ? "hidden" : styles.identity : "mb-[18px] flex w-full items-center gap-[15px]"}
        role="group"
        aria-label={vi.common.a11y.userProfile}
      >
        {!provider && <UserAvatar size={54} />}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[4px]">
          <p className="whitespace-nowrap text-[18px] font-bold leading-[24px] text-white">
            Dane Nguyen
          </p>
          <div className="flex items-center gap-[4px] text-[13px] leading-[22px]">
            <span className="text-white">Dashboard</span>
            <span className="whitespace-nowrap font-semibold text-[#D6CCFF]">
              {vi.provider.shell.role}</span>
          </div>
        </div>
      </div>

      <nav
        id={navigationId}
        aria-label={provider ? vi.common.a11y.providerNavigation : undefined}
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
              title={isCollapsed ? item.label : undefined}
              aria-current={provider && isActive ? "page" : undefined}
              style={provider && !isActive ? { borderColor: "rgb(255 255 255 / 22%)" } : undefined}
              className={`flex h-[44px] items-center transition-colors ${provider ? `${styles.link} min-w-0 w-full shrink-0 ${isCollapsed ? "justify-center" : "gap-[10px] px-[14px]"}` : "px-[14px]"} ${
                isActive
                  ? "rounded-[22px] bg-[#F6F8FA]"
                  : "border-b border-white/[0.22]"
              }`}
            >
              {provider && <Icon aria-hidden="true" focusable="false" size={24} strokeWidth={2} className={`shrink-0 ${isActive ? "text-[#3025A7]" : "text-white"}`} />}
              <span
                className={isCollapsed ? "sr-only" : `whitespace-nowrap text-[16px] leading-[20px] ${
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
