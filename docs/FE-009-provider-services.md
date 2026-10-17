# FE-009 — Provider Dịch vụ

Route `/dashboard/services`, theo đường dẫn Sidebar hiện có. Nhánh `FE-009` được tạo từ FE-008 commit `4f37d55ff299faed85d15096d0d55c5b99bb3900` theo yêu cầu, không chờ các PR trước merge.

Thiết kế chính: [Website → PawFlow → Dashboard → Provider Dịch vụ, node 4667:14620](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4667-14620). Đã đọc design context và ảnh tham chiếu của trang cùng dialog thêm/sửa `5021:3486`, `5021:3504`, `5033:3519`. Không dùng section Archive được đánh dấu không dùng trong prototype.

## Quy tắc đã xác nhận

- FE-009 tập trung Provider Owner. Không có màn hoặc quyền quản lý dành cho Staff; vai trò mô phỏng không thay thế xác thực/phân quyền thật.
- Owner được tự tạo danh mục. Có bốn danh mục mẫu từ thiết kế; danh mục mới lưu trong cùng phiên trang. Tên danh mục bắt buộc sau khi trim; không tạo trùng tên không phân biệt hoa/thường. Chưa có sửa/xóa danh mục.
- Chưa làm loài thú cưng áp dụng hoặc ảnh dịch vụ. Không upload, API hay endpoint.
- Tên dịch vụ và danh mục bắt buộc; khoảng trắng không hợp lệ. Mô tả là trường tùy chọn, được trim khi lưu.
- Giá là số hữu hạn lớn hơn 0. Thời lượng là số phút hữu hạn lớn hơn 0; không ép số phút thành số nguyên. Nhập số thập phân bằng dấu chấm, không kèm đơn vị hoặc dấu phân cách hàng nghìn. Giá trị vượt khả năng biểu diễn số an toàn bị từ chối.
- Dịch vụ “Trông giữ ban ngày · 1 ngày” giữ nguyên thời lượng. Trường thời lượng khóa và có giải thích; không tự quy đổi thành 24 giờ hoặc số giờ mở cửa. Dịch vụ mới nhập theo phút.
- Dịch vụ mới hiển thị sau khi tạo; nhận booking mới còn phụ thuộc khung giờ khả dụng. Sửa thông tin giữ nguyên trạng thái hiện tại, bao gồm dịch vụ đang tạm ẩn.
- Tạm ẩn ngừng nhận booking mới; hiển thị lại bật khả năng nhận booking mới theo các khung giờ khả dụng. Có bước xác nhận trạng thái. Giá, thời lượng, trạng thái booking và slot hiện có được giữ nguyên. Không có xóa vĩnh viễn dịch vụ.
- Giá/thời lượng lưu trong booking là snapshot. Sửa dịch vụ không sửa các snapshot hoặc chuyển trạng thái booking.
- Nếu đổi thời lượng làm slot đã tạo có độ dài khác thời lượng mới: chặn toàn bộ lần lưu, kể cả các thay đổi tên/giá đi cùng. Hiển thị toàn bộ slot liên quan với mã, ngày/giờ và thời lượng; Owner xử lý ở Lịch khả dụng trước. Không tự cập nhật, xóa hoặc di chuyển slot.

## Tổ chức

- `src/app/dashboard/services/page.tsx`: chỉ ghép màn hình, dùng dashboard layout cha.
- `src/features/provider-services/types.ts`: mô hình nội bộ cho dịch vụ, form, command, phản hồi, snapshot booking/slot.
- `data/providerServicesMock.ts`: dữ liệu riêng, tạo bản sao mới khi reset; giữ nội dung sáu dịch vụ từ thiết kế.
- `serviceLogic.ts`: validation, lọc/tìm kiếm, định dạng và áp dụng command thuần. Kiểm tra lại dữ liệu mới nhất và phiên bản dịch vụ khi lưu; thất bại giữ nguyên các tập dữ liệu. Không có request hoặc loading giả.
- `useServicesMock.ts`: quản lý trạng thái trong bộ nhớ và chạy command đồng bộ trên state mới nhất.
- `components/`: trang điều phối, tổng hợp, bộ lọc, danh sách/thẻ dịch vụ, status badge, dialog form, tạo danh mục, phản hồi và hướng dẫn.
- `services.module.css`, `public/services/`: style riêng và hai asset chấm trạng thái Figma, hiển thị 7×7px.
- `serviceLogic.test.ts`: test validation, thao tác, lỗi/thử lại, snapshot, xung đột và lọc.

