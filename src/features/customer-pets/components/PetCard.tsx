import { vi, formatMessage } from "@/lib/locale";
import type { CustomerPet, PetType } from "../types";
import { petAge } from "../petLogic";
import PetPhoto from "./PetPhoto";
import styles from "../pets.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function PetCard({ pet, petTypes, today, disabled, onDetails, onEdit, onDelete }: {
  pet: CustomerPet; petTypes: PetType[]; today: string; disabled: boolean;
  onDetails: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const type = petTypes.find((item) => item.id === pet.petTypeId)?.name ?? vi.customer.pets.card.unknownType;
  return <li className={styles.card} data-pet-id={pet.id}>
    <PetPhoto image={pet.image} />
    <div className={styles.cardInformation}>
      <button id={"pet-detail-" + pet.id} type="button" className={styles.petName} disabled={disabled} aria-label={formatMessage(vi.customer.pets.card.detailsLabel, { petName: pet.name })} onClick={onDetails}>{pet.name}</button>
      <p>{[type, pet.breed, petAge(pet.birthDate, today)].filter(Boolean).join(" · ")}</p>
    </div>
    <div className={styles.cardActions}>
      <button type="button" className={ui.secondaryButton} disabled={disabled} aria-label={formatMessage(vi.customer.pets.card.editLabel, { petName: pet.name })} onClick={onEdit}>{vi.customer.pets.card.edit}</button>
      <button type="button" className={ui.secondaryButton} disabled={disabled} aria-label={formatMessage(vi.customer.pets.card.deleteLabel, { petName: pet.name })} onClick={onDelete}>{vi.common.actions.delete}</button>
    </div>
  </li>;
}
