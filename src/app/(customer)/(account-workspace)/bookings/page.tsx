import { Suspense } from "react";
import type { Metadata } from "next";
import { vi } from "@/lib/locale";
import CustomerBookingsPage from "@/features/customer-booking/components/CustomerBookingsPage";

export const metadata: Metadata = { title: vi.booking.metadata.list };
export default function BookingsPage() {
  return <Suspense fallback={<p role="status">{vi.booking.loading}</p>}><CustomerBookingsPage /></Suspense>;
}
