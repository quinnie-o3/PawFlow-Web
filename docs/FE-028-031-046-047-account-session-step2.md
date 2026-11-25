# FE-028/031/046/047 — biên bản triển khai bước 2

Cập nhật 24/11/2026. Bước 2 triển khai và kiểm chứng cục bộ; **chưa thực hiện bước 3 nghiệm thu**, chưa commit/push/PR, chưa cập nhật sheet hoặc liên hệ người khác. Không coi recovery riêng là hoàn tất cả cụm.

Hướng dẫn reviewer dựng môi trường/migration và tái hiện: [runbook](FE-028-031-046-047-review-runbook.md).

Bổ sung ở bước 3: xem [biên bản QA](FE-028-031-046-047-account-session-step3.md) cho migration xoay cookie, kiểm tra schema và các sửa lỗi revalidation. Bằng chứng bước 2 bên dưới được giữ nguyên theo thời điểm chạy.

## Nền và phạm vi bảo toàn

- Worktree `PawFlow-Account-Pets-Session`, branch `account-pets-session`, nền PR #24 `9290c391509ca892d600e6aade7b3536d5d7b6e2`.
- Snapshot remote đã fetch trong đợt này: Web `origin/dev` `9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`; API `origin/dev` `2eda6ba6f312653819b33c317d17de8635588aa3`. PR #24 còn mở tại lần kiểm tra đầu bước 2. Đây không phải cam kết trạng thái remote ở lần bàn giao sau; bước 4 phải fetch/kiểm tra lại.
- API được đọc/build/chạy từ bản source đúng SHA trên, dùng database QA riêng; **không sửa source API**, không cần nhánh API hay migration API mới.
- Giữ recovery có sẵn, Sidebar/Booking/Inbox và nền API/cache của #24. Không sửa Turnstile controller/token state/protected submit của Nhi. Provider Header/tên/vai trò/chuông/thông báo vẫn ngoài phạm vi.
- Không sửa các worktree khác, không áp dụng/xóa stash. Main checkout vẫn có thay đổi riêng ở `AGENTS.md`, `src/app/dashboard/layout.tsx`; QA worktree khác giữ nguyên công việc cũ. Không stage `AGENTS.md`.

## Quyết định hạ tầng

Source API dùng PostgreSQL/TypeORM, `synchronize: false`; rate-limit counters đã dùng PostgreSQL chung. Không tìm thấy Redis hay kho phiên BFF hiện hữu. Không có Docker/Compose triển khai ứng dụng được xác minh trong repo. Runbook API `docs/phase3/p3-be12-deploy-rollback-runbook.md` nêu rõ các giả định HTTPS/proxy/DB và chưa triển khai staging/production. Dependency/Dockerfile nằm trong `node_modules` không phải bằng chứng hạ tầng của dự án.

Chọn **PostgreSQL dùng chung cho mọi instance Web**, tận dụng dịch vụ DB của dự án, schema riêng `pawflow_bff`, bảng `sessions`. Không thêm Redis. Web thêm `pg` và type definitions; không nâng các dependency hiện hữu. Có thể đặt schema trong PostgreSQL hiện có khi operator đã review môi trường/quyền/migration; lần này chỉ chạy trên DB QA mới tạo, không chạm DB chưa xác định.

Migration có thể review tại `database/bff/001_sessions.sql`. Web runtime không tự chạy DDL. `scripts/bff-db.mjs migrate` yêu cầu operator xác nhận đã review bằng `BFF_MIGRATION_REVIEWED`. Migration dùng transaction; table/index có tên riêng, không thay bảng API. Runtime dùng role DML riêng, không dùng superuser/migration-owner trên môi trường triển khai.

## Cơ chế phiên

