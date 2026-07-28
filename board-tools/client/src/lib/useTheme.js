import { useCallback, useState } from "react";

export function useTheme() {
  // Giải sẵn ra "light"/"dark" ngay lúc mount thay vì giữ null khi người dùng
  // chưa chọn gì: panel Giao diện phải TÔ SÁNG được nút đang dùng, mà null thì
  // không tô cái nào cả. Cái giá là nếu người dùng đổi sáng/tối ở cấp hệ điều
  // hành trong lúc trang đang mở và chưa từng bấm nút nào ở đây thì trạng thái
  // này lệch — đổi lại được một thứ đọc ra ngay bằng mắt.
  const [theme, setThemeState] = useState(() => {
    const saved = document.documentElement.getAttribute("data-theme");
    if (saved === "light" || saved === "dark") return saved;
    // Có môi trường không có matchMedia (jsdom là một). Trước đây hàm này chỉ
    // được gọi lúc BẤM nút nên không ai gặp; gọi lúc mount thì thiếu nó là sập
    // cả trang vì một câu hỏi về màu nền. Lùi về "light" — đoán sai màu còn hơn
    // trắng màn hình.
    if (typeof window.matchMedia !== "function") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const setTheme = useCallback((next) => {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme-pref", next); } catch (e) {}
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
