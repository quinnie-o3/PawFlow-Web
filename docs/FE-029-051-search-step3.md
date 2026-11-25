# FE-029 / FE-051 — Bước 3/4: QA tích hợp và hồi quy

Ngày 25/11/2026, Asia/Ho_Chi_Minh. **Đủ điều kiện chuyển sang bước 4 bàn giao trong phạm vi FE-029/FE-051 đã chốt.** Không có tiêu chí bắt buộc của lượt QA này còn thất bại. Chưa commit/push/mở hoặc merge PR/cập nhật sheet/nhắn người khác.

## Bản kiểm và nền

- Worktree triển khai: `PawFlow-Search-API-Reliability`, nhánh `search-api-reliability`, HEAD/base `e67ff5c2498019a059a72fec4bd7e44cf3724c6b`.
- Sau fetch, Web dev `9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`; PR #24 còn mở, head `e67ff5c2498019a059a72fec4bd7e44cf3724c6b`; dev là ancestor của head. Không có nền mới cần ghép.
- API dev `2eda6ba6f312653819b33c317d17de8635588aa3`; không sửa backend.
- Đầu lượt đối chiếu đúng 27 path và 470 hash runtime/test với manifest bước 2: `69121b1c2bd597127921771b70f3a8ce89f4ccb77c68810903bfa3b72963891b`.
- QA dùng source snapshot riêng có cùng byte với worktree triển khai, production build/HTTPS riêng để giữ runtime bước 2. Sửa lỗi tại nhánh triển khai rồi đồng bộ đúng các file vào snapshot; đối chiếu toàn bộ 470 file sau sửa. Không có branch/worktree Git mới.
- API và BFF dùng hai DB QA mới, độc lập với DB cũ. Chỉ chạy migration hiện hữu trên DB mới. API biên dịch vào thư mục QA riêng. Hai CUSTOMER QA thật, cookie BFF opaque HttpOnly/Secure, backend xác minh identity/session.
- Turnstile backend vẫn enforce; Siteverify là HTTP simulator một lần dùng trong QA. Không stub BFF/session/identity trong các ca demo/session bước 3. Không coi simulator là Cloudflare thật.

Manifest bước 2 giữ nguyên làm hồ sơ tham chiếu. Manifest cuối riêng: [FE-029-051-search-step3-manifest.json](FE-029-051-search-step3-manifest.json) (khớp đủ 470/470 đường dẫn runtime/test, fingerprint `09a0b1067528e9ede20f02f58b73446fab6d8edd78e013a9f770f41ffd3c747c`, đúng 4 file đổi SHA256 so với bước 2: `api.ts`, `catalog.test.ts`, `PublicDiscoveryPage.tsx`, `PublicProviderDetail.tsx`).

## Kết quả và nguồn bằng chứng

| Nhóm | Kết quả | Nguồn |
| --- | --- | --- |
| Search logic/contract + hồi quy hẹp | **67/67 đạt**, chạy tươi trên bản clone độc lập sau vá cuối | `node scripts/test-search.mjs` trên clone (và `search-tests-final.log` kế thừa); 50 test kế thừa liên quan, 13 public test bước 2 và 4 public test mới bước 3 |
| API/PostgreSQL thật | **15 nhóm đạt** | `api-contract-final-results.json` (13), `api-order-extra-results.json` (2) |
| Production Chromium chính | **15 nhóm đạt**, tuần tự 1440×1000 → 768×1024 → 390×844 | `matrix-results.json`, screenshot `matrix-*`, `dialog-*` |
| Race/cache/unmount/loading-error backlink | **8 nhóm đạt** | `race-results.json`, `error-back-*` |
| Lỗi/mạng/cooldown | **8 nhóm đạt** | `fault-results.json`; lỗi/timing browser được inject rõ |
| URL/category/dataset thay đổi | **4 nhóm đạt** | `url-data-results.json`; mutation chỉ trên fixture QA, có restore trong finally |
| Booking/Inbox demo qua phiên thật | **6 nhóm đạt**, hai luồng ở mỗi viewport | `demo-results.json`, `demo-*`; không có session-view stub |
| Public/private session boundary | **2 nhóm đạt** | `session-results.json`; BFF/API thật, Alpha → logout/login → Beta và UI logout |
| Debounce/IME có clock assertion | **3 nhóm đạt** | `debounce-results.json`; 349 ms chưa gửi, 350 ms gửi đúng một lần |
| Lint/typecheck/build/diff | **5 lệnh kiểm cuối exit 0** (chạy tươi trên bản clone độc lập) | Chạy tươi: `node scripts/test-search.mjs` (67/67), `npm run lint`, `npm run build` (truyền inline `NEXT_PUBLIC_API_URL`), `npx tsc --noEmit`, `git diff --check`; đối chiếu `final-checks.json` trong bundle |

