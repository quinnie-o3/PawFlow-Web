# P3-FE — Tích hợp Cloudflare Turnstile cho luồng xác thực

Backend tham chiếu (chỉ đọc): `pet-care-project` — `src/auth/bot-protection/*`, `src/auth/dto/*`, `docs/phase3/bot-protection.md`, `docs/phase3/p3-be12-fe-be-traceability.md` (mục T1, T3).

## 1. Ánh xạ luồng → endpoint → action

| Luồng | Endpoint (tương đối với `NEXT_PUBLIC_API_URL`) | Action widget | Body gửi đi | Trạng thái FE |
|---|---|---|---|---|
| Đăng nhập | `POST /auth/login` | `login` | `{ email, password, turnstileToken }` | Đã tích hợp UI ([LoginForm.tsx](../src/components/auth/LoginForm.tsx)) |
| Đăng ký | `POST /auth/register` | `register` | `{ fullName, email, phone?, password, turnstileToken }` | Đã tích hợp UI ([RegisterForm.tsx](../src/components/auth/RegisterForm.tsx)) |
| Quên mật khẩu | `POST /auth/forgot-password` | `forgot_password` | `{ email, turnstileToken }` | **Chỉ có service** — chưa có trang |
| Đặt lại mật khẩu | `POST /auth/reset-password` | `reset_password` | `{ token, newPassword, turnstileToken }` | **Chỉ có service** — chưa có trang |

`token` (reset-password) là mã trong liên kết email `/reset-password#token=…`, **khác** `turnstileToken`.
`phone` để trống sẽ bị bỏ khỏi body (backend coi là tùy chọn).

## 2. Thành phần

| File | Vai trò |
|---|---|
| `src/features/auth/turnstile/turnstileConfig.ts` | Action, URL script, site key, giới hạn 2048 ký tự |
| `src/features/auth/turnstile/loadTurnstileScript.ts` | Nạp `api.js?render=explicit` đúng một lần; lỗi/timeout 15 s có thể thử lại |
| `src/features/auth/turnstile/turnstileController.ts` | Một widget/instance: render, reset, destroy; bỏ qua callback sau khi destroy |
| `src/features/auth/turnstile/turnstileTokenState.ts` | Reducer trạng thái token + thông báo tiếng Việt |
| `src/features/auth/turnstile/protectedSubmit.ts` | Chặn gửi trùng, tiêu thụ token trước request, reset sau request |
| `src/components/auth/TurnstileWidget.tsx` | Client component dùng lại (props: `action`, `siteKey`, `onToken`, `onExpire`, `onError`, `onTimeout`, `onReady`, `onUnavailable`, `reloadKey`, `ref.reset()`) |
| `src/components/auth/TurnstileField.tsx` | Widget + dòng trạng thái (`role=status/alert`) + nút "Thử lại" |
| `src/features/auth/hooks/useTurnstileProtectedSubmit.ts` | Hook cho form: `canSubmit`, `submit(send)`, `cooldownSeconds`, `retryChallenge` |
| `src/features/auth/services/authApi.ts` | Gọi API, chuẩn hóa lỗi theo `code`, `Retry-After` |
| `src/features/auth/services/passwordRecovery.ts` | `requestPasswordReset`, `resetPassword` |

Dùng cho trang mới (ví dụ quên mật khẩu):

```tsx
const turnstile = useTurnstileProtectedSubmit(TURNSTILE_ACTIONS.forgotPassword);
// <TurnstileField turnstile={turnstile} />
await turnstile.submit((turnstileToken) => requestPasswordReset({ email, turnstileToken }));
// Luôn hiển thị FORGOT_PASSWORD_GENERIC_MESSAGE, không phụ thuộc email.
```

## 3. Vòng đời token

