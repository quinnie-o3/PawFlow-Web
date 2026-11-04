import { Assistant, Be_Vietnam_Pro } from "next/font/google";
import type { ReactNode } from "react";
import CatalogWorkspace from "@/features/discovery-shell/CatalogWorkspace";
import DiscoveryHeader from "@/features/discovery-shell/components/DiscoveryHeader";
import DiscoveryFooter from "@/features/discovery-shell/components/DiscoveryFooter";
import styles from "@/features/discovery-shell/shell.module.css";

const assistant = Assistant({ subsets: ["latin", "latin-ext"], variable: "--font-assistant", display: "swap" });
const vietnam = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "600", "700"], variable: "--font-be-vietnam-pro", display: "swap" });
export default function DiscoveryLayout({ children }: { children: ReactNode }) {
  return <div lang="vi" className={`${assistant.variable} ${vietnam.variable} ${styles.surface}`}><CatalogWorkspace><DiscoveryHeader /><main id="discovery-content" tabIndex={-1}>{children}</main><DiscoveryFooter /></CatalogWorkspace></div>;
}
