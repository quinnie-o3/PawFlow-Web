"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { filterBookings, formatBookingDate, statusLabels, statusOrder, summarizeBookings } from "../bookingLogic";
import { mockBookings, mockNow } from "../data/providerBookingsMock";
import { useBookingsMock } from "../useBookingsMock";
import type { BookingFilters } from "../types";
import BookingDetailsDialog from "./BookingDetailsDialog";
import BookingStatusBadge from "./BookingStatusBadge";
import styles from "../bookings.module.css";

export default function ProviderBookingsPage() {
  const { state, dispatch } = useBookingsMock();
  const searchParams = useSearchParams();
  const filters: BookingFilters = {
    query: searchParams.get("q") ?? "",
    status: statusOrder.find((status) => status === searchParams.get("status")) ?? "all",
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [feedbackOffset, setFeedbackOffset] = useState(0);
  const visible = filterBookings(state.bookings, filters);
  const selected = state.bookings.find((booking) => booking.id === selectedId);
  const summary = summarizeBookings(state.bookings);
  const feedback = state.logs.length > feedbackOffset ? state.feedback : null;

  function setFilters(next: BookingFilters, replace = false) {
    const url = new URL(window.location.href);
    if (next.status === "all") url.searchParams.delete("status");
    else url.searchParams.set("status", next.status);
    if (next.query) url.searchParams.set("q", next.query);
    else url.searchParams.delete("q");
    // Keep mock edits and scroll intact; Next.js syncs native history with useSearchParams.
    window.history[replace ? "replaceState" : "pushState"](null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openBooking(id: string) {
    setFeedbackOffset(state.logs.length);
    setSelectedId(id);
  }

  return <div className={styles.page} lang="vi">
    <div className={styles.providerTab}>DÀNH CHO PROVIDER</div>
    <header className={styles.intro}>
      <div><h1>Lịch hẹn</h1><p>Quản lý các yêu cầu và trạng thái lịch tại PawCare Studio</p></div>
      <Link href="/dashboard/availability" prefetch={false} className={styles.availabilityLink}>Lịch khả dụng</Link>
    </header>
    <div className={styles.summaries} aria-label="Tổng hợp dữ liệu mô phỏng">
      {summary.map((item) => <article key={item.status}>
        <h2>{item.title}</h2><p className={styles.summaryCount}>{String(item.count).padStart(2, "0")}</p>
        <p>{item.status === "pendingConfirmation" ? "Ưu tiên xử lý" : item.status === "confirmed" ? "Các lịch đã được xác nhận" : "Không tính lịch bị hủy"}</p>
      </article>)}
    </div>
    <div className={styles.filters} role="group" aria-label="Lọc trạng thái lịch hẹn">
      <button type="button" aria-pressed={filters.status === "all"} onClick={() => setFilters({ ...filters, status: "all" })}>Tất cả</button>
      {statusOrder.map((status) => <button type="button" key={status} aria-pressed={filters.status === status} onClick={() => setFilters({ ...filters, status })}>{statusLabels[status]}</button>)}
    </div>
    <label className={styles.search}>
      <span className={styles.srOnly}>Tìm mã lịch, khách hàng hoặc thú cưng</span>
      <Search aria-hidden="true" focusable="false" size={14} strokeWidth={2} className={styles.searchIcon} />
      <input type="search" placeholder="Mã lịch hoặc khách" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value }, true)} />
    </label>
    <section className={styles.listCard} aria-labelledby="bookings-title">
      <div className={styles.listHeading}><h2 id="bookings-title" tabIndex={-1}>Danh sách lịch hẹn</h2><p>Chọn một lịch để xem chi tiết và xử lý đúng trạng thái.</p></div>
      {feedback && !selected && <p role={feedback.outcome === "error" ? "alert" : "status"} className={feedback.outcome === "error" ? styles.error : styles.success}>{feedback.message}</p>}
      <p className={styles.resultCount} role="status">Hiển thị {visible.length} / {state.bookings.length} lịch hẹn</p>
      {visible.length > 0 ? <div className={styles.tableFrame} tabIndex={0} role="region" aria-label="Bảng lịch hẹn, cuộn ngang để xem thêm">
        <table>
          <colgroup><col style={{ width: 85 }} /><col style={{ width: 170 }} /><col style={{ width: 190 }} /><col style={{ width: 140 }} /><col style={{ width: 130 }} /><col style={{ width: 140 }} /></colgroup>
          <thead><tr>{["Mã lịch", "Khách / thú cưng", "Dịch vụ", "Thời gian", "Trạng thái", "Thao tác"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{visible.map((booking) => <tr key={booking.id}>
            <th scope="row">{booking.id}</th><td>{booking.customerName} · {booking.petName}</td>
            <td>{booking.serviceName}</td><td>{formatBookingDate(booking.scheduledAt)}</td>
            <td><BookingStatusBadge status={booking.status} /></td>
            <td><button type="button" className={styles.detailButton} aria-label={`Xem chi tiết ${booking.id}`} onClick={() => openBooking(booking.id)}>Xem chi tiết</button></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className={styles.empty}>
        <h3>{state.bookings.length === 0 ? "Chưa có lịch hẹn" : filters.query.trim() ? "Không tìm thấy lịch hẹn" : "Không có lịch hẹn ở trạng thái này"}</h3>
        <p>{state.bookings.length === 0 ? "Các yêu cầu đặt lịch mới sẽ hiển thị tại đây." : "Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách."}</p>
        {state.bookings.length > 0 && <button className={styles.softButton} type="button" onClick={() => setFilters({ query: "", status: "all" })}>Xóa bộ lọc</button>}
      </div>}
      <p className={styles.listNote}>Trạng thái khác trong quy trình: Từ chối và Không đến. Chỉ cập nhật sau khi xem chi tiết lịch.</p>
    </section>
    <details className={styles.mockTools}>
      <summary>Dữ liệu mô phỏng · Thời gian mô phỏng: {formatBookingDate(mockNow, true)} (Asia/Ho_Chi_Minh)</summary>
      <p>Các số tổng hợp được tính từ danh sách mẫu. Thay đổi và nhật ký chỉ lưu trong phiên trang hiện tại; tải lại trang để bắt đầu lại.</p>
      <label className={styles.checkboxLabel}><input type="checkbox" checked={simulateFailure} onChange={(event) => setSimulateFailure(event.target.checked)} disabled={!!state.pending} />Mô phỏng lỗi thao tác (tắt để thử lại)</label>
      <div className={styles.scenarios}>
        <button type="button" className={styles.softButton} disabled={!!state.pending} onClick={() => { dispatch({ type: "scenario", bookings: [] }); setFeedbackOffset(0); }}>Xem danh sách rỗng</button>
        <button type="button" className={styles.softButton} disabled={!!state.pending} onClick={() => { dispatch({ type: "scenario", bookings: mockBookings }); setFilters({ query: "", status: "all" }); setFeedbackOffset(0); }}>Khôi phục dữ liệu mẫu</button>
      </div>
    </details>
    {selected && <BookingDetailsDialog key={selected.id} booking={selected}
      logs={state.logs.filter((entry) => entry.bookingId === selected.id)} pending={!!state.pending}
      feedback={feedback?.bookingId === selected.id ? feedback : null} simulateFailure={simulateFailure}
      onSubmit={(command) => dispatch({ type: "submit", command })} onClose={() => setSelectedId(null)} />}
  </div>;
}
