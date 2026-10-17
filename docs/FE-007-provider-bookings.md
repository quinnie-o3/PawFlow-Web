# FE-007 — Provider Lịch hẹn

Route: `/dashboard/bookings`, theo Sidebar FE-005. Kế thừa shell và không sửa trang Tổng quan.

Thiết kế chính: [Provider Lịch hẹn](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4664-14648), dialog `5021:3412` và `5021:3433`, thuộc Website → PawFlow; không dùng Archive.

Khác biệt có sẵn của shell FE-005 được giữ nguyên: avatar dạng biểu tượng thay cho ảnh Figma, Sidebar desktop rộng 285px (thiết kế màn này 275px). Dialog dùng font kế thừa từ shell để không thêm font/config chung.

## Quy tắc đã được chủ dự án xác nhận

- FE-007 tập trung Provider Owner. Không mặc định cấp quyền chuyển trạng thái cho Staff.
- Pending Confirmation chỉ chuyển sang Confirmed hoặc Rejected.
- Owner có thể hủy Confirmed **trước** giờ bắt đầu. Lý do bắt buộc sau khi trim. Từ giờ bắt đầu trở đi không được hủy.
- Confirmed có thể Completed từ giờ kết thúc dự kiến trở đi: giờ bắt đầu + thời lượng đã lưu khi đặt. Provider phải xác nhận dịch vụ thực tế hoàn tất. Không yêu cầu Paid.
- Confirmed có thể No-show từ giờ bắt đầu trở đi. Provider phải xác nhận khách thực tế không đến.
- Rejected, Cancelled, Completed, No-show là trạng thái kết thúc; không chuyển tiếp.
- Mọi thao tác đều có bước xác nhận. Không tự chuyển trạng thái theo thời gian.
- Mốc thời gian dùng `Asia/Ho_Chi_Minh`; thời điểm hiện tại truyền vào hàm kiểm tra.
- Khi xác nhận, kiểm tra lại quyền, trạng thái hiện tại, mốc thời gian, lý do và xác nhận kết quả thực tế. Chặn thao tác đồng thời và trạng thái cũ.
- Log gồm mã booking, trạng thái trước/sau, trạng thái được yêu cầu, người thao tác, thời điểm, lý do và kết quả. Thất bại giữ nguyên dữ liệu và có log.

## Giới hạn mock và cách thử

- Không có API, endpoint, lưu trữ trình duyệt hay thanh toán. Dữ liệu và nhật ký tồn tại trong phiên mount trang; tải lại trang sẽ khôi phục mẫu.
- Đồng hồ cố định: **15/10/2026 10:00 Asia/Ho_Chi_Minh**, có nhãn “Thời gian mô phỏng”. Không phụ thuộc đồng hồ máy.
- 8 booking mẫu khớp các hàng trên Figma và phủ đủ 6 trạng thái. Các trường không có trong thiết kế là fixture minh họa, không phải API contract. Thẻ tổng hợp tính trực tiếp từ toàn bộ danh sách mock, độc lập bộ lọc, không dùng số tổng hợp minh họa `06 / 18 / 88` của Figma.
- Tìm theo mã, khách hoặc thú cưng, không phân biệt hoa/thường và dấu; kết hợp với bộ lọc trạng thái.
- `PF-2084/2083/2082`: xác nhận hoặc từ chối. Sau khi xác nhận có thể thử hủy trước giờ; hoàn thành và không đến bị khóa kèm giải thích.
- `PF-2079`: đã qua giờ kết thúc, thử Completed hoặc No-show. Bước xác nhận yêu cầu tích xác nhận kết quả thực tế.
- Mở “Dữ liệu mô phỏng” bên dưới bảng để bật lỗi thao tác, thử danh sách rỗng hoặc khôi phục dữ liệu. Thất bại giữ dialog mở; quay lại, tắt lỗi và thử lại. Khôi phục mẫu xóa trạng thái và log phiên hiện tại.
- Khi lọc không có kết quả, hiển thị thông báo riêng và nút xóa bộ lọc.
- Bảng cuộn trong vùng riêng; dialog native hỗ trợ focus trong modal, Esc, trả focus khi đóng và nhãn truy cập. Trong khi xử lý, thao tác và đóng dialog bị khóa.
- Nút Lịch khả dụng giữ đường dẫn đã có trong Sidebar; trang đích chưa được triển khai trong FE-007.

## Khi tích hợp backend

Backend phải kiểm tra lại quyền Owner, trạng thái, mốc thời gian, thời lượng snapshot, lý do và chống thao tác lặp/cạnh tranh. Backend quyết định nguồn đồng hồ, lưu audit log bền vững và contract lỗi. Các fixture, reducer và mã người thao tác mock không đại diện cho cơ chế phân quyền hay endpoint thật.

## Kiểm tra logic không thêm dependency

Biên dịch test cùng các module thuần ra thư mục tạm rồi chạy Node test runner:

```sh
test_output=$(mktemp -d /tmp/pawflow-fe007-tests.XXXXXX)
./node_modules/.bin/tsc src/features/provider-bookings/bookingLogic.test.ts --outDir "$test_output" --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
node --test "$test_output/bookingLogic.test.js"
```

Ngoài ra chạy `npm run lint`, `npx tsc --noEmit`, `npm run build`; kiểm tra trình duyệt ở 1440/768/390px.

Kết quả triển khai: 12 test logic đạt. Kiểm tra Chromium/Playwright tại cả ba kích thước: tìm kiếm kết hợp bộ lọc, đủ 6 trạng thái, chi tiết đúng booking, Esc/focus, xác nhận/từ chối, hủy có lý do, Completed/No-show có xác nhận thực tế, lỗi/thử lại, log và danh sách rỗng. Không phát hiện lỗi JavaScript; bảng cuộn trong vùng riêng và không làm tràn ngang trang. Playwright dùng bản đã có trên máy, không cài dependency.
