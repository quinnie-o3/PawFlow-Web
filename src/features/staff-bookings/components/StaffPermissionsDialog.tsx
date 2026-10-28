import StaffDialog from "./StaffDialog";
import styles from "../staffBookings.module.css";

export default function StaffPermissionsDialog({ onClose }: { onClose: () => void }) {
  return <StaffDialog title="Nhân viên tại một cơ sở" onClose={onClose}>
    <div className={styles.permissionCopy}>
      <p>Ngọc Mai · PawCare Studio</p>
      <p>Staff ACTIVE chỉ xem và xử lý booking của cơ sở được phân công. Bản mock dùng quyền chung, không có cấp quyền riêng từng nhân viên.</p>
      <p>Chờ xác nhận → Đã xác nhận hoặc Từ chối. Đã xác nhận → Hoàn thành hoặc Không đến. Không hủy, sửa lịch hoặc sửa trạng thái kết thúc.</p>
      <p>Chỉ xác nhận trước giờ bắt đầu. Từ chối bắt buộc có lý do. Hoàn thành từ giờ kết thúc theo thời lượng snapshot, phải xác nhận đã làm xong dịch vụ và không yêu cầu đã thanh toán. Không đến từ giờ bắt đầu, phải xác nhận khách / pet chưa đến và ghi lý do.</p>
      <p>Xem tên khách, số điện thoại gắn với lịch, giá snapshot chỉ đọc và thông tin pet cần cho dịch vụ nếu booking có dữ liệu. Chưa hiển thị email hoặc mở hồ sơ đầy đủ.</p>
      <p>Không có quyền dashboard kinh doanh, truy cập quản lý dịch vụ / giá hoặc quản trị nền tảng.</p>
      <p>Ghi nhận thanh toán thuộc quyền chủ cơ sở.</p>
      <p>Đây là quy tắc UI/mock đã chốt, chưa xác nhận API/backend hỗ trợ đầy đủ hoặc đã bảo đảm phân quyền thật.</p>
    </div>
  </StaffDialog>;
}
