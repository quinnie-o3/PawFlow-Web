import { vi } from "@/lib/locale";
import { Suspense } from "react";
import ProviderBookingsPage from "@/features/provider-bookings/components/ProviderBookingsPage";

export default function BookingsPage() {
  return <Suspense fallback={<p role="status">{vi.common.loading.bookings}</p>}><ProviderBookingsPage /></Suspense>;
}