Tái sử dụng dashboard shell, tokens và `DashboardDialog`. Giữ nguyên Tổng quan, Lịch hẹn, Lịch khả dụng, Header/Sidebar, component chung, dependency, lockfile và config. Các khác biệt shell có sẵn như avatar biểu tượng, bố cục Header và điều hướng mobile được giữ nguyên. Dialog dùng font và khung modal chung hiện có; bổ sung trường nhập thật và xác nhận trạng thái để thực hiện tương tác yêu cầu.

## Dữ liệu mô phỏng và cách thử

- Không API, database, localStorage hoặc sessionStorage. Mọi thay đổi dịch vụ/danh mục chỉ tồn tại trong lần mount trang. Rời trang hoặc tải lại sẽ khôi phục mẫu.
- Mock độc lập hoàn toàn với FE-007/FE-008; không nhập/sửa mock của hai module đó. Link Lịch khả dụng chỉ điều hướng, không đồng bộ dữ liệu. Snapshot booking/slot trong FE-009 là fixture kiểm tra tính bất biến, không phải hợp đồng API.
- Danh sách mẫu có 5 dịch vụ hiển thị và 1 tạm ẩn. Số lượng trạng thái được tính từ toàn bộ danh sách, độc lập bộ lọc. `42` lịch hoàn thành của Chăm sóc tạo kiểu là thống kê mẫu từ Figma, không suy ra từ hai booking fixture và không đổi khi sửa thông tin hoặc ẩn dịch vụ.
- Tìm kiếm không phân biệt hoa/thường và dấu theo tên, danh mục, mô tả; kết hợp bộ lọc Tất cả/Đang hiển thị/Tạm ẩn. Không có kết quả và danh sách rỗng có thông báo cùng thao tác tiếp theo riêng.
- Chăm sóc tạo kiểu có `MOCK-SLOT-1` và `MOCK-SLOT-2`. Đổi 90 thành 60 phút sẽ bị chặn và liệt kê cả hai. Sửa giá với thời lượng 90 phút vẫn lưu được. Dịch vụ khác chưa có slot minh họa nên có thể sửa thời lượng.
- FE-009 không cung cấp luồng sửa/xóa fixture slot; xử lý xung đột thực giữa các module chờ nguồn dữ liệu chung khi tích hợp. Có thể đóng dialog và giữ lại thời lượng cũ để tiếp tục sửa thông tin khác.
- Mở “Thử tình huống lưu thất bại” trong dialog, bật mô phỏng lỗi và thử lưu dịch vụ/danh mục/trạng thái. Lỗi giữ dữ liệu đã nhập và modal mở; tắt mô phỏng rồi thử lại. Thay đổi trạng thái không lưu nhầm các trường đang nhập.
- “Thêm danh mục” trong form tạo và chọn danh mục ngay sau khi thành công. Enter trong tên danh mục chỉ tạo danh mục; không gửi form dịch vụ.
- “Dữ liệu mô phỏng và trạng thái rỗng” dưới trang có thao tác thử rỗng/khôi phục mẫu, thay thế dữ liệu phiên hiện tại.
- Modal có nhãn, focus ban đầu, Esc, Tab trong modal và trả focus về nút mở. Nếu nút mở biến mất sau khi lọc, focus về tiêu đề Dịch vụ. Phản hồi có `status`/`alert`; phản hồi trong modal nhận focus, phản hồi ngoài trang giữ focus về nút mở hoặc tiêu đề.

## Kiểm tra

Chạy test mà không thêm dependency:

```sh
test_output=$(mktemp -d /tmp/pawflow-fe009-tests.XXXXXX)
./node_modules/.bin/tsc src/features/provider-services/serviceLogic.test.ts --outDir "$test_output" --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck
node --test "$test_output/serviceLogic.test.js"
```

Kết quả: 18 test đạt. `npm run lint`, `npx tsc --noEmit` và `npm run build` đạt; build tạo `/dashboard/services`.

Vòng kiểm tra cuối đã chạy lại trên production build bằng Chromium/Playwright ở **1440/768/390px**, dùng bản Playwright đã có trên máy, không thêm thư viện:

