# FE-030 / FE-052 — Bước 3/4: QA tích hợp thực tế và hồi quy

Ngày thực thi: 26/11/2026 (`Asia/Ho_Chi_Minh`). **Đủ điều kiện chuyển sang Bước 4 bàn giao trong phạm vi Cụm 4A (`FE-030`, `FE-052`) đã chốt.** Toàn bộ nhóm kiểm thử API/PostgreSQL thật, Production Chromium tuần tự 3 viewport & Fault Injection và 7 cổng kiểm cuối đều đạt sạch; không phát sinh lỗi ứng dụng cần vá trên 16 file Bước 2. Chưa chạy `git add`, `git commit`, `git push`, mở/merge PR hay cập nhật Sheet ở lượt này.

## Bản kiểm và môi trường QA cô lập

- **Web (`PawFlow-Web`):** nhánh `booking-api-reliability`, nền `HEAD` = `origin/dev` = `789400b65f9656b51e935f87c8bafae1de3c24de`, cộng đúng 16 file runtime/test Bước 2 (0 file runtime/test bị sửa trong Bước 3).
- **API (`PawFlow-API`):** nhánh `dev`, `HEAD` = `origin/dev` = `d0f48b03f75e6c13132d40b6c2e597480a23a439`, working tree sạch (`git status --short` rỗng sau `npm ci` và `npm run build`).
- **Manifest cuối:** [FE-030-052-booking-step3-manifest.json](FE-030-052-booking-step3-manifest.json) — **479 file** runtime/test (470 file nền + 9 file mới của nhánh `booking-api-reliability`, loại trừ `docs/`, Markdown, `.agent/`, `.geminiignore` và thư mục build/tạm), `runtimeTestFingerprint` = `6c5e392834ced6ca56f9f2c027e2d10ababa83fc53e1c02233f40e70572957d1`.
- **PostgreSQL cô lập:** Container Docker tạm `pawflow-qa-pg-booking-20261126` (`postgres:15-alpine`, `--memory=512m`, `--tmpfs /var/lib/postgresql/data:rw,size=256m`, bind `127.0.0.1:5439`, `TZ=Asia/Ho_Chi_Minh`). Chỉ tạo và thao tác trên DB tạm `pawflow_qa_booking_20261126`; áp dụng đủ **17 TypeORM migrations** của `PawFlow-API` và chuỗi BFF (`001_sessions.sql` → `002_login_rotation.sql` → `check.sql`); cấp role runtime tối thiểu `qa_bff_runtime` (chỉ `CONNECT`, `USAGE` schema `pawflow_bff`, DML trên `pawflow_bff.sessions`) và xác minh `scripts/bff-db.mjs check` bằng chính role này. Không đọc bất kỳ file `.env*` nào, không chạm `pet_care_db` hay container sẵn có (`pawflow-bff-qa-20261123`, `oracle-db`).
- **Stack production & đồng hồ:** Node `v22.19.0`, Next `16.3.8`, `PawFlow-API` build `dist/main.js` (`127.0.0.1:3076`, `NODE_ENV=test` để trỏ `TURNSTILE_SITEVERIFY_URL` cục bộ nhưng vẫn bật `TURNSTILE_MODE=enforce`, `TURNSTILE_CHECK_ACTION=true`, `AUTH_RATE_LIMIT=enabled`, `API_RATE_LIMIT=enabled`), Next production `next start` (`127.0.0.1:3080`, `NODE_ENV=production`) sau proxy TLS loopback tự ký (`https://127.0.0.1:34480` → Web, `https://127.0.0.1:34476` → API) nhằm bảo toàn cookie `__Host-pawflow-session` (`HttpOnly; Path=/; SameSite=Lax; Secure`). Toàn bộ tiến trình API, Web, DB và Playwright browser context đều gắn tường minh `TZ=Asia/Ho_Chi_Minh`.
- **Trình duyệt & tài nguyên 8GB RAM:** 1 tiến trình Playwright Chromium headless (`1.65.1`, cache `chromium-1255` ngoài repo) chạy **tuần tự** 3 viewport `1440×1000` → `768×1024` → `390×844`, đóng context sau mỗi nhóm.
- **Dọn dẹp hậu kiểm đã xác nhận:** Đã chạy `DROP DATABASE pawflow_qa_booking_20261126` (`0` bản ghi còn lại trong `pg_database`), `docker rm -f pawflow-qa-pg-booking-20261126`, xóa sạch thư mục secret/TLS/outbox tạm trong `/tmp`, xác nhận toàn bộ cổng QA (`3075`, `3076`, `3077`, `3080`, `5439`, `34476`, `34480`) đã giải phóng và các tiến trình ngoài phạm vi (`next-server` PID `35189` ở cổng `3000`, `nginx` ở cổng `8080`) nguyên vẹn.
- **Bundle bằng chứng ngoài repo:** `QA-booking-api-reliability-step3-20261126/` (gồm `api-pg-results.json`, `browser-3vp-results.json`, log lỗi harness ban đầu `browser-3vp-initial-harness-fail.json` & `browser-3vp-harness-fail-2.json`, `fixtures.json`, logs đã lọc sạch và 13 ảnh chụp màn hình 3 viewport trong `screenshots/`; đã quét không lộ JWT/cookie/mật khẩu thật).

