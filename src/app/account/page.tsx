import type { Metadata } from "next";
import CustomerAccountPage from "@/features/customer-account/components/CustomerAccountPage";

export const metadata: Metadata = { title: "Thông tin tài khoản | PawFlow" };

export default function AccountPage() {
  return <CustomerAccountPage />;
}
