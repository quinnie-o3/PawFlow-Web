# FE-029 / FE-051 — Bước 2/4: Search API và độ tin cậy

Ngày: 25/11/2026, Asia/Ho_Chi_Minh. Chỉ triển khai và kiểm chứng hẹp bước 2; chưa hoàn thành ma trận QA bước 3, chưa commit/push/PR/merge hoặc cập nhật task sheet.

## Nền và yêu cầu

- Web base/HEAD: `e67ff5c2498019a059a72fec4bd7e44cf3724c6b`, remote head đã fetch/xác minh của PR #24 còn mở, base `dev` tại `9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`. Ancestry dev → head đạt.
- Nhánh `search-api-reliability`, worktree `PawFlow-Search-API-Reliability`; không đổi worktree/branch cũ.
- API origin/dev: `2eda6ba6f312653819b33c317d17de8635588aa3`. Dùng source đã đối chiếu 386 file tracked; biên dịch runtime QA vào thư mục riêng, không sửa backend.
- Giữ Sidebar, Booking/Inbox demo, typed transport/query cache, BFF/private session và Turnstile kế thừa.

Nguồn: [Tasks](https://docs.google.com/spreadsheets/d/19O0xVgFa4m1sR23Cjia_vQ7j_mAOWkBW2JJDNjjPXuA/edit#gid=1001), đã đọc ở bước 1; không dùng trạng thái trên sheet thay cho bằng chứng source/QA.

| Task | Task nguyên văn | Dependency nguyên văn | Deliverable nguyên văn |
| --- | --- | --- | --- |
| FE-029 | Search API integration + query performance UX | FE-027 | Filter/sort/page; debounce+abort; race tests; cache policy |
| FE-051 | Debounce/abort/race/URL-state E2E + pagination/sort tests | FE-020; FE-029 | Only newest results; filters persist |

Các kiểm thử dưới đây là tiêu chí triển khai đề xuất từ deliverable và chỉ dẫn người dùng; không phải yêu cầu mới được ghi vào sheet.

## Hành vi triển khai

Discovery/Provider Detail mặc định lấy public API thật. Transport hiện hữu gọi trực tiếp bằng `NEXT_PUBLIC_API_URL`, `credentials: omit`, không Authorization. Không dùng `bffRequest` hay chờ BFF bootstrap; API/BFF session lỗi không đổi sang dữ liệu mẫu. API phải truy cập được từ browser và CORS phải cho phép đúng origin Web. Biến public này được Next nhúng khi build; thay endpoint cần build lại.

Catalog demo chỉ mở bằng `catalog=demo` duy nhất trong URL. Card, Detail và returnTo của demo giữ marker này. Inbox mock xác minh target bằng catalog mẫu và tạo link `catalog=demo&fromInbox=...` bằng URLSearchParams. Không suy ra nguồn bằng ID. Link chuyển sang dữ liệu thật đi về danh sách, không dùng lại provider ID mẫu.

Detail thật không mount BookingPanel mock, không tạo booking hoặc báo thành công; có thông báo tại điểm đặt lịch. Code Booking submission/receipt/reconcile và logic Inbox read/read-all/badge không đổi. Persona của demo không được dùng để suy ra trạng thái đăng nhập của UI public. Private cache/session implementation không đổi.

| UI / URL | Request / contract |
| --- | --- |
| q | Trim; giữ dấu, không accent-fold. ≤100 Unicode characters, ≤8 từ phân biệt không xét hoa/thường; không ký tự điều khiển. API AND các từ, OR giữa các trường cho mỗi từ. |
| categoryId | ID BIGINT string từ category ACTIVE thật; slug bath/groom/boarding không được đoán thành ID. |
| location | Substring của address, ≤100 ký tự. area cũ q1/q3/phunhuan/q7 có mapping theo nhãn khu vực; có thông báo chuẩn hóa. Không GPS/gần tôi. |
| maxPrice | UI là giá dưới ngưỡng. 300000 → API maxPrice=299999.99; 0 → tập rỗng hợp lệ tại FE, không gửi giá âm. |
| minRating | API inclusive 0–5, tối đa hai chữ số thập phân. |
| sort | newest/rating_desc/price_asc/price_desc. Alias fixture/rating-desc/price-asc/price-desc được chuyển tường minh. Server giữ thứ tự và total; FE không sort/filter cả catalog. |
| page / limit | 1–1000; Discovery limit=4. Dịch vụ/lịch Detail limit=20 và phân trang riêng; tối đa năm nút số trang. |
| available | Control public disabled và giải thích thiếu contract. URL có tham số này chặn provider request cho tới khi người dùng chủ động bỏ điều kiện. |
| query không hợp lệ/trùng | Giữ điều kiện để sửa; không âm thầm trả tập rộng hơn. Cho phép thao tác giữ giá trị đầu của tham số trùng một cách tường minh. Tham số không hỗ trợ được loại với thông báo. |
| returnTo | Chỉ internal /discover, canonical query; không nhận URL bên ngoài hoặc chuyển từ live sang demo. |

Provider card dùng businessName/address/description/ratingCount/ratingAvg/serviceCount/minPrice/maxPrice. Không dựng representative service ID/name/duration. Price sort của API provider dùng giá thấp nhất trong nhóm offer đã lọc ở cả hai chiều. Keyword và offer filters có thể khớp các dịch vụ khác nhau trong cùng provider; không tuyên bố một dịch vụ đại diện khớp mọi điều kiện.

ID luôn là string; NUMERIC giữ string, null không đổi thành 0; meta và normalized query echo phải khớp request. Decoder tạo projection biết trước, từ chối shape/type/ID/ownership/meta sai. Không dùng ảnh, giờ mở cửa, phone hoặc eligibility từ fixture để điền dữ liệu thật. Ảnh cơ sở/dịch vụ dùng placeholder sẵn có; ảnh đối tác mẫu trong hero chỉ có ở demo, tài sản trang trí giữ thiết kế; provider không dịch vụ vẫn hiển thị.

Endpoint GET public sử dụng: `/service-categories`, `/providers/public/search`, `/providers/public/:id`, `/services/public/search?providerId=...`, `/services/public/:id`, `/availability/public/search?providerId=...&serviceId=...`. Không có endpoint mới, không dùng Booking API. Dịch vụ được chỉ định qua deep link có request detail độc lập và phải thuộc đúng provider, kể cả ngoài trang dịch vụ đầu. Availability chỉ đọc, không giữ chỗ; ngày/giờ là Asia/Ho_Chi_Minh, không dùng đồng hồ fixture.

## Race, cache và lỗi

- Debounce 350 ms, hoãn dispatch trong IME composition. Filter/sort/query đổi reset page; không cho pagination làm mất search draft.
- Native push/replace history tích hợp useSearchParams theo tài liệu Next cục bộ. Search replace; điều kiện/page push; Back/Forward hủy draft/timer. Page quá cuối được replace/refetch tối đa một lần cho một bộ tiêu chí trong lần mount, kể cả tổng 0; không lặp khi tổng tiếp tục đổi.
- AbortSignal đi xuyên fetch/body/decode. PublicRequest kiểm cancellation, owner generation và current key trước khi ghi cache; layout cleanup/unmount chặn late response. Promise race bảo đảm timeout/cancel vẫn kết thúc khi loader không hợp tác.
- Public cache là instance riêng, dùng QueryCache foundation với public scope tường minh, không mở anonymous writes cho private cache. Key chứa version/public/live/resource/canonical wire query (gồm filter/sort/page/limit); không storage/server singleton. Freshness 30 giây, capacity 100; availability không cache (freshness 0).
- Retry chủ động invalidate key hiện tại; chỉ response decoder hợp lệ được cache. Không tự retry. Timeout 8 giây phân biệt cancellation chủ động. Rate limit dùng Retry-After; adapter public giữ cả cooldown dài hơn cap 15 phút của transport dùng chung, không sửa private policy.
- Feedback: loading, empty, validation, 404, network/offline, timeout, invalid-response, 429 và 503. Retry giữ URL/điều kiện; không đổi lỗi thành empty hoặc mock.
- Filter dialog dùng native modal, label, focus/restore, Esc và scroll lock. Paging bằng keyboard đưa focus về tiêu đề kết quả nếu nút cũ bị tháo và người dùng chưa chuyển focus.

## Kiểm chứng bước 2

- `node scripts/test-search.mjs`: 63/63 đạt. Gồm 13 test public mới và 50 test hẹp kế thừa cho query/mock catalog, Inbox, Booking workspace và session client isolation. Đây không phải chạy lại toàn bộ QA cụm trước.
- `npm run lint`, `npx tsc --noEmit`, production `npm run build`: đạt. `next typegen` được dùng để tạo route types trong worktree mới; không sửa file generated bằng tay.
- API QA thật: database riêng được tạo mới; áp dụng 17 migration hiện hữu chỉ trên DB QA đó. Có 9 provider (8 public, một suspended), provider không dịch vụ, category/service inactive, 25 dịch vụ ở một provider, dịch vụ deep link ngoài trang đầu, giá 0/300000, slot tương lai. Không sửa DB cũ hoặc source API.
- 8 nhóm API thật: paging/totals/ties/visibility; category/service detail/ownership; giá; availability; trang quá cuối/zero pages; validation/404; tiếng Việt; CORS/headers.
- PostgreSQL/API QA quan sát `Tắm` có 7 provider, `Tam` có 0. Không khẳng định accent-insensitive search.
- Production Chromium: 10 nhóm, gồm Discovery/Detail/filter/keyboard/overflow tại 1440×1000, 768×1024, 390×844; URL/reload/history; debounce/IME; available/duplicate; clamp/zero price; deep link/no services; provenance; public credential omission. Không có pageerror.
- 6 nhóm browser inject riêng: đảo response/cache; 429; 503; malformed response; timeout 8 giây thật ở client; offline/manual retry. Success payload của ca đảo response đến từ API thật; thời điểm/lỗi là inject, không phải hành vi lỗi của backend thật.
- 2 nhóm hồi quy mock UI: Inbox provider source/fromInbox/backlink; Booking lỗi trước tạo → retry double-click/native-submit, một booking và cùng receipt/list/detail ID. Session-view BFF được stub rõ để mở các màn demo; không coi đây là Auth/BFF API QA mới.

Harness/log/screenshot nằm trong bundle QA ngoài repository. Bản manifest runtime/test đi kèm ghi SHA mỗi file và fingerprint; runner dùng cách resolve path tương thích Node 20 cũ hơn; sau rà ảnh đã giới hạn ảnh đối tác/CTA Booking cũ trong hero cho demo, rồi chạy lại lint/typecheck/build và toàn bộ smoke hẹp; tài liệu không nằm trong fingerprint để tránh tự tham chiếu.

## Cấu hình QA — chỉ tên biến

Web public build: `NEXT_PUBLIC_API_URL`.

API QA: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL`, `JWT_SECRET`, `CORS_ORIGINS`, `FRONTEND_URL`, `TRUST_PROXY`, `API_RATE_LIMIT`, `AUTH_RATE_LIMIT`, `RATE_LIMIT_HASH_SECRET`, `TURNSTILE_MODE`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAMES`, `TURNSTILE_CHECK_ACTION`, `MAIL_TRANSPORT`, `MAIL_OUTBOX_DIR`.

BFF/private regression nếu chạy integration ở bước 3: `PAWFLOW_API_URL`, `BFF_APP_ORIGIN`, `BFF_DATABASE_URL`, `BFF_TOKEN_ENCRYPTION_KEY`, `BFF_TRUST_PROXY_HEADERS`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

Không commit giá trị secret, .env thật, dữ liệu private, log thô hoặc configuration QA cá nhân.

## Checklist bước 3

- [ ] QA production đầy đủ trên SHA/fingerprint chốt, ba viewport; keyboard paging/Back/Forward/IME, focus trong lúc response pending và menu mobile.
- [ ] Race nâng cao: rapid query/filter/sort/page, chuyển route/unmount, cache hit/expiry/invalidation/capacity, reload và session switch khi response/body pending.
- [ ] API thật bổ sung: các sort và ties, giới hạn keyword/location/numeric/BIGINT, category bị ẩn trong lúc đang mở, dataset đổi giữa count/items/trang, max page 1000.
- [ ] Runtime rate limit/Retry-After và unavailable trên QA riêng; tách kết quả API thật khỏi browser inject. Không tắt limiter cho production.
- [ ] Session integration thật với public request đồng thời; giữ nguyên private/logout/account-switch fences. Không suy ra từ session-view stub.
- [ ] Hồi quy hẹp Booking retry/double-click/Enter/receipt, Inbox arrival/read-all/badge/provenance; Sidebar smoke nếu phát hiện seam layout ảnh hưởng.
- [ ] Rà manifest, secret/diff boundary và dependency/config; ghi đúng các phần chưa nghiệm thu. Không mở rộng sang Booking API, Provider Header/notifications, GPS hoặc ảnh/eligibility chưa có contract.

Bước 4 sẽ fetch/xác minh lại #24/dev/API. #24 còn mở thì kế thừa head mới nhất đã kiểm ancestry và bàn giao cộng dồn bằng fast-forward phù hợp; nếu đã merge thì dùng dev mới nhất sau đối chiếu nội dung merge. Chưa commit/push/mở hoặc merge PR trong bước 2.
