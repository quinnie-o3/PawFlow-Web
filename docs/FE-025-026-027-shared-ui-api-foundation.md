# FE-025 / FE-026 / FE-027 — Shared UI and API foundation

Bước 2/4, 17/11/2026 (Asia/Ho_Chi_Minh). Source đang chưa commit trên `shared-ui-api-foundation`, worktree `PawFlow-Shared-UI-API`.

## Nền và phạm vi

- FE base/origin dev: `9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`, không đổi từ khảo sát bước 1. PR #23 Turnstile đã ở nền.
- PR #24 còn Open tại `7af952f24a3d805e5ace3f1450d2e8a50377e4c4`. Không nhập Sidebar/Booking P1 vào nhánh này. QA bản ghép với #24 thuộc bước 3, trên worktree tích hợp riêng.
- Backend contract đã rà ở bước 1: PawFlow-API `2eda6ba6f312653819b33c317d17de8635588aa3`, `src/notifications/dto/notification.dto.ts`, `src/notifications/notifications.controller.ts`, `docs/phase2/mvp-fe-api-contract.md`, `docs/phase3/auth-sessions.md` và `docs/phase3/account-recovery.md`.
- Không sửa Provider notification/store, Header, chuông, tên/vai trò hoặc lỗi focus Provider. Customer Sidebar chỉ đổi mục Thông báo từ disabled thành link/badge; không thay nhận diện hoặc Header.
- Không thêm thư viện, dependency/lockfile/config, token/session mới; không nối Search, inbox/push thật, refresh/logout hoặc bootstrap phiên.

## FE-027: transport và điểm nối identity

`src/lib/api/transport.ts` tạo client theo instance. Path tương đối với base đã gồm prefix API; cấu hình đọc lazy qua `config.ts` để UI/mock không cần API đang chạy. Cấu hình sai hoặc path thoát base bị từ chối bằng lỗi config, không đưa giá trị cấu hình vào message.

- Request typed bằng decoder `(unknown) => T`; nếu không cung cấp decoder, response vẫn là unknown. Response giữ status và headers; empty 200/204/205 trả null. Decoder có quyền từ chối null khi endpoint bắt buộc body.
- Lỗi chung: HTTP, network, config và invalid-response. HTTP status vẫn được giữ khi error body không phải JSON. `message` chuỗi/mảng được normalize; `Retry-After` hỗ trợ seconds/HTTP-date/body fallback và chặn giá trị chờ quá lớn.
- Truyền AbortSignal tới fetch, kiểm lại sau fetch/body để loại late response không hợp tác. AbortError là control flow; không map thành lỗi UI. Không log request/response, không implicit Authorization, refresh hoặc retry; fetch dùng no-store.
- Bốn public Auth service đi qua transport chung, vẫn map sang AuthApiError để giữ code/cooldown/UI hiện có. Payload, single-use challenge, reset sau request và không refresh/retry tự động giữ theo #23. Login/Register hook abort khi unmount và không lưu token/hiện lỗi/đi tiếp sau cancellation.
- `identity.ts` chỉ là điểm nối cho response `/auth/me`: unknown → confirmed identity/anonymous, không lấy quyền từ fixture hoặc decode JWT tại client. guardDecision chỉ trả pending/login/allow/forbidden cho UX. Chưa lắp guard hoặc gọi bootstrap. Backend luôn quyết định quyền trên từng request.

## Query/cache convention

`queryCache.ts` là cache trong bộ nhớ theo instance, không singleton phía server, không storage và chưa gắn vào data fetching thật. Không dùng nó để giả Auth của UI/mock.

| Dữ liệu | Freshness | Key / invalidation |
| --- | --- | --- |
| Identity | 0 ms | v1/identity; đổi phiên hoặc logout xóa toàn bộ cache |
| Notifications | 0 ms | v1/notifications/list/status/page/limit/maxId, detail/id, unread; read/read-all invalidate toàn prefix notifications |
| Availability | 0 ms | v1/search/availability/canonical-wire-query; refresh trước khi hành động |
| Public Search | 30.000 ms | v1/search/providers hoặc services/canonical-wire-query; đổi tiêu chí tạo key khác, retry/invalidation có thể bỏ cache |

