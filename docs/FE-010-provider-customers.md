# FE-010 — Provider Khách hàng

Route `/dashboard/customers`, đúng đường dẫn Sidebar hiện có. Nhánh `FE-010` được tạo từ FE-009 commit `56ffeec` (`style(FE-009): widen provider dashboard workspace`) theo cho phép kế thừa trước merge. Commit đó chỉ chứa năm file nới rộng dashboard; không chứa `AGENTS.md` và chưa push.

Thiết kế chính: [Website → PawFlow → Dashboard → Provider Khách hàng, node 4664:15255](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4664-15255). Đã đọc design context và ảnh của trang cùng dialog hồ sơ `5023:3454`. Archive được đánh dấu không dùng. Giữ màu sắc, khối tổng hợp, bộ lọc Tất cả/Quay lại/Mới, bảng và hồ sơ đang chọn. Bổ sung khoảng ngày, liên hệ chỉ đọc, nhiều thú cưng và lịch sử đầy đủ theo yêu cầu triển khai.

## Quyết định triển khai bổ sung do chủ dự án xác nhận

Các định nghĩa dưới đây là quyết định bổ sung cho FE-010, **không phải trích nguyên từ proposal hoặc tự suy ra từ số minh họa trên Figma**.

- Phạm vi Provider Owner. Không cấp thêm quyền cho Staff; nhãn vai trò mô phỏng không thay thế xác thực/phân quyền thật.
- Chỉ dùng dữ liệu của cơ sở hiện tại. Nhận diện khách bằng customer ID, thú cưng bằng pet ID; không gộp theo tên.
- Kỳ báo cáo có ngày bắt đầu/kết thúc, bao gồm cả hai ngày theo `Asia/Ho_Chi_Minh`. Mặc định là tháng hiện tại của đồng hồ mô phỏng. UI hiển thị rõ kỳ đã áp dụng; sửa ngày chưa áp dụng chưa làm đổi chỉ số. Ngày trống, không hợp lệ hoặc kết thúc trước bắt đầu bị từ chối và giữ nguyên kỳ đã chọn.
- **Khách đã phục vụ trong kỳ:** đếm customer ID duy nhất có booking Completed tại cơ sở, giờ bắt đầu slot nằm trong kỳ. Các trạng thái khác không đóng góp.
- **Quay lại:** trong nhóm đã phục vụ trong kỳ, có ít nhất một Completed trước ngày bắt đầu kỳ tại cùng cơ sở. **Mới:** có Completed trong kỳ nhưng không có Completed trước kỳ. Nhiều Completed chỉ trong cùng kỳ vẫn là Mới. Đổi kỳ tính lại cả phân loại và KPI.
- Khách chỉ có lịch chờ/xác nhận hoặc các trạng thái khác không được gọi là Mới; hiển thị **Chưa có lịch hoàn thành**. Khách có Completed ngoài kỳ nhưng không có Completed trong kỳ hiển thị **Không có lịch hoàn thành trong kỳ**, không thuộc bộ lọc Mới/Quay lại.
- **Lịch hoàn thành:** số booking Completed trong toàn bộ lịch sử tại cơ sở. Không giới hạn theo kỳ.
- **Lần phục vụ gần nhất:** giờ bắt đầu slot Completed gần nhất, không sau đồng hồ mô phỏng. Không giới hạn theo kỳ. Chưa có giá trị thì hiển thị **Chưa có**; lịch hoàn thành bằng 0 cũng hiển thị **Chưa có**.
- **Thú cưng đã phục vụ:** đếm pet ID duy nhất có Completed trong kỳ theo giờ bắt đầu slot tại cơ sở. Không tính thú cưng chỉ có lịch chờ/xác nhận và không đếm theo tên.
- Mặc định **danh sách gồm mọi khách từng có booking tại cơ sở**, không giới hạn kỳ hoặc trạng thái. Giữ đủ sáu trạng thái trong lịch sử. Kỳ chỉ tác động KPI và phân loại. Bộ lọc Mới/Quay lại áp dụng phân loại của kỳ đã chọn; tìm kiếm không làm thay đổi KPI.
- Hồ sơ chỉ có thú cưng xuất hiện trong booking của chính khách tại cơ sở này; lịch sử chỉ có booking tại cơ sở này, bao gồm cả lịch sắp tới. Không hiển thị thú cưng chưa có booking tại đây, toàn bộ hồ sơ thú cưng của tài khoản, hoặc lịch sử cơ sở khác.
- Liên hệ và hồ sơ thú cưng chỉ đọc. Không sửa/xóa khách, tài khoản hoặc thú cưng; không điểm thưởng, hạng thành viên, marketing, chat hoặc tổng chi tiêu. Không suy ra công thức thanh toán/chi tiêu.

