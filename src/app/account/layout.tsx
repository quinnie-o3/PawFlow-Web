import type { ReactNode } from "react";
import { Assistant, Be_Vietnam_Pro } from "next/font/google";
import CustomerWorkspaceProvider from "@/features/customer-workspace/CustomerWorkspaceProvider";
import CustomerShell from "@/features/customer-shell/components/CustomerShell";

const customerFont = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro", subsets: ["latin", "vietnamese"], weight: ["400", "600", "700"], display: "swap",
});
const supportingFont = Assistant({
  variable: "--font-assistant", subsets: ["latin"], weight: ["400"], display: "swap",
});

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <div className={customerFont.variable + " " + supportingFont.variable}>
    <CustomerWorkspaceProvider><CustomerShell>{children}</CustomerShell></CustomerWorkspaceProvider>
  </div>;
}