0 ms nghĩa là phải refetch khi đọc lại, không dùng snapshot cũ làm dữ liệu fresh. Không tự retry mutation. Key chỉ nhận query wire canonical, không nhận draft/credential. Mỗi lần xác nhận phiên mới, đổi account hoặc logout phải gọi changeSession/identity boundary; kể cả cùng user ID cũng đổi epoch, xóa cache và từ chối write của request cũ. Invalidation đổi epoch để response trước mutation không tái điền dữ liệu stale. Tối đa 100 entry/instance. Anonymous không ghi cache này; có thể fetch không cache. Freshness Search là mặc định cho scope hợp lệ khi caller tích hợp. Khi nối refresh/logout thật, caller phải dùng seam này và phối hợp các tab; đợt này chưa triển khai lifecycle đó.

## FE-025: Inbox Customer UI/mock

Routes mới trong account-workspace:

- `/notifications`: list, filter all/unread/read và số chưa đọc.
- `/notifications/[notificationId]`: nội dung đầy đủ, trạng thái đọc và đích liên quan.

CustomerInboxProvider nằm dưới Customer layout và giữ một MockInbox riêng cho phiên mount. List, số trên Inbox và badge Sidebar (kể cả menu mobile hiện có) lấy cùng snapshot. Chuyển route Customer giữ state; reload hoặc rời layout khôi phục mẫu. Mọi label/feedback mới nằm trong namespace locale riêng. Không gắn store này với backend identity.

- Read một idempotent; read-all capture tập ID tại lúc bấm. Arrival trong lúc pending vẫn unread; retry sau lỗi dùng cùng tập ID ban đầu. Lỗi giữ dữ liệu đọc, không báo success giả; pending chặn gửi trùng. Có mô phỏng load/update failure, retry, cancel, empty/reset và arrival.
- Mở detail tự thử đánh dấu đọc một lần; lỗi vẫn giữ nội dung và có retry. Unknown ID có thông báo thiếu và link về inbox.
- Model/adapter chung ở `features/notifications`: decode projection/pagination/anchor backend, kiểm read state và target; adapter Provider chỉ là điểm nối tương lai, không thay code Provider. Tái sử dụng icon và định dạng thời gian Provider hiện có.
- Destination chỉ được tạo cho PROVIDER đã APPROVED trong catalog hoặc BOOKING của actor hiện tại trong workspace. REVIEW/COMPLAINT chưa có màn Customer thì báo chưa hỗ trợ; ID thiếu báo không mở được, không tạo href giả. Đây là kiểm tra mock/UI, không cấp quyền backend.
- Link đích có fromInbox chỉ khi xuất phát từ detail thông báo. Customer main/discovery main giữ link về Inbox, kể cả nội dung đích tải lỗi. fromInbox chỉ dùng để hiện navigation; khi notification còn trong phiên thì đối chiếu target/path, còn khi snapshot đã mất thì chỉ cung cấp backlink cố định về /notifications trên route đích Customer hợp lệ. Không dùng nó để authorization hoặc tạo return URL tùy ý.
- Công cụ “Nhận thông báo từ lịch của tôi” chỉ dùng booking hiện có; không tạo booking nền hoặc giả ID hợp lệ. Có thể dùng lịch sử mẫu của workspace hiện có để xem luồng booking.

UI dùng chung thêm FormFeedback/FieldError, Skeleton và Toast. Áp dụng feedback vào Inbox và form profile Customer; profile vẫn giữ draft khi lưu lỗi. Lỗi form hiển thị tại chỗ bằng alert, field error giữ id/aria-describedby. Toast dùng live region polite, không tự giành focus và không tự biến mất. Skeleton có status cho công nghệ hỗ trợ, các hàng trang trí aria-hidden. Chưa refactor các form hoàn tất khác.

