import Image from "next/image";

type DashboardIconProps = { className?: string };

export function CalendarIcon({ className }: DashboardIconProps) {
  return <Image alt="" src="/dashboard/report-calendar.svg" width={16} height={16} className={className} />;
}
export function MetricCalendarIcon({ className }: DashboardIconProps) {
  return <Image alt="" src="/dashboard/calendar.svg" width={20} height={20} className={className} />;
}
export function LinkIcon({ className, small = false }: DashboardIconProps & { small?: boolean }) {
  const size = small ? 14 : 16;
  return <Image alt="" src={small ? "/dashboard/link-small.svg" : "/dashboard/link.svg"} width={size} height={size} className={className} />;
}
export function NotificationIcon({ className }: DashboardIconProps) {
  return <Image alt="" src="/dashboard/notification.svg" width={20} height={20} className={className} />;
}
export function PaymentIcon({ className }: DashboardIconProps) {
  return <Image alt="" src="/dashboard/payment.svg" width={20} height={20} className={className} />;
}
export function StackIcon({ className }: DashboardIconProps) {
  return <Image alt="" src="/dashboard/stack.svg" width={20} height={20} className={className} />;
}
export function CardsIcon({ className }: DashboardIconProps) {
  return <Image alt="" src="/dashboard/cards.svg" width={20} height={20} className={className} />;
}
export function ChartIcon({ className }: DashboardIconProps) {
  return <Image alt="" src="/dashboard/chart.svg" width={20} height={20} className={className} />;
}