Ngày local được chuyển thành khoảng `[00:00 ngày bắt đầu, 00:00 ngày sau kết thúc)` tại UTC+07:00. Booking được xét theo thời điểm thực, kể cả chuỗi thời gian mang offset khác. Ngưỡng trước kỳ là `< đầu kỳ`; giờ phục vụ gần nhất dùng `<= đồng hồ mô phỏng`. Theo định nghĩa đã xác nhận, giới hạn đồng hồ áp dụng cho lần phục vụ gần nhất; KPI và số lịch hoàn thành dùng trạng thái Completed và khoảng tương ứng.

## Tổ chức và tái sử dụng

- `src/app/dashboard/customers/page.tsx`: chỉ ghép màn hình, dùng layout cha đã chốt.
- `src/features/provider-customers/types.ts`: mô hình nội bộ cho khách, pet, booking, kỳ, bộ lọc, bản ghi tổng hợp và KPI. Dùng lại type `BookingStatus` đã có, không sửa module Booking.
- `data/providerCustomersMock.ts`: fixture độc lập, cơ sở và đồng hồ mô phỏng; mỗi lần reset tạo bản sao mới.
- `customerLogic.ts`: chuẩn hóa tìm kiếm, kiểm tra kỳ, biên ngày Việt Nam, lọc theo cơ sở/customer ID, thu hẹp pet, sắp xếp lịch sử, phân loại, KPI và định dạng ngày. Không phụ thuộc React hoặc đồng hồ máy.
- `useCustomersMock.ts`: dữ liệu trong bộ nhớ, kỳ đã áp dụng, bộ lọc, khách chọn bằng ID và trạng thái dialog. Tính báo cáo từ danh sách đã giới hạn cơ sở, trước bộ lọc UI.
- `components/ProviderCustomersPage.tsx`: điều phối. `CustomersReportingPeriod`, `CustomersSummary`, `CustomersToolbar`, `CustomersList`: chọn kỳ/KPI/tìm kiếm/bảng và trạng thái rỗng. `CustomerProfile`, `CustomerDetailsDialog`, `CustomerBookingHistory`, `CustomerGroupBadge`: hồ sơ đang chọn, liên hệ/pet/lịch sử và nhãn nhóm.
- `customers.module.css`: style riêng, khung rộng theo cha, bảng cuộn ngang trong vùng có nhãn, responsive và nội dung dài.
- `customerLogic.test.ts`: test logic bằng Node test runner, không thêm dependency.

Tái sử dụng `DashboardDialog`, `BookingStatusBadge`, tokens và Lucide (`Search`, `Circle`). Không tạo ảnh hoặc asset icon mới. Không sửa Header, Sidebar, layout chung, bốn màn đã chốt, component dùng chung, dependency, lockfile hoặc config trong FE-010.

Nút “Xem hồ sơ” chọn đúng customer ID, cập nhật thẻ hồ sơ phía dưới và mở dialog có liên hệ/pet/lịch sử của khách đó. Nút “Xem lịch sử booking” trong thẻ mở lại dialog của khách đang chọn. “Lịch hẹn” phía đầu trang đi tới route `/dashboard/bookings` có sẵn, không giả lập chuyển bộ lọc hoặc đồng bộ dữ liệu. Các thao tác còn lại đều có hành vi trong trang.

## Giới hạn mock và cách thử