- Browser chỉ có cookie session opaque ngẫu nhiên; DB chỉ lưu hash của cookie. Production cookie `__Host-pawflow-session`, HttpOnly, Secure, Path `/`, SameSite Lax; development dùng tên không có prefix. Cookie không chứa access/refresh token.
- Access/refresh token chỉ ở server, mã hóa AES-256-GCM với IV ngẫu nhiên và AAD gắn với hash phiên. Khóa 32 byte được cấp qua cấu hình server riêng, dùng cùng khóa trên mọi instance. Không serialize token vào HTML/response client, không ghi log payload/cookie/token.
- Login/register chiếm quyền thao tác trên anonymous session, gọi API đúng một lần, xác minh `/auth/me` và current session từ `/auth/sessions` trước khi kích hoạt BFF. Browser nhận generation và projection user công khai.
- Refresh dùng atomic compare-and-set của PostgreSQL: một process chuyển `active` → `refreshing` với operation ID và lease. Chỉ process đó dùng refresh token; process khác chờ và đọc token mới. Không dựa vào mutex hoặc memory store trong một process. Pool connection trong process không quyết định tính đúng đắn.
- Refresh lease 20 giây; login lease 25 giây; mỗi upstream request tối đa 8 giây; waiter tối đa 22 giây; browser BFF request tối đa 40 giây. Không giữ transaction DB mở trong lúc gọi mạng.
- Process chết, lease hết hạn, refresh timeout/disconnect/response không hợp lệ/commit không chắc chắn: fail closed, không chiếm lại refresh lease và không gửi lại token có thể đã dùng. Phiên cần đăng nhập lại. Nếu DB tạm mất kết nối, claim còn lại sẽ hết lease và bị kết thúc khi đọc/cleanup.
- Logout dùng cùng row lock để chụp trạng thái người giữ token và revoke BFF trước khi gọi backend. Nếu access đã hết hạn và token thuộc một owner `active` chưa bị tranh chấp, refresh một lần chỉ để revoke backend, không ghi token mới vào phiên đã kết thúc. Nếu refresh đang dở hoặc kết quả không chắc chắn, không replay; phiên local vẫn kết thúc và UI phân biệt chưa xác nhận revoke backend.
- Logout-all/change-password revoke các BFF row theo backend user ID; revoke device theo backend session ID + user ID. Late login/refresh/private response đều kiểm tra generation/state; không phục hồi phiên đã revoke. Backend vẫn quyết định identity, role và ownership trên từng request.
- Anonymous session hết hạn sau 30 phút; phiên active giữ absolute expiry của backend, refresh không kéo dài nó. `cleanup` revoke operation quá lease, xóa phiên hết hạn và revoked tombstone quá một ngày. Cần scheduler chạy `node scripts/bff-db.mjs cleanup` định kỳ; không dựa vào traffic để dọn DB.
- Bootstrap dùng backend `/auth/me`, không tin token localStorage cũ. Chỉ xóa key credential cũ; không đọc nó làm phiên. Generation/epoch, AbortController và QueryCache ticket chặn stale response/cache sau logout/đổi account/role. Cookie init dùng Web Locks giữa tab nếu browser hỗ trợ; tính đúng đắn refresh vẫn ở PostgreSQL.
- BroadcastChannel đồng bộ thay đổi phiên. Logout chưa xác nhận do mạng lưu một marker **không phải credential** trong localStorage, chặn bootstrap và yêu cầu thao tác thử lại của người dùng; không tự retry logout. Nếu storage bị browser chặn, fence này chỉ tồn tại trong tab hiện tại. Khôi phục từ back-forward cache phải xác minh lại phiên trước khi hiện vùng riêng tư.

## Ranh giới HTTP và triển khai

BFF không phải proxy tùy ý: chỉ route/method/field allowlist bên dưới. Production bắt buộc origin Web và API HTTPS. Các response BFF/recovery dùng no-store, không phản chiếu lỗi backend tùy ý. Mutation phải có Origin đúng cấu hình, Fetch Metadata phù hợp và JSON; body được đọc có giới hạn 16 KiB. `x-bff-generation` ngăn thao tác từ identity cũ. Upstream không theo redirect. Không retry mutation, không replay request sau 401, không retry request mang Turnstile token.

