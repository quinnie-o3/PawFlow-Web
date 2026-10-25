# FE-013 — Admin: bảy màn chính và UI mock chỉ đọc

Ngày: 25/10/2026, Asia/Ho_Chi_Minh.

## Phạm vi do người dùng xác nhận

**FE-013 = Admin**, gồm Tổng quan, Duyệt cơ sở, Người dùng, Danh mục, Kiểm duyệt đánh giá, Khiếu nại và Nhật ký hoạt động. **FE-014 = Provider Staff**, lịch hẹn với quyền giới hạn; làm Admin trước; Customer giữ ở nhóm task riêng.

Đây là **cách gán task được người dùng xác nhận trong hội thoại**, không phải nội dung role đã ghi sẵn trong bảng task. Không sửa bảng task hoặc suy ra đã hoàn tất milestone FE-015–017.

Lượt này hoàn thành phần UI độc lập: shell/menu riêng, danh sách, tìm kiếm, bộ lọc, chi tiết, loading/empty/error/retry và responsive. Chưa có câu trả lời cho các quyết định bên dưới, nên thao tác thay đổi dữ liệu bị khóa; KPI để `—`, biểu đồ chưa vẽ series. Không tích hợp API hoặc auth, không gán quyền Staff, không xóa vĩnh viễn, không tạo quy trình xử lý mới.

## Git và bàn giao Provider trước khi bắt đầu

