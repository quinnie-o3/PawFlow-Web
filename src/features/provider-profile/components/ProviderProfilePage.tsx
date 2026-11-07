"use client";

import { vi } from "@/lib/locale";

import { useRef } from "react";
import { Pencil } from "lucide-react";
import { useProfileMock } from "../useProfileMock";
import type { ProfileSection } from "../types";
import ProfileApproval from "./ProfileApproval";
import ProfileInformation from "./ProfileInformation";
import ProfileModulesOverview from "./ProfileModulesOverview";
import ProfileImages from "./ProfileImages";
import ProfileEditDialog from "./ProfileEditDialog";
import styles from "../profile.module.css";

export default function ProviderProfilePage() {
  const mock = useProfileMock();
  const trigger = useRef<HTMLElement | null>(null);
  function open(section: ProfileSection) {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    mock.open(section);
  }
  function restoreFocus() {
    window.requestAnimationFrame(() => {
      if (trigger.current?.isConnected) trigger.current.focus();
      else document.getElementById("profile-title")?.focus();
    });
  }
  function close() { mock.close(); restoreFocus(); }
  function save() { if (mock.save()) restoreFocus(); }

  return <div className={styles.page} lang="vi">
    <div className={styles.providerTab}>{vi.provider.profile.page.providerTab}</div>
    <header className={styles.intro}>
      <div><h1 id="profile-title" tabIndex={-1}>{vi.provider.profile.page.title}</h1><p>{vi.provider.profile.page.description}</p></div>
      <button type="button" className={styles.outlineButton} onClick={() => open("all")}><Pencil aria-hidden="true" size={14} />{vi.provider.profile.page.edit}</button>
    </header>
    <p className={styles.help}>{vi.provider.profile.page.mockHint}</p>
    {mock.feedback && <p className={styles.feedback} role="status">{mock.feedback}</p>}
    <ProfileApproval profile={mock.profile} />
    <ProfileInformation profile={mock.profile} onEdit={open} />
    <ProfileImages images={mock.images} onEdit={() => open("images")} />
    <ProfileModulesOverview />
    <details className={styles.mockTools}>
      <summary>{vi.provider.profile.mock.title}</summary>
      <p>{vi.provider.profile.mock.description}</p>
      <label className={styles.checkboxLabel}><input type="checkbox" checked={mock.failNextSave} onChange={(event) => mock.setFailNextSave(event.target.checked)} />{vi.provider.profile.mock.failNextSave}</label>
    </details>
    {mock.editor && <ProfileEditDialog profile={mock.profile} editor={mock.editor} savedImages={mock.images} hasChanges={mock.hasChanges}
      onChange={mock.change} onSelectImage={mock.selectImage} onDiscardImage={mock.discardImage} onSave={save} onClose={close} />}
  </div>;
}