1. Widget render với đúng action; nút gửi bị khóa đến khi có token.
2. Khi gửi: token được lấy ra **và xóa ngay** (đồng bộ, qua ref) → bấm hai lần không thể dùng lại.
3. Chỉ một request tại một thời điểm; request gửi đúng một lần, không tự retry.
4. `finally`: reset widget sau **mọi** kết quả (2xx, 4xx, 5xx, lỗi mạng) → lần sau cần token mới.
5. Hết hạn (`expired-callback`): xóa token, reset widget ngay.
6. Lỗi/timeout của widget: xóa token, hiện "Thử lại". Script không tải được: "Thử lại" nạp lại script.
7. Unmount/điều hướng/Strict Mode: widget bị `remove`, callback muộn bị bỏ qua; reset sau khi đã hủy là no-op.
8. Token chỉ nằm trong bộ nhớ component: không localStorage/sessionStorage, không URL, không header, không state toàn cục, không log.

## 4. Mã lỗi

Luôn rẽ nhánh theo `code`/HTTP status, không theo nội dung `message` tiếng Anh.

| HTTP | `code` | Hành vi UI |
|---|---|---|
| 403 | `TURNSTILE_REQUIRED` | "Vui lòng hoàn tất bước xác minh…", widget đã reset |
| 403 | `TURNSTILE_INVALID` | "Xác minh … không hợp lệ…", widget đã reset |
| 403 | `TURNSTILE_EXPIRED` | "Phiên xác minh đã hết hạn…", widget đã reset |
| 503 | `TURNSTILE_UNAVAILABLE` | "Dịch vụ xác minh tạm thời gián đoạn… N giây", khóa nút trong N giây |
| 503 | `RATE_LIMIT_UNAVAILABLE` | "Hệ thống đang tạm thời bận… N giây", khóa nút |
| 429 | `RATE_LIMITED` | "Bạn đã thử quá nhiều lần… N giây", khóa nút, nút hiển thị đếm ngược |
| 400 | — | `message` (chuỗi hoặc mảng → nối bằng `; `); reset-password: thông báo liên kết không hợp lệ/hết hạn |
| 401 | — | Đăng nhập: sai email/mật khẩu hoặc tài khoản không hoạt động |
| 409 | — | Đăng ký: email đã được sử dụng |
| mạng | — | "Không thể kết nối tới máy chủ…" |

`Retry-After`: đọc header trước (số giây hoặc HTTP-date; backend có expose header qua CORS), sau đó `retryAfterSeconds` trong body; giá trị sai bị bỏ qua, kẹp trong [1 s, 15 phút].

**Không refresh JWT:** các endpoint này không đi qua cơ chế refresh nào (frontend hiện chưa có interceptor refresh). 403 `TURNSTILE_*` không phải lỗi phiên. Nếu sau này thêm interceptor refresh-on-401, phải loại trừ `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`.

## 5. Biến môi trường

| Biến | Nơi | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | FE | Đã gồm `/api`, ví dụ `http://localhost:8000/api` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | FE | Site key công khai, được inline lúc build → đổi giá trị phải build lại |
| `TURNSTILE_SECRET_KEY` | **Chỉ BE** | Không bao giờ đưa vào FE |

Thiếu site key → widget hiện "Không thể tải bước xác minh…" và nút gửi bị khóa.

### Local
- BE `TURNSTILE_MODE=disabled`: BE bỏ qua token; FE vẫn render widget và gửi token (cần site key hợp lệ cho `localhost`, hoặc test key).
- BE `TURNSTILE_MODE=enforce` + `TURNSTILE_EXPECTED_HOSTNAMES=localhost`: site key thật, widget phải cho phép hostname `localhost` trong Cloudflare Dashboard, secret của BE phải thuộc **cùng** widget.
- Kiểm thử xác định (chỉ local): FE site key `1x00000000000000000000AA`; BE secret `1x0000000000000000000000000000000AA`, `TURNSTILE_EXPECTED_HOSTNAMES=example.com`, `TURNSTILE_CHECK_ACTION=false` (test key trả về hostname `example.com`, không có action).

