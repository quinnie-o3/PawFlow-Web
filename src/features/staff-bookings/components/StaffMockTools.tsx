import type { StaffMockScenario } from "../types";
import styles from "../staffBookings.module.css";

export default function StaffMockTools({ clockInput, clockError, simulateFailure, disabled, onClockInputChange, onApplyClock, onFailureChange, onScenario, onReset }: {
  clockInput: string;
  clockError: string;
  simulateFailure: boolean;
  disabled: boolean;
  onClockInputChange: (value: string) => void;
  onApplyClock: () => void;
  onFailureChange: (enabled: boolean) => void;
  onScenario: (scenario: StaffMockScenario) => void;
  onReset: () => void;
}) {
  return <details className={styles.mockTools}>
    <summary>Thử dữ liệu mô phỏng</summary>
    <p>Đồng hồ cố định, không chạy theo giờ máy. Điều khiển bên dưới chỉ tác động tới phiên mẫu, không gọi API.</p>
    <form className={styles.clockForm} noValidate onSubmit={(event) => { event.preventDefault(); onApplyClock(); }}>
      <label className={styles.field}>Ngày giờ mô phỏng (Asia/Ho_Chi_Minh · UTC+7)
        <input type="datetime-local" value={clockInput} onChange={(event) => onClockInputChange(event.target.value)}
          disabled={disabled} aria-invalid={!!clockError} aria-describedby={clockError ? "staff-clock-error" : undefined} />
      </label>
      <button type="submit" className={styles.secondaryButton} disabled={disabled}>Áp dụng thời gian</button>
    </form>
    {clockError && <p id="staff-clock-error" role="alert" className={styles.operationError}>{clockError}</p>}
    <label className={styles.check}><input type="checkbox" checked={simulateFailure} disabled={disabled}
      onChange={(event) => onFailureChange(event.target.checked)} />Giả lập lỗi thao tác</label>
    <p>“Danh sách rỗng” làm rỗng dữ liệu phiên. Lỗi tải / Thử lại giữ dữ liệu, đồng hồ và nhật ký. “Khôi phục mẫu” xóa thay đổi, nhật ký, lỗi, lựa chọn và bộ lọc; đưa đồng hồ về 21/10/2026 08:00.</p>
    <div className={styles.mockButtons}>
      <button type="button" disabled={disabled} onClick={() => onScenario("error")}>Giả lập lỗi tải</button>
      <button type="button" disabled={disabled} onClick={() => onScenario("empty")}>Danh sách rỗng</button>
      <button type="button" disabled={disabled} onClick={onReset}>Khôi phục mẫu</button>
    </div>
  </details>;
}
