# FE-015 + FE-016 + FE-017 — Dashboard QA và regression bản ghép

Ngày thực hiện: **03/11/2026, Asia/Ho_Chi_Minh**. Bước **2–3/4 hoàn thành** trong phạm vi UI/mock Provider, Admin và Staff. Đủ điều kiện chuyển bước 4 bàn giao chung; chưa stage/commit/push/PR/merge hoặc cập nhật bảng task.

## Phiên bản và phạm vi

- Worktree: `/Users/tom/Desktop/PawFlow/PawFlow-Dashboard-QA`.
- Branch: `FE-015-dashboard-qa`; HEAD/nền `origin/dev`: **`b70d18b14c82cae036cd0d3f6c0bb69f47b421c5`**. Fetch lại đầu lượt; dev không đổi so với bước 1.
- Nền đã có PR #13 Provider, #14 Admin và #15 Staff. Không merge/cherry-pick Customer; `/account` và `/account/pets` không có trong bản này.
- Đã đọc AGENTS trong QA và quy tắc riêng tại workspace gốc, báo cáo bước 1, tài liệu FE-013/014/015, source liên quan và tài liệu Next cài trong QA về layout/Link/scroll/usePathname/CSS.
- Không phát hiện lỗi ứng dụng cần sửa trong các ca thực chạy dưới đây. **Không sửa source ứng dụng, CSS, layout hoặc shared component.** File mới duy nhất trong repo là tài liệu này.
- Tất cả kết quả đạt dưới đây chạy mới trong lượt này trên bản ghép. Không lấy số PASS trong báo cáo QA cũ thiếu artifact làm kết quả của dev hiện tại.

## Kết luận theo task

| Task | Kết quả bước 2–3 | Giới hạn/phần còn lại |
| --- | --- | --- |
| FE-015 | **Đạt** responsive/overflow/keyboard/route của ba role hiện có trên dev. | Phạm vi Chromium và UI/mock; không bao gồm Customer chưa merge hoặc phân quyền server. |
| FE-016 | **Đạt** visual trong phạm vi đối chiếu Figma chính + thay đổi UI đã chốt; hover/focus/disabled/loading/empty/error ở nơi đã triển khai. | Không phải chứng nhận WCAG toàn diện; chưa screen reader/thiết bị thật/Safari/Firefox. Giữ Admin chỉ đọc/KPI chờ chốt. |
| FE-017 | **Đạt phần validation và regression bản cuối**: lint/typecheck/build, logic và browser. | Commit/push/PR/review/merge chưa thực hiện theo chỉ đạo; không đánh dấu hoàn tất toàn bộ task hoặc cập nhật bảng. |

## Môi trường và kiểm tra lệnh

Production build ID: **`bTZd0HKnYcSZFIcWPfzDk`**. Server do lượt này tạo trên cổng trống **3022**, process **20371**, cwd worktree QA; executable Node server được đối chiếu bằng lsof là `/opt/homebrew/Cellar/node/25.1.0_1/bin/node` (**v25.1.0**, npm CLI **11.6.2**). Next **16.3.8**, React **19.2.8**, TypeScript **5.9.3**.

Browser: Playwright **1.60.0** đã có trong npm cache, Chromium **148.0.7778.96**, headless. Không cài dependency/config vào app. Máy còn có Node 22.19.0; helper chốt metadata/hash báo Node 22, được ghi riêng trong runtime.json, không dùng kết quả helper đó để suy phiên bản Node của server/build.

