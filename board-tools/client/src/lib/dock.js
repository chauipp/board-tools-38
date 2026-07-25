import { computeSnap } from "./snap.js";

const KEY = "idea-map-panel-layout";
const MARGIN = 8;
const SNAP = 24;

export const DEFAULT_LAYOUTS = {
  status: { free: false, vertical: false, x: 0, y: 0 },
  tag: { free: false, vertical: false, x: 0, y: 0 },
  palette: { free: false, vertical: false, x: 0, y: 0 }
};

// Kẹp trong khung nhìn. Bắt buộc, không phải tính năng phụ: panel thả ra ngoài
// mép là panel không lấy lại được.
function clamp1D(pos, size, viewport) {
  return Math.min(Math.max(pos, MARGIN), Math.max(MARGIN, viewport - size - MARGIN));
}

// Kẹp rồi hút vào mép nếu đã đủ gần.
export function snapToEdges(x, y, w, h, vw, vh) {
  const maxX = Math.max(MARGIN, vw - w - MARGIN);
  const maxY = Math.max(MARGIN, vh - h - MARGIN);
  let nx = clamp1D(x, w, vw);
  let ny = clamp1D(y, h, vh);
  if (nx - MARGIN < SNAP) nx = MARGIN;
  else if (maxX - nx < SNAP) nx = maxX;
  if (ny - MARGIN < SNAP) ny = MARGIN;
  else if (maxY - ny < SNAP) ny = maxY;
  return { x: nx, y: ny };
}

// Hút mép khung nhìn TRƯỚC, căn theo panel khác SAU, nên căn hàng thắng mép: một
// panel thẳng hàng với panel khác ở cách mép 20px được kéo về hàng đó thay vì bị
// mép giật đi. Bước cuối chỉ KẸP, không hút mép lần nữa — hút lại là phá đúng cái
// hàng vừa căn xong. Tái dùng computeSnap của kéo thẻ: cùng bộ mốc trái/giữa/phải,
// và trả sẵn guide để vẽ.
export function snapPanel(x, y, w, h, vw, vh, others) {
  const edge = snapToEdges(x, y, w, h, vw, vh);
  const { dx, dy, guides } = computeSnap({ x: edge.x, y: edge.y, w, h }, others, SNAP);
  return {
    x: clamp1D(edge.x + dx, w, vw),
    y: clamp1D(edge.y + dy, h, vh),
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