46 nhóm browser có chồng phạm vi chức năng; không coi là 46 mẫu độc lập hay cộng với các số bước 2 để tăng coverage.

Kế thừa hợp lệ: khảo sát contract, fixture/harness và thiết kế từ bước 1–2; private session/Turnstile/Sidebar không đổi. Không chạy lại toàn bộ QA các cụm cũ. Các test logic cũ nằm trong runner hẹp được chạy mới vì người dùng yêu cầu kiểm cuối.

Bằng chứng browser bước 3 mới được thực thi trên bản này. Một số nhóm đã đạt được resume ở cùng lượt thay vì chạy lại: matrix có ba nhóm desktop giữ nguyên; race giữ bốn nhóm trước sửa padding; URL giữ hai nhóm trước chỉnh assertion. Sửa padding chỉ ảnh hưởng loading/error Detail, đã kiểm mới ở ba viewport. Không gọi các nhóm resume là một lượt test mới. Các ca API qua decoder được kiểm lại sau sửa decoder; các ca HTTP/DTO không bị ảnh hưởng được giữ kết quả đã đạt trong bước 3.

Xác minh lại trên bản clone độc lập (Micro-task 1): chạy tươi đủ 5 cổng kiểm cuối sau khi siết thêm edge-case focus trap của `<dialog>` (`node scripts/test-search.mjs` 67/67, `npm run lint`, `npm run build` với `NEXT_PUBLIC_API_URL` inline, `npx tsc --noEmit` sau khi build sinh `.next/types`, `git diff --check` — đều exit 0; `next-env.d.ts` và `tsconfig.json` không bị thay đổi). Bằng chứng live API/PostgreSQL (15 nhóm) và Chromium production (46 nhóm có chồng phạm vi) được kế thừa từ bundle `QA-search-api-reliability-step3-20261125` vì 3 bản vá bước 3 không làm đổi contract request/SQL/BFF; không mở browser/API/DB trên clone, nên riêng nhánh siết thêm edge-case `Tab`/`Shift+Tab` khi focus ở chính `<dialog>` chưa chạy lại trên Chromium live.

## Tiêu chí nghiệm thu theo task

Các tiêu chí dưới đây diễn giải deliverable gốc và các yêu cầu QA của người dùng, không phải nội dung cập nhật vào sheet.

| Task | Tiêu chí | Trạng thái | Bằng chứng |
| --- | --- | --- | --- |
| FE-029 | Public category/provider/service/detail/availability đúng DTO, BIGINT string, numeric/null, ownership | **Đạt** | API contract, decoder tests, matrix deep link/BIGINT/no service |
| FE-029 | Filter/sort/page và tổng do server quyết định; không tải toàn bộ catalog để lọc client | **Đạt** | Provider 6 sort, service 6 sort/7 trang, slot date/time/ID; SQL fixture oracle; request limit 4/20 |
| FE-029 | Từ khóa/location/giá/rating/ID đúng giới hạn; từ trùng/Unicode/%/_/backslash | **Đạt** | API thật: 100/101 Unicode, 8/9 từ, trim/blank/duplicate terms, escaped literals, numeric boundaries |
| FE-029 | Public cache tách nguồn/identity, đủ key, 30 giây/100 entry, availability 0 | **Đạt** | Unit cache values/call counts/expiry/eviction/key vectors; browser hit trước 30 giây và refetch sau expiry; availability đọc lại |
| FE-029 | Loading/empty/validation/404/network/timeout/invalid-response/429/503, manual retry giữ điều kiện | **Đạt** | Matrix, faults, real API 400/404/429/503; không cache error, không tự retry |
| FE-029 | Không mock fallback; Detail thật không gọi Booking mock; provenance demo rõ | **Đạt** | Matrix/live boundary và demo qua BFF/API thật; provider ID 1 đồng thời tồn tại ở hai nguồn nhưng tên/đích đúng nguồn |
| FE-051 | Debounce 350 ms, IME, rapid query/filter/sort/page và không mất draft | **Đạt** | Deterministic clock 349/350; IME 1000 ms không request, sau compositionend 350 ms đúng một; sort commit giữ draft |
| FE-051 | Response cũ/server bỏ abort/body hoặc post-body decoder đến muộn không ghi UI/cache | **Đạt** | Browser bỏ signal có chủ đích; deferred fetch/body; revisit request count=2 chứng minh không cache response cũ; deferred decoder unit |
| FE-051 | Unmount/provider/service switch không nhận dữ liệu trước | **Đạt** | Client navigation khi provider pending; service switch; old provider không điền cache, refetch đúng đối tượng |
| FE-051 | URL/reload/Back/Forward/returnTo/legacy/duplicate/available | **Đạt** | Matrix ba viewport, URL suite; invalid/available provider request count=0 đến khi thao tác bỏ; returnTo ngoại bị loại |
| FE-051 | Page quá cuối/tổng 0/dataset đổi không vòng lặp | **Đạt** | Page 1000 API thật; browser zero/clamp; dataset 5→1→0, hai URL page duy nhất, số request hữu hạn |
| FE-051 | Public không phụ thuộc BFF và không gửi credential; đổi account/logout an toàn | **Đạt** | Anonymous real bootstrap; BFF 503 inject vẫn search; cookie thật tồn tại nhưng request public không Cookie/Authorization; session race Alpha/Beta/logout |
| FE-051 | Keyboard/focus/dialog/menu/label/overflow ba viewport và hồi quy liên quan | **Đạt** | Matrix 15 nhóm, Tab/Shift+Tab/Esc, menu, error backlink ba viewport; demo 6 nhóm và private boundary 2 nhóm |