## FE-026: ma trận hồi quy cho bước 3

| Nhóm | Bằng chứng dùng lại | Phải chạy ở bước 3 / điều kiện |
| --- | --- | --- |
| Provider Sidebar và Booking P1 #24 | 24 browser Provider, 22 browser Booking, 70 logic trên SHA bàn giao; bản nhánh này chưa chứa #24 | Tạo bản ghép riêng từ source cuối + #24 nếu còn mở; Booking single/double/Enter retry, timeout/reconcile, một record và ID receipt/list/detail; Sidebar navigation/keyboard/scroll/overflow trên bản ghép |
| Inbox mới | Unit model/store/adapter và smoke production của bước 2 | Full all/unread/read, badge Sidebar desktop/mobile, detail/direct/reload/Back/Forward, arrival trong pending và retry read-all, lỗi không cập nhật sai, cancel/unmount/late result, empty/reset; ba viewport; keyboard/focus/live feedback |
| Deep link | Resolver unit; smoke Provider/booking, target thiếu và link quay lại Inbox | Mọi target có route hợp lệ, own/foreign/missing, unknown notification, lỗi tải đích; giữ đường về Inbox; query fromInbox không tạo external redirect |
| Customer shell | Account/Pet/Booking lịch sử chỉ dùng lại cho logic/source không đổi | Shell/layout đã thay provider wrapper, navigation và return link nên chạy lại direct links/menu/focus/scroll/responsive trên Account/Pet/Booking/Discovery/Detail |
| Profile form | Logic/profile editor không đổi; chỉ chuyển markup feedback | Chạy lại validation/aria field, giữ draft khi lỗi, retry, focus/Tab/Shift+Tab/Esc; screenshot/overflow ba viewport |
| Auth transport | Các test #23 chạy lại trên transport chung | Khi ghép source, kiểm tương thích public Auth payload, 401/403 không refresh, cooldown/429/503, abort/unmount không báo lỗi/redirect; browser thiếu cấu hình không thay fullstack |
| Search | Không đổi queryState/repository/hook Search | Smoke UI do Customer layout thay đổi; nối Search thật để cụm sau |
| Auth/backend thật | Chưa thực hiện trong đợt này | Chờ môi trường API/Cloudflare/email phù hợp và cụm bootstrap/refresh/logout; chưa nghiệm thu role guard, persistence, real ownership, inbox API hay push |
| Provider Header/chuông/tên/vai trò/focus | Source giữ nguyên | Vẫn thuộc lượt riêng theo Nhi; không coi QA các phần khác là đã sửa lỗi focus từ chuông |

## Kiểm tra bước 2 — kết quả lịch sử

Kết quả thực chạy trên bản cuối (source chưa commit):

| Lệnh/kiểm tra | Kết quả |
| --- | --- |
| Compile test bằng tsc + node --test (Auth API/Turnstile, API foundation, Inbox) | 45/45 đạt, 0 fail |
| npm run lint | Exit 0, không warning/error |
| npx tsc --noEmit | Exit 0 |
| npm run build | Exit 0; có /notifications và /notifications/[notificationId] |
| git diff --check | Exit 0; index rỗng |
| Chromium production tại localhost:3058, timezone Asia/Ho_Chi_Minh | 13/13 nhóm smoke đạt; 0 pageerror, 0 console error, 0 request ngoài local |

Smoke gồm Inbox/list/badge/read-all + arrival ở 1440×1000, 768×1024, 390×844; lỗi update/load + retry; hủy load/mutation giữ read state; empty; deep link thiếu/unknown và đường về Inbox khi Provider Detail lỗi; booking target own đã tồn tại + Back/Forward; profile form lỗi lưu giữ draft/retry; badge menu mobile và keyboard/read/focus/toast ở tablet/mobile. Đã xem trực tiếp screenshot Inbox desktop/mobile sau sửa.

