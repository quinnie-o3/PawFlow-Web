# FE-019 — Checklist nghiệm thu UI/mock, QA bước 3/4

Cập nhật: 06/11/2026, Asia/Ho_Chi_Minh. Bước 3/4 đạt phần UI/fixture/mock đã giao trên production cuối ở 1440×1000, 768×1024 và 390×844; còn bước 4 bàn giao Git/PR. Register dùng ngay, verification mặc định tắt; recovery/verify chưa có BE dùng mock riêng. Không CAPTCHA/Google/Remember. Không coi PASS UI/mock là API/DB/email/security thật hoặc toàn FE-019 đã tích hợp.

**Nguồn và cách dùng**

[Audit FE-018](FE-018-fe-be-audit.md) định nghĩa S00–S14, mốc dev và PR, C01–C09 và D01–D07. Mỗi tiêu chí có cơ sở Đã xác minh / Đề xuất / Chưa xác minh. Các gate quyết định đã chốt được đánh dấu riêng. Các ô được đánh dấu chỉ áp dụng phạm vi UI/fixture/mock đã giao S12 và kiểm chứng S14; tiêu chí đòi contract/integration BE vẫn để mở. Bằng chứng bước 2 là lịch sử S13, kết quả source cuối bước 3 được ghi riêng S14. Mỗi kết quả phải ghi ref/SHA, dữ liệu/response, môi trường/viewport và artifact. Tất cả luồng dưới đây **chưa đối chiếu proposal**.

| Mốc | Cơ sở dùng cho checklist | Giới hạn |
| --- | --- | --- |
| FE dev S02 b70d18b / Auth S03 23d8bbc | Source Login/Register/AuthInput/hooks/services hiện có | Giữ token helper/guard/đích Login; chỉ sửa Register theo S12; không dùng code sẵn để đánh dấu toàn task Done |
| BE dev S08 38c97ad | LoginDto/RegisterDto, register/login/me, ACTIVE/INACTIVE/SUSPENDED | Chưa có verify/resend/forgot/reset/session/CAPTCHA endpoint/DTO; không tự đặt tên |
| BE PR #10 S09 38f7c85 OPEN | Contract đề xuất được tham chiếu riêng | Không dùng như contract trên dev; không thêm Auth endpoints |
| Figma S10 | Login/register/verify + error/forgot/resend dialogs | Chưa frame Reset cuối; route UI/mock đã có, tham số BE chưa chốt; OTP/3 phút không tự thành server protocol |
| Locale S07 132dbde / PR #19 OPEN | Nền FE-018-019 kế thừa nguyên commit theo S12 | Chỉ mở rộng auth.* trong cùng JSON; không copy/merge PR hoặc tạo helper khác |

**Gate bước 1 đã được giải quyết / giới hạn còn lại**

- [x] G01 — **S12, người dùng/Nhi xác nhận:** Nhi chưa làm phần FE-019 bổ sung; được triển khai phần thiếu, giữ owner/reviewer theo sheet.
- [x] G02 — **S12 đã chốt:** đăng ký dùng ngay với ACTIVE/token thật, không gate verify; dự phòng Login nếu không mở được phiên, không session giả.
- [x] G03 — **Đã giao UI/mock:** Forgot/Reset/Verify/Resend có adapter mô phỏng riêng; contract thật vẫn backlog, chưa dùng TTL/cooldown/code mẫu thành contract.
- [ ] G04 — **Giới hạn đã ghi, không hỏi lại link:** proposal đúng đã xác nhận, Drive thử lại bước 2 vẫn 404; chưa đối chiếu proposal.
- [x] G05 — **Người dùng đã chọn:** nhánh FE-018-019 kế thừa locale #19 tại 132dbde, không copy bộ locale/helper và không tự merge PR.

**Login — /login đang có; chưa đối chiếu proposal**