Không có hàng bắt buộc nào còn “chưa đạt/chưa kiểm” trong phạm vi lượt này. Các mục ngoài phạm vi/contract thiếu được liệt kê riêng bên dưới, không biến thành thành công giả.

## Ba lỗi ứng dụng đã sửa

| Lỗi | Sửa tối thiểu | Kiểm lại |
| --- | --- | --- |
| Echo query sai kiểu vẫn qua decoder vì phép so sánh có thể ép chuỗi thành số; đặc biệt text/ID lớn và numeric filter | `public-catalog/api.ts`: phân biệt rõ text/ID string và numeric filter number; thêm regression test | Probe thất bại giữ lại; 67 test cuối, 6 nhóm API dùng decoder kiểm lại, browser shape/error |
| Tab/Shift+Tab có thể thoát dialog bộ lọc tới body (gồm edge-case danh sách control rỗng hoặc focus rơi ngoài `controls` như vào chính `<dialog>`) | `PublicDiscoveryPage.tsx` (`Filters`): chặn `Tab` khi `controls.length === 0`, điều hướng focus ngoài `controls` về `last`/`first` theo `shiftKey`, giữ vòng lặp `first` ↔ `last` cho `button`/`input` đang enabled | 20 lần Tab/Shift+Tab, Esc/restore ở ba viewport kế thừa từ `QA-search-api-reliability-step3-20261125`; bản siết edge-case cuối trên clone đã qua 5 cổng tĩnh/test/build, chưa chạy lại trên Chromium live |
| Backlink Detail đang loading/error bị header absolute che | `PublicProviderDetail.tsx`: dùng class initialState hiện hữu khi chưa ready | Pending provider + client navigation; geometry link ≥ đáy header; Enter/back khi loading và 404 ở ba viewport |

Không sửa Header/Sidebar Provider, Auth/Turnstile, BFF/private session, Inbox read/read-all/badge, Booking submission, package/lockfile hoặc source/migration backend.

## Lỗi harness/môi trường đã phân biệt

Giữ log thất bại ban đầu trong bundle, không chỉ giữ lượt xanh.

- Preflight chạy nhầm cwd API khi đọc manifest Web; sửa đường dẫn tuyệt đối. Copy helper có lần dùng QA cwd làm source và báo SameFileError; không ghi đè implementation.
- Module `.cjs` thiếu extension ở require của harness; sửa harness.
- Fixture rate-limit dùng `hits=0` trái constraint `hits>0`, và có lần cập nhật bucket đã hết hạn; sửa thành prime bucket hiện hành và restore hits=1. API 429 thật sau đó đạt.
- Một assertion tính vùng role=alert rỗng của framework là lỗi hiển thị; kiểm vùng có nội dung hiển thị, không bỏ qua thông báo lỗi thật.
- Bootstrap anonymous có thể remount workspace theo identity epoch đã bàn giao: có thêm request ban đầu. Cache assertions đặt baseline sau bootstrap; clamp assertions kiểm số URL/page, một lần clamp và request count hữu hạn (tối đa 3 gồm remount), không suy ra retry loop từ request ban đầu trùng.
- Assertion text dùng innerText bị CSS uppercase tác động; so với textContent và tên API thật. Selector tên tài khoản chọn bản responsive ẩn; dùng nội dung thực sự hiển thị.
- Harness thử login trực tiếp từ BFF session active nhận 401 theo policy hiện hữu. Sửa thành logout/login thật và phát thông báo đổi phiên theo protocol BroadcastChannel hiện hữu; identity vẫn do BFF/API xác minh. Không sửa session policy để làm test qua.
- Một lượt race trùng lúc rebuild QA runtime bị supersede; đã tách build và browser, không tính lượt đó là bằng chứng đạt.

## Session và dữ liệu QA thật

BFF dùng PostgreSQL store, runtime role riêng chỉ DML, migrations 001/002 và schema check hiện hữu trên DB mới. API dùng migration chain 17 hiện hữu. Cookie HttpOnly/Secure có thật; login/me/sessions/logout và profile thật chạy qua BFF/API. Không stub session-view/identity.

