import { vi, formatMessage } from "@/lib/locale";
import CustomerDialog from "@/features/customer-shell/components/CustomerDialog";
import { petAge } from "../petLogic";
import type { CustomerPet, PetType } from "../types";
import PetPhoto from "./PetPhoto";
import styles from "../pets.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function PetDetailsDialog({ pet, petTypes, today, onClose, onEdit, onDelete }: {
  pet: CustomerPet; petTypes: PetType[]; today: string; onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return <CustomerDialog title={formatMessage(vi.customer.pets.details.title, { petName: pet.name })} description={vi.customer.pets.details.description} busy={false} onClose={onClose} closeLabel={vi.customer.pets.details.close}>
    <div className={styles.detailPhoto}><PetPhoto image={pet.image} large /></div>
    <dl className={styles.details}>
      <div><dt>{vi.customer.pets.details.name}</dt><dd>{pet.name}</dd></div>
      <div><dt>{vi.customer.pets.details.species}</dt><dd>{petTypes.find((item) => item.id === pet.petTypeId)?.name ?? vi.customer.pets.details.unknownData}</dd></div>
      <div><dt>{vi.customer.pets.details.breed}</dt><dd>{pet.breed ?? vi.customer.pets.details.unknownInfo}</dd></div>
      <div><dt>{vi.customer.pets.details.birthDate}</dt><dd>{pet.birthDate ? pet.birthDate.split("-").reverse().join("/") : vi.customer.pets.details.noBirthDate}</dd></div>
      <div><dt>{vi.customer.pets.details.age}</dt><dd>{petAge(pet.birthDate, today)}</dd></div>
      <div><dt>{vi.customer.pets.details.weight}</dt><dd>{pet.weight === null ? vi.customer.pets.details.unknownInfo : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(pet.weight) + " kg"}</dd></div>
      <div className={styles.fullWidth}><dt>{vi.customer.pets.details.healthNote}</dt><dd>{pet.healthNote ?? vi.customer.pets.details.noNote}</dd></div>
    </dl>
    <div className={styles.actions}>
      <button type="button" className={ui.secondaryButton} onClick={onDelete}>{vi.customer.pets.details.delete}</button>
      <button type="button" className={ui.primaryButton} onClick={onEdit}>{vi.customer.pets.details.edit}</button>
    </div>
  </CustomerDialog>;
}