- [x] L01 — **UI/fixture PASS S14, nền S02/S03:** có email/password, nhãn/autocomplete, link Register; dữ liệu hợp lệ đi qua một lần submit với pending/disable rõ. Kiểm tra service đã được giao cải thiện theo S12; token helper và đích Login giữ nguyên.
- [x] L02 — **UI/fixture PASS S14 theo LoginDto S08:** email hợp lệ/max255, password 8–72; không trim password; field error có nhãn/aria-invalid/aria-describedby, focus lỗi đầu. S12 đã giao áp DTO; kết quả kiểm tra ghi phần bước 2.
- [x] L03 — **Đề xuất theo S10 error dialog:** invalid credentials hiển thị rõ và cho sửa/thử lại; chọn inline/dialog theo quyết định UI, không hiện thành công giả.
- [ ] L04 — **Chưa xác minh contract C03/C09:** lỗi validation string[]/string, invalid credential, inactive/suspended, expired session, 403, 429, network/timeout/5xx có mapping đúng căn cứ server; không suy locked/unverified từ 401 chung.
- [x] L05 — **Đề xuất:** pending chặn gửi lặp trên các đường tương tác; lỗi giữ email và nội dung cần thiết cho retry, công bố trạng thái qua live region; bước 2 giữ dữ liệu khi lỗi để retry trong form; không ghi password vào log/storage.
- Không áp dụng L06 — **S12:** không triển khai Remember; control cũ được bỏ khỏi Login, session mở rộng thuộc task sau.
- [ ] L07 — **FE-028, ngoài nghiệm thu UI độc lập:** response role/status, /auth/me, token lifecycle và điều hướng đúng role kiểm chứng riêng; hiện redirect /dashboard chỉ là hành vi source đã ghi, không tự sửa.

**Register — /register đang có; chưa đối chiếu proposal**

- [x] R01 — **Đã xác minh source:** fullName/email/phone/password/confirm, mismatch, pending/error và link Login hiện diện; kiểm tra keyboard/label/announcements trên bản được giao.
- [x] R02 — **UI/fixture PASS S14 theo RegisterDto S08:** tên trim 2–150; email trim/lowercase/hợp lệ/max255; phone optional, trim/max20, blank→omitted; password 8–72 và không trim; confirm chỉ kiểm tra FE, không thêm vào payload contract. Đã bỏ phone required và áp validation ở bước 2; bằng chứng ghi riêng bên dưới.
- [x] R03 — **S12 đã chọn flow, kiểm chứng bước 2:** Register thành công không đi verify; token thật qua helper hiện có → /dashboard, không token hoặc storage thất bại → /login?registered=1.
- [x] R04 — **Đề xuất theo DTO/API S08:** 400/string[] và 409 email trùng được phản hồi an toàn/actionable; lỗi mạng/5xx có retry, pending không tạo yêu cầu lặp; taxonomy/message theo C03 cần chốt.
- [x] R05 — **S12/S08:** chỉ lưu accessToken từ response API thật; không tạo token/user mock trong Register. UI không tuyên bố đã verify.
- Không áp dụng R06 — **S12:** không triển khai Google/OAuth; control cũ được bỏ khỏi Register.

**Verify email — /register/verify-email inactive; ?demo=1 UI/mock; chưa đối chiếu proposal**

- [ ] V01 — **Đã xác minh S10; tiêu chí Đề xuất:** đối chiếu frame 4687:15577, email che/sáu ô mã/trạng thái bước và điều hướng theo flow được chốt; không gắn giá trị email mẫu thành người dùng thật.
- [ ] V02 — **Contract BE chưa có; D02 đã chốt UI/mock:** server dùng OTP hay link, kiểu/độ dài mã, định danh yêu cầu và cách nhận ngữ cảnh direct-link/reload; không đặt endpoint/DTO/query token bằng suy đoán.
- [x] V03 — **Demo OTP PASS S14, không phải server protocol:** nhập/paste/backspace/keyboard/mobile input, mã thiếu/sai định dạng, focus lỗi và đọc nhãn; kiểm tra không có ô không tiếp cận được.
- [ ] V04 — **Contract BE chưa có; D02 đã chốt UI/mock:** invalid/expired/used/attempt-limit/unverified-already-verified responses; countdown dựa policy/giờ hết hạn đã chốt, không mặc định ba phút từ ảnh là server truth.
- [x] V05 — **Đề xuất:** pending/error/retry không gửi lặp; thông báo success chỉ khi điều kiện được nguồn dữ liệu xác nhận; UI/mock bước 2 phải ghi rõ mô phỏng; không tuyên bố server đã xác minh hoặc email đã gửi.
- [x] V06 — **UI/mock:** success demo không đổi user/session, chỉ có link Login; /register/verify-email mặc định inactive, ?demo=1 là bản mô phỏng riêng. Contract thật quay lại task integration.

