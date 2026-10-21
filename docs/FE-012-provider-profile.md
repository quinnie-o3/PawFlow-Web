# FE-012 — Provider Hồ sơ cơ sở

Route `/dashboard/profile` đã có trong Header/Sidebar, nay có page ghép `ProviderProfilePage`. Feature dùng nguyên layout rộng, khoảng đệm, main cuộn riêng, Header/Sidebar cố định và icon Lucide đã chốt. Không sửa component chung, auth, dependency, config hoặc các module provider khác.

## Thiết kế và phạm vi

- Màn chính: [Website → PawFlow → Dashboard → Provider Hồ sơ cơ sở, node 4664:15846](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4664-15846), bên ngoài Archive. Đã đọc design context và screenshot màn chính cùng dialog chỉnh sửa `5021:3555`.
- Giữ banner Provider, tiêu đề, trạng thái duyệt, thông tin cơ sở, liên hệ và hai thẻ điều hướng Dịch vụ/Giờ hoạt động. Dialog dùng lại `DashboardDialog`, bổ sung form có tương tác theo yêu cầu đã xác nhận.
- Bổ sung riêng một logo và một ảnh bìa theo quyết định của chủ dự án; màn Figma chính không có thư viện ảnh, không tạo thư viện. Khi chưa có ảnh dùng khung trống trung tính/icon Lucide theo pattern UI hiện có, không dùng logo PawFlow làm ảnh của cơ sở. Không có asset ảnh mới hoặc URL Figma tạm thời trong code.
- Dịch vụ và giờ tuần chỉ là tóm tắt chỉ đọc từ fixture ban đầu của module đã có (`createServicesMock`, `mockWeeklyHours`, `formatRanges`). Không tạo lại form hoặc logic quản lý dịch vụ/giờ tuần. Link “Xem dịch vụ” và “Xem lịch” đi tới `/dashboard/services` và `/dashboard/availability`. Có nhãn rõ chưa đồng bộ trạng thái giữa các màn.

## Quyết định nghiệp vụ do chủ dự án xác nhận ngày 21/10/2026

Các quy tắc sau là yêu cầu bổ sung cho FE-012, không phải API contract hoặc tự suy ra từ Figma.

### Trường và validation

Owner được sửa đúng năm trường:

| Trường | Quy tắc |
| --- | --- |
| Tên cơ sở | Bắt buộc, 2–100 ký tự sau trim. |
| Mô tả | Không bắt buộc, tối đa 2.000 ký tự sau trim; giữ xuống dòng. |
| Khu vực phục vụ | Bắt buộc, tối đa 200 ký tự sau trim; giữ một trường text như thiết kế, không thêm bản đồ hoặc danh mục địa giới. |
| Điện thoại liên hệ | Bắt buộc, `0` hoặc `+84` rồi đúng 9 chữ số. Bỏ khoảng trắng và dấu gạch khi kiểm tra/lưu mock. Chỉ kiểm tra định dạng, không xác minh sở hữu. |
| Email liên hệ | Bắt buộc, tối đa 254 ký tự sau trim. Dùng native constraint của `input type="email"`, cùng cách đang dùng trong login/register; không tự thêm regex email khác. |

Tên, mô tả và khu vực giữ dấu tiếng Việt và khoảng trắng bên trong. Trim đầu/cuối; trường bắt buộc không chấp nhận chỉ có khoảng trắng. Không đổi chữ hoa/thường của email. Form có nhãn, dấu bắt buộc, hướng dẫn, báo lỗi theo trường, `aria-invalid`/`aria-describedby` và focus vào trường lỗi đầu tiên.

Email/điện thoại chỉ là liên hệ của cơ sở, không thay đổi thông tin tài khoản đăng nhập hoặc luồng xác minh. Loại hình, người phụ trách/chủ sở hữu, trạng thái duyệt và thông tin xác minh do admin quản lý không có input hoặc lệnh cập nhật. Save dùng allowlist tường minh theo nhóm form, bỏ qua thuộc tính ngoài phạm vi kể cả khi đối tượng form có thêm dữ liệu.

### Ảnh

