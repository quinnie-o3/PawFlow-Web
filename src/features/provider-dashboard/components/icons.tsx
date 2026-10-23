import { ArrowRight, Banknote, BriefcaseBusiness, CalendarDays, CalendarRange, CalendarX2, Star, TriangleAlert, UsersRound } from "lucide-react";

type DashboardIconProps = { className?: string };

export function CalendarIcon({ className }: DashboardIconProps) {
  return <CalendarRange aria-hidden="true" focusable="false" size={16} strokeWidth={2} color="var(--text-secondary)" className={className} />;
}
export function MetricCalendarIcon({ className }: DashboardIconProps) {
  return <CalendarDays aria-hidden="true" focusable="false" size={20} strokeWidth={2} color="var(--accent-hover)" className={className} />;
}
export function LinkIcon({ className, small = false }: DashboardIconProps & { small?: boolean }) {
  const size = small ? 14 : 16;
  return <ArrowRight aria-hidden="true" focusable="false" size={size} strokeWidth={2} color="var(--accent-hover)" className={className} />;
}
export function NotificationIcon({ className }: DashboardIconProps) {
  return <TriangleAlert aria-hidden="true" focusable="false" size={20} strokeWidth={2} color="var(--accent-hover)" className={className} />;
}
export function CancellationIcon({ className }: DashboardIconProps) {
  return <CalendarX2 aria-hidden="true" focusable="false" size={20} strokeWidth={2} color="var(--accent-hover)" className={className} />;
}
export function PaymentIcon({ className }: DashboardIconProps) {
  return <Banknote aria-hidden="true" focusable="false" size={20} strokeWidth={2} color="var(--accent-hover)" className={className} />;
}
export function StackIcon({ className }: DashboardIconProps) {
  return <BriefcaseBusiness aria-hidden="true" focusable="false" size={20} strokeWidth={2} color="var(--accent-hover)" className={className} />;
}
export function CardsIcon({ className }: DashboardIconProps) {
  return <UsersRound aria-hidden="true" focusable="false" size={20} strokeWidth={2} color="var(--accent-hover)" className={className} />;
}
export function ChartIcon({ className }: DashboardIconProps) {
  return <Star aria-hidden="true" focusable="false" size={20} strokeWidth={2} color="var(--accent-hover)" className={className} />;
}
