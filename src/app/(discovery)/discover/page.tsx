import { Suspense } from "react";
import type { Metadata } from "next";
import DiscoveryPage from "@/features/customer-discovery/components/DiscoveryPage";

export const metadata: Metadata = { title: "Khám phá cơ sở & dịch vụ | PawFlow" };
export default function Page() { return <Suspense fallback={<p role="status">Đang mở trang khám phá…</p>}><DiscoveryPage /></Suspense>; }
