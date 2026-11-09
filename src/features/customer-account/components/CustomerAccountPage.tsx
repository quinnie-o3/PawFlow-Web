"use client";

import { vi } from "@/lib/locale";

import { CheckCircle2 } from "lucide-react";
import { useCustomerProfileEditor } from "../hooks/useCustomerProfileEditor";
import ProfileEditDialog from "./ProfileEditDialog";
import styles from "../account.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function CustomerAccountPage() {
  const model = useCustomerProfileEditor();
  const { profile } = model;
  return <>
    {model.feedback && <p role="status" className={styles.feedback}><CheckCircle2 aria-hidden="true" size={20} />{model.feedback}</p>}
    <section aria-labelledby="customer-profile-title" className={styles.profile}>
      <div className={styles.heading}>
        <h1 id="customer-profile-title">{vi.customer.account.page.title}</h1>
        <button type="button" className={ui.secondaryButton} onClick={model.open}>{vi.common.actions.edit}</button>
      </div>
      <dl className={styles.information}>
        <div><dt>{vi.common.fields.fullName}</dt><dd>{profile.fullName}</dd></div>
        <div><dt>{vi.customer.account.page.email}</dt><dd>{profile.email}</dd></div>
        <div><dt>{vi.common.fields.phone}</dt><dd>{profile.phone ?? vi.customer.account.page.noPhone}</dd></div>
        <div><dt>{vi.customer.account.page.address}</dt><dd>{vi.customer.account.page.unavailable}</dd></div>
      </dl>
    </section>
    <section className={styles.security} aria-labelledby="customer-security-title">
      <h2 id="customer-security-title">{vi.customer.account.page.securityTitle}</h2>
      <p>{vi.customer.account.page.securityDescription}</p>
      <button type="button" disabled aria-describedby="password-unavailable">{vi.customer.account.page.changePassword}</button>
      <p id="password-unavailable" className={styles.hint}>{vi.customer.account.page.passwordUnavailable}</p>
    </section>
    <details className={styles.mockTools}>
      <summary>{vi.customer.account.page.mockTools}</summary>
      <label><input type="checkbox" checked={model.failNextSave} disabled={model.isSaving} onChange={(event) => model.setFailNextSave(event.target.checked)} />{vi.customer.account.page.failNextSave}</label>
    </details>
    {model.editor && <ProfileEditDialog model={model} />}
  </>;
}