| Lệnh/kiểm tra thực chạy | Kết quả |
| --- | --- |
| `npm run lint` | Exit 0. |
| `npx tsc --noEmit --incremental false` trước build đầu tiên | Exit 2: `src/app/layout.tsx` thiếu global `LayoutProps` vì worktree mới chưa sinh Next route types. Không sửa source hoặc generated file thủ công. |
| `npm run build` | Exit 0; Next sinh route types, TypeScript đạt, build đủ 15 màn + Staff redirect và các route public có sẵn. |
| `npx tsc --noEmit --incremental false` sau build | Exit 0. Đây là kết quả typecheck cuối. |
| Biên dịch strict 9 file `src/features/**/*.test.ts` ra ngoài repo, rồi Node test runner | **130/130 đạt**, 0 fail/skip: Provider 99, Admin 7, Staff 24. Dùng `/opt/homebrew/bin/node` để gọi TypeScript/Node runner. |
| Production process + HTTP | lsof xác nhận cwd/port/executable; HEAD `/dashboard` trả **200**. |
| `git diff --check` cuối lượt | Exit 0; index trống. |

Các lệnh đạt của lượt này được dùng lại khi chốt regression vì **243 file source/asset/package/config liên quan không đổi** trong toàn bộ lượt; sau kiểm tra chỉ thêm Markdown. Không tuyên bố đã chạy lại lint/build cho một thay đổi TypeScript không tồn tại.

## Ma trận route × viewport thực chạy

D = **1440×1000**, T = **768×1024**, M = **390×844**, zoom 100%. “Đạt” mỗi màn gồm shell/scroll/assets; modal và keyboard/focus; direct URL/reload/Back/Forward. Luồng riêng được chạy thêm trong bảng phía sau.

| Role | Route | D | T | M | Luồng riêng đã kiểm tra |
| --- | --- | --- | --- | --- | --- |
| Provider | `/dashboard` | Đạt | Đạt | Đạt | Kỳ sai/kỳ rỗng; Xem yêu cầu cuộn/focus preview; Xem tất cả → pendingConfirmation; modal preview. |
| Provider | `/dashboard/bookings` | Đạt | Đạt | Đạt | Sáu status, search/URL/fallback, giữ query khác/hash, giữ state khi đổi query, năm thao tác Owner, audit/error/retry/reset. |
| Provider | `/dashboard/availability` | Đạt | Đạt | Đạt | Slot, sức chứa, giữ chỗ/lịch sử, giờ tuần/ngày hiệu lực, ngoại lệ/xung đột/fallback, lỗi/retry/rỗng/reset. |
| Provider | `/dashboard/services` | Đạt | Đạt | Đạt | Form/danh mục/Enter, validation, thời lượng ngày khóa, conflict, ẩn/hiện lại, text dài, lỗi/retry/rỗng/reset. |
| Provider | `/dashboard/customers` | Đạt | Đạt | Đạt | Search, nhóm/kỳ sai và rỗng, profile/pet/lịch sử, rỗng/reset. |
| Provider | `/dashboard/notifications` | Đạt | Đạt | Đạt | Filter, open/read/read-all, lỗi open/bulk/load và retry, fallback focus, nội dung dài, rỗng/reload. |
| Provider | `/dashboard/profile` | Đạt | Đạt | Đạt | Form thông tin/liên hệ, validation/focus, draft/Cancel/save-error/retry, ảnh signature/decode/save/cancel/reload. |
| Admin | `/admin` | Đạt | Đạt | Đạt | Pending detail, loading/error/retry/empty/reset; giữ KPI — và chart chờ chốt. |
| Admin | `/admin/providers` | Đạt | Đạt | Đạt | Search/filter/detail; dialog Quy trình duyệt; mock states; approve/reject khóa. |
| Admin | `/admin/users` | Đạt | Đạt | Đạt | Search/filter/detail; dialog Quyền truy cập; mock states; lock/unlock khóa. |
| Admin | `/admin/categories` | Đạt | Đạt | Đạt | Search/filter/detail/mock states; Thêm danh mục và sửa/ẩn khóa. |
| Admin | `/admin/reviews` | Đạt | Đạt | Đạt | Search/filter/detail; dialog Quy tắc; mock states; moderation khóa. |
| Admin | `/admin/complaints` | Đạt | Đạt | Đạt | Search/filter/detail; dialog Quy trình; mock states; mutation khóa. |
| Admin | `/admin/activity-logs` | Đạt | Đạt | Đạt | Search/tag/date sai/xóa lọc/detail; mock states. Biên ngày kiểm tra thêm trong logic hiện tại. |
| Staff | `/staff/bookings` | Đạt | Đạt | Đạt | Search/filter, bốn action, thời gian/snapshot/lý do/xác nhận thực tế, processing/audit/error/retry/empty/reset/quyền. |
| Staff | `/staff` | Đạt | Đạt | Đạt | Redirect `/staff/bookings`, không vòng lặp; kết hợp reload/Back/Forward. |

