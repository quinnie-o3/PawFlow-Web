"use client";

import { RefreshCw } from "lucide-react";
import { formatMessage, vi } from "@/lib/locale";
import ProviderWorkspaceDialog from "@/features/provider-workspace/components/ProviderWorkspaceDialog";
import { getProviderErrorMessage } from "@/features/provider-workspace/lifecycle";
import { profileSectionFields } from "../profileLogic";
import { profileFieldLimits } from "../profileValidation";
import type {
  ProfileEditorState,
  ProfileFormValues,
  ProfileOwnerAccount,
  ProviderProfile,
} from "../types";
import styles from "../profile.module.css";

const FIELD_LABELS: Readonly<Record<keyof ProfileFormValues, string>> = {
  businessName: vi.provider.profile.fields.businessName,
  description: vi.provider.profile.fields.description,
  address: vi.provider.profile.fields.address,
  phone: vi.provider.profile.fields.phone,
};

export default function ProfileEditDialog({
  profile,
  owner,
  editor,
  hasChanges,
  canUpdateProfile,
  locked,
  cooldownSeconds,
  onChange,
  onSave,
  onReconcile,
  onClose,
}: {
  profile: ProviderProfile;
  owner: ProfileOwnerAccount | null;
  editor: ProfileEditorState;
  hasChanges: boolean;
  canUpdateProfile: boolean;
  locked: boolean;
  cooldownSeconds: number;
  onChange: (field: keyof ProfileFormValues, value: string) => void;
  onSave: () => void;
  onReconcile: () => void;
  onClose: () => void;
}) {
  const dialogLocale = vi.provider.profile.dialog;
  const { section, draft, errors, saving, reconciling, saveError, uncertain, reconcileNote } =
    editor;
  const busy = saving || reconciling;
  const fieldsDisabled = busy || !canUpdateProfile || uncertain !== null || locked;
  const hasValidationErrors = Object.values(errors).some(Boolean);
  const saveDisabled =
    !hasChanges ||
    busy ||
    !canUpdateProfile ||
    uncertain !== null ||
    cooldownSeconds > 0 ||
    locked;

  const showAccountEmailReference =
    (section === "all" || section === "contact") && Boolean(owner?.email);

  return (
    <ProviderWorkspaceDialog
      title={formatMessage(dialogLocale.title, {
        facilityName: profile.businessName,
      })}
      subtitle={profile.businessName}
      disableClose={busy}
      restoreFocusFallbackId="profile-title"
      onClose={onClose}
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <p className={styles.help}>{dialogLocale.liveHint}</p>

        {!canUpdateProfile && (
          <div className={styles.alertBox} role="alert">
            {dialogLocale.suspendedNotice}
          </div>
        )}

        {hasValidationErrors && (
          <p className={styles.fieldError} role="alert">
            {dialogLocale.validationSummary}
          </p>
        )}

        {uncertain ? (
          <div className={styles.uncertainBox} role="alert">
            <strong>{dialogLocale.uncertainTitle}</strong>
            <p>{dialogLocale.uncertainDescription}</p>
            {saveError && (
              <p>{getProviderErrorMessage(saveError, cooldownSeconds)}</p>
            )}
            <button
              type="button"
              className={styles.primaryButton}
              disabled={reconciling || cooldownSeconds > 0 || locked}
              onClick={onReconcile}
            >
              <RefreshCw aria-hidden="true" size={14} />
              {reconciling
                ? dialogLocale.reconciling
                : dialogLocale.reconcileAction}
            </button>
          </div>
        ) : (
          saveError && (
            <div className={styles.alertBox} role="alert">
              {getProviderErrorMessage(saveError, cooldownSeconds)}
            </div>
          )
        )}

        {reconcileNote && (
          <div className={styles.infoBox} role="status">
            {reconcileNote}
          </div>
        )}

        {profileSectionFields(section).map((field) => {
          const required = field === "businessName" || field === "address";
          const trimmedLength = draft[field].trim().length;
          const describedBy = `profile-${field}-hint${
            errors[field] ? ` profile-${field}-error` : ""
          }`;

          let hint: string;
          if (field === "businessName") {
            hint = `${dialogLocale.businessNameHint} (${formatMessage(
              dialogLocale.characterCount,
              {
                count: trimmedLength,
                limit: profileFieldLimits.businessNameMax,
              },
            )})`;
          } else if (field === "address") {
            hint = dialogLocale.addressHint;
          } else if (field === "phone") {
            hint = `${dialogLocale.phoneHint} (${formatMessage(
              dialogLocale.characterCount,
              {
                count: trimmedLength,
                limit: profileFieldLimits.phoneMax,
              },
            )})`;
          } else {
            hint = dialogLocale.descriptionHint;
          }

          return (
            <div className={styles.formField} key={field}>
              <label htmlFor={`profile-${field}`}>
                {formatMessage(
                  required
                    ? dialogLocale.requiredLabel
                    : dialogLocale.optionalLabel,
                  { label: FIELD_LABELS[field] },
                )}
              </label>

              {field === "description" ? (
                <textarea
                  id={`profile-${field}`}
                  name={field}
                  value={draft[field]}
                  disabled={fieldsDisabled}
                  onChange={(event) => onChange(field, event.target.value)}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={describedBy}
                />
              ) : (
                <input
                  id={`profile-${field}`}
                  name={field}
                  required={required}
                  type={field === "phone" ? "tel" : "text"}
                  maxLength={
                    field === "businessName"
                      ? profileFieldLimits.businessNameMax
                      : field === "phone"
                        ? profileFieldLimits.phoneMax
                        : undefined
                  }
                  value={draft[field]}
                  disabled={fieldsDisabled}
                  onChange={(event) => onChange(field, event.target.value)}
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={describedBy}
                />
              )}

              <p id={`profile-${field}-hint`} className={styles.help}>
                {hint}
              </p>

              {errors[field] && (
                <p id={`profile-${field}-error`} className={styles.fieldError}>
                  {errors[field]}
                </p>
              )}
            </div>
          );
        })}

        {showAccountEmailReference && owner && (
          <div className={styles.readonlyBox}>
            <span className={styles.help}>
              {dialogLocale.accountEmailLabel}
            </span>
            <strong>{owner.email}</strong>
            <span className={styles.help}>{dialogLocale.accountEmailHint}</span>
          </div>
        )}

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={saveDisabled}
          >
            {saving ? dialogLocale.saving : dialogLocale.save}
          </button>
          <button
            type="button"
            className={styles.softButton}
            disabled={busy}
            onClick={onClose}
          >
            {dialogLocale.cancel}
          </button>
        </div>
      </form>
    </ProviderWorkspaceDialog>
  );
}
