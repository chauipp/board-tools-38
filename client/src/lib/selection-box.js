// Hộp bao của CẢ VÙNG CHỌN, và phép co giãn cả cụm quanh một góc neo. Không
// dính React, không đụng DOM: nhờ vậy test được bằng node:test và IdeaMap chỉ
// còn phần nối chuột.
//
// Vì sao cần một hộp bao chung, trong khi mỗi loại đã có viền chọn riêng (thẻ
// sáng viền, khung sáng viền, nét vẽ có .ink-selected): ba thứ đó chỉ nói "cái
// này đang được chọn". Chúng KHÔNG nói được "cả vùng này là một cụm, cầm chỗ nào
// trong đó cũng kéo được" — mà đó mới là thứ người dùng cần biết để dám thả tay
// vào khoảng trống giữa hai cái thẻ.

import { drawingBox } from "./shape.js";
import { cardLevelW } from "./card-levels.js";

// Thẻ không co dưới bề rộng này. Cùng con số với MIN_W của tay cầm kéo ảnh
// (IdeaMap.handleImageResizeMouseDown) — dưới nữa thì thẻ hết chỗ để bấm vào.
export const MIN_CARD_W = 140;

// Khung không co dưới cỡ này. Cùng con số với MIN_GROUP_W/H trong IdeaMap.
export const MIN_GROUP_W = 160;
export const MIN_GROUP_H = 120;

// Cỡ chữ nhỏ nhất của một phần tử text sau khi co. Dưới 6 thì nó là một vệt mờ,
// không đọc được, và người dùng không có cách nào chọn lại để phóng lên.
const MIN_TEXT_SIZE = 6;

// Nét mảnh nhất sau khi co. 0 thì SVG không vẽ ra gì cả.
const MIN_STROKE_W = 0.5;

// Cả cụm không co nhỏ hơn / phóng to hơn khoảng này (đơn vị canvas). Chốt an
// toàn cho cú kéo vọt tay: co về 0 là mất luôn chỗ để cầm lại.
const MIN_SPAN = 24;
const MAX_SPAN = 20000;

// Số phần tử tối thiểu để hộp bao xuất hiện. MỘT phần tử thì bản thân nó đã cầm
// kéo được rồi, và một cái hộp nữa quanh nó chỉ chen vào giữa những thao tác đã
// có (kéo góc ảnh của thẻ, bấm đúp để sửa).
export const SELECTION_BOX_MIN = 2;

export function selectionCount(sel) {
  return (sel?.nodeIds?.size || 0) + (sel?.groupIds?.size || 0) + (sel?.drawingIds?.size || 0);
}

// Hộp bao của mọi thứ đang chọn, toạ độ canvas. Trả null khi không đủ phần tử
// hoặc không đo được cái nào — người gọi chỉ việc kiểm null, không có hộp rỗng
// nào lọt vào phép so.
//
// `sizeOf(id)` trả { w, h } đã ĐO THẬT của thẻ (ResizeObserver, xem card-sizes.js):
// chiều cao thẻ do nội dung quyết định nên không có cách nào tính ra từ dữ liệu.
export function selectionBounds(board, sel, sizeOf) {
  if (!board || selectionCount(sel) < SELECTION_BOX_MIN) return null;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  const eat = (x, y, w, h) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    l = Math.min(l, x); t = Math.min(t, y);
    r = Math.max(r, x + (w || 0)); b = Math.max(b, y + (h || 0));
  };

  for (const n of board.nodes || []) {
    if (!sel.nodeIds?.has(n.id)) continue;
    const size = sizeOf ? sizeOf(n.id) : null;
    eat(n.x, n.y, size?.w || n.w || cardLevelW(n), size?.h || 0);
  }
  for (const g of board.groups || []) {
    if (!sel.groupIds?.has(g.id)) continue;
    eat(g.x, g.y, g.w, g.h);
  }
  for (const d of board.drawings || []) {
    if (!sel.drawingIds?.has(d.id)) continue;
    const box = drawingBox(d);
    if (box) eat(box.x, box.y, box.w, box.h);
  }
  if (!Number.isFinite(l) || !Number.isFinite(t)) return null;
  return { x: l, y: t, w: Math.max(0, r - l), h: Math.max(0, b - t) };
}

// Điểm có nằm trong hộp không. `pad` nới ra một chút vì mép hộp cũng phải cầm
// được — nhắm đúng vào một đường viền 1px là việc không ai làm nổi.
export function pointInBounds(bounds, p, pad = 0) {
  if (!bounds || !p) return false;
  return p.x >= bounds.x - pad && p.x <= bounds.x + bounds.w + pad
    && p.y >= bounds.y - pad && p.y <= bounds.y + bounds.h + pad;
}

// Bốn góc, kèm góc ĐỐI DIỆN — góc đối diện là điểm đứng yên khi kéo, nên nó là
// thứ duy nhất phép co giãn cần biết.
export const SELECTION_CORNERS = ["nw", "ne", "se", "sw"];

export function cornerPoint(bounds, corner) {
  const right = corner === "ne" || corner === "se";
  const bottom = corner === "se" || corner === "sw";
  return { x: bounds.x + (right ? bounds.w : 0), y: bounds.y + (bottom ? bounds.h : 0) };
}