Ngoài direct/reload/history từng màn, đã đi qua **đủ bảy route Provider và bảy route Admin sau cuộn sâu** tại cả D/T/M: main của màn đích về scrollTop 0, h1 không bị che. Không tái hiện vấn đề scroll Provider từng được nêu là điểm cần xác minh ở bước 1; không sửa layout để phòng ngừa một lỗi chưa xảy ra.

## Browser regression mới — nhóm script và kết quả

“Nhóm” là một kịch bản có nhiều assertion; không phải số test case đơn lẻ. Tổng **289/289 nhóm browser đạt**, cộng một kiểm tra riêng ô clock Staff mobile. Cả năm suite cuối đều có **0 page error, 0 console error**.

| Artifact/script | Nhóm đạt | Nội dung |
| --- | --- | --- |
| `routes.cjs` → `routes-final/results.json` | **141/141** | 45 màn×viewport × 3 nhóm shell/modal/history = 135; thêm 6 nhóm đi vòng Provider/Admin sau cuộn sâu. Ảnh đầu/cuối main, modal và modal-end; visible image decode, font, active, overflow, focus/Tab/Shift+Tab/Esc/trả focus. |
| `flows.cjs` → `flows-final/results.json` | **84/84** | 28 nhóm tại mỗi D/T/M: luồng Overview, Bookings, Availability, Services, Customers, Notifications, Profile; mock states đủ bảy Admin; mutation/clock/audit/error/reset Staff. |
| `supplement.cjs` → `supplement-final/results.json` | **28/28** | 9 shell ở 1920×1080, 1024×600, 1280×600; 9 menu ở 768×1024, 390×844, 390×250; 5 bảng mobile cuộn bằng keyboard; 4 Admin info dialog; hover/focus/loading. |
| `dialogs.cjs` → `dialogs/results.json` | **18/18** | Sáu modal/form tại D/T/M: giờ tuần dài, ngoại lệ, danh mục mở rộng, Profile có ảnh, Staff lý do dài/xác nhận thực tế, thông báo dài. Tab và Shift+Tab qua đủ vòng control hiển thị, tới nút cuối và Esc. |
| `edges.cjs` → `edges-final/results.json` | **18/18** | Owner pending/nhấp đôi/audit/xác nhận thực tế; thêm/sửa/xóa ngoại lệ và fallback giờ Chủ Nhật; ngày dịch vụ giữ nguyên; notification bulk-error/focus/reload; contact validation/normalize; Staff mutation dưới filter và trả focus khi hàng mất. |
| `clock-check.json`, `staff-clock-mobile.png` | **1/1** | Ô datetime-local Staff tại 390×844 rộng ít nhất 240px, giá trị đúng `2026-10-21T08:00`; cuộn tới và xem ảnh trực tiếp. |

### Luồng quan trọng đã thực chạy

