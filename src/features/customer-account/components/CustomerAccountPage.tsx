"use client";

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
        <h1 id="customer-profile-title">Thông tin cá nhân</h1>
        <button type="button" className={ui.secondaryButton} onClick={model.open}>Chỉnh sửa</button>
      </div>
      <dl className={styles.information}>
        <div><dt>Họ và tên</dt><dd>{profile.fullName}</dd></div>
        <div><dt>Email</dt><dd>{profile.email}</dd></div>
        <div><dt>Số điện thoại</dt><dd>{profile.phone ?? "Chưa có số điện thoại"}</dd></div>
        <div><dt>Địa chỉ</dt><dd>Chưa hỗ trợ</dd></div>
      </dl>
    </section>
    <section className={styles.security} aria-labelledby="customer-security-title">
      <h2 id="customer-security-title">Bảo mật tài khoản</h2>
      <p>Thông tin cá nhân và hồ sơ thú cưng gắn với tài khoản của bạn.</p>
      <button type="button" disabled aria-describedby="password-unavailable">Đổi mật khẩu</button>
      <p id="password-unavailable" className={styles.hint}>Khôi phục mật khẩu chưa được hỗ trợ trong bản dùng thử.</p>
    </section>
    <details className={styles.mockTools}>
      <summary>Dữ liệu mô phỏng · Thử lỗi lưu</summary>
      <label><input type="checkbox" checked={model.failNextSave} disabled={model.isSaving} onChange={(event) => model.setFailNextSave(event.target.checked)} />Làm lần lưu hợp lệ tiếp theo thất bại; lần thử lại sẽ lưu bình thường.</label>
    </details>
    {model.editor && <ProfileEditDialog model={model} />}
  </>;
}
