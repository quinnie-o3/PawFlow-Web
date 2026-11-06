"use client";

import { vi, formatMessage } from "@/lib/locale";

import { useId, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { defaultAdminFilters, filterAdminRecords, invalidAdminDateRange } from "../adminLogic";
import { useAdminMock } from "../hooks/useAdminMock";
import type { AdminCollectionDefinition, AdminFilters, AdminRecord } from "../types";
import AdminDialog from "./AdminDialog";
import { AdminRecordDetails, AdminStatus, PendingMetrics } from "./AdminPrimitives";
import styles from "../admin.module.css";

export default function AdminCollection({ definition, fixture }: { definition: AdminCollectionDefinition; fixture: readonly AdminRecord[] }) {
  const id = useId();
  const [filters, setFilters] = useState<AdminFilters>(defaultAdminFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const mock = useAdminMock(fixture);
  const visible = filterAdminRecords(mock.records, filters);
  const selected = mock.records.find((record) => record.id === selectedId);
  const invalidRange = invalidAdminDateRange(filters);

  return <div className={styles.page}>
    <header className={styles.intro}><div><h1>{definition.title}</h1><p>{definition.description}</p></div>
      {definition.introAction && <div>{definition.introActionPending && <p id={`${id}-pending-intro`}>{vi.admin.collection.pendingRules}</p>}<button className={styles.secondaryButton} type="button" disabled={definition.introActionPending} aria-describedby={definition.introActionPending ? `${id}-pending-intro` : undefined} onClick={() => setInfo(true)}>{definition.introAction}</button></div>}
    </header>
    <PendingMetrics labels={definition.metricLabels} />
    <div className={styles.filterBar}>
      <div className={styles.tabs} role="group" aria-label={formatMessage(vi.admin.collection.filterLabel, { title: definition.title.toLowerCase() })}>
        {definition.filters.map((filter) => <button type="button" key={filter.value} aria-pressed={filters.group === filter.value} onClick={() => setFilters({ ...filters, group: filter.value })}>{filter.label}</button>)}
      </div>
      <label className={styles.search}><Search size={15} aria-hidden="true" /><span className={styles.srOnly}>{definition.searchLabel}</span><input type="search" placeholder={definition.searchLabel} value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} /></label>
    </div>
    {definition.dateFilter && <div className={styles.dateFilters}>
      <SlidersHorizontal size={16} aria-hidden="true" /><label>{vi.admin.collection.fromDate}<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} aria-invalid={invalidRange} aria-describedby={invalidRange ? `${id}-date-error` : undefined} /></label>
      <label>{vi.admin.collection.toDate}<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} aria-invalid={invalidRange} aria-describedby={invalidRange ? `${id}-date-error` : undefined} /></label>
      {invalidRange && <p role="alert" id={`${id}-date-error`}>{vi.admin.collection.invalidDateRange}</p>}
    </div>}
    <section className={styles.card} aria-labelledby={`${id}-list-title`} aria-busy={mock.status === "loading"}>
      <div className={styles.sectionHeading}><div><h2 id={`${id}-list-title`}>{definition.listTitle}</h2><p>{definition.listDescription}</p></div><p role="status">{mock.status === "ready" ? formatMessage(vi.admin.collection.resultCount, { visible: visible.length, total: mock.records.length }) : ""}</p></div>
      {mock.status === "loading" ? <div className={styles.state} role="status"><span className={styles.spinner} aria-hidden="true" />{vi.admin.collection.loading}</div>
        : mock.status === "error" ? <div className={styles.state}><h3 role="alert">{vi.admin.collection.loadError}</h3><p>{vi.admin.collection.loadErrorHint}</p><button className={styles.secondaryButton} type="button" onClick={() => mock.load()}>{vi.common.actions.retry}</button></div>
        : visible.length === 0 ? <div className={styles.state}><h3>{mock.records.length ? vi.admin.collection.noResults : vi.admin.collection.emptyTitle}</h3><p>{invalidRange ? vi.admin.collection.invalidDateHint : mock.records.length ? vi.admin.collection.noResultsHint : vi.admin.collection.emptyDescription}</p>{!!mock.records.length && <button type="button" className={styles.secondaryButton} onClick={() => setFilters(defaultAdminFilters)}>{vi.admin.collection.clearFilters}</button>}</div>
        : <div className={styles.tableFrame} tabIndex={0} role="region" aria-label={formatMessage(vi.admin.collection.tableLabel, { title: definition.listTitle })}>
          <table><thead><tr>{definition.headers.map((header) => <th scope="col" key={header}>{header}</th>)}<th scope="col">{vi.admin.collection.details}</th></tr></thead>
            <tbody>{visible.map((record) => <tr key={record.id}>{record.cells.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{index === record.cells.length - 1 ? <AdminStatus status={record.status} /> : cell}</td>)}
              <td><button type="button" className={styles.textButton} onClick={() => setSelectedId(record.id)} aria-label={formatMessage(vi.admin.collection.viewDetailsLabel, { title: record.title })}>{vi.admin.collection.view}{" "}<ArrowRight size={13} aria-hidden="true" /></button></td>
            </tr>)}</tbody>
          </table>
        </div>}
      <p className={styles.listFooter}>{vi.admin.collection.fixtureNotice}</p>
    </section>
    {mock.status === "ready" && visible[0] && <section className={`${styles.card} ${styles.detailPreview}`} aria-label={vi.admin.collection.quickPreviewLabel}>
      <div className={styles.sectionHeading}><h2>{visible[0].title}</h2><span className={`${styles.badge} ${styles.info}`}>{vi.admin.collection.sampleRecord}</span></div>
      <AdminRecordDetails record={visible[0]} />
      <button className={styles.textButton} type="button" onClick={() => setSelectedId(visible[0].id)}>{vi.admin.collection.viewFull}{" "}<ArrowRight size={14} aria-hidden="true" /></button>
    </section>}
    <details className={styles.mockTools}><summary>{vi.admin.collection.mockToolsTitle}</summary><p>{vi.admin.collection.mockToolsDescription}</p><div>
      <button type="button" disabled={mock.status === "loading"} onClick={() => mock.load("error")}>{vi.admin.collection.simulateLoadError}</button>
      <button type="button" disabled={mock.status === "loading"} onClick={() => mock.load("empty")}>{vi.admin.collection.emptyList}</button>
      <button type="button" disabled={mock.status === "loading"} onClick={() => { setFilters(defaultAdminFilters); mock.load(); }}>{vi.admin.collection.restoreFixtures}</button>
    </div></details>
    {selected && <AdminDialog title={selected.title} onClose={() => setSelectedId(null)}><AdminRecordDetails record={selected} /></AdminDialog>}
    {info && <AdminDialog title={definition.introAction ?? definition.title} onClose={() => setInfo(false)}>{definition.introNotes?.map((note) => <p key={note}>{note}</p>)}<p>{vi.admin.collection.pendingActionsDescription}</p></AdminDialog>}
  </div>;
}
