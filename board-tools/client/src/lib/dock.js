const KEY = "idea-map-panel-layout";
const MARGIN = 8;
const SNAP = 24;

export const DEFAULT_LAYOUTS = {
  status: { free: false, vertical: false, x: 0, y: 0 },
  tag: { free: false, vertical: false, x: 0, y: 0 },
  palette: { free: false, vertical: false, x: 0, y: 0 }
};

// Kẹp panel trong khung nhìn rồi hút vào mép nếu đã đủ gần. Kẹp là bắt buộc:
// panel thả ra ngoài mép là panel không lấy lại được.
export function snapToEdges(x, y, w, h, vw, vh) {
  const maxX = Math.max(MARGIN, vw - w - MARGIN);
  const maxY = Math.max(MARGIN, vh - h - MARGIN);
  let nx = Math.min(Math.max(x, MARGIN), maxX);
  let ny = Math.min(Math.max(y, MARGIN), maxY);
  if (nx - MARGIN < SNAP) nx = MARGIN;
  else if (maxX - nx < SNAP) nx = maxX;
  if (ny - MARGIN < SNAP) ny = MARGIN;
  else if (maxY - ny < SNAP) ny = maxY;
  return { x: nx, y: ny };
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
