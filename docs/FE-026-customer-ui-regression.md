# FE-026 — Booking retry: giữ vị trí nút gửi

Ngày kiểm tra: **17/11/2026, Asia/Ho_Chi_Minh**. Phần QA dưới đây ghi nhận kết quả bước 3/4, trước commit. Trạng thái bàn giao local ở bước 4 được ghi cuối biên bản. FE-025 và Auth còn chờ như ghi bên dưới.

## Nền và phạm vi

- Fetch đầu/cuối lượt cùng `origin/dev` **`9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`**, là merge [PR #23](https://github.com/quinnie-o3/PawFlow-Web/pull/23). Các commit Turnstile của Nhi (`ee61cb8`, head `545e0f6`) đã nằm trong nền.
- Không có worktree checkout `dev`, nên không thực hiện `git pull` trên các worktree cũ. Không có PR mở phù hợp để nối đợt; nhánh bàn giao Booking cũ đã merge. Tạo **`customer-ui-regression`** từ `origin/dev` tại worktree **`PawFlow-Customer-UI-Regression`**.
- Tại thời điểm QA bước 3, HEAD là SHA nền trên; kết quả dưới đây thuộc **source đã sửa nhưng chưa commit**. Hai file runtime được băm trước QA và xác nhận giữ nguyên sau QA; bước 4 đối chiếu lại trước khi commit.
- Chỉ thay `BookingPanel.tsx`, CSS riêng của Booking và biên bản này. Không thay model/workspace/contract/API, Auth, Customer/Provider Header hoặc Sidebar, shared dialog, dependency, lockfile hay config.

## Lỗi trước sửa và nguyên nhân

Route: `/providers/1?serviceId=101`. Đã tái hiện mới trên production baseline ở **1440×1000, 768×1024, 390×844**, cả ba đều thất bại theo cùng cách:

1. Mở công cụ dữ liệu mô phỏng, chọn Khách hàng mẫu và slot s2 lúc 14:00; kiểm tra lại yêu cầu.
2. Chọn tình huống “Lỗi trước khi tạo”, gửi và chờ thông báo lỗi.
3. Đổi tình huống về “Thành công”, double-click nút gửi lại với khoảng cách khoảng 50ms.
4. Click đầu trúng nút gửi. `store.submit` chuyển flow sang pending và xóa error; đoạn JSX có điều kiện bỏ cả phần tử thông báo lỗi khỏi DOM.
5. Cụm nút phía dưới dịch lên. Click thứ hai tại cùng tọa độ trúng link “← Đổi cơ sở”, chuyển sang `/discover`. Vào list bằng navigation thấy một booking đã tạo, nhưng người dùng không được thấy dialog thành công.

Guard của workspace vốn chỉ tạo một booking. Lỗi tương tác nằm ở việc thay đổi hình học form giữa hai click. Event trace trước sửa ghi rõ hai đích `BUTTON` rồi `A[href="/discover"]`; không suy luận nguyên nhân chỉ từ việc đổi URL.

## Thay đổi

- Khi bắt đầu gửi, form ghi nhớ nội dung lỗi đang hiện. Trong các trạng thái pending/unknown/reconciling, phần tử giữ nội dung đó để bảo toàn đúng chiều cao đã wrap theo viewport.
- Placeholder dùng `visibility: hidden`, `aria-hidden` và không có `role="alert"`; lỗi cũ không tiếp tục hiển thị hoặc được thông báo như lỗi hiện tại. Khi trạng thái đã kết thúc, chỗ giữ này được bỏ theo flow hiện có.
- Handler bỏ qua submit khi flow đang khóa hoặc đã thành công, giữ placeholder khi có thêm Enter/native submit. Guard đồng bộ của workspace tiếp tục bảo vệ việc tạo lịch.
- Link “Đổi cơ sở” giữ nguyên đích và hành vi. Không khóa navigation bằng timeout hoặc chặn mọi click lên link; đã kiểm người dùng chủ động bấm trước gửi và khi pending.
- Không thêm độ cao error cố định: text cũ tự giữ đúng kích thước, gồm lỗi nhiều dòng tại desktop/mobile.

## Kiểm thử trên bản runtime cuối

Production build riêng chạy tại `http://localhost:3047`, Chromium headless, locale `vi-VN`, timezone `Asia/Ho_Chi_Minh`. **22 ca có kết quả cuối đạt**, không có page error, console error hoặc request ra ngoài local trong các ca Booking này.

| Ca | 1440×1000 | 768×1024 | 390×844 |
| --- | --- | --- | --- |
| Gửi một lần bình thường; đúng ID, một record; dialog Tab/Shift+Tab/Esc và trả focus | Đạt | Đạt | Đạt |
| Lỗi trước tạo → retry bằng một click; đúng ID ở receipt/list/detail | Đạt | Đạt | Đạt |
| Lỗi trước tạo → double-click retry; giữ route/geometry, một record và đúng ID | Đạt | Đạt | Đạt |
| Lỗi trước tạo → 5 Enter + 4 native submit; giữ route/geometry, một record và đúng ID | Đạt | Đạt | Đạt |
| Timeout sau tạo → lookup lỗi giữ khóa → reconcile; một record và cùng ID | Đạt | Đạt | Đạt |
| Chủ động chọn “Đổi cơ sở” bằng bàn phím trước gửi; chuyển route, chưa tạo booking | Đạt | Đạt | Đạt |
| Chủ động bấm “Đổi cơ sở” khi pending; quay lại bằng navigation/Back và mở lại đúng receipt | Đạt | Đạt | Đạt |

Thêm **một ca mobile** với độ trễ mock 60ms và double-click retry đạt, tổng 22 ca. Các ca retry trả cùng ID giữa receipt/list/detail (PF-M0002 trong context mới); các ca gửi thường/timeout trả PF-M0001 trong context mới. Không giả định các ID này là ID backend.

- Vị trí nút gửi trước/sau bắt đầu retry có **deltaY = 0px** ở cả ba viewport, cho cả double-click và Enter lặp.
- Chiều cao error được bảo toàn: khoảng **67,59px / 46,80px / 67,59px** tương ứng desktop/tablet/mobile. Không còn click vào link `/discover` ngoài ý muốn.
- Đã đối chiếu `href` của receipt, URL detail, heading detail và record duy nhất ở list; kiểm trạng thái Chờ xác nhận. Detail/list và dialog không tràn ngang trong các ca đo.
- Các test đều dùng workspace mock Customer sẵn có. Đồng hồ mẫu vẫn 04/11/2026 10:00 UTC+7. Không gọi backend, không kết luận chống trùng phía server, persistence, thanh toán hoặc phân quyền thật.
- Lượt script đầu có hai lỗi ở bước **quay lại sau khi link Đổi cơ sở đã hoạt động**: script giả định menu Customer tablet/mobile có link Discovery. Đổi script sang Back để trở về Discovery và chạy lại riêng ca navigation ở cả ba viewport, đều đạt. Source ứng dụng không đổi giữa hai lượt. Kết quả cuối theo từng ca được hợp nhất; không tuyên bố toàn bộ 22 ca đạt trong một lượt script duy nhất.

| Kiểm tra kỹ thuật | Kết quả mới thực chạy |
| --- | --- |
| `npm run lint` | Đạt, exit 0 |
| `npx tsc --noEmit --incremental false` | Đạt, exit 0 ở lần chạy cuối |
| `npm run build` | Đạt, exit 0; artifact này được dùng QA production |
| Compile + `node --test` Booking core/submission/workspace | **70/70 đạt**, 0 fail |
| `git diff --check` | Đạt |

Lần gọi `npx` đầu trong sandbox dừng với `SecItemCopyMatching failed -50`, exit 139. Gọi trực tiếp compiler và chạy lại lệnh `npx` với quyền môi trường phù hợp đều exit 0; không thay source/config để xử lý lỗi môi trường. Chỉ thêm Markdown sau QA; hash hai file runtime cuối vẫn khớp bản build đã kiểm, không chạy lại các check đã đạt khi runtime không đổi.

## Phụ thuộc và phần chưa làm

- **FE-025 — Nhi phụ trách:** chưa thấy nhánh chứa `025` hoặc PR mở sẵn review trong repo sau fetch. PR tìm theo `FE-025` chỉ trả PR #16 nhắc đóng góp một phần. Không coi thay đổi thông báo Provider trong #23 là bàn giao FE-025 Customer.
- Khi có SHA FE-025: review badge chưa đọc đồng bộ header/list, đọc một/đọc tất cả và số 0; deep link tới đúng Customer route/booking ID, ID thiếu/không thuộc khách; pending/chống thao tác lặp, lỗi/retry và state không báo thành công sai; keyboard/focus ở ba viewport. Chưa có bản để chạy checklist này.
- **Auth — ghi để Nhi xử lý cùng phần Auth:** đích `/register/verify-email` trả 404 dù Register chuyển tới đó; nút Quên mật khẩu chưa phản hồi; dấu chân che tiêu đề Login ở 390px; nút Google Register tràn card khi widget unavailable (27/2/20px theo ba viewport trong QA bước 2).
- Các lỗi Auth trên là kết quả bước 2 tại cùng nền dev `9c5f66f`, được giữ trong hàng chờ, không sửa và không tuyên bố đã chạy lại fullstack trong bước 3. Cấu hình local thực và biến môi trường hiện vẫn thiếu API URL/site key. Không in nội dung env, không dùng test key/token giả, không bypass Turnstile.
- Auth #20 chưa nằm trong dev; bảo toàn worktree `FE-018-019`. Provider Sidebar/Header và lỗi focus khi đóng chi tiết thông báo Provider vẫn thuộc đợt riêng chờ Nhi duyệt; chưa sửa.

## Bằng chứng và bảo toàn

Artifact ngoài repository: **`/Users/tom/Desktop/PawFlow/QA-FE026-Step3-20261117/`**.

- `baseline-browser/results.json`: 3 ca lỗi trước sửa và event target.
- `booking-qa.cjs`, `final-browser/results.json`, `intentional-navigation/results.json`, `results-consolidated.json`: script và kết quả cuối theo từng ca.
- `final-browser/*-double-click-pending.png`, `*-double-click-success.png`: ảnh đã kiểm trên bản sửa.
- `logic/tests.log`, `lint.log`, `build.log`, `typecheck-final.log`; giữ cả log lần typecheck lỗi môi trường.
- `runtime-source-hashes.json`, `source-manifest.json`: nhận diện source được QA; đây không phải SHA commit mới.
- `preservation-before.json`, `preservation-after.json`, `preservation-comparison.json`: đối chiếu branch/HEAD/status/diff/index và hash file tracked của các worktree cũ, cùng danh sách stash.

Trong bước 3 không stage, tạo stash, commit, push, mở PR, merge, gửi thông báo hoặc cập nhật sheet. Phần này dừng sau QA; phạm vi commit local ở bước 4 được ghi bên dưới.

Đối chiếu cuối lượt: worktree Auth `FE-018-019`, checkout chính `FE-015` (gồm diff riêng `AGENTS.md` và Provider layout), 9 worktree cũ khác và cả 3 stash giữ nguyên theo snapshot. **Một worktree cũ có thay đổi ngoài phạm vi xuất hiện trong lúc QA:** `PawFlow-Provider-QA-20261116` từ detached HEAD chuyển sang `provider-sidebar-cleanup`, có diff ở `src/app/dashboard/layout.tsx`, `src/components/Sidebar.tsx` và file mới `src/components/Sidebar.module.css`. Lượt Booking không ghi vào worktree này; không hoàn tác hoặc nhập các thay đổi đó vào nhánh Customer. Vì vậy không tuyên bố mọi worktree cũ đều có status giống hệt đầu lượt; chi tiết được tách riêng trong snapshot.

## Bàn giao commit local — bước 4

- Worktree `PawFlow-Customer-UI-Regression`, nhánh `customer-ui-regression`. Fetch origin trước commit xác nhận `origin/dev` vẫn ở **`9c5f66f87944a28f057043e9b1d9b8ba91a0e74a`**; không có commit mới hoặc phần giao nhau so với nền đã QA.
- Đối chiếu **403 file runtime** với manifest của bước 3: không có thay đổi. **22/22 ca browser và 70/70 test Booking là kết quả đã thực chạy trên bản QA đó**, cùng lint/typecheck/production build đã đạt; không phải kết quả một lượt chạy mới ở bước commit. Chỉ cập nhật Markdown bàn giao trong bước này.
- Commit chỉ gồm `src/features/customer-booking/components/BookingPanel.tsx`, `src/features/customer-booking/booking.module.css` và biên bản này. Tiêu đề: **`fix(FE-026): keep booking retry confirmation visible`**. Kiểm tra nội dung staged, `git diff --cached --check` và đối chiếu blob runtime staged với manifest trước khi commit.
- Bước này dừng sau commit local; chưa push, mở PR hoặc cập nhật sheet. FE-025 và Auth backend tiếp tục chờ; giữ nguyên các lỗi Auth trong mục phụ thuộc.
- Sau khi Provider Sidebar QA xong, tích hợp hai commit lên **một nhánh bàn giao mới từ `origin/dev` lúc đó**, rồi kiểm tra bản ghép tại 1440×1000, 768×1024, 390×844: Booking retry/double-click/Enter/timeout và đúng ID receipt/list/detail; navigation chủ động rời/quay lại Booking; điều hướng/keyboard/focus/scroll của Provider Sidebar/Header và thông báo Provider trong phạm vi thay đổi. Đối chiếu các file/layout dùng chung nếu có, chạy các check liên quan trên bản ghép trước khi push và mở **một PR vào dev**. Kết quả QA hiện tại không thay thế lượt kiểm bản ghép đó.
- Bằng chứng chuẩn bị commit và bảo toàn worktree: `/Users/tom/Desktop/PawFlow/QA-FE026-Step4-20261117/`.
