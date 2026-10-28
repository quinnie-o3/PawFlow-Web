import AdminCollection from "@/features/admin-workspace/components/AdminCollection";
import { definition, records } from "../data/mock";

export default function AdminProvidersPage() {
  return <AdminCollection definition={definition} fixture={records} />;
}
