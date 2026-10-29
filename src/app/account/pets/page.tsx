import type { Metadata } from "next";
import CustomerPetsPage from "@/features/customer-pets/components/CustomerPetsPage";

export const metadata: Metadata = { title: "Thú cưng của tôi | PawFlow" };

export default function PetsPage() {
  return <CustomerPetsPage />;
}
