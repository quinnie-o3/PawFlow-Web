import Image from "next/image";
import type { AdminRecord } from "../types";
import styles from "../admin.module.css";

export function PendingMetrics({ labels }: { labels: readonly string[] }) {
  return <section className={styles.metrics} aria-label="Chỉ số chờ xác nhận công thức">
    {labels.map((label) => <article key={label}><h2>{label}</h2><p className={styles.metricValue} aria-label={`${label}: chưa có số liệu`}>—</p><p>Chờ xác nhận công thức</p></article>)}
  </section>;
}

export function AdminStatus({ status }: { status: AdminRecord["status"] }) {
  return <span className={`${styles.badge} ${styles[status.tone]}`}><Image src={`/admin/status-${status.tone}.svg`} width={7} height={7} alt="" aria-hidden="true" />{status.label}</span>;
}

export function AdminRecordDetails({ record }: { record: AdminRecord }) {
  return <>
    <p>{record.description}</p>
    <dl className={styles.fields}>{record.details.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
    <AdminStatus status={record.status} />
    {!!record.pendingActions?.length && <div className={styles.pendingActions}>
      <p>Thao tác chờ xác nhận quy tắc; bản UI hiện tại chỉ đọc.</p>
      <div>{record.pendingActions.map((label) => <button key={label} type="button" disabled>{label}</button>)}</div>
    </div>}
  </>;
}
