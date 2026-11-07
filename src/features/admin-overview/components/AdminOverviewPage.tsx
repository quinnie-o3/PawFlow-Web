"use client";

import { vi, formatMessage } from "@/lib/locale";

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
    <header className={styles.intro}><div><h1>{vi.admin.overview.title}</h1><p>{vi.admin.overview.description}</p></div><span className={styles.muted}>{vi.admin.overview.pendingPeriod}</span></header>
    <section className={styles.priority}><div><h2>{vi.admin.overview.priorityTitle}</h2><p>{vi.admin.overview.priorityDescription}</p></div><div><Link href="/admin/providers" prefetch={false}>{vi.admin.overview.viewProfiles}</Link><Link href="/admin/complaints" prefetch={false}>{vi.admin.overview.viewComplaints}</Link></div></section>
    <PendingMetrics labels={overviewMetricLabels} />
    <div className={styles.overviewGrid}>
      <section className={styles.card}><h2>{vi.admin.overview.appointmentsTitle}</h2><div className={styles.chartPending}><ChartColumn size={40} aria-hidden="true" /><p>{vi.admin.overview.pendingChart}</p></div></section>
      <section className={styles.card}><h2>{vi.admin.overview.queueTitle}</h2><p className={styles.muted}>{vi.admin.overview.queueDescription}</p><div className={styles.queue}>{adminQueueLinks.map((item) => <Link href={item.href} key={item.href} prefetch={false}>{item.label}<ArrowRight size={16} aria-hidden="true" /></Link>)}</div></section>
    </div>
    <section className={styles.card} aria-labelledby="pending-providers-title" aria-busy={mock.status === "loading"}>
      <div className={styles.sectionHeading}><div><h2 id="pending-providers-title">{vi.admin.overview.pendingProvidersTitle}</h2><p>{vi.admin.overview.pendingProvidersDescription}</p></div><Link href="/admin/providers" prefetch={false} className={styles.textButton}>{vi.admin.overview.viewAll}{" "}<ArrowRight size={14} aria-hidden="true" /></Link></div>
      {mock.status === "loading" ? <div className={styles.state} role="status">{vi.admin.overview.loadingProfiles}</div>
        : mock.status === "error" ? <div className={styles.state}><h3 role="alert">{vi.admin.overview.loadError}</h3><button className={styles.secondaryButton} type="button" onClick={() => mock.load()}>{vi.common.actions.retry}</button></div>
        : pending.length === 0 ? <div className={styles.state}><h3>{vi.admin.overview.noPendingProfiles}</h3></div>
        : <div className={styles.tableFrame} tabIndex={0} role="region" aria-label={vi.admin.overview.pendingTableLabel}><table><thead><tr>{[vi.admin.overview.facilityColumn,vi.admin.overview.ownerColumn,vi.admin.overview.submittedDateColumn,vi.admin.overview.serviceColumn,vi.admin.overview.statusColumn,vi.admin.overview.detailsColumn].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{pending.map((record) => <tr key={record.id}><th scope="row">{record.cells[0]}</th>{record.cells.slice(1,4).map((cell,index) => <td key={index}>{cell}</td>)}<td><AdminStatus status={record.status} /></td><td><button className={styles.textButton} type="button" aria-label={formatMessage(vi.admin.overview.viewDetailsLabel, { title: record.title })} onClick={() => setSelectedId(record.id)}>{vi.admin.overview.view}{" "}<ArrowRight size={13} aria-hidden="true" /></button></td></tr>)}</tbody></table></div>}
      <p className={styles.listFooter}>{vi.admin.overview.fixtureNotice}</p>
    </section>
    <details className={styles.mockTools}><summary>{vi.admin.overview.mockToolsTitle}</summary><p>{vi.admin.overview.mockToolsDescription}</p><div><button type="button" disabled={mock.status === "loading"} onClick={() => mock.load("error")}>{vi.admin.overview.simulateLoadError}</button><button type="button" disabled={mock.status === "loading"} onClick={() => mock.load("empty")}>{vi.admin.overview.emptyList}</button><button type="button" disabled={mock.status === "loading"} onClick={() => mock.load()}>{vi.admin.overview.restoreFixtures}</button></div></details>
    {selected && <AdminDialog title={selected.title} onClose={() => setSelectedId(null)}><AdminRecordDetails record={selected} /></AdminDialog>}
  </div>;
}
