import { Suspense } from "react";
import type { Metadata } from "next";
import ProviderDetailPage from "@/features/customer-provider-detail/components/ProviderDetailPage";

export const metadata: Metadata = { title: "Chi tiết cơ sở & dịch vụ | PawFlow" };
export default async function Page({ params }: { params: Promise<{ providerId: string }> }) { const { providerId } = await params; return <Suspense fallback={<p role="status">Đang mở thông tin cơ sở…</p>}><ProviderDetailPage providerId={providerId} /></Suspense>; }
