# FE-030 / FE-052 — Bước 2/4: Tích hợp Customer Booking API & Độ tin cậy

Ngày lập hồ sơ: 26/11/2026 (`Asia/Ho_Chi_Minh`). Hồ sơ chốt phạm vi kiến trúc, contract thực tế và 16 file runtime/test của Cụm 4A (`FE-030`, `FE-052`) trước khi xác nhận nghiệm thu Bước 3 tại [FE-030-052-booking-step3.md](FE-030-052-booking-step3.md).

## Nền tích hợp và truy vết tài liệu

- **Web repository (`PawFlow-Web`):** nhánh `booking-api-reliability`, nền `HEAD` = `origin/dev` = `789400b65f9656b51e935f87c8bafae1de3c24de`.
- **API repository (`PawFlow-API`):** nhánh `dev`, `HEAD` = `origin/dev` = `d0f48b03f75e6c13132d40b6c2e597480a23a439` (không sửa bất kỳ file tracked nào).
- **Đối chiếu `docs/PROJECT_SHEET.csv`:**
  - Dòng 31 — `FE-030` (`P2 / Integration`): *"Booking & availability API + conflict UX"* — Dependency: `FE-028, FE-029` — Deliverable: *"Nov: create/list/detail/cancel/confirm; price/slots authoritative; 409/double-click safe"*.
  - Dòng 53 — `FE-052` (`P2 / Booking Reliability`): *"Conflict, stale slot, idempotency, timeout/retry UI"* — Dependency: `FE-022; FE-030; BE concurrency` — Deliverable: *"Double-click safe; actionable 409; no duplicate booking"*.
- **Đối chiếu `docs/PROPOSAL.md`:**
  - §5 Table 4 (Representative REST API Contracts), §6 Table 5 (Booking status definitions and data impact).
  - §7.4 `FR-CUS-BOOK-01` (Submit a booking request for an available service slot) & `FR-CUS-CANCEL-01` (Cancel an eligible booking).
  - §7.5 `BR-01` (Provider availability), `BR-02` (Pet ownership), `BR-03` (Slot availability & concurrency), `BR-04` (Booking ownership), `BR-06` (Booking status transition), `BR-07` (Cancellation before scheduled appointment time).
  - §12.1 `VT-02`, `VT-04`, `VT-05`, `VT-06`, `VT-09`.

## Contract thực tế (`PawFlow-API` `d0f48b03`) và điểm lệch Proposal đã chốt

