> Đây là hướng dẫn cho bản mã nguồn công khai. Repo chỉ chứa dữ liệu mẫu và placeholder. Bản đang chạy riêng của tác giả không bị thay đổi. Không có thông tin kết nối thật trong repo.

# OnTrack — kích hoạt Google Sheet và Web Push

## Danh sách và thống kê hiện tại

Trong tab Công việc, chọn Danh sách hoặc Lịch tháng. Lịch xếp task theo ngày deadline, gồm mọi trạng thái và dùng chung bộ tìm kiếm/lọc. Bấm vào task để xem/sửa; chọn ngày để xem đầy đủ các task hoặc thêm việc vào ngày đó. Có nút tháng trước/tháng sau và trở về tháng hiện tại. Task chưa có deadline được giữ trong Danh sách. Lịch chỉ hiển thị các task đã tồn tại, không tự vẽ các lần định kỳ chưa được tạo.

Các ô tổng hợp đầu trang chỉ xuất hiện tại tab Công việc. Trong biểu đồ tuần, ngày hôm nay theo giờ Việt Nam có nền vàng và nhãn Hôm nay; màu trạng thái trong cột vẫn giữ nguyên.

Danh sách hiển thị toàn bộ task ở mọi tuần, theo nhóm Quá hạn → Đang làm → Pending → Đã hoàn thành. Bộ lọc Đã hoàn thành cũng hiển thị toàn bộ lịch sử. Thẻ Tổng công việc trong tuần chỉ tính các task có deadline trong tuần đang xem (thứ Hai–Chủ nhật), gồm mọi trạng thái; không tính task chưa đặt deadline.

Thống kê có biểu đồ cột chồng theo ngày, cơ cấu trạng thái, mức ưu tiên, so sánh với tuần trước, hạn trong 24 giờ, ưu tiên cao chưa xong, ngày nhiều deadline nhất và chất lượng hoàn thành (đúng hạn, trễ, thiếu ngày hoàn thành, trễ trung bình). So sánh tuần dùng deadline và trạng thái hiện tại, không phải ảnh chụp lịch sử. Chất lượng hoàn thành chỉ dùng các task đã ghi nhận thời điểm hoàn thành.

## Cập nhật bản 2: định kỳ, Pending và thống kê theo tuần

- Công việc định kỳ có ba kiểu: mỗi N giờ/ngày tính từ deadline lần trước; theo các thứ trong tuần; theo ngày trong tháng. Lần đầu dùng deadline đã chọn. Khi một lần đến hạn, tạo lần kế tiếp dù lần trước chưa hoàn thành. Ngày 29–31 không có trong một tháng được chuyển về ngày cuối tháng, rồi trở lại ngày đã chọn trong tháng sau.
- Mục Định kỳ quản lý các lịch gốc. Sửa/tắt lịch không thay đổi các lần đã tạo. Đổi deadline bắt đầu sẽ tính lại lịch từ deadline đó. Task con có thể sửa riêng hoặc mở lịch gốc.
- Pending tạm dừng một task, giữ deadline, ngừng nhắc, không tính vào việc cần làm/quá hạn/biểu đồ. Pending không dừng lịch định kỳ. Chọn Không lặp ở lịch gốc để dừng tạo task mới.
- Hoàn thành trong tuần = deadline từ thứ Hai đến Chủ nhật và đang Done, không dựa vào ngày bấm hoàn thành. Biểu đồ có tuần trước/tuần sau và Mon–Sun. Giờ mặc định 23:59, ưu tiên mặc định Vừa.
- Bản thử lưu theo trình duyệt: sinh các kỳ mới khi mở/làm mới app (có làm mới mỗi 5 phút khi app hoạt động). Chạy nền khi đóng app cần kết nối Sheet và cài `installTaskScheduler` hoặc `installReminders`.
- Sau thời gian ngừng chạy dài, bổ sung tối đa 100 lần mỗi lượt để giới hạn thời gian thực thi, rồi tiếp tục ở lượt sau.

Nếu đã cài bản trước: thay toàn bộ mã OnTrack cũ bằng `Code.gs` mới (file này đã chứa phần logic dùng chung), chạy lại `setupOnTrack` để thêm cột M:Q, rồi cập nhật deployment Apps Script sang phiên bản mới. Giữ token và URL `/exec` cũ. Có thể chạy `installTaskScheduler` để bật định kỳ trước khi thiết lập OneSignal; nếu đã dùng Web Push, chạy `installReminders`. Không dán trùng cả mã OnTrack cũ và mới trong một dự án.

