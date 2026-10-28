# FE-014 — Staff: lịch hẹn với UI/mock tương tác

Ngày cập nhật: 28/10/2026, Asia/Ho_Chi_Minh. Bước 3/4 đã đạt kiểm tra bản UI/mock cuối trong phạm vi ghi dưới đây; sẵn sàng bàn giao Git ở bước 4, chưa commit/push/PR.

## Phạm vi và nền Git

- Worktree `/Users/tom/Desktop/PawFlow/PawFlow-Staff-FE014`, branch `FE-014`, nền `origin/dev` tại `3b69691a5c740cc9259ce987c108bc9bacee7417`.
- `/staff` chuyển tới `/staff/bookings`. Staff chỉ có màn Lịch hẹn; không thêm dashboard kinh doanh, quản lý dịch vụ/giá, hồ sơ khách/pet đầy đủ, Cancel hoặc phân quyền riêng từng nhân viên.
- Tiếp tục 23 file mới của hai phiên trước, giữ phần mutation đã viết; không phục hồi đè bản chỉ đọc. Bước này nối UI/session, bổ sung trạng thái xử lý, dữ liệu mô phỏng, nhật ký, CSS, test và tài liệu.
- Giữ shell rộng: Header 68px, Sidebar desktop 285px, lề ngang desktop/tablet/mobile 32/24/16px, padding workspace 20px, gap 20px. Main cuộn riêng, workspace không có max-width cố định. Không sửa source shell trong bước 2.
- Không sửa Provider/Admin/auth/API, AGENTS riêng, layout Provider kể cả class đang sai, dependency/lockfile/config, backup hoặc stash. Không merge/cherry-pick PR khác; chưa stage/commit/push/tạo PR/cập nhật bảng task.

## Quyết định UI/mock đã được người dùng chốt

Nguồn quyết định: tin nhắn người dùng ngày **28/10/2026 lúc 14:27 UTC+7**, được xác minh lại ở bước 1. Đây là quyết định cho UI/mock, chưa phải xác nhận backend đã hỗ trợ đầy đủ.

| Quy tắc | Hành vi |
| --- | --- |
| Phạm vi Staff | Role Staff, membership ACTIVE, có cơ sở; chỉ xem/xử lý booking cùng cơ sở. Dùng quyền chung, không thêm canViewBookings hay hệ thống cấp quyền từng Staff. |
| Confirm | Pending Confirmation → Confirmed, chỉ trước giờ bắt đầu: `now < start`. |
| Reject | Pending Confirmation → Rejected; bắt buộc có lý do sau trim. Không thêm hạn giờ cho Reject. |
| Completed | Confirmed → Completed từ `start + durationMinutesSnapshot` trở đi, kể cả đúng mốc; bắt buộc xác nhận dịch vụ thực tế đã xong. Không yêu cầu Paid. |
| Thiếu snapshot | Thiếu/thời lượng không hợp lệ thì chặn Completed; không lấy thời lượng dịch vụ hiện tại để thay thế. |
| No-show | Confirmed → No-show từ giờ bắt đầu, kể cả đúng mốc; bắt buộc xác nhận khách/pet chưa đến và có lý do/ghi nhận sau trim. |
| Trạng thái kết thúc | Completed, Cancelled, Rejected, No-show chỉ xem kết quả, không chuyển tiếp. Không tự đổi trạng thái theo thời gian. |
| Xác nhận thao tác | Cả bốn thao tác có bước xác nhận. Session kiểm tra lại role, ACTIVE, cơ sở, booking mới nhất, trạng thái mong đợi, mốc thời gian, lý do và xác nhận thực tế khi xử lý lệnh. |
| Dữ liệu được xem | Giá snapshot chỉ đọc; tên khách, điện thoại liên hệ gắn với booking; tên/loài/giống/tuổi/cân nặng/dị ứng/lưu ý pet cần cho dịch vụ nếu booking có. Không email, toàn bộ hồ sơ hoặc lịch sử ngoài cơ sở. |