- Không API, endpoint, database, localStorage hoặc sessionStorage. Rời trang/tải lại khôi phục fixture và kỳ mặc định. Không xác thực hoặc phân quyền backend thật.
- Cơ sở cố định `MOCK-PAWCARE` / PawCare Studio; đồng hồ cố định **15/10/2026 10:00 Asia/Ho_Chi_Minh**, có nhãn rõ. Tháng mặc định **01–31/10/2026**. Không dùng ngày máy để âm thầm dịch kỳ demo.
- Mock độc lập với FE-007/008/009 và Tổng quan. Không nhập hoặc sửa dữ liệu của các module đó để giả lập đồng bộ. Tên từ Figma được dùng làm điểm tham chiếu; số booking/pet/ID/liên hệ trong FE-010 là fixture minh họa, không phải API contract hay lịch sử đã đồng bộ.
- Mẫu mặc định: **8 khách trong danh sách; 5 khách đã phục vụ trong kỳ, 2 quay lại, 6 pet đã phục vụ**. Các số tính từ booking thật trong fixture, không dùng cứng `42/26/57` của Figma. Một khách chỉ có Completed tháng 9 vẫn nằm trong danh sách tháng 10. Hai khách chưa có Completed vẫn có hồ sơ và lịch sử.
- Tháng 9/2026: 3 khách đã phục vụ, 0 quay lại, 3 pet; tổng danh sách vẫn 8. Tháng 11: không có Completed trong kỳ, KPI bằng 0 và bộ lọc Mới/Quay lại không có kết quả. Lịch hoàn thành/lần phục vụ gần nhất giữ nguyên khi đổi kỳ.
- `C01` và `C07` cùng tên Hà Linh, có pet cùng tên Miu nhưng ID khác. Tìm `HA LINH` trả hai hàng riêng; tìm `C07` rồi mở hồ sơ hiển thị `halinh.khac@example.com` và booking `KH-015`, không có lịch của `C01`.
- `C01` có hai pet và tám booking phủ đủ sáu trạng thái. “Thú cưng chỉ ở nơi khác”, “Thú cưng chưa từng đặt lịch” và booking `OTHER-*` không xuất hiện. `C07` có Completed trước kỳ ở cơ sở khác nhưng vẫn là Mới tại PawCare Studio. Khách `C-OTHER` chỉ có booking tại nơi khác không xuất hiện.
- `C08` có tên/liên hệ dài và năm pet tại cơ sở, trong đó bốn pet chỉ có Confirmed và không được tính vào KPI pet đã phục vụ.
- Tìm kiếm theo tên khách, mã khách hoặc pet tại cơ sở, không phân biệt hoa/thường/dấu Việt, xử lý cả Đ/đ; kết hợp bộ lọc nhóm theo kỳ. Không có kết quả có nút xóa tìm kiếm/bộ lọc; danh sách rỗng có thông báo riêng.
- “Dữ liệu mô phỏng và trạng thái rỗng” cho thử rỗng/khôi phục dữ liệu; giữ kỳ đang áp dụng và xóa bộ lọc/chọn khách. Không sửa dữ liệu liên hệ hoặc pet.
- Modal native có nhãn theo tên/mã khách, focus ban đầu, Esc, Tab/Shift+Tab trong modal, cuộn riêng và trả focus về nút mở. Có fallback về tiêu đề trang nếu nút mở không còn. Lịch sử dài cuộn trong modal; main cuộn riêng, Header/Sidebar giữ vị trí theo layout cha.

## Kiểm tra

Chạy test không thêm dependency:

```sh
customers_test_dir=$(mktemp -d /tmp/pawflow-fe010-tests.XXXXXX)
./node_modules/.bin/tsc src/features/provider-customers/customerLogic.test.ts --outDir "$customers_test_dir" --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck
node --test "$customers_test_dir/provider-customers/customerLogic.test.js"
```

18 test logic đạt: phạm vi cơ sở/customer ID/pet ID, đủ sáu trạng thái nhưng chỉ Completed vào KPI, biên kỳ bao gồm hai ngày theo giờ Việt Nam, một ngày, trước kỳ, Completed ở nơi khác, đổi kỳ/phân loại, chỉ số toàn bộ lịch sử, giới hạn đồng hồ cho lần phục vụ gần nhất, tìm kiếm Việt, giao tháng/năm UTC, tháng nhuận, ngày sai, dữ liệu rỗng và tính bất biến fixture.

Kết quả bản cuối:

