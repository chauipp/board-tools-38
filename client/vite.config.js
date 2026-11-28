import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";

export default defineConfig({
  plugins: [
    react({
      babel: { plugins: ["@lingui/babel-plugin-lingui-macro"] }
    }),
    lingui()
  ],
  server: {
    port: 7155,
    // Chỉ phục vụ file trong client/ và shared/ (hằng số dùng chung với server).
    // KHÔNG mở cả repo (".."): khi kho PDF chạy local, tệp nằm ở
    // server/uploads/pdf và ai vào được dev server sẽ đọc thẳng qua /@fs/, lách
    // route kiểm quyền board (review PR #9). Đường dẫn tương đối tính từ client/.
    fs: { allow: [".", "../shared"] },
    proxy: {
      "/api": "http://localhost:3345",
      "/socket.io": { target: "http://localhost:3345", ws: true }
    }
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://localhost:3345",
      "/socket.io": { target: "http://localhost:3345", ws: true }
    }
  }
});
