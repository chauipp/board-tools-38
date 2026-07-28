// Bậc thẻ: mỗi thẻ mang một bậc từ 1 tới 5. Bậc 1 to nhất, viền đậm, nền pha
// accent, có 👑 — đây chính là "thẻ gốc" cũ. Bậc 3 là thẻ thường (mặc định).
// Bậc 5 nhỏ nhất, viền đứt mờ, không đổ bóng — dùng cho ghi chú bên lề.
//
// Trước đợt này chỉ có HAI bậc và chúng được ghi bằng cờ boolean `node.isRoot`.
// Board đã lưu vẫn còn cờ đó, nên:
//   - cardLevel() đọc được cả `level` mới lẫn `isRoot` cũ;
//   - mọi chỗ GHI bậc đều phải đi qua levelPatch(), hàm này ghi kèm `isRoot` cho
//     khớp. Giữ cờ cũ đồng bộ để board mở lại bằng bản client cũ (hoặc bởi chỗ
//     nào còn sót đọc isRoot) không mất vương miện của thẻ bậc 1.

const KEY = "ideamap.card";

export const CARD_LEVELS = [1, 2, 3, 4, 5];
export const DEFAULT_CARD_LEVEL = 3;

// Bề rộng theo bậc. PHẢI khớp `width` của .idea-card.lv-N trong idea-map.css:
// số ở đây chỉ dùng để tính chỗ đặt thẻ lúc bấm chuột (canh giữa thẻ vào con
// trỏ). Bề rộng thật của thẻ đã nằm trên bảng do ResizeObserver đo, xem
// lib/card-sizes.js.
export const CARD_LEVEL_W = { 1: 260, 2: 235, 3: 210, 4: 180, 5: 150 };

export function cardLevel(node) {
  const lv = Number(node?.level);
  if (CARD_LEVELS.includes(lv)) return lv;
  return node?.isRoot ? 1 : DEFAULT_CARD_LEVEL;
}

export function cardLevelW(node) {
  return CARD_LEVEL_W[cardLevel(node)];
}

/**
 * Mảnh dữ liệu để gán bậc cho một thẻ — dùng cho cả lúc tạo mới lẫn lúc đổi bậc
 * từ menu chuột phải. Bậc lạ (undefined, chuỗi, 9) rơi về bậc mặc định thay vì
 * ghi rác vào board.
 */
export function levelPatch(level) {
  const lv = CARD_LEVELS.includes(Number(level)) ? Number(level) : DEFAULT_CARD_LEVEL;
  return { level: lv, isRoot: lv === 1 };
}

// Bậc đang chọn ở khu 4 được nhớ qua lần mở sau, cùng lý do với màu bút: đó là
// một lựa chọn về gu, không phải một chế độ đang bật. (Mode và tool thì KHÔNG
// nhớ — mở board ra mà con trỏ đang là cây bút là bất ngờ vô cớ.)
export function loadCardLevel(storage) {
  let saved = null;
  try {
    saved = JSON.parse(storage.getItem(KEY));
  } catch {
    saved = null;
  }
  const lv = Number(saved?.level);
  return CARD_LEVELS.includes(lv) ? lv : DEFAULT_CARD_LEVEL;
}

export function saveCardLevel(storage, level) {
  try {
    storage.setItem(KEY, JSON.stringify({ level: cardLevel({ level }) }));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất lựa chọn bậc, không đáng làm sập app.
  }
}
