# FE-022 + FE-024 — Customer Booking UI/mock, bước 2/4

Ngày 11/11/2026, Asia/Ho_Chi_Minh. Nhánh bàn giao cộng dồn FE-handoff-202611,
worktree PawFlow-Handoff-202611, nền 13e51a74f524a164cdb5f8a74a8f5494f8eb3215
sau PR #21. Chưa stage/commit/push/PR. QA toàn luồng là bước 3; bước 4 commit
theo mã task và một PR vào dev cho cả đợt.

## Nguồn và phạm vi

- Fetch xác nhận Account/Pet, Discovery/Provider Detail và locale có trên dev.
  Không yêu cầu Auth #20 hoặc nhập source từ PR chưa merge.
- Tái sử dụng model.ts, bookingLogic.ts và submissionLogic.ts đã chuẩn bị trong
  /private/tmp/pawflow-fe022-fe024-step2-independent-20261107/prepared/.
  Adapter mới dùng PetState/catalog/helpers thực tế từ dev.
- Figma chính inb2P8smrZU5d2gNImKoaP: Booking 4908:15116, list 4843:14629,
  cancel 5017:3739, detail 5019:3718; đã đọc context và screenshot, không Archive.
- Giữ /discover, /providers/[providerId], /account, /account/pets. Thêm /bookings
  và /bookings/[bookingId]; chọn/review inline trong Provider Detail.
  Giữ từng shell Customer, không dùng dashboard.
- Không API/auth/token/payment/persistence mới, không đổi dependency/config/
  lockfile/AGENTS hoặc source Provider/Admin/Staff.

## Demo

Từ worktree này chạy npm run build, rồi:

    npm run start -- --hostname 127.0.0.1 --port 3011

Mở http://127.0.0.1:3011/providers/1?serviceId=101. Trong “Công cụ dữ liệu mô
phỏng” ở cuối trang, chọn “Khách hàng mẫu”. Chọn giờ còn chỗ, kiểm tra lại yêu
cầu và gửi. Dialog thành công dẫn đến chi tiết/danh sách cùng booking.

Clock mẫu bắt đầu 04/11/2026 10:00 UTC+7; không phải thời gian thật. Slot s2 lúc
14:00 ban đầu còn một chỗ. Tool demo có lỗi trước tạo, timeout trước/sau tạo/
còn xử lý, lỗi lookup/list/action, slot đầy và đổi giá. Nút lịch sử mẫu tạo bốn
terminal booking tham chiếu pet/catalog có sẵn để thử review/complaint, không
phải quyền Customer chuyển trạng thái Provider.

## State và quy tắc

- Ancestor (customer)/layout mount một CustomerWorkspaceProvider và một
  CatalogWorkspace. Không có pet/catalog fixture hoặc translation helper thứ hai.
- Pet vẫn từ usePetsWorkspace/createCustomerPetsMock; getter đọc PetState mới
  nhất khi commit. Actor là profile Customer mẫu hiện có, độc lập Auth thật.
- Catalog được khởi tạo một lần từ createCatalogMock. Discovery/detail và
  Booking đọc cùng backing catalog; bỏ singleton catalog thứ hai.
- BookingMockWorkspace publish đồng bộ booking, capacity, receipt và log.
  Success chỉ giữ ID; list/detail dùng selector own booking trên cùng state.
- bookedPrice là snapshot. Thời lượng hiển thị là service hiện tại; receipt giờ
  nội bộ mock không phải tuyên bố BE có snapshot DTO/column.
- Client navigation trong nhóm Customer giữ state/draft/attempt. Reload, hard
  navigation, rời nhóm hoặc đóng tab reset fixture. Không storage/backend/
  cross-tab; dispose dọn timer và registry ảnh pet.
- Submit kiểm lại pet ACTIVE/ownership, context, provider/service/category,
  slot OPEN/future/capacity và đủ thời lượng. Giá/thời lượng đổi cần review lại;
  giờ slot đổi cần chọn lại. Không suy weekly schedule từ chuỗi hours.
- Booking mới là PENDING_CONFIRMATION; Customer không chuyển thành CONFIRMED.
- Hủy own pending/confirmed khi now < start. Đúng giờ bắt đầu không hủy.
  Lý do tùy chọn. Đây là mock rule theo Figma; BE dev audit chỉ xét trạng thái.