- Danh sách sáu dịch vụ, hai trạng thái, tìm kiếm không dấu/không phân biệt hoa thường kết hợp bộ lọc, không có kết quả và xóa bộ lọc.
- Sửa giá; sửa toàn bộ tên, danh mục, giá, thời lượng không xung đột và mô tả. Lưu lỗi giữ nguyên cả năm trường; thử lại thành công, đóng/mở lại hiển thị dữ liệu đã lưu.
- Tạo danh mục mới, tên rỗng/trùng, lỗi/thử lại, tự chọn sau khi tạo. Enter chỉ tạo danh mục, không gửi form dịch vụ.
- Thêm dịch vụ, validation tên trắng/giá 0/thời lượng 0, lỗi giữ dữ liệu và thử lại thành công.
- Đổi thời lượng Chăm sóc tạo kiểu bị chặn và nêu cả hai slot; form giữ dữ liệu, dịch vụ đã lưu vẫn giữ thời lượng cũ. Mục “1 ngày” khóa thời lượng, cho sửa giá.
- Tạm ẩn/hiển thị lại có xác nhận và lỗi/thử lại; không lưu nhầm các trường đang nhập. Danh sách và bộ lọc cập nhật theo trạng thái.
- Modal có nhãn truy cập ổn định, Esc, Tab/Shift+Tab trong modal, phản hồi nhận focus và trả focus khi đóng; fallback về tiêu đề khi nút mở biến mất do lọc.
- Danh sách rỗng/khôi phục mẫu; reload khôi phục dữ liệu. Kiểm tra riêng việc điều hướng sang Lịch khả dụng rồi quay lại cũng khôi phục dữ liệu dịch vụ mẫu. Không lỗi JavaScript hoặc tràn ngang trang. Toàn bộ ảnh đang hiển thị tải được; sáu chấm trạng thái đúng asset và kích thước 7×7px.

Script, ảnh trang và modal, cùng kết quả từng kích thước nằm tại `/tmp/pawflow-fe009-browser/` (`check.cjs`, `results.json`, `services-*`, `conflict-*`, `retry-*`).

Lượt tiếp tục giữ nguyên toàn bộ source FE-009 đã có, chỉ hoàn thiện tài liệu sau khi đọc code và chạy lại các kiểm tra thực tế. Server xem local dùng production build tại `http://localhost:3009/dashboard/services`, đã kiểm tra HTTP 200 và tiến trình lắng nghe cổng 3009.

Chưa kiểm tra Safari/Firefox, screen reader thật, thiết bị di động thật, API/phân quyền thật hoặc truy cập đồng thời nhiều phiên.

## Danh sách file FE-009

20 file mới của FE-009, không bao gồm thay đổi riêng `AGENTS.md`:

```text
docs/FE-009-provider-services.md
public/services/status-hidden.svg
public/services/status-visible.svg
src/app/dashboard/services/page.tsx
src/features/provider-services/components/ProviderServicesPage.tsx
src/features/provider-services/components/ServiceCard.tsx
src/features/provider-services/components/ServiceCategoryField.tsx
src/features/provider-services/components/ServiceDialog.tsx
src/features/provider-services/components/ServiceStatusBadge.tsx
src/features/provider-services/components/ServicesFeedback.tsx
src/features/provider-services/components/ServicesGuidance.tsx
src/features/provider-services/components/ServicesList.tsx
src/features/provider-services/components/ServicesSummary.tsx
src/features/provider-services/components/ServicesToolbar.tsx
src/features/provider-services/data/providerServicesMock.ts
src/features/provider-services/serviceLogic.test.ts
src/features/provider-services/serviceLogic.ts
src/features/provider-services/services.module.css
src/features/provider-services/types.ts
src/features/provider-services/useServicesMock.ts
```

## Khi tích hợp backend

Backend cần xác thực Owner; kiểm tra lại validation, trạng thái, phiên bản và toàn bộ slot liên quan trong cùng một thao tác nhất quán với dữ liệu mới nhất. Chặn booking mới cho dịch vụ ngừng hoạt động; booking lưu snapshot giá/thời lượng độc lập. Backend thống nhất lưu trữ bền vững, lỗi/thử lại, số tiền/thời lượng chính xác và cạnh tranh giữa sửa dịch vụ/tạo slot/đặt booking. Chưa định nghĩa endpoint hoặc tự suy ra quyền Staff.

Không còn câu hỏi chặn phạm vi đã xác nhận. `AGENTS.md` là thay đổi riêng có sẵn, được giữ nguyên và không thuộc commit/PR FE-009.