**Resend — thiết kế dialog có, chưa API; chưa đối chiếu proposal**

- [ ] S01 — **Đã xác minh S10:** frame 5017:3835 có success và email che; nội dung ba phút chưa được xác nhận bởi BE.
- [ ] S02 — **Contract BE chưa có; D02 đã chốt UI/mock:** resend endpoint/payload, cooldown, expiry mới, giới hạn lần gửi/429/Retry-After và tính hợp lệ mã cũ. Không tự đặt giá trị.
- [ ] S03 — **Đề xuất:** pending khóa gửi lặp, thành công/lỗi được announce, retry đúng thao tác và giữ context; reload/back/đồng hồ không tự reset quyền gửi nếu contract không cho phép.
- [ ] S04 — **Đề xuất theo anti-enumeration policy chờ chốt:** thông báo gửi không tiết lộ tài khoản có tồn tại hoặc hứa email đã gửi khi không có xác nhận thật.

**Forgot password — dialog UI/mock từ Login; chưa đối chiếu proposal**

- [x] F01 — **Đề xuất theo S10 5017:3808:** mở dialog từ entrypoint được giao, email input/nhãn/gửi/đóng; focus vào/giữ/trả, Esc/backdrop và pending-close policy rõ. Handler/dialog mock đã bổ sung ở bước 2; không gọi BE.
- [ ] F02 — **Contract BE chưa có; D02 đã chốt UI/mock:** input validation/endpoint/payload, captcha/rate-limit/retry và response đã chốt; không lấy LoginDto làm ForgotPasswordDto chưa tồn tại.
- [ ] F03 — **Đề xuất theo copy S10, chờ BE policy:** cùng phản hồi chung cho email tồn tại/không tồn tại; không tiết lộ trạng thái tài khoản.
- [x] F04 — **Đề xuất:** UI/mock pending/disable, lỗi mô phỏng/thử lại, thành công và đường quay Login; không báo đã gửi thật. Network/5xx của Forgot thật chưa có BE để nghiệm thu.

**Reset password — /reset-password UI/mock; chưa frame reset/contract BE cuối; chưa đối chiếu proposal**

- [x] P01 — **UI/mock được giao:** route /reset-password nhận định danh demo, xử lý thiếu/sai/duplicate/expired/used; chưa định nghĩa format/route param chính thức của BE.
- [ ] P02 — **Contract BE chưa có; D02/D03 đã chốt UI/mock:** token thiếu/sai/hết hạn/đã dùng và tài khoản không hợp lệ có state/CTA đúng policy, không suy ra từ HTTP status chung.
- [x] P03 — **UI/mock:** password/confirm theo authMockConfig (8–72 chỉ là mẫu), error/focus; chính sách reset thật vẫn cần BE, không coi RegisterDto là ResetPasswordDto.
- [x] P04 — **Đề xuất:** pending chặn gửi lặp, lỗi có retry đúng điều kiện token, success/đường Login rõ; không lưu/log password hay reset token và không tự đưa nhạy cảm vào URL bổ sung.
- [ ] P05 — **Ngoài UI, FE-028/046 + BE:** single-use/expiry, revoke sessions/refresh reuse/logout-all và trạng thái sau đổi mật khẩu được test bằng API riêng. Không coi presentational success là bảo mật đã nghiệm thu.

**Trạng thái tài khoản và expired — chưa đối chiếu proposal**

