import { Building2, FolderTree, History, LayoutDashboard, MessageSquareWarning, ShieldCheck, Users } from "lucide-react";

export const adminNavigation = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/providers", label: "Duyệt cơ sở", icon: Building2 },
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { href: "/admin/reviews", label: "Đánh giá", icon: ShieldCheck },
  { href: "/admin/complaints", label: "Khiếu nại", icon: MessageSquareWarning },
  { href: "/admin/activity-logs", label: "Nhật ký", icon: History },
] as const;