OnTrack dùng trên Android và Windows qua cùng một địa chỉ HTTPS. Không cần thuê server. Bản mã nguồn công khai dùng dữ liệu mẫu: các thao tác lưu trên trình duyệt, chưa ghi về Google Sheet và chưa gửi thông báo. Dữ liệu thử của hai thiết bị không tự đồng bộ hoặc nhập lại vào Sheet.

## 1. Chuẩn bị Sheet và Apps Script

1. Chuẩn bị Google Sheet của bạn. Thay `YOUR_SPREADSHEET_ID` trong `setup/Code.gs` và đường dẫn mở Sheet trong `app/ontrack.tsx` bằng ID file của bạn. Sheet cần tab `Deadline` với A:D là `Id`, `Name`, `Date`, `Done`.
2. Nên tạo một bản sao dự phòng trước lần thiết lập đầu.
3. Chọn Extensions (Tiện ích mở rộng) → Apps Script. Dán nội dung `Code.gs` từ gói này vào dự án. Nếu dự án đã có mã khác, thêm file riêng và kiểm tra không trùng các tên hàm của OnTrack.
4. Trong Project Settings, đặt múi giờ thành Asia/Ho_Chi_Minh. Sheet cũng nên đặt múi giờ GMT+07:00 trong File → Settings.
5. Chạy hàm `setupOnTrack`, tự xem và cấp quyền cần thiết cho tài khoản sở hữu Sheet. Hàm giữ nguyên A:D, thêm E:Q: task_id, created_at, completed_at, updated_at, priority, notes, deadline_has_time, reminder_state, pending, recurrence, recurrence_cursor, series_id, occurrence_key. Nếu các cột này đã có tiêu đề khác, hàm dừng để bảo toàn dữ liệu.
6. Trong Project Settings → Script Properties, tìm `ONTRACK_API_TOKEN` do hàm tạo. Giữ riêng mã này, không đăng công khai và không gửi trong chat.
7. Chọn Deploy → New deployment → Web app: Execute as **Me**, Who has access **Anyone**. Việc này công khai địa chỉ tiếp nhận yêu cầu, KHÔNG công khai Sheet: mã chỉ xử lý thao tác khi token khớp. Nếu tổ chức chặn kiểu triển khai này, cần thay đổi phương án xác thực, không bỏ bước kiểm tra token.
8. Sao chép URL kết thúc bằng `/exec`. Khi sửa mã Apps Script sau này, cập nhật deployment sang phiên bản mới; URL giữ nguyên.

## 2. Tạo ứng dụng Web Push trong OneSignal

1. Đăng ký hoặc đăng nhập tại https://onesignal.com bằng tài khoản của bạn. Có thể bắt đầu với gói Free trong hạn mức hiện hành.
2. Tạo app tên **OnTrack**, thêm nền tảng Web Push, chọn **Custom Code**.
3. Site Name: OnTrack. Site URL: địa chỉ thực tế của Site được xuất bản, ví dụ `https://your-ontrack.example.com`.
4. Tải biểu tượng OnTrack từ file `icon-192.png` trong gói này lên phần Default Icon của OneSignal (hoặc dùng URL ảnh đã tải lên OneSignal). Không dùng URL ảnh từ Site riêng tư làm nguồn cho dịch vụ bên ngoài. Tắt tự bật prompt hoặc thông báo chào mừng nếu đã bật trong dashboard; app tự hiển thị nút đăng ký.
5. Trong Keys & IDs, lấy **App ID** và **App API Key / REST API Key** của chính app đó. Không dùng Organization API Key. App ID không phải bí mật; API Key là bí mật.
6. App đã có `OneSignalSDKWorker.js` và manifest. Không cần dán thêm SDK thứ hai.

## 3. Điền cấu hình bảo mật

Trong **Apps Script → Project Settings → Script Properties**, thêm:

| Property | Giá trị |
|---|---|
| `ONESIGNAL_APP_ID` | App ID ở OneSignal |
| `ONESIGNAL_API_KEY` | App API Key; chỉ đặt tại đây |
| `ONTRACK_APP_URL` | Địa chỉ HTTPS gốc của Site, không có đường dẫn con |

