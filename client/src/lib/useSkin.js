import { useCallback, useEffect, useState } from "react";

// Nạp một lần cho cả phiên. `import()` tự nhớ module đã nạp, nhưng cờ này chặn
// luôn cả việc tạo promise thừa ở mỗi lần bấm.
let fontsLoaded = false;
function loadSketchFonts() {
  if (fontsLoaded) return Promise.resolve();
  fontsLoaded = true;
  // Tải hỏng (mạng chập) thì vẫn để skin bật: viền méo và nét rung không phụ
  // thuộc font, chỉ mất kiểu chữ.
  return import("../styles/sketch-fonts.js").catch(() => {});
}

// Skin là trục thứ HAI, độc lập với sáng/tối: hai trục nhân nhau ra bốn tổ hợp
// (sạch/sáng, sạch/tối, vẽ tay/sáng, vẽ tay/tối) và cả bốn đều phải đúng.
//
// Nó là thiết lập của TỪNG NGƯỜI (localStorage), không phải dữ liệu board như
// nền và bộ màu. Lý do: nó không đổi nội dung bảng, chỉ đổi cách người ngồi
// trước màn hình nhìn thấy nó — nên không cần sửa schema, không cần đồng bộ, và
// hai người xem cùng một board theo hai kiểu khác nhau vẫn đúng.
export function useSkin() {
  const [skin, setSkin] = useState(
    () => (document.documentElement.getAttribute("data-skin") === "sketch" ? "sketch" : "clean")
  );

  // Vào trang trong lúc skin đang bật (index.html đã đọc localStorage và đặt
  // data-skin từ trước khi React chạy) thì không có cú bấm nào để kích hoạt
  // nhánh nạp font bên dưới — phải nạp ở đây, không thì tải lại trang là mất
  // kiểu chữ cho tới lần bấm nút tiếp theo.
  useEffect(() => {
    if (skin === "sketch") loadSketchFonts();
  }, [skin]);

  const toggle = useCallback(async () => {
    const next = skin === "sketch" ? "clean" : "sketch";
    // Nạp font TRƯỚC khi đặt thuộc tính: đặt trước thì chữ hiện bằng font dự
    // phòng một nhịp rồi mới nhảy sang font viết tay — thấy rõ cú giật.
    if (next === "sketch") await loadSketchFonts();
    document.documentElement.setAttribute("data-skin", next);
    try { localStorage.setItem("skin-pref", next); } catch (e) {}
    setSkin(next);
  }, [skin]);

  return { skin, toggle };
}
