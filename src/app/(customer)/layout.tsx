import type { ReactNode } from "react";
import CustomerWorkspaceProvider from "@/features/customer-workspace/CustomerWorkspaceProvider";
import CatalogWorkspace from "@/features/discovery-shell/CatalogWorkspace";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <CustomerWorkspaceProvider><CatalogWorkspace>{children}</CatalogWorkspace></CustomerWorkspaceProvider>;
}
