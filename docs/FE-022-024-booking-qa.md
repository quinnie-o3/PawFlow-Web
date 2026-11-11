# FE-022 + FE-024 — QA bước 3/4

Ngày 11/11/2026, Asia/Ho_Chi_Minh. Kết luận: đủ điều kiện bàn giao phạm vi
Customer UI/mock ở bước 4. Không còn lỗi tái hiện chưa xử lý trong các ca dưới
đây. Không coi kết quả này là QA API, Auth, thanh toán hoặc chống trùng server.

## Nền và bảo toàn

- Chỉ sửa trong PawFlow-Handoff-202611, nhánh FE-handoff-202611.
- HEAD giữ nguyên 13e51a74f524a164cdb5f8a74a8f5494f8eb3215. Trước QA, 37
  đường dẫn của diff bước 2 khớp manifest hash đã lưu.
- Đối chiếu trước/sau: cả 9 worktree cũ giữ nguyên branch, HEAD, status,
  diff hash, AGENTS và hash các file riêng đã ghi nhận. Auth FE-018-019 giữ
  nguyên. Hai diff AGENTS.md và src/app/dashboard/layout.tsx ở PawFlow-Web
  không đổi; cả 3 stash giữ nguyên SHA/nội dung danh sách.
- Không stage, commit, push, tạo PR, merge hoặc cập nhật sheet.

## Kết quả theo nhóm

| Nhóm | Bằng chứng và kết quả |
| --- | --- |
| Luồng chính | Chromium production: Provider Detail → pet/service/slot → review → gửi → dialog → list/detail. Cùng PF-M0001, PENDING_CONFIRMATION; sau hủy cùng ID là CANCELLED ở list và detail, hai status log. |
| Điều hướng/state | Back/Forward giữ booking/draft; sửa tên hoặc tạo pet từ Account/Pet được Booking đọc lại. Các URL /account, /account/pets, /discover, /providers/1 và query serviceId vẫn hoạt động trong Customer shell. |
| Reset | Reload detail làm booking mất và hiện thông báo reset; list rỗng. Rời Customer sang /login rồi Back cũng reset, kể cả khi submit đang pending. Không storage/cross-tab. |
| Submit lỗi | Pet archive, giá đổi cần review lại, slot đầy/đã qua/đóng; lỗi trước tạo giữ draft và retry. Loading/error/retry availability, list và detail có phản hồi hiển thị. |
| Timeout/gửi lặp | Double-click/requestSubmit/Enter chỉ một booking. Timeout sau tạo: lookup lỗi vẫn khóa, tìm lại đúng attempt trả một ID. Timeout trước tạo chỉ retry sau terminal absence. In-flight không mở khóa sớm. Hai attempt khác nhau cùng pet/slot vẫn được khi còn capacity. |
| Catalog/pet thay đổi lúc pending | Test adapter đọc lại nguồn thật của mock tại commit: full, price, closed, started, moved slot, duration, inactive service/category và foreign/inactive pet đều chặn tạo; không ghi booking/receipt hoặc chiếm thêm chỗ khi lỗi. |
| Hủy | Browser: own Pending trước start được hủy, đúng/sau start ẩn thao tác; reason tùy chọn. Logic: Pending và Confirmed ở start−1/start/start+1, foreign/missing/Staff bị từ chối, capacity chỉ trả một lần. |
| Review | Browser: chỉ Completed có nút, rating 0 bị báo lỗi, 5 hợp lệ, nội dung được render dạng text, lưu một lần rồi mất nút. Logic kiểm tra 1–5, rating không nguyên/NaN, quyền sở hữu và duplicate. |
| Complaint | Browser: Pending không có nút; Completed/Cancelled/Rejected/No-show đủ điều kiện, reason trắng/2001 ký tự bị lỗi; đang OPEN thì không gửi lần hai. Logic bao gồm Confirmed, IN_REVIEW, RESOLVED/REJECTED và foreign/Staff. |
| Responsive/a11y/locale | 1440×1000, 1920×1080, 768×1024, 390×844. Không tràn ngang trang; bảng mobile cuộn trong vùng riêng. Dialog trong viewport, Tab/Shift+Tab/Escape, khóa lúc busy, trả focus sau lưu/đóng. Nội dung dài và lỗi review/complaint trên mobile không làm tràn. Kiểm tra role alert/status, nhãn control, placeholder locale và ảnh thực sự hiển thị. Không page/console error ở các ca cuối. |

## Lỗi tái hiện và sửa

1. Slot vừa đầy khiến native date select tự hiện ngày khác với draft: giữ ngày
   của slot đã chọn trong danh sách, hiển thị slot cũ không khả dụng và yêu cầu
   người dùng chọn lại. Test browser kiểm lại cả giá trị select và lỗi submit.
2. Đổi query serviceId khi pending/unknown làm tóm tắt hiển thị dịch vụ khác:
   giữ context từ draft đang gửi/receipt. Tạo lượt mới mới chuyển sang service
   của URL. Kiểm lại pending, unknown và Back/Forward.
3. Nút mở dialog biến mất sau cancel/review/complaint hoặc submit thành công:
   Booking khai báo đích trả focus ổn định (heading/receipt link).