## Tổng hợp kết quả thực chạy tươi

| Nhóm kiểm thử | Kết quả | Nguồn bằng chứng (chạy tươi 26/11/2026) |
| --- | --- | --- |
| API + PostgreSQL thật (qua `PawFlow-API` `d0f48b03` & BFF thật) | **10/10 nhóm đạt** | `api-pg-results.json` (`API-01`..`API-10`) |
| Production Chromium tuần tự 3 viewport & Fault Injection | **11/11 nhóm đạt**, **0 `pageerror`** | `browser-3vp-results.json` (`BR-01`..`BR-11`), 13 PNG `screenshots/br*.png` |
| Booking unit/contract + mock workspace regression | **54/54 đạt** | `node scripts/test-booking.mjs` |
| Account/Pet/Session/Turnstile unit/contract regression | **96/96 đạt** | `npm run test:account-session` |
| Search/Public catalog unit/contract regression | **67/67 đạt** | `node scripts/test-search.mjs` |
| Lint, Production Build, TypeScript & Diff whitespace | **4/4 cổng exit 0** | `npm run lint`, `NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api npm run build`, `npx tsc --noEmit`, `git diff --check` |

## Chi tiết 10 nhóm API + PostgreSQL thật

Sequence `bookings_id_seq` được đẩy lên `900719925474099300` (> `Number.MAX_SAFE_INTEGER` = `9007199254740991`) để mọi đơn tạo thật đều xác minh bảo toàn chuỗi BIGINT xuyên suốt PostgreSQL → NestJS → BFF → React DOM.

