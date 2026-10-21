# FE-011 — Provider Thông báo

Route `/dashboard/notifications`, đúng đường dẫn đã có trong Sidebar. Route chỉ ghép `ProviderNotificationsPage` và dùng layout cha.

Chủ dự án đã cho phép **triển khai ngay trên nhánh FE-010, chỉ thêm file riêng** khi FE-010 và layout còn thay đổi chưa commit. Không tạo/chuyển nhánh, stage, commit, push, PR hoặc merge. Không sửa các file có sẵn, kể cả AGENTS.md, layout, Header, Sidebar hoặc module Lịch hẹn.

## Thiết kế và các quyết định đã xác nhận

- Màn chính: [Website → PawFlow → Dashboard → Provider Thông báo, node 4664:15566](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4664-15566). Đã đọc design context và ảnh trang; Archive được đánh dấu không dùng. Đã đọc dialog Tùy chọn `5021:3606`, nhưng không tạo cài đặt hoặc nút lưu không có tác dụng.
- Chủ dự án đồng ý bổ sung bộ lọc **Tất cả / Chưa đọc / Đã đọc**, modal chi tiết chỉ đọc theo component dialog hiện có và sáu loại từ Figma: yêu cầu đặt lịch mới, sắp đến giờ hẹn, khách đã hủy lịch, đánh giá mới, hồ sơ được duyệt, lịch đã hoàn thành.
- Không đưa cảnh báo vận hành/DSS từ thiết kế vào nguồn thông báo; chưa có định nghĩa sự kiện đã chốt. Không thêm Staff, marketing, gửi tin, xóa thông báo hoặc cài đặt email/push.
- Module Lịch hẹn chưa nhận booking ID từ URL. Chủ dự án chọn **chỉ hiển thị mã booking trong chi tiết, chưa có link mở booking**. Không tạo route hoặc cơ chế liên kết mới trong Lịch hẹn. Đánh giá và hồ sơ cũng chỉ xem nội dung thông báo, không tạo link tới trang chưa tồn tại.
- Dùng Lucide thay ký tự viết tắt trong vòng tròn loại thông báo theo yêu cầu triển khai. Giữ bảng màu, danh sách, tiêu đề, badge và khối hướng dẫn của Figma. Các asset nền/logo/avatar thuộc shell dùng nguyên component hiện tại; feature không có asset ảnh mới hoặc URL Figma tạm thời.
- Hiển thị toàn bộ bảy thông báo mẫu; dùng số kết quả thật, không dựng các trang phân trang 2–12 khi chưa có dữ liệu. Số chưa đọc lấy từ dữ liệu (mặc định **3**), không dùng cứng số `07` minh họa trên Figma.

## Nguồn dữ liệu và hành vi

`types.ts` định nghĩa các mô hình nội bộ; không đại diện cho API contract. `data/providerNotificationsMock.ts` là fixture độc lập. `notificationLogic.ts` chứa selector phạm vi/bộ lọc, định dạng ngày và reducer. `useNotificationsMock.ts` điều phối timer tải/cập nhật 350ms và state trong bộ nhớ. Các component chỉ nhận dữ liệu/thao tác từ hook.

