# Đăng nhập Google cho OnTrack

Bản này xác thực bằng Google và chỉ cho **một email được chỉ định** vào dữ liệu OnTrack. Cấu hình email nằm trong secret của hosting, không nằm trong repo public. Quyền mở Sheet vẫn do Apps Script của bạn thực hiện; đăng nhập Google chỉ yêu cầu `openid email profile`, không xin quyền đọc toàn bộ Google Drive.

Mã đã có luồng OAuth, kiểm tra ID token và phiên đăng nhập. Để dùng thật, cần OAuth Client của bạn, email được phép và một địa chỉ HTTPS triển khai. Các kiểm thử dùng khóa thử riêng; chúng không thay thế lần đăng nhập thật bằng tài khoản của bạn.

## 1. Chọn địa chỉ chạy ứng dụng

Có thể triển khai Worker của repo lên Cloudflare Workers trong tài khoản của bạn, với một địa chỉ HTTPS ổn định. Không cần thuê VPS. Bạn vẫn cần kiểm tra hạn mức dịch vụ phù hợp với việc sử dụng của mình.

URL ví dụ: `https://ontrack.your-subdomain.workers.dev`. Có thể dùng tên miền riêng.

Địa chỉ Sites/ChatGPT cũ có lớp đăng nhập riêng của hosting. Đưa mã đăng nhập Google lên đó không tự bỏ lớp đăng nhập ChatGPT. Bản Google độc lập cần địa chỉ triển khai riêng; giữ website cũ để đối chiếu cho đến khi bản mới được kiểm tra đầy đủ.

## 2. Tạo Google OAuth Client

1. Vào https://console.cloud.google.com/, chọn hoặc tạo project cho OnTrack.
2. Mở Google Auth Platform, cấu hình Branding với tên **OnTrack** và email hỗ trợ của bạn.
3. Ở Audience, chọn loại phù hợp với tài khoản Google. Khi ứng dụng ở chế độ Testing, thêm tài khoản của bạn vào Test users nếu giao diện yêu cầu.
4. Chỉ dùng các scope đăng nhập `openid`, `email`, `profile`.
5. Trong Clients, tạo **OAuth client → Web application**. Đây là ứng dụng web/PWA, dù bạn cài nó trên Windows.
6. Thêm Authorized redirect URI chính xác:

```text
https://YOUR_ONTRACK_HOST/auth/google/callback
```

Để thử local, thêm riêng:

```text
http://127.0.0.1:5173/auth/google/callback
```

Đường dẫn, giao thức, hostname và port phải khớp. Nếu dùng `localhost`, cần đăng ký URI `localhost` tương ứng; không trộn `localhost` với `127.0.0.1`.

7. Lưu **Client ID** và **Client Secret** vào cấu hình bảo mật của hosting. Không gửi Client Secret trong chat hoặc commit file JSON tải từ Google.

## 3. Điền cấu hình của Worker

| Biến | Giá trị |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID loại Web application |
| `GOOGLE_CLIENT_SECRET` | Client Secret tương ứng |
| `ONTRACK_GOOGLE_EMAIL` | Chính xác một email Google được vào app |
| `ONTRACK_SESSION_SECRET` | Chuỗi 64 ký tự hex ngẫu nhiên |
| `ONTRACK_ORIGIN` | Địa chỉ gốc, ví dụ `https://YOUR_ONTRACK_HOST`, không có đường dẫn |
| `ONTRACK_SCRIPT_URL` | URL `/exec` của Apps Script |
| `ONTRACK_API_TOKEN` | Token trong Script Properties |
| `ONESIGNAL_APP_ID` | App ID OneSignal, khi bật nhắc deadline |

Tạo session secret trên máy của bạn bằng lệnh sau rồi lưu vào secret của hosting:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Chỉ dùng các giá trị thật trong cấu hình được bảo vệ. Templates trong repo để trống. Đổi session secret sẽ làm hết hiệu lực các phiên đăng nhập cũ.

