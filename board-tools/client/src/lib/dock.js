import { computeSnap } from "./snap.js";

const KEY = "idea-map-panel-layout";
const MARGIN = 8;
const SNAP = 24;

export const DEFAULT_LAYOUTS = {
  status: { free: false, vertical: false, x: 0, y: 0 },
  tag: { free: false, vertical: false, x: 0, y: 0 },
  palette: { free: false, vertical: false, x: 0, y: 0 },
  theme: { free: false, vertical: false, x: 0, y: 0 }
};

// `bounds` là hình chữ nhật VÙNG VẼ, không phải cả cửa sổ. Kẹp theo vùng vẽ là cách
// duy nhất đảm bảo panel nổi không che một chút nào lên thanh trên / hàng nút / khay
// neo: panel chỉ còn hai chỗ hợp lệ — dính sát mép ngoài bar, hoặc vào thẳng trong
// khay. Chặn ở gốc, không phải đi dò từng ca chồng lấn.
function clampAxis(pos, size, start, extent) {
  const min = start + MARGIN;
  return Math.min(Math.max(pos, min), Math.max(min, start + extent - size - MARGIN));
}

// Chỉ kẹp, không hút mép. Dùng cho vị trí đọc từ localStorage: vị trí cũ có thể
// đang đè lên bar hoặc nằm ngoài cửa sổ đã thu nhỏ, nhưng không được tự dịch một
// vị trí vẫn hợp lệ mà người dùng đã đặt.
export function clampToBounds(x, y, w, h, bounds) {
  return {
    x: clampAxis(x, w, bounds.x, bounds.w),
    y: clampAxis(y, h, bounds.y, bounds.h)
  };
}

// Kẹp rồi hút vào mép vùng vẽ nếu đã đủ gần.
export function snapToEdges(x, y, w, h, bounds) {
  const maxX = Math.max(bounds.x + MARGIN, bounds.x + bounds.w - w - MARGIN);
  const maxY = Math.max(bounds.y + MARGIN, bounds.y + bounds.h - h - MARGIN);
  let nx = clampAxis(x, w, bounds.x, bounds.w);
  let ny = clampAxis(y, h, bounds.y, bounds.h);
  if (nx - (bounds.x + MARGIN) < SNAP) nx = bounds.x + MARGIN;
  else if (maxX - nx < SNAP) nx = maxX;
  if (ny - (bounds.y + MARGIN) < SNAP) ny = bounds.y + MARGIN;
  else if (maxY - ny < SNAP) ny = maxY;
  return { x: nx, y: ny };
}

// Hút mép vùng vẽ TRƯỚC, căn theo panel khác SAU, nên căn hàng thắng mép: một panel
// thẳng hàng với panel khác ở cách mép 20px được kéo về hàng đó thay vì bị mép giật
// đi. Bước cuối chỉ KẸP, không hút mép lần nữa — hút lại là phá đúng cái hàng vừa
// căn xong. Tái dùng computeSnap của kéo thẻ: cùng bộ mốc trái/giữa/phải, và trả sẵn
// guide để vẽ.
export function snapPanel(x, y, w, h, bounds, others) {
  const edge = snapToEdges(x, y, w, h, bounds);
  const { dx, dy, guides } = computeSnap({ x: edge.x, y: edge.y, w, h }, others, SNAP);
  return {
    x: clampAxis(edge.x + dx, w, bounds.x, bounds.w),
    y: clampAxis(edge.y + dy, h, bounds.y, bounds.h),
    guides
  };
}

export function loadLayouts(storage) {
  let saved = null;
  try {
    saved = JSON.parse(storage.getItem(KEY));
  } catch {
    saved = null;
  }
  // Trộn theo từng key: giá trị hỏng hoặc thiếu lùi về mặc định chứ không làm
  // trắng trang vì một lần ghi lỗi từ phiên trước.
  return Object.fromEntries(Object.keys(DEFAULT_LAYOUTS).map((k) => {
    const one = saved && typeof saved[k] === "object" && saved[k] !== null ? saved[k] : null;
    return [k, { ...DEFAULT_LAYOUTS[k], ...one }];
  }));
}

export function saveLayouts(storage, layouts) {
  try {
    storage.setItem(KEY, JSON.stringify(layouts));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất vị trí panel, không đáng làm sập app.
  }
}