| Mã | Phạm vi kiểm thử | Kết quả & số liệu thực tế |
| --- | --- | --- |
| `API-01` | BFF schema check role tối thiểu, cookie `__Host-pawflow-session` (`HttpOnly; Secure; SameSite=Lax`), login rotation, Turnstile one-use | **Đạt.** Cookie xoay khi login; response BFF không chứa access/refresh token; tái sử dụng token Turnstile trả `403 TURNSTILE_EXPIRED` từ backend qua Siteverify simulator. |
| `API-02` | `BR-01`: Provider `PENDING`/`REJECTED`/`SUSPENDED`, service `INACTIVE`, category `INACTIVE` | **Đạt.** 5/5 ca trả `400` (`PROVIDER_UNAVAILABLE`, `SERVICE_UNAVAILABLE`), 0 booking tạo mới, `booked_count` giữ nguyên `0`. |
| `API-03` | `BR-02`: Pet thuộc Customer khác & pet `INACTIVE` | **Đạt.** Trực tiếp API trả `404 Active pet belonging to the customer was not found`; qua BFF trả `404 PET_UNAVAILABLE`, 0 booking tạo mới. |
| `API-04` | `BR-03` / `VT-01` / `VT-02`: Tạo đơn hợp lệ (`#900719925474099308`, `bookedPrice="250000.00"`) + từ chối slot đầy/đóng/quá khứ/ngoài giờ/quá ngắn | **Đạt.** Đơn tạo mới tăng `booked_count +1`; 5 ca không hợp lệ trả đúng `409 SLOT_FULL`, `409 SLOT_CLOSED`, `400 SLOT_STARTED`, `409 SLOT_OUTSIDE_WORKING_HOURS`, `409 SLOT_TOO_SHORT`. |
| `API-05` | `VT-09`: Tranh 1 suất cuối đồng thời (`capacity=2, booked_count=1`) với khóa `FOR UPDATE` | **Đạt.** 4 request đồng thời (`Promise.all`) từ Alpha & Beta với 4 `Idempotency-Key` khác nhau → **đúng 1× `201`** (`#900719925474099309`), **đúng 3× `409`** (`Availability slot is full`), DB `booked_count = 2 = capacity`, đúng 1 bản ghi mới. |
| `API-06` | `Idempotency-Key` replay, chuẩn hóa note, conflict payload khác, key sai định dạng | **Đạt.** Lặp cùng key + payload tương đương trả cùng ID `#900719925474099310` với `Idempotent-Replayed: true`, `0` đơn trùng & không trừ thêm chỗ; payload khác trả `409 IDEMPOTENCY_CONFLICT`; key `"short"` trả `400 INVALID_IDEMPOTENCY_KEY`. |
| `API-07` | `BR-04` / `VT-04`: Truy cập & hủy ngoại lai trên đúng đường dẫn `/bookings/mine/:id` & `/bookings/mine/:id/cancel` | **Đạt.** Beta gọi trực tiếp `GET /api/bookings/mine/900719925474099308` & `POST .../cancel` đều trả `404` với đúng body `"Booking not found"`; qua BFF đều trả `404` với `code: "BOOKING_NOT_FOUND"`; trạng thái đơn của Alpha không đổi. |
| `API-08` | `BR-06` / `BR-07`: Hủy `PENDING_CONFIRMATION` & `CONFIRMED` trước giờ; hủy `CONFIRMED` quá giờ (`409 CANCEL_TIME`); hủy 4 trạng thái kết thúc (`409 CANCEL_STATUS`) | **Đạt.** Hủy hợp lệ trả `201`, chuyển `CANCELLED`, ghi `booking_status_logs`, giảm `booked_count -1`. Đơn `CONFIRMED` quá giờ trả `409` `"Bookings can only be cancelled before the appointment starts"` (BFF `CANCEL_TIME`). `COMPLETED`/`REJECTED`/`NO_SHOW`/`CANCELLED` đều trả `409 CANCEL_STATUS`. |
| `API-09` | RBAC `403`, `VT-05` cross-provider `404`, `VT-06` review trước `COMPLETED` | **Đạt.** `PROVIDER_OWNER`, `PROVIDER_STAFF`, `ADMIN` gọi các endpoint customer booking (trực tiếp & BFF) đều nhận `403`. `ownerApproved` truy cập/confirm đơn của `providerOther` nhận `404 Booking not found` (`VT-05`). Review đơn `CONFIRMED` chưa hoàn thành bị từ chối `409` (`VT-06`). |
| `API-10` | Rate-limit `429` (`Retry-After`) & lỗi kho limiter `503` fail-closed | **Đạt.** Bồi đếm trên dòng thật của bảng `auth_rate_limits` → `429 RATE_LIMITED` (`Retry-After: 15`); tạm đổi tên bảng `auth_rate_limits` trong `try/finally` → `503 RATE_LIMIT_UNAVAILABLE` (`Retry-After: 5`), khôi phục bảng xong trả lại `200`. |

## Chi tiết 11 nhóm Production Chromium 3 viewport & Fault Injection