Trong **biến môi trường phía server của Site**, đặt (qua công cụ quản lý Sites; không sửa mã client hoặc hosting.json):

| Biến | Giá trị |
|---|---|
| `ONTRACK_SCRIPT_URL` | URL Apps Script `/exec` |
| `ONTRACK_API_TOKEN` | Token khớp với Script Properties |
| `ONESIGNAL_APP_ID` | Cùng App ID nói trên |

Các giá trị này cần được cấu hình trong tài khoản của bạn. Nếu chưa có giao diện để nhập biến môi trường, tiếp tục bước này cùng trợ lý qua công cụ Sites; không gửi API Key vào cuộc trò chuyện. Sau khi đổi biến môi trường, triển khai lại phiên bản Site nếu công cụ quản lý yêu cầu. Giữ Site ở chế độ riêng tư.

## 4. Bật lịch 5 phút và đăng ký thiết bị

1. Chạy hàm `installReminders` trong Apps Script. Hàm cài trigger `checkDeadlines` mỗi 5 phút, không tạo trùng trigger của OnTrack.
2. Mở OnTrack → Cài đặt. Kiểm tra trạng thái **Google Sheet: Đã kết nối** và lịch kiểm tra đã cài.
3. Trên Android, mở URL bằng Chrome ở chế độ thường, đăng nhập cùng tài khoản có quyền xem Site → Cài đặt → Bật trên thiết bị này → Cho phép thông báo. Có thể thêm app vào màn hình chính.
4. Làm tương tự trên Windows bằng Chrome hoặc Edge. Cài app từ menu trình duyệt nếu có tùy chọn; dùng bằng tab trình duyệt vẫn được.
5. Trên từng thiết bị, nhấn **Gửi thông báo thử** và kiểm tra thông báo thật. Phản hồi API chỉ cho biết dịch vụ chấp nhận gửi, chưa chứng minh thiết bị đã hiển thị.
6. Kiểm tra quyền thông báo của Chrome/Edge trong Android/Windows. Chế độ Không làm phiền, chặn trình duyệt, tắt hẳn tiến trình, tiết kiệm pin và mạng có thể trì hoãn hoặc ngăn thông báo.

## 5. Kiểm tra toàn bộ luồng trước khi sử dụng

- Tạo task thử trong app, kiểm tra task xuất hiện trong Sheet và trên thiết bị còn lại.
- Sửa tên/giờ hạn trong Sheet, đồng bộ lại app để kiểm tra chiều ngược lại.
- Tạo task có giờ hạn trong 10–15 phút tới, nhận nhắc, đánh dấu hoàn thành, kiểm tra không có nhắc mới khi đến hạn.
- Để task khác đi qua ít nhất hai chu kỳ kiểm tra và xác nhận một mốc không gửi lặp. Xem Apps Script → Executions khi có lỗi.
- Sửa cùng một task ở hai nơi: app phải báo xung đột khi lưu bản cũ, không ghi đè dữ liệu mới.
- Sau khi tất cả đạt, mới xem nhắc tự động là đã hoạt động.

## Quy tắc dữ liệu và nhắc việc

- Múi giờ Việt Nam. Deadline chỉ có ngày được hiểu là 23:59. Có giờ thì dùng đúng giờ đã chọn.
- Ba mốc: trước 24 giờ, trước 1 giờ, và khi đến hạn. Mỗi lượt kiểm tra chỉ chọn mốc mới nhất đã tới; không gửi bù cả ba mốc cùng lúc.
- Task đã quá hạn trước lần kích hoạt lịch đầu tiên không bị gửi dồn. Bản này chưa nhắc quá hạn lặp lại mỗi ngày, chưa có nhắc lại sau hoặc giờ yên lặng.
- Dùng lock để tránh lượt chạy chồng nhau; lưu khóa idempotency trước khi gọi OneSignal để hạn chế gửi trùng khi thử lại. Khi chưa có thiết bị hoặc dịch vụ không chấp nhận gửi, không ghi là đã gửi thành công.
- Lịch 5 phút không phải cam kết độ trễ tối đa 5 phút. Apps Script, hạn mức, mạng và hệ điều hành đều có thể gây chậm. OneSignal và Apps Script áp dụng hạn mức riêng.
- Việc nhập từ Excel có trạng thái Done nhưng không có thời điểm hoàn thành, nên không suy đoán thống kê đúng hạn của các việc cũ.
- `Id` là STT theo công thức; `task_id` mới là mã cố định. Khi tự thêm dòng trong Sheet, chạy lại `setupOnTrack` để cấp mã cho task mới. Không sửa cột `task_id` hoặc `reminder_state` bằng tay.
- Google Sheet vẫn là nguồn dữ liệu chính sau khi kết nối. Mất mạng sẽ báo lỗi; bản này chưa có hàng đợi ghi offline cho chế độ kết nối thật.
- Site đang riêng tư. Thông báo có nội dung tên task được xử lý qua OneSignal; có thể hiện trên màn hình khóa theo cài đặt thiết bị.

