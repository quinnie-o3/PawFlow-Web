import { vi, formatMessage } from "@/lib/locale";
import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DashboardDialog from "@/features/provider-dashboard/components/DashboardDialog";
import { formatDuration, serviceToDraft } from "../serviceLogic";
import type { ProviderService, ServiceCommand, ServiceDraft, ServiceFeedback } from "../types";
import ServiceCategoryField from "./ServiceCategoryField";
import ServiceStatusBadge from "./ServiceStatusBadge";
import ServicesFeedback from "./ServicesFeedback";
import styles from "../services.module.css";

export default function ServiceDialog({ service, categories, onSubmit, onClose }: {
  service?: ProviderService;
  categories: string[];
  onSubmit: (command: ServiceCommand, simulateFailure: boolean) => ServiceFeedback;
  onClose: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => serviceToDraft(service));
  const [newId] = useState(() => `mock-service-${crypto.randomUUID()}`);
  const [feedback, setFeedback] = useState<ServiceFeedback | null>(null);
  const [lastAction, setLastAction] = useState<"save" | "status" | "category" | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [confirmActive, setConfirmActive] = useState<boolean | null>(null);

  function change(field: keyof ServiceDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  function save() {
    setLastAction("save");
    const command: ServiceCommand = service
      ? { type: "update", id: service.id, expectedVersion: service.version, draft }
      : { type: "create", id: newId, draft };
    const result = onSubmit(command, simulateFailure);
    setFeedback(result);
    if (result.outcome === "success" && !service) onClose();
  }

  return <DashboardDialog title={service ? formatMessage(vi.provider.services.dialog.editTitle, { serviceName: service.name }) : vi.provider.services.page.addService} onClose={onClose}>
    {service && <div className={styles.detailIntro}><p>{service.category} · {formatDuration(service.duration)}</p><ServiceStatusBadge active={service.active} /></div>}
    <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label className={styles.field} htmlFor={`${id}-name`}>{vi.provider.services.dialog.nameLabel}<input id={`${id}-name`} value={draft.name} onChange={(event) => change("name", event.target.value)} required /></label>
      <ServiceCategoryField categories={categories} value={draft.category} onChange={(value) => change("category", value)} onCreate={(name) => {
        setLastAction("category");
        const result = onSubmit({ type: "createCategory", name }, simulateFailure);
        setFeedback(result.outcome === "success" ? result : null);
        return result;
      }} />
      <div className={styles.fieldRow}>
        <div className={styles.field}><label htmlFor={`${id}-price`}>{vi.provider.services.dialog.priceLabel}</label><input id={`${id}-price`} inputMode="decimal" value={draft.price} onChange={(event) => change("price", event.target.value)} aria-describedby={`${id}-price-hint`} required /><span id={`${id}-price-hint`} className={styles.fieldHint}>{vi.provider.services.dialog.priceHint}</span></div>
        {service?.duration.unit === "day" ? <div className={styles.field}><label htmlFor={`${id}-duration`}>{vi.provider.services.dialog.durationLabel}</label><input id={`${id}-duration`} value={vi.provider.services.duration.oneDay} aria-describedby={`${id}-duration-hint`} disabled /><span id={`${id}-duration-hint`} className={styles.fieldHint}>{vi.provider.services.dialog.keepDuration}</span></div> : <label className={styles.field} htmlFor={`${id}-duration`}>{vi.provider.services.dialog.requiredDuration}<input id={`${id}-duration`} inputMode="decimal" value={draft.durationMinutes} onChange={(event) => change("durationMinutes", event.target.value)} required /></label>}
      </div>
      <div className={styles.field}><label htmlFor={`${id}-description`}>{vi.provider.services.dialog.descriptionLabel}</label><textarea id={`${id}-description`} rows={3} value={draft.description} onChange={(event) => change("description", event.target.value)} /></div>
      <p className={styles.invariantNote}>{vi.provider.services.dialog.bookingSnapshotHint}</p>
      <ServicesFeedback feedback={feedback} />
      <button type="submit" className={styles.primaryButton}>{feedback?.outcome === "error" && lastAction === "save" ? vi.common.actions.retry : service ? vi.provider.services.dialog.saveChanges : vi.provider.services.dialog.createService}</button>
    </form>
    {service && <div className={styles.actions}>
      <button id={`${id}-status`} type="button" className={styles.softButton} onClick={() => { setConfirmActive(!service.active); setFeedback(null); }}>{service.active ? vi.provider.services.dialog.hideService : vi.provider.services.dialog.showAgain}</button>
      {confirmActive !== null && <section className={styles.confirmation} aria-labelledby={`${id}-confirm-title`}>
        <h3 id={`${id}-confirm-title`}>{confirmActive ? vi.provider.services.dialog.showAgainTitle : vi.provider.services.dialog.hideTitle}</h3>
        <p>{confirmActive ? vi.provider.services.dialog.reactivateExplanation : vi.provider.services.dialog.hideExplanation}</p>
        <button type="button" className={styles.primaryButton} onClick={() => {
          setLastAction("status");
          const result = onSubmit({ type: "setActive", id: service.id, expectedVersion: service.version, active: confirmActive }, simulateFailure);
          setFeedback(result);
          if (result.outcome === "success") setConfirmActive(null);
        }}>{feedback?.outcome === "error" && lastAction === "status" ? vi.provider.services.dialog.retryStatus : confirmActive ? vi.provider.services.dialog.confirmShow : vi.provider.services.dialog.confirmHide}</button>
        <button type="button" className={styles.softButton} onClick={() => { setConfirmActive(null); window.requestAnimationFrame(() => document.getElementById(`${id}-status`)?.focus()); }}>{vi.provider.services.dialog.back}</button>
      </section>}
      <Link href="/dashboard/availability" prefetch={false} className={styles.editLink}>{vi.provider.services.links.availability} <ArrowRight aria-hidden="true" focusable="false" size={14} strokeWidth={2} className={styles.inlineIcon} /></Link>
    </div>}
    <details className={styles.mockTools}>
      <summary>{vi.provider.services.mock.failureTitle}</summary>
      <label className={styles.checkbox}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} />{vi.provider.services.mock.failureLabel}</label>
    </details>
    <div className={styles.actions}><button type="button" className={styles.softButton} onClick={onClose}>{vi.common.actions.close}</button></div>
  </DashboardDialog>;
}