- Tối đa **một logo và một ảnh bìa**, không bắt buộc. Chỉ nhận JPEG (`image/jpeg`), PNG (`image/png`) hoặc WebP (`image/webp`).
- Tối đa **5 MB mỗi ảnh**, triển khai giới hạn `5 * 1024 * 1024` byte, bao gồm đúng giới hạn. Từ chối file rỗng, MIME không hỗ trợ, signature không khớp và ảnh trình duyệt không giải mã được.
- Logo trong khung vuông; ảnh bìa trong khung ngang 16:9. `object-fit: contain` giữ tỷ lệ và hiển thị toàn ảnh; không crop, kéo méo, sửa hoặc ghi lại file gốc.
- Chọn/thay ảnh chỉ thay bản nháp trong modal. “Bỏ … vừa chọn” quay về ảnh đã lưu trong bộ nhớ của phiên mock (hoặc placeholder nếu chưa có ảnh). Không hỗ trợ xóa ảnh đã lưu hoặc công cụ crop.
- Chỉ khi save hợp lệ mới cập nhật preview ngoài trang. Cancel/Esc/nút đóng bỏ ảnh nháp, giữ ảnh đã lưu. Lỗi lưu giữ bản nháp và cho bấm lưu lại.
- Không upload, không API, không base64/localStorage/sessionStorage hoặc URL server. Dữ liệu ảnh trong bộ nhớ chứa blob URL, tên/MIME/dung lượng và kích thước giải mã.
- Thu hồi object URL khi thay/bỏ ảnh nháp, giải mã thất bại, cancel, thay ảnh đã lưu hoặc unmount. Kết quả giải mã về muộn sau khi đóng/chuyển form bị bỏ và thu hồi URL; chặn lưu trong lúc kiểm tra ảnh.

### Lưu, lỗi và quyền

- Chỉ sau validation thành công mới cập nhật dữ liệu đang hiển thị. Không gọi server và không báo upload/lưu server thành công.
- Mở form luôn lấy bản đã lưu trong phiên; hủy bỏ mọi bản nháp. Các nút sửa thông tin, liên hệ, ảnh mở đúng nhóm; nút trên đầu mở toàn bộ trường được phép và ảnh.
- Giữ nguyên trạng thái **Đã duyệt** sau chỉnh sửa. Không triển khai hoặc suy ra quy trình duyệt lại.
- Khối “Dữ liệu mô phỏng và thử lỗi lưu” có checkbox lỗi save một lần. Validation lỗi chưa tiêu thụ cờ; save hợp lệ bị mô phỏng lỗi giữ nguyên cả dữ liệu hiển thị và bản nháp. Save lần sau thử lại, không báo thành công trước đó.
- Dữ liệu cố định `MOCK-PAWCARE` / `owner-demo` / Dane Nguyen từ mẫu. Vai trò Chủ cơ sở trong mock không thay thế xác thực/phân quyền thật. Không lấy quyền Owner từ token giả hoặc sửa cơ chế auth của Nhi.
- Rời trang hoặc tải lại khôi phục fixture và ảnh trống; không tạo đồng bộ giả với Dashboard, Thông báo, Khách hàng hoặc tài khoản đăng nhập.

## Tổ chức code

- `src/app/dashboard/profile/page.tsx`: routing/ghép màn hình.
- `src/features/provider-profile/types.ts`, `data/providerProfileMock.ts`: mô hình nội bộ và fixture độc lập.
- `profileLogic.ts`: allowlist trường theo nhóm và tạo bản cập nhật, giữ metadata chỉ đọc.
- `profileValidation.ts`: trim/validation theo quy tắc đã chốt; email nhận kết quả constraint native.
- `profileImageValidation.ts`: kiểm tra MIME/dung lượng/signature, giải mã và tạo preview URL; lỗi luôn thu hồi URL vừa tạo.
- `useProfileMock.ts`: state trong bộ nhớ, draft, save/cancel/lỗi thử lại, yêu cầu giải mã và vòng đời URL.
- `components/`: điều phối trang, trạng thái duyệt, thông tin/liên hệ, ảnh/preview/chọn ảnh, dialog chỉnh sửa, tóm tắt điều hướng module.
- `profile.module.css`: style riêng và responsive; không sửa global tokens.
- `profileLogic.test.ts`: kiểm tra validation, ranh giới trường/metadata và nội dung file ảnh bằng Node test runner; kiểm tra native email, decoder và URL lifecycle trên trình duyệt.