Lượt smoke đầu tìm thấy hai lỗi UI mới (mobile bị ép cột, return link dưới Header Discovery), đã sửa và chạy lại trên build cuối. Selector script ban đầu còn chọn Next route announcer và Sidebar ẩn; các lần lỗi/script ban đầu giữ riêng trong smoke-results-initial.json và screenshot, không cộng vào số pass cuối.

Đối chiếu cuối: 14 worktree có trước giữ nguyên branch/HEAD/status/diff/index và hash tracked; 3 stash giữ nguyên. 9 file tracked sửa và 22 file mới chưa theo dõi (31 tổng), không có staged/commit mới. Không sửa Header/chuông/Provider notification, package/lockfile/config hoặc các namespace locale cũ.

Các số trên là kiểm tra bước 2, chưa thay QA hồi quy bản ghép #24 ở bước 3. Chưa thực hiện Auth/backend/email/Cloudflare thật, API inbox/push hoặc Search thật. Các khoảng trống Auth cũ (verify đích thiếu, Forgot, tiêu đề mobile/Google layout) tiếp tục thuộc hàng chờ và chưa được xử lý bởi cụm này.

Danh sách file theo Git ở cuối tài liệu.
 Artifacts ngoài repository: `QA-shared-ui-api-step2-20261117/` chứa test/lint/typecheck/build logs, script/screenshot/results smoke, manifest và snapshot bảo toàn. Các lần runtime gặp Keychain trong sandbox được giữ là lỗi môi trường; lệnh cuối chạy với quyền phù hợp, không sửa config để né lỗi.

Điểm dừng lịch sử của bước 2: chưa commit, push, PR hoặc cập nhật sheet; QA bản ghép lúc đó chưa thực hiện. Kết quả mới ở mục bước 3 bên dưới.

## Danh sách file theo Git

Chưa stage: 9 file tracked sửa, 22 file mới chưa được Git theo dõi.

| Git | File |
| --- | --- |
| M | `locale/vi.json` |
| M | `src/app/(customer)/(discovery)/layout.tsx` |
| M | `src/app/(customer)/layout.tsx` |
| M | `src/features/auth/hooks/useLoginCustomer.ts` |
| M | `src/features/auth/hooks/useRegisterCustomer.ts` |
| M | `src/features/auth/services/authApi.ts` |
| M | `src/features/customer-account/components/ProfileEditDialog.tsx` |
| M | `src/features/customer-shell/components/CustomerShell.tsx` |
| M | `src/features/customer-shell/components/CustomerSidebar.tsx` |
| ?? | `docs/FE-025-026-027-shared-ui-api-foundation.md` |
| ?? | `src/app/(customer)/(account-workspace)/notifications/[notificationId]/page.tsx` |
| ?? | `src/app/(customer)/(account-workspace)/notifications/page.tsx` |
| ?? | `src/components/ui/Feedback.tsx` |
| ?? | `src/components/ui/Skeleton.tsx` |
| ?? | `src/components/ui/Toast.tsx` |
| ?? | `src/components/ui/feedback.module.css` |
| ?? | `src/features/customer-notifications/CustomerInboxPage.tsx` |
| ?? | `src/features/customer-notifications/CustomerInboxProvider.tsx` |
| ?? | `src/features/customer-notifications/InboxReturnLink.tsx` |
| ?? | `src/features/customer-notifications/UnreadBadge.tsx` |
| ?? | `src/features/customer-notifications/inbox.module.css` |
| ?? | `src/features/customer-notifications/mockInbox.ts` |
| ?? | `src/features/notifications/adapter.ts` |
| ?? | `src/features/notifications/model.ts` |
| ?? | `src/features/notifications/notifications.test.ts` |
| ?? | `src/lib/api/config.ts` |
| ?? | `src/lib/api/errors.ts` |
| ?? | `src/lib/api/foundation.test.ts` |
| ?? | `src/lib/api/identity.ts` |
| ?? | `src/lib/api/queryCache.ts` |
| ?? | `src/lib/api/transport.ts` |

## Bước 3/4 — QA hồi quy, chốt 21/11/2026