| Ô nghiệm thu | State | Cơ sở hiện có | Tiêu chí cần xác nhận/kiểm tra tương lai |
| --- | --- | --- | --- |
| [x] A01 | Invalid credentials | Đã xác minh S08 401 và S10 error UI | Copy/thử lại/focus đúng; không tiết lộ tài khoản |
| [ ] A02 | INACTIVE/SUSPENDED user | Đã xác minh S08 enum; login non-ACTIVE bị 401 | Mapping khi BE có đủ thông tin an toàn; không đoán riêng state từ 401 |
| [ ] A03 | LOCKED | Chưa xác minh enum/code/policy; bước 2 chỉ demo riêng | BE bàn giao điều kiện/khôi phục/retry trước tích hợp; không chặn demo đã giao S12 |
| [ ] A04 | UNVERIFIED | Chưa xác minh enum/API; S10 có Verify | D01 đã chọn không gate verify; chỉ demo S12, quyền Login/resend/after-verify thật cần contract về sau |
| [ ] A05 | Expired verification/reset | Chưa có contract ở S08 | Phân biệt loại token/code, expiry/reuse và CTA; không dùng expiry JWT thay |
| [ ] A06 | Expired JWT/session | Đã xác minh JWT check expiry; FE lifecycle chưa nghiệm thu | FE-028/046 kiểm chứng session/401/navigation riêng, không mở rộng trong FE-019 UI |
| [ ] A07 | Provider PENDING/REJECTED/SUSPENDED | Model approval riêng, không phải user.status | Không dùng để suy user bị khóa; điều hướng/RBAC do integration task xác nhận |

**CAPTCHA và scope security — chưa triển khai; chưa đối chiếu proposal**

- Không áp dụng C01 — **S12:** không triển khai CAPTCHA hoặc placeholder trong đợt này.
- [ ] C02 — **FE-047 + BE, chưa xác minh:** sitekey/challenge token/expiry/failure/retry/429/server verify; placeholder không phải chống bot hoạt động.
- [ ] C03 — **FE-028/046/040/053/055:** storage/refresh/revocation/account switch/guard/XSS/headers và negative authorization có checklist/test riêng; không sửa để “đóng” FE-019 UI.

**Locale và QA UI dùng chung — đối chiếu bản được giao**

- [x] Q01 — **Đã kế thừa S07 trên nhánh riêng, chưa merge dev:** text/validation/error/success/aria/metadata mới dùng `locale/vi.json` auth.* và helper vi/formatMessage/formatMessageParts; không tạo JSON/context/framework thứ hai. Giữ enum/status/ID/URL/payload/backend message nguyên dạng; text có biến là nguyên câu.
- [x] Q02 — **Đề xuất:** pending/error/retry/success, focus/keyboard/aria-live, labels/field errors và dialog focus trap/return được kiểm tra trên mọi flow đã triển khai.
- [x] Q03 — **Đề xuất:** responsive desktop/tablet/mobile, text dài, cuộn/overflow và direct/reload/Back/Forward; không chạy lại toàn QA chỉ vì tài liệu đổi.
- [x] Q04 — **Đề xuất:** test UI/mock, test contract giả lập và real API E2E ghi riêng. Artefact phải nêu SHA/URL/payload/response đã che nhạy cảm; không lấy test parity locale hay root smoke làm Auth E2E.
- [x] Q05 — **Đề xuất:** không còn control enabled nhưng không hành động trong phạm vi được duyệt; unsupported/deferred phải được Nhi chốt presentation. Không tự mở rộng Google/Remember.
- [x] Q06 — **Đề xuất nghiệm thu khi có thay đổi source:** lint/typecheck/build và test/browser phù hợp, ghi lỗi có sẵn riêng. Các check source cuối bước 3 ghi ở S14; bằng chứng bước 2 chỉ giữ lịch sử.

**Ranh giới acceptance và backlog contract BE**

FE-019 nghiệm thu phần UI được giao; FE-028 nghiệm thu Auth API/identity/redirect/401/403/session cơ bản; FE-046 session nâng cao, FE-047 CAPTCHA thật, FE-053/055/057 role/security/error taxonomy. Không gộp các PASS thành một task Done.

D01–D04 đã giải quyết theo chỉ đạo bước 2; D05 giữ giới hạn truy cập, không hỏi lại link. Contract BE thật và các quyết định domain ngoài cụm tiếp tục là backlog. Các tiêu chí demo được kiểm tra tách khỏi API/DB/email/security thật; kết quả bước 2 được ghi riêng, không thay QA toàn cụm bước 3.

**Lịch sử bằng chứng bước 2/4 — source S13, không thay kết quả S14**

Branch `FE-018-019`, worktree `/Users/tom/Desktop/PawFlow/PawFlow-Auth-FE018-019`, HEAD/nền locale #19 `132dbde668cc09c1273148808e2ea67a413cce99`; thay đổi Auth chưa commit. Snapshot 264 file src/public/locale giữ nguyên trước/sau check cuối, manifest SHA-256 `d5c0ff17e5764029107a923305fb814c369925c30e1abc7cf37aa68a3a670d5e`. Nền này đã có dev `b70d18b`; #19 chưa merge tại snapshot kiểm tra. Source dev và working tree được ghi riêng trong audit, BE PR #10 chưa là contract dev.