export function anchorFor(bounds, corner) {
  const opposite = { nw: "se", ne: "sw", se: "nw", sw: "ne" };
  return cornerPoint(bounds, opposite[corner]);
}

// Hệ số co giãn của một cú kéo góc. ĐỀU hai chiều, không kéo méo: cụm thường
// gồm cả thẻ lẫn chữ, mà bóp một chiều thì chữ giãn ngang còn thẻ thì không
// (chiều cao thẻ do nội dung quyết định) — cụm sẽ rời ra chứ không to lên.
// Lấy tỉ lệ LỚN HƠN trong hai chiều nên cú kéo bám theo tay ở chiều người dùng
// đang thật sự kéo mạnh hơn.
export function scaleFactorFor(bounds, corner, p) {
  if (!bounds) return 1;
  const a = anchorFor(bounds, corner);
  const spanX = Math.abs(cornerPoint(bounds, corner).x - a.x);
  const spanY = Math.abs(cornerPoint(bounds, corner).y - a.y);
  const kx = spanX > 1 ? Math.abs(p.x - a.x) / spanX : null;
  const ky = spanY > 1 ? Math.abs(p.y - a.y) / spanY : null;
  let k = kx == null ? ky : (ky == null ? kx : Math.max(kx, ky));
  if (!Number.isFinite(k) || k <= 0) return 1;
  // Kẹp theo cạnh DÀI của hộp: cạnh ngắn (một hàng chữ cao 20 đơn vị) sẽ chạm
  // trần trước và khoá cứng cả cụm nếu kẹp theo nó.
  const span = Math.max(bounds.w, bounds.h);
  if (span > 0) {
    k = Math.min(k, MAX_SPAN / span);
    k = Math.max(k, MIN_SPAN / span);
  }
  return k;
}

function scalePoint(v, anchor, k) {
  return anchor + (v - anchor) * k;
}

// Co giãn CẢ CỤM quanh `anchor` với hệ số `k`. Mọi thứ trong vùng chọn đều đi:
// vị trí của tất cả, cộng thêm kích thước của những thứ CÓ kích thước ghi trong
// dữ liệu (bề rộng thẻ, cỡ khung, độ dày nét, cỡ chữ).
//
// Chiều CAO của thẻ cố ý không có mặt ở đây: nó do nội dung quyết định, không
// nằm trong dữ liệu để mà nhân lên. Thẻ hẹp lại thì chữ xuống dòng nhiều hơn và
// thẻ tự cao lên — đó là hành vi đúng, chỉ là nó không tỉ lệ tuyệt đối với `k`.
export function scaleSelection(board, sel, anchor, k) {
  if (!board || !anchor || !Number.isFinite(k) || k === 1) return board;
  const nodeIds = sel.nodeIds || new Set();
  const groupIds = sel.groupIds || new Set();
  const drawingIds = sel.drawingIds || new Set();

  const nodes = nodeIds.size === 0 ? board.nodes : board.nodes.map((n) => {
    if (!nodeIds.has(n.id) || n.locked) return n;
    const w = Math.max(MIN_CARD_W, Math.round((n.w || cardLevelW(n)) * k));
    return {
      ...n,
      x: Math.round(scalePoint(n.x, anchor.x, k)),
      y: Math.round(scalePoint(n.y, anchor.y, k)),
      w
    };
  });

  const groups = groupIds.size === 0 ? board.groups : board.groups.map((g) => {
    if (!groupIds.has(g.id) || g.locked) return g;
    return {
      ...g,
      x: Math.round(scalePoint(g.x, anchor.x, k)),
      y: Math.round(scalePoint(g.y, anchor.y, k)),
      w: Math.max(MIN_GROUP_W, Math.round(g.w * k)),
      h: Math.max(MIN_GROUP_H, Math.round(g.h * k))
    };
  });

  const drawings = drawingIds.size === 0 ? (board.drawings || []) : (board.drawings || []).map((d) => {
    if (!drawingIds.has(d.id)) return d;
    const pts = (d.pts || []).map((v, i) => Math.round(
      i % 2 === 0 ? scalePoint(v, anchor.x, k) : scalePoint(v, anchor.y, k)
    ));
    // Text: `w`/`h` là kích thước HỘP CHỮ (đo được từ cỡ chữ), còn `w` của nét
    // bút và hình khối là ĐỘ DÀY NÉT. Cùng một tên field, hai đại lượng khác
    // hẳn nhau — cùng cái bẫy đã ghi ở drawingsHitBy trong shape.js, và đây là
    // chỗ thứ hai phải trả giá cho nó.
    if (d.kind === "text") {
      const next = { ...d, pts, size: Math.max(MIN_TEXT_SIZE, Math.round((d.size || 20) * k)) };
      if (Number.isFinite(d.w)) next.w = Math.round(d.w * k);
      if (Number.isFinite(d.h)) next.h = Math.round(d.h * k);
      return next;
    }
    const next = { ...d, pts };
    if (Number.isFinite(d.w)) next.w = Math.max(MIN_STROKE_W, Math.round(d.w * k * 10) / 10);
    return next;
  });

  return { ...board, nodes, groups, drawings };
}
