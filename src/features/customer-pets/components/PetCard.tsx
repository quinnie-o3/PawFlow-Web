import type { CustomerPet, PetType } from "../types";
import { petAge } from "../petLogic";
import PetPhoto from "./PetPhoto";
import styles from "../pets.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function PetCard({ pet, petTypes, today, disabled, onDetails, onEdit, onDelete }: {
  pet: CustomerPet; petTypes: PetType[]; today: string; disabled: boolean;
  onDetails: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const type = petTypes.find((item) => item.id === pet.petTypeId)?.name ?? "Chưa có loài";
  return <li className={styles.card} data-pet-id={pet.id}>
    <PetPhoto image={pet.image} />
    <div className={styles.cardInformation}>
      <button id={"pet-detail-" + pet.id} type="button" className={styles.petName} disabled={disabled} aria-label={"Xem chi tiết " + pet.name} onClick={onDetails}>{pet.name}</button>
      <p>{[type, pet.breed, petAge(pet.birthDate, today)].filter(Boolean).join(" · ")}</p>
    </div>
    <div className={styles.cardActions}>
      <button type="button" className={ui.secondaryButton} disabled={disabled} aria-label={"Sửa hồ sơ " + pet.name} onClick={onEdit}>Sửa hồ sơ</button>
      <button type="button" className={ui.secondaryButton} disabled={disabled} aria-label={"Xóa hồ sơ " + pet.name} onClick={onDelete}>Xóa</button>
    </div>
  </li>;
}
