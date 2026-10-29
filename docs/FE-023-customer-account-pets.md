# FE-023 — Customer: tài khoản và thú cưng

Ngày cập nhật: 29/10/2026, Asia/Ho_Chi_Minh. Bước 4/5 QA toàn cụm Customer account/pets đã đạt; còn bước 5/5 commit/push và một PR vào dev cho Nhi review. Chưa thực hiện thao tác Git bàn giao. Các mục bước 2 và 3 bên dưới là mốc kiểm tra lịch sử; kết quả áp dụng cho bản cuối được ghi riêng ở bước 4.

## Phạm vi và nền Git

- Triển khai sớm FE-023 UI/mock theo xác nhận của người dùng. Một nhánh FE-023, một PR dự kiến vào dev; chưa stage/commit/push/PR/merge hoặc cập nhật assignee/bảng task.
- Worktree /Users/tom/Desktop/PawFlow/PawFlow-Customer-FE023, nền origin/dev tại 3b69691a5c740cc9259ce987c108bc9bacee7417. Fetch và kiểm tra nhánh/PR mở trước triển khai: chưa có nhánh hoặc source Customer mới trùng phạm vi của Nhi. Auth hiện hành từ 23d8bbc giữ nguyên.
- Không kế thừa commit riêng của FE-013/014/015 chưa merge. Giữ nguyên các worktree dashboard, AGENTS sửa riêng, layout Provider, backup, buffer và ba stash.
- Không sửa auth/API, Header/Sidebar dùng chung, Provider, globals, dependency/lockfile hoặc config.
- FE-018 là inventory toàn bộ non-dashboard; FE-025 shared UI/notifications và FE-026 QA toàn non-dashboard. Phần làm cho cụm này không có nghĩa hoàn tất toàn bộ các task đó. Tích hợp tài khoản/pet API thuộc FE-031 sau nền auth FE-028.

## Nguồn thiết kế và contract

- Customer chính trong Website → PawFlow → Profile, ngoài Archive:
  - [Thông tin tài khoản 4818:14074](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4818-14074), dialog sửa 4821:14139.
  - [Thú cưng của tôi 4834:14409](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4834-14409), thêm 4834:14602, sửa 4834:14582, xóa 4834:14620.
- Bước 2 đọc lại high-fidelity design context/screenshot hai màn chính và dialog tài khoản. Asset shell tải trực tiếp từ URL asset của context vào public/customer-account/; không dùng URL Figma tạm khi chạy. SVG giữ nguyên nội dung/kích thước root; hai avatar PNG mẫu hiển thị 54×54px.
- Bố cục Customer: Header 120px trên desktop; sidebar 285px; main dùng hết phần ngang còn lại. Tại 1440px lề 120px, gap 21px, main 894px. Trên màn rộng lề giới hạn 120px để tránh khoảng trống quá lớn; tablet/mobile dùng main toàn chiều rộng và menu thu gọn. Be Vietnam Pro và Assistant chỉ nạp trong layout Customer, giữ tokens toàn cục.
- Proposal §7.1, Table 6, FR-CUS-PET-01: Customer quản lý hồ sơ/pet của mình; tài khoản cá nhân khác Hồ sơ cơ sở Provider.
- Contract khảo sát: PawFlow-API dev tại 41855239c3c9e936503df17c0dfd2bad3a62a65a; GET/PATCH /api/users/me, chỉ PATCH fullName/phone; pet CRUD chỉ CUSTOMER và kiểm tra owner. Bước 2 không gọi API.

## Quyết định được người dùng chốt

- Hai route /account, /account/pets; chi tiết pet bằng dialog.
- Tài khoản sửa tên/phone; email chỉ đọc, chưa sửa/lưu địa chỉ. Không thêm address vào model hoặc payload; màn xem và dialog ghi rõ chưa hỗ trợ.
- Tên trim 2–150 ký tự; phone tối đa 20 ký tự sau trim, không bắt buộc, không áp quy tắc điện thoại Provider.
- DTO PATCH biến phone rỗng sau trim thành undefined: UI ghi rõ để trống giữ số đang lưu; không tự biến chuỗi rỗng thành thao tác xóa. Phone hiện tại null được hiển thị là chưa có; không suy ra quy tắc xác minh/số Việt Nam.
- Pet: tên, loài, giống, ngày sinh tùy chọn, cân nặng, ghi chú. Tính tuổi từ ngày sinh, không suy ra ngày sinh từ tuổi; chặn ngày tương lai.
- Một ảnh tùy chọn/pet, JPEG/PNG/WebP tối đa 5 MiB; kiểm tra MIME/nội dung/giải mã. Chọn/thay trong draft, chỉ Save mới áp dụng; quản lý và thu hồi object URL khi thích hợp.
- Xóa mềm khỏi lựa chọn cho lịch mới; giữ record/lịch cũ. Không tạo xóa vĩnh viễn/restore.
- Chưa làm khôi phục mật khẩu, notification, discovery, booking, lịch sử/review hoặc API. Các đích chưa triển khai và nút đổi mật khẩu hiển thị disabled/chưa hỗ trợ, không gắn link giả hoặc báo thành công giả.
- Mock chung ở layout /account, giữ hồ sơ khi chuyển hai tab; reload hoặc rời khu vực khôi phục fixture. Không đọc/ghi token, storage, thay redirect/guard của Nhi.
- Kiểm tra owner là logic mock, không phải ranh giới bảo mật backend. UI ghi rõ chưa xác thực quyền truy cập máy chủ.