Ca đổi tài khoản giữ đồng thời response profile Alpha và public search pending, logout/login Beta thật, thông báo thay đổi phiên qua BroadcastChannel như client hiện hữu và revalidate. Sau release, UI riêng tư chỉ có Beta, URL/public provider vẫn đúng. Ca logout dùng nút UI thật; private endpoint sau logout trả 401, không còn Alpha trong UI. Đây là smoke phần search tương tác với phiên, không thay cho QA toàn bộ refresh/concurrency của cụm trước.

Fixture bao gồm provider APPROVED/PENDING/REJECTED/SUSPENDED, category/service inactive, provider không dịch vụ, 25 dịch vụ, category/provider/service ID trên MAX_SAFE_INTEGER, literal `%`, `_`, backslash/Unicode, giá 0/299999.99/300000, slot bookable/full/closed/past/ngoài working hours. Fixture tạm cho dataset/category/slot đều có finally restore. 429 dùng counter fixture trên DB QA; 503 dùng lỗi DB limiter có chủ đích và khôi phục schema. Hai lỗi này là response thật từ API với precondition lỗi được inject, không phải route mock.

## Giới hạn contract và phần không tuyên bố

- `available` chưa có contract provider/service search: disabled và giải thích; URL có điều kiện này không mở rộng kết quả âm thầm.
- API QA thực tế: `Tắm` trả 7 provider, `Tam` trả 0. Không sửa backend hoặc hứa tương đương không dấu/có dấu.
- Provider price sort dùng giá nhỏ nhất của offer phù hợp; không có representative service trong response. Keyword/offer filters có thể khớp dịch vụ khác nhau. FE hiển thị provider/tổng hợp đúng nghĩa này.
- Count/items và các trang không phải snapshot transaction xuyên request. Dataset đổi có thể làm tổng đổi; FE tránh vòng clamp/refetch, không tạo bảo đảm backend chưa có.
- Booking API, ảnh/contact/hours/eligibility chưa có contract public, GPS, Provider Header/notifications nằm ngoài phạm vi. Không thêm SkillUI/Supabase/animation/dependency.
- Browser là Chromium production tại ba kích thước yêu cầu; Safari/Firefox/thiết bị vật lý và screen reader audit đầy đủ chưa kiểm trong lượt này. Cloudflare Siteverify thật và deployment ingress/HTTPS/CORS thật chưa được chứng minh bởi simulator/local QA.

## Tái hiện và review

1. Đọc diff giới hạn, manifest bước 2/bước 3 và case ledger trong bundle. Manifest hash 470 file runtime/test, loại docs/Markdown/generated để tránh tự tham chiếu.
2. Tại Web worktree chạy `node scripts/test-search.mjs`, `npm run lint`, `npx tsc --noEmit`, `npm run build` với public API URL đúng môi trường, `git diff --check`. Không sửa generated bằng tay; trên bản clone sạch cần `.next/types` (từ `npm run build` hoặc `npx next typegen`) trước khi chạy `npx tsc --noEmit`. Liên kết manifest cuối: [FE-029-051-search-step3-manifest.json](FE-029-051-search-step3-manifest.json).
3. Bundle ngoài repo `QA-search-api-reliability-step3-20261125` giữ kết quả JSON, log đạt/thất bại, screenshot và thư mục `reproduce/`. README trong bundle có các biến đường dẫn, guard DB QA, setup/biên dịch/runtime và thứ tự script. Không đưa config.json/key/token/.env hoặc API log private vào bundle.
4. Chuẩn bị API checkout đúng SHA, PostgreSQL QA mới và browser đã cài. BFF schema chỉ chạy trên DB mới đã guard; không dùng DB đang phục vụ người khác, không destructive reset. Seed fixture và chạy API trước browser. Runtime limiter bật; QA có override budget để phục vụ ma trận, ca 429/503 có setup lỗi riêng được ghi rõ.
5. Chạy browser tuần tự. Với `QA_RESUME`, chỉ kế thừa case đã pass khi source và phần bị ảnh hưởng còn hợp lệ; bỏ kết quả/resume khi đổi source có liên quan. Sửa xong đối chiếu implementation ↔ snapshot rồi kiểm lại nhóm bị ảnh hưởng.

## Bàn giao bước 4

Đủ điều kiện bàn giao cụm theo phạm vi đã chốt và các giới hạn công khai trên. Bước 4 phải fetch/xác minh lại #24/dev/API, rà diff/manifest/secrets và bàn giao cộng dồn đúng ancestry. Không force-push, mở PR trùng hoặc merge trong bước 3. Không coi các mục ngoài phạm vi là đã nghiệm thu; không cập nhật sheet hay nhắn người khác ở lượt này.
