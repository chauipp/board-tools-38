import dotenv from "dotenv";
import {
  isPublicMode,
  allowlistStartupError,
  passwordAccountsStartupError
} from "./auth.js";

// Nạp .env đúng MỘT chỗ. Trước đây index.js, pdf-storage.js, pdf-quota.js và
// notify.js mỗi file tự gọi dotenv.config(), vì trong ESM các module được import
// chạy TRƯỚC thân index.js — module nào đọc biến môi trường lúc nạp mà không tự
// nạp .env thì chạy local sẽ không thấy cấu hình. Giờ các module đó import file
// này, nên .env luôn được nạp trước khi chúng đọc biến; trên Render các biến đã
// có sẵn sớm hơn.
//
// Import file này KHÔNG kiểm gì và không dừng tiến trình: script trong
// server/scripts/ cũng import nó mà không cần đủ bộ biến của web server. Chỉ
// index.js gọi assertStartupConfig().
dotenv.config();

// 3345 = cổng dev của dự án (proxy trong client/vite.config.js, README, AGENTS.md).
// Trên Render, PORT luôn do nền tảng đặt nên giá trị mặc định này không có tác dụng.
export const PORT = process.env.PORT || 3345;
export const MONGODB_URI = process.env.MONGODB_URI;

export function assertStartupConfig() {
  if (!MONGODB_URI) {
    console.error(
      "Thiếu MONGODB_URI. Copy server/.env.example thành server/.env rồi điền connection string từ MongoDB Atlas."
    );
    process.exit(1);
  }

  if (!process.env.VITE_GOOGLE_CLIENT_ID) {
    console.error(
      "Thiếu VITE_GOOGLE_CLIENT_ID. Copy server/.env.example thành server/.env rồi điền Google OAuth client ID."
    );
    process.exit(1);
  }

  if (!process.env.SESSION_SECRET) {
    console.error(
      "Thiếu SESSION_SECRET. Copy server/.env.example thành server/.env rồi điền một chuỗi ngẫu nhiên dài để ký session JWT."
    );
    process.exit(1);
  }

  // Dừng hẳn chứ không cảnh báo. Cảnh báo cũ nằm lẫn giữa hàng chục dòng log lúc
  // khởi động và đã bị bỏ qua suốt nhiều tháng — app chạy public mà không ai để ý.
  // Mở cửa là một quyết định, nên phải viết ra thành PUBLIC_MODE=true.
  const passwordAccountsError = passwordAccountsStartupError();
  if (passwordAccountsError) {
    console.error(passwordAccountsError);
    process.exit(1);
  }

  const allowlistError = allowlistStartupError();
  if (allowlistError) {
    console.error(allowlistError);
    process.exit(1);
  }
  if (isPublicMode()) {
    console.warn(
      "PUBLIC_MODE=true — ai có tài khoản Google cũng đăng nhập được, và cùng tiêu chung hạn mức kho PDF."
    );
  }
}
