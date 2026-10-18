import test from "node:test";
import assert from "node:assert/strict";
import {
  selectionBounds, selectionCount, pointInBounds, cornerPoint, anchorFor,
  scaleFactorFor, scaleSelection, SELECTION_BOX_MIN, MIN_CARD_W, MIN_GROUP_W
} from "./selection-box.js";

// Thẻ đo được 200×100 cho mọi id — chiều cao thẻ do nội dung quyết định nên
// trong app nó tới từ ResizeObserver, ở đây thì cố định cho dễ đọc.
const sizeOf = () => ({ w: 200, h: 100 });

function board() {
  return {
    nodes: [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 500, y: 300 },
      { id: 9, x: 5000, y: 5000 }
    ],
    groups: [{ id: 1, x: 50, y: 50, w: 300, h: 200 }],
    drawings: [
      { id: 1, kind: "pen", w: 4, pts: [200, 600, 400, 700] },
      { id: 2, kind: "text", size: 20, w: 80, h: 24, pts: [900, 900], text: "hi" }
    ]
  };
}

const sel = (nodeIds = [], groupIds = [], drawingIds = []) => ({
  nodeIds: new Set(nodeIds), groupIds: new Set(groupIds), drawingIds: new Set(drawingIds)
});

test("selectionCount đếm cả ba loại", () => {
  assert.equal(selectionCount(sel([1, 2], [1], [1])), 4);
  assert.equal(selectionCount(sel()), 0);
  assert.equal(selectionCount(null), 0);
});

test("một mình một phần tử thì KHÔNG có hộp bao", () => {
  // Bản thân nó đã cầm kéo được; thêm một cái hộp nữa chỉ chen vào giữa những
  // thao tác đã có của chính nó.
  assert.equal(selectionBounds(board(), sel([1]), sizeOf), null);
  assert.equal(SELECTION_BOX_MIN, 2);
});

test("hộp bao ôm trọn thẻ (theo cỡ ĐO ĐƯỢC, không phải cỡ mặc định)", () => {
  const b = selectionBounds(board(), sel([1, 2]), sizeOf);
  assert.deepEqual(b, { x: 100, y: 100, w: 600, h: 300 });
});

test("hộp bao gộp cả thẻ, khung và nét vẽ", () => {
  const b = selectionBounds(board(), sel([1], [1], [1]), sizeOf);
  assert.equal(b.x, 50);
  assert.equal(b.y, 50);
  // Nét bút kéo tới y = 700, cộng nửa độ dày nét (drawingBox nới w/2 mỗi phía).
  assert.ok(b.y + b.h >= 700);
});

test("thẻ không nằm trong vùng chọn không kéo hộp bao ra theo", () => {
  const b = selectionBounds(board(), sel([1, 2]), sizeOf);
  assert.ok(b.x + b.w < 5000, "thẻ id 9 ở tận 5000 không được tính vào");
});

test("pointInBounds: mép hộp cũng phải cầm được (pad)", () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(pointInBounds(b, { x: 50, y: 50 }), true);
  assert.equal(pointInBounds(b, { x: 104, y: 50 }), false);
  assert.equal(pointInBounds(b, { x: 104, y: 50 }, 6), true);
  assert.equal(pointInBounds(null, { x: 0, y: 0 }), false);
});

test("góc và góc neo: neo là góc ĐỐI DIỆN, nó đứng yên khi kéo", () => {
  const b = { x: 10, y: 20, w: 100, h: 200 };
  assert.deepEqual(cornerPoint(b, "nw"), { x: 10, y: 20 });
  assert.deepEqual(cornerPoint(b, "se"), { x: 110, y: 220 });
  assert.deepEqual(anchorFor(b, "se"), { x: 10, y: 20 });
  assert.deepEqual(anchorFor(b, "nw"), { x: 110, y: 220 });
});

test("scaleFactorFor: kéo góc se ra gấp đôi → hệ số 2", () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(scaleFactorFor(b, "se", { x: 200, y: 200 }), 2);
});

test("scaleFactorFor: lấy tỉ lệ LỚN HƠN trong hai chiều — cú kéo bám theo tay", () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(scaleFactorFor(b, "se", { x: 300, y: 150 }), 3);
});

