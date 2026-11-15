import { vi } from "@/lib/locale";
import type { Metadata } from "next";
import CustomerAccountPage from "@/features/customer-account/components/CustomerAccountPage";

export const metadata: Metadata = { title: vi.customer.metadata.account.title };

export default function AccountPage() {
  return <CustomerAccountPage />;
}