## Nền Git và bảo toàn

- Trước cập nhật: nhánh FE-010 ở `56ffeec`; 17 file FE-010 và 14 file FE-011 chưa track, cùng thay đổi riêng của `AGENTS.md` và layout. Tài liệu FE-011 ghi nhận đã được phép làm trên FE-010; không có nhánh FE-011/FE-012 sẵn.
- Checkpoint riêng trên FE-010: `a6826bc` cho FE-010 và `0040d32` cho FE-011. Không chứa `AGENTS.md` hoặc layout.
- Fetch origin; local dev fast-forward từ `bd040f1` lên `09c4887` bằng `git pull --ff-only origin dev`. Dev không phân kỳ. Không sửa tính năng trực tiếp trên dev.
- Provider `62233e8`, `56ffeec` và hai checkpoint chưa thuộc origin/dev, nên FE-012 kế thừa FE-010 đã commit rồi merge origin/dev (`f9c24a9`). Không cherry-pick và không conflict.
- Diff riêng, bản gốc, manifest SHA-256 và archive file chưa track: `.git/pawflow-preservation/20261021T140603Z/`. Cất AGENTS/layout bằng hai stash riêng rồi dùng `stash apply`; giữ nguyên stash và backup. Đã khôi phục và đối chiếu toàn bộ 147 file có sẵn theo từng byte. Hai thay đổi riêng tiếp tục ở working tree, không stage/commit cùng FE-012.
- Dev mới thêm login/register, service auth, lưu access token và Authorization helper. Không có thay đổi dependency/lockfile từ bản dev mới; dùng cài đặt hiện có. Lucide là dependency đã có trong commit provider trước đó, không được thêm/nâng ở FE-012.

## Kiểm tra

Chạy test logic không thêm dependency:

```sh
profile_test_dir=$(mktemp -d /tmp/pawflow-fe012-tests.XXXXXX)
./node_modules/.bin/tsc src/features/provider-profile/profileLogic.test.ts --outDir "$profile_test_dir" --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck
node --test "$profile_test_dir/profileLogic.test.js"
```

