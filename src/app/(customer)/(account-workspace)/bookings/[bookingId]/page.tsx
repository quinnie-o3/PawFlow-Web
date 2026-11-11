import type { Metadata } from "next";
import { vi } from "@/lib/locale";
import { CustomerBookingDetail } from "@/features/customer-booking/components/CustomerBookingsPage";

export const metadata: Metadata = { title: vi.booking.metadata.detail };
export default async function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <CustomerBookingDetail bookingId={bookingId} />;
}
