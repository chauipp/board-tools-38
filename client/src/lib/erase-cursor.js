import { ERASE_PART } from "./erase.js";

// Con trỏ của CỤC TẨY THEO ĐỘ RỘNG: một vòng tròn đúng bằng cục tẩy thật, vẽ
// thẳng vào con trỏ bằng data-URI. Không có nó thì bề rộng là một con số vô
// hình — người dùng chọn cỡ "to" rồi phải quét thử vài lần mới đoán ra nó với
// tới đâu, mà mỗi lần thử là một lần cắt nhầm phải hoàn tác.
//
// Chỉ ở kiểu "theo độ rộng". Kiểu "cả nét" giữ crosshair vì ở đó cục tẩy là
// một cái que chỉ, vẽ một vòng tròn to quanh nó là nói dối về tầm với.
export function eraseCursorFor({ mode, tool, penPrefs, scale }) {
  if (mode !== "draw" || tool !== "eraser" || penPrefs.erase !== ERASE_PART) return undefined;
  // Trình duyệt bỏ qua HẲN con trỏ tuỳ biến quá lớn (Chrome: 128px) — không
  // phải thu nhỏ mà là mất luôn cả con trỏ. Kẹp lại: ở mức phóng cao thì vòng
  // tròn nhỏ hơn cục tẩy thật, vẫn hơn là không có con trỏ nào.
  const d = Math.max(6, Math.min(120, Math.round(penPrefs.ew * scale)));
  const box = d + 4;
  const c = box / 2;
  const r = d / 2;
  // Hai vòng chồng nhau, trắng dày dưới đen mảnh trên: con trỏ phải đọc được
  // trên cả nền sáng lẫn nền tối, mà con trỏ thì không nghe được prefers-color.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}">`
    + `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="white" stroke-width="3" opacity="0.9"/>`
    + `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="black" stroke-width="1.2"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(c)} ${Math.round(c)}, crosshair`;
}
