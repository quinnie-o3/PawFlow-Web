import type { ProviderService } from "../types";
import { ArrowRight } from "lucide-react";
import { formatDuration, formatPrice } from "../serviceLogic";
import ServiceStatusBadge from "./ServiceStatusBadge";
import styles from "../services.module.css";

export default function ServiceCard({ service, onSelect }: { service: ProviderService; onSelect: () => void }) {
  return <button type="button" className={styles.serviceCard} aria-label={`Chi tiết và chỉnh sửa ${service.name}`} onClick={onSelect}>
    <span className={styles.cardHeading}><span className={styles.serviceName}>{service.name}</span><ServiceStatusBadge active={service.active} /></span>
    <span className={styles.metadata}>{service.category} · {formatDuration(service.duration)}</span>
    <span className={styles.description}>{service.description}</span>
    <span className={styles.price}>Giá dịch vụ: {formatPrice(service.price)}</span>
    <span className={styles.cardNote}>{!service.active ? "Lịch đã xác nhận trước đó vẫn được giữ" : service.completedCount > 0 ? `${service.completedCount} lịch Hoàn thành trong kỳ` : service.duration.unit === "day" ? "Giới hạn số chỗ theo năng lực cơ sở" : "Đặt lịch theo khung giờ khả dụng"}</span>
    <span className={styles.editLink}>Chỉnh sửa <ArrowRight aria-hidden="true" focusable="false" size={13} strokeWidth={2} className={styles.inlineIcon} /></span>
  </button>;
}