- Owner cố định `owner-demo` / Dane Nguyen; cơ sở `MOCK-PAWCARE` / PawCare Studio. Mọi selector kiểm tra đồng thời recipient Owner ID và facility ID.
- Loader loại dữ liệu ngoài phạm vi trước khi lưu vào state của màn hình. Fixture có ba hàng ngoài phạm vi để kiểm thử: cùng cơ sở nhưng khác người nhận, cùng người nhận nhưng khác cơ sở và khác cả hai. Chúng không vào danh sách, chi tiết, số đếm hoặc kết quả cập nhật.
- Danh sách đã giới hạn phạm vi là nguồn chung cho cả số chưa đọc và bộ lọc. Đổi bộ lọc không làm thay đổi tổng số chưa đọc. Thứ tự danh sách giữ theo mẫu Figma.
- Mở chi tiết gửi lệnh `open`; trong khi chờ chưa đổi dữ liệu hoặc báo thành công. Khi resolve thành công, reducer đánh dấu đúng thông báo đã đọc và mở chi tiết trong cùng một lần cập nhật state. Nếu đã đọc, giữ timestamp cũ và số đếm. Lỗi mô phỏng giữ nguyên dữ liệu, không mở modal và có thử lại đúng lệnh.
- “Đánh dấu đã đọc” trên từng hàng chỉ đổi thông báo đó, không mở chi tiết. “Đánh dấu tất cả của tôi tại cơ sở là đã đọc” xử lý mọi thông báo chưa đọc của Owner/cơ sở hiện tại, kể cả ngoài bộ lọc. Nhãn, hướng dẫn cạnh nút và phản hồi nói rõ phạm vi. Lỗi bulk giữ nguyên toàn bộ dữ liệu.
- Chỉ nhận một thao tác tại một thời điểm. Không nhận cập nhật khi chưa tải thành công; không reload trong lúc cập nhật. Kiểm tra lại phạm vi và ID khi resolve. Lệnh resolve lặp khi không có pending không làm thay đổi dữ liệu.
- Đã đọc/chưa đọc có chữ và icon, bên cạnh màu nền khác nhau. Không cắt nội dung bằng line clamp hoặc chiều cao cố định. Nội dung và dòng mới được giữ trong danh sách lẫn modal.
- Modal dùng lại `DashboardDialog` có nhãn, focus ban đầu, Esc và giới hạn Tab/Shift+Tab. Khi đóng, trả focus về nút mở còn tồn tại; nếu hàng biến mất do bộ lọc Chưa đọc thì focus về tiêu đề Thông báo. Modal dài tự cuộn. Khung rộng/khoảng đệm và main cuộn riêng do layout hiện tại cung cấp.

## Giới hạn mock và cách thử

- Không API, realtime, gửi thông báo, database, localStorage hoặc sessionStorage. Không giả lập đồng bộ dữ liệu hoặc trạng thái với Lịch hẹn/Khách hàng/Dashboard. Badge chuông Header chưa đồng bộ.
- Trạng thái đọc chỉ tồn tại trong phiên mount trang. Tải lại hoặc rời trang khôi phục fixture mặc định. Các nút đổi kịch bản tải lại fixture riêng của Thông báo và reset bộ lọc.
- Đồng hồ mô phỏng cố định **29/09/2026 15:00 Asia/Ho_Chi_Minh**, có nhãn trong khối thử mock. Nội dung nghiệp vụ của bảy hàng giữ theo màn Figma; các timestamp tuyệt đối, ID thông báo và readAt là dữ liệu minh họa. Không suy ra điều kiện phát sinh sự kiện hoặc lịch nhắc từ timestamp này.
- Mọi thời gian thông báo dùng `Asia/Ho_Chi_Minh`, hiển thị ngày/tháng/năm và giờ/phút. Modal ghi thêm timezone và UTC+07:00. Không dùng timezone trình duyệt để đổi ngày.
- Mở “Dữ liệu mô phỏng và các trạng thái thử”: checkbox lỗi mở/cập nhật **một lần**, tự tắt khi gửi lệnh; nút “Thử lại thao tác” sau lỗi sẽ thử lại đúng lệnh. Có nút thử lỗi tải và “Thử tải lại”, thử danh sách rỗng, nội dung dài và khôi phục mẫu.
- Kịch bản nội dung dài lặp nội dung đánh giá đã có từ Figma, có dấu kết thúc để kiểm tra cuộn; không bổ sung đánh giá hoặc quy tắc nghiệp vụ mới.
- Bản mock không thay thế xác thực/phân quyền backend. Khi có API, backend phải xác thực Owner và cơ sở được quản lý; không gửi dữ liệu người nhận/cơ sở khác xuống trình duyệt. Chưa suy ra endpoint hoặc contract phân trang, retry, đánh dấu đã đọc từ fixture.

## Kiểm tra

Không cài thêm dependency. Test dùng Node test runner và TypeScript đã có:

```sh
notifications_test_dir=$(mktemp -d /tmp/pawflow-fe011-tests.XXXXXX)
./node_modules/.bin/tsc src/features/provider-notifications/notificationLogic.test.ts --outDir "$notifications_test_dir" --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck
node --test "$notifications_test_dir/notificationLogic.test.js"
```

