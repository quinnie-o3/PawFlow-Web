import { Suspense } from "react";
import ProviderBookingsPage from "@/features/provider-bookings/components/ProviderBookingsPage";

export default function BookingsPage() {
  return <Suspense fallback={<p role="status">Đang tải lịch hẹn…</p>}><ProviderBookingsPage /></Suspense>;
}