- **Bookings Provider:** Confirm/Reject/Cancel/Completed/No-show thành công; hủy lý do trắng bị chặn; Completed yêu cầu xác nhận thực tế; nhấp đôi xác nhận chỉ có một log; Esc lúc pending không đóng; lỗi không đổi status và thử lại được. URL status/q giữ query khác + fragment; invalid status về All; Back và reload theo quy tắc mock. Không áp quy tắc giờ Confirm Staff sang Owner.
- **Availability:** tạo Spa liền kề 15/10 15:30–16:30, sai thời lượng/lỗi save và retry; slot-4 giữ 2 chỗ khóa trường/destructive và chặn sức chứa 1; slot lịch sử chỉ đọc; đóng/mở/xóa slot-6. Đóng Thứ Sáu từ 15/10 liệt kê xung đột, từ 22/10 lưu; ngoại lệ 15/10 chặn vì slot-4. Ngoại lệ Chủ Nhật 18/10 với giờ 09:00–12:00 cho tạo slot; sửa giờ đến 10:00 hợp lệ; chưa được xóa ngoại lệ khi fallback đóng cửa làm slot sai; xóa slot rồi xóa ngoại lệ được. Không tự chuyển booking.
- **Services:** tạo và chọn danh mục bằng Enter không submit dịch vụ; tên trắng/giá âm bị chặn, lỗi giữ draft và retry; tạo tên/description dài không tràn main. Đổi Grooming 90→60 chặn và nêu MOCK-SLOT-2; ẩn/hiện lại dùng xác nhận. “1 ngày” vẫn khóa/giữ nguyên, không tự quy đổi.
- **Customers:** C01 mở đúng profile có pet/lịch sử; kỳ ngược báo lỗi; tháng 11 nhóm Quay lại rỗng nhưng All vẫn có 8 khách; empty/reset đúng. Không sửa thông tin khách/pet hoặc giả đồng bộ module.
- **Notifications:** mở NOT-001 lỗi rồi retry đúng lệnh, hiện PF-2084 và chưa đọc 3→2; mở dưới filter Chưa đọc làm hàng mất thì đóng trả focus tiêu đề. Bulk lỗi giữ số 2, retry về 0; load error/retry, empty, nội dung NOT-004 dài, reload khôi phục 3. Mã booking chỉ tham chiếu, không bổ sung deep link hoặc đồng bộ Header bell.
- **Profile:** tên trắng báo aria-invalid và trả focus trường lỗi; Cancel không đổi bản lưu; save-error giữ draft, retry cập nhật, reload khôi phục. Phone/email sai báo hai lỗi; `+84 912-345-678` normalize thành `+84912345678`; Approved giữ nguyên. File giả PNG bị chặn; PNG hợp lệ decode được; chọn ảnh rồi Cancel không áp dụng, Save mới có blob preview, reload mất ảnh đúng mock. Các biên dung lượng/signature/allowlist và bất biến còn được kiểm tra bởi test logic mới của lượt này.
- **Admin:** tìm không dấu, mọi filter, search rỗng/xóa lọc, detail đúng bản ghi, date ngược báo lỗi, loading/error/retry/empty/reset, các dialog thông tin và disabled. Không viết mutation, log giả hoặc KPI.
- **Staff:** bốn action thành công; Reject lý do trắng, Completed/No-show thiếu xác nhận bị chặn; No-show cần cả lý do. PF-2084 Confirm trước 09:00; đúng 09:00 Confirm khóa, No-show mở; Completed chưa mở trước 10:30 và mở đúng 10:30; PF-2082 thiếu snapshot vẫn khóa Completed khi clock đã sang 23/10. Terminal chỉ đọc, pending khóa đóng và gửi tiếp; lỗi không đổi booking, retry được; load/retry giữ status/log; empty/reset về tám fixture, log/clock mặc định; hàng mất dưới filter thì trả focus search. Lý do dài không tràn main/audit. Logic/session tests kiểm tra thêm biên 1ms, context/scope/stale/duplicate; không gọi đó là kiểm thử auth server.

## Responsive và visual

Số đo **thực tế trong lượt này**, giống nhau ở cả ba role:

