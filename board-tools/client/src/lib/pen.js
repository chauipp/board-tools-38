// Màu bút là HỆ MÀU RIÊNG, không dùng board.palette hay BADGE_PALETTE: đổi màu
// một cái thẻ không được kéo theo màu của nét vẽ tay. Tên token là "pen-" chứ
// không phải "ink-" để không lẫn với --ink / --ink-dim đang là màu chữ.
import { SHAPE_KINDS } from "./shape.js";

const KEY = "ideamap.pen";

export const PEN_COLORS = [
  "pen-red", "pen-orange", "pen-yellow",
  "pen-green", "pen-blue", "pen-purple", "pen-mono"
];

// Đơn vị toạ độ canvas, không phải pixel màn hình: zoom vào là nét dày ra như
// mực trên giấy.
export const PEN_WIDTHS = [2, 4, 8];

// Toàn bộ state của khu 4 nằm trong MỘT object dưới MỘT khoá: màu và độ dày
// dùng chung cho bút và hình khối, `kind` là hình đang chọn, `fill` là chế độ
// viền / cả hình. Chiều import pen.js → shape.js → stroke.js, không có vòng.
export const PEN_DEFAULT = { color: "pen-red", w: 4, kind: "rect", fill: false };

export function penVar(token) {
  return `var(--${token})`;
}

export function loadPenPrefs(storage) {
  let saved = null;
  try {
    saved = JSON.parse(storage.getItem(KEY));
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== "object") return { ...PEN_DEFAULT };
  // Lọc theo từng key: một giá trị hỏng không được làm mất luôn giá trị còn lại.
  return {
    color: PEN_COLORS.includes(saved.color) ? saved.color : PEN_DEFAULT.color,
    w: PEN_WIDTHS.includes(saved.w) ? saved.w : PEN_DEFAULT.w,
    kind: SHAPE_KINDS.includes(saved.kind) ? saved.kind : PEN_DEFAULT.kind,
    fill: saved.fill === true
  };
}

export function savePenPrefs(storage, prefs) {
  try {
    storage.setItem(KEY, JSON.stringify({
      color: prefs.color, w: prefs.w, kind: prefs.kind, fill: prefs.fill === true
    }));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất lựa chọn bút, không đáng làm sập app.
  }
}
