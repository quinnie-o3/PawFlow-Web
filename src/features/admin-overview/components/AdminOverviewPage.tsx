"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChartColumn } from "lucide-react";
import { records } from "@/features/admin-providers/data/mock";
import { useAdminMock } from "@/features/admin-workspace/hooks/useAdminMock";
import { AdminRecordDetails, AdminStatus, PendingMetrics } from "@/features/admin-workspace/components/AdminPrimitives";
import AdminDialog from "@/features/admin-workspace/components/AdminDialog";
import { adminQueueLinks, overviewMetricLabels } from "../data/mock";
import styles from "@/features/admin-workspace/admin.module.css";

export default function AdminOverviewPage() {
  const mock = useAdminMock(records);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pending = mock.records.filter((record) => record.tags.includes("pending"));
  const selected = mock.records.find((record) => record.id === selectedId);
  return <div className={styles.page}>
    <header className={styles.intro}><div><h1>Tổng quan hệ thống</h1><p>Thống kê toàn nền tảng · Giao diện mô phỏng chỉ đọc</p></div><span className={styles.muted}>Kỳ báo cáo: chờ xác nhận</span></header>
    <section className={styles.priority}><div><h2>Cần xử lý hôm nay</h2><p>Xem các hồ sơ, phản ánh và đánh giá cần rà soát trong dữ liệu mẫu.</p></div><div><Link href="/admin/providers" prefetch={false}>Xem hồ sơ</Link><Link href="/admin/complaints" prefetch={false}>Xem khiếu nại</Link></div></section>
    <PendingMetrics labels={overviewMetricLabels} />
    <div className={styles.overviewGrid}>
      <section className={styles.card}><h2>Lịch hẹn toàn hệ thống</h2><div className={styles.chartPending}><ChartColumn size={40} aria-hidden="true" /><p>Chưa hiển thị biểu đồ khi công thức, trạng thái và kỳ báo cáo chưa được xác nhận.</p></div></section>
      <section className={styles.card}><h2>Hàng đợi quản trị</h2><p className={styles.muted}>Đi đến các màn rà soát</p><div className={styles.queue}>{adminQueueLinks.map((item) => <Link href={item.href} key={item.href} prefetch={false}>{item.label}<ArrowRight size={16} aria-hidden="true" /></Link>)}</div></section>
    </div>
    <section className={styles.card} aria-labelledby="pending-providers-title" aria-busy={mock.status === "loading"}>
      <div className={styles.sectionHeading}><div><h2 id="pending-providers-title">Cơ sở chờ phê duyệt</h2><p>Hồ sơ mẫu từ màn Duyệt cơ sở</p></div><Link href="/admin/providers" prefetch={false} className={styles.textButton}>Xem tất cả <ArrowRight size={14} aria-hidden="true" /></Link></div>
      {mock.status === "loading" ? <div className={styles.state} role="status">Đang tải hồ sơ mẫu…</div>
        : mock.status === "error" ? <div className={styles.state}><h3 role="alert">Không tải được hồ sơ mẫu</h3><button className={styles.secondaryButton} type="button" onClick={() => mock.load()}>Thử lại</button></div>
        : pending.length === 0 ? <div className={styles.state}><h3>Chưa có hồ sơ mẫu chờ duyệt</h3></div>
        : <div className={styles.tableFrame} tabIndex={0} role="region" aria-label="Cơ sở chờ phê duyệt, cuộn ngang để xem thêm"><table><thead><tr>{["Cơ sở","Chủ cơ sở","Ngày gửi","Dịch vụ","Trạng thái","Chi tiết"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{pending.map((record) => <tr key={record.id}><th scope="row">{record.cells[0]}</th>{record.cells.slice(1,4).map((cell,index) => <td key={index}>{cell}</td>)}<td><AdminStatus status={record.status} /></td><td><button className={styles.textButton} type="button" aria-label={`Xem chi tiết ${record.title}`} onClick={() => setSelectedId(record.id)}>Xem <ArrowRight size={13} aria-hidden="true" /></button></td></tr>)}</tbody></table></div>}
      <p className={styles.listFooter}>Dữ liệu minh họa từ Figma · Chưa tính KPI từ các hàng mẫu</p>
    </section>
    <details className={styles.mockTools}><summary>Dữ liệu mô phỏng · Kiểm tra trạng thái giao diện</summary><p>Chỉ thay đổi tình huống tải hồ sơ của màn Tổng quan.</p><div><button type="button" disabled={mock.status === "loading"} onClick={() => mock.load("error")}>Mô phỏng lỗi tải</button><button type="button" disabled={mock.status === "loading"} onClick={() => mock.load("empty")}>Danh sách rỗng</button><button type="button" disabled={mock.status === "loading"} onClick={() => mock.load()}>Khôi phục dữ liệu mẫu</button></div></details>
    {selected && <AdminDialog title={selected.title} onClose={() => setSelectedId(null)}><AdminRecordDetails record={selected} /></AdminDialog>}
  </div>;
}
