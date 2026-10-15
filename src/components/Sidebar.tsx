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

export default function Sidebar({ provider = false }: { provider?: boolean }) {
  const pathname = usePathname();

  if (provider) {
    return (
      <aside className="relative flex min-h-[1237px] w-[285px] shrink-0 self-stretch flex-col overflow-hidden rounded-[36px] bg-[#6f00c6] p-5">
        <div className="mt-[62px] flex h-[90px] shrink-0 items-start gap-[14px] px-[14px]">
          <Image src="/sidebar-logo.png" alt="" width={39} height={39} className="mt-5 h-[39px] w-[39px]" />
          <Image src="/webname.png" alt="PawFlow" width={159} height={42} className="mt-[14px] h-auto w-[159px]" />
        </div>
        <div role="group" aria-label="Hồ sơ người dùng" className="mt-[53px] flex h-[54px] shrink-0 items-center gap-[15px]">
          <UserAvatar size={54} />
          <div className="min-w-0">
            <p className="text-[20px] font-bold leading-[26px] text-white">Dane Nguyen</p>
            <p className="mt-1 whitespace-nowrap text-[12px] leading-[22px] text-white">Dashboard <span className="font-semibold text-[#d6ccff]">Nhà cung cấp</span></p>
          </div>
        </div>
        <nav aria-label="Điều hướng provider" className="mt-7 flex flex-col">
          {sidebarItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
            return <Link key={item.href} href={item.href} prefetch={false} aria-current={active ? "page" : undefined}
              className={`flex h-[54px] shrink-0 items-center gap-[10px] px-[15px] ${active ? "w-[302px] rounded-[27px] bg-[#f6f8fa]" : "border-b"}`}
              style={active ? undefined : { borderColor: "rgb(255 255 255 / 22%)" }}>
              <Image src={active ? "/dashboard/nav-active.svg" : "/dashboard/nav.svg"} alt="" width={24} height={24} className="shrink-0" />
              <span className={`whitespace-nowrap text-[18px] leading-[22px] ${active ? "font-bold text-[#3025a7]" : "font-semibold text-white"}`}>{item.label}</span>
            </Link>;
          })}
        </nav>
      </aside>
    );
  }

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
