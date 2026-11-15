import { vi, formatMessage } from "@/lib/locale";
import { Pencil } from "lucide-react";
import type { ProfileImages as Images } from "../types";
import ProfileImagePreview from "./ProfileImagePreview";
import styles from "../profile.module.css";

export default function ProfileImages({ images, onEdit }: { images: Images; onEdit: () => void }) {
  return <section className={styles.card} aria-labelledby="profile-images-title">
    <div className={styles.sectionHeading}>
      <h2 id="profile-images-title">{vi.provider.profile.images.title}</h2>
      <button type="button" className={styles.outlineButton} onClick={onEdit}><Pencil aria-hidden="true" size={14} />{vi.provider.profile.images.edit}</button>
    </div>
    <div className={styles.imageGrid}>{(["logo", "cover"] as const).map((slot) => <div className={styles.imageTile} key={slot}>
      <h3>{slot === "logo" ? vi.provider.profile.images.logo : vi.provider.profile.images.cover}</h3>
      <ProfileImagePreview slot={slot} image={images[slot]} />
      {images[slot] && <p className={styles.help}>{formatMessage(vi.provider.profile.images.memoryDescription, { fileName: images[slot].fileName, width: images[slot].width, height: images[slot].height })}</p>}
    </div>)}</div>
    <p className={styles.help}>{vi.provider.profile.images.storageHint}</p>
  </section>;
}