| Mã | Kịch bản kiểm thử | Loại bằng chứng | Kết quả |
| --- | --- | --- | --- |
| `BR-01` | E2E đặt lịch → Receipt `<CustomerDialog>` → `/bookings` → `/bookings/[id]` tuần tự tại `1440×1000`, `768×1024`, `390×844` | API + DB + BFF thật | **Đạt.** Đồng nhất BIGINT ID (`#900719925474099331` / `...332` / `...333`) & `bookedPrice` `250.000 ₫` trên cả 3 màn + DB; `document.cookie` / storage 0 token; `scrollWidth === innerWidth` cả 3 viewport (`br01-*-{desktop,tablet,mobile}.png`). |
| `BR-02` | Lệch giá preview vs server: chặn trước gửi (`QUOTE_CHANGED`) + TOCTOU cập nhật giá ngay trước `POST /api/bookings` | API + DB thật + proxy hook | **Đạt.** Đổi giá `320.000 → 355.000` trước submit bị chặn bằng alert `QUOTE_CHANGED` (0 đơn tạo); TOCTOU đổi `355.000 → 389.000` ngay trước POST cho receipt & detail `#900719925474099334` khớp tuyệt đối `bookedPrice = 389.000 ₫`. |
| `BR-03` | Double-click & nhấn `Enter` liên tiếp khi đang pending (delay proxy 400 ms) | API + DB thật + proxy delay | **Đạt.** Proxy ghi nhận đúng **1** `POST /api/bookings`, PostgreSQL tăng đúng **1** đơn (`#900719925474099335`). |
| `BR-04` | Xung đột `409 SLOT_FULL` giữ draft & tải lại slot không tự nhảy sang slot khác | API + DB thật + proxy hook | **Đạt.** Sau `409`, UI giữ `petId` (`Mochi`) và ghi chú `"Ghi chú giữ bản nháp khi gặp 409"`, gọi lại `GET /api/availability/public/search?`, gỡ slot đầy khỏi dropdown, hiện slot dự phòng nhưng `slotValue === ""` (không tự nhảy slot). |
| `BR-05` | Fault `unknown` khi tạo (`drop-after-upstream` sau khi DB đã commit `201`) → bấm thử gửi lại cùng `Idempotency-Key` | API + DB thật + network fault proxy | **Đạt.** Chuyển trạng thái `unknown`, khóa form, 0 dialog thành công giả; bấm `"Thử gửi lại cùng yêu cầu"` gửi đúng cùng `Idempotency-Key`, nhận `Idempotent-Replayed: true`, mở receipt `#900719925474099336` kèm thông báo khôi phục, đúng **1** đơn trong DB (0 trùng). |
| `BR-06` | Fault `unknown` khi hủy → reconcile qua `GET /api/bff/bookings/mine/:id` (cả 2 nhánh đã commit & chưa tới server) | API + DB thật + network fault proxy | **Đạt.** Nhánh 1 (`#900719925474099337`, `drop-after-upstream`): reconcile đồng bộ `CANCELLED`, đóng dialog. Nhánh 2 (`#900719925474099338`, `drop-before-upstream`): reconcile giữ dialog & lý do hủy để gửi lại thành công `201`. |
| `BR-07` | Lỗi mạng `503` khi revalidate phiên trên `/providers/[id]` | BFF thật + Web proxy 503 | **Đạt.** Không xử lý như `401`; ẩn toàn bộ `<select>` và tên thú cưng (`Mochi`, `Bông`); sau khi hết lỗi & bấm `"Thử lại xác minh phiên"`, đúng danh tính Alpha phục hồi đầy đủ draft pet, slot và ghi chú. |
| `BR-08` | Logout / đổi tài khoản Alpha → Beta đóng `<CustomerDialog>` & xóa sạch cache riêng tư | BFF + `BroadcastChannel` thật (2 tab) | **Đạt.** Logout ở tab 2 lập tức đóng Receipt `<CustomerDialog>` trên `/providers/[id]` và xóa dữ liệu Alpha; đăng nhập Beta tải đúng thú cưng `Lucky`; Beta mở đơn Alpha `#900719925474099339` nhận `404` (`Không tìm thấy lịch hẹn`); Cancel `<CustomerDialog>` trên `/bookings/[id]` tự đóng khi logout. |
| `BR-09` | Provenance `?catalog=demo`, `?fromInbox=1`, notice `CustomerShell` & không fallback mock khi live `503` | Live + Demo + proxy 503 | **Đạt.** Live `/bookings` hiện notice đồng bộ máy chủ và báo lỗi alert (0 bảng mock) khi inject `503`; `?catalog=demo` & `?fromInbox=1` hiện notice workspace demo; ID `"1"` tách rạch ròi `Pet House` (demo) vs `PawCare QA Studio` (live). |
| `BR-10` | Ranh giới `FE-034` trên đơn `COMPLETED` & khóa hủy quá giờ `BR-07` trên đơn `CONFIRMED` đã bắt đầu | API + DB thật | **Đạt.** Đơn `COMPLETED` (`#900719925474099302`) hiển thị thông báo deferred `FE-034`, không có nút hủy/đánh giá/khiếu nại giả (`br10-completed-boundary-desktop.png`). Đơn `CONFIRMED` quá giờ (`#900719925474099301`) vô hiệu hóa nút hủy kèm `aria-describedby="live-cancel-locked-reason"`. |
| `BR-11` | IME tiếng Việt, focus trap `Tab`/`Shift+Tab` (24 chu kỳ) & `Esc` focus restore trong `<CustomerDialog>`, không tràn ngang 3 viewport | Production Chromium 3 viewport | **Đạt.** IME không lọc sớm giữa composition ở `/bookings`; nhập đủ dấu tiếng Việt trong textarea lý do hủy; `Tab`/`Shift+Tab` không thoát `<dialog>` ở cả 3 viewport; `Esc` đóng và trả focus đúng về nút `"Hủy lịch hẹn"`; `scrollWidth === innerWidth` (`br11-cancel-dialog-{desktop,tablet,mobile}.png`). |

