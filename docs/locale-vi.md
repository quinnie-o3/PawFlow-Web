# Nội dung giao diện tiếng Việt

Ngày kiểm chứng: 06/11/2026, Asia/Ho_Chi_Minh. Nhánh `refactor/vi-locale`, nền và HEAD `b70d18b14c82cae036cd0d3f6c0bb69f47b421c5`. Chưa stage, commit, push hoặc tạo PR cho cụm locale.

## Cấu trúc và cách dùng

- Một nguồn nội dung: `locale/vi.json` tại root, ngang hàng `package.json`.
- `src/lib/locale.ts` nhập JSON và xuất `vi`, `formatMessage`, `formatMessageParts`. Module thuần, dùng được từ Server/Client Components, logic và metadata; không thêm directive, context hoặc dependency.
- 1.040 key chuỗi: `common` 28, `auth` 39, `provider` 605, `admin` 229, `staff` 139. Key có ngữ nghĩa theo tính năng/ngữ cảnh; chỉ dùng chung khi nội dung và ý nghĩa trùng nhau.
- Chưa có `en.json`, chọn ngôn ngữ, middleware hoặc route locale. `customer`/`discovery` là namespace dự kiến cho source chưa merge, chưa thêm bản sao source hay dictionary riêng.

```tsx
import { vi, formatMessage } from "@/lib/locale";

const title = vi.auth.login.title;
const unread = formatMessage(vi.provider.notifications.page.unreadCount, {
  count: String(unreadCount).padStart(2, "0"),
});
```

Thêm nguyên câu vào namespace phù hợp, giữ đúng nội dung, dấu câu và khoảng trắng. Với biến, dùng tên như `{count}`, `{facilityName}`, `{bookingId}`; không ghép các mảnh câu theo thứ tự tiếng Việt. Giữ định dạng số/ngày/giờ và điều kiện số lượng ở logic hiện có. Các câu khác nghĩa hoặc có nhánh diễn đạt khác nhau dùng key riêng.

`formatMessage` chỉ thay placeholder một lần; giá trị chứa dấu ngoặc được giữ nguyên, không bị diễn giải tiếp. Thiếu giá trị sẽ báo lỗi để phát hiện trong kiểm tra. Với JSX có định dạng sẵn, `formatMessageParts` nhận element tại placeholder; element trong mảng cần `key` ổn định. Không thêm HTML vào JSON và không dùng `dangerouslySetInnerHTML`. `OverviewIntro` giữ hai span/flex gap cũ khi ghép tên cơ sở; phần text được trim ở ranh giới gap, bỏ phần rỗng.

## Phạm vi đã chuyển

- Common Header/Sidebar; Auth login/register, side panels, nhãn trang và frontend fallback trong hooks/services.
- Provider Tổng quan, Lịch hẹn, Lịch khả dụng, Dịch vụ, Khách hàng, Thông báo, Hồ sơ: component, validation, trạng thái, câu có biến và nội dung UI trong logic/data.
- Admin đủ bảy màn, shell/workspace và definition hiển thị trong mock. Title có tên/ID, số lượng/sao, vai trò/loại/trạng thái hiển thị là template hoặc nhãn locale; giá trị render và exports của fixture giữ nguyên.
- Staff shell, lịch hẹn, quyền mô phỏng, dialog, validation, kết quả thao tác và thông báo động.
- aria-label/alt có nội dung, tooltip, screen-reader/live text, metadata tiếng Việt và loading/error/fallback đang có.
- `src/app/dashboard/layout.tsx` chỉ thêm import locale và thay aria-label. Không mang diff layout riêng của checkout chính sang.

Giữ nguyên enum/status, tags, ID, URL/query, payload/API, backend message, token/redirect, điều kiện nghiệp vụ, cấu trúc/CSS, `html lang` và metadata tiếng Anh mẫu. Không thay assertion của chín file test hiện có; thêm năm test cho helper.

## Chuỗi giữ nguyên và phần còn lại

| Nhóm | Quyết định |
| --- | --- |
| Tên khách/pet/cơ sở/dịch vụ/danh mục, địa chỉ và dữ liệu catalog | Giữ nguyên dữ liệu, kể cả khi có tiếng Việt |
| Review, complaint/reason, ghi chú, notification title/body mẫu | Giữ nguyên nội dung bản ghi |
| Activity-log/audit record, actor mô phỏng và snapshot lịch sử | Giữ nguyên; không coi nội dung audit là bản dịch UI |
| Danh tính Staff viết trực tiếp trong shell/dialog | Giữ tên/cơ sở; phần vai trò UI nằm trong template locale |
| Regex chuẩn hóa tìm kiếm `đ`/`Đ`, comment và expected text của test | Không phải chuỗi UI cần chuyển |
| English UI/brand, metadata tiếng Anh mẫu, `html lang` | Không viết lại trong cụm này |
| Customer account/pet PR #16 (`0bb1222`) | Chưa merge vào nền; chưa chuyển source của PR |
| Discovery/detail PR #18 (`df439f5`) | Chưa merge vào nền; chưa chuyển source của PR |
| Dashboard QA PR #17 | Chỉ có tài liệu, không có source locale |

