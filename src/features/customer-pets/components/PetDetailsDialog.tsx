import CustomerDialog from "@/features/customer-shell/components/CustomerDialog";
import { petAge } from "../petLogic";
import type { CustomerPet, PetType } from "../types";
import PetPhoto from "./PetPhoto";
import styles from "../pets.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function PetDetailsDialog({ pet, petTypes, today, onClose, onEdit, onDelete }: {
  pet: CustomerPet; petTypes: PetType[]; today: string; onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return <CustomerDialog title={"Hồ sơ " + pet.name} description="Thông tin thú cưng đang lưu trong phiên dùng thử." busy={false} onClose={onClose} closeLabel="Đóng chi tiết">
    <div className={styles.detailPhoto}><PetPhoto image={pet.image} large /></div>
    <dl className={styles.details}>
      <div><dt>Tên thú cưng</dt><dd>{pet.name}</dd></div>
      <div><dt>Loài</dt><dd>{petTypes.find((item) => item.id === pet.petTypeId)?.name ?? "Chưa có dữ liệu"}</dd></div>
      <div><dt>Giống</dt><dd>{pet.breed ?? "Chưa có thông tin"}</dd></div>
      <div><dt>Ngày sinh</dt><dd>{pet.birthDate ? pet.birthDate.split("-").reverse().join("/") : "Chưa có ngày sinh"}</dd></div>
      <div><dt>Tuổi</dt><dd>{petAge(pet.birthDate, today)}</dd></div>
      <div><dt>Cân nặng</dt><dd>{pet.weight === null ? "Chưa có thông tin" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(pet.weight) + " kg"}</dd></div>
      <div className={styles.fullWidth}><dt>Ghi chú sức khỏe</dt><dd>{pet.healthNote ?? "Chưa có ghi chú"}</dd></div>
    </dl>
    <div className={styles.actions}>
      <button type="button" className={ui.secondaryButton} onClick={onDelete}>Xóa hồ sơ</button>
      <button type="button" className={ui.primaryButton} onClick={onEdit}>Chỉnh sửa hồ sơ</button>
    </div>
  </CustomerDialog>;
}
