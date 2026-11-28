// Phần dùng chung của mọi kịch bản smoke: dựng IdeaMap THẬT (API và socket
// giả do smoke-run.mjs cài sẵn trên globalThis) và các helper bắn sự kiện.
// Mỗi kịch bản chạy trong một process + JSDOM riêng (xem smoke-run.mjs), nên
// ở đây không giữ trạng thái gì giữa các kịch bản.
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../lib/i18n.js";
import IdeaMap from "../pages/IdeaMap.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";

export async function mountBoard() {
  const root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/idea-map/b1"]}>
            <Routes><Route path="/idea-map/:boardId" element={<IdeaMap />} /></Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    );
  });
  return root;
}

export const mouse = (type, x, y, target) => {
  (target || window).dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
};

// Kéo một <input type="range">. Phải đi qua setter GỐC của prototype: React
// thay setter `value` của phần tử bằng bản của nó để theo dõi giá trị, nên gán
// el.value = … rồi bắn "input" sẽ bị React coi là "không có gì đổi" và bỏ qua
// hẳn onChange. Đây là cái bẫy tiêu chuẩn khi test input có kiểm soát.
export const setRangeValue = (el, v) => {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  desc.set.call(el, String(v));
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
