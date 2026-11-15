import { vi } from "@/lib/locale";
import StaffDialog from "./StaffDialog";
import styles from "../staffBookings.module.css";

export default function StaffPermissionsDialog({ onClose }: { onClose: () => void }) {
  return <StaffDialog title={vi.staff.permissions.title} onClose={onClose}>
    <div className={styles.permissionCopy}>
      <p>Ngọc Mai · PawCare Studio</p>
      <p>{vi.staff.permissions.membershipRule}</p>
      <p>{vi.staff.permissions.transitionsRule}</p>
      <p>{vi.staff.permissions.timingRule}</p>
      <p>{vi.staff.permissions.bookingProjectionRule}</p>
      <p>{vi.staff.permissions.restrictedAreasRule}</p>
      <p>{vi.staff.permissions.ownerPaymentRule}</p>
      <p>{vi.staff.permissions.mockLimitation}</p>
    </div>
  </StaffDialog>;
}
