import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import path from "node:path";

export default defineConfig({
  plugins: [react({ babel: { plugins: ["@lingui/babel-plugin-lingui-macro"] } }), lingui()],
  // shared/ (hằng số dùng chung với server) nằm ngoài thư mục client.
  server: { fs: { allow: [".."] } },
  resolve: { alias: { "socket.io-client": path.resolve("src/__smoke__/socket-stub.js") } },
  build: {
    lib: { entry: "src/__smoke__/entry.jsx", formats: ["es"], fileName: "smoke" },
    outDir: "smoke-dist",
    emptyOutDir: true,
    minify: false
  }
});