- `npm run lint`: đạt.
- `npx tsc --noEmit`: đạt.
- `npm run build`: đạt; tạo route `/dashboard/customers`.
- Chromium/Playwright trên production build ở **1440×1000, 768×1024, 390×844**: danh sách, tìm kiếm không dấu/hoa thường kết hợp bộ lọc, khách trùng tên mở đúng ID, KPI không đổi theo tìm kiếm, đổi kỳ tháng 9/10/11 và kỳ một ngày, ngày trống/đảo thứ tự giữ kỳ đã áp dụng, phân loại thay đổi theo kỳ, chỉ số toàn bộ lịch sử giữ nguyên, đủ sáu trạng thái, hồ sơ chỉ đọc, không lộ khách/pet/booking nơi khác, tên dài và năm pet, rỗng/khôi phục mẫu, tải lại và điều hướng tới route Lịch hẹn rồi quay lại.
- Kiểm tra trình duyệt đặt timezone máy là `America/Los_Angeles`; mặc định tháng và thông tin hiển thị vẫn theo giờ Việt Nam. Kiểm tra Esc, Tab/Shift+Tab giữ focus trong modal, đóng bằng nút và trả focus về nút mở; modal cuộn tới cuối lịch sử. Main cuộn riêng, Header/Sidebar giữ vị trí, bảng cuộn ngang trong vùng riêng và trang không tràn ngang. Không có lỗi JavaScript.
- Đã xem ảnh desktop/tablet/mobile và modal có tên/liên hệ dài. Bản cuối dùng Lucide và component có sẵn, không tạo asset mới. Script, ảnh và kết quả nằm tại `/tmp/pawflow-fe010-browser/` (`check.cjs`, `results.json`, ảnh `1440-*`, `768-*`, `390-*`). Dùng Playwright đã có trên máy, không cài thư viện.
- Local production: [http://localhost:3012/dashboard/customers](http://localhost:3012/dashboard/customers), đã xác nhận HTTP 200 và tiến trình lắng nghe cổng 3012.
- So sánh SHA-256 xác nhận toàn bộ 116 file tracked có sẵn, bao gồm `AGENTS.md`, giữ nguyên nội dung trong quá trình FE-010. Index trống; FE-010 chỉ thêm 17 file bên dưới.

Chưa kiểm tra Safari/Firefox, screen reader thật, thiết bị thật hoặc API/phân quyền backend. Không còn câu hỏi chặn phạm vi FE-010 đã xác nhận.

## Danh sách file FE-010

17 file mới, không gồm các file nới rộng đã commit riêng trên FE-009:

```text
docs/FE-010-provider-customers.md
src/app/dashboard/customers/page.tsx
src/features/provider-customers/components/CustomerBookingHistory.tsx
src/features/provider-customers/components/CustomerDetailsDialog.tsx
src/features/provider-customers/components/CustomerGroupBadge.tsx
src/features/provider-customers/components/CustomerProfile.tsx
src/features/provider-customers/components/CustomersList.tsx
src/features/provider-customers/components/CustomersReportingPeriod.tsx
src/features/provider-customers/components/CustomersSummary.tsx
src/features/provider-customers/components/CustomersToolbar.tsx
src/features/provider-customers/components/ProviderCustomersPage.tsx
src/features/provider-customers/customerLogic.test.ts
src/features/provider-customers/customerLogic.ts
src/features/provider-customers/customers.module.css
src/features/provider-customers/data/providerCustomersMock.ts
src/features/provider-customers/types.ts
src/features/provider-customers/useCustomersMock.ts
```

## Khi tích hợp backend

Backend phải xác thực Owner và giới hạn mọi truy vấn khách/booking/pet theo cơ sở được phép quản lý, sử dụng ID ổn định; dữ liệu cơ sở khác không được gửi xuống trình duyệt. Fixture chứa dữ liệu ngoài cơ sở chỉ để kiểm tra logic lọc của demo, không đại diện cho ranh giới bảo mật thật. Cần nguồn đồng hồ, booking snapshot, phân trang và cơ chế tải hồ sơ/lịch sử thống nhất khi tích hợp; FE-010 chưa suy ra endpoint hay quyền Staff.

Chưa commit hoặc stage FE-010; chưa push, PR hoặc merge. `AGENTS.md` giữ nguyên thay đổi riêng, không stage.