Ingress phải áp dụng request/body/rate limits và không cache `/api/bff/*`, `/api/recovery/*`; đặc biệt giới hạn anonymous session creation để tránh tăng bảng vô hạn trong 30 phút. Giới hạn body hiện tại cũng giới hạn tổng độ dài health note; lỗi 413 giữ bản nháp để người dùng rút ngắn.

Để giữ client IP cho rate-limit/Turnstile hiện có: ingress tin cậy phải **ghi đè** `x-pawflow-client-ip` thành một IP đơn và chặn đường truy cập trực tiếp origin Web. Khi và chỉ khi cấu hình này đã được kiểm chứng, bật `BFF_TRUST_PROXY_HEADERS`; Web forward IP chuẩn hóa qua X-Forwarded-For, và API `TRUST_PROXY` phải tin đúng hop BFF. Mặc định Web bỏ qua header IP do client gửi; API sẽ thấy IP của BFF và có thể gộp rate-limit theo IP. Không thay policy hoặc bypass kiểm tra của Nhi. Đã test logic opt-in/chuẩn hóa; chưa xác minh chain ingress thật. User-Agent được chuyển tiếp để danh sách phiên có thông tin thiết bị, không dùng làm identity/quyền.

Đổi khóa mã hóa hiện yêu cầu kết thúc toàn bộ BFF sessions trước khi triển khai đồng bộ khóa mới; chưa có key ring/rolling key rotation. Khóa, credential DB và backup phải nằm trong secret manager/ACL server. Rollback ứng dụng giữ schema riêng; không DROP dữ liệu tự động. Nếu quay về bản cũ dùng localStorage, phải review lại chính sách Auth, không coi đó là rollback an toàn mặc định.

## Contract và luồng đã nối

Đường dẫn bên dưới là backend sau prefix `/api`. Browser gọi cùng suffix qua `/api/bff`, riêng recovery qua `/api/recovery/auth/*`.

| Luồng | Contract được dùng | Frontend và lỗi |
|---|---|---|
| Login/register | POST `/auth/login`: email/password/turnstileToken. POST `/auth/register`: thêm fullName, phone optional. Token response chỉ server xử lý. GET `/auth/me`, GET `/auth/sessions` xác minh. | Đủ response, không hardcode Customer. Tùy chọn Remember chưa có contract riêng được disable, không giả vờ áp dụng. CUSTOMER → `/account`, PROVIDER_OWNER → `/dashboard`, PROVIDER_STAFF → `/staff/bookings`, ADMIN → `/admin`. 400/401/409/429/503 có phản hồi, giữ input, token challenge reset theo hook cũ. |
| Bootstrap/refresh/logout | POST BFF `/session`; GET backend `/auth/me`; POST `/auth/refresh` với refreshToken server-only; POST `/auth/logout`. | Reload xác minh backend; guard account/bookings/notifications và các route role. Logout xóa cache trước request; không khôi phục data cũ khi response đến muộn. Backend revoke không chắc chắn được thông báo riêng. |
| Profile | GET/PATCH `/users/me`; fullName trim 2–150; phone optional tối đa 20, blank được bỏ để giữ số cũ. | ID/role/status theo backend; email read-only. Thành công sync profile và tên Customer shell. 400/403/409/network giữ draft; 401 kết thúc phiên. Không thêm address/avatar contract. |
| Pet CRUD | GET/POST `/pets`; GET/PATCH/DELETE `/pets/:id`; GET `/pet-types`. ID bigint giữ dạng string. DTO petTypeId, name trim 1–100, breed nullable ≤100, birthDate nullable hợp lệ không tương lai, weight nullable >0 ≤9999.99 tối đa hai số lẻ, healthNote nullable. | Mapping numeric string/null, GET detail thật, invalidation/update state sau mutation. API CUSTOMER/ownership; foreign 404, noncustomer 403. Giữ loại cũ đã inactive khi sửa trường khác; không cho chọn inactive mới. Soft-delete khỏi danh sách active. |
| Mật khẩu/thiết bị | POST `/auth/change-password` currentPassword/newPassword; password 8–72, khác cũ. GET `/auth/sessions`; DELETE `/auth/sessions/:uuid`; POST `/auth/logout-all`. | UI `/security` cho mọi role đã xác minh, link từ trang login/guard; Customer account nhúng cùng component. Không sửa Provider Header. Dialog giữ password khi lỗi, thành công buộc đăng nhập lại. Danh sách/current/revoke, UTC+7. Backend kiểm tra quyền sở hữu phiên. Không retry tự động. |
| Verify/recovery | POST `/auth/verify-email/resend` bearer; POST `/auth/verify-email` token; forgot email+turnstileToken; reset token+newPassword+turnstileToken. | Register → trang kiểm tra email có resend/cooldown. Verify/reset đọc fragment, xóa fragment khỏi URL, chỉ gửi khi submit. Forgot phản hồi generic. Reset/verify không replay token; reset thành công xóa client session. Email chưa xác minh không tự chặn login trái policy backend. |