- FE-015: commit `9e4bdb18cb0e7c267bd920692e6028c445c40242`, message `fix(FE-015): complete provider navigation and UI regression`. Đã push và đối chiếu remote. Commit chỉ gồm sáu source được chỉ định và `docs/FE-015-provider-navigation.md`.
- Chỉ là **phần Provider của FE-015–017**. Không merge, không sửa task table.
- Tìm PR FE-015 → dev trả rỗng. Tạo PR qua connector trả **403: Resource not accessible by integration**; lần tìm lại cũng chưa có PR.
- [Compare để mở PR FE-015 → dev](https://github.com/quinnie-o3/PawFlow-Web/compare/dev...FE-015?expand=1). Mô tả đã chuẩn bị tại `/tmp/pawflow-fe015-pr-description.md`.
- Workspace gốc `/Users/tom/Desktop/PawFlow/PawFlow-Web` vẫn ở FE-015, chỉ còn `AGENTS.md` sửa riêng. Hash giữ nguyên: `9eb0f3f7656ff2b86179fcc62c682adfe8c0747337a00e857b83128774a7ead1`. Giữ nguyên ba stash và backup cũ; backup bàn giao mới ở `.git/pawflow-preservation/20261025-fe015-handover-100925/`. Không stage AGENTS/backup/stash.
- VS Code đọc UI hai lần timeout. Bản phục hồi buffer `src/app/dashboard/layout.tsx` khác đĩa đúng một class: `poi  nter-events-none` so với `pointer-events-none`. Đã hỏi người dùng; không lưu hoặc bỏ buffer, không sửa file đĩa. Hash file đĩa giữ nguyên: `488ba7e16ff21a8e87829b2d3c771c1965ae6130bad68bfa7320e3183e53c2a0`.
- Sau fetch, FE-013 chưa tồn tại ở local/remote. Tạo **worktree riêng** `/Users/tom/Desktop/PawFlow/PawFlow-Admin-FE013`, nhánh FE-013 từ `origin/dev` mới nhất `3b69691a5c740cc9259ce987c108bc9bacee7417`. Không chuyển nhánh dưới buffer đang mở; không reset/xóa/force push. Không kế thừa FE-015 vì Admin không phụ thuộc điều hướng Provider. FE-013 chưa commit/push; index trống.

## Nguồn đã đọc, chỉ đọc

- [Figma chính, Website → PawFlow → Dashboard](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4620-30912); đọc high-fidelity context và screenshot từng màn dưới đây. Không dùng Archive.
- Dialog hồ sơ `5024:3425`, review `5024:3485`, khiếu nại `5024:3500`, log `5024:3527` đã đọc lại context và ảnh.
- [Proposal](https://docs.google.com/document/d/1wKi64dJuAjAQEmeSpXuUuB-MyI9nUzLrUinKDIvsp9Y/edit): §1.4, §7.3, Table 6, BR-01/09/10, UC-PRO-01; dùng để phân biệt điều đã mô tả với policy chưa đủ chi tiết.
- Báo cáo khảo sát trước `/tmp/pawflow-fe013-fe014-survey-2026-10-25.md`, tài liệu FE-007–012/015, AGENTS/README, tokens, shared avatar, shell/dialog Provider và hướng dẫn Next.js cài trong repo. Không sửa các file Provider hoặc auth của Nhi.
- [Backend dev tại SHA 4185523](https://github.com/quinnie-o3/PawFlow-API/tree/41855239c3c9e936503df17c0dfd2bad3a62a65a): đọc tree, providers/reviews/complaints services và các entity User, Provider, Review, Complaint, ServiceCategory. Nhánh `feature/admin-management` có cùng SHA với dev tại lúc khảo sát; tree chưa có module Admin riêng. Không coi tên nhánh hay code chưa merge là contract đã chốt; không ghi vào backend và không gọi API ứng dụng.

Các khác biệt cần giữ rõ:

- User entity có ACTIVE/INACTIVE/SUSPENDED; màn Figma chỉ có Hoạt động/Tạm khóa. Không tự lập mapping hoặc tác động tới booking/Staff.
- Provider entity có PENDING/APPROVED/REJECTED/SUSPENDED; không tự thêm thao tác đình chỉ hoặc tái duyệt vào UI.
- Category backend có name duy nhất và ACTIVE/INACTIVE, chưa có mã SV-/PET- như Figma. Mã ở UI là fixture, không phải field/API đã chốt; quan hệ với danh mục riêng Provider FE-009 chưa được quyết định.
- Complaint entity có OPEN/IN_REVIEW/RESOLVED/REJECTED; màn chính có ba trạng thái. Không tự thêm nhánh từ chối, mở lại hay hoàn tiền.
- ReviewsService kiểm tra booking COMPLETED và một review/booking, tính rating theo review đang hiển thị cho từng Provider. Điều đó chưa xác định công thức KPI toàn nền tảng hoặc tác động của ẩn/hiện lại review trong Admin.

## Route, màn và file

| Route | Node Figma chính | Feature/component |
| --- | --- | --- |
| `/admin` | `4695:14683` | `admin-overview/components/AdminOverviewPage.tsx` |
| `/admin/providers` | `4695:15111` | `admin-providers/components/AdminProvidersPage.tsx` |
| `/admin/users` | `4695:15509` | `admin-users/components/AdminUsersPage.tsx` |
| `/admin/categories` | `4695:15876` | `admin-categories/components/AdminCategoriesPage.tsx` |
| `/admin/reviews` | `4695:16258` | `admin-reviews/components/AdminReviewsPage.tsx` |
| `/admin/complaints` | `4695:16655` | `admin-complaints/components/AdminComplaintsPage.tsx` |
| `/admin/activity-logs` | `4695:17025` | `admin-activity-logs/components/AdminActivityLogsPage.tsx` |

Danh sách đường dẫn đã thông báo trước khi triển khai:

- `src/app/admin/layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx` và sáu `*/page.tsx`: routing, layout, ghép màn và boundary riêng cho Admin.
- `src/features/admin-shell/adminNavigation.ts`, `adminShell.module.css`, `components/{AdminShell,AdminHeader,AdminSidebar,AdminNavigation}.tsx`: branding, shell/menu/active và responsive. Tái sử dụng tokens, logo/backdrop có sẵn, Lucide và `UserAvatar`; không sửa Header/Sidebar/Provider dùng chung. Avatar trung tính phù hợp bản mock chưa tích hợp định danh auth.
- Mỗi feature trong bảng có `data/mock.ts` riêng và component trang riêng; Overview dùng cùng fixture hồ sơ để tránh tạo hàng đợi không khớp mẫu. Không có state cập nhật liên trang cần đồng bộ.
- `src/features/admin-workspace/types.ts`: view model chỉ đọc; `adminLogic.ts`: chuẩn hóa tìm kiếm/lọc; `hooks/useAdminMock.ts`: vòng đời tải fixture; `adminLogic.test.ts`: kiểm thử tìm/lọc. Không phải model API hay reducer nghiệp vụ.
- `src/features/admin-workspace/components/{AdminCollection,AdminPrimitives,AdminDialog}.tsx`, `admin.module.css`: các bảng có cùng cấu trúc, detail preview/modal, metrics chờ chốt và trạng thái tải. Modal dùng native dialog, focus ban đầu/trap/trả focus, Esc và click backdrop.
- `public/admin/status-{warning,success,danger,info}.svg`: bốn SVG trạng thái gốc từ Figma, kích thước 7×7px. Các icon menu dùng Lucide theo yêu cầu; không cài thêm dependency hoặc thay đổi lockfile/config.

## Hành vi mock đã triển khai

- Sáu bảng dùng đúng sáu hàng mẫu trên từng màn Figma. Tìm kiếm không dấu/có dấu, không phân biệt hoa thường; kết hợp với trạng thái/vai trò/loại. Bộ lọc chỉ nằm trong state trang; reload hoặc rời trang khôi phục mặc định, chưa đưa lên URL.
- Log thêm khoảng ngày bao gồm ngày đầu và ngày cuối, lọc trên ngày `YYYY-MM-DD` của fixture, không chuyển timezone theo máy. Khoảng ngược có thông báo lỗi và nút xóa lọc. Tag Admin/Cơ sở/Trạng thái là phân loại tường minh của từng dòng mẫu, không tính KPI.
- Mỗi hàng mở đúng chi tiết; phần xem nhanh được ghi nhãn là bản ghi đầu danh sách đang lọc. Không suy ra nội dung khiếu nại, review hay lịch sử chưa có trong thiết kế: trường thiếu ghi rõ chưa có trong fixture.
- Các nút thao tác thay đổi dữ liệu bị disabled kèm lý do chờ chốt. Thông tin quy tắc/quyền chỉ hiển thị nội dung có trong proposal; không tạo allowlist Staff.
- Các con số trong bảng (điểm review, số liên kết danh mục) là giá trị mẫu Figma. Số hàng kết quả là đếm để điều hướng danh sách; không phải KPI nghiệp vụ. Các thẻ KPI để `—`; chưa dùng số minh họa Figma 126/1.240/320/4,7… hoặc tính công thức.
- Mock load bất đồng bộ 250ms có cleanup, loading/busy, empty, lỗi/thử lại. Mục “Dữ liệu mô phỏng” cho xem tình huống lỗi, rỗng và khôi phục. Không lưu dữ liệu hoặc ghi log giả sau thao tác chưa chốt.
- Menu desktop/mobile đủ bảy route, active/aria-current, đóng khi chọn/click ngoài/blur/Esc; menu cuộn ở viewport thấp. Bảng cuộn ngang trong vùng riêng trên màn nhỏ; không tràn main/trang.

## Bảng quyết định cần người dùng chốt — chưa triển khai

| Nhóm | Đề xuất để xác nhận | Căn cứ / phần còn thiếu |
| --- | --- | --- |
| Tài khoản | Khóa/mở Customer, Owner, Staff với lý do và xác nhận; không đổi role hoặc khóa Admin. Chưa tác động booking. | Figma Người dùng có Tạm khóa; Table 6 tách vai trò. Chưa rõ INACTIVE/SUSPENDED, tác động liên đới và policy tự khóa Admin. |
| Duyệt/từ chối cơ sở | Chỉ hồ sơ Chờ duyệt; xem chi tiết rồi xác nhận; từ chối cần lý do. Không tái duyệt/đình chỉ. | UC-PRO-01 giới hạn hồ sơ chờ; proposal cho phép ghi lý do nhưng chưa bắt buộc, nên yêu cầu lý do vẫn là đề xuất. |
| Danh mục | Thêm/sửa tên, mã duy nhất trong từng loại; đề nghị tên cũng duy nhất sau chuẩn hóa trong từng loại. Ẩn chỉ ngừng chọn mới, giữ liên kết cũ. | Figma có mã/số liên kết/ẩn; DB chỉ có name duy nhất. Cần chốt validation, mã và quan hệ với danh mục riêng Provider trước khi làm form/lưu. |
| Review | Ẩn và hiển thị lại có lý do, giữ bản ghi; xác minh booking/người gửi. Chưa tính lại KPI. | Figma có giữ/ẩn; DB có isVisible và review gắn booking Completed. Lý do, báo cáo và điều kiện hiện lại chưa chốt. |
| Khiếu nại | Mới → Đang xử lý → Đã giải quyết; ghi chú theo hồ sơ, cần kết luận khi giải quyết; chưa mở lại/hoàn tiền/phạt. | Figma có ba trạng thái và dialog ghi chú; DB còn REJECTED nhưng chưa có quy trình Admin đủ để chốt transition. |
| KPI/kỳ báo cáo | Phân biệt số hiện tại với số trong kỳ; đề nghị định nghĩa chi tiết bên dưới trước khi tính. Hiện giữ `—`. | Figma ghi dữ liệu minh họa; backend rating từng Provider không xác định KPI toàn nền tảng. |

Đề xuất KPI để thảo luận, **chưa được xác nhận và không có trong code tính toán**:

- Số hiện tại: đếm cơ sở APPROVED; tài khoản ACTIVE thuộc Customer/Owner/Staff; dịch vụ ACTIVE của cơ sở APPROVED; khiếu nại OPEN hoặc IN_REVIEW. Cần chốt mốc snapshot và cách xử lý các trạng thái chưa có trên UI.
- Số trong kỳ: lịch hẹn theo `scheduledAt` (đề nghị bao gồm đủ sáu trạng thái và phân rã trạng thái); review tính `SUM(rating)/COUNT(review)` trên review hiển thị, booking Completed, theo ngày tạo review; không lấy trung bình của các trung bình Provider. Cần chốt làm tròn, kỳ rỗng và việc ẩn review ảnh hưởng kỳ cũ.
- Kỳ theo Asia/Ho_Chi_Minh, `[00:00 ngày đầu, 00:00 ngày sau ngày cuối)`; biểu đồ đề nghị bucket tuần có nhãn ngày cụ thể. Các thẻ thống kê ở màn con cần xác định cùng nguyên tắc snapshot/kỳ; chưa lấy số từ fixture để giả làm thống kê toàn hệ thống.

## Kiểm tra

- Provider trên code bàn giao: lint/typecheck/build đạt mới; browser **22/22 + 4/4** ở 1440/768/390; **99/99** logic test được giữ từ lượt trước vì logic không đổi. Local production: [Provider](http://localhost:3017/dashboard).
- Admin: `npm run lint`, `npx tsc --noEmit`, `npm run build` đạt; build đủ bảy route tĩnh. Chạy lại các lệnh liên quan sau thay đổi source cuối, không sửa lỗi ngoài phạm vi.
- Admin logic: biên dịch `src/features/admin-workspace/adminLogic.test.ts` bằng TypeScript có sẵn ra `/tmp/pawflow-fe013-validation/logic`, rồi `node --test /tmp/pawflow-fe013-validation/logic/admin-workspace/adminLogic.test.js`: **7/7 đạt**.
- Browser production ở 1440×1000, 768×1024, 390×844: **21/21 nhóm đạt** trước thay badge sang asset SVG gốc; đủ bảy route/reload/menu/Back-Forward, lọc/tìm, khoảng ngày, bảy modal/Esc/focus/Tab, loading/empty/error/retry, menu thấp 250px và smoke mười route Provider/Home/auth có sẵn. Không có page/console error. Một lượt đầu bị selector đụng route-announcer của Next; đã sửa scope test vào main, không sửa Next hoặc code ngoài phạm vi.
- Bổ sung trên production cuối sau đổi SVG: **21/21 tổ hợp màn/viewport** đạt, tải từng asset nhìn thấy sau scroll (không coi ảnh lazy-load trong Sidebar bị ẩn là lỗi), xác minh dot gốc và hình học render 7×7px, không tràn trang/main, modal trong viewport, Esc/trả focus. Thêm **3/3 nhóm** ở 1440/768/390 kiểm tra bốn dialog thông tin chỉ đọc và khóa thao tác tạo/sửa danh mục. Không có page/console error. Không thay source sau lượt kiểm tra này; manifest 42 file source/asset tại `/tmp/pawflow-fe013-validation/source-hashes.json`.
- Chưa kiểm thử Safari/Firefox, thiết bị thật/screen reader thật, API/auth backend, thao tác thay đổi dữ liệu hoặc công thức KPI chưa chốt. Không tuyên bố hoàn thành phần nghiệp vụ Admin hoặc toàn bộ FE-015–017.

Artifact ngoài repo: `/tmp/pawflow-fe013-validation/` chứa context thiết kế, test script `check.cjs`, `results.json`, ảnh trang và modal theo viewport; không cài Playwright vào project. `npm ci` giữ dependency/lockfile hiện tại; có cảnh báo audit sẵn từ dependency, không chạy audit fix ngoài phạm vi.

Local production: [Admin](http://localhost:3013/admin), [Duyệt cơ sở](http://localhost:3013/admin/providers), [Nhật ký](http://localhost:3013/admin/activity-logs). `lsof` xác nhận server chạy từ worktree FE-013, HTTP HEAD `/admin` trả 200. Hai server thử Admin trước đã dừng; giữ server production cuối. Không đụng server Provider có sẵn.

Trạng thái cuối: **43 file mới** (42 source/asset + tài liệu này), chưa stage/commit/push Admin. Tất cả file tracked từ origin/dev giữ nguyên, gồm Provider, auth, AGENTS, dependency/lockfile/config. Workspace Provider giữ nguyên AGENTS, file layout trên đĩa, bản phục hồi buffer và danh sách stash theo đối chiếu hash/byte. Các quyết định trong bảng vẫn chờ người dùng xác nhận.

## Đồng bộ kích thước shell Admin với Provider — 25/10/2026

- Thực hiện trên worktree `PawFlow-Admin-FE013`, nhánh `FE-013`, HEAD `3b69691`. Chưa commit/push/PR. Chỉ sửa source `src/features/admin-shell/adminShell.module.css` và bổ sung tài liệu này; giữ nguyên các component, bảy màn, mock, thao tác disabled và KPI `—`.
- Đã đọc AGENTS, README, tài liệu Admin/Provider và hướng dẫn CSS Modules của Next.js cài trong repo trước khi sửa. Chuẩn là layout Provider trên FE-015 tại `9e4bdb18cb0e7c267bd920692e6028c445c40242`; `git ls-remote` xác nhận FE-015 vẫn ở SHA này, dev vẫn ở `3b69691a5c740cc9259ce987c108bc9bacee7417`. Không dùng khung hẹp Figma để giới hạn lại workspace.
- Đo trực tiếp hai role bằng Chromium production, cùng viewport, device scale 1 và `visualViewport.scale = 1` (zoom 100%). Provider tại `http://localhost:3017/dashboard`, Admin mới tại `http://localhost:3018/admin`.

| Viewport | Header Admin trước | Header Admin sau = Provider | Lề trái/phải Admin trước | Lề trái/phải Admin sau = Provider | Sidebar Admin sau = Provider |
| --- | --- | --- | --- | --- | --- |
| 1440×1000 | 120px | 68px | 100px / 100px | 32px / 32px | 285px |
| 768×1024 | 80px | 68px | 24px / 24px | 24px / 24px | Ẩn; dùng menu Header |
| 390×844 | 72px | 68px | 12px / 12px | 16px / 16px | Ẩn; dùng menu Header |

Lề trong bảng tính từ cạnh viewport tới cạnh workspace. Lề trên/dưới workspace Admin đổi từ 20/20/12px thành 24/16/16px theo ba viewport, khớp Provider. Padding trong workspace thành 20px ở cả ba (trước là 20/20/12px); gap giữa Sidebar/main giữ 20px. Header có padding ngang 72px từ 1440px, 16px bên dưới, cùng Provider.

- Bỏ `max-width: 1240px`; từ 1280px lề ngoài 32px, tablet từ 640px là 24px, dưới 640px là 16px. Tại 1440px, workspace 1240 → 1376px và main 895 → 1031px; Sidebar giữ 285px. Phần rộng thêm dành cho main.
- Sidebar padding 20 → 18px, brand cao 90 → 68px; margin trên/dưới brand 42/92 → 0/20px, margin sau tài khoản 28 → 18px. Avatar vẫn 54px. Item cao 54 → 44px, gap 0 → 4px, bỏ margin âm và bo cả hai đầu active item. Active rộng 249px, chừa 18px mỗi bên. Vị trí/kích thước brand, tài khoản và active item tại 1440px khớp trực tiếp Provider.
- Logo Header dùng vùng 145×48px; gap khối tài khoản 14px, gap menu Header 50px và breakpoint menu thu gọn dưới 1440px theo Provider. Giữ riêng định danh, avatar trung tính và bảy menu Admin.
- Shell cao `100dvh`, Header không co; main cuộn riêng và chặn cuộn lan ra trang. Sidebar đứng yên, danh sách menu dài cuộn nội bộ. Trang không cuộn; modal tiếp tục dùng native dialog và cuộn riêng khi cần. Sidebar ẩn dưới 1024px như Provider.

Kiểm tra trên source cuối:

- `npm run lint`: đạt. `npx tsc --noEmit`: đạt. `npm run build`: đạt, đủ bảy route Admin. Không sửa config, dependency hoặc file tự sinh.
- Browser **21/21 tổ hợp**: đủ bảy màn tại 1440×1000, 768×1024, 390×844; lề cân đối, không tràn trang/main, bảng cuộn ngang trong vùng riêng, tới được cuối main, Header/Sidebar không dịch chuyển, cuộn cuối main không cuộn toàn trang. Đã xem ảnh đầu/cuối và modal của cả 21 tổ hợp.
- Modal ở cả 21 tổ hợp: trong viewport, không tràn ngang, tới được nút Đóng, focus ban đầu, Tab/Shift-Tab, Esc và trả focus đạt. Navigation giữa các màn, active, reload, Back/Forward đạt; Header desktop không chồng logo hoặc khối tài khoản.
- **3/3 nhóm bổ sung** đạt: menu tablet/mobile đóng bằng Esc/click ngoài/chọn cùng route và dùng được ở chiều cao 250px; khung linh hoạt tại 1024/1280/1920px, Sidebar luôn 285px, menu Sidebar dài cuộn riêng ở chiều cao 600px, tới được mục cuối mà main/trang không cuộn theo. Không có page/console error.
- Lượt script đầu timeout do selector role không tìm Sidebar đang ẩn trên tablet; sửa selector trong script ngoài repo và chạy lại đầy đủ, không sửa ứng dụng để né kiểm tra. Không ghi nhận lỗi ứng dụng trong lượt cuối.
- Chưa chạy Safari/Firefox, thiết bị thật, screen reader thật, backend/API/auth hoặc thao tác nghiệp vụ đang khóa; không chạy lại logic test vì chỉ đổi CSS. Các quyết định chờ chốt vẫn là tài khoản/khóa mở, duyệt/từ chối cơ sở, validation và quan hệ danh mục, ẩn/hiện review, quy trình khiếu nại và KPI/kỳ báo cáo ở bảng phía trên.
- Bằng chứng nằm ngoài repo tại `/tmp/pawflow-fe013-layout-20261025/`: `before-measurements.json`, `after-measurements.json`, `results.json`, `check.cjs`, `measure.cjs`, ảnh đầu/cuối/modal và contact sheet. Snapshot hash trước/sau đối chiếu cả hai worktree, AGENTS, stash và backup; không mở/lưu/bỏ buffer trong editor.

Local mới: [Admin](http://localhost:3018/admin). Server Provider và các phiên local cũ được giữ nguyên.

## Rà soát và bàn giao UI chỉ đọc — 25/10/2026

- Worktree `/Users/tom/Desktop/PawFlow/PawFlow-Admin-FE013`, nhánh `FE-013`, nền `origin/dev` tại `3b69691`. Khi bắt đầu, index trống và có 43 file Admin chưa track. Đã đọc AGENTS, README, tài liệu FE-013/Provider, source và hướng dẫn CSS/Link/usePathname từ Next.js cài trong worktree.
- Đối chiếu hash với lượt đồng bộ layout: toàn bộ 228 file Admin và 186 file Provider khớp snapshot. Workspace Provider vẫn ở FE-015 `9e4bdb1`, chỉ có AGENTS sửa riêng; không chuyển nhánh hoặc thao tác editor. AGENTS của hai worktree, file layout Provider trên đĩa, bản phục hồi buffer chưa lưu, 24 file backup Git và ba stash được giữ nguyên.
- Bổ sung kiểm tra từ cuối một màn sang màn khác phát hiện main có thể giữ vị trí cuộn, hoặc Next đưa nội dung lên sát mép và che banner Admin. Thêm `src/features/admin-shell/components/AdminMain.tsx`, ghép vào `AdminShell.tsx`: main có key theo pathname nên mỗi route mở bằng vùng cuộn mới tại đầu trang. Header/Sidebar không remount. CSS và toàn bộ logic/fixture/thao tác disabled giữ nguyên sau sửa cuối.
- Phạm vi bàn giao là **44 file mới**: 43 source/asset và tài liệu này. Không có thay đổi tracked từ nền dev; không gồm AGENTS, auth/API, Provider, dependency/lockfile/config, backup hoặc artifact kiểm thử. Stage theo từng đường dẫn; commit mô tả “Admin UI mock chỉ đọc”, push thường lên origin/FE-013; PR mục tiêu là Draft FE-013 → dev. Không merge, không sửa bảng task và không xác nhận hoàn tất toàn bộ FE-013.

Kiểm tra thực chạy trên source cuối:

- `npm run lint`, `npx tsc --noEmit`, `npm run build`: cả ba đạt, exit 0; build đủ bảy route Admin tĩnh. Đã chạy lại sau lần sửa source cuối.
- Chromium production `http://localhost:3019`: **21/21 tổ hợp** bảy màn × 1440×1000 / 768×1024 / 390×844 đạt. Kiểm tra khung rộng, Header 68px, lề 32/24/16px, padding workspace 20px, gap 20px, Sidebar 285px; active nằm trong Sidebar. Không tràn ngang trang/main; bảng cuộn ngang riêng; main cuộn đến cuối; Header/Sidebar không dịch chuyển; cuộn không lan ra trang.
- Bổ sung trong cả 21 tổ hợp: route trực tiếp mở tại `scrollTop = 0`, banner trong viewport; cuộn cuối rồi chuyển route qua Sidebar/menu cũng về `scrollTop = 0`. Reload, Back/Forward, modal, focus/Tab/Shift-Tab/Esc/trả focus đạt. Đã xem ảnh đầu/cuối/modal của cả ba kích thước.
- **3/3 nhóm bổ sung** đạt: menu tablet/mobile với keyboard, click ngoài, chọn cùng route và viewport cao 250px; khung 1024/1280/1920px và Sidebar cuộn riêng ở chiều cao 600px. Không có page error hoặc console error.
- `lsof` xác nhận production cổng 3019 chạy từ worktree Admin; HTTP HEAD `/admin` trả 200. Chỉ khởi động lại server 3019 do lượt này tạo khi build thay đổi; không thao tác server Provider.

Kết quả dùng lại, không chạy lại:

- **7/7 logic test** tìm kiếm/lọc/ngày và kiểm tra hành vi mock/loading/empty/error/retry của lượt triển khai trước: source logic, fixture và component collection/overview không đổi. **3/3 nhóm dialog thông tin/khóa danh mục** giữ nguyên kết quả trước. Snapshot hash chứng minh không đổi các file tương ứng.
- Kích thước đối chiếu trực tiếp với Provider trong `after-measurements.json` của lượt layout trước vẫn áp dụng: Provider và CSS shell Admin không đổi. Không chạy lại 99 test Provider hoặc hồi quy nghiệp vụ Provider vì không sửa Provider.
- Chưa kiểm tra Safari/Firefox, thiết bị thật/screen reader thật, API/auth, ghi dữ liệu hoặc công thức KPI. Các quyết định nghiệp vụ vẫn là sáu nhóm trong bảng phía trên; chưa xác nhận thêm quy tắc nào trong lượt này.

Bằng chứng mới ngoài repo: `/tmp/pawflow-fe013-handover-20261025/` chứa snapshot bảo toàn, `source-hashes.json`, script `check.cjs`, `results.json`, ảnh và contact sheet. Các kết quả layout/hành vi trước vẫn ở hai thư mục artifact đã ghi phía trên.

Local để review bản bàn giao: [Admin](http://localhost:3019/admin), [Duyệt cơ sở](http://localhost:3019/admin/providers), [Nhật ký](http://localhost:3019/admin/activity-logs).
