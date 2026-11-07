import { vi } from "@/lib/locale";
import { Building2, FolderTree, History, LayoutDashboard, MessageSquareWarning, ShieldCheck, Users } from "lucide-react";

export const adminNavigation = [
  { href: "/admin", label: vi.admin.shell.navigation.overview, icon: LayoutDashboard },
  { href: "/admin/providers", label: vi.admin.shell.navigation.providers, icon: Building2 },
  { href: "/admin/users", label: vi.admin.shell.navigation.users, icon: Users },
  { href: "/admin/categories", label: vi.admin.shell.navigation.categories, icon: FolderTree },
  { href: "/admin/reviews", label: vi.admin.shell.navigation.reviews, icon: ShieldCheck },
  { href: "/admin/complaints", label: vi.admin.shell.navigation.complaints, icon: MessageSquareWarning },
  { href: "/admin/activity-logs", label: vi.admin.shell.navigation.activityLogs, icon: History },
] as const;