## Đã triển khai ở bước 2

- Shell/navigation Customer riêng, không dùng danh tính/menu Provider. Hai tab là link route có active state; desktop sidebar và menu thu gọn hỗ trợ bàn phím, Esc, đóng khi click ngoài/rời focus.
- Workspace provider trong layout chứa hồ sơ mẫu độc lập. Tên đã lưu cập nhật trên màn hồ sơ, sidebar và tên truy cập avatar.
- Xem/sửa hồ sơ với draft riêng. Cancel/Đóng/Esc/backdrop bỏ draft. Save chỉ áp dụng allowlist tên/phone sau validation.
- Pending có độ trễ mô phỏng, khóa gửi lặp và đóng dialog/field trong lúc xử lý. Lỗi giữ dữ liệu đã lưu và draft; thử lại được. Checkbox thử lỗi một lần chỉ bị tiêu thụ khi request hợp lệ.
- Dialog native có tên/mô tả, focus vào tên khi mở, lỗi đầu tiên khi validation thất bại, Tab/Shift+Tab và trả focus khi đóng. Error/success/pending có phản hồi truy cập được.
- Route pet chỉ có shell/tab/header và thông báo tính năng chưa sẵn sàng; không hiển thị false empty hoặc giả lập pet CRUD. Điểm ghép là CustomerPetsPage; bước 3 mở rộng cùng CustomerWorkspaceProvider để lưu pets/actions và vòng đời URL.

## Tổ chức file

- src/app/account/layout.tsx, page.tsx và pets/page.tsx: routing, font, ghép workspace/shell/màn.
- src/features/customer-workspace/CustomerWorkspaceProvider.tsx: state hồ sơ trong layout.
- src/features/customer-shell/components/: shell, Header, Sidebar, tab navigation, asset renderer và dialog riêng; customerShell.module.css.
- src/features/customer-account/: types, fixture, profileLogic/test, hook editor, page/dialog và account.module.css.
- src/features/customer-pets/components/CustomerPetsPage.tsx: điểm ghép bước 3.
- public/customer-account/: 11 SVG nguyên bản branding/navigation và hai PNG avatar mẫu từ Figma.

## Phạm vi đã chốt cho bước 3 — pet

- Mở rộng workspace bằng danh sách pet và catalog loài ACTIVE mẫu; không đoán endpoint danh mục.
- Danh sách/chi tiết/thêm/sửa; draft độc lập, validation theo DTO; ngày sinh date-only và tuổi theo lịch Asia/Ho_Chi_Minh.
- Ảnh: kiểm tra 5 MiB, MIME/signature/giải mã, pending decoder, thay/bỏ draft, Save/Cancel/error/retry; thu hồi URL và bỏ kết quả async về muộn.
- Xóa mềm đúng pet, xác nhận tác động, giữ record; list active/empty/no-result và focus sau khi hàng biến mất.
- Mutation/lỗi/pending/retry đồng bộ trong cùng workspace; không đụng auth/dữ liệu Provider.
- Không có câu hỏi nghiệp vụ đang chặn bước 3 theo phạm vi đã chốt. API catalog loài/upload/auth là phần tích hợp tương lai, không chặn UI/mock.

## Kiểm tra bước 2

