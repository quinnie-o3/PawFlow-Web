# FE-015 — Provider UI hoàn chỉnh và điều hướng

Rà hành trình Provider đã có của FE-003–012 và phần Provider thuộc FE-015–017. Chỉ sửa lỗi điều hướng được xác định bên dưới; không triển khai lại trang hoàn tất, đổi nghiệp vụ/KPI/validation, auth, Staff hoặc dashboard vai trò khác.

## Git và bảo toàn ở lượt triển khai trước

- Bắt đầu ở FE-012 (`1df8134`), working tree chỉ có `AGENTS.md` sửa riêng, index trống. Sau fetch không có commit local nào chưa xuất hiện trên remote.
- Local dev chậm origin/dev 8 commit, không phân kỳ. FE-015 chưa có ở local/remote. Đã `git pull --ff-only origin dev` tới `3b69691`, rồi `git switch -c FE-015`.
- PR [#10](https://github.com/quinnie-o3/PawFlow-Web/pull/10), [#11](https://github.com/quinnie-o3/PawFlow-Web/pull/11), [#12](https://github.com/quinnie-o3/PawFlow-Web/pull/12) đều đã merge vào dev; tìm PR mở trong repo trả danh sách rỗng ngày 25/10/2026.
- Sao lưu AGENTS, diff, trạng thái, branches, danh sách stash và SHA-256 tại `.git/pawflow-preservation/20261025T092847Z-fe015/`. Cất đúng `AGENTS.md` trước khi chuyển nhánh, sau đó dùng `stash apply`, giữ lại stash mới cùng hai stash cũ và các backup có sẵn.
- Đối chiếu nguyên byte AGENTS sau khôi phục và sau kiểm thử: `cc0537c35367d50eb8122d94540796050f0fc9d9fdfdbc0e8cce67fe97050800`. Next dev từng tự thêm hướng dẫn; đã khôi phục lại nội dung gốc từ backup. Đây là thay đổi riêng có sẵn, không thuộc FE-015.
- Lượt triển khai trước chưa commit, push hoặc tạo PR. Xem cập nhật bàn giao bên dưới; không merge hoặc sửa bảng task.

## Checklist

| Vấn đề / trang, file | Hành vi mong muốn | Tiêu chí kiểm tra thực tế | Kết quả |
| --- | --- | --- | --- |
| Header thiếu active; menu thu gọn không đóng, focus còn ở link ẩn khi chọn lại trang hiện tại — `src/components/Header.tsx` | Active và `aria-current` đúng; đóng khi chọn route, Esc, click ngoài hoặc focus rời menu; chọn lại trang trả focus về nút mở | Đi đủ bảy route, keyboard/Tab/Esc, click ngoài, cùng route; menu cuộn được khi viewport thấp | Đạt |
| Tổng quan còn khóa “Xem tất cả yêu cầu” — `BookingRequestsPreview.tsx` | Link tới `/dashboard/bookings?status=pendingConfirmation`, bỏ nhãn trang đang phát triển | Click từ Tổng quan, ba yêu cầu chờ trong fixture Lịch hẹn; reload giữ bộ lọc | Đạt |
| Lịch hẹn chưa đọc URL — `ProviderBookingsPage.tsx`, route `bookings/page.tsx` | Đọc/ghi trạng thái và tìm kiếm qua URL, fallback Tất cả khi trạng thái sai | Sáu trạng thái, kết hợp tìm kiếm không dấu/có dấu, URL trực tiếp, reload, Back/Forward, xóa bộ lọc | Đạt |
| Lịch khả dụng thiếu đường dẫn về Dịch vụ/Hồ sơ — `ProviderAvailabilityPage.tsx` | Bổ sung link trong khối quy tắc nhận lịch | Click đúng route, giữ link Lịch hẹn và mở modal slot | Đạt |
| Dịch vụ thiếu link Hồ sơ — `ServicesGuidance.tsx` | Bổ sung “Xem hồ sơ cơ sở”, giữ link Lịch khả dụng | Đi Dịch vụ → Hồ sơ/Lịch khả dụng, mở modal thêm dịch vụ | Đạt |
| Khách hàng — kiểm tra hồi quy, không sửa source | Link Lịch hẹn và modal hồ sơ tiếp tục hoạt động | Điều hướng, mở chi tiết, giữ/trả focus và Esc | Đạt |
| Thông báo — kiểm tra quyết định đã chốt, không sửa source | Giữ mã booking để tham chiếu, chưa có deep link theo FE-011 | Mở đúng NOT-001/PF-2084, cập nhật đã đọc, không thêm link booking giả | Đạt theo quyết định cũ |
| Hồ sơ cơ sở — kiểm tra hồi quy, không sửa source | Giữ link “Xem dịch vụ”, “Xem lịch” và modal hồ sơ | Đi Hồ sơ → Dịch vụ/Lịch khả dụng, modal/focus/Tab/Esc | Đạt |
| Shell/Sidebar/dialog — kiểm tra hồi quy, không sửa source | Khung rộng và padding nhất quán; main cuộn riêng, Header/Sidebar đứng yên | Bảy trang ở 1440×1000, 768×1024, 390×844; tọa độ main nhất quán; không tràn ngang; modal trong viewport, cuộn đến cuối | Đạt |

## URL và phạm vi thay đổi

- `status`: dùng nguyên giá trị trạng thái hiện có: `pendingConfirmation`, `confirmed`, `completed`, `cancelled`, `rejected`, `noShow`. Thiếu/sai giá trị đọc thành `all`.
- `q`: tìm mã lịch, khách hoặc thú cưng theo logic lọc hiện có. Thiếu/rỗng tương đương không tìm kiếm. Không thay đổi công thức KPI hoặc logic lọc nghiệp vụ.
- Chọn trạng thái/xóa bộ lọc dùng native `history.pushState`; gõ tìm kiếm dùng `replaceState` để không tạo history theo từng ký tự. Giữ query khác và fragment; Next.js đồng bộ với `useSearchParams`. Boundary `Suspense` tại page giữ route build tĩnh được.
- Thay đổi query không remount dữ liệu mock: đã kiểm tra xác nhận PF-2084, đổi bộ lọc và gõ “Hà Linh”, Back vẫn giữ cập nhật. Reload giữ bộ lọc nhưng khôi phục fixture theo hành vi mock đã có.
- Header chỉ thay active/menu/nhãn avatar khi `provider=true`; kiểm tra Home dùng mặc định cùng trang login/register vẫn hoạt động. Sidebar, layout, CSS, dependency, lockfile, config, mock, validation và logic nghiệp vụ giữ nguyên.

Sáu file source sửa: `src/components/Header.tsx`, `src/app/dashboard/bookings/page.tsx`, `src/features/provider-bookings/components/ProviderBookingsPage.tsx`, `src/features/provider-dashboard/components/BookingRequestsPreview.tsx`, `src/features/provider-availability/components/ProviderAvailabilityPage.tsx`, `src/features/provider-services/components/ServicesGuidance.tsx`. Tài liệu mới là file này.

## Kiểm tra đã chạy ngày 25/10/2026

- `npm run lint`: đạt, exit 0.
- `npx tsc --noEmit`: đạt, exit 0.
- `npm run build`: đạt, exit 0; toàn bộ bảy route Provider được build tĩnh. Đã chạy lại cả ba lệnh sau sửa focus cuối cùng.
- Biên dịch tất cả sáu `src/features/**/*.test.ts` bằng TypeScript có sẵn với `--outDir /tmp/pawflow-fe015-validation/logic --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck`, rồi `node --test` các file `.test.js`: **99/99 test đạt** (bookings, availability, services, customers, notifications, profile). Không có thay đổi logic sau lượt này.
- Chromium/Playwright có sẵn trên máy, bản production `http://localhost:3016`: **22/22 nhóm kiểm tra** trong `check.cjs` và **4/4 nhóm bổ sung** trong `state-check.cjs` đạt. Các nhóm gồm đủ bảy trang và ba kích thước, Header/Sidebar/icon/menu, route trực tiếp/reload, URL/Back/Forward/tìm kiếm, liên kết module, bảy modal, focus/Tab/Shift+Tab/Esc, cuộn và hồi quy Home/login/register. Bổ sung xác nhận booking rồi đổi bộ lọc không mất state, fallback focus khi hàng biến mất, reload khôi phục mock, cùng route trả focus về summary và menu cuộn ở 390×250.
- Browser chạy với timezone `America/Los_Angeles`; không có page error hoặc console error trong lượt hành trình cuối. Đã xem ảnh desktop/tablet/mobile và modal.
- `git diff --check`: đạt. Index trống. `AGENTS.md` nguyên byte; các file thay đổi thuộc phạm vi đã công bố.
- `lsof` xác nhận Next production lắng nghe cổng 3016; HTTP HEAD `/dashboard/bookings?status=pendingConfirmation` trả 200.

Bằng chứng local ngoài repo: `/tmp/pawflow-fe015-validation/` chứa `check.cjs`, `state-check.cjs`, `results.json`, `state-results.json`, `logic-tests.txt` và ảnh từng trang ở đầu/cuối main cùng modal. Chạy lại browser bằng `BASE_URL=http://localhost:3016 node /tmp/pawflow-fe015-validation/check.cjs` và `node /tmp/pawflow-fe015-validation/state-check.cjs`. Không cài dependency hoặc sửa npm scripts/config.

## Giới hạn

- Không có câu hỏi quyết định mới đang chặn phạm vi này. Thông báo → booking tiếp tục **chưa triển khai** đúng quyết định trong `docs/FE-011-provider-notifications.md`; chỉ hiện mã tham chiếu, không suy ra cơ chế deep link.
- Các module tiếp tục dùng mock riêng. Tổng quan có thể hiển thị số/mốc thời gian khác Lịch hẹn; fixture Thông báo, Khách hàng và Hồ sơ không đồng bộ thay đổi trong phiên của module khác. Không chỉnh mock để làm số liệu trùng nhau.
- Chỉ bộ lọc Lịch hẹn được đưa lên URL trong cụm này; bộ lọc và kỳ báo cáo ở module khác giữ hành vi đã chốt.
- Chưa kiểm thử Safari/Firefox, thiết bị thật, screen reader thật, API hoặc luồng auth thành công với backend. Hồi quy auth chỉ gồm hiển thị trang và hành vi mặc định của Header, không thay đổi auth.

Xem local: [Tổng quan](http://localhost:3016/dashboard), [Lịch hẹn chờ xác nhận](http://localhost:3016/dashboard/bookings?status=pendingConfirmation).

## Bàn giao Provider ngày 25/10/2026

- Người dùng cho phép commit/push đúng sáu source và tài liệu này trên FE-015, với message `fix(FE-015): complete provider navigation and UI regression`, và tạo PR vào dev. Đây **chỉ là phần Provider của FE-015–017**, không xác nhận hoàn tất responsive/QA/regression cho các role khác, không merge và không cập nhật bảng task.
- Đã review sáu source nêu trên; không sửa source mới ở lượt bàn giao. Đã chạy lại `npm run lint`, `npx tsc --noEmit`, `npm run build`: cả ba đạt trên code bàn giao. Kết quả 99/99 logic test ở lượt trước vẫn áp dụng vì không có thay đổi logic.
- `AGENTS.md` hiện hành có quy tắc mới hơn backup cũ; SHA-256 là `9eb0f3f7656ff2b86179fcc62c682adfe8c0747337a00e857b83128774a7ead1`. Giữ nguyên byte, không stage; không phục hồi đè bằng bản hash `cc0537…` của lượt trước. Giữ nguyên ba stash và backup cũ. Bản bảo toàn mới: `.git/pawflow-preservation/20261025-fe015-handover-100925/`.
- VS Code không phản hồi khi đọc UI (hai lần timeout). Bản phục hồi buffer chưa lưu của `src/app/dashboard/layout.tsx` khác đĩa ở đúng một class: `poi  nter-events-none` so với `pointer-events-none`. Đã hỏi người dùng; giữ nguyên buffer, bản phục hồi và file đĩa. Layout không thuộc commit này. Admin dùng worktree riêng để tránh chuyển nhánh dưới buffer đang mở.
- Người dùng xác nhận **FE-013 = Admin, đủ bảy màn chính; FE-014 = Provider Staff, lịch hẹn quyền giới hạn; làm Admin trước; Customer ở nhóm task riêng**. Đây là **cách gán task do người dùng xác nhận trong hội thoại**, không phải nội dung role đã ghi sẵn trong bảng task.
- Đã chạy lại browser trên production mới `http://localhost:3017`: **22/22 nhóm** trong `check.cjs` và **4/4 nhóm** trong `state-check.cjs` đạt, đủ bảy route và ba viewport 1440/768/390. Không có page/console error. Artifact tại `/tmp/pawflow-fe015-validation/` đã được cập nhật cho lượt này.