## Implementation và giới hạn mock

- `types.ts`, `staffBookingLogic.ts`, `staffBookingSession.ts`: view model riêng, selectors scope trước tìm/lọc/detail; quy tắc chuyển trạng thái và session reducer. Không phải API DTO hay authentication claims.
- `useStaffBookingsMock.ts`: giả lập tải 250ms, xử lý thao tác 300ms. Trong lúc xử lý khóa gửi tiếp, quay lại và đóng dialog. Reducer cũng chặn thay thế lệnh đang chờ và phản hồi lặp; reset/đổi scenario hủy lệnh, phản hồi cũ bị bỏ qua.
- `StaffBookingsPage.tsx` truyền booking hiện tại, clock, result, processing và callback vào chi tiết. Booking cập nhật đồng thời ở danh sách, chi tiết và nhật ký; tìm/lọc không tạo bản sao state riêng. Nếu hàng không còn hợp bộ lọc, chi tiết vẫn bám booking được scope trong danh sách gốc.
- `StaffBookingDetails.tsx`: thông tin trong booking, lý do/xác nhận thực tế, lỗi và kết quả thao tác; không đặt điều khiển thử nghiệm trong dialog. Lỗi giữ dữ liệu và form để sửa/thử lại; thành công khóa gửi lại. Dialog có focus, Tab/Shift+Tab, Esc, backdrop và trả focus; cần kiểm tra browser bản cuối ở bước 3.
- `StaffBookingAudit.tsx`: nhật ký mới nhất trước, gồm booking, trạng thái trước/sau/yêu cầu, actor mô phỏng, thời gian, lý do, xác nhận thực tế, kết quả và thông báo. Thất bại giữ nguyên trạng thái; lookup ngoài phạm vi không ghi trạng thái của booking ngoài cơ sở.
- Dữ liệu và nhật ký chỉ nằm trong React state của phiên mount trang. Reload/unmount khôi phục fixture; không localStorage/sessionStorage, database, API, auth thật, realtime hoặc đồng bộ Owner/Admin.
- Giữ nguyên tám fixture hiện có. Một lịch có giá minh họa và số điện thoại che giả; các lịch khác thiếu thì hiện fallback. Không bổ sung dữ liệu liên hệ/pet nhạy cảm; không tự tạo thời lượng khi thiếu snapshot.

## Khu vực “Thử dữ liệu mô phỏng”

- Đồng hồ ban đầu cố định **21/10/2026 08:00 Asia/Ho_Chi_Minh**; không chạy theo đồng hồ máy. Input datetime-local luôn được diễn giải UTC+7, kiểm tra ngày/giờ hợp lệ và chỉ áp dụng khi nhấn nút.
- Giả lập lỗi thao tác: bật trước khi mở booking; thao tác hợp lệ sẽ thất bại, giữ nguyên booking và thêm log lỗi. Đóng chi tiết, tắt cờ lỗi rồi thử lại.
- Giả lập lỗi tải / Thử lại: giữ booking, log và đồng hồ; không âm thầm phục hồi fixture sau lỗi tải.
- Danh sách rỗng: thực sự đưa `bookings` về `[]`, giữ log/clock cho tới khi reset. Xóa bộ lọc không tự lấy lại mẫu.
- Khôi phục mẫu: khôi phục tám booking, log rỗng, result/lệnh đang chờ rỗng, tắt lỗi, scenario normal, đồng hồ mặc định; xóa lựa chọn/dialog, bộ lọc, input đồng hồ và lỗi input. Đi qua trạng thái tải trước khi hiện mẫu.
- Các điều khiển trên nằm riêng trong disclosure dữ liệu mô phỏng. Chúng bị khóa khi đang xử lý booking.

Ví dụ thử ở bước 3:

