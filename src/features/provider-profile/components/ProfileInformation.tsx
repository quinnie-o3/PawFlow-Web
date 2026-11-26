import { Lock, Pencil } from "lucide-react";
import { vi } from "@/lib/locale";
import {
  formatProfileRating,
  formatProfileTimestamp,
} from "../profileLogic";
import type {
  ProfileEditSection,
  ProfileOwnerAccount,
  ProviderProfile,
} from "../types";
import styles from "../profile.module.css";

export default function ProfileInformation({
  profile,
  owner,
  canUpdateProfile,
  locked,
  onEdit,
}: {
  profile: ProviderProfile;
  owner: ProfileOwnerAccount | null;
  canUpdateProfile: boolean;
  locked: boolean;
  onEdit: (section: ProfileEditSection) => void;
}) {
  const editDisabled = !canUpdateProfile || locked;
  const fieldsLocale = vi.provider.profile.fields;
  const infoLocale = vi.provider.profile.information;

  return (
    <>
      <section
        className={styles.card}
        aria-labelledby="profile-facility-title"
      >
        <div className={styles.sectionHeading}>
          <h2 id="profile-facility-title">{infoLocale.title}</h2>
          <div className={styles.sectionActions}>
            {!canUpdateProfile && (
              <span className={styles.readonlyBadge}>
                <Lock aria-hidden="true" size={12} />
                {infoLocale.suspendedEditNote}
              </span>
            )}
            <button
              type="button"
              className={styles.outlineButton}
              disabled={editDisabled}
              onClick={() => onEdit("facility")}
              aria-label={infoLocale.editLabel}
            >
              <Pencil aria-hidden="true" size={14} />
              {vi.common.actions.edit}
            </button>
          </div>
        </div>
        <dl className={styles.fields}>
          <div>
            <dt>{fieldsLocale.businessName}</dt>
            <dd>{profile.businessName}</dd>
          </div>
          <div>
            <dt>
              {fieldsLocale.owner} · {infoLocale.readonlyTag}
            </dt>
            <dd>{owner?.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt>
              {fieldsLocale.rating} · {infoLocale.readonlyTag}
            </dt>
            <dd>
              {formatProfileRating(profile.ratingAvg, profile.ratingCount)}
            </dd>
          </div>
          <div>
            <dt>{fieldsLocale.createdAt}</dt>
            <dd>{formatProfileTimestamp(profile.createdAt)}</dd>
          </div>
          <div>
            <dt>{fieldsLocale.updatedAt}</dt>
            <dd>{formatProfileTimestamp(profile.updatedAt)}</dd>
          </div>
          <div className={styles.fieldWide}>
            <dt>{fieldsLocale.description}</dt>
            <dd
              className={`${styles.multiline} ${
                profile.description ? "" : styles.mutedValue
              }`}
            >
              {profile.description || infoLocale.noDescription}
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="profile-contact-title">
        <div className={styles.sectionHeading}>
          <h2 id="profile-contact-title">
            {vi.provider.profile.contact.title}
          </h2>
          <button
            type="button"
            className={styles.outlineButton}
            disabled={editDisabled}
            onClick={() => onEdit("contact")}
            aria-label={vi.provider.profile.contact.editLabel}
          >
            <Pencil aria-hidden="true" size={14} />
            {vi.common.actions.edit}
          </button>
        </div>
        <dl className={styles.fields}>
          <div className={styles.fieldWide}>
            <dt>{fieldsLocale.address}</dt>
            <dd>{profile.address}</dd>
          </div>
          <div>
            <dt>{fieldsLocale.phone}</dt>
            <dd className={profile.phone ? "" : styles.mutedValue}>
              {profile.phone || infoLocale.noPhone}
            </dd>
          </div>
          <div>
            <dt>
              {fieldsLocale.email} · {infoLocale.readonlyTag}
            </dt>
            <dd>{owner?.email ?? "—"}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