- Typecheck: lần đầu ở worktree mới thiếu generated route types nên root layout báo TS2304 LayoutProps. Chạy npx next typegen, sau đó npx tsc --noEmit --incremental false đạt, exit 0; không sửa source root/config hoặc generated types bằng tay.
- npm run lint: đạt, exit 0, không warning.
- npm run build: đạt, có hai route static /account và /account/pets.
- Sáu test profileLogic đạt: biên tên sau trim, phone tùy chọn/20 ký tự/không áp Provider format, phone rỗng giữ giá trị/null, allowlist/identity, mock owner và fixture/draft độc lập. Compile test riêng ra artifact ngoài repo, chạy Node test runner; không thêm dependency/script/config.
- Chromium production: 15/15 nhóm tập trung vào shell/hồ sơ đạt. Bao phủ draft/Cancel/Esc/backdrop/focus/Tab/Shift+Tab, validation, pending/chặn gửi lặp/khóa đóng, failure/retry, cập nhật danh tính, phone trống, state qua tab/Back/Forward, reload và rời/re-enter bằng tải route, tên 150 ký tự.
- Kiểm tra hiển thị shell/hồ sơ/dialog và scaffold pet tại 1440×1000, 1920×1080, 768×1024, 390×844; không tràn ngang. Main lần lượt xấp xỉ 894/1374/720/358px. Menu thu gọn/Esc/focus đạt. Đã xem ảnh desktop, mobile, dialog mobile và scaffold tablet.
- Không có page/console error, request /api/ hoặc truy cập key token từ phần Customer trong lượt kiểm tra. 13/13 asset hiển thị đã tải, có kích thước và naturalWidth hợp lệ; kiểm tra riêng hai trạng thái tab. Không dùng ảnh render Figma làm UI hoặc URL Figma tạm khi chạy.
- git diff --check đạt; kiểm tra whitespace riêng cho 21 file source/test/docs mới vì chúng chưa track cũng đạt.
- So snapshot trước bước 2: ba worktree cũ không đổi file/status/HEAD; backup trong .git/pawflow-preservation không đổi; ba stash nguyên. Không thao tác buffer chưa lưu. Worktree FE-023 có đúng 34 file mới (20 source/test, một tài liệu, 13 asset); không có tracked diff hoặc staged file.
- Artifact kiểm tra ngoài repo: /var/folders/sb/q3ltb0pn51j1ph9g6_wrdhrh0000gn/T/fe023-step2-c5husisy/ gồm browser-results.json, geometry-assets.json, all-asset-slots.json, preservation-final.json, test đã compile và screenshot.
- Local production: http://localhost:3023/account và http://localhost:3023/account/pets, xác minh listener và HTTP 200 cho cả hai.

Kết quả trên thuộc mốc bước 2, chưa phải QA toàn cụm. Tại mốc đó chưa kiểm tra pet CRUD/ảnh/xóa; phần này được bổ sung ở bước 3 dưới đây. API/backend/auth, toàn bộ non-dashboard, Safari/Firefox hoặc thiết bị/screen reader thật chưa được kiểm tra. Chưa tuyên bố hoàn tất toàn bộ FE-023, FE-025 hoặc FE-026.

## Bước 3 — quản lý thú cưng

- Tiếp tục cùng branch/worktree, không tạo lại shell hoặc hồ sơ. Nguồn thiết kế là màn Customer 4834:14409 và ba dialog thêm/sửa/xóa đã nêu trên; đọc lại design context. Ảnh Milo tải từ đúng asset bbab8.png của màn chính, lưu nguyên bản public/customer-pets/milo.png (120×120, 27.658 byte), hiển thị 60×60 ở card. Chi tiết là dialog theo quyết định người dùng, không suy ra một page mới từ tên layer.
- Fixture có Milo của customer-demo và hai loài demo ACTIVE Chó/Mèo. Ngày sinh 2023-05-20 là dữ liệu mẫu tường minh từ ví dụ DTO, không chuyển ngược từ chữ “3 tuổi” trên Figma. ID/catalog chỉ là fixture, không coi là danh mục hoặc ID backend thật.
- State pet/catalog được thêm vào CustomerWorkspaceProvider bằng usePetsWorkspace. Hồ sơ Customer và pet cùng sống trong layout /account; chuyển tab giữ state, reload/rời khu vực khôi phục fixture. Form/draft và request chờ chỉ thuộc trang pet; rời trang hủy request chưa hoàn tất.
- Card và dialog chi tiết luôn lấy record hiện hành theo ID từ cùng state; sửa từ chi tiết rồi lưu sẽ quay lại chi tiết mới. Không giữ snapshot thông tin cũ trong dialog.
- create/update/deactivate đi qua command thuần: kiểm tra role CUSTOMER, owner, status ACTIVE, version và validation trước khi thay state. Chỉ nhận allowlist trường pet; không nhận owner/status/id/version từ draft. Lỗi mô phỏng trả nguyên state cũ, không đổi record, version hoặc ảnh. Đây là kiểm tra mock phía client, không phải phân quyền backend.
- Loading/refresh có độ trễ mô phỏng; lỗi tải giữ record đã lưu và có retry. Empty thật xuất hiện khi không còn pet ACTIVE của Customer mẫu. Không tạo fake booking hoặc fake lịch sử để minh họa.
- Mutation có pending, chặn gửi lặp, khóa đóng trong lúc lưu/xóa, phản hồi thành công/thất bại và retry giữ draft. Sau tạo/sửa từ card, focus tới pet tương ứng; xóa trả focus pet kế tiếp hoặc nút thêm nếu list trống. Xác nhận xóa ưu tiên focus “Giữ hồ sơ”.
- Không mở rộng auth/token, profile/address/password, discovery, booking, notification hoặc API. Hai thay đổi nhỏ cho dialog Customer dùng chung: nhãn đóng tùy mục đích, mặc định profile giữ nguyên; tiêu đề cho phép xuống dòng để tên pet hợp lệ 100 ký tự không gây tràn ngang.