19 test logic đạt: lọc đồng thời người nhận/cơ sở, bộ lọc đọc và số đếm chung nguồn, loader loại dữ liệu ngoài phạm vi, chặn cập nhật trước tải, mở/đọc thành công và lỗi/thử lại, bulk toàn phạm vi và lỗi nguyên vẹn, ID ngoài phạm vi, kiểm tra lại scope khi resolve, thao tác đồng thời/resolve lặp, giữ timestamp đã đọc, lỗi tải/thử lại, rỗng/không kết quả, ngày Việt Nam qua biên ngày/năm và fixture/nội dung dài.

- `npm run lint`: đạt.
- `npx tsc --noEmit`: đạt.
- `npm run build`: đạt, có route tĩnh `/dashboard/notifications`.
- Local production: [http://localhost:3013/dashboard/notifications](http://localhost:3013/dashboard/notifications), xác nhận HTTP 200 và tiến trình lắng nghe cổng 3013.

- Chromium/Playwright trên production build tại **1440×1000, 768×1024, 390×844**: đủ bảy hàng/sáu loại, lọc Tất cả/Chưa đọc/Đã đọc, không lộ fixture khác Owner/cơ sở, đọc từng hàng, mở chi tiết và cập nhật số đếm, lỗi/thử lại cho mở chi tiết/đọc một/bulk/tải, bulk khi đang lọc Đã đọc vẫn xử lý thông báo chưa đọc ngoài bộ lọc, rỗng/không kết quả/xóa bộ lọc, nội dung dài, tải lại khôi phục mẫu và không có link giả trong feature. Không có lỗi JavaScript/console.
- Modal đã kiểm tra nhãn, Esc, focus ban đầu, Tab/Shift+Tab giữ bên trong và trả focus về nút mở hoặc tiêu đề khi hàng Chưa đọc biến mất. Script đợi frame trả focus trước khi kiểm tra kết quả. Nội dung dài cuộn đến được cuối modal, không tràn ngang.
- Main cuộn riêng; Header và Sidebar giữ nguyên tọa độ. Không tràn ngang trang/main ở cả ba kích thước. Trình duyệt dùng timezone `America/Los_Angeles`, dữ liệu vẫn hiển thị đúng giờ Việt Nam. Đã xem ảnh desktop/tablet/mobile và modal ngắn/dài; icon Lucide hiển thị đúng hình học 22×22px trong vòng tròn của loại thông báo.
- Script, ảnh và kết quả tại `/tmp/pawflow-fe011-browser/` (`check.cjs`, `results.json`, ảnh theo tiền tố 1440/768/390). Dùng Playwright và Chromium có sẵn trên máy, không cài dependency.
- So sánh SHA-256 xác nhận **133 file có sẵn** (tracked và untracked không bị ignore), bao gồm toàn bộ FE-010, AGENTS.md và layout, giữ nguyên nội dung. FE-011 chỉ thêm 14 file liệt kê bên dưới. `git diff --check` đạt; file mới không có whitespace cuối dòng. Index trống, nhánh vẫn FE-010.

Chưa kiểm tra Safari/Firefox, screen reader thật, thiết bị thật hoặc API/phân quyền backend. Không còn câu hỏi chặn phạm vi đã xác nhận. Shell tiếp tục dùng các khác biệt đã chốt từ task trước về độ rộng, khoảng đệm, avatar và Header; FE-011 không sửa chúng theo Figma.

## File mới của FE-011

```text
docs/FE-011-provider-notifications.md
src/app/dashboard/notifications/page.tsx
src/features/provider-notifications/types.ts
src/features/provider-notifications/data/providerNotificationsMock.ts
src/features/provider-notifications/notificationLogic.ts
src/features/provider-notifications/notificationLogic.test.ts
src/features/provider-notifications/useNotificationsMock.ts
src/features/provider-notifications/notifications.module.css
src/features/provider-notifications/components/ProviderNotificationsPage.tsx
src/features/provider-notifications/components/NotificationsToolbar.tsx
src/features/provider-notifications/components/NotificationsList.tsx
src/features/provider-notifications/components/NotificationDetailsDialog.tsx
src/features/provider-notifications/components/NotificationsFeedback.tsx
src/features/provider-notifications/components/NotificationsMockTools.tsx
```
