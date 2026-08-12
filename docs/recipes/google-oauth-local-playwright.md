# Playwright không đăng nhập Google local

## Khi nào gặp lại

Playwright mở app local nhưng Google GSI báo `The given origin is not allowed for the given client ID` và không đi qua màn đăng nhập.

## Cách làm đúng

Trong Google Cloud OAuth client, thêm đúng origin đang mở browser, ví dụ `http://localhost:7155`, rồi chờ cấu hình có hiệu lực. Khởi động Vite với `VITE_GOOGLE_CLIENT_ID` đúng client ID và xác nhận request GSI gửi đúng ID đó.

## Cái bẫy

Cổng Vite, origin và client ID có thể đều trông đúng trong code nhưng GSI vẫn từ chối do cấu hình Console chưa propagate hoặc browser đang mở server khác. Unit test/build không thay được editor flow trong trường hợp này.

## Kiểm thế nào là đúng

Mở `http://localhost:<port>` bằng Playwright, kiểm Console không còn `GSI_LOGGER`, đăng nhập xong rồi mới test editor; không coi màn login là UI editor đã pass.
