import type { ReactNode } from "react";
import CustomerWorkspaceProvider from "@/features/customer-workspace/CustomerWorkspaceProvider";
import CustomerInboxProvider from "@/features/customer-notifications/CustomerInboxProvider";
import CatalogWorkspace from "@/features/discovery-shell/CatalogWorkspace";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <CustomerWorkspaceProvider><CatalogWorkspace><CustomerInboxProvider>{children}</CustomerInboxProvider></CatalogWorkspace></CustomerWorkspaceProvider>;
}