| Tiêu chí liên quan | Đã xác minh ở bước 2 | Phần còn dành cho QA/tích hợp |
| --- | --- | --- |
| L01–L05, R01–R05 | HTTP fixture trên service Login/Register thật; validation/focus, DTO boundaries qua unit test, optional phone, payload normalization, 400 array/409/401/5xx, giữ form/retry; Register pending chỉ một POST | API thật/DB/CORS và thông báo mọi nhánh lỗi cần QA môi trường phù hợp; browser fixture không chứng minh BE chạy |
| R03/R05/G02 | Response token hợp lệ → helper hiện có → /dashboard; thiếu token hoặc storage lỗi → /login?registered=1; không đẩy Register sang verify hoặc tạo session giả | Role redirects/identity/refresh/guard vẫn FE-028 và task session; helper token giữ byte nguyên |
| F01/F04/Q02 | Forgot dialog mở/giữ/trả focus, Shift+Tab/Esc, validation, pending chặn đóng, lỗi/retry và link reset demo | Chưa gửi email thật; request/response/rate-limit/anti-enumeration thật cần BE |
| P01/P03/P04 | Reset thiếu/sai/duplicate/expired/used URL không lộ form; mismatch, error/retry/success demo; dữ liệu và phiên không đổi; hint cách confirm label 6px tại 1440/390px | Chính sách reset/password/token single-use/expiry/revoke session thật chưa nghiệm thu; chưa frame Reset cuối được xác nhận |
| V03/V05/V06, S03/S04 | Verify mặc định inactive; demo paste sáu số → focus ô 6, Left/Right → ô 5/6, Backspace ô trống về trước, invalid/error/retry/success; resend lỗi/retry/cooldown mẫu | Không xác minh tài khoản/gửi email thật; phương thức OTP/link, DTO/expiry/attempt-limit là contract tương lai |
| A01–A05 | Chỉ exact message `Invalid email or password`, `Account is not active` map sang UI thật; generic 401 giữ generic. Các state thiết kế khác chọn ở /auth-demo, có nhãn mô phỏng | Không suy INACTIVE/SUSPENDED riêng từ một lỗi không phân biệt; LOCKED/UNVERIFIED/expired thật cần BE |
| G03/Q04 | Toàn bộ recovery/verify/account demo không phát API request/mutation và giữ token sentinel có sẵn trong browser. Unit tests adapter không dùng network/storage; state chỉ trong bộ nhớ | Không chứng minh email/backend/security thật; không đưa giá trị mock thành hợp đồng server |
| Q01/Q03/Q05 | Chỉ auth.* đổi trong cùng JSON: 1.040 → 1.124 leaf strings; helper giữ nguyên. 18 ảnh ở 1440×1000/390×844 không tràn ngang/ảnh hỏng; đã xem trực tiếp Reset/Verify mobile và Forgot desktop | Tablet, text dài, toàn bộ navigation/focus/announcements và hồi quy các shell ở bước 3 |
| Q06 | Lint, typecheck không incremental, production build exit 0; 14/14 unit tests; 30 browser flow groups + kiểm tra OTP riêng ở hai kích thước; 0 pageerror | Đây là kiểm tra triển khai bước 2, chưa đóng QA toàn cụm |

Lệnh kiểm tra: `npm run lint`; `npx tsc --noEmit --incremental false`; compile `src/features/auth/authLogic.test.ts` sang thư mục `/tmp` bằng TypeScript rồi `node --test`; `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api npm run build`; `npm run start -- -p 3041`. Browser dùng production build sau sửa cuối, không dùng kết quả cũ từ cổng 3040. Không thực hiện lại hoặc thay cách chạy lệnh dừng PID 98782 đã bị từ chối; cổng 3040 giữ nguyên.

Artifact ngoài repo: `/tmp/pawflow-fe018-fe019-step2-20261106/resume-final/validation.json`, `build.log`, `lint.log`, `typecheck.log`, `unit.log`, `browser/results.json`, 18 PNG, `otp-focus.json`, source/preservation snapshots và script tạm. Chỉ một test logic source nằm trong repo; browser scripts/compiled tests/log/ảnh không nằm trong diff. Bảy worktree cũ, 24 backup và ba stash khớp snapshot; không thao tác editor/buffer.

