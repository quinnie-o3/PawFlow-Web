"use client";

import { CheckCircle2, LoaderCircle, PawPrint } from "lucide-react";
import { useCustomerPetsPage } from "../hooks/useCustomerPetsPage";
import PetCard from "./PetCard";
import PetDetailsDialog from "./PetDetailsDialog";
import PetFormDialog from "./PetFormDialog";
import PetDeleteDialog from "./PetDeleteDialog";
import styles from "../pets.module.css";
import ui from "@/features/customer-shell/customerShell.module.css";

export default function CustomerPetsPage() {
  const model = useCustomerPetsPage();
  const pending = model.loadStatus === "loading" || model.deleting || model.form.saving;
  return <>
    {model.feedback && <p role="status" className={styles.success}><CheckCircle2 aria-hidden="true" size={20} />{model.feedback}</p>}
    <section className={styles.panel} aria-labelledby="customer-pets-title" aria-busy={model.loadStatus === "loading"}>
      <div className={styles.panelHeading}>
        <h1 id="customer-pets-title">Thú cưng của tôi</h1>
        <button id="add-customer-pet" type="button" className={ui.secondaryButton} disabled={pending} onClick={model.openCreate}>+ Thêm thú cưng</button>
      </div>
      {model.loadStatus === "loading" && <p role="status" className={styles.loadStatus}><LoaderCircle aria-hidden="true" size={18} className={styles.spinner} />Đang tải hồ sơ thú cưng…</p>}
      {model.loadStatus === "error" && <div role="alert" className={styles.error}><p>Chưa tải được danh sách (lỗi mô phỏng). Hồ sơ đã lưu không thay đổi.</p><button type="button" className={ui.secondaryButton} onClick={model.retryLoad}>Thử tải lại</button></div>}
      {model.hasLoaded && (model.pets.length ? <ul className={styles.list}>
        {model.pets.map((pet) => <PetCard key={pet.id} pet={pet} petTypes={model.petState.petTypes} today={model.today} disabled={pending}
          onDetails={() => model.showDetails(pet)} onEdit={() => model.openEdit(pet)} onDelete={() => model.openDelete(pet)} />)}
      </ul> : <div className={styles.empty}>
        <PawPrint aria-hidden="true" size={32} /><p>Chưa có thú cưng đang sử dụng.</p>
        <button type="button" className={ui.secondaryButton} disabled={pending} onClick={model.openCreate}>Thêm hồ sơ đầu tiên</button>
      </div>)}
      <p className={styles.privacy}>Hồ sơ và ảnh được giữ trong phiên dùng thử này, chưa lưu lên máy chủ.</p>
    </section>
    <details className={styles.mockTools}>
      <summary>Dữ liệu mô phỏng · Thử tải và lưu thất bại</summary>
      <label><input type="checkbox" checked={model.failNextLoad} disabled={pending} onChange={(event) => model.setFailNextLoad(event.target.checked)} />Lần tải tiếp theo thất bại</label>
      <button type="button" className={ui.secondaryButton} disabled={pending} onClick={model.reload}>Tải lại danh sách</button>
      <label><input type="checkbox" checked={model.failNextMutation} disabled={pending} onChange={(event) => model.setFailNextMutation(event.target.checked)} />Lần thêm, sửa hoặc xóa hợp lệ tiếp theo thất bại; thử lại sẽ chạy bình thường</label>
      <p>{model.petState.pets.filter((pet) => pet.ownerId === "customer-demo" && pet.status === "INACTIVE").length} hồ sơ ngừng sử dụng vẫn được giữ trong bộ nhớ mô phỏng.</p>
    </details>
    {model.form.editor && <PetFormDialog model={model} />}
    {model.selection?.kind === "details" && model.selectedPet && <PetDetailsDialog pet={model.selectedPet} petTypes={model.petState.petTypes} today={model.today}
      onClose={model.closeSelection} onEdit={() => model.openEdit(model.selectedPet!, true)} onDelete={() => model.openDelete(model.selectedPet!, true)} />}
    {model.selection?.kind === "delete" && model.selectedPet && <PetDeleteDialog pet={model.selectedPet} busy={model.deleting} error={model.deleteError}
      onClose={model.closeSelection} onConfirm={model.deactivate} />}
  </>;
}