### Validation pet

- Tên bắt buộc, trim 1–100 ký tự; giống tùy chọn tối đa 100 sau trim, giữ dấu và khoảng trắng bên trong. Đếm Unicode theo ký tự, không coi surrogate pair là hai ký tự riêng.
- Loài bắt buộc, phải có trong catalog ACTIVE mẫu. Giữ loài đã inactive khi sửa record vốn dùng loài đó theo hành vi DTO/service hiện tại; không cho chọn mới loài inactive.
- Ngày sinh tùy chọn, date-only YYYY-MM-DD hợp lệ theo lịch, không sau ngày hiện tại Asia/Ho_Chi_Minh. Tuổi tính từ ngày sinh và ngày hiện tại; không có ngày sinh thì hiển thị chưa có, không tạo ngày giả. Chưa đủ năm hiển thị tháng hoặc dưới một tháng.
- Cân nặng trống/whitespace là null, khác số 0. Giá trị phải finite, >0, ≤9999,99 và tối đa hai số thập phân; nhận dấu phẩy hoặc dấu chấm thập phân. Kiểm tra độ chính xác trên giá trị số đã chuẩn hóa, nên 1.230 tương đương 1.23.
- Giống, ngày sinh, cân nặng và ghi chú trống trong bản nháp được chuẩn hóa null khi lưu, dùng khả năng clear nullable fields của UpdatePetDto. Tên/loài không nhận null.
- Ghi chú tùy chọn, trim đầu/cuối, giữ xuống dòng bên trong. DTO không công bố maxLength cho ghi chú, không đặt thêm giới hạn. Không thêm min-age, ngày sinh tối thiểu, bắt buộc ảnh, trùng tên, định dạng giống hoặc giới hạn kích thước pixel chưa có căn cứ.

### Vòng đời ảnh

- Một ảnh/pet, JPEG/PNG/WebP, tối đa đúng 5×1024×1024 byte. Từ chối file rỗng/MIME không hỗ trợ/trên giới hạn trước khi tạo URL; kiểm tra signature và browser decode, naturalWidth/naturalHeight khác 0. Không crop hoặc ghi lại file gốc.
- Ảnh mới có preview trong draft. Card/record chỉ đổi sau command Save thành công. Lỗi Save giữ cả ảnh đã lưu và ảnh draft để thử lại; Cancel/đóng/Esc bỏ draft.
- Decoder dùng AbortController và generation. Chọn file mới hủy yêu cầu trước; kết quả cũ về muộn bị bỏ và URL được thu hồi. Đóng form hoặc rời route cũng hủy decoder/request chờ. Save bị chặn trong lúc kiểm tra ảnh.
- Layout quản lý registry URL có tham chiếu draft và saved riêng. Khi Save thành công: đăng ký tham chiếu saved trước khi nhả draft. Vì vậy chuyển hai tab hoặc mở lại dialog không làm hỏng ảnh đã lưu.
- Thu hồi URL draft khi bị thay/bỏ/Cancel, URL giải mã lỗi hoặc kết quả cũ, và ảnh cũ sau khi record thay ảnh. “Bỏ lựa chọn ảnh mới” quay về ảnh đã lưu; chưa thêm thao tác xóa riêng ảnh đã lưu.
- Record INACTIVE vẫn giữ ảnh tham chiếu để không làm mất bản ghi. URL của ảnh này còn sống đến khi workspace kết thúc; không coi việc không còn hiển thị ở active list là lý do thu hồi sớm. Unmount toàn layout thu hồi mọi URL còn được registry sở hữu, không thu hồi asset fixture.
- Không upload, base64 persistence, storage hoặc URL máy chủ. Quy tắc upload/catalog thật vẫn cần contract ở giai đoạn tích hợp, không chặn bản UI/mock này.

### Tổ chức bổ sung

