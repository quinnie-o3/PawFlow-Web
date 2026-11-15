import { vi } from "@/lib/locale";
export default function Loading() {
  return <p role="status">{vi.admin.route.loading}</p>;
}