**Kết luận:** đủ điều kiện bàn giao phạm vi UI/mock FE-025 + QA FE-026 + nền FE-027 ở bước 4. Chưa nghiệm thu tích hợp Auth/Search/backend, inbox API hoặc push. Không còn lỗi tái hiện trong phạm vi cụm sau các lần chạy cuối; các giới hạn và hàng chờ Auth cũ giữ riêng bên dưới.

### Bản source và bản ghép được kiểm

- Nền triển khai/origin dev đã fetch lại ngày 21/11: `9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`.
- PR #24 vẫn Open/chưa merge, head `7af952f24a3d805e5ace3f1450d2e8a50377e4c4`.
- Bản gốc: `PawFlow-Shared-UI-API`, nhánh `shared-ui-api-foundation`, HEAD vẫn là nền trên, source chưa commit.
- Bản ghép: `PawFlow-Shared-UI-API-QA-20261120`, detached HEAD đúng head #24, áp đủ patch 9 file tracked và copy đủ 22 file mới của cụm. Không tạo commit để dựng bản ghép.
- Demo QA: `http://localhost:3063/notifications`; detail `/notifications/104`; đích thiếu `/notifications/103`. Route `/bookings/PF-DEMO-1?fromInbox=105` ở phiên mới thể hiện booking mock không tồn tại nhưng vẫn có đường về inbox.
- Sau sửa, đủ 31 file của cụm khớp byte/hash giữa bản gốc và QA. Chênh lệch ngoài cụm chỉ là sáu file đã bàn giao của #24, được giữ trên bản ghép; không copy Sidebar/Booking P1 vào nhánh cụm.

### Lỗi phát hiện và phần sửa về nhánh cụm

| ID | Tái hiện và nguyên nhân | Sửa / kiểm lại |
| --- | --- | --- |
| QA-SHARED-01 / P2 | Tạo thông báo từ booking mock hiện có → mở booking → reload. Workspace mất booking và notification vừa sinh; InboxReturnLink yêu cầu còn notification nên mất link về inbox. Đã tái hiện ở cả ba viewport. | `inboxReturnHref` giữ backlink cố định `/notifications` khi ID nguồn đúng dạng và route đích là Customer booking/provider, dù notification đã mất. Khi notification còn tồn tại vẫn kiểm target/path. Không cấp quyền hoặc dựng link tới target chưa xác minh. Unit regression mới và browser reload/Back/Forward ở cả ba viewport đạt. |
| Chỉnh dữ liệu mẫu | Mô tả thông báo nêu MAY PET, trong khi target provider ID 1 là Pet House trong catalog mẫu. | Đổi câu mô tả thành lời giới thiệu chung, không gán sai tên cơ sở. Không đổi target hoặc catalog. |

Các file nhận sửa/test mới từ QA về bản gốc: `locale/vi.json`, `src/features/customer-notifications/InboxReturnLink.tsx`, `src/features/notifications/model.ts`, `src/features/notifications/notifications.test.ts`, `src/lib/api/foundation.test.ts`. Biên bản hiện tại được cập nhật thêm. Không thêm file repo: tổng vẫn **9 tracked sửa + 22 untracked = 31 file**, index rỗng.

### Kết quả chạy mới, tách với bước 2

