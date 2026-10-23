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

  return <DashboardDialog title={service ? `Chỉnh sửa ${service.name}` : "Thêm dịch vụ"} onClose={onClose}>
    {service && <div className={styles.detailIntro}><p>{service.category} · {formatDuration(service.duration)}</p><ServiceStatusBadge active={service.active} /></div>}
    <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label className={styles.field} htmlFor={`${id}-name`}>Tên dịch vụ (bắt buộc)<input id={`${id}-name`} value={draft.name} onChange={(event) => change("name", event.target.value)} required /></label>
      <ServiceCategoryField categories={categories} value={draft.category} onChange={(value) => change("category", value)} onCreate={(name) => {
        setLastAction("category");
        const result = onSubmit({ type: "createCategory", name }, simulateFailure);
        setFeedback(result.outcome === "success" ? result : null);
        return result;
      }} />
      <div className={styles.fieldRow}>
        <div className={styles.field}><label htmlFor={`${id}-price`}>Giá dịch vụ (₫, bắt buộc)</label><input id={`${id}-price`} inputMode="decimal" value={draft.price} onChange={(event) => change("price", event.target.value)} aria-describedby={`${id}-price-hint`} required /><span id={`${id}-price-hint`} className={styles.fieldHint}>Giá lớn hơn 0, ví dụ: 180000.</span></div>
        {service?.duration.unit === "day" ? <div className={styles.field}><label htmlFor={`${id}-duration`}>Thời lượng</label><input id={`${id}-duration`} value="1 ngày" aria-describedby={`${id}-duration-hint`} disabled /><span id={`${id}-duration-hint`} className={styles.fieldHint}>Giữ nguyên thời lượng của dịch vụ này.</span></div> : <label className={styles.field} htmlFor={`${id}-duration`}>Thời lượng (phút, bắt buộc)<input id={`${id}-duration`} inputMode="decimal" value={draft.durationMinutes} onChange={(event) => change("durationMinutes", event.target.value)} required /></label>}
      </div>
      <div className={styles.field}><label htmlFor={`${id}-description`}>Mô tả</label><textarea id={`${id}-description`} rows={3} value={draft.description} onChange={(event) => change("description", event.target.value)} /></div>
      <p className={styles.invariantNote}>Giá và thời lượng của lịch đã đặt được giữ nguyên. Khi đổi thời lượng, các khung giờ đã tạo cần được kiểm tra trước khi lưu.</p>
      <ServicesFeedback feedback={feedback} />
      <button type="submit" className={styles.primaryButton}>{feedback?.outcome === "error" && lastAction === "save" ? "Thử lại" : service ? "Lưu thay đổi" : "Tạo dịch vụ"}</button>
    </form>
    {service && <div className={styles.actions}>
      <button id={`${id}-status`} type="button" className={styles.softButton} onClick={() => { setConfirmActive(!service.active); setFeedback(null); }}>{service.active ? "Tạm ẩn dịch vụ" : "Hiển thị lại"}</button>
      {confirmActive !== null && <section className={styles.confirmation} aria-labelledby={`${id}-confirm-title`}>
        <h3 id={`${id}-confirm-title`}>{confirmActive ? "Hiển thị lại dịch vụ?" : "Tạm ẩn dịch vụ?"}</h3>
        <p>{confirmActive ? "Dịch vụ sẽ nhận lịch mới theo các khung giờ khả dụng." : "Dịch vụ sẽ ngừng nhận lịch mới. Các lịch đã đặt được giữ nguyên."} Thao tác này chỉ đổi trạng thái; các nội dung đang nhập cần được lưu riêng.</p>
        <button type="button" className={styles.primaryButton} onClick={() => {
          setLastAction("status");
          const result = onSubmit({ type: "setActive", id: service.id, expectedVersion: service.version, active: confirmActive }, simulateFailure);
          setFeedback(result);
          if (result.outcome === "success") setConfirmActive(null);
        }}>{feedback?.outcome === "error" && lastAction === "status" ? "Thử lại đổi trạng thái" : confirmActive ? "Xác nhận hiển thị lại" : "Xác nhận tạm ẩn"}</button>
        <button type="button" className={styles.softButton} onClick={() => { setConfirmActive(null); window.requestAnimationFrame(() => document.getElementById(`${id}-status`)?.focus()); }}>Quay lại</button>
      </section>}
      <Link href="/dashboard/availability" prefetch={false} className={styles.editLink}>Xem lịch khả dụng <ArrowRight aria-hidden="true" focusable="false" size={14} strokeWidth={2} className={styles.inlineIcon} /></Link>
    </div>}
    <details className={styles.mockTools}>
      <summary>Thử tình huống lưu thất bại</summary>
      <label className={styles.checkbox}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} />Mô phỏng lỗi khi lưu (tắt để thử lại)</label>
    </details>
    <div className={styles.actions}><button type="button" className={styles.softButton} onClick={onClose}>Đóng</button></div>
  </DashboardDialog>;
}