| Viewport | Header | Lề workspace | Workspace | Sidebar | Main |
| --- | --- | --- | --- | --- | --- |
| 1440×1000 | 68px | 32px | 1376px | 285px | 1031×844px |
| 768×1024 | 68px | 24px | 720px | Ẩn | 680×884px |
| 390×844 | 68px | 16px | 358px | Ẩn | 318×704px |
| 1920×1080, shell đại diện mỗi role | 68px | 32px | 1856px | 285px | Mở rộng theo viewport |

- Main cuộn riêng; Header/Sidebar đứng yên, wheel cuối main không cuộn trang. Bảng có overflow riêng, cuộn keyboard tới cột cuối; trang và main không tràn ngang trong các ca đo.
- Active nằm trong Sidebar 285px. 1024/1280px chiều cao 600px vẫn tới mục menu cuối; menu 390×250 cuộn tới link cuối, Esc/cùng route/click ngoài/blur đóng đúng, focus không nằm trong link ẩn. Giữ breakpoint/navigation riêng đã có của từng role.
- Đã xem contact sheet đầu/cuối/modal của đủ Provider/Admin D/T/M, ảnh Staff đầu/cuối/modal D/T/M; xem riêng form dài, Profile mobile, lý do dài, menu thấp, shell 1920 và clock Staff. Đây là review thủ công từ screenshot của script, không phải lượt thao tác tay độc lập.
- Font computed là **Be Vietnam Pro**; giữ semantic tokens hiện có, icon/status và các trạng thái hover/focus/disabled. Không thêm animation/Animate UI hoặc thay font/token hàng loạt. Chưa đo contrast mọi control hay chứng nhận WCAG toàn diện.

Nguồn visual là [Figma chính — Website → PawFlow → Dashboard](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4620-30912), không Archive. Đọc lại screenshot sáu màn con Provider và sáu màn con Admin trong lượt này; ảnh đại diện Overview Provider/Admin và Staff có artifact từ bước 1 cùng ngày. Node: Provider `4620:32192`, `4664:14648`, `4664:14961`, `4667:14620`, `4664:15255`, `4664:15566`, `4664:15846`; Admin `4695:14683`, `4695:15111`, `4695:15509`, `4695:15876`, `4695:16258`, `4695:16655`, `4695:17025`; Staff `5023:3532`.

Ưu tiên quyết định đã chốt khi khác ảnh cũ: Header 68 thay 120px, lề desktop 32 thay 100px, shell mở rộng thay max-width 1240px; Sidebar 285px và active nằm gọn; avatar/icon/menu đã thống nhất; số liệu tính từ mock theo từng module thay số minh họa Figma. Admin KPI **—**, chart chưa có series và thao tác disabled là phạm vi chỉ đọc, không là bug cần triển khai. Staff Completed theo giờ kết thúc snapshot, không theo diễn giải cũ “từ giờ hẹn”.

## Lỗi và thay đổi

| Phân loại | Ghi nhận/xử lý | File source ứng dụng |
| --- | --- | --- |
| Lỗi ứng dụng tái hiện được | **Không ghi nhận lỗi cần sửa trong phạm vi thực chạy.** Không sửa phòng ngừa hoặc mở tính năng mới. | Không có. |
| Typecheck môi trường mới | LayoutProps chưa sinh trước build; chạy build chuẩn rồi typecheck đạt. | Không sửa. |
| Script QA | Sửa wait decode ảnh/RAF focus, giới hạn selector khỏi route announcer/logo trùng link, chọn đúng nhãn action/field/submit đổi theo lỗi và đúng số kết quả fixture; dùng keyboard thực để đo focus-visible, click ngoài vùng menu. Chạy lại các suite cuối đều đạt. | Chỉ script ngoài repo; không sửa app để né assertion. |
| Tài liệu | Thêm ma trận, kết quả mới, giới hạn, hash và bàn giao của cụm. | `docs/FE-015-016-017-dashboard-qa.md` mới. |

## Hash cuối, bằng chứng và tái chạy

SHA-256 aggregate source cuối (243 file):