Preview: [Login/Forgot](http://localhost:3041/login), [Register](http://localhost:3041/register), [Reset demo](http://localhost:3041/reset-password?token=demo-reset), [Verify inactive](http://localhost:3041/register/verify-email), [Verify demo](http://localhost:3041/register/verify-email?demo=1), [State demo](http://localhost:3041/auth-demo). URL API preview local 8000 chỉ được browser test chặn bằng fixture, không có mock Login/Register trong app để đăng nhập thủ công.

**Checklist bước 3 đã thực hiện — phạm vi UI/fixture/mock**

- [x] QA hồi quy toàn cụm trên snapshot cuối, gồm desktop/tablet/mobile, text dài, keyboard/focus/live-region/dialog, direct/reload/Back/Forward và các shell liên quan.
- [x] Rà pending/race/double-submit/unmount, response lỗi/mất mạng và retry; giữ phân biệt account state thật với demo và giữ nguyên phiên trong mọi mock.
- [x] Kiểm tra lại không gate verify, không có control chức năng giả ngoài scope, locale/helper nhất quán, không đổi guard/session/role routing ngoài nhiệm vụ.
- [x] Ghi rõ phần API fixture/UI/mock với API/DB/email/security thật; đối chiếu proposal nếu truy cập được, không gán nội dung chưa đọc. Kiểm tra dependency #19 trước bước 4 bàn giao một PR chung.

Bước 2/4 đã hoàn thành theo lịch sử S13; kết luận hiện tại bước 3 ở phần S14 bên dưới. Không còn quyết định Auth UI cần Nhi trả lời để chốt bước 2; contract BE còn thiếu là dependency tích hợp tương lai. Chưa stage/commit/push/PR/merge hoặc cập nhật sheet.

**S14 — Kết quả nghiệm thu UI/mock bước 3 trên source cuối**

Bước 3/4 đạt, còn bước 4 bàn giao Git/PR. Các ô UI được đánh dấu theo kết quả bên dưới; ô BE/contract/security/role lifecycle còn mở không phải lỗi UI đã được giao. FE-018 vẫn thiếu đối chiếu proposal cả 30 nhóm; không thử lại quyền truy cập trong bước 3. Không đánh dấu toàn task/sheet Done.

Nguồn: branch `FE-018-019`, HEAD/base locale #19 `132dbde668cc09c1273148808e2ea67a413cce99`; source chưa commit, 37 file cụm (11 tracked sửa +26 mới). Build ID `AyLUyrTCTM-bKH5EcxlXv`, production port 3044. Runtime manifest 264 file SHA-256 `2a88b4a54ea143685663663da2fca11543fb54f2e4c1816168aa7b2133b5d1c4`; source không đổi từ build/check cuối. Manifest S13/d5c0… và preview cũ chỉ là lịch sử.

| Nhóm nghiệm thu UI | Bằng chứng source cuối |
| --- | --- |
| L01–L05, R01–R05 | DTO boundaries/normalization/optional phone, field error/focus và pending chống gửi lặp; API fixture string/array, 400/409/exact 401/generic 403/429/network/5xx, giữ form và retry |
| Register thành công | Token string hợp lệ → helper cũ/dashboard; thiếu token, token số/whitespace, null/array/JSON hỏng hoặc storage throw → Login với thông báo thành công, không POST lặp và không báo đăng ký thất bại. Không verify gate |
| Login thiếu token/lỗi storage | Giữ Login và phiên cũ, phản hồi lỗi; retry được. Không dựng session hoặc mở rộng lifecycle |
| Pending/late response/navigation | Rời Login/Register lúc đang chờ, response muộn không đổi token/route; Back submit được. Forgot/Reset/Verify/Resend pending rồi Back/Forward không kẹt UI; mock không đổi phiên |
| Keyboard/focus/long content | Tab/Shift+Tab form; Forgot tools đóng/mở, Esc/backdrop/close/return; nhập/paste/sửa từng ô/Backspace/arrows OTP; thông báo dài không chồng nhãn/tràn ngang ở ba viewport |
| Recovery/Verify mock | Reset missing/empty/bad/duplicate/expired/used URL, mismatch/pending/failure/retry/success; Verify inactive mặc định, demo expiry/resend/cooldown với clock giả lập, không đổi policy toàn app |
| Locale/aria/metadata | Cùng JSON/helper; ngoài auth.* và helper không đổi; sentence placeholders không để thô, aria-describedby có target; Auth metadata title/description đúng locale và wrapper lang=vi |

Ba lỗi source đã sửa: metadata Auth kế thừa mẫu Next (năm màn title/description và language scope Auth); Forgot focus trap tính cả checkbox dưới details đang đóng; và sửa một chữ số OTP sau phím mũi tên làm thay nhầm ô bên cạnh. Sửa đúng tám file Auth đã có trong phạm vi, không đổi service/token/guard/redirect/policy hay mock parameters. Probe/debug và các lần trước sửa không được tính vào chứng cứ cuối. Ca tablet timeout ban đầu chưa quy nguyên nhân cho source; lần debug và các lần trên source cuối đều pass. Selector harness keyboard chọn nhầm Forgot thay Submit cũng đã sửa trước QA cuối.

Thực chạy sau sửa cuối: lint/typecheck/build exit 0; **45 nhóm flow +51 nhóm QA bổ sung +3 nhóm Register network/503 retry +3 smoke role =102 nhóm browser pass**, ba viewport 1440×1000, 768×1024, 390×844, không pageerror trong các run cuối. Có 51 ảnh từ các run cuối. 19/19 tests (14 Auth +5 helper locale) chạy bước 3 được dùng lại vì phần logic/helper/JSON không đổi sau sửa metadata/focus/OTP. Không chạy lặp toàn bộ dashboard: chỉ smoke /dashboard, /admin, /staff/bookings tại tablet.

Artifact ngoài repo: `/tmp/pawflow-fe018-fe019-step3-20261106/` gồm `baseline-otp-final/results.json`, `extended-otp-final/results.json`, `register-retry-otp-final.json`, `shell-smoke-otp-final.json`, các log `*-otp-final.log`, `unit.log`, 51 ảnh cuối, script/compiled tests, `validation.json`, `source-otp-final-tested.json`, `source-after.json`, `repo-file-manifest.json` và preservation snapshots. Chỉ test logic Auth có source trong repo. Danh sách 37 file và tám file thay thêm ở bước 3 ghi trong [audit FE-018](FE-018-fe-be-audit.md); hai Markdown vẫn là cùng bản gốc.

Preview cuối: [Login/Forgot](http://localhost:3044/login), [Register](http://localhost:3044/register), [Reset demo](http://localhost:3044/reset-password?token=demo-reset), [Verify inactive](http://localhost:3044/register/verify-email), [Verify demo](http://localhost:3044/register/verify-email?demo=1), [Account states](http://localhost:3044/auth-demo). Cổng cũ không dừng; không chạy lại lệnh dừng PID đã bị từ chối. API preview local 8000 chỉ được harness interception; chưa có BE thật hoặc app mock Login/Register cho thao tác thủ công.

**Các ô còn mở và dependency không được coi là PASS integration**

V02/V04/S02/F02/P02/P05 và phần thật của L04/A02–A07/C02–C03 vẫn cần contract/môi trường BE: phương thức verify, DTO/context/error/expiry/reuse/rate-limit, states, session/RBAC/security. V01/S01 giữ giới hạn đối chiếu toàn bộ design; S03/S04/F03 về policy server chỉ được minh họa trong mock. Không nghiệm thu email/backend/DB/security, Safari/Firefox/thiết bị/screen reader thật. Không ghi password/OTP/reset token vào app log hoặc tạo URL mới chứa dữ liệu nhập; mock chỉ dùng các định danh công khai đã có.

PR #19 kiểm tra live trong bước 3 vẫn OPEN/merged=false, head 132dbde, base dev b70d18b. Bước 4 phụ thuộc locale merge trước PR vào dev để tránh lặp 114 file; không tự merge/rebase/cherry-pick. Giữ owner/reviewer sheet, bảy worktree cũ/24 backup/ba stash và buffer. Chưa stage/commit/push/PR/merge hoặc cập nhật sheet. Không còn quyết định Auth UI cần hỏi lại Nhi trước bước 4.