- 12 test logic đạt: bảo toàn metadata/fixture, allowlist theo nhóm, trim/tiếng Việt, bắt buộc, các biên độ dài, hai dạng điện thoại, email native/giới hạn, MIME/signature/dung lượng ảnh.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`: đạt, build có `/dashboard/profile`.
- FE-012 trên Chromium/Playwright ở **1440×1000, 768×1024, 390×844**: đạt mở đúng nhóm form, thông tin chỉ đọc, validation và biên độ dài, giữ tiếng Việt, chuẩn hóa liên hệ, lưu/hủy/Esc, lỗi lưu và thử lại cho cả text lẫn ảnh. Modal có nhãn, focus ban đầu, Tab/Shift+Tab giữ bên trong và trả focus về nút mở. Nội dung dài không bị cắt hoặc tràn ngang; main cuộn riêng, Header/Sidebar giữ tọa độ. Đã xem ảnh desktop/tablet/mobile và modal.
- Ảnh: kiểm tra JPEG/PNG/WebP thật, chọn/thay/bỏ/cancel, lưu lỗi giữ hai ảnh nháp, thay ảnh đã lưu, file rỗng, quá 5 MB, MIME/signature không khớp và PNG hỏng không giải mã được. File PNG đúng **5.242.880 byte** giải mã thành công; ảnh dọc 80×160 giữ nguyên tỷ lệ trong khung vuông, không crop. Logo/ảnh bìa mẫu 240×120 có `object-fit: contain`, khung logo 1:1 và ảnh bìa 16:9.
- Instrument `URL.createObjectURL`/`revokeObjectURL` xác nhận toàn bộ URL được thu hồi khi hết dùng. Hai lượt giải mã đồng thời chặn save; đóng/mở lại modal hoặc điều hướng Back khi đang giải mã hủy tác vụ và thu hồi URL trong 300ms, không đưa ảnh về muộn vào form mới. Rời trang/tải lại khôi phục mẫu và ảnh trống. Không có lỗi JavaScript/console, request ngoài local hoặc thay đổi token đăng nhập trong kiểm tra FE-012.
- Sau merge đã chạy lại kiểm tra Chromium/Playwright FE-010/FE-011 tại 1440×1000, 768×1024, 390×844: đạt tương tác, modal/focus, responsive và phạm vi dữ liệu.
- Login/register/dashboard trả HTTP 200; browser kiểm tra hiển thị, liên kết login/register, lỗi xác nhận mật khẩu và thiếu cấu hình API ở ba kích thước trên. Không có `NEXT_PUBLIC_API_URL` tại local, chưa kiểm thử login/register thành công với backend thật. Không sửa auth để chạy dashboard.
- Vấn đề có sẵn từ origin/dev: đăng ký thành công điều hướng `/register/verify-email`, nhưng route chưa có và trả 404. Chỉ ghi nhận, không sửa trong FE-012.
- Script, kết quả và ảnh kiểm tra tại `/tmp/pawflow-fe012-validation/`; dùng Playwright/Chromium sẵn trên máy, không cài dependency.
- Rà soát bàn giao: code không đổi sau bản kiểm tra cuối nên dùng lại kết quả lint/typecheck/build và test logic/trình duyệt đã đạt. Kiểm tra bổ sung main ở đúng đầu (`scrollTop = 0`) và đúng cuối tại 1440/768/390px: tiêu đề có ở đầu, vẫn tồn tại trong DOM khi cuộn khỏi màn hình; Header/Sidebar đứng yên, Esc và trả focus đạt. Bằng chứng bổ sung trong `handoff-scroll-results.json` và ảnh `*-handoff-top.png`/`*-handoff-bottom.png` ngoài repo.

Chưa kiểm thử Safari/Firefox, thiết bị thật, screen reader thật hoặc API/phân quyền backend. Bản mock chỉ có Owner/cơ sở mẫu, không đại diện cho ranh giới bảo mật trên server.

Local production: [http://localhost:3014/dashboard/profile](http://localhost:3014/dashboard/profile).

## Phạm vi bàn giao Git

- Commit FE-012 chỉ gồm tài liệu này, route profile và feature `provider-profile`; không chứa `AGENTS.md`, thay đổi layout riêng, file tạm, log hoặc ảnh kiểm thử. Layout đang sửa riêng đã được phân loại và giữ nguyên ngoài commit; kết quả browser local phía trên dùng working tree có thay đổi riêng đó.
- FE-011 có checkpoint riêng `0040d32` trên nhánh FE-010 theo lịch sử được cho phép trước đó, không có nhánh FE-011 độc lập. Bàn giao FE-010/FE-011 chung nhánh FE-010 và một PR, tránh tạo nhánh/PR trùng cùng nội dung.
- Các PR mới dùng base `dev`. Thứ tự review: PR FE-009 sửa shell/icon (`62233e8`), phần nới rộng đã commit `56ffeec` cùng FE-010 (`a6826bc`) và FE-011 (`0040d32`), sau đó FE-012. Mô tả PR phải ghi rõ các commit kế thừa chưa merge; không merge vào dev trong lần bàn giao này.

## Khi tích hợp backend

Chưa có API/schema hồ sơ cơ sở trong repo để đối chiếu; không đoán endpoint. Backend cần kiểm tra lại toàn bộ validation, quyền Owner/cơ sở, allowlist trường, quyền admin và an toàn file ảnh. Server phải xác minh nội dung/giải mã/dung lượng ảnh và có lưu trữ thật trước khi UI có thể báo đã upload. Giữ riêng liên hệ cơ sở với tài khoản/xác minh. Quy trình duyệt lại cần yêu cầu nghiệp vụ riêng; FE-012 không tự triển khai.
