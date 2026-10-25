"use client";

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
      {definition.introAction && <div>{definition.introActionPending && <p id={`${id}-pending-intro`}>Chờ xác nhận quy tắc</p>}<button className={styles.secondaryButton} type="button" disabled={definition.introActionPending} aria-describedby={definition.introActionPending ? `${id}-pending-intro` : undefined} onClick={() => setInfo(true)}>{definition.introAction}</button></div>}
    </header>
    <PendingMetrics labels={definition.metricLabels} />
    <div className={styles.filterBar}>
      <div className={styles.tabs} role="group" aria-label={`Lọc ${definition.title.toLowerCase()}`}>
        {definition.filters.map((filter) => <button type="button" key={filter.value} aria-pressed={filters.group === filter.value} onClick={() => setFilters({ ...filters, group: filter.value })}>{filter.label}</button>)}
      </div>
      <label className={styles.search}><Search size={15} aria-hidden="true" /><span className={styles.srOnly}>{definition.searchLabel}</span><input type="search" placeholder={definition.searchLabel} value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} /></label>
    </div>
    {definition.dateFilter && <div className={styles.dateFilters}>
      <SlidersHorizontal size={16} aria-hidden="true" /><label>Từ ngày<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} aria-invalid={invalidRange} aria-describedby={invalidRange ? `${id}-date-error` : undefined} /></label>
      <label>Đến ngày<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} aria-invalid={invalidRange} aria-describedby={invalidRange ? `${id}-date-error` : undefined} /></label>
      {invalidRange && <p role="alert" id={`${id}-date-error`}>Ngày kết thúc phải từ ngày bắt đầu trở đi.</p>}
    </div>}
    <section className={styles.card} aria-labelledby={`${id}-list-title`} aria-busy={mock.status === "loading"}>
      <div className={styles.sectionHeading}><div><h2 id={`${id}-list-title`}>{definition.listTitle}</h2><p>{definition.listDescription}</p></div><p role="status">{mock.status === "ready" ? `${visible.length} / ${mock.records.length} mục mẫu` : ""}</p></div>
      {mock.status === "loading" ? <div className={styles.state} role="status"><span className={styles.spinner} aria-hidden="true" />Đang tải dữ liệu mẫu…</div>
        : mock.status === "error" ? <div className={styles.state}><h3 role="alert">Không tải được dữ liệu mẫu</h3><p>Thử tải lại để xem danh sách.</p><button className={styles.secondaryButton} type="button" onClick={() => mock.load()}>Thử lại</button></div>
        : visible.length === 0 ? <div className={styles.state}><h3>{mock.records.length ? "Không tìm thấy kết quả" : "Chưa có dữ liệu"}</h3><p>{invalidRange ? "Kiểm tra lại khoảng ngày." : mock.records.length ? "Thử từ khóa khác hoặc xóa bộ lọc." : "Danh sách mẫu hiện đang rỗng."}</p>{!!mock.records.length && <button type="button" className={styles.secondaryButton} onClick={() => setFilters(defaultAdminFilters)}>Xóa bộ lọc</button>}</div>
        : <div className={styles.tableFrame} tabIndex={0} role="region" aria-label={`${definition.listTitle}, cuộn ngang để xem thêm`}>
          <table><thead><tr>{definition.headers.map((header) => <th scope="col" key={header}>{header}</th>)}<th scope="col">Chi tiết</th></tr></thead>
            <tbody>{visible.map((record) => <tr key={record.id}>{record.cells.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{index === record.cells.length - 1 ? <AdminStatus status={record.status} /> : cell}</td>)}
              <td><button type="button" className={styles.textButton} onClick={() => setSelectedId(record.id)} aria-label={`Xem chi tiết ${record.title}`}>Xem <ArrowRight size={13} aria-hidden="true" /></button></td>
            </tr>)}</tbody>
          </table>
        </div>}
      <p className={styles.listFooter}>Dữ liệu minh họa từ Figma · Chỉ đọc · Không kết nối API</p>
    </section>
    {mock.status === "ready" && visible[0] && <section className={`${styles.card} ${styles.detailPreview}`} aria-label="Chi tiết nhanh bản ghi đầu danh sách">
      <div className={styles.sectionHeading}><h2>{visible[0].title}</h2><span className={`${styles.badge} ${styles.info}`}>Bản ghi mẫu</span></div>
      <AdminRecordDetails record={visible[0]} />
      <button className={styles.textButton} type="button" onClick={() => setSelectedId(visible[0].id)}>Xem đầy đủ <ArrowRight size={14} aria-hidden="true" /></button>
    </section>}
    <details className={styles.mockTools}><summary>Dữ liệu mô phỏng · Kiểm tra trạng thái giao diện</summary><p>Các tình huống dưới đây chỉ đổi cách tải fixture của màn này; không cập nhật bản ghi hoặc KPI.</p><div>
      <button type="button" disabled={mock.status === "loading"} onClick={() => mock.load("error")}>Mô phỏng lỗi tải</button>
      <button type="button" disabled={mock.status === "loading"} onClick={() => mock.load("empty")}>Danh sách rỗng</button>
      <button type="button" disabled={mock.status === "loading"} onClick={() => { setFilters(defaultAdminFilters); mock.load(); }}>Khôi phục dữ liệu mẫu</button>
    </div></details>
    {selected && <AdminDialog title={selected.title} onClose={() => setSelectedId(null)}><AdminRecordDetails record={selected} /></AdminDialog>}
    {info && <AdminDialog title={definition.introAction ?? definition.title} onClose={() => setInfo(false)}>{definition.introNotes?.map((note) => <p key={note}>{note}</p>)}<p>Chi tiết thao tác đang chờ xác nhận quy tắc. Bạn có thể tìm kiếm, lọc và xem bản ghi mẫu; chưa cập nhật dữ liệu trong phiên UI này.</p></AdminDialog>}
  </div>;
}