- customer-pets/types.ts, data/customerPetsMock.ts, petLogic.ts và petLogic.test.ts: model/fixture/command/validation/ownership.
- petImageValidation.ts, petImageRegistry.ts, petImages.test.ts: giới hạn file, decode và quyền giữ URL.
- hooks/usePetsWorkspace.ts, usePetEditor.ts, useCustomerPetsPage.ts và mockDelay.ts: state chung, draft, cancellation, loading/mutation/focus.
- components/PetCard.tsx, PetPhoto.tsx, PetFormDialog.tsx, PetDetailsDialog.tsx, PetDeleteDialog.tsx và pets.module.css; CustomerPetsPage ghép các phần này.

### Kiểm tra bước 3

- npx tsc --noEmit --incremental false: đạt, exit 0, trên bản TypeScript cuối.
- npm run lint và npm run build: đạt, exit 0, sau sửa focus xác nhận xóa và CSS bọc tiêu đề dài. Lỗi lint effect tải mẫu ở lần đầu đã được sửa trong hook pet; không sửa config hoặc phần ngoài cụm.
- 20/20 test logic/ảnh đạt: biên tên/giống/loài/ngày/tuổi/cân nặng, nullable fields, không tự cap ghi chú, owner/role/version/status, create/update/deactivate bất biến và lỗi trả state cũ; MIME/signature/5 MiB và tham chiếu URL draft/saved/INACTIVE/dispose. Chạy bản compile riêng ngoài repo bằng Node test runner. Source các logic này không đổi sau lượt test.
- Chromium production: 22/22 nhóm pet đạt trên bản cuối. Bao phủ loading, validation, thêm với trường tùy chọn trống, Save/Cancel/duplicate submit/pending, failure/retry, chi tiết lấy dữ liệu mới, clear giống, cập nhật DOB/weight/note, lỗi tải/retry, xác nhận đúng pet, soft delete/giữ record và ảnh, empty thật/focus, hủy request khi rời route, reload reset.
- Ảnh kiểm tra thực: JPEG/PNG/WebP; file rỗng, MIME không hỗ trợ, signature sai, signature đúng nhưng decode hỏng, >5 MiB, đúng 5 MiB; chọn liên tiếp/decoder cũ về muộn; Cancel khi decoding; Save lỗi giữ cả ảnh cũ/draft; retry mới chuyển ảnh và thu hồi ảnh cũ. URL được theo dõi trong browser để kiểm tra không double revoke hoặc thu hồi sớm.
- Kiểm tra pet list/form/detail tại 1440×1000, 768×1024, 390×844: không tràn ngang; Tab/Shift+Tab/Esc và focus đạt, form cuộn tới ngày/ảnh/nút lưu. Đã xem screenshot list desktop, form/date/image mobile và details tablet. Kiểm tra bổ sung tên 100 ký tự trên mobile: dialog rộng 358px, scrollWidth 358px; sửa từ chi tiết rồi đóng trả focus đúng card.
- Shared workspace được kiểm tra tác động tối thiểu: ảnh pet vẫn sống khi chuyển sang hồ sơ, sửa tên Customer và quay lại; dialog hồ sơ giữ autofocus/Save/trả focus. Dùng lại sáu test profileLogic và bộ shell/hồ sơ bước 2 vì source riêng của chúng không đổi; chưa chạy lại QA đầy đủ của cả cụm.
- Không có page/console error, request /api/ hoặc truy cập token trong luồng pet được kiểm tra. HTTP 200 cho /account và /account/pets, listener đúng worktree tại http://localhost:3023.
- Artifact ngoài repo: /var/folders/sb/q3ltb0pn51j1ph9g6_wrdhrh0000gn/T/fe023-step3-9mh3fftm/ gồm test đã compile, browser-results.json, screenshot, preservation-final.json và final-source-manifest.json. Các lượt browser đầu dừng ở selector alert trùng route announcer và focus ban đầu của xác nhận xóa; selector kiểm tra đã được thu hẹp, focus đã sửa trước kết quả đạt cuối.
- Giữ nguyên ba worktree dashboard, AGENTS riêng, layout Provider, backup đã snapshot và ba stash; không thao tác buffer. Tất cả source hồ sơ và Header/Sidebar/Navigation Customer từ bước 2 giữ nguyên hash; chỉ mở rộng workspace, page pet, dialog label/CSS và tài liệu như mô tả. Không staged file, tracked diff, commit/push/PR/merge hoặc cập nhật task.

Đây là kiểm tra trọng tâm bước 3, không phải QA toàn cụm. Chưa kiểm tra backend/API/auth, browser khác Chromium, thiết bị hoặc screen reader thật; phần QA tổng hợp còn ở bước 4.

## Bước 4 — QA toàn cụm Customer account/pets

