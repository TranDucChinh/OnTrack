# OnTrack chạy riêng trên Windows

Bản Windows mở bằng shortcut, không cần đăng nhập Google. Google Sheet vẫn có thể để riêng tư; phần chạy nền của OnTrack đọc/ghi qua Apps Script bằng URL `/exec` và token do bạn nhập trên máy. Bản Android được triển khai riêng sau.

## Cài đặt

Cần Node.js 22.13 trở lên, Microsoft Edge hoặc Chrome và mã nguồn đã tải về.

```powershell
cd F:\Project\OnTrack
npm ci
npm run windows:install
```

Trình cài build giao diện, tạo shortcut **OnTrack** trên Desktop và Start Menu, rồi mở ứng dụng. Mỗi lần dùng chỉ cần bấm shortcut; không cần mở terminal hoặc chạy `npm run dev`.

OnTrack chạy trong cửa sổ riêng bằng Edge/Chrome và một tiến trình Node phía sau. Đây là bản cài từ mã nguồn có sẵn trên máy, chưa phải bộ cài `.exe` đóng gói độc lập. Giữ nguyên thư mục dự án; nếu chuyển nó sang chỗ khác thì cần cài lại shortcut.

## Kết nối Sheet thật

1. Trong OnTrack, vào **Cài đặt → Kết nối Google Sheet**.
2. Dán URL Apps Script kết thúc bằng `/exec` và giá trị `ONTRACK_API_TOKEN`.
3. Bấm **Kiểm tra và lưu kết nối**. App kiểm tra được dữ liệu trước khi lưu cấu hình.
4. Khi thành công, danh sách chuyển từ dữ liệu mẫu sang dữ liệu Sheet thật. Dữ liệu thử trong trình duyệt không tự nhập vào Sheet.

Token nằm ở **Google Apps Script → Cài đặt dự án → Thuộc tính tập lệnh (Script Properties)**. Nếu chưa có, chạy `setupOnTrack` trong trình chỉnh sửa rồi mở lại cài đặt dự án.

Deployment Apps Script cần **Execute as: Me** và **Who has access: Anyone**, vì tiến trình Windows gọi endpoint mà không đăng nhập trình duyệt Google. Mã Apps Script vẫn yêu cầu token đúng trước khi xử lý. Không cần mở quyền chỉnh sửa Sheet cho mọi người. Xem thêm [hướng dẫn Apps Script](README-VI.md).

Nếu URL chuyển sang trang đăng nhập Google hoặc app báo không kết nối được, kiểm tra lại quyền của **deployment**, bấm Deploy và dùng đúng URL `/exec`. Đừng thay bằng URL `/dev` của trình chỉnh sửa.

## Thông báo và chạy nền

- OnTrack kiểm tra dữ liệu và deadline mỗi **5 phút**, khi Windows đang chạy và có mạng.
- Thông báo mang tên và biểu tượng **OnTrack**, dùng hệ thống thông báo Windows; bản này không cần OneSignal.
- Trong Cài đặt có nút **Gửi thông báo thử**, công tắc nhắc deadline và công tắc **Chạy nền khi đăng nhập Windows**.
- Đóng cửa sổ app không dừng phần chạy nền. Tắt máy, ngủ, mất mạng hoặc dừng tiến trình sẽ tạm ngừng kiểm tra. Không phải dịch vụ đám mây chạy khi máy đã tắt.
- Nhắc trước một ngày, một giờ và khi đến hạn. Một lượt chỉ gửi mốc gần nhất; không gửi dồn các mốc cũ. Task Done hoặc Pending không được nhắc. Các deadline đã quá hạn trước khi bật tính năng không bị gửi dồn.
- OnTrack kiểm tra quyền thông báo Windows trước khi gửi. Nếu Windows tắt thông báo toàn hệ thống hoặc tắt riêng OnTrack, Cài đặt sẽ hiện lý do; thông báo bị chặn không được đánh dấu là đã gửi.
- Bật **Windows Settings → System → Notifications → Notifications**, bật riêng **OnTrack** và **Show notification banners**. Tắt **Do not disturb** nếu muốn hiện banner ngay. Windows nhận thông báo không đồng nghĩa banner chắc chắn xuất hiện; khi bị ẩn, kiểm tra trung tâm thông báo. Nút thử dùng thời gian hiển thị dài hơn để dễ quan sát.
- Các lần đã gửi được lưu để hạn chế trùng sau khi khởi động lại. Lịch 5 phút không phải cam kết độ trễ tối đa 5 phút.

## Dữ liệu trên máy

Kết nối và lịch sử nhắc nằm trong `%LOCALAPPDATA%\OnTrack\settings.json`, ngoài repo. App chỉ trả trạng thái đã có token cho trình duyệt, không trả lại giá trị token. File này là dữ liệu riêng của tài khoản Windows; không đưa nó lên GitHub hoặc gửi trong chat.

Các tệp khác gồm launcher, nhật ký chạy, trạng thái Worker và profile trình duyệt riêng. Cổng app là `http://127.0.0.1:43127`; tiến trình giao diện dùng cổng loopback 43128. Không lắng nghe địa chỉ LAN. Server kiểm tra Host/Origin và chặn yêu cầu cross-site. Không chuyển tiếp cổng này ra Internet hoặc mở nó qua tunnel.

Google OAuth của bản web vẫn có trong mã nguồn cho triển khai online. Chỉ launcher Windows mới bật chế độ không đăng nhập cho đúng địa chỉ loopback; bật cờ đó trên một website public không cho phép bỏ qua xác thực.

## Gỡ bản Windows

```sh
npm run windows:uninstall
```

Lệnh dừng phần chạy nền và gỡ shortcut Desktop, Start Menu và Startup do OnTrack tạo. Dữ liệu cá nhân và mã nguồn vẫn giữ để cài lại. Không xóa Sheet.

Để phát triển mã nguồn tiếp, dùng `npm test`, `npm run typecheck` và `npm run build`. Sau khi cập nhật, đóng app, gỡ shortcut bằng lệnh trên rồi chạy lại `npm run windows:install`; cấu hình Sheet được giữ trong dữ liệu ứng dụng.