Fetch và kiểm tra PR ngày 06/11/2026 xác nhận `origin/dev` vẫn tại nền trên; #16/#17/#18 còn mở. Không merge/rebase/cherry-pick để đưa source vào cụm locale. Các feature đó phải dùng cùng JSON/helper khi được tích hợp; chưa tuyên bố hoàn tất locale toàn web.

## Kiểm chứng

Đã kiểm tra source cuối sau khi hoàn thiện các template Admin. Bằng chứng tạm ngoài repo nằm ở `/tmp/pawflow-locale-resume/`; `verification-manifest.json` ghi hash source và từng file để phân biệt với kết quả trước phiên bị ngắt. Runtime SHA-256: `e9eed9569c1ce55ed6fb52e9c43a2ce79bd9f35f3dfa9e52d6d16a36c103060c`. Chỉ tài liệu được hoàn thiện sau kiểm tra; runtime/test không đổi.

| Kiểm tra thực chạy | Kết quả |
| --- | --- |
| Lint, typecheck, normal production build | Đạt; không sửa config hoặc dependency |
| Chín suite hiện có + suite helper | 135/135 test đạt; assertion hiện có không đổi |
| JSON/key/placeholder | 1.040 key, 149 template; không duplicate key, thiếu tham chiếu hoặc HTML; 196 tham chiếu template đều qua helper |
| Auth contract/fallback so với HEAD | 11/11 tình huống giữ nguyên response/error, URL/payload và backend message |
| Provider service/profile/notification logic so với HEAD | 1.227/1.227 kết quả bằng nhau |
| Dữ liệu/analytics so với HEAD | 62/62 đối chiếu đạt, gồm exports 10 module data, factory rỗng/có dữ liệu và 50 tổ hợp analytics |
| Browser 19 route × desktop/mobile | 38/38 đối chiếu text, aria, metadata và geometry đạt |
| Provider Tổng quan/Lịch hẹn/Khả dụng/Khách hàng | 72/72 đối chiếu trạng thái tương tác đạt |
| Provider Dịch vụ/Hồ sơ/Thông báo | 36/36 đối chiếu trạng thái tương tác đạt |
| Admin/Staff | 64/64 nhóm kiểm tra, 42/42 đối chiếu trạng thái đạt |
| Auth validation/frontend fallback | 6/6 đối chiếu đạt; không gửi mutation API |

Tổng 194 đối chiếu browser trước/sau đạt ở 1440px và 390px. Bao phủ dialog/focus/keyboard, validation, câu/số lượng động, lỗi/thử lại, trạng thái rỗng, lọc và chuyển trạng thái theo phạm vi mock hiện có. Không có page error hoặc React key warning; không thấy key thô, `undefined` hay placeholder chưa thay trong các luồng đã kiểm tra. Đã xem ảnh production desktop và mobile, gồm dialog có thông báo xung đột nhiều dòng.

Lỗi có sẵn: route `/` tràn ngang 210px tại 390px ở cả baseline và locale; không sửa ngoài phạm vi. Các route còn lại trong ma trận không tràn ngang trang. Không có lỗi mới được phát hiện trong phạm vi kiểm tra.

Production locale được xác minh listener và HTTP tại `http://localhost:3036/dashboard`. 110 file source đã có được sửa, cộng bốn file mới: JSON, helper, test helper và tài liệu này. Sáu worktree cũ, 24 backup và ba stash giữ nguyên; không thao tác editor/buffer.

Các lệnh kiểm tra từ root worktree:

```sh
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Chín suite hiện có và suite helper được compile ra thư mục tạm bằng TypeScript với `--module commonjs --moduleResolution node --target ES2022 --esModuleInterop --resolveJsonModule --skipLibCheck --strict --rootDir .`, sau đó chạy `node --test` trên các file `.test.js` đã compile. Lệnh chính xác lưu trong `/tmp/pawflow-locale-resume-tests/commands.json`; assertion hiện có không đổi.

Rà JSON gồm duplicate key, leaf string, tham chiếu TypeScript, toàn bộ placeholder và nội dung không chứa HTML. Rà diff và đối chiếu runtime với HEAD nền để xác nhận dữ liệu/điều kiện không đổi. Browser dùng Chromium production tại 1440px/390px để đối chiếu nội dung, aria/metadata, geometry, dialog, validation, thông báo động, trạng thái và lỗi/thử lại.

Chưa kiểm chứng API/auth/RBAC thật, backend/DB, Safari/Firefox, thiết bị hoặc screen reader thật. Kiểm thử Auth dùng frontend fallback và response giả lập cho kiểm tra contract; không gọi mutation API thật.