Ảnh pet bị vô hiệu hóa upload và có thông báo chưa hỗ trợ lưu thật; không báo upload thành công. Account dùng riêng dữ liệu thật, không trộn với pet mẫu. Catalog/Booking/Inbox giữ workspace mock từ #24 và được reset khi đổi identity. Khu vực đặt lịch chưa đồng bộ thú cưng thật; các chú thích UI đã nói rõ giới hạn này. Công cụ catalog mock không còn xuất hiện trên trang account.

## Trạng thái từng task

| Task | Đã triển khai trong bước 2 | Bằng chứng hiện có | Còn thiếu / blocker nghiệm thu |
|---|---|---|---|
| FE-028 | Auth BFF opaque cookie, identity backend, role routes/guards, bootstrap/refresh/logout, loại bỏ credential localStorage, cache isolation. | Unit/client/HTTP policies; hai process độc lập + shared PostgreSQL; hai Next production process + API/DB thật cho concurrent refresh; browser login/reload/guard/switch account. | Deployment HTTPS/ingress/client-IP thật, secret provisioning, DB role/backup/scheduler thực tế chưa được nghiệm thu. |
| FE-031 | Profile và pet list/detail/create/update/delete thật; DTO/validation/error/ownership; sync/cache/draft; cô lập mock Booking. | API/DB QA CRUD, numeric/null, foreign-owner 404, noncustomer 403; browser save/reload/delete, draft failure và responsive. | Không có contract lưu ảnh; giữ disabled. Booking API vẫn ngoài cụm. Chưa có optimistic concurrency/version contract nên không hứa chống ghi đè edit từ hai tab. |
| FE-046 | Đổi mật khẩu, danh sách/revoke phiên, logout-all; điều phối rotation nhiều process, expiry, fail-closed khi refresh không chắc chắn. Giữ reset/recovery đã làm. | Shared-store death/lease/logout race tests; API/DB sessions/password/reset/logout-all/rotation; browser password draft/error/revoke/logout. | SMTP thật, email client/link delivery, deployment failover/DB outage thực tế chưa được kiểm chứng. |
| FE-047 | Giữ token challenge một lần/reset/cooldown; nối login/register/forgot/reset và verify resend/429, không tự retry. | Bộ test Turnstile/Auth cũ và mới; browser dùng widget stub với API/DB thật; error/cooldown HTTP projection. | Cloudflare Siteverify thật/hostname/action/secret chưa chạy; không dùng widget stub hoặc TURNSTILE_MODE disabled của QA làm bằng chứng anti-bot production. |