## 4. Chạy local và kiểm tra

Trong PowerShell tại thư mục repo:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Tự điền `.dev.vars` trên máy, rồi chạy:

```sh
npm ci
npm run dev
```

Với thử OAuth local, đặt `ONTRACK_ORIGIN=http://127.0.0.1:5173` và dùng đúng redirect URI đã đăng ký. Khởi động lại server sau khi đổi các biến này.

Nếu toàn bộ biến để trống, chỉ bản phát triển trên loopback được dùng dữ liệu mẫu không đăng nhập. Chỉ cần cấu hình Sheet thật hoặc một phần OAuth, chế độ bỏ qua đăng nhập sẽ bị tắt. Bản production luôn yêu cầu cấu hình Google hợp lệ trước khi vào API dữ liệu.

## 5. Triển khai Cloudflare Workers

Đăng nhập Cloudflare bằng tài khoản của bạn qua Wrangler, build rồi triển khai:

```sh
npx wrangler login
npm run deploy
```

Luồng này dùng `dist/server/wrangler.json` do Cloudflare Vite plugin sinh ra. Không upload thư mục mã nguồn như website tĩnh vì app có API phía server.

Lần triển khai đầu chưa có đủ secret chỉ hiển thị màn hình chờ thiết lập và từ chối API dữ liệu. Sau khi biết hostname thật, đặt OAuth redirect URI, các biến và secret trong cấu hình Worker của Cloudflare, rồi triển khai lại nếu dashboard yêu cầu. Có thể dùng `wrangler secret put TEN_BIEN --config dist/server/wrangler.json` để nhập từng secret trực tiếp trong terminal; không đưa giá trị secret vào tham số lệnh hoặc commit.

Khi đổi domain, cập nhật đồng thời `ONTRACK_ORIGIN`, Google OAuth redirect URI, `ONTRACK_APP_URL` trong Apps Script và Site URL của OneSignal. Đăng ký lại thông báo trên domain mới. Email được phép nên đặt dưới dạng secret để không hiện trong mã nguồn hoặc cấu hình public.

## 6. Kiểm tra trước khi dùng Sheet thật

- Chưa đăng nhập: API `/api/ontrack` trả 401 khi OAuth đã cấu hình; không trả task.
- Đăng nhập bằng tài khoản được phép: vào danh sách task và thêm một task thử vào Sheet.
- Tài khoản Google khác: không được cấp phiên truy cập, kể cả khi Google đăng nhập thành công.
- Sửa task trên Windows rồi đồng bộ trên Android: hai thiết bị thấy cùng dữ liệu Sheet.
- Bấm avatar → Đăng xuất: phiên trong trình duyệt hiện tại được xóa, dữ liệu app không còn hiện.
- Đăng xuất OnTrack không đăng xuất khỏi tài khoản Google và không tự thu hồi quyền thông báo của trình duyệt. Quản lý thông báo riêng trong Cài đặt.
- Kiểm tra Web Push trên địa chỉ HTTPS mới, sau đó mới cài app từ Edge/Chrome.

## Phiên đăng nhập

Server kiểm tra chữ ký Google, issuer, audience, hạn token, nonce và email đã xác minh. Luồng đăng nhập sử dụng state và PKCE. Phiên OnTrack kéo dài 12 giờ, dùng cookie HttpOnly, SameSite=Lax và Secure trên HTTPS. Email được phép được kiểm tra lại mỗi lần gọi API. Token Google không được lưu trong localStorage hoặc gửi về client dưới dạng API response.

Đổi email cho phép hoặc session secret sẽ chặn các phiên cũ. Đăng xuất xóa cookie của trình duyệt hiện tại; các thiết bị khác vẫn có phiên riêng cho đến khi hết hạn hoặc cấu hình bị thay đổi.

Tài liệu chính thức:

- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.cloudflare.com/workers/local-development/environment-variables/
- https://developers.cloudflare.com/workers/configuration/secrets/