| Nhóm / lệnh | Kết quả và phạm vi |
| --- | --- |
| Compile strict + node --test trên source cuối | **135/135 đạt** ngày 21/11; gồm bộ API/Auth/Turnstile/Inbox, Booking core/submission/workspace, Profile và Search. Ba test bổ sung so với bộ tổng hợp ban đầu 132 test ở bước 3: backlink sau snapshot mất, HTTP response đến muộn sau invalidation/đổi identity, cache instance và identity bị từ chối. |
| Booking trên bản có #24 | **22/22 ca browser đạt** trong lượt tuần tự mới: gửi thường; lỗi → single/double-click/5 Enter + native submit; geometry nút không dịch; timeout/lookup lỗi/reconcile; một record, cùng ID receipt/list/detail; navigation có chủ đích. |
| Hồi quy mở rộng Customer | **18/18 nhóm đạt** tại 1440×1000, 768×1024, 390×844. Read-all lỗi + arrival + retry đúng tập ID; đọc detail lỗi/retry/cancel; Provider và Booking deep link/reload/Back/Forward; Profile field/full-form error, draft/retry/ARIA/keyboard; các Customer route và Auth thiếu cấu hình. |
| Smoke bản cuối | **13/13 nhóm đạt** trong lượt chạy lại riêng: Inbox/badge, skeleton, load lỗi/retry/cancel, empty, deep link đích lỗi và quay về, booking target own, Profile draft, menu badge và focus/toast. |
| Sidebar #24 | **3/3 nhóm navigation đạt**, bao phủ 28 tổ hợp route/trạng thái: desktop 285↔80px, bảy route ở hai trạng thái; tablet/mobile đủ menu, Esc/trả focus, resize/scroll/overflow. Không chạy CRUD Provider hay coi lỗi từ chuông Provider đã sửa. |
| npm run lint | Chạy mới trên bản ghép và nhánh triển khai gốc, exit 0, không warning/error. |
| npx tsc --noEmit | Chạy mới trên bản ghép và nhánh triển khai gốc, exit 0. |
| Production build | Bản ghép sử dụng build cuối đã thành công và khớp source để chạy browser. Chạy mới `npm run build` trên nhánh triển khai gốc sau nhận sửa ngày 21/11, exit 0. |
| git diff --check | Cả bản gốc và QA đạt; không có staged/commit mới. |

**56 nhóm browser cuối đều đạt**, không page error, console error hoặc request ngoài local trong các bộ được chọn. Đây là kết quả mới ở bước 3, không lấy 45/45 test và 13/13 smoke của bước 2 thay thế. Các nhóm có phạm vi chồng nhau; con số là số nhóm kiểm thử, không phải số tính năng độc lập.

135 test và 56 nhóm browser không phải cùng một lệnh duy nhất. Booking/QA mở rộng/Sidebar chạy tuần tự; smoke được chạy lại riêng sau chỉnh script. Các ca được chấp nhận nằm trong `verification-final-20261121.json` và log/result tương ứng.

### Phân biệt lỗi ứng dụng, script và môi trường

- Ca mất backlink là lỗi ứng dụng thật: có ảnh trước sửa và tái hiện ba viewport; đã sửa source.
- Lượt đầu của read-all retry dùng locator tới nút retry sau khi nút đã bị gỡ khỏi DOM. Script chuyển sang hai click đồng bộ trên cùng phần tử; store chống lặp được kiểm, không sửa app để đạt ca này.
- Lượt `booking-verified` chưa vào flow ứng dụng do script gọi API không tồn tại `expect.setOptions`. Đã sửa script ngoài repo sang `expect.configure` theo typings thư viện đang cài.
- Các lượt song song có timeout và ảnh cho thấy kết quả xuất hiện sau thời hạn chờ. Khi tiếp tục đã xác minh/dừng đúng server QA cũ ở cổng 3063, mở lại từ build cuối, giới hạn một browser, đưa page ra foreground. Chỉ các script còn dùng 5–8 giây được nâng trần chờ lên 15 giây dựa trên log đó. Lượt tuần tự Booking 22/22 và QA mở rộng 18/18 đạt; smoke cũ còn timeout 5/6 giây nên được chạy lại riêng cùng cấu hình, đạt 13/13. Không tăng delay mock hoặc sửa logic để che timeout.
- Một lần xét duyệt quyền chạy smoke hết thời gian trước khi lệnh được thực hiện; lần thử lại hoàn tất. Các lỗi Keychain/sandbox và lệnh compile test ban đầu thiếu strict là lỗi công cụ/lệnh chạy, không sửa dependency/config/source ngoài cụm để né chúng.
- Giữ toàn bộ log/ảnh lỗi cũ riêng, không đổi chúng thành pass. Bằng chứng mới ở các thư mục/log có hậu tố resume/verified-20261121.