- Review own COMPLETED, một lần/booking, rating nguyên 1–5, comment tùy chọn.
- Complaint own confirmed/completed/cancelled/rejected/no-show; không pending;
  tối đa một OPEN/IN_REVIEW; reason trim 1–2000 ký tự. Không thêm expiry.
- Không tự cấm hai booking khác nhau của cùng pet giao giờ.
- Pending guard đồng bộ trước await. Unknown khóa gửi mới: found trả cùng ID,
  in-flight/error giữ khóa, terminal absent mới retry cùng attempt. Không coi
  guard mock hoặc BE PR #10 là bảo đảm chống trùng server trên dev.
- Loading/empty/error/retry cho list/detail/availability; lỗi lưu giữ draft.
  Chuỗi UI mới nằm trong locale/vi.json, dùng helper chung.

## Kiểm tra bước 2

- npm run lint, npx tsc --noEmit --incremental false, npm run build: đạt.
  Fresh worktree cần Next sinh route types trước typecheck; build đã tạo
  LayoutProps, không sửa root layout để tránh lỗi thiếu generated types.
- 50 test core + 13 test adapter: 63/63 mỗi timezone Việt Nam/UTC/New York.
- 46/46 regression catalog/repository/search/pet/profile đạt.
- Chromium production smoke create → detail → cancel → list cùng ID tại
  1440×1000 và 390×844; timeout-after → reconcile → một booking. Pending không
  có complaint action. Không page/console error hoặc tràn ngang trong lượt kiểm.
- Đã sửa vị trí cuộn list/detail sau khi mở từ dialog ở cuối Provider Detail.
  Đây chưa phải QA toàn luồng, cross-browser, server concurrency hoặc RBAC thật.
- Logs/hash/smoke và preservation ngoài repo:
  /private/tmp/pawflow-fe022-fe024-step2-20261111/.

Test core MJS dùng BOOKING_TEST_BUILD trỏ đến output tsc tạm chứa model.js,
bookingLogic.js và submissionLogic.js. Compile test adapter/regression bằng
tsc commonjs/ES2022, strict, esModuleInterop, resolveJsonModule, skipLibCheck;
chạy node --test trên output. Không xuất build test vào repo.

## Nhóm file thay đổi

- Di chuyển sáu file route/layout Account và Discovery vào (customer), giữ URL;
  thêm ancestor layout và hai bookings page.
- Thêm customer-booking: model/core/submission, adapter/workspace, hai component,
  CSS, hai test files.
- Nối catalog repository trong Discovery/detail hooks; nâng phạm vi Customer
  workspace và thêm getter PetState.
- Nối Customer Header/Sidebar/Shell và Discovery Header; locale booking và
  thông báo vòng đời mock. Tài liệu này.

## Checklist QA bước 3

- [x] Figma desktop 1440/1920, tablet 768, mobile 390; asset, text dài, bảng,
  dialog và overflow; không gán smoke bước 2 thành visual QA đầy đủ.
- [x] Keyboard/focus trap/return/Escape, pending controls, live feedback.
- [x] Pet thêm/sửa/archive và đổi ownership/active khi pending từ cùng nguồn.
- [x] Service/provider/pet reset quote/slot; deep link, Back/Forward, draft và
  pending qua route; reload/rời workspace reset có giải thích.
- [x] Full/closed/past/unknown, đổi giá/thời lượng/giờ; loading/empty/error/retry.
- [x] Double-click/Enter, timeout-before/after/in-flight/lookup fail; retry đúng
  attempt; distinct attempts cùng pet không bị luật tự thêm chặn.
- [x] List search/status, own detail/timeline/snapshot, foreign/missing record.
- [x] Hủy pending/confirmed trước/đúng/sau start, reason và release một lần;
  review/complaint eligible/duplicate/validation/error/retry.
- [x] Regression Account/Pet/Discovery và locale; lint/typecheck/build source
  cuối sau sửa QA trước bàn giao một PR cộng dồn.

## Kết quả QA bước 3/4

Đã hoàn tất ngày 11/11/2026; chi tiết ca mới, ca dùng lại, lỗi đã sửa, bằng
chứng và giới hạn nằm trong [biên bản QA](FE-022-024-booking-qa.md). Checklist
ở trên gồm cả kiểm tra logic và browser; Confirmed/foreign ownership được
kiểm ở logic, không giả nhận đã có UI fixture. Đủ điều kiện bàn giao phạm vi
UI/mock ở bước 4, chưa commit/push/PR.
