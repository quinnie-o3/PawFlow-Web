import { vi } from "@/lib/locale";
import { Suspense } from "react";
import type { Metadata } from "next";
import DiscoveryPage from "@/features/customer-discovery/components/DiscoveryPage";

export const metadata: Metadata = { title: vi.discovery.metadata.search.title };
export default function Page() { return <Suspense fallback={<p role="status">{vi.discovery.metadata.search.loading}</p>}><DiscoveryPage /></Suspense>; }