### Kết quả và phạm vi sửa

- Đạt QA trong phạm vi UI/mock đã chốt. Không khảo sát lại thiết kế, thêm tính năng hoặc sửa auth/API. Dùng các frame Customer chính đã xác minh ở phần nguồn thiết kế; không dùng Archive hoặc shell dashboard Provider.
- Phát hiện race focus sau thêm/sửa/xóa: requestAnimationFrame có thể focus card trước khi cleanup của CustomerDialog trả focus về nút mở. Log browser tái hiện card nhận focus rồi mất focus về nút thêm. Chỉ sửa hooks/useCustomerPetsPage.ts: giữ ID đích và focus bằng effect sau khi dialog đóng và pending kết thúc. Không thay CustomerDialog dùng chung hoặc hồ sơ/shell.
- Đã kiểm tra focus qua ba vòng thêm → sửa → xóa liên tiếp và ca xóa pet cuối/empty trên cả bốn viewport. Không còn lỗi trong phạm vi kiểm tra đã chạy. Không có câu hỏi quyết định đang chặn bước 5.
- File thay đổi so với đầu bước 4: src/features/customer-pets/hooks/useCustomerPetsPage.ts và tài liệu này. Các source/asset/test khác giữ nguyên hash.

### Kiểm tra thực chạy trên bản cuối

| Kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| npm run lint | Đạt, exit 0 sau sửa focus | lint.log |
| npx tsc --noEmit --incremental false | Đạt, exit 0 sau sửa focus | typecheck.log |
| npm run build | Đạt, exit 0; hai route static | build.log |
| Chromium production, 9 nhóm luồng tổng hợp | 9/9 đạt | flow-results.json |
| Chromium production, 1440×1000 và 1920×1080 | 10/10 nhóm đạt | desktop-results.json |
| Chromium production, 768×1024 và 390×844 | 11/11 nhóm đạt, gồm kiểm tra lỗi JS/API/token | mobile-results.json |
| Decoder muộn qua unmount layout; hồi quy focus ba vòng | 2/2 nhóm đạt | extra-results.json |

Tổng 32/32 nhóm browser trên cùng source/build cuối, locale vi-VN và múi giờ Asia/Ho_Chi_Minh. Các lần điều chỉnh harness do preview fixture trùng tên file ảnh mới, công cụ mock đóng sau remount, font fallback chưa dùng và ảnh trong menu details đóng được lưu riêng; chúng không phải lỗi source. Chỉ các nhóm đã thực sự chạy đạt được cộng vào kết quả cuối.

- Navigation: hai URL trực tiếp, tab active/aria-current, Back/Forward, reload; menu tablet/mobile mở/đóng bằng Esc, click ngoài, rời focus và điều hướng; skip link tới main. Không đổi redirect/guard của Nhi.
- State: tên/phone/pet/ảnh đã lưu giữ nguyên qua hai tab và lịch sử browser. Rời toàn layout bằng điều hướng client tới route login có sẵn rồi quay lại khôi phục đồng thời cả hai fixture; không thực hiện đăng nhập hoặc đọc/ghi token. Reload cũng khôi phục fixture.
- Hồ sơ: draft/Cancel/Esc/backdrop, trim tên, phone 21 ký tự bị chặn, phone rỗng giữ số cũ, focus lỗi đầu tiên, pending khóa gửi lặp và đóng, failure không đổi dữ liệu, retry thành công. Email readonly; địa chỉ không có input sửa/lưu. Tên 150 ký tự không tràn.
- Pet: required/zero validation, thêm một lần dù gửi lặp, failure/retry, chi tiết lấy record mới sau sửa, Cancel không đổi record, nullable fields clear, loading/error/retry giữ dữ liệu, xác nhận đúng pet, xóa lỗi không đổi dữ liệu. Xóa thành công loại khỏi active list, giữ record INACTIVE và ảnh trong mock; danh sách hết pet có empty thật và focus nút thêm.
- Ảnh: Save thành công giữ URL qua tab/Back/Forward; ảnh của record INACTIVE chưa bị revoke. Rời toàn layout thu hồi ảnh này đúng một lần. Rời layout khi pet Save pending hủy mutation và thu hồi draft đúng một lần. Decoder được làm chậm, rời layout rồi mở draft mới: kết quả cũ về muộn không đổi draft mới và URL cũ được thu hồi đúng một lần. Chuyển sang route pet khi profile Save pending không ghi dữ liệu muộn.
- Bốn viewport: main lần lượt 894,03/1374/720/358px; không tràn ngang toàn trang hoặc dialog. Đã cuộn tới ngày sinh/ảnh/nút Save, kiểm tra bounding box nút trong viewport, tên pet 100 ký tự/giống 100 ký tự/ghi chú nhiều dòng dài không cắt nội dung. Tab/Shift+Tab trap, focus mở/trả focus, Esc, backdrop và lỗi form đạt cho các dialog.
- Đối chiếu screenshot với bố cục Customer đã xác minh: header/sidebar/tab/panel và asset đúng cụm, responsive dùng main toàn chiều ngang, không có khoảng ngang thừa trên màn rộng. Đã xem screenshot desktop 1440/1920, tablet 768, mobile 390, dialog hồ sơ/pet/xóa có nội dung dài. Ảnh hiển thị có naturalWidth > 0; menu mở mới yêu cầu tải ảnh lazy trong menu. Font Be Vietnam Pro và Assistant đã tải; font fallback không dùng không được coi là font tải lỗi.
- Không ghi nhận pageerror/console error trong các luồng Customer đã kiểm tra; không có request /api/ hoặc truy cập key pawflow.access-token trong các luồng được theo dõi. Rà source Customer cũng không có fetch/axios/storage/cookie/token/redirect. Đây không phải kiểm thử bảo mật backend.

