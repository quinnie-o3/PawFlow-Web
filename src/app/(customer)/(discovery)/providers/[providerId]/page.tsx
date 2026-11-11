import { vi } from "@/lib/locale";
import { Suspense } from "react";
import type { Metadata } from "next";
import ProviderDetailPage from "@/features/customer-provider-detail/components/ProviderDetailPage";

export const metadata: Metadata = { title: vi.discovery.metadata.detail.title };
export default async function Page({ params }: { params: Promise<{ providerId: string }> }) { const { providerId } = await params; return <Suspense fallback={<p role="status">{vi.discovery.metadata.detail.loading}</p>}><ProviderDetailPage providerId={providerId} /></Suspense>; }