## Kiểm chứng bước 2 và cách chạy lại

Môi trường QA: PostgreSQL 15 trong container chỉ bind loopback; hai database mới riêng cho API và BFF. API migrations đã chạy trên DB QA này. Hai Next production process riêng dùng chung BFF DB và khóa server, qua TLS proxy QA. Node QA 25.1.0. Không chạy migration trên database sẵn có chưa xác định. Build API từ source không thay đổi; QA API dùng file outbox và tắt Siteverify chỉ trong môi trường test.

- `npm ci --ignore-scripts`: lockfile cài được; additions chỉ `pg`/types và dependency cần cho chúng.
- **95/95 logic tests, 11 shared-store checks, 6 HTTP policy checks đã pass** (upstream HTTP policy được mô phỏng, store là PostgreSQL thật).
- `npm run test:account-session`: compile riêng + chạy logic/DTO/Auth/Turnstile/recovery/cache/Booking regression bằng `node:test`.
- `npm run test:account-session -- --shared-store`: cần `BFF_DATABASE_URL` trỏ **DB QA local có tên prefix được script kiểm tra**. Chạy thêm store test có hai PID Node độc lập và HTTP policy test. Không cho script này trỏ DB triển khai.
- Shared-store: encryption at rest, một rotation, late logout/refresh, network uncertainty không replay, SIGKILL/lease expiry, session expiry, generation fence, late login, atomic logout token ownership, logout-all, cleanup.
- HTTP policy (upstream mô phỏng, PostgreSQL thật): CSRF/Fetch Metadata/body limit, Secure/HttpOnly cookie, response projection không token, operation/field allowlist, mutation một request, stale private response sau logout, proxy IP opt-in.
- Tích hợp thật cục bộ: hai Next production processes, tám request đồng thời → một refresh row mới trong API DB; CRUD/validation/ownership, sessions/revoke/password/logout-all, logout với access hết hạn, backend phát hiện reuse và revoke token mới, forgot/reset/verify qua API thật + DB thật. Email token lấy từ file outbox QA, không phải hộp thư SMTP; challenge widget mô phỏng, không phải Cloudflare thật.
- Browser Chromium: 1440×1000, 768×1024, 390×844; account, profile/pet/password dialogs, login/guard/reset; `/security` có guard authenticated cho cả bốn role. Kiểm tra không overflow ngang/runtime error; login/register, reload, profile save, pet create/detail/edit/delete, revoke phiên khác, password change, logout/logout-all, đổi role/account, verify/reset fragment. Mọi role đã được thử trên `/security` bằng identity backend (role fixture chỉ gán trong DB QA). Offline logout fault-injection qua hai tab: reload/pageshow không khôi phục phiên, không tự retry; bấm thử lại mới revoke BFF/API thật. Fault-injection 503 riêng để chứng minh draft giữ nguyên và không auto-retry; không gọi fault injection là API integration thật.
- Lint, TypeScript, production build và `git diff --check` đã pass. Production build QA dùng cấu hình challenge test; release phải build lại với site key đúng môi trường. Log/ảnh thô được lưu ngoài Git; kết quả cuối và giới hạn nghiệm thu nằm trong biên bản bước 3, hướng dẫn chạy độc lập nằm trong runbook của repo.

Các process Web/API/TLS proxy QA đã được dừng sau kiểm chứng; container PostgreSQL QA được dừng và giữ lại dữ liệu. Không gửi SMTP thật hoặc chạy Cloudflare Siteverify thật.

## Biến và dịch vụ cần bổ sung (không ghi giá trị)