### Staging / Production
- BE bắt buộc `TURNSTILE_MODE=enforce`; không dùng test key (BE từ chối khởi động).
- Hostname cho phép của widget = domain người dùng truy cập FE = `TURNSTILE_EXPECTED_HOSTNAMES`; origin FE phải nằm trong `CORS_ORIGINS` của BE.
- Mỗi môi trường một widget (site key/secret riêng).

## 6. CSP

FE hiện **không** cấu hình Content-Security-Policy (`next.config.ts` không có `headers()`, không có `proxy.ts`/`middleware.ts`). Khi thêm CSP, cần tối thiểu:

```
script-src 'self' https://challenges.cloudflare.com;
frame-src https://challenges.cloudflare.com;
connect-src 'self' <NEXT_PUBLIC_API_URL origin>;
```

Không cần `unsafe-inline` cho Turnstile (script tải từ URL, render bằng API).

## 7. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Widget báo lỗi 110200 / "domain not allowed" | Hostname hiện tại chưa được thêm vào widget trong Cloudflare |
| Mọi request → `TURNSTILE_INVALID` | Sai action, hostname không khớp `TURNSTILE_EXPECTED_HOSTNAMES`, hoặc dùng test key khi BE kiểm tra action |
| Mọi request → `TURNSTILE_UNAVAILABLE` | Secret BE sai hoặc thuộc widget khác; BE không gọi được Cloudflare |
| Nhiều `TURNSTILE_EXPIRED` | Token > 300 s hoặc bị dùng lại (FE đã reset sau mỗi lần gửi) |
| Luôn `TURNSTILE_REQUIRED` | Widget chưa tạo token; kiểm tra site key, adblock, CSP |
| Nút gửi luôn bị khóa | Chưa có token, đang cooldown 429/503, hoặc thiếu site key |

## 8. Kiểm thử

Chạy (theo quy ước repo: biên dịch bằng `tsc` rồi `node --test`):

```bash
test_output="$(mktemp -d)"
./node_modules/.bin/tsc src/features/auth/turnstile/turnstile.test.ts src/features/auth/services/authApi.test.ts \
  --outDir "$test_output" --module commonjs --target es2020 --moduleResolution node --esModuleInterop --resolveJsonModule --skipLibCheck --lib es2022,dom --types node
node --test $(find "$test_output" -name "*.test.js")
```

- `turnstile.test.ts` (13 test): nạp script, site key/action, callback token/expired/error/timeout, reset, destroy, Strict Mode, chuyển trang, reducer, khóa gửi, chặn gửi trùng, token dùng một lần, cooldown.
- `authApi.test.ts` (16 test): DTO 4 endpoint, URL không lặp `/api`, token chỉ ở body, action của từng form, 5 mã lỗi, mảng message, lỗi mạng, `Retry-After`, không gọi `/auth/refresh`, không retry, reset sau lỗi, không lưu/log token.

Kết quả (2026-11-16): 29/29 test mới đạt; toàn bộ 162/162 test FE đạt; `tsc --noEmit`, `eslint`, `next build` đạt.

Giới hạn: không có thư viện DOM-testing trong repo, nên component React được kiểm thử qua các module logic thuần (controller, reducer, submitter) và kiểm tra liên kết action trong mã nguồn form; chưa có test render DOM thật.

## 9. Giới hạn xác minh fullstack

- Chưa chạy kiểm thử trình duyệt với BE local, chưa có Siteverify thật, chưa có staging.
- Body request đã được đối chiếu thủ công với `LoginDto`, `RegisterDto`, `ForgotPasswordDto`, `ResetPasswordDto` của BE.
- Trang quên mật khẩu / đặt lại mật khẩu (`/reset-password#token=…`, liên kết BE gửi qua email) chưa tồn tại ở FE; nút "Quên mật khẩu?" trên trang đăng nhập chưa có hành động.
