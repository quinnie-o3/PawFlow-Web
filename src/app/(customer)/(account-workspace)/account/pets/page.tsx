import { vi } from "@/lib/locale";
import type { Metadata } from "next";
import CustomerPetsPage from "@/features/customer-pets/components/CustomerPetsPage";

export const metadata: Metadata = { title: vi.customer.metadata.pets.title };

export default function PetsPage() {
  return <CustomerPetsPage />;
}