test("scaleFactorFor: kéo vọt tay không co cụm về 0", () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  const k = scaleFactorFor(b, "se", { x: 0.2, y: 0.2 });
  assert.ok(k * 100 >= 24, `co còn ${k * 100} đơn vị — mất luôn chỗ để cầm lại`);
});

test("scaleFactorFor: hộp dẹt (một hàng chữ) vẫn co giãn được", () => {
  // Cạnh cao chỉ 20 đơn vị. Kẹp theo cạnh NGẮN thì cụm này khoá cứng ngay.
  const b = { x: 0, y: 0, w: 800, h: 20 };
  assert.ok(scaleFactorFor(b, "se", { x: 1600, y: 40 }) > 1.9);
});

test("scaleSelection: thẻ chạy theo và bề rộng nhân lên, góc neo đứng yên", () => {
  const next = scaleSelection(board(), sel([1, 2]), { x: 100, y: 100 }, 2);
  const n1 = next.nodes.find((n) => n.id === 1);
  const n2 = next.nodes.find((n) => n.id === 2);
  assert.deepEqual({ x: n1.x, y: n1.y }, { x: 100, y: 100 });   // đúng góc neo
  assert.deepEqual({ x: n2.x, y: n2.y }, { x: 900, y: 500 });
  assert.equal(n2.w, 420);                                      // 210 (bậc 3) × 2
});

test("scaleSelection: thứ KHÔNG được chọn đứng im tuyệt đối", () => {
  const before = board();
  const next = scaleSelection(before, sel([1]), { x: 0, y: 0 }, 3);
  assert.deepEqual(next.nodes.find((n) => n.id === 9), before.nodes.find((n) => n.id === 9));
  assert.deepEqual(next.groups, before.groups);
  assert.deepEqual(next.drawings, before.drawings);
});

test("scaleSelection: khung co cả vị trí lẫn kích thước", () => {
  const next = scaleSelection(board(), sel([], [1]), { x: 0, y: 0 }, 2);
  const g = next.groups[0];
  assert.deepEqual({ x: g.x, y: g.y, w: g.w, h: g.h }, { x: 100, y: 100, w: 600, h: 400 });
});

test("scaleSelection: nét bút co cả toạ độ lẫn ĐỘ DÀY NÉT", () => {
  const next = scaleSelection(board(), sel([], [], [1]), { x: 0, y: 0 }, 2);
  const d = next.drawings.find((x) => x.id === 1);
  assert.deepEqual(d.pts, [400, 1200, 800, 1400]);
  assert.equal(d.w, 8);
});

test("scaleSelection: chữ co CỠ CHỮ và hộp chữ, không phải độ dày nét", () => {
  // `w` của text là bề rộng HỘP CHỮ chứ không phải độ dày nét — cùng tên field,
  // hai đại lượng khác hẳn nhau.
  const next = scaleSelection(board(), sel([], [], [2]), { x: 0, y: 0 }, 2);
  const d = next.drawings.find((x) => x.id === 2);
  assert.equal(d.size, 40);
  assert.equal(d.w, 160);
  assert.equal(d.h, 48);
  assert.deepEqual(d.pts, [1800, 1800]);
});

test("scaleSelection: co nhỏ vẫn giữ sàn để không có thứ gì biến mất", () => {
  const next = scaleSelection(board(), sel([1], [1], [1]), { x: 0, y: 0 }, 0.01);
  assert.equal(next.nodes.find((n) => n.id === 1).w, MIN_CARD_W);
  assert.equal(next.groups[0].w, MIN_GROUP_W);
  assert.ok(next.drawings.find((d) => d.id === 1).w > 0);
});

test("scaleSelection: thẻ/khung đang khoá không bị cú kéo góc động vào", () => {
  const b = board();
  b.nodes[0].locked = true;
  const next = scaleSelection(b, sel([1, 2]), { x: 0, y: 0 }, 2);
  assert.deepEqual(next.nodes.find((n) => n.id === 1), b.nodes[0]);
  assert.equal(next.nodes.find((n) => n.id === 2).x, 1000);
});

test("scaleSelection: hệ số 1 hoặc rác thì trả về CHÍNH board cũ", () => {
  const b = board();
  assert.equal(scaleSelection(b, sel([1]), { x: 0, y: 0 }, 1), b);
  assert.equal(scaleSelection(b, sel([1]), { x: 0, y: 0 }, NaN), b);
  assert.equal(scaleSelection(b, sel([1]), null, 2), b);
});