### Kết quả dùng lại theo hash

- Đối chiếu đầu bước 4: toàn bộ 21 file manifest bước 3 và 208 file còn lại trong snapshot trước bước 3 khớp hash; tài liệu được loại khỏi so sánh đầu vào build. Sau QA chỉ hook điều phối focus nêu trên thay đổi. Vì vậy lint/typecheck/build đã chạy lại, không kế thừa kết quả build cũ.
- Dùng lại 6/6 test profileLogic từ bước 2 và 20/20 test pet logic/ảnh từ bước 3. Ba file test cùng logic/types/fixture/validation/registry mà chúng kiểm tra không thay đổi byte; không chạy lại test thuần chỉ vì sửa effect focus UI.
- Dùng lại các ca ảnh đã đạt ở bước 3: JPEG/PNG/WebP, rỗng/MIME/signature/decode hỏng, >5 MiB/đúng 5 MiB; preview draft/Cancel/chọn-thay, Save lỗi giữ ảnh cũ và draft, retry mới thay ảnh; decoder cũ/Cancel khi decode và tham chiếu URL. petImageValidation.ts, petImageRegistry.ts, usePetEditor.ts, usePetsWorkspace.ts, workspace provider, form/dialog, types và asset không đổi hash. Các đường orchestration/tab/unmount liên quan được kiểm tra mới như trên.
- Không dùng bộ scaffold pet bước 2 làm kết quả cho màn pet cuối. Ownership/role/version/status và lỗi trả nguyên state được xác nhận bởi test logic mock đã đạt; lọc owner client không chứng minh phân quyền máy chủ.

### Rà bản bàn giao và hash

- Rà đủ 52 file untracked bằng danh sách git ls-files --others --exclude-standard và nội dung từng nhóm source/test/asset/docs; không chỉ dựa vào git diff thông thường. Có 34 source runtime, 3 test, 14 asset và 1 tài liệu. Không staged file hoặc tracked diff.
- Whitespace: git diff --check và kiểm tra từng file text mới bằng git diff --no-index --check /dev/null <file> đạt. Không thấy file tạm, symlink, cấu hình/secret hoặc URL runtime bên ngoài lọt vào phạm vi. Không thêm dependency/config/lockfile.
- 14/14 asset được tham chiếu bởi source. Rà 11 SVG: root dimensions/viewBox hợp lệ, không script/foreignObject/href ngoài; ba PNG có signature/kích thước hợp lệ. Hai avatar là hai asset Figma mẫu có chủ đích; không xóa vì cùng nội dung.
- Source/asset/test cuối: 51 file, SHA-256 aggregate `dadc08b59c5ada3828d4baa7dd7f257a5b404cf9540b1d6f5a5592237e343e3f`. Thuật toán: sắp xếp path tương đối, mỗi dòng là path + NUL + SHA256(file) + LF, rồi SHA256 toàn chuỗi UTF-8. Loại tài liệu khỏi aggregate này để tránh tự tham chiếu; handoff manifest vẫn ghi hash tài liệu.
- Production build ID: `tAwnu2c_LEZ6zIXCmB0wv`; server port 3023 thuộc worktree FE-023. Local: http://localhost:3023/account và http://localhost:3023/account/pets.
- Artifact ngoài repo: /var/folders/sb/q3ltb0pn51j1ph9g6_wrdhrh0000gn/T/fe023-step4-22v4g97p/. handoff-manifest.json chứa path/loại/kích thước/SHA256 từng file trong cả 52 file và aggregate toàn bộ; handoff-manifest.sha256 là checksum của chính manifest. source-manifest.json, validation.json, qa-results.json, file-audit-final.json và preservation-final.json ghi bằng chứng tương ứng. Các script/log/screenshot nằm ngoài Git, không đưa vào PR.
- Branch FE-023, HEAD 3b69691a5c740cc9259ce987c108bc9bacee7417; chưa stage/commit/push/PR/merge hoặc cập nhật bảng task. Ba worktree dashboard, AGENTS riêng, layout Provider, ba stash và backup snapshot giữ nguyên; không thao tác buffer.

