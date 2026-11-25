import type { Metadata } from "next";
import { vi } from "@/lib/locale";
import CustomerInboxPage from "@/features/customer-notifications/CustomerInboxPage";

export const metadata: Metadata = { title: vi.customerInbox.metadata };
export default function NotificationsPage() { return <CustomerInboxPage />; }