1. PF-2084: Confirm tại 08:00; sau đó Completed/No-show đều chưa đủ giờ. Đổi đồng hồ 09:00 thì No-show khả dụng; Completed chỉ từ 10:30.
2. PF-2083: Reject với lý do rỗng/khoảng trắng phải lỗi, nhập lý do hợp lệ phải thành công.
3. PF-2079 đã qua giờ kết thúc tại đồng hồ mặc định: thử Completed thiếu/đủ xác nhận thực tế; hoặc reset rồi thử No-show thiếu/đủ lý do và xác nhận.
4. PF-2082 thiếu snapshot: Confirm rồi đưa đồng hồ sau giờ hẹn; Completed vẫn bị chặn, No-show theo mốc bắt đầu.
5. Bật lỗi thao tác, thử Confirm, kiểm tra trạng thái không đổi/log thất bại; tắt lỗi và thử lại. Thử empty, lỗi tải/retry và reset để xác minh dữ liệu/log/clock nhất quán.

## Khác biệt thiết kế/API và điều kiện tích hợp

- Thiết kế Staff chính: [node 5023:3532](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=5023-3532), dialog liên quan `5033:3418`, `5033:3409`, quyền `5024:3548`. Bước 2 dùng kết quả khảo sát sẵn có; không đọc lại Figma trực tiếp. Mốc Completed “từ giờ hẹn” trong khảo sát thiết kế cũ được thay bằng quyết định giờ kết thúc snapshot của người dùng. Không coi câu cấm quản lý giá dịch vụ là cấm xem giá snapshot booking.
- API được đọc trực tiếp ở bước 1 ngày 28/10 từ `PawFlow-API/dev`; không gọi mutation hoặc kiểm thử backend đang chạy. [BookingsService](https://github.com/quinnie-o3/PawFlow-API/blob/dev/src/bookings/bookings.service.ts) blob `2269830101b1877a9e373e10d8a0e7d95d9217e8`; [controller](https://github.com/quinnie-o3/PawFlow-API/blob/dev/src/bookings/bookings.controller.ts) blob `cf5ad7e37cb8eeba65362298af4b1a32f83eef88`.
- API có GET provider list/detail và POST confirm/reject/complete/no-show cho Owner/Staff; service kiểm tra Staff ACTIVE/cùng provider và khóa booking trong transaction. Điều này không chứng minh UI/mock đã được backend bảo vệ vì frontend này chưa tích hợp API.
- Confirm/Completed/No-show trong source API đã đọc chưa kiểm tra các mốc thời gian đã chốt; chưa nhận xác nhận thực tế. Reject/No-show DTO còn để lý do optional. Cần backend thực thi độc lập các điều kiện, không chỉ tin nút UI bị khóa.
- [Booking entity](https://github.com/quinnie-o3/PawFlow-API/blob/dev/src/bookings/entities/booking.entity.ts) có `bookedPrice` dạng numeric/string, chưa có thời lượng snapshot. Cần contract cho snapshot, nguồn thời gian UTC+7, mapping trạng thái/ID và trường liên hệ gắn booking. Không suy thời lượng từ `service.duration` hiện tại.
- GET hiện tải quan hệ pet/service/slot; cần response projection tối thiểu cho Staff, không trả toàn bộ thông tin pet/khách rồi chỉ ẩn trên UI. Cần thống nhất auth/route guard, lỗi/phiên bản/cạnh tranh, audit bền vững và xác nhận kết quả thực tế trước khi nối API.

## Kiểm tra bước 2 — đã chạy trên source tương tác mới

- `npx tsc --noEmit --incremental false`: đạt, exit 0. Tắt incremental để tránh tạo/cập nhật tsbuildinfo trong repo.
- Biên dịch strict hai file test bằng TypeScript hiện có và chạy Node test runner: **24/24 đạt**, exit 0. Bao gồm search/scope/timezone; trước/đúng/sau mốc bắt đầu/kết thúc; snapshot thiếu/sai; trạng thái kết thúc/transition sai; lý do/xác nhận thực tế; membership/cơ sở; state/clock đổi sau submit; gửi lặp; lỗi không đổi booking; retry/empty/reset và phản hồi cũ sau reset.
- Không dùng kết quả 6 test/bản build chỉ đọc trước mutation để xác nhận bản này.
- Chưa chạy lint, build hoặc browser bản cuối trong bước 2; chưa khởi động server. Chưa xác nhận visual QA, asset tablet/mobile hoặc kiểm thử API/auth.

Lệnh test (không thêm dependency/script/config):

```sh
test_output=$(mktemp -d /tmp/pawflow-fe014-tests.XXXXXX)
./node_modules/.bin/tsc src/features/staff-bookings/staffBookingLogic.test.ts src/features/staff-bookings/staffBookingSession.test.ts --outDir "$test_output" --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck --strict
# Chỉ chạy Node khi lệnh biên dịch phía trên thành công.
node --test "$test_output/staffBookingLogic.test.js" "$test_output/staffBookingSession.test.js"
```

## Kiểm tra bước 3 — bản production cuối

**Phiên bản được kiểm tra:** nền HEAD `3b69691a5c740cc9259ce987c108bc9bacee7417`, 26 file source/asset/test Staff ngoài tài liệu; SHA-256 tổng hợp **`b00f07db6af9893e0b31a150a08093c789ef167d89aaf0c1df4000cbe40076ed`**. Cách tính: sắp đường dẫn tương đối, nối từng `path + NUL + SHA256(file) + newline`, rồi SHA256 toàn chuỗi. Tài liệu được loại khỏi hash này để có thể ghi kết quả kiểm tra vào chính tài liệu. Manifest bàn giao ngoài repo chứa hash riêng cho đủ 27 file, kể cả tài liệu.

Production build ID: `Q1xtIAjbDouAjurZ45kut`. URL đang phục vụ bản này: [Staff](http://localhost:3021/staff/bookings), `/staff` chuyển tới `/staff/bookings`.

### Lỗi đã sửa trong bước 3

Xem ảnh 390px phát hiện ô datetime-local bị co hẹp khi đứng cạnh nút Áp dụng thời gian, khiến phần giờ bị cắt dù không có overflow trang. Thêm đúng một rule `.clockForm .field { flex-basis: 240px; }` trong `staffBookings.module.css`: ô có đủ chiều rộng và nút xuống dòng khi cần. Đã xem ảnh sau sửa, thấy đủ ngày và giờ; kiểm tra tự động bổ sung yêu cầu ô rộng tối thiểu 240px và vẫn nằm trong main.

Không đổi TS/TSX, types, mock, hook, session hoặc test ở bước 3. Không còn lỗi được ghi nhận trong phạm vi kiểm tra dưới đây.

### Kiểm tra tự động thực chạy và kết quả dùng lại

| Kiểm tra | Kết quả và phiên bản |
| --- | --- |
| `npm run lint` | Đạt, exit 0; chạy lại sau sửa CSS cuối. |
| `npm run build` | Đạt, exit 0; chạy lại sau sửa CSS cuối, có bước TypeScript và đủ route Staff tĩnh. Khởi động lại riêng server 3021 do lượt này tạo để phục vụ build mới. |
| `npx tsc --noEmit --incremental false` của bước 2 | Dùng lại kết quả đạt: toàn bộ TS/TSX/type/config liên quan không đổi theo hash. Không tuyên bố đã chạy lại lệnh này ở bước 3. |
| 24/24 logic/session test của bước 2 | Dùng lại theo hash: logic, types, fixture, reducer, hook và hai file test không đổi. Bao gồm sai role, inactive/unassigned, sai cơ sở, transition/trạng thái cũ, gửi lặp và phản hồi cũ. Đây là kiểm tra logic mock, không phải browser spoof role hay kiểm thử backend authorization. |
| Chromium/Playwright production | **39/39 nhóm đạt**: 13 nhóm tại mỗi viewport 1440×1000, 768×1024, 390×844. Chạy lại toàn bộ sau sửa CSS. |
| Chromium/Playwright bổ sung | **9/9 nhóm đạt**: ba nhóm mỗi viewport cho mock tools mở rộng, lý do dài trong nhật ký và toàn bộ vòng Tab trong form xác nhận. Chạy lại sau sửa CSS. |
| JavaScript/asset | Không có page error hoặc console error của Staff trong hai lượt browser cuối. Ảnh đang thực sự giao viewport được kiểm tra decode; URL của mọi ảnh được yêu cầu riêng và trả HTTP 200. Font Be Vietnam Pro đã tải. Không đánh đồng ảnh lazy/ẩn với ảnh hỏng. |

Các nhóm browser bao phủ:

- Tìm kiếm tiếng Việt có/không dấu, mã/pet, sáu bộ lọc, empty do lọc; mutation cập nhật hàng/status và chi tiết; hàng mất khỏi bộ lọc thì đóng modal trả focus về tìm kiếm.
- Đủ bốn thao tác thành công; Reject/No-show có lý do rỗng/khoảng trắng; Completed/No-show thiếu xác nhận thực tế; thông báo và audit thành công/thất bại đúng. Lỗi mô phỏng không đổi booking, tắt lỗi rồi thử lại thành công; lỗi tải/retry giữ dữ liệu/log.
- Confirm trước/đúng/sau giờ bắt đầu; No-show trước/đúng/sau giờ bắt đầu; Completed trước/đúng/sau giờ kết thúc; thiếu snapshot vẫn chặn. Browser dùng mốc theo phút, logic test dùng chênh 1ms. Context browser đặt `America/New_York` để kiểm tra input/hiển thị vẫn theo UTC+7.
- Gửi hai click xác nhận liên tiếp chỉ cập nhật một lần; khi xử lý, các nút/đóng/quay lại/reset bị khóa, Esc/backdrop không đóng. State/clock/quyền thay đổi và lệnh stale được kiểm tra trong logic test đã dùng lại.
- Tám chi tiết đúng bản ghi, bốn trạng thái kết thúc không có action; dialog quyền; focus ban đầu, Tab/Shift+Tab, vòng Tab đầy đủ, Esc/backdrop, focus sau lỗi/thành công/quay lại/đóng; mọi nút và phần đầu/cuối modal cuộn tới được.
- Danh sách rỗng thật; reset dữ liệu/log/result/lỗi/bộ lọc/lựa chọn/input/clock; datetime rỗng báo lỗi; mock controls tách khỏi dialog.
- Mở trực tiếp `/staff`, redirect, reload khôi phục fixture, Back/Forward, navigation chỉ trong Staff; menu thu gọn với keyboard/Esc/click ngoài/blur/cùng route. Không diễn giải dữ liệu phiên là lưu bền vững.

Số đo cùng viewport, zoom 100%, khớp Provider trong bản build nền hiện tại:

| Viewport | Lề trái/phải | Workspace | Header | Sidebar hiển thị | Main |
| --- | --- | --- | --- | --- | --- |
| 1440×1000 | 32px | 1376px | 68px | 285px | 1031×844px |
| 768×1024 | 24px | 720px | 68px | Ẩn | 680×884px |
| 390×844 | 16px | 358px | 68px | Ẩn | 318×704px |

Padding workspace/gap đều 20px; Header/Sidebar đứng yên khi main cuộn; active item nằm trong Sidebar; không overflow ngang trang/main; bảng cuộn ngang riêng. Có kiểm tra lại khi mở mock tools và khi audit chứa lý do dài.

### Xem ảnh và phần chưa kiểm tra

Đã xem ảnh đầu/cuối trang và modal ở ba viewport, ảnh mock tools 390px trước/sau sửa để phát hiện và xác nhận lỗi datetime. Đây là đánh giá hình ảnh thủ công từ screenshot; các thao tác browser nêu trên do Playwright thực hiện, không có lượt thao tác tay độc lập hoặc thiết bị thật.

Chưa thử Safari/Firefox, screen reader thật, thiết bị thật, API/backend/auth hoặc phân quyền server. URL Staff hiện truy cập được trực tiếp vì đây là UI/mock; selectors phía client không phải ranh giới bảo mật. Các khoảng thiếu backend đã ghi ở phần API vẫn còn trước tích hợp.

### Bằng chứng và bảo toàn

Artifact ngoài repo: `/tmp/pawflow-fe014-step3-m23h28tr/`. Gồm `lint-final.log`, `build-final.log`, `browser-results-final.json`, `supplement-results.json`, `source-hashes.json`, `reused-checks.json`, `handover-manifest.json`, script và screenshot. Các kết quả trước sửa CSS/script đo được giữ riêng, không dùng thay kết quả bản cuối.

Đã rà trực tiếp cả 27 file untracked (source/test/docs/asset), đối chiếu hash với bước 2 và kiểm tra bảo toàn ba worktree. Bước 3 chỉ sửa một dòng CSS Staff và tài liệu này; không stage/commit/push/PR/merge/cập nhật task. AGENTS riêng, layout Provider kể cả class sai, các file ngoài phạm vi, backup/handoff và ba stash giữ nguyên. Không phát hiện thay đổi đồng thời mới; không thao tác hoặc xác minh nội dung buffer chưa lưu trong editor.

## Danh sách 27 file bàn giao

```text
docs/FE-014-staff-bookings.md
public/staff/ngoc-mai.png
src/app/staff/bookings/page.tsx
src/app/staff/layout.tsx
src/app/staff/page.tsx
src/features/staff-bookings/components/StaffBookingAudit.tsx
src/features/staff-bookings/components/StaffBookingDetails.tsx
src/features/staff-bookings/components/StaffBookingsList.tsx
src/features/staff-bookings/components/StaffBookingsPage.tsx
src/features/staff-bookings/components/StaffBookingsToolbar.tsx
src/features/staff-bookings/components/StaffDialog.tsx
src/features/staff-bookings/components/StaffMockTools.tsx
src/features/staff-bookings/components/StaffPermissionsDialog.tsx
src/features/staff-bookings/components/StaffStatusBadge.tsx
src/features/staff-bookings/data/staffBookingsMock.ts
src/features/staff-bookings/hooks/useStaffBookingsMock.ts
src/features/staff-bookings/staffBookingLogic.test.ts
src/features/staff-bookings/staffBookingLogic.ts
src/features/staff-bookings/staffBookingSession.test.ts
src/features/staff-bookings/staffBookingSession.ts
src/features/staff-bookings/staffBookings.module.css
src/features/staff-bookings/types.ts
src/features/staff-shell/components/StaffHeader.tsx
src/features/staff-shell/components/StaffNavigation.tsx
src/features/staff-shell/components/StaffShell.tsx
src/features/staff-shell/components/StaffSidebar.tsx
src/features/staff-shell/staffShell.module.css
```

## Bước 4/4 còn lại

Đã đủ điều kiện bàn giao bản UI/mock được kiểm tra trên Chromium. Khi được giao bước 4: fetch/kiểm tra PR và nền lại, stage chọn đúng 27 file FE-014, commit/push branch và tạo một PR vào dev cho Nhi review. Loại AGENTS/layout riêng/backup/stash/artifact. Không tự merge, không cập nhật bảng task. Không có câu hỏi nghiệp vụ đang chặn UI/mock; các khoảng thiếu API ở trên cần Nhi/backend thống nhất trước tích hợp.