## Phân biệt lỗi ứng dụng và lỗi harness

- **Lỗi ứng dụng phát hiện trong Bước 3:** **0 lỗi.** Không có file nào trong 16 file Bước 2 phải chỉnh sửa.
- **Lỗi harness/kịch bản đã phát hiện và khắc phục riêng trong harness QA (giữ nguyên log lỗi gốc trong bundle):**
  1. Lần khởi động đầu của `qa-stack.mjs` chờ sẵn sàng ở `/api/providers/public` (404) thay vì `/api/health/ready`; sửa harness dùng `/api/health/ready` và bọc cleanup `stop()` khi lỗi khởi động.
  2. Lần chạy browser đầu (`browser-3vp-initial-harness-fail.json`): `BR-04` lọc request refresh bằng prefix `/api/availability/public?` trong khi contract thực tế là `/api/availability/public/search?` (mọi assertion UI giữ draft/không nhảy slot trước đó đều đã đạt); `BR-09` dùng `getByText` gặp strict mode 2 phần tử do cả nội dung demo và `CustomerShell` cùng hiển thị thông báo demo.
  3. Lần chạy browser thứ hai (`browser-3vp-harness-fail-2.json`): `BR-09` mở `/providers/prov-1?catalog=demo` không tồn tại trong `catalogMock.ts` (ID mẫu là `"1"` — `"Pet House"`); sửa thành đối chiếu trực tiếp `/providers/1?catalog=demo` vs `/providers/1`, sau đó toàn bộ **11/11** nhóm đạt xanh sạch.

## Phân tách trung thực bằng chứng thật vs mô phỏng & giới hạn còn lại

- **Đã xác minh bằng hệ thống thật cục bộ:** PostgreSQL 15 thật (17 API migrations + BFF `001`/`002`/`check.sql` + khóa `FOR UPDATE` + bảng `auth_rate_limits`), NestJS `PawFlow-API` (`d0f48b03`) thật, Next.js `16.3.8` production build thật, BFF opaque cookie `HttpOnly; Secure` thật, Chromium headless thật trên 3 kích thước viewport.
- **Có dùng simulator / fault-injection có kiểm soát (không đồng nhất với dịch vụ thật):**
  - Cloudflare Turnstile: backend bật `TURNSTILE_MODE=enforce` nhưng trỏ về HTTP Siteverify simulator cục bộ (có kiểm secret, hostname, action, one-use token) và browser dùng script widget stub để tạo token test — **không phải Cloudflare Siteverify thật**.
  - `API-10` (`429`/`503`) sử dụng cơ chế rate-limit thật của backend nhưng có prime dòng `auth_rate_limits` và tạm đổi tên bảng để gây lỗi kho limiter có khôi phục trong `finally`.
  - `BR-02` (nhánh TOCTOU), `BR-03` (delay 400 ms), `BR-04` (fill slot ngay trước POST), `BR-05`/`BR-06` (`drop-after-upstream`/`drop-before-upstream`), `BR-07` (`503` `/api/bff/session`), `BR-09` (`503` `/api/bookings/mine`) dùng fault injection chủ động ở proxy mạng cục bộ hoặc cập nhật DB QA có kiểm soát để tái hiện race/mất kết nối.
- **Giới hạn chưa nghiệm thu trong phạm vi lượt này:**
  - Cloudflare Siteverify thật, SMTP/email delivery thật, hạ tầng deployment/ingress HTTPS/TLS/DB vận hành thực tế nhiều instance.
  - Trình duyệt Safari, Firefox, thiết bị di động vật lý và kiểm toán screen reader đầy đủ.
  - Luồng Provider operations (`confirm`/`reject`/`complete`/`no-show` thuộc `FE-032`) và review/complaint/notification API live (`FE-034`).

## Điều kiện sẵn sàng Bước 4

Toàn bộ 16 file runtime/test Bước 2, 3 file hồ sơ Bước 2–3 trong `docs/` và 7 cổng kiểm cuối đều sạch và khớp `runtimeTestFingerprint` tại [FE-030-052-booking-step3-manifest.json](FE-030-052-booking-step3-manifest.json). Sẵn sàng chuyển sang Bước 4 để rà soát `git status`/`git diff`, commit trên nhánh `booking-api-reliability`, push và mở PR mới (chưa thực hiện ở Bước 3).
