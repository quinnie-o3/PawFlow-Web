# FE-028/031/046/047 — hướng dẫn review, chạy QA và triển khai

Tài liệu đi cùng source, không cần đường dẫn hoặc bộ fixture trên máy tác giả. Kết quả lịch sử và giới hạn nghiệm thu nằm ở [bước 3](FE-028-031-046-047-account-session-step3.md); contract/DTO và phạm vi từng task ở [bước 2](FE-028-031-046-047-account-session-step2.md). Các thao tác DB bên dưới là hướng dẫn để operator review và chạy trong **QA cô lập**; lượt bàn giao không chạy migration trên môi trường triển khai.

## Bản được bàn giao

- Nền Web `dev`: `9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`.
- Nền cộng dồn PR #24: `9290c391509ca892d600e6aade7b3536d5d7b6e2`, đã chứa Sidebar `44b701a`, Booking `7af952f`, FE-025/026/027 `9290c39`.
- API tương thích đã kiểm: [PawFlow-API](https://github.com/quinnie-o3/PawFlow-API/tree/2eda6ba6f312653819b33c317d17de8635588aa3), SHA `2eda6ba6f312653819b33c317d17de8635588aa3`; không sửa API hoặc thêm migration API trong cụm này.
- Fingerprint đầy đủ của QA bước 3: `0d9a3b86fc138b3ddde2730df7b0fbe1384183805e388f51891c0e75f6559785` (485 file tracked/untracked, trước cập nhật tài liệu bàn giao).
- Fingerprint runtime/config/test được giữ nguyên khi bàn giao: `c4d684982aaee7ead34a11144126bf42a78c501538958a3ae9cc88822320e860` (460 file, loại `.md`). Bước 4 chỉ bổ sung/sửa Markdown, không chạy lại QA rồi ghi thành bằng chứng mới.
- Thuật toán fingerprint: lấy path Git tracked/untracked không bị ignore, sắp xếp path; mỗi file SHA-256 nội dung; SHA-256 chuỗi `path + NUL + sha256 + newline`. Trước commit dùng `git ls-files --cached --others --exclude-standard -z`; trên checkout sạch của commit bàn giao dùng `git ls-files -z`. Node modules, build output và private runtime config không nằm trong fingerprint source.

Sau khi checkout commit/head PR, reviewer có thể dùng `git diff --name-status 9290c391509ca892d600e6aade7b3536d5d7b6e2..HEAD` để xem riêng cụm mới; `git log --oneline origin/dev..HEAD` để xem cộng dồn. Không import log thô, database dump, `.env`, key, cookie, fixture mật khẩu hoặc artifact QA tạm vào repo.

## Cấu hình và dịch vụ

Dùng Node tương thích với Next đã pin; QA bước 3 chạy Node 22.19.0, Next 16.3.8, React 19.2.8 và PostgreSQL 15. Chạy từ root package PawFlow-Web:

```sh
npm ci
npm run test:account-session
npm run lint
npx tsc --noEmit
npm run build
```

`pg` và `@types/pg` là additions phục vụ kho phiên; không nâng dependency cũ, không thêm Redis. Khóa và URL có credential chỉ cấp qua secret store/environment riêng; không đặt vào dòng lệnh, file versioned hoặc cấu hình public. `.env.example` chỉ là template, không phải cấu hình để deploy nguyên trạng.

| Nơi dùng | Tên cấu hình cần cấp |
|---|---|
| Web server, chung mọi instance | `PAWFLOW_API_URL`, `BFF_APP_ORIGIN`, `BFF_DATABASE_URL`, `BFF_TOKEN_ENCRYPTION_KEY`, `BFF_TRUST_PROXY_HEADERS`, `NODE_ENV` |
| Web public build | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; `NEXT_PUBLIC_API_URL` thuộc nền API cũ, không thay server URL/identity BFF |
| Migration owner | `BFF_DATABASE_URL`, `BFF_MIGRATION_REVIEWED` (chỉ cấp cho tiến trình migration) |
| API và DB | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_SESSION_TTL_SECONDS`, `TRUST_PROXY`, `CORS_ORIGINS`, `AUTH_RATE_LIMIT`, `API_RATE_LIMIT`, `RATE_LIMIT_HASH_SECRET` |
| Turnstile | `TURNSTILE_MODE`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAMES`, `TURNSTILE_CHECK_ACTION`, `TURNSTILE_TIMEOUT_MS` |
| Email/recovery | `MAIL_TRANSPORT`, `MAIL_FROM`, `MAIL_LINK_BASE_URL`, `FRONTEND_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `AUTH_EMAIL_COOLDOWN_SECONDS`, `PASSWORD_RESET_TOKEN_TTL_SECONDS`, `EMAIL_VERIFICATION_TOKEN_TTL_SECONDS` |
| Chỉ QA API test | `TURNSTILE_SITEVERIFY_URL`, `MAIL_OUTBOX_DIR` |

Production BFF yêu cầu origin và upstream HTTPS. Tất cả Web instance phải dùng chung DB/schema và cùng khóa mã hóa 32 byte base64. `NODE_EXTRA_CA_CERTS` có thể dùng để tin CA QA riêng; không vô hiệu kiểm TLS trong cấu hình triển khai. API staging/production có thêm yêu cầu release riêng; xem [runbook ở đúng SHA](https://github.com/quinnie-o3/PawFlow-API/blob/2eda6ba6f312653819b33c317d17de8635588aa3/docs/phase3/p3-be12-deploy-rollback-runbook.md).

## Migration BFF và quyền DB

1. Xác nhận đúng DB QA mới, backup/restore point và owner trước khi chạy DDL. Không dùng DB mặc định hoặc DB chưa xác định. API dùng schema/migrations hiện hữu; BFF chỉ tạo schema `pawflow_bff`.
2. Review theo thứ tự: [001_sessions.sql](../database/bff/001_sessions.sql) → [002_login_rotation.sql](../database/bff/002_login_rotation.sql) → [check.sql](../database/bff/check.sql). Script `migrate` tự chạy đúng thứ tự này. Mỗi migration có transaction riêng; nếu 002 lỗi, 001 có thể đã commit. Dừng traffic, kiểm schema và sửa nguyên nhân trước khi chạy lại; không mặc định cả chuỗi đã rollback.
3. Trong shell operator đã nhận `BFF_DATABASE_URL` của **migration-owner**, sau review target/SQL mới chạy:

   ```sh
   BFF_MIGRATION_REVIEWED=yes node scripts/bff-db.mjs migrate
   node scripts/bff-db.mjs check
   ```

4. Cấp role runtime riêng CONNECT database, USAGE schema, SELECT/INSERT/UPDATE/DELETE trên `pawflow_bff.sessions`. Không cần sequence, DDL hoặc superuser. Đổi environment `BFF_DATABASE_URL` sang role runtime rồi chạy lại `node scripts/bff-db.mjs check`. Startup Web không tự chạy migration. `BFF_MIGRATION_REVIEWED` không thay việc kiểm schema thực tế.
5. `check` đối chiếu catalog columns/type/nullability, constraints đã validate, indexes và default. Chạy lại migration phải không phá dữ liệu; check sai phải chặn việc tiếp nhận traffic. Test replay, schema drift, DDL bị từ chối dưới runtime role và rollback transaction chỉ được chạy trên QA clone.
6. Chạy scheduler riêng `node scripts/bff-db.mjs cleanup` định kỳ, ví dụ mỗi 5 phút; theo dõi exit code và dung lượng bảng. Cleanup revoke login/refresh quá lease, xóa row hết absolute expiry hoặc revoked tombstone cũ hơn một ngày. Không dựa vào request traffic để dọn DB.

Mỗi Web process có pool tối đa 5 connection; connection timeout 3 giây, statement timeout 5 giây. Tính tổng budget theo số process/instance, chừa connection cho API/operator. Script DB quản trị dùng tối đa 1 connection và statement timeout 10 giây.

## Hai process production để QA

Tạo **hai DB QA mới riêng** cho API và BFF; BFF test script chỉ chấp nhận host loopback và tên DB bắt đầu `pawflow_bff_qa`. Không dùng DB chứa dữ liệu đang review. Trên API checkout đúng SHA, dùng owner QA riêng để áp dụng migrations hiện hữu:

```sh
npm ci
npm run build
npm run typeorm -- migration:show -d database/data-source.ts
npm run typeorm -- migration:run -d database/data-source.ts
npm run typeorm -- migration:show -d database/data-source.ts
node dist/main.js
```

Trước các lệnh này, operator cấp `DB_*` trỏ QA và đầy đủ config API từ bảng trên. Kỳ vọng 17 migration đã áp dụng, không pending; `GET /api/health/ready` báo DB up/schema current. Chuẩn bị ít nhất một pet type ACTIVE bằng cơ chế seed/admin API của đúng bản API; hai CUSTOMER riêng và các role QA được tạo/gán chỉ trong DB QA. Không dùng pet mock làm fixture ownership.

Trong Web, áp dụng migration/check bằng owner rồi dùng runtime URL. Build với site key đúng môi trường QA. Khởi động ở **hai terminal/process OS khác nhau**, cùng config DB/key/origin:

```sh
npm run start -- --port 3071
```

```sh
npm run start -- --port 3072
```

Dùng một HTTPS ingress QA tại `BFF_APP_ORIGIN` cho browser, forward vào hai port và có khả năng chọn instance để gây race. HTTPS upstream tại `PAWFLOW_API_URL` trỏ API QA; đặt proxy có gate trước khi forward request và trước khi trả response để gây lỗi có kiểm soát. Đây là hạ tầng harness cần chuẩn bị, không có sẵn trong source Web và không thay contract API. Không gọi hai Promise trong cùng process là bằng chứng nhiều instance. Ghi PID thực của hai Next process, bản build và counter trước/sau; không ghi headers/body/cookie/token.

Có thể chạy tự động mức logic/shared-store từ source repo:

```sh
npm run test:account-session
npm run test:account-session -- --shared-store
```

Lệnh thứ hai cần `BFF_DATABASE_URL` là owner của **DB QA disposable khác** với DB đang phục vụ browser: test tự áp dụng SQL và thao tác dữ liệu. Nó chứng minh 11 store checks qua hai child process và 7 HTTP policy checks; upstream là mô phỏng, không thay thế 15 nhóm API thật bên dưới.

## Tái hiện 15 nhóm concurrency API/DB thật

Đăng ký/login qua BFF, giữ cookie jar riêng cho mỗi account/device; browser chỉ nhận opaque cookie + public user/generation. Lấy `backend_session_id` để đếm refresh row từ DB QA, không đưa token vào browser JS. Quan sát DB chỉ chọn state/count/expiry/operation, không dump cột `tokens`.

Để ép refresh trong QA, đặt `access_expires_at` của row đang kiểm về quá khứ bằng owner QA. Đây là fault injection metadata BFF, không sửa TTL production. Khi test process chết, **chờ lease thực tự hết**; không tăng timeout để che lỗi. Với case reuse, runner phía server QA giữ token trước rotation trong bộ nhớ riêng, gửi lại đúng một lần tới API rồi hủy giá trị; không in token hoặc đưa vào browser.

| # | Thao tác kiểm soát | Kết quả cần thấy |
|---|---|---|
| 1 | 12 GET `/api/bff/users/me` đồng thời, chia đều hai Next process | Tất cả 200; đúng một POST API `/auth/refresh`, một row refresh mới cho session |
| 2 | Proxy trả 401 cho refresh | BFF 401, row revoked/tokens null; request sau không gọi refresh lại |
| 3 | Cho API rotate rồi ngắt response | Kết thúc phiên, không replay token đã có thể dùng |
| 4 | Giữ refresh response quá timeout upstream 8 giây | Kết thúc phiên; thả response muộn không phục hồi row |
| 5 | Gate trước forward refresh, SIGKILL Next owner, sau đó thả gate | API có thể đã nhận request trong mạng; instance còn lại hết lease thì deny, không reclaim token |
| 6 | Gate sau API rotate, trước trả response; SIGKILL owner | Refresh row tăng một; sau lease deny, không refresh lại |
| 7 | Refresh đã trả, gate GET API `/auth/me` sau khi backend xử lý; SIGKILL owner | Chưa persist token mới: hết lease kết thúc phiên |
| 8 | Gate như #7, owner QA khóa row sessions trong transaction; thả response, quan sát UPDATE chờ lock; SIGKILL Next rồi thả DB lock | Nếu PostgreSQL hoàn tất UPDATE nguyên tử, instance khác dùng token mới đã persist, không rotate lần nữa; nếu chưa persist, hết lease deny. Không gửi lại token cũ |
| 9 | Sau một rotation thành công, dùng lại refresh token trước đó qua server runner | API 401/revoke family; bootstrap BFF kế tiếp 401 |
| 10 | Refresh response pending, logout cùng session qua instance kia | Row revoked, response refresh đến muộn bị từ chối |
| 11 | Như #10, device khác revoke session đang refresh | Device/session cũ không phục hồi |
| 12 | Như #10, device khác gọi logout-all | Mọi BFF session của user bị fence |
| 13 | Như #10, device khác đổi mật khẩu đúng | Revoke mọi session theo backend; response cũ không phục hồi |
| 14 | Giữ private GET của account A; logout A/login B; thả GET A | Response A không vào UI/cache B; browser hai tab sau reload chỉ có pets thuộc B |
| 15 | Cho PATCH profile commit tại API, giữ response quá 8 giây | 503/unknown result, đúng một PATCH; giữ draft, GET chủ động nhận dữ liệu đã commit |

Đếm bằng `auth_refresh_tokens` theo `session_id`; kiểm BFF state/lease và `auth_sessions.revoked_at` trên QA. Không tái sử dụng fixture giữa các nhóm có revoke/all/password. Counter rate-limit phải vẫn bật; chuẩn bị fixture/bucket độc lập hoặc dọn counter **chỉ DB QA** giữa các nhóm không kiểm rate-limit. Dành ca riêng để xác nhận 429/Retry-After thật.

## Browser và quyền truy cập

Chạy tuần tự trên production build tại **1440×1000, 768×1024, 390×844**; Chromium là bằng chứng đã có, Safari/Firefox/thiết bị vật lý còn chờ.

| Nhóm | Cách thử và tiêu chí |
|---|---|
| Auth/guard | `/login`, `/register` → `/register/verify-email`; role home CUSTOMER `/account`, OWNER `/dashboard`, STAFF `/staff/bookings`, ADMIN `/admin`; reload/direct URL/anonymous/wrong role; dọn token localStorage cũ nhưng không tin nó |
| Fixation | So cookie/generation trước/sau login: phải đổi. Cookie trước login không đọc private endpoint; logout đang pending với predecessor vẫn kết thúc successor; login family mới không bị predecessor cũ revoke |
| Profile/Pet | `/account`, `/account/pets`: create/detail/update/delete, reload persistence, numeric/null mapping, lỗi field/HTTP/network giữ draft; ảnh disabled và không báo upload thành công |
| Ownership/role trực tiếp | CUSTOMER B gọi GET/PATCH/DELETE pet A →404; không có pet A trong list B. OWNER/STAFF/ADMIN gọi pet endpoints →403. Thử foreign session revoke →404; không chỉ kiểm UI guard |
| Security bốn role | `/security`: sessions/current/revoke, password sai giữ draft, password đúng và logout-all buộc login lại. Thử đúng ba viewport cho mỗi role |
| Revalidation | Mở profile/password dialog, gõ draft; làm POST BFF session lỗi mạng → private UI/dialog ẩn; retry backend cùng identity → draft/focus trở lại; 401/logout/đổi account → xóa nội dung cũ. Direct backend revoke: private request bị từ chối ngay; tab hiện tự thấy trong chu kỳ poll 60 giây + network bound, tab ẩn kiểm khi visible |
| Offline logout | Hai tab cùng cookie, ngắt logout response/mạng; private UI/cache bị xóa, báo chưa xác minh. Reload/pageshow không tự phục hồi hoặc retry; online và bấm retry mới gửi lại logout. Không có token để xác minh revoke backend thì không báo đã xác nhận |
| Turnstile | Bốn action `login`, `register`, `forgot_password`, `reset_password`; double submit dùng token một lần; reset/expiry/error/503/429 cooldown, Retry-After; không replay mutation. API vẫn enforce hostname/action. Simulator/widget stub chỉ là mô phỏng; lượt nghiệm thu thật cần site/secret/hostname tương ứng |
| Recovery/email | `/forgot-password` phản hồi generic cho email có/không tồn tại; `/reset-password#token=…`, `/verify-email#token=…` xóa fragment, xử lý thiếu/hết hạn/đã dùng; lần lượt hai fragment mới trên cùng route không mất state. Resend 429/cooldown. File outbox không chứng minh SMTP hoặc mail-client delivery |
| Sidebar/Booking/Inbox | Sidebar collapse/navigation/menu keyboard. Booking lỗi trước tạo → retry/double-click/Enter → đúng một booking, receipt/list/detail cùng ID. Inbox read-all lỗi + arrival → retry giữ tập ID cũ, badge còn unread mới. Deep link/reload mất mock vẫn có đường về `/notifications`; Back/Forward và menu mobile không overflow |

Quan sát keyboard trap/return focus, validation focus, cancel/pending/error feedback và overflow ngang. Giữ booking pet/ID mock tách khỏi dữ liệu thật. Provider Header/tên/vai trò/chuông/thông báo Provider và animation/redesign ngoài phạm vi.

## Rollout, cleanup và rollback

- Trước nhận traffic: backup DB đã kiểm, schema check thành công dưới runtime role, đồng bộ khóa/config mọi instance, ingress HTTPS, kiểm origin/no-store/cookie/identity. Không có memory store hoặc mutex một process làm cơ chế đúng đắn.
- BFF mới xoay cookie/generation sau login. Khi nâng cấp từ bản cũ, drain Web cũ và kết thúc phiên BFF cũ trong maintenance để buộc đăng nhập mới. Khi cần thu hồi cả backend, thực hiện trước khi xóa token BFF và kiểm backend xác nhận; chỉ xóa/revoke row BFF không chứng minh đã revoke mọi backend session.
- Mất/đổi khóa khiến phiên cũ không giải mã được; không rollback khóa độc lập giữa instance hoặc thử lại refresh token chưa rõ đã dùng. Phải phối hợp rollout và buộc login mới. Không copy khóa vào build/public config/log.
- Chỉ bật `BFF_TRUST_PROXY_HEADERS` khi ingress ghi đè `x-pawflow-client-ip`, API `TRUST_PROXY` khớp topology và origin không truy cập trực tiếp. Mặc định không tin forwarded IP client tự gửi; kiểm rate-limit không bị gộp/spoof.
- Rollback: drain writers, giữ backup và schema additive; quay lại **bản BFF tương thích đã review**, hoặc dừng Auth để sửa. Không quay về browser token localStorage. Không DROP schema/cột có data để rollback. Nếu 001 đã commit và 002/check lỗi, giữ trạng thái, sửa nguyên nhân/chạy lại trên QA clone trước khi mở traffic; restore backup sang DB mới chỉ theo quyết định operator có đánh giá mất dữ liệu.
- Scheduler cleanup, pool sizing, DB TLS/ACL/backup, ingress, failover và rollback deployment thật cần operator nghiệm thu. Các kiểm tra cục bộ không chứng minh production-ready.

**Còn chờ nghiệm thu:** Cloudflare Siteverify thật, SMTP/email-client/link delivery thật, deployment/ingress/secret/DB vận hành thật. Không đánh dấu mọi tiêu chí FE-028/031/046/047 hoàn tất. Ảnh pet và Booking API chưa có trong phạm vi tích hợp này.
