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
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3001", ws: true }
    }
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": { target: "http://localhost:3001", ws: true }
    }
  }
});