| Nơi | Tên cấu hình / dịch vụ |
|---|---|
| Web server | `PAWFLOW_API_URL`, `BFF_APP_ORIGIN`, `BFF_DATABASE_URL`, `BFF_TOKEN_ENCRYPTION_KEY`, `BFF_TRUST_PROXY_HEADERS`, `NODE_ENV` |
| Web public build | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; `NEXT_PUBLIC_API_URL` còn phục vụ nền API/feature khác, không chứa credential và không dùng làm BFF session authority |
| Migration operator | `BFF_DATABASE_URL`, `BFF_MIGRATION_REVIEWED`; role migration-owner riêng |
| API hiện hữu | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_SESSION_TTL_SECONDS`, `TRUST_PROXY`, `CORS_ORIGINS`, `AUTH_RATE_LIMIT`, `API_RATE_LIMIT` |
| Anti-bot/email API | `TURNSTILE_MODE`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAMES`, `MAIL_TRANSPORT`, `MAIL_FROM`, `MAIL_LINK_BASE_URL`, `FRONTEND_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_REQUIRE_TLS`, `AUTH_EMAIL_COOLDOWN_SECONDS` |
| Dịch vụ | PostgreSQL dùng chung + TLS/ACL/backup; HTTPS ingress với header overwrite và origin restriction; scheduler cleanup; Cloudflare Turnstile; SMTP cho nghiệm thu gửi email thật |

Tên biến API phải đối chiếu tiếp `.env.example`/config ở đúng SHA khi triển khai; chỉ cấp biến thực sự hỗ trợ. `MAIL_OUTBOX_DIR` chỉ dùng QA file transport, không dùng làm bằng chứng SMTP.

## Checklist bước 3 — chưa bắt đầu nghiệm thu

- [ ] Review migration BFF, role DML/migration-owner, TLS DB, backup/restore, cleanup schedule, giới hạn connection theo số instance; rehearsal trên QA riêng trước staging.
- [ ] Cấp secret/hostname đúng môi trường; kiểm tra HTTPS, HttpOnly/Secure/SameSite/no-store và không token trong response/HTML/log/APM; đối chiếu browser storage sau upgrade.
- [ ] Kiểm chứng ingress overwrite header, direct-origin restriction, `TRUST_PROXY` của API, IP/rate-limit không bị gộp/spoof; kiểm tra Turnstile enforce thật ở đủ bốn action, token dùng một lần, reset, expiry và 429/503 cooldown.
- [ ] SMTP thật: register/resend, generic forgot, verify/reset valid/invalid/expired/reused; fragment/referrer/history; thay mật khẩu/recovery revoke mọi phiên.
- [ ] Ma trận logic: login/register full response, CUSTOMER/OWNER/STAFF/ADMIN guards, suspended/revoked account, bootstrap/multi-tab, logout/expired/refresh race/process death/DB outage; request bị hủy không refill cache, đổi identity/role không lộ data.
- [ ] Ma trận API thật: Profile DTO/blank phone; Pet full CRUD, inactive type, null fields, validation, ownership 403/404, server error/network uncertainty giữ draft; sessions foreign/current revoke/logout-all; không replay mutation/Turnstile.
- [ ] Browser cả 1440×1000, 768×1024, 390×844: keyboard/focus/dialog scroll, draft/error/retry, back-forward cache/multi-tab/offline logout, account switch, session expiry; xác minh trên build/env nghiệm thu thay vì widget stub.
- [ ] Regression Sidebar/Booking/Inbox #24: mock booking vẫn riêng, không chọn pet thật giả ownership; Provider Header/bell vẫn deferred; không animation/redesign ngoài phạm vi.
- [ ] Tổng hợp evidence thật và mô phỏng riêng; task còn chưa chứng minh không đánh dấu hoàn tất.

Bước 4 chỉ khi được yêu cầu: fetch/review lại PR #24 và dev, giữ bàn giao cộng dồn theo trạng thái PR (head nếu còn mở, dev mới nếu đã merge), review diff/migration/env docs rồi mới commit/push/PR vào dev. Chưa thực hiện bất kỳ hành động bàn giao remote nào trong bước 2.