| Hạng mục | Proposal / Sheet gốc | Contract thực tế `PawFlow-API` `d0f48b03` & Quyết định Cụm 4A |
| --- | --- | --- |
| Endpoint lịch sử & chi tiết | Minh họa chung `/bookings/{id}` | Customer dùng riêng `GET /api/bookings/mine` (BFF `GET /api/bff/bookings/mine`) và `GET /api/bookings/mine/:id` (BFF `GET /api/bff/bookings/mine/:id`, kèm `statusLogs`). |
| Endpoint hủy lịch & lý do | Table 4 minh họa `PATCH /bookings/{id}/cancel`; UC-BOOK-02 nêu nhập lý do | Thực tế backend dùng `POST /api/bookings/mine/:id/cancel` trả HTTP `201` (BFF `POST /api/bff/bookings/mine/:id/cancel`); body `{}` hoặc `{ reason }` tùy chọn (trim-to-null). |
| Idempotency khi tạo lịch | `FE-052` yêu cầu chống tạo đơn trùng | `POST /api/bookings` hỗ trợ header `Idempotency-Key` (`^[A-Za-z0-9_-]{16,128}$`), trả header `Idempotent-Replayed: true|false`; BFF chuyển tiếp header và ánh xạ thêm trường `idempotentReplayed`. |
| Giá & thời lượng | Proposal yêu cầu snapshot nhất quán | Backend lưu `bookedPrice` dạng chuỗi `NUMERIC(12,2)` (authoritative snapshot lúc đặt); `service.durationMinutes` là thời lượng hiện tại của dịch vụ (không phải snapshot lúc đặt — UI ghi chú tường minh). |
| Khung giờ & đồng hồ | `PAWFLOW_RULES` §10 quy định giờ Việt Nam | Khung giờ slot (`slotDate`, `startTime`, `endTime`) và mốc `BR-07` (`CANCEL_TIME`) tính theo `Asia/Ho_Chi_Minh` (`UTC+07:00`). Kiểm tra trước khi gửi gọi công khai `GET /api/availability/public/:id` (`credentials: omit`). |
| Phân tách lỗi qua BFF | Sanitize lỗi nội bộ nhưng giữ ngữ nghĩa xung đột | `src/lib/server/bff/handler.ts` ánh xạ chính xác các thông điệp nghiệp vụ public từ `PawFlow-API` sang machine code ổn định (`SLOT_FULL`, `SLOT_CLOSED`, `SLOT_STARTED`, `SLOT_OUTSIDE_WORKING_HOURS`, `SLOT_TOO_SHORT`, `PET_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, `IDEMPOTENCY_IN_PROGRESS`, `IDEMPOTENCY_CONFLICT`, `BOOKING_NOT_FOUND`, `CANCEL_STATUS`, `CANCEL_TIME`, `NO_RESERVED_CAPACITY`, `RATE_LIMITED`, `RATE_LIMIT_UNAVAILABLE`). |
| Ranh giới `confirm` / `FE-032` & `FE-034` | Sheet `FE-030` liệt kê kèm `confirm`; Proposal có review sau `COMPLETED` | Cụm 4A chỉ tích hợp luồng Customer (`create`, `list`, `detail`, `cancel`). Luồng Provider `confirm/reject/complete/no-show` thuộc Cụm `FE-032`; review/complaint/inbox live trên đơn `COMPLETED` thuộc `FE-034` (UI chi tiết hiển thị thông báo ranh giới thay vì giả lập gửi). |
| Provenance Demo vs Live | `PAWFLOW_RULES` §8, §11 | `/bookings`, `/bookings/[bookingId]` và `/providers/[providerId]` mặc định gọi API thật, không fallback mock khi API lỗi. Chế độ demo chỉ kích hoạt khi URL có provenance tường minh `?catalog=demo` hoặc `?fromInbox=<positive-int>`. |

## Kiến trúc & 16 file triển khai Bước 2

### 7 file chỉnh sửa trên nền `789400b6`
1. `src/lib/server/bff/handler.ts` — Mở allowlist đường dẫn booking (`bookings`, `bookings/mine`, `bookings/mine/:id`, `bookings/mine/:id/cancel`), xác thực BIGINT ID (`<= 9223372036854775807`), chuyển tiếp `Idempotency-Key`, projection response loại trừ dữ liệu nhạy cảm, chuẩn hóa `Idempotent-Replayed` và bảng mã lỗi booking.
2. `src/lib/api/queryCache.ts` — Bổ sung `queryKeys.bookings` (`all`, `list`, `detail`) và `queryFreshness` (`freshness: 0` cho dữ liệu booking riêng tư, cô lập invalidation theo prefix).
3. `src/features/customer-provider-detail/components/PublicProviderDetail.tsx` — Nối `LiveBookingPanel` vào chi tiết cơ sở công khai (giữ rạch ròi với `DemoProviderDetail`), đồng bộ tải lại khung giờ công khai (`availabilityRevision`, `onRefreshAvailability`).
4. `src/app/(customer)/(account-workspace)/bookings/page.tsx` — Mặc định render `LiveBookingsPage`; chỉ chuyển sang `CustomerBookingsPage` khi `resolveBookingRouteSource` xác nhận provenance demo.
5. `src/app/(customer)/(account-workspace)/bookings/[bookingId]/page.tsx` — Mặc định render `LiveBookingDetailPage`; chỉ chuyển sang `CustomerBookingDetail` khi có provenance demo hợp lệ.
6. `src/features/customer-shell/components/CustomerShell.tsx` — Hiển thị thông báo nguồn dữ liệu (`vi.booking.live.shellNotice` cho live vs `vi.customer.shell.mockNotice` cho demo).
7. `locale/vi.json` — Bổ sung đầy đủ chuỗi tiếng Việt `booking.live` và bảng ánh xạ thông báo lỗi cho toàn bộ `LiveSubmissionErrorCode` / `LiveBookingErrorCode`.

### 9 file mới
1. `src/features/customer-booking/liveApi.ts` — Typed client gọi BFF booking và public availability slot (`GET /api/availability/public/:id`), decoder nghiêm ngặt (giữ BIGINT ID dạng chuỗi, `NUMERIC(12,2)`, chống trùng ID, kiểm `Idempotent-Replayed`), phân loại lỗi (`definite-failure` / `in-progress` / `unknown`, không auto-retry mutation).
2. `src/features/customer-booking/liveSubmission.ts` — State machine đặt lịch live: kiểm duyệt quote (`reviewFlow`), xác minh lại slot/giá trước khi tạo (`validateFreshSlotAgainstQuote`), khóa double-submit đồng bộ (`beginLiveSubmission`), khóa draft và retry cùng `Idempotency-Key` khi gặp `unknown`/`in-progress` (`beginSameKeyRetry`), xử lý cooldown `Retry-After`, và ranh giới phiên (`sessionBoundaryAction`, `shouldShowReceiptDialog`).
3. `src/features/customer-booking/liveCancel.ts` — State machine hủy lịch live: kiểm điều kiện `BR-06`/`BR-07` theo `Asia/Ho_Chi_Minh`, chống gửi trùng, trạng thái `unknown` không tự gửi lại POST mà đối soát qua `GET /api/bff/bookings/mine/:id` (`beginCancelReconcile` / `settleCancelReconcile`), lọc cục bộ không đảo thứ tự server, và `resolveBookingRouteSource`.
4. `src/features/customer-booking/components/LiveBookingPanel.tsx` — Giao diện đặt lịch live trên `/providers/[providerId]`: tải thú cưng `ACTIVE` qua BFF có kiểm `ownerId`, ẩn UI riêng tư nhưng giữ draft khi lỗi mạng revalidate phiên, tự đóng `<CustomerDialog>` và xóa state khi logout/đổi tài khoản, hiển thị `bookedPrice` server trên receipt.
5. `src/features/customer-booking/components/LiveBookingsPage.tsx` — Giao diện `/bookings` (kèm IME composition guard cho ô tìm kiếm) và `LiveBookingDetailPage` (`/bookings/[bookingId]`) với `<CustomerDialog>` hủy lịch, reconcile `unknown`, trạng thái khóa hủy quá giờ (`BR-07`) và thông báo ranh giới `FE-034` trên đơn `COMPLETED`.
6. `src/features/customer-booking/liveApi.test.ts` — Unit/contract tests cho decoder, BFF proxy projection, error taxonomy, public slot fetch và cache isolation.
7. `src/features/customer-booking/liveSubmission.test.ts` — Unit tests cho quote drift, double-submit guard, idempotency replay/cooldown, và session boundary/dialog cleanup.
8. `src/features/customer-booking/liveCancel.test.ts` — Unit tests cho `Asia/Ho_Chi_Minh` start boundary, cancel reconcile branches, provenance route resolution và locale coverage.
9. `scripts/test-booking.mjs` — Runner unit/contract hợp nhất (54 tests gồm live booking + hồi quy mock booking workspace).

## Kiểm chứng tĩnh & đơn vị cuối Bước 2 (đã xác nhận lại sau Bước 3)

- `node scripts/test-booking.mjs`: **54/54 đạt**.
- `npm run test:account-session`: **96/96 đạt**.
- `node scripts/test-search.mjs`: **67/67 đạt**.
- `npm run lint`, `npm run build`, `npx tsc --noEmit`, `git diff --check`: **4/4 exit 0**.

Chi tiết kết quả QA tích hợp thực tế với PostgreSQL cô lập, `PawFlow-API` thật và Production Chromium 3 viewport xem tại [FE-030-052-booking-step3.md](FE-030-052-booking-step3.md) và [FE-030-052-booking-step3-manifest.json](FE-030-052-booking-step3-manifest.json).