## Mã nguồn và kiểm thử

Mã giao diện React/Vinext, endpoint phía server tại `lib/ontrack-api.ts`, worker tại `worker/index.ts`, xử lý Sheet và scheduler tại `setup/Code.gs`.

Kiểm thử tự động: `node --test tests/core.test.mjs tests/recurrence.test.mjs tests/apps-script.test.mjs`; kiểm tra TypeScript: `node node_modules/typescript/bin/tsc --noEmit`. Khi sửa `lib/task-core.mjs`, chạy `node scripts/sync-apps-script.mjs` để đồng bộ logic vào file Code.gs trước khi phân phối. Build bằng helper Sites đã dùng để triển khai. Kiểm thử tự động chưa thay thế kiểm tra thật với tài khoản Google, OneSignal và hai thiết bị của bạn.

Tài liệu chính thức:
- https://developers.google.com/apps-script/reference/script/clock-trigger-builder
- https://developers.google.com/apps-script/guides/services/quotas
- https://documentation.onesignal.com/docs/web-sdk-setup
- https://documentation.onesignal.com/docs/web-sdk-reference
- https://documentation.onesignal.com/reference/push-notification

## Giao diện và ngôn ngữ

Vào **Cài đặt → Giao diện & ngôn ngữ** để bật/tắt chế độ tối và chọn **VI / EN**. Tùy chọn được lưu riêng trên từng trình duyệt, có hiệu lực ngay và được giữ sau khi tải lại trang. Chuyển ngôn ngữ chỉ đổi giao diện; tên task, ghi chú và deadline được giữ nguyên.

## Thông báo hoạt động

Nút chuông ở góc trên bên phải mở **Hoạt động gần đây**, hiển thị tối đa 20 thay đổi mới nhất: thêm/sửa công việc, hoàn thành, mở lại, Pending/tiếp tục và tạo lần định kỳ tự động. Mỗi mục có tên task, thời gian theo giờ Việt Nam và nguồn thay đổi. Các lần sửa từ app có phần **Xem thay đổi** với giá trị trước/sau. Không ghi các lần xem trang, đồng bộ, lưu không thay đổi dữ liệu, đổi giao diện hoặc thao tác bị từ chối.

- Bản thử lưu task và lịch sử cùng nhau trong trình duyệt, giữ dữ liệu từ bản thử trước. Lịch sử bắt đầu từ khi bật tính năng, không dựng lại các thao tác cũ. Không ghi vào Google Sheet.
- Khi kết nối thật, lịch sử dùng chung được lưu trong tab ẩn **OnTrack_Activity** của chính file Sheet, giữ tối đa 20 mục. App tải lịch sử khi mở chuông, nhấn Làm mới hoặc đồng bộ định kỳ.
- Cập nhật toàn bộ `Code.gs`, chạy lại `setupOnTrack`, rồi cập nhật deployment Apps Script để dùng tính năng với Sheet thật. Hàm setup tạo tab lịch sử và một installable edit trigger `onTrackSheetEdit`. Chạy lại setup không tạo trùng trigger.
- Chỉnh sửa ô trực tiếp ở tab Deadline cũng ghi tên task, trường đã đổi và vùng ô. Nhật ký trực tiếp không có giá trị trước/sau cho thao tác dán nhiều ô. Xóa/chèn hàng, thay đổi qua API khác, hoặc công thức tự tính lại không kích hoạt edit trigger; lịch sử này không thay thế Version history của Google Sheets.
- Thông báo Web Push nhắc deadline vẫn được quản lý trong Cài đặt. Bảng lịch sử không gửi thêm thông báo đẩy cho từng thao tác.