**`db7e9ab8b8c89d51d8252864ee21d24d1af3d2e0cc67305dcbaee12bf4e8cd20`**

Tập hash: các file tracked dưới `src/`, `public/` và package.json/package-lock.json/tsconfig.json/next.config.ts/eslint.config.mjs/postcss.config.mjs nếu có. Sắp path tương đối, nối `path + NUL + SHA256(file bytes) + LF`, rồi SHA256 toàn chuỗi. Loại Markdown, generated, node_modules và artifact. So sánh trước/sau: **0 file source thay đổi**. `source-final.json` ghi đầy đủ manifest; hash độc lập nội dung tài liệu này.

Artifact ngoài repo:

- Bản làm việc: `/tmp/pawflow-dashboard-qa-20261103/` (giữ cả log các lần script chưa đạt để phân biệt lỗi harness).
- Bundle bằng chứng cuối được sao lưu: `/Users/tom/Desktop/PawFlow-Dashboard-QA-Evidence-20261103/` — các script, raw result cuối, ảnh/contact sheet, log lint/typecheck/build/130 logic tests, source manifest, server/HTTP và snapshot bảo toàn; không đưa vào commit.
- Tham chiếu khảo sát: `/Users/tom/Desktop/PawFlow-Dashboard-QA-Survey-20261103/`.

Tái chạy bằng toolchain hiện có: từ worktree QA chạy lint → build nếu cần sinh route types → `npx tsc --noEmit --incremental false`; chỉ start production ở cổng còn trống. Các browser script dùng Playwright từ `/Users/tom/.npm/_npx/420ff84f11983ee5/node_modules/playwright`, phiên bản 1.60.0; đây là cache ngoài repo, không phải dependency app. `node <bundle>/routes.cjs`, tương tự flows/supplement/dialogs/edges; script mặc định ghi artifact dưới `/tmp`, dùng server 127.0.0.1:3022. Nếu cache/port thay đổi, chỉnh harness ngoài repo và ghi phiên bản mới, không sửa app config.

## Bảo toàn và giới hạn bàn giao

- Bốn worktree cũ giữ nguyên branch/HEAD/status/diff. PawFlow-Web vẫn FE-015/9e4bdb1, có đúng AGENTS.md và layout Provider sửa riêng; không mang hai diff sang QA. AGENTS riêng giữ SHA-256 `9eb0f3f7656ff2b86179fcc62c682adfe8c0747337a00e857b83128774a7ead1`; layout riêng giữ `417d49cc496b3d190d06a93794c26558fa7a33e6cb871d31ef5d25414d68694f`.
- Ba stash, 25 file backup/workspace metadata đã đối chiếu không đổi. Không mở/lưu/bỏ buffer editor và không tuyên bố đã đọc nội dung RAM của buffer chưa lưu.
- QA chỉ thêm Markdown này, index trống; không stage/commit/push/PR/merge hoặc cập nhật bảng task. Không sửa auth/API/Customer, dependency/config hay file generated thủ công.
- **Chưa kiểm tra** Safari/Firefox, thiết bị thật, screen reader thật, API/backend/auth/RBAC thật, upload/lưu bền vững/realtime. Client filtering/logic mock không phải ranh giới bảo mật. State reset theo mount/reload và mock độc lập liên module tiếp tục là giới hạn đã biết.
- Không có câu hỏi nghiệp vụ hoặc lỗi UI đã tái hiện đang chặn bước 4. Bước 4 cần kiểm tra lại HEAD/status và source hash, review tài liệu/diff, rồi chỉ stage/commit/push/tạo PR chung khi được giao; PR review/merge vẫn chưa thực hiện. Nếu source đổi sau hash này phải đánh giá lại nhóm QA chịu ảnh hưởng.

URL local bản đã kiểm tra: [Provider](http://127.0.0.1:3022/dashboard), [Admin](http://127.0.0.1:3022/admin), [Staff](http://127.0.0.1:3022/staff/bookings).
