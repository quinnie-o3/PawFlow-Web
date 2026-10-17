# FE-008 — Provider Lịch khả dụng

Route `/dashboard/availability`, đúng đường dẫn Sidebar FE-005. Nhánh `FE-008` được tạo từ FE-007 commit `9021b7a` theo cho phép của chủ dự án, không chờ merge các PR trước.

Thiết kế chính: [Website → PawFlow → Dashboard → Provider Lịch khả dụng, node 4664:14961](https://www.figma.com/design/inb2P8smrZU5d2gNImKoaP/PawFlow?node-id=4664-14961). Đã đọc design context và ảnh tham chiếu; giữ các khối giờ tuần, ngoại lệ, quy tắc và khung gần nhất. Không dùng bản Archive. Chấm trạng thái Mở/Đóng được tải từ asset Figma, hiển thị đúng 7×7px.

Kế thừa dashboard layout và `DashboardDialog` hiện có; không sửa Tổng quan, Lịch hẹn, Header, Sidebar, dependency, lockfile hoặc config. Giữ nguyên các khác biệt có sẵn của shell: avatar biểu tượng thay ảnh, cách hiển thị điều hướng trên mobile. Bổ sung nút tạo/quản lý slot và lịch sử để thực hiện nghiệp vụ đã được xác nhận. Các dialog mở rộng theo hành vi yêu cầu vì thiết kế chính không mô tả chi tiết form.

## Quyết định nghiệp vụ đã được chủ dự án xác nhận

- Phạm vi Provider Owner. UI ghi rõ vai trò mô phỏng; không đại diện cho xác thực/phân quyền thật.
- Owner tạo slot thủ công, chọn dịch vụ, ngày, giờ bắt đầu/kết thúc và sức chứa nguyên dương. Không tự sinh slot từ giờ tuần.
- Mỗi slot thuộc một dịch vụ, độ dài bằng thời lượng dịch vụ. Sức chứa độc lập theo slot; chưa quản lý năng lực dùng chung giữa dịch vụ hoặc nhân viên.
- Một booking chiếm một chỗ trong slot đã chọn. Pending Confirmation và Confirmed đều giữ chỗ. Rejected, Cancelled, Completed, No-show không giữ chỗ. Không tự đổi trạng thái booking theo thời gian.
- Slot cùng dịch vụ không được trùng khoảng thời gian; hai slot liền kề được phép. Dịch vụ khác có thể trùng giờ trong giới hạn mô hình sức chứa độc lập này. Slot đã đóng vẫn được xét xung đột thời gian.
- Slot phải nằm hoàn toàn trong một khoảng giờ hoạt động có hiệu lực; không được bắc qua giờ nghỉ. Form hiện hỗ trợ khoảng bắt đầu/kết thúc trong cùng ngày, chưa hỗ trợ qua đêm.
- Slot có booking giữ chỗ: không được xóa, đóng, đổi dịch vụ hoặc đổi ngày giờ/trạng thái mở. Chỉ sửa sức chứa, không thấp hơn số booking giữ chỗ.
- Khi hết chỗ, slot không còn nhận booking mới. Trạng thái nhận lịch được tính từ cờ mở, thời gian, giờ có hiệu lực và số chỗ còn lại; không cần sửa booking hoặc cờ mở khi hết chỗ.
- Từ đúng thời điểm bắt đầu slot trở đi: không được sửa, đóng hoặc xóa. Slot lịch sử chỉ đọc.
- Múi giờ `Asia/Ho_Chi_Minh`. Hàm kiểm tra nhận thời điểm hiện tại từ bên gọi, không phụ thuộc múi giờ máy.

### Giờ hoạt động tuần

- Mỗi ngày có nhiều khoảng không chồng nhau hoặc đóng cả ngày. Khoảng liền kề hợp lệ; thứ tự nhập không quyết định tính hợp lệ.
- Bắt buộc chọn ngày bắt đầu có hiệu lực, không trước ngày hiện tại theo múi giờ Việt Nam.
- Lưu các phiên bản theo ngày hiệu lực; giữ lịch sử trước đó. Khi đã có một phiên bản cùng ngày hiệu lực chưa thuộc lịch sử, lưu sẽ cập nhật đúng phiên bản của mốc đó. UI báo rõ trường hợp này.
- Phiên bản có hiệu lực từ ngày được chọn tới trước phiên bản kế tiếp. Khi kiểm tra, ngoại lệ ngày vẫn có quyền thay thế giờ tuần.
- Trước khi lưu, kiểm tra lại **toàn bộ** slot từ ngày hiệu lực trở đi theo giờ thực sự có hiệu lực. Bao gồm cả slot chưa có booking và slot đã đóng. Liệt kê các slot xung đột bằng mã, ngày giờ, số chỗ đang giữ; chặn lưu.
- Không tự tạo, xóa, di chuyển slot hoặc thay đổi booking. Owner phải xử lý slot xung đột trước.

### Ngoại lệ ngày

- Một cấu hình cho mỗi ngày, thay thế **toàn bộ** giờ tuần của ngày đó. Có thể nghỉ cả ngày hoặc nhập nhiều khoảng không chồng nhau.
- Nếu ngày đã có cấu hình, phải chỉnh mục hiện có. Sau khi tạo, ngày của cấu hình được giữ cố định; muốn cấu hình ngày khác thì tạo ngoại lệ cho ngày đó.
- Tạo/sửa/xóa đều kiểm tra lại toàn bộ slot của ngày. Nếu slot ngoài giờ mới, chặn lưu và nêu từng slot liên quan, kể cả slot chưa có booking.
- Xóa ngoại lệ sẽ kiểm tra giờ tuần có hiệu lực của ngày đó; chỉ xóa nếu mọi slot vẫn hợp lệ. Không sửa/xóa ngoại lệ thuộc ngày lịch sử.
- Đóng/xóa slot và xóa ngoại lệ đều có bước xác nhận. Nếu bị khóa, hiển thị lý do ngay cạnh thao tác. Không tự hủy hoặc chuyển booking.

## Tổ chức và kiểm tra lúc lưu

- `src/app/dashboard/availability/page.tsx`: ghép route, tái sử dụng layout cha.
- `src/features/provider-availability/components/`: trang điều phối, component hiển thị, form ngày/giờ tuần/slot, danh sách quản lý và phản hồi có focus.
- `types.ts`: mô hình nội bộ của bản mock, không phải API contract.
- `data/providerAvailabilityMock.ts`: danh sách dịch vụ, slot, booking và lịch mẫu tường minh.
- `availabilityLogic.ts`: quy đổi ngày Việt Nam, tính giữ chỗ/giờ hiệu lực, kiểm tra và reducer thuần. Form kiểm tra để phản hồi sớm; reducer kiểm tra lại với dữ liệu mới nhất tại lúc lưu. Thất bại không thay đổi các tập dữ liệu. Không có request bất đồng bộ hoặc loading giả.
- `availabilityLogic.test.ts`: 20 test hành vi, gồm các biên và xung đột nghiệp vụ.
- `availability.module.css` và `public/availability/`: style/asset riêng của FE-008.

## Giới hạn dữ liệu mô phỏng

- Không API, endpoint, database, localStorage hoặc sessionStorage. Thay đổi chỉ nằm trong bộ nhớ của lần mount trang; tải lại/rời trang sẽ khôi phục mẫu. Không đồng bộ tab hoặc người dùng khác.
- Đồng hồ cố định: **15/10/2026 10:00 Asia/Ho_Chi_Minh**, có nhãn rõ trên trang. Đây không phải đồng hồ thời gian thực; mọi chặn ngày/giờ trong demo đều dùng mốc mô phỏng này. Test truyền các thời điểm khác nhau để kiểm tra đúng biên.
- Booking `MOCK-01`…`MOCK-12` là fixture riêng của FE-008, không đọc hoặc trình bày như đồng bộ trạng thái với FE-007. Mỗi bản ghi là một chỗ, không có trường số chỗ tùy ý.
- Hai dịch vụ mẫu: Tắm & cắt tỉa 90 phút và Spa thư giãn 60 phút. Chưa có đồng bộ catalog hoặc quản lý nhân viên/nguồn lực.
- 9 slot được khai báo tường minh. Ba slot lịch sử giữ mẫu Figma 30/09 và 01/10; sáu slot tương lai phủ giữ chỗ, còn chỗ, hết chỗ, đóng. Không có thuật toán sinh slot.
- Figma có slot **01/10 08:30** ngoài giờ Thứ Năm **09:00–12:00**. Giữ nguyên dưới dạng fixture lịch sử chỉ đọc, không tự sửa hoặc suy diễn ngoại lệ bổ sung. Không cho tạo slot tương lai có xung đột tương tự.
- Thẻ tổng hợp tính từ dữ liệu thật trong phiên mock: khung còn nhận lịch và booking giữ chỗ trong 7×24 giờ tiếp theo; tổng ngày ngoại lệ gồm cả lịch sử. Không dùng cứng số minh họa 24/18 của Figma. Khung gần nhất chỉ lấy slot tương lai đang mở. Lịch sử được xem trong quản lý slot.
- Không có luồng đặt booking mới ở FE-008. Hàm `canAcceptBooking` và UI xác định slot hết chỗ/không nhận lịch; việc nhận booking thực tế thuộc luồng tích hợp sau.

## Cách thử

- “Tạo slot thủ công”: Spa, 15/10/2026 15:30–16:30, sức chứa 2 là slot liền kề hợp lệ. 14:00–15:00 xung đột `slot-4`; độ dài 30 phút không hợp lệ với Spa 60 phút.
- “Quản lý slot”: `slot-4` giữ 2 chỗ, chỉ sửa sức chứa từ 2 trở lên. `slot-6` không giữ chỗ, có thể đóng/mở lại, sửa hoặc xóa. `slot-7` hết chỗ. `slot-1`…`slot-3` chỉ đọc.
- “Chặn ngày” 15/10 sẽ nêu `slot-4` và chặn lưu. Chặn 18/10 khi chưa có slot sẽ lưu được; có thể xem/sửa hoặc xác nhận xóa để trở lại giờ Chủ Nhật.
- Thêm ngoại lệ 16/10 chỉ nhận 09:00–12:00 sẽ nêu `slot-6`, dù slot này không có booking giữ chỗ. Thêm ngoại lệ 18/10 với 09:00–12:00 sẽ cho tạo slot Chủ Nhật trong khoảng đó; sau khi có slot, không thể xóa ngoại lệ để quay về Chủ Nhật đóng cửa.
- “Chỉnh sửa giờ mở cửa”: chọn ngày quá khứ để kiểm tra validation. Đóng Thứ Sáu từ 15/10 sẽ liệt kê cả `slot-5` và `slot-6`; từ 22/10 có thể lưu nếu không còn slot xung đột.
- Mỗi form có checkbox “Mô phỏng lỗi khi lưu”; thất bại giữ nguyên dữ liệu và giữ form mở để thử lại.
- “Dữ liệu mô phỏng và trạng thái rỗng”: thử không có slot/ngoại lệ hoặc khôi phục mẫu; UI báo rõ việc thay thế dữ liệu phiên hiện tại.

## Kết quả kiểm tra thực tế

- **20/20 test logic đạt**: giữ chỗ theo trạng thái, biên sức chứa, khóa booking/lịch sử, thời lượng, slot liền kề/chồng lấn, giờ nghỉ, biên ngày Việt Nam, lịch sử/ngày hiệu lực/phiên bản sau, ngoại lệ thay thế toàn bộ và fallback khi xóa, kiểm tra lại khi lưu, lỗi mô phỏng và tính bất biến.
- `npm run lint`: đạt.
- `npx tsc --noEmit`: đạt.
- `npm run build`: đạt; có route `/dashboard/availability`.
- Chromium/Playwright trên bản production build, **1440/768/390px**: đã kiểm tra form, validation, lưu/thử lại, slot giữ chỗ và lịch sử, đóng/mở/xóa slot, sửa giờ tuần và liệt kê xung đột, thêm/sửa/xóa ngoại lệ, chống trùng ngày, fallback giờ tuần, tạo slot Chủ Nhật qua ngoại lệ, dữ liệu rỗng/khôi phục và mất dữ liệu khi reload. Không có lỗi JavaScript hoặc tràn ngang trang.
- Đã xem ảnh chụp cả ba kích thước và modal mobile, kiểm tra asset trạng thái tải thành công, đúng 7×7px; Esc, focus vào modal, Tab/Shift+Tab giữ focus trong modal và trả focus về nút mở, kể cả khi chuyển danh sách slot sang form chi tiết. Có fallback về tiêu đề trang nếu nút mở không còn tồn tại.
- Browser scripts/ảnh/kết quả tại `/tmp/pawflow-fe008-browser/`, dùng Playwright đã có trên máy; không thêm dependency vào repo.
- **Chưa kiểm tra** Safari/Firefox, thiết bị di động thật, screen reader thật, API/phân quyền/đồng hồ server hoặc truy cập đồng thời nhiều phiên.

Chạy test logic không thêm dependency:

```sh
test_output=$(mktemp -d /tmp/pawflow-fe008-tests.XXXXXX)
./node_modules/.bin/tsc src/features/provider-availability/availabilityLogic.test.ts --outDir "$test_output" --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
node --test "$test_output/provider-availability/availabilityLogic.test.js"
```

## Khi tích hợp backend

Backend phải xác thực Provider Owner và kiểm tra lại **toàn bộ** điều kiện trong một thao tác nhất quán với dữ liệu mới nhất: dịch vụ/thời lượng, thời gian Việt Nam, lịch sử/ngày hiệu lực, ngoại lệ, chồng lấn, sức chứa, trạng thái booking, khả năng nhận booking mới và cạnh tranh giữa đặt booking/sửa slot/sửa lịch. Đồng hồ thực tế, lưu lịch sử bền vững, chống thao tác lặp, lỗi và hợp đồng API cần được thống nhất sau; không suy ra endpoint hoặc cơ chế phân quyền từ bản mock.

Không còn câu hỏi nghiệp vụ chặn FE-008 hiện tại. Chưa commit, stage, push, tạo PR hoặc merge. `AGENTS.md` là thay đổi có sẵn của chủ dự án, được giữ nguyên và không stage.