### Đối chiếu tiêu chí nghiệm thu

| Task | Hoàn tất trong cụm | Cần nghiệm thu tiếp |
| --- | --- | --- |
| FE-025 | Inbox Customer/list/detail; cùng nguồn badge/read state; read một/tất cả idempotent/pending/chống lặp; lỗi/retry/cancel; arrival và retry read-all giữ tập ID; target có route/ID xác minh; fallback/đường về inbox sau reload hoặc lỗi; toast/skeleton/form feedback, draft và keyboard/ARIA/responsive trên Chromium. | API inbox/push/persistence thật; đồng bộ tài khoản thật. Header/chuông/tên-vai trò và lỗi focus thông báo Provider vẫn lượt riêng theo Nhi. Không tuyên bố audit screen reader/WCAG đầy đủ. |
| FE-026 | Hồi quy Customer/shared feedback và bản ghép #24 tại ba viewport; Booking P1, ID nhất quán, Sidebar smoke; lỗi thuộc cụm đã sửa và source gốc khớp bản kiểm. | Hàng chờ Auth cũ và fullstack; browser/thiết bị ngoài Chromium mô phỏng. Không coi mock ownership là backend authorization. |
| FE-027 | Response rỗng/JSON lỗi/HTTP/network/config/Retry-After/AbortSignal; abort không hiện lỗi; response cũ không nạp lại cache sau invalidation/đổi identity/logout, instance/phiên cô lập; seam identity từ backend và policy keys/freshness/invalidation; Auth transport giữ single-use/reset/cooldown theo test doubles. | Bootstrap/session/refresh/logout/guard thực; Search adapter và dữ liệu thật, cache với fetch lifecycle thật; role/ownership/rate-limit/Cloudflare qua backend. Backend quyết định quyền. |

### API thật, ca bị chặn và hàng chờ

Kiểm ngày 21/11 không thấy cấu hình local phù hợp trong các worktree hoặc cấu hình API/widget kế thừa. **Chưa chạy PawFlow backend thật**; không tạo test key, chèn token, bypass widget hoặc gửi email. UI Login/Register trạng thái thiếu cấu hình và submit khóa được kiểm ở cả ba viewport.

Các ca còn chặn: login/register thành công thật, Cloudflare challenge/Siteverify và expired/cooldown thật, session/refresh/logout, backend 401/403/ownership và response cạnh tranh thật, email recovery. Endpoint/error fixture trong unit test là test doubles, không tính là API thật. Inbox, Account/Pet/Booking/Discovery đều dùng mock. Ca foreign/missing target được kiểm ở resolver/core mock; quyền backend chưa được nghiệm thu.

Các lỗi Auth cũ giữ trong hàng chờ phối hợp Nhi/cụm Auth: Register trỏ `/register/verify-email` chưa có route; Forgot chưa phản hồi; tiêu đề Login mobile và Google Register tràn card đã ghi trước đó. Lượt này không sửa hoặc đóng các lỗi đó, và không mở rộng sang Header/chuông/Provider notification.

### Bảo toàn và bàn giao

Giữ nguyên 14 worktree ngoài hai worktree task/QA, ba stash và các diff local có sẵn. Bản gốc chỉ nhận năm file sửa/test nêu trên cùng biên bản này; bản QA tiếp tục detached ở head #24. Không stage, commit, push, mở/cập nhật PR, merge hoặc cập nhật sheet.

Bước 4 có thể bàn giao **một PR cộng dồn vào dev** cho Nhi review, ghi rõ phạm vi UI/mock + foundation và trạng thái phụ thuộc #24. Kết quả QA trên bản ghép không tự đưa #24 vào nhánh cụm hoặc cấp quyền merge.

Artifacts ngoài repo: `/Users/tom/Desktop/PawFlow/QA-shared-ui-api-step3-20261120/`. Nguồn chuẩn là verification-final-20261121.json, các result/log cuối, manifest cluster/equality và preservation; ảnh return-after-reload-* xác minh trực quan bản sửa.