### Giới hạn và bước 5/5

- QA này chỉ bao phủ UI/mock Customer account/pets trên Chromium production desktop với viewport mô phỏng. Chưa kiểm tra Safari, Firefox, thiết bị cảm ứng/camera/file picker hệ điều hành thật, screen reader, API/backend hoặc auth tích hợp. Định dạng hiển thị của input date và nút chọn file do trình duyệt/hệ điều hành quyết định; dữ liệu lưu vẫn date-only YYYY-MM-DD.
- State và ảnh chỉ nằm trong bộ nhớ layout, mất khi reload/rời vùng account. Không upload, lưu lâu dài, token hoặc gọi API. Record INACTIVE được giữ chỉ trong phiên mock; không có module booking/lịch cũ giả để minh họa. Backend ownership/permission chưa được thử.
- Đủ điều kiện sang bước 5 trong phạm vi đã chốt: kiểm tra lại status/manifest và base dev mới nhất; stage đúng 52 file cụm; commit/push FE-023 và tạo một PR vào dev cho Nhi review sau khi được người dùng giao bước 5. Không đưa AGENTS/layout Provider/backup/stash vào commit; không merge hoặc đổi bảng task.
- Chặng hiện tại: khảo sát → shell/hồ sơ → pet → QA (đạt) → bàn giao Git/PR (còn lại). Không tuyên bố hoàn thành toàn bộ FE-025/FE-026 hoặc tích hợp Customer API.

### Danh sách 52 file để review ở bước 5

```text
docs/FE-023-customer-account-pets.md
public/customer-account/calendar.svg
public/customer-account/header-avatar.png
public/customer-account/identity-arrow.svg
public/customer-account/logo.svg
public/customer-account/nav-account.svg
public/customer-account/nav-bookings.svg
public/customer-account/nav-notifications.svg
public/customer-account/sidebar-avatar.png
public/customer-account/tab-account-active.svg
public/customer-account/tab-account-inactive.svg
public/customer-account/tab-pets-active.svg
public/customer-account/tab-pets-inactive.svg
public/customer-account/wordmark.svg
public/customer-pets/milo.png
src/app/account/layout.tsx
src/app/account/page.tsx
src/app/account/pets/page.tsx
src/features/customer-account/account.module.css
src/features/customer-account/components/CustomerAccountPage.tsx
src/features/customer-account/components/ProfileEditDialog.tsx
src/features/customer-account/data/customerAccountMock.ts
src/features/customer-account/hooks/useCustomerProfileEditor.ts
src/features/customer-account/profileLogic.test.ts
src/features/customer-account/profileLogic.ts
src/features/customer-account/types.ts
src/features/customer-pets/components/CustomerPetsPage.tsx
src/features/customer-pets/components/PetCard.tsx
src/features/customer-pets/components/PetDeleteDialog.tsx
src/features/customer-pets/components/PetDetailsDialog.tsx
src/features/customer-pets/components/PetFormDialog.tsx
src/features/customer-pets/components/PetPhoto.tsx
src/features/customer-pets/data/customerPetsMock.ts
src/features/customer-pets/hooks/useCustomerPetsPage.ts
src/features/customer-pets/hooks/usePetEditor.ts
src/features/customer-pets/hooks/usePetsWorkspace.ts
src/features/customer-pets/mockDelay.ts
src/features/customer-pets/petImageRegistry.ts
src/features/customer-pets/petImageValidation.ts
src/features/customer-pets/petImages.test.ts
src/features/customer-pets/petLogic.test.ts
src/features/customer-pets/petLogic.ts
src/features/customer-pets/pets.module.css
src/features/customer-pets/types.ts
src/features/customer-shell/components/CustomerAsset.tsx
src/features/customer-shell/components/CustomerDialog.tsx
src/features/customer-shell/components/CustomerHeader.tsx
src/features/customer-shell/components/CustomerNavigation.tsx
src/features/customer-shell/components/CustomerShell.tsx
src/features/customer-shell/components/CustomerSidebar.tsx
src/features/customer-shell/customerShell.module.css
src/features/customer-workspace/CustomerWorkspaceProvider.tsx
```
