import { Suspense } from "react";
import type { Metadata } from "next";
import { vi } from "@/lib/locale";
import { CustomerBookingDetail } from "@/features/customer-booking/components/CustomerBookingsPage";
import { LiveBookingDetailPage } from "@/features/customer-booking/components/LiveBookingsPage";
import { resolveBookingRouteSource } from "@/features/customer-booking/liveCancel";

export const metadata: Metadata = { title: vi.booking.metadata.detail };

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bookingId }, resolved] = await Promise.all([params, searchParams]);
  const source = resolveBookingRouteSource(resolved);
  return (
    <Suspense
      fallback={
        <p role="status">
          {source === "demo" ? vi.booking.loading : vi.booking.live.detailLoading}
        </p>
      }
    >
      {source === "demo" ? (
        <CustomerBookingDetail bookingId={bookingId} />
      ) : (
        <LiveBookingDetailPage bookingId={bookingId} />
      )}
    </Suspense>
  );
}
