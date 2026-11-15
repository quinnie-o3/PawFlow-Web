import { vi } from "@/lib/locale";
import { Pencil } from "lucide-react";
import type { ProfileSection, ProviderProfile } from "../types";
import styles from "../profile.module.css";

export default function ProfileInformation({ profile, onEdit }: {
  profile: ProviderProfile;
  onEdit: (section: ProfileSection) => void;
}) {
  return <>
    <section className={styles.card} aria-labelledby="profile-facility-title">
      <div className={styles.sectionHeading}>
        <h2 id="profile-facility-title">{vi.provider.profile.information.title}</h2>
        <button type="button" className={styles.outlineButton} onClick={() => onEdit("facility")} aria-label={vi.provider.profile.information.editLabel}><Pencil aria-hidden="true" size={14} />{vi.common.actions.edit}</button>
      </div>
      <dl className={styles.fields}>
        <div><dt>{vi.provider.profile.fields.name}</dt><dd>{profile.name}</dd></div>
        <div><dt>{vi.provider.profile.information.ownerReadonly}</dt><dd>{profile.ownerName}</dd></div>
        <div><dt>{vi.provider.profile.information.categoryReadonly}</dt><dd>{profile.category}</dd></div>
        <div><dt>{vi.provider.profile.fields.description}</dt><dd className={styles.multiline}>{profile.description || vi.provider.profile.information.noDescription}</dd></div>
      </dl>
    </section>
    <section className={styles.card} aria-labelledby="profile-contact-title">
      <div className={styles.sectionHeading}>
        <h2 id="profile-contact-title">{vi.provider.profile.contact.title}</h2>
        <button type="button" className={styles.outlineButton} onClick={() => onEdit("contact")} aria-label={vi.provider.profile.contact.editLabel}><Pencil aria-hidden="true" size={14} />{vi.common.actions.edit}</button>
      </div>
      <dl className={styles.fields}>
        <div><dt>{vi.provider.profile.fields.area}</dt><dd>{profile.area}</dd></div>
        <div><dt>{vi.provider.profile.fields.phone}</dt><dd>{profile.phone}</dd></div>
        <div><dt>{vi.provider.profile.fields.email}</dt><dd>{profile.email}</dd></div>
      </dl>
    </section>
  </>;
}
