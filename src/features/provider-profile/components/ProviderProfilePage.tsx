"use client";

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
    <div className={styles.providerTab}>DÀNH CHO PROVIDER</div>
    <header className={styles.intro}>
      <div><h1 id="profile-title" tabIndex={-1}>Hồ sơ cơ sở</h1><p>Quản lý thông tin cơ sở và trạng thái hiển thị với khách hàng</p></div>
      <button type="button" className={styles.outlineButton} onClick={() => open("all")}><Pencil aria-hidden="true" size={14} />Chỉnh sửa hồ sơ</button>
    </header>
    <p className={styles.help}>Dữ liệu mô phỏng · Chủ cơ sở. Thay đổi chỉ trong lần mở trang này, chưa lưu lên máy chủ.</p>
    {mock.feedback && <p className={styles.feedback} role="status">{mock.feedback}</p>}
    <ProfileApproval profile={mock.profile} />
    <ProfileInformation profile={mock.profile} onEdit={open} />
    <ProfileImages images={mock.images} onEdit={() => open("images")} />
    <ProfileModulesOverview />
    <details className={styles.mockTools}>
      <summary>Dữ liệu mô phỏng và thử lỗi lưu</summary>
      <p>Tải lại hoặc rời trang sẽ khôi phục mẫu, bao gồm logo và ảnh bìa. Trạng thái duyệt và thông tin do admin quản lý không đổi.</p>
      <label className={styles.checkboxLabel}><input type="checkbox" checked={mock.failNextSave} onChange={(event) => mock.setFailNextSave(event.target.checked)} />Mô phỏng lỗi lưu tiếp theo (một lần)</label>
    </details>
    {mock.editor && <ProfileEditDialog profile={mock.profile} editor={mock.editor} savedImages={mock.images} hasChanges={mock.hasChanges}
      onChange={mock.change} onSelectImage={mock.selectImage} onDiscardImage={mock.discardImage} onSave={save} onClose={close} />}
  </div>;
}
