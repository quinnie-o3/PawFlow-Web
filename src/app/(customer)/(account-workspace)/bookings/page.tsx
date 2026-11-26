import { Suspense } from "react";
import type { Metadata } from "next";
import { vi } from "@/lib/locale";
import CustomerBookingsPage from "@/features/customer-booking/components/CustomerBookingsPage";
import LiveBookingsPage from "@/features/customer-booking/components/LiveBookingsPage";
import {
  LIVE_BOOKING_STATUSES,
  type LiveBookingStatus,
} from "@/features/customer-booking/liveApi";
import { resolveBookingRouteSource } from "@/features/customer-booking/liveCancel";

export const metadata: Metadata = { title: vi.booking.metadata.list };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const source = resolveBookingRouteSource(resolved);
  if (source === "demo") {
    return (
      <Suspense fallback={<p role="status">{vi.booking.loading}</p>}>
        <CustomerBookingsPage />
      </Suspense>
    );
  }
  const rawStatus =
    typeof resolved.status === "string" ? resolved.status : "";
  const initialStatus: LiveBookingStatus | "" = LIVE_BOOKING_STATUSES.includes(
    rawStatus as LiveBookingStatus,
  )
    ? (rawStatus as LiveBookingStatus)
    : "";
  return (
    <Suspense fallback={<p role="status">{vi.booking.live.loading}</p>}>
      <LiveBookingsPage initialStatus={initialStatus} />
    </Suspense>
  );
}