4. Khóa tất cả control khi busy làm focus rơi về body: focus dialog, giữ Tab và
   chặn Escape đóng trong lúc lưu.
5. Sau lỗi validation, Shift+Tab từ chính dialog có thể thoát ra ngoài: đưa
   focus về control cuối/đầu theo chiều Tab. Kiểm lại lỗi form trên mobile và
   dialog Account/Pet dùng chung; Pet giữ đích focus cũ là nút xem chi tiết.

File ứng dụng sửa trong QA: BookingPanel.tsx, CustomerBookingsPage.tsx và
customer-shell/components/CustomerDialog.tsx. Thêm 7 ca vào mockWorkspace.test.ts;
model/core/submission/workspace, route/layout, catalog/pet/locale không đổi so
với bước 2. Tài liệu bước 2 được nối checklist và biên bản này.

## Figma

Đã truy cập file chính inb2P8smrZU5d2gNImKoaP trong lượt QA, đọc context và
screenshot cho Booking 4908:15116, list 4843:14629, detail 5019:3718,
cancel 5017:3739, review 5017:3763, complaint 5017:3787. Đối chiếu bố cục chọn
và review, màu tím, card, Customer shell, trạng thái, dialog và nội dung.
Giữ route detail và control nhập liệu của bản UI/mock bước 2; không tuyên bố
pixel-perfect hay có bản thiết kế mobile riêng. Nút complaint của Figma ở
Pending tiếp tục bị ẩn theo quy tắc Customer đã chốt. Dùng asset sẵn có trong
repo; không thêm URL asset Figma tạm thời hoặc bản fixture mới.

## Chạy mới và kết quả dùng lại

- Chạy mới trong bước 3: compile test ra /private/tmp; 50 core + 20 adapter
  (13 cũ, 7 bổ sung), đạt 70/70 mỗi múi giờ Asia/Ho_Chi_Minh, UTC,
  America/New_York = 210 lượt. Chạy mới 46/46 regression catalog/repository/
  search/pet/profile. Không lấy số pass của bước 2 thay cho lượt chạy này.
- Chromium có 38 ca đặt tên, tổng hợp kết quả mới nhất đều đạt: 25 main/visual,
  8 bổ sung, 5 kiểm tra loading/điểm nối/mobile/state. Tệp consolidated ghi
  chính xác run của từng ca; không cộng các lần chạy lại thành ca mới.
- Sau sửa cuối chỉ thêm nhánh xử lý Tab khi activeElement là dialog: chạy lại
  8 ca main/visual bị ảnh hưởng (16/17/18/20 và bốn viewport), 2 ca focus
  success/busy, 5 ca supplemental. Dùng lại 23 kết quả đã chạy trong chính bước
  3: main 01–15/19/21 và extra 01/02/05/06/07/08. Chúng không dùng nhánh Tab
  vừa sửa; BookingPanel, list/detail, model/store và luồng liên quan không đổi
  giữa hai build cuối. Bộ logic/regression cũng không bị sửa sau khi chạy.
- Trên source cuối: npm run lint, npx tsc --noEmit --incremental false,
  npm run build và git diff --check đều đạt. Build chứa cả test bổ sung;
  không sửa generated types, dependency hoặc config.
- Các lần fail do selector/timing/đích focus sai của script và kiểm cả ảnh trong
  menu details đang đóng được giữ trong log gốc, sửa harness rồi chạy lại.
  Không tính đó là lỗi ứng dụng đã sửa; không bỏ qua lỗi JavaScript/console.

## Giới hạn và nơi xem bằng chứng

- Browser QA dùng Chromium; chưa Safari/Firefox, thiết bị thật hoặc screen reader.
  ARIA và điều hướng bàn phím đã kiểm, chưa audit WCAG đầy đủ.
- Không có UI fixture Confirmed hay actor Customer thứ hai: các nhánh đó đã
  chạy ở logic, không giả nhận đã click qua UI. Không thay quyền mock bằng Auth
  thật và không thêm công cụ Customer tự đổi trạng thái booking.
- Không gọi API/Auth/payment, không kiểm tra BE PR #10, server concurrency,
  transaction/locking/idempotency hoặc giữ dữ liệu sau reload. Những bảo đảm
  này chưa tồn tại trong phạm vi UI/mock.
- Demo production: http://127.0.0.1:3011/providers/1?serviceId=101. Mở công cụ
  mô phỏng cuối trang, chọn Khách hàng mẫu. Clock cố định 04/11/2026 10:00 UTC+7.
- Logs, browser scripts, screenshot, kết quả theo ca, hash nguồn và preservation:
  /private/tmp/pawflow-fe022-fe024-step3-20261111/. Kết quả cuối ở
  browser-results-consolidated.json, ảnh responsive ở affected-final/ và ảnh
  feedback dài ở supplement-corrected/. Bằng chứng trước/sau giữ trong
  preservation-before.json và preservation-after.json; dữ liệu /private/tmp
  có thể bị hệ điều hành dọn. Biên bản này ở trong diff bàn giao.

Dừng sau bước 3/4; còn bước 4 bàn giao trên cùng nhánh cộng dồn, commit theo mã
task và một PR vào dev để Nhi review, khi được yêu cầu.
