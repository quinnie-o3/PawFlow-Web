import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "../services.module.css";

export default function ServicesGuidance() {
  return <div className={styles.guidance}>
    <article><h2>Hiển thị với khách</h2><p>Dịch vụ đang Hiển thị xuất hiện trong trang cơ sở và luồng đặt lịch. Giá và thời lượng cần rõ trước khi khách xác nhận yêu cầu.</p></article>
    <article><h2>Liên kết lịch khả dụng</h2><p>Khung giờ đặt lịch phụ thuộc thời lượng, ngày mở và số chỗ còn lại. Tạm ẩn dịch vụ không tự hủy những lịch đã xác nhận.</p><Link href="/dashboard/availability" prefetch={false}>Xem lịch khả dụng <ArrowRight aria-hidden="true" focusable="false" size={13} strokeWidth={2} className={styles.inlineIcon} /></Link></article>
  </div>;
}
