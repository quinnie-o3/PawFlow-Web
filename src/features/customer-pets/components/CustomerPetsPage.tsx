"use client";

import { vi, formatMessage } from "@/lib/locale";

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
        <h1 id="customer-pets-title">{vi.customer.pets.page.title}</h1>
        <button id="add-customer-pet" type="button" className={ui.secondaryButton} disabled={pending} onClick={model.openCreate}>{vi.customer.pets.page.add}</button>
      </div>
      {model.loadStatus === "loading" && <p role="status" className={styles.loadStatus}><LoaderCircle aria-hidden="true" size={18} className={styles.spinner} />{vi.customer.pets.page.loading}</p>}
      {model.loadStatus === "error" && <div role="alert" className={styles.error}><p>{vi.customer.pets.page.loadError}</p><button type="button" className={ui.secondaryButton} onClick={model.retryLoad}>{vi.customer.pets.page.retryLoad}</button></div>}
      {model.hasLoaded && (model.pets.length ? <ul className={styles.list}>
        {model.pets.map((pet) => <PetCard key={pet.id} pet={pet} petTypes={model.petState.petTypes} today={model.today} disabled={pending}
          onDetails={() => model.showDetails(pet)} onEdit={() => model.openEdit(pet)} onDelete={() => model.openDelete(pet)} />)}
      </ul> : <div className={styles.empty}>
        <PawPrint aria-hidden="true" size={32} /><p>{vi.customer.pets.page.empty}</p>
        <button type="button" className={ui.secondaryButton} disabled={pending} onClick={model.openCreate}>{vi.customer.pets.page.addFirst}</button>
      </div>)}
      <p className={styles.privacy}>{vi.customer.pets.page.privacy}</p>
    </section>
    <details className={styles.mockTools}>
      <summary>{vi.customer.pets.page.mockTools}</summary>
      <label><input type="checkbox" checked={model.failNextLoad} disabled={pending} onChange={(event) => model.setFailNextLoad(event.target.checked)} />{vi.customer.pets.page.failLoad}</label>
      <button type="button" className={ui.secondaryButton} disabled={pending} onClick={model.reload}>{vi.customer.pets.page.reload}</button>
      <label><input type="checkbox" checked={model.failNextMutation} disabled={pending} onChange={(event) => model.setFailNextMutation(event.target.checked)} />{vi.customer.pets.page.failMutation}</label>
      <p>{formatMessage(vi.customer.pets.page.inactiveCount, { count: model.petState.pets.filter((pet) => pet.ownerId === "customer-demo" && pet.status === "INACTIVE").length })}</p>
    </details>
    {model.form.editor && <PetFormDialog model={model} />}
    {model.selection?.kind === "details" && model.selectedPet && <PetDetailsDialog pet={model.selectedPet} petTypes={model.petState.petTypes} today={model.today}
      onClose={model.closeSelection} onEdit={() => model.openEdit(model.selectedPet!, true)} onDelete={() => model.openDelete(model.selectedPet!, true)} />}
    {model.selection?.kind === "delete" && model.selectedPet && <PetDeleteDialog pet={model.selectedPet} busy={model.deleting} error={model.deleteError}
      onClose={model.closeSelection} onConfirm={model.deactivate} />}
  </>;
}
