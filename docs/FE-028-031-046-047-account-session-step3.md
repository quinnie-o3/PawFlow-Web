# FE-028/031/046/047 — QA tích hợp và hồi quy bước 3

QA bắt đầu ngày 24/11, kết thúc ngày 25/11/2026. Các trạng thái “chưa commit/push” bên dưới là snapshot khi kết thúc bước 3; bước 4 chỉ chuẩn hóa tài liệu và kế thừa bằng chứng runtime không đổi. Báo cáo này bổ sung bằng chứng mới cho [bước 2](FE-028-031-046-047-account-session-step2.md).

## Bản kiểm thử và phạm vi

- Worktree: `PawFlow-Account-Pets-Session`; branch `account-pets-session`; HEAD `9290c391509ca892d600e6aade7b3536d5d7b6e2` cộng toàn bộ diff chưa commit, kể cả file mới.
- Web `origin/dev`: `9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`; API `origin/dev`: `2eda6ba6f312653819b33c317d17de8635588aa3` tại lần fetch cuối ngày 25/11 của bước 3. PR [#24](https://github.com/quinnie-o3/PawFlow-Web/pull/24) còn mở, base `dev`, head `provider-sidebar-booking-fixes` trùng HEAD trên. Không cần tạo worktree QA khác vì nền chưa đổi.
- Đã đối chiếu ba commit kế thừa: `44b701ad84d4a9034b0804341d28e34418f4909b` Sidebar, `7af952f24a3d805e5ace3f1450d2e8a50377e4c4` Booking, `9290c391509ca892d600e6aade7b3536d5d7b6e2` Inbox/API foundation.
- Bản QA đầy đủ có fingerprint `0d9a3b86fc138b3ddde2730df7b0fbe1384183805e388f51891c0e75f6559785` trên 485 file tracked/untracked không bị ignore. Thuật toán: SHA-256 chuỗi `path + NUL + sha256 nội dung + newline`, sắp xếp path. Manifest/log/screenshot thô được lưu ngoài Git. Các tên log trong bảng dưới là nhãn bằng chứng lịch sử, không phải dependency cần tải về. Reviewer dùng [runbook trong repo](FE-028-031-046-047-review-runbook.md) để dựng QA và tái hiện từng nhóm; bảng kết quả bên dưới đủ đọc độc lập.
- Fingerprint runtime/config/test (cùng thuật toán, loại riêng các file Markdown): `c4d684982aaee7ead34a11144126bf42a78c501538958a3ae9cc88822320e860`; 460 file. Fingerprint đầy đủ QA nêu trên có cả tài liệu trước cập nhật bước 4; chỉ Markdown thay đổi khi bàn giao.
- Snapshot diff và bản sao file trước sửa ở thư mục `private` của bộ QA. Không sửa các worktree khác hoặc áp dụng/xóa stash. Main checkout vẫn có diff riêng ở `AGENTS.md` và `src/app/dashboard/layout.tsx`; các stash và worktree có sẵn được bảo toàn. Không stage file nào.
- Không sửa API source; bản API chạy lấy từ đúng SHA trên. Không sửa Turnstile controller/token state/protected submit của Nhi, Provider Header/tên/vai trò/chuông/thông báo, Sidebar/Booking/Inbox implementation. Không thêm animation, redesign hoặc dependency mới trong bước 3.

## Môi trường và mức độ bằng chứng

PostgreSQL 15 QA cô lập, chỉ bind loopback. Tạo riêng database BFF/API cho bước 3; API chạy đủ 17 migration hiện hữu. Không migrate database dự án chưa xác định. Web dùng role runtime riêng chỉ có USAGE schema và SELECT/INSERT/UPDATE/DELETE bảng sessions. Migration chạy bằng owner QA riêng với runtime.

Hai **OS process Next production** chạy cùng build, cùng kho PostgreSQL và khóa server. Cổng Web nội bộ 3071/3072 qua TLS QA 34471/34472; API dist qua TLS QA 34480. Các bài kill process ghi PID, khởi động process thay thế và quan sát DB/API; không dùng hai lời gọi trong một process làm bằng chứng tương đương. Node thực chạy bước 3 là 22.19.0, Next 16.3.8, React 19.2.8.

API là code thật, database thật, JWT/refresh rotation/ownership/rate-limit thật. API chạy môi trường test để sử dụng endpoint Siteverify QA; chống bot vẫn **enforce**, kiểm hostname/action và verdict. Siteverify là HTTP simulator có one-use/idempotency/error/timeout; widget browser là stub. Email dùng file outbox. **Không xác minh Cloudflare Siteverify thật, SMTP/email delivery thật hoặc deployment staging/production.** Không có cấu hình QA hợp lệ cho các dịch vụ thật trong môi trường đã rà.

Proxy QA có các điểm giữ/ngắt response để gây race hoặc kết quả không chắc chắn. Đây là fault injection ở mạng, không thay logic API/DB. Một số browser error được inject 401/503/offline có ghi rõ. Fixture độc lập dọn counters trong DB QA để tránh nhiều người dùng giả cùng localhost ảnh hưởng nhau; ca kiểm rate-limit riêng dùng chính policy/counter backend đang bật và nhận 429/Retry-After. Không tắt rate-limit hoặc anti-bot.

## Lỗi tìm thấy và sửa

1. **Session fixation:** activation trước đây giữ cookie anonymous. Nay login/register xoay cookie opaque và generation trong cùng UPDATE nguyên tử; ciphertext dùng AAD của hash mới. Migration `002_login_rotation.sql` giữ hash/generation trước login chỉ làm hàng rào logout. Cookie cũ không đọc được user/data; logout đang chạy với cookie cũ vẫn kết thúc successor, còn lần login mới thuộc family khác không bị nó thu hồi.
2. **Schema chưa được kiểm chứng:** thêm `database/bff/check.sql` và lệnh `bff-db.mjs check`. Kiểm catalog columns/type/nullability, constraints đã validate, indexes và default. `migrate` chạy 001, 002 rồi check; `cleanup` cũng check. `BFF_MIGRATION_REVIEWED` chỉ là xác nhận review, không thay thế check schema. Giới hạn connection/statement timeout cho script quản trị.
3. **Tab nhàn rỗi chưa quan sát revoke từ thiết bị khác:** revalidate trên route/focus/visible và mỗi 60 giây khi tab hiện và đã có user. Backend vẫn xác thực mọi private operation; không dùng polling làm cơ chế cấp quyền. Test browser thực chờ một chu kỳ nhận revoke trực tiếp từ API.
4. **Revalidation lỗi mạng làm mất draft:** giữ epoch/draft chỉ trong bộ nhớ tab và ẩn nội dung bằng React Activity, cleanup effect đóng native dialog. Retry phải nhận identity mới từ backend trước khi hiện lại. 401/logout/đổi identity vẫn bỏ state/cache và unmount nội dung cũ. Không lưu draft hay credential vào browser storage. Activity đã có trong React đang cài; cách giữ state/cleanup effect theo [tài liệu React](https://react.dev/reference/react/Activity).

5. **Recovery bị remount khi bootstrap đổi identity:** giữ boundary qua bootstrap đầu và giữ riêng component reset/verify khi identity thay đổi. Fragment đã đọc/xóa không bị mất; reset thành công vẫn giữ thông báo kết quả. Đã retest bằng reload có cookie đăng nhập, verify/resend và hai fragment reset/verify nối tiếp.
6. **Logout lặp lại không đủ bằng chứng revoke backend:** row đã revoked không còn token để xác nhận lại; phản hồi `revoked: false` thay vì mặc định báo đã thu hồi backend. Test HTTP kiểm cả lần gọi lặp lại.

Các lần chạy đầu còn phát hiện lỗi **harness**, đã sửa riêng: seed nhầm cột pet type; Siteverify stub parse nhầm encoding; fixture đụng quota localhost; assertion nhầm 504 thay vì 503 và 401 thay vì anonymous bootstrap 200; assertion focus trước animation frame; chờ nhầm alert widget; dùng verify link sau reset (backend đúng contract đã vô hiệu hóa link và xác minh email); widget QA không stub ở bài regression cũ; handler stub dùng chung ghi đè handler đo cooldown trong một bài browser. Không tăng timeout để che lỗi. Khi SQL token UPDATE đã được DB nhận nhưng process chết, DB có thể commit nguyên tử: harness kiểm token mới đã lưu được dùng, thay vì mặc định mọi ca kill đều phải revoke. Nếu chưa persist, hết lease phải kết thúc phiên, không replay.

## Ma trận theo task

Mã task theo phạm vi bước 2; tiêu chí dưới đây từ yêu cầu QA bước 3, không gán lại tên nguyên văn từ sheet.

| Task / tiêu chí | Bằng chứng mới | Kết quả | Giới hạn |
|---|---|---|---|
| FE-028 — login/register, identity backend, reload/bootstrap | `real-api.log`, `browser-account-final.log`, `browser-flows-final.log` | Đạt QA | Widget/Siteverify mô phỏng; API/DB thật |
| FE-028 — opaque HttpOnly/Secure/host-only/SameSite cookie; không token client | `logic-final.log`, `browser-account-final.log`, `credential-audit.json` | Đạt QA | TLS/cookie production local; ingress thực chưa kiểm |
| FE-028 — Origin/Fetch Metadata, JSON/body bound, allowlist endpoint/field, no-store, timeout/no redirect | `logic-final.log`, `config-check.log`, `mutation-timeout.log` | Đạt QA | Policy HTTP tests có upstream mô phỏng; timeout mutation chạy API thật |
| FE-028 — fixation, login/logout race, thay phiên | `fixation.log`; test HTTP predecessor logout | Đạt QA | Hai Next và DB/API thật |
| FE-028 — stale response/cache khi logout/đổi account | `concurrency-verified.log`, `browser-switch-final.log`, logic client/cache | Đạt QA | Browser giữ response thật bằng network gate |
| FE-028 — offline logout, hai tab, reload/pageshow, retry chủ động | `browser-offline.log` và lượt retest cuối | Đạt QA | Mô phỏng mạng offline; backend revoke khi retry là thật |
| FE-028 — guard/role/direct URL, backend revoke phản ánh tại UI | `contracts-final.log`, `browser-roles-final.log`, `browser-revoke.log` | Đạt QA | Tab hiện: tối đa chu kỳ 60s cộng network bound; private request kiểm ngay; tab ẩn kiểm khi visible |
| FE-031 — Profile/Pet CRUD/persistence/DTO numeric/null/validation | `real-api.log`, browser account/flows | Đạt QA | Không có version/optimistic concurrency contract giữa hai editor |
| FE-031 — hai CUSTOMER, foreign read/update/delete; direct API | `contracts-final.log`, `real-api.log` | Đạt QA | 404 cho foreign pet/session, không chỉ dựa UI |
| FE-031 — role khác không có quyền pet CRUD | `contracts-final.log` | Đạt QA | CUSTOMER/OWNER/STAFF/ADMIN kiểm endpoint trực tiếp |
| FE-031 — lỗi giữ draft, pending, retry/invalidation, focus | `browser-extra-final.log`, `browser-revalidation-final.log`, browser flows | Đạt QA | 503/network/401 được inject; save/reload dùng backend thật |
| FE-031 — ảnh pet không giả báo upload; tách Booking mock | Browser account/extra; Booking regression | Đạt trong phạm vi | Upload chưa có contract; Booking vẫn dùng pet/ID mock riêng, không chứng minh ownership thật |
| FE-046 — concurrent refresh nhiều request, hai process | `real-api.log` (8 request), `concurrency-verified.log` (12 request), `browser-tabs-refresh.log` (hai tab) | Đạt QA | Chính xác một backend rotation trên cùng session |
| FE-046 — deny/reuse/timeout/disconnect/expiry/no replay | `concurrency*.log`, `logic-final.log`, `real-api.log` | Đạt QA | API reuse thật; network fault injection có kiểm count |
| FE-046 — process chết trước/sau rotate/trước persist | `concurrency-verified.log` | Đạt QA | Kill OS process thật; lease tự hết, không kéo dài timeout |
| FE-046 — commit token có kết quả không chắc chắn | `concurrency-verified.log` | Đạt QA | Commit nguyên tử hoàn tất thì dùng token đã persist; chưa persist thì kết thúc sau lease |
| FE-046 — logout/revoke/all/password cạnh tranh refresh/pending | `concurrency-verified.log`, `fixation.log` | Đạt QA | Không phục hồi row đã revoke; logout báo chưa xác nhận BE khi kết quả không chắc chắn |
| FE-046 — change password/sessions/revoke/all cho bốn role | `contracts-final.log`, `browser-roles-final.log`, browser flows | Đạt QA | Backend quyết định role/ownership; mỗi role kiểm UI 3 viewport |
| FE-046 — thiếu/sai config, mã hóa/tamper/AAD, cleanup/pool | `config-check.log`, `logic-final.log`, `migration.log` | Đạt QA | Runtime pool max 5/process; không phải load test production |
| FE-046 — migration replay/schema/quyền tối thiểu/rollback transaction | `migration.log`, SQL 001/002/check | Đạt QA | Chỉ DB QA; rollout/backup/scheduler thực chưa nghiệm thu |
| FE-047 — challenge one-use/reset/cooldown/expiry/error | Logic Turnstile/Auth + `contracts-final.log`, `browser-extra-final.log` | Đạt với simulator | Giữ controller/protected submit của Nhi; không tự replay request mutation/Turnstile từ FE/BFF |
| FE-047 — Retry-After 429/503 | `contracts-final.log`, `resend-cooldown.log`, browser extra | Đạt QA | Rate-limit DB thật; Siteverify failure mô phỏng. Retry nội bộ Siteverify dùng idempotency key là policy API hiện hữu |
| FE-047 — register→verify/resend, forgot generic, reset/verify thiếu/hết hạn/đã dùng | `real-api.log`, `contracts-final.log`, browser flows | Đạt QA | Token/link lấy từ file outbox; không coi là SMTP delivery |
| FE-047 — fragment mới cùng route, xóa fragment/no token HTTP URL | Browser extra, credential audit | Đạt QA | Hai reset và hai verify link thật trong DB; widget mô phỏng |
| FE-047 — Cloudflare thật, SMTP thật, mail client/link delivery | Không có credential/config QA hợp lệ | **Chưa kiểm** | Cần chủ cấu hình cấp qua secret manager, không gửi secret qua báo cáo/chat |
| Chung — deployment nhiều instance/ingress/secret/DB vận hành thật | Repo chưa có bằng chứng triển khai thực | **Chưa kiểm** | Hai process local chứng minh cơ chế, không chứng minh deployment thật |

## Browser và hồi quy

Các bài browser chạy tuần tự trên production build ở **1440×1000, 768×1024, 390×844**. Bằng chứng mới gồm screenshot account/profile/pet/security/dialog/recovery/guard, keyboard trap/return focus, validation/error/draft và horizontal overflow.

- Security: bốn role ở cả ba viewport; home route theo backend, anonymous/wrong-role guard, danh sách phiên và password dialog.
- Booking: retry lỗi trước tạo, double-click/Enter/native submit, đúng một record, receipt/list/detail cùng ID; unknown-result reconciliation; chuyển provider trong pending; viewport/mobile geometry.
- Inbox: read-all chụp tập ID ban đầu; lỗi rồi có arrival; retry chỉ đánh dấu tập cũ; badge, keyboard/cancel, deep link, target không hỗ trợ, reload mất mock vẫn còn đường về `/notifications`, Back/Forward.
- Provider Sidebar: collapse/expand và navigation các route đã bàn giao, không thay Provider Header/notification feature.
- Booking/Inbox là hồi quy **mock UI** của #24 với phiên đăng nhập BFF thật. Không dùng chúng để kết luận Booking API hoặc ownership pet thật đã tích hợp.
- Sau sửa Activity, chạy lại nhóm revalidation, bốn role, Booking/Inbox/Sidebar và logout/switch/account bị ảnh hưởng. Sau sửa thêm boundary recovery, chạy lại Account/Auth/recovery/draft/logout/switch, refresh hai tab và các ca hồi quy quan trọng; kết quả nhóm không chịu ảnh hưởng được kế thừa có ghi ở manifest kiểm thử. Các log trước đó chỉ được kế thừa cho phần source/contract không đổi (BFF/store/API); kết quả cuối và số ca được tổng hợp ngay trong mục bên dưới.

## Kết quả kiểm tra cuối

- Logic: **96/96 đạt**, **11** shared-store checks và **7** HTTP policy checks đạt; HTTP policy có upstream mô phỏng, PostgreSQL thật.
- Concurrency cuối: **15/15 nhóm đạt** trên hai Next production OS process + API/DB thật, có fault injection được mô tả. Không còn dùng kết luận từ assertion sai ở các log harness đầu.
- API Profile/Pet/ownership/role/security/recovery: các nhóm trong `real-api.log`, `contracts-final.log`, `resend-cooldown.log` đạt. Bốn role được kiểm endpoint trực tiếp và browser; hai CUSTOMER được kiểm ownership riêng.
- Browser hồi quy: **22/22 Booking**, **12/12 Inbox chức năng + 3/3 layout/Auth**, **12/12 smoke** (gồm mobile menu/keyboard), **3/3 Sidebar** đạt. Sau sửa boundary recovery, chạy thêm **4/4 Booking**, **6/6 Inbox**, **3/3 Sidebar** trọng yếu trên build cuối. Các số có phạm vi chồng nhau.
- Account/Auth/recovery/draft/revalidation/offline/switch/credential checks chạy lại trên build cuối đều đạt; password/security dialog cho bốn role ở ba viewport đạt. Không có page error trong các bộ cuối; lỗi HTTP được chủ động inject ở bài error/draft có chủ đích.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check` đạt; kiểm whitespace riêng cho file mới. API **386 file tracked khớp SHA**, không có thay đổi source API. Không stage file.
- Browser dùng Chromium headless và kích thước viewport mô phỏng; chưa kiểm Safari/Firefox hoặc thiết bị vật lý. Siteverify/SMTP/deployment thực vẫn **chưa kiểm**.

## Chạy lại và hướng dẫn review/triển khai

1. Cài dependency từ lockfile, đọc AGENTS và Next docs trong package hiện tại. Web runtime cần Node hỗ trợ phiên bản Next đang dùng. Build: `npm run build`; start mỗi instance bằng `npm run start` với port riêng. Không dùng `next dev` làm bằng chứng production.
2. Cấp config server: `PAWFLOW_API_URL`, `BFF_APP_ORIGIN`, `BFF_DATABASE_URL`, `BFF_TOKEN_ENCRYPTION_KEY`, `BFF_TRUST_PROXY_HEADERS`. Public widget: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; `NEXT_PUBLIC_API_URL` thuộc nền cũ, không dùng thay server API URL cho BFF. Không cấp khóa BFF qua prefix public.
3. DB owner/operator review **đúng target và backup**, SQL `001_sessions.sql`, `002_login_rotation.sql`, `check.sql`. Chỉ sau review mới cấp `BFF_MIGRATION_REVIEWED` cho tiến trình migration. Chạy `node scripts/bff-db.mjs migrate`, sau đó `node scripts/bff-db.mjs check` bằng chính role runtime. Web không tự chạy DDL. Quyền tối thiểu: CONNECT database, USAGE schema `pawflow_bff`, SELECT/INSERT/UPDATE/DELETE bảng `pawflow_bff.sessions`; không cần sequence/DDL/superuser.
4. Tất cả Web instance dùng chung DB/schema và cùng khóa mã hóa server. Drain bản Web cũ khi chuyển sang chính sách xoay login; nên revoke các phiên BFF cũ trong maintenance để buộc login mới. Giữ database API độc lập về schema; không cần migration API mới. Kiểm tổng connection budget theo số instance (mỗi process tối đa 5) và TLS DB/secret manager của môi trường triển khai.
5. Ingress HTTPS phải chặn truy cập thẳng origin. Mặc định không forward IP người dùng. Chỉ bật `BFF_TRUST_PROXY_HEADERS` sau khi ingress **ghi đè** `x-pawflow-client-ip` và API có cấu hình `TRUST_PROXY` tương ứng. Không tin header client tự gửi. QA đã kiểm default bỏ header giả và opt-in chỉ chấp nhận một IP hợp lệ; topology ingress thật chưa xác minh.
6. Scheduler chạy `node scripts/bff-db.mjs cleanup`; cần giám sát lỗi và lịch chạy ngoài process Web. Khóa mất/đổi không thể giải mã phiên cũ; rollout khóa phải được phối hợp giữa instance và kết thúc phiên cũ, không thử lại refresh chưa rõ đã dùng hay chưa.
7. Rollback an toàn: drain Web, kết thúc phiên BFF, giữ schema/bảng additive và backup; deploy lại bản BFF đã review hoặc tạm dừng Auth. Không tự DROP schema/cột để rollback, không quay về browser access-token storage. QA đã diễn tập transaction rollback giữ dữ liệu/schema; chưa diễn tập rollback deployment thật.
8. API/dịch vụ thật cần các tên cấu hình: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_SESSION_TTL_SECONDS`, `AUTH_RATE_LIMIT`, `API_RATE_LIMIT`, `RATE_LIMIT_HASH_SECRET`, `TURNSTILE_MODE`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAMES`, `TURNSTILE_CHECK_ACTION`, `TURNSTILE_TIMEOUT_MS`, `MAIL_TRANSPORT`, `MAIL_FROM`, `MAIL_LINK_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `AUTH_EMAIL_COOLDOWN_SECONDS`, `PASSWORD_RESET_TOKEN_TTL_SECONDS`, `EMAIL_VERIFICATION_TOKEN_TTL_SECONDS`, `FRONTEND_URL`, `TRUST_PROXY`. QA-only: `TURNSTILE_SITEVERIFY_URL`, `MAIL_OUTBOX_DIR`. Cấp giá trị riêng trong môi trường an toàn; không sao chép config/keys/fixture/outbox vào Git hoặc PR.
9. Test repo: `npm run test:account-session`; shared-store dùng `npm run test:account-session -- --shared-store` với `BFF_DATABASE_URL` trỏ DB QA local có tên được guard cho phép. Script shared-store có DDL QA; không trỏ database triển khai. Chạy `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check`. 15 nhóm concurrency/API thật và ma trận browser được hướng dẫn tái hiện tại [runbook](FE-028-031-046-047-review-runbook.md); harness cục bộ không phải công cụ được đóng gói trong repo. Không coi shared-store với upstream mô phỏng là lượt tích hợp API thật.

Sau QA đã dừng các process Web/API/proxy do lượt này khởi động và đưa container PostgreSQL QA về trạng thái stopped như ban đầu; giữ nguyên database và snapshot riêng để review/chạy lại. Không xóa dữ liệu QA hay thay đổi dịch vụ triển khai.

## Điều kiện bước 4

Phần code Web/migration/test và QA cục bộ đủ để **review bàn giao cộng dồn**, sau khi đọc các giới hạn bên trên và đối chiếu manifest cuối. Trước commit/push phải fetch/kiểm lại PR #24: nếu còn mở thì tiếp tục nền head cộng dồn; nếu đã merge thì đối chiếu `origin/dev` mới và kiểm bản tích hợp. Không tự commit `AGENTS.md`/diff worktree khác hay private QA artifacts.

**Chưa đủ để đánh dấu toàn bộ tích hợp thật hoặc production hoàn tất:** cần Siteverify thật (site/secret/hostname/action), SMTP thật và email client, ingress HTTPS/client-IP trust, secret provisioning, DB backup/cleanup/connection sizing, deploy/failover/rollback thực tế. Ảnh pet và Booking API vẫn ngoài contract/phạm vi đã chốt. Chưa thực hiện bước 4 trong lần làm việc này.
