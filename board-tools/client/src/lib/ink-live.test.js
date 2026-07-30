// game-tools/client/src/lib/ink-live.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INK_LIVE_TTL_MS, INK_SETTLE_TTL_MS, inkKey, mergeInkPacket, reconcileInkOverlay, applyInkMoves
} from "./ink-live.js";

const NOW = 1000;
// socketId do SERVER đính vào, không phải client tự đặt.
function pkt(o) { return { socketId: "s1", strokeId: 1, ...o }; }

test("inkKey: khoá theo socketId + strokeId", () => {
  assert.equal(inkKey({ socketId: "abc", strokeId: 7 }), "abc:7");
});

test("mergeInkPacket: gói đầu tạo entry đủ màu, độ dày, điểm", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0, 10, 10] }), NOW);
  assert.deepEqual(m.get("s1:1"), {
    kind: "pen", fill: false, dashed: false,
    color: "pen-red", w: 4, pts: [0, 0, 10, 10],
    text: null, size: null, editId: null,
    drawingId: null, erase: null, expiresAt: NOW + INK_LIVE_TTL_MS
  });
});

test("mergeInkPacket: gói sau nối điểm mới vào đuôi và gia hạn TTL", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [10, 10] }), NOW + 40);
  m = mergeInkPacket(m, pkt({ seq: 2, pts: [20, 20] }), NOW + 80);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 10, 10, 20, 20]);
  assert.equal(m.get("s1:1").expiresAt, NOW + 80 + INK_LIVE_TTL_MS);
});

// Vào board giữa lúc người khác đang vẽ: không có gói seq 0 nên không biết màu
// và độ dày. Bỏ qua, đừng vẽ một nét vô màu.
test("mergeInkPacket: thiếu gói đầu thì bỏ qua và trả đúng map cũ", () => {
  const prev = new Map();
  assert.equal(mergeInkPacket(prev, pkt({ seq: 3, pts: [1, 1] }), NOW), prev);
});

test("mergeInkPacket: gói done ghi drawingId, đổi sang TTL dài, giữ nguyên điểm", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-blue", w: 2, pts: [0, 0, 5, 5] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW + 100);
  const e = m.get("s1:1");
  assert.equal(e.drawingId, 37);
  assert.equal(e.expiresAt, NOW + 100 + INK_SETTLE_TTL_MS);
  assert.deepEqual(e.pts, [0, 0, 5, 5], "gói done không được xoá điểm đã nhận");
});

test("mergeInkPacket: gói cancel bỏ hẳn entry", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ cancel: true }), NOW + 50);
  assert.equal(m.has("s1:1"), false);
});

test("mergeInkPacket: gói erase gom id, không trùng lặp", () => {
  let m = mergeInkPacket(new Map(), pkt({ erase: [3, 7] }), NOW);
  m = mergeInkPacket(m, pkt({ erase: [7, 12] }), NOW + 40);
  assert.deepEqual(m.get("s1:1").erase, [3, 7, 12]);
  assert.equal(m.get("s1:1").pts, null);
});

test("mergeInkPacket: hai người vẽ cùng lúc là hai entry riêng", () => {
  let m = mergeInkPacket(new Map(), { socketId: "s1", strokeId: 1, seq: 0, color: "pen-red", w: 4, pts: [0, 0] }, NOW);
  m = mergeInkPacket(m, { socketId: "s2", strokeId: 1, seq: 0, color: "pen-blue", w: 8, pts: [9, 9] }, NOW);
  assert.equal(m.size, 2);
  assert.equal(m.get("s2:1").color, "pen-blue");
});

test("mergeInkPacket: gói rác trả đúng map cũ, không nổ", () => {
  const prev = new Map();
  assert.equal(mergeInkPacket(prev, null, NOW), prev);
  assert.equal(mergeInkPacket(prev, { seq: 0, pts: [0, 0] }, NOW), prev, "thiếu socketId");
  assert.equal(mergeInkPacket(prev, pkt({ seq: 0, pts: [] }), NOW), prev, "pts rỗng");
});

test("reconcileInkOverlay: bỏ ngay entry mà board đã có nét thật", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW);
  const board = { drawings: [{ id: 37, kind: "pen", color: "pen-red", w: 4, pts: [0, 0] }] };
  assert.equal(reconcileInkOverlay(m, board).has("s1:1"), false);
});

test("reconcileInkOverlay: giữ entry mà board chưa bắt kịp", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 37 }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [] }).has("s1:1"), true);
});

test("reconcileInkOverlay: nét đang vẽ chưa done thì không bị bỏ, trả map cũ", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 1 }] }), m);
});

test("reconcileInkOverlay: entry gôm bỏ khi mọi nét đã thật sự mất khỏi board", () => {
  const m = mergeInkPacket(new Map(), pkt({ erase: [3, 7], done: true }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 9 }] }).has("s1:1"), false);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 3 }] }).has("s1:1"), true);
});

test("reconcileInkOverlay: overlay rỗng hoặc board null trả map cũ", () => {
  const empty = new Map();
  assert.equal(reconcileInkOverlay(empty, { drawings: [] }), empty);
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  assert.equal(reconcileInkOverlay(m, null), m);
});

test("mergeInkPacket: gói đầu của hình khối giữ kind và fill", () => {
  const m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, fill: true, pts: [0, 0, 100, 60] }),
    NOW
  );
  assert.deepEqual(m.get("s1:1"), {
    kind: "rect", fill: true, dashed: false,
    color: "pen-blue", w: 8, pts: [0, 0, 100, 60],
    text: null, size: null, editId: null,
    drawingId: null, erase: null, expiresAt: NOW + INK_LIVE_TTL_MS
  });
});

// ĐÂY là điểm khác nhau cốt lõi giữa hai loại gói: gói hình khối mang CẢ hộp
// nên phải THAY, không nối. Nối thì hộp dài ra thành 6, 8, 10 số và shapePath
// đọc sai hình.
test("mergeInkPacket: gói sau của hình khối THAY hộp chứ không nối", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, fill: false, pts: [0, 0, 10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, kind: "rect", pts: [0, 0, 50, 40] }), NOW + 40);
  m = mergeInkPacket(m, pkt({ seq: 2, kind: "rect", pts: [0, 0, 90, 70] }), NOW + 80);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 90, 70]);
  assert.equal(m.get("s1:1").kind, "rect", "kind phải giữ qua các gói");
  assert.equal(m.get("s1:1").fill, false, "fill phải giữ qua các gói");
  assert.equal(m.get("s1:1").expiresAt, NOW + 80 + INK_LIVE_TTL_MS);
});

test("mergeInkPacket: gói done của hình khối giữ hộp và mang drawingId", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, kind: "ellipse", color: "pen-green", w: 2, fill: true, pts: [0, 0, 10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 42 }), NOW + 50);
  const e = m.get("s1:1");
  assert.equal(e.drawingId, 42);
  assert.equal(e.kind, "ellipse");
  assert.deepEqual(e.pts, [0, 0, 10, 10]);
  assert.equal(e.expiresAt, NOW + 50 + INK_SETTLE_TTL_MS);
});

// Bài này cũng là bài chốt hồi quy cho bản sửa fallback về `cur.kind` (fix
// round 1, xem test ngay dưới): nét bút không mang kind ở gói nào cả, kể cả seq
// 0, nên fallback không được đổi hành vi NỐI của nó.
test("mergeInkPacket: gói không có kind vẫn là nét bút và vẫn NỐI điểm", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [10, 10] }), NOW + 40);
  assert.equal(m.get("s1:1").kind, "pen");
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 10, 10]);
});

// Fix round 1: gói seq > 0 của hình khối mà THIẾU kind (client cũ, hoặc field
// bị rơi trên đường truyền) phải vẫn được nhận ra là hình khối qua kind của
// entry đã lưu (cur.kind), không được mặc định về "pen" — mặc định sai sẽ rơi
// vào nhánh NỐI và làm hộp phình từ 4 lên 8 số.
test("mergeInkPacket: gói sau của hình khối THIẾU kind vẫn phải THAY hộp, không nối", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, fill: false, pts: [0, 0, 10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [0, 0, 50, 40] }), NOW + 40); // không có kind
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 50, 40]);
});

// `dashed` chỉ đi ở gói seq 0, cùng chỗ với color/w/fill. Gói giữa chừng chỉ
// mang điểm, nên nếu nhánh nối/thay điểm lỡ dựng entry mới thay vì `{ ...cur }`
// thì nét của người khác sẽ NHẢY từ đứt sang liền ngay giữa lúc đang vẽ.
test("mergeInkPacket: dashed sống qua các gói giữa chừng của nét bút", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, dashed: true, pts: [0, 0] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 1, pts: [10, 10] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 2, pts: [20, 20] }), NOW);
  assert.equal(m.get("s1:1").dashed, true);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 10, 10, 20, 20], "vẫn nối điểm như thường");
});

test("mergeInkPacket: dashed sống qua các gói giữa chừng của hình khối", () => {
  let m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "rect", color: "pen-blue", w: 8, dashed: true, pts: [0, 0, 10, 10] }),
    NOW
  );
  m = mergeInkPacket(m, pkt({ seq: 1, kind: "rect", pts: [0, 0, 200, 120] }), NOW);
  assert.equal(m.get("s1:1").dashed, true);
  assert.deepEqual(m.get("s1:1").pts, [0, 0, 200, 120], "hộp vẫn được THAY chứ không nối");
});

// Không tin kiểu client gửi: chỉ đúng `true` mới là nét đứt.
test("mergeInkPacket: dashed sai kiểu thì coi như nét liền", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, dashed: "yes", pts: [0, 0] }), NOW);
  assert.equal(m.get("s1:1").dashed, false);
});

// ── CHỮ ĐANG GÕ ─────────────────────────────────────────────────────────────

test("mergeInkPacket: gói chữ đầu mang chữ, cỡ chữ và id đang sửa", () => {
  const m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "text", color: "pen-red", size: 20, text: "xin", editId: 7, pts: [30, 40] }),
    NOW
  );
  const e = m.get("s1:1");
  assert.equal(e.kind, "text");
  assert.equal(e.text, "xin");
  assert.equal(e.size, 20);
  assert.equal(e.editId, 7);
  assert.deepEqual(e.pts, [30, 40]);
});

// Chữ là thứ ĐANG thay đổi, nên nó phải đi ở mọi gói và phải THAY chứ không nối
// — nối thì gõ "abc" ra "aababc".
test("mergeInkPacket: gói chữ giữa chừng THAY cả đoạn, không nối", () => {
  let m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "text", color: "pen-red", size: 20, text: "a", pts: [30, 40] }),
    NOW
  );
  m = mergeInkPacket(m, pkt({ seq: 1, kind: "text", text: "abc", pts: [30, 40] }), NOW);
  assert.equal(m.get("s1:1").text, "abc");
});

test("mergeInkPacket: màu, cỡ chữ và editId sống qua các gói giữa chừng", () => {
  let m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "text", color: "pen-blue", size: 32, text: "", editId: 5, pts: [0, 0] }),
    NOW
  );
  m = mergeInkPacket(m, pkt({ seq: 1, kind: "text", text: "xong", pts: [0, 0] }), NOW);
  const e = m.get("s1:1");
  assert.equal(e.color, "pen-blue");
  assert.equal(e.size, 32);
  assert.equal(e.editId, 5);
});

// Gói rơi mất field `text` phải giữ lại chữ cũ. Đặt nó thành rỗng là đoạn văn
// của người kia chớp tắt một nhịp rồi hiện lại.
test("mergeInkPacket: gói giữa chừng THIẾU text thì giữ nguyên chữ cũ", () => {
  let m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "text", color: "pen-red", size: 20, text: "giữ", pts: [0, 0] }),
    NOW
  );
  m = mergeInkPacket(m, pkt({ seq: 1, kind: "text", pts: [9, 9] }), NOW);
  assert.equal(m.get("s1:1").text, "giữ");
  assert.deepEqual(m.get("s1:1").pts, [9, 9]);
});

test("mergeInkPacket: tạo text MỚI thì editId là null, không phải undefined", () => {
  const m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "text", color: "pen-red", size: 20, text: "", pts: [0, 0] }),
    NOW
  );
  assert.equal(m.get("s1:1").editId, null);
});

// Nét bút và hình khối không được mang text/size/editId — chúng dùng chung một
// Map với gói chữ, nên một field lạc sang là InkLayer vẽ nhầm nhánh.
test("mergeInkPacket: nét bút không mang text, size hay editId", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  const e = m.get("s1:1");
  assert.equal(e.text, null);
  assert.equal(e.size, null);
  assert.equal(e.editId, null);
});

// Chốt lượt gõ đi đúng đường done sẵn có, nên reconcile dọn overlay khi
// board:update mang id đó về — không cần nhánh riêng nào cho chữ.
test("reconcileInkOverlay: overlay chữ bị dọn khi board đã có id vừa lưu", () => {
  let m = mergeInkPacket(
    new Map(),
    pkt({ seq: 0, kind: "text", color: "pen-red", size: 20, text: "xong", pts: [0, 0] }),
    NOW
  );
  m = mergeInkPacket(m, pkt({ done: true, drawingId: 42 }), NOW);
  assert.equal(m.size, 1);
  const after = reconcileInkOverlay(m, { drawings: [{ id: 42, kind: "text" }] });
  assert.equal(after.size, 0);
});

// ── NÉT ĐANG BỊ DỜI / CO GIÃN / SỬA HÌNH ────────────────────────────────────

const BOARD = [
  { id: 1, kind: "pen", color: "pen-red", w: 4, pts: [0, 0, 10, 10] },
  { id: 2, kind: "rect", color: "pen-blue", w: 8, pts: [0, 0, 50, 30] },
  { id: 3, kind: "text", color: "pen-red", size: 20, w: 60, h: 24, pts: [5, 5], text: "chữ" }
];

test("applyInkMoves: không có gói nào thì trả về ĐÚNG mảng cũ", () => {
  assert.equal(applyInkMoves(BOARD, new Map()), BOARD);
});

// Trả nguyên tham chiếu là điều kiện để useMemo và memo của InkLayer ăn: dựng
// mảng mới ở mỗi gói live của người khác là render lại toàn bộ nét đã lưu.
test("applyInkMoves: có gói nhưng không phải loại `moving` thì vẫn trả mảng cũ", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 0, color: "pen-red", w: 4, pts: [0, 0] }), NOW);
  assert.equal(applyInkMoves(BOARD, m), BOARD);
});

test("applyInkMoves: chỉ nét trong gói bị đổi, phần còn lại giữ nguyên tham chiếu", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 1, moving: [{ id: 2, pts: [100, 100, 150, 130] }] }), NOW);
  const out = applyInkMoves(BOARD, m);
  assert.deepEqual(out[1].pts, [100, 100, 150, 130]);
  assert.equal(out[0], BOARD[0]);
  assert.equal(out[2], BOARD[2]);
});

// Kiểu dáng KHÔNG đi trong gói — người nhận đã có sẵn trong board của họ.
test("applyInkMoves: màu, độ dày, nét đứt lấy từ board của người nhận", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 1, moving: [{ id: 2, pts: [1, 2, 3, 4] }] }), NOW);
  const out = applyInkMoves(BOARD, m);
  assert.equal(out[1].color, "pen-blue");
  assert.equal(out[1].w, 8);
});

// Kéo tay cầm một góc chữ nhật thì nó THÀNH tứ giác. Thiếu kind trong gói là
// người nhận vẽ "rect" với pts 8 số.
test("applyInkMoves: kind đi kèm thì đổi cả kind", () => {
  const m = mergeInkPacket(
    new Map(),
    pkt({ seq: 1, moving: [{ id: 2, kind: "quad", pts: [0, 0, 50, 0, 60, 30, 10, 30] }] }),
    NOW
  );
  assert.equal(applyInkMoves(BOARD, m)[1].kind, "quad");
});

test("applyInkMoves: co giãn một đoạn chữ đổi cả cỡ chữ và hộp chữ", () => {
  const m = mergeInkPacket(
    new Map(),
    pkt({ seq: 1, moving: [{ id: 3, pts: [10, 10], size: 40, w: 120, h: 48 }] }),
    NOW
  );
  const out = applyInkMoves(BOARD, m)[2];
  assert.equal(out.size, 40);
  assert.equal(out.w, 120);
  assert.equal(out.h, 48);
  assert.equal(out.text, "chữ", "nội dung chữ không nằm trong gói dời, phải giữ nguyên");
});

// Gói mang trạng thái TUYỆT ĐỐI nên gói sau THAY hẳn gói trước. Gộp lại thì độ
// dời bị cộng dồn và cụm bay đi.
test("mergeInkPacket: gói `moving` sau thay hẳn gói trước, không gộp", () => {
  let m = mergeInkPacket(new Map(), pkt({ seq: 1, moving: [{ id: 1, pts: [1, 1] }, { id: 2, pts: [2, 2] }] }), NOW);
  m = mergeInkPacket(m, pkt({ seq: 2, moving: [{ id: 1, pts: [9, 9] }] }), NOW);
  assert.equal(m.get("s1:1").moving.length, 1);
  assert.deepEqual(m.get("s1:1").moving[0].pts, [9, 9]);
});

test("mergeInkPacket: gói `moving` rác bị bỏ, không dựng entry rỗng", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 1, moving: [{ id: "x", pts: [1, 1] }] }), NOW);
  assert.equal(m.size, 0);
});

// ĐÂY là lý do gói mang trạng thái tuyệt đối thay vì độ dời: đắp lên một board
// đã cập nhật phải là phép RỖNG, không phải dời lần thứ hai.
test("applyInkMoves: đắp lên board ĐÃ cập nhật là phép rỗng", () => {
  const moved = [{ id: 1, kind: "pen", color: "pen-red", w: 4, pts: [100, 100, 110, 110] }];
  const m = mergeInkPacket(new Map(), pkt({ seq: 1, moving: [{ id: 1, pts: [100, 100, 110, 110] }] }), NOW);
  assert.deepEqual(applyInkMoves(moved, m)[0].pts, [100, 100, 110, 110]);
});

test("reconcileInkOverlay: overlay dời bị dọn khi bản lưu về và khớp", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 1, moving: [{ id: 1, pts: [100, 100] }], done: true }), NOW);
  assert.equal(m.size, 1);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 1, pts: [100, 100] }] }).size, 0);
});

test("reconcileInkOverlay: bản lưu CHƯA khớp thì overlay ở lại", () => {
  const m = mergeInkPacket(new Map(), pkt({ seq: 1, moving: [{ id: 1, pts: [100, 100] }], done: true }), NOW);
  assert.equal(reconcileInkOverlay(m, { drawings: [{ id: 1, pts: [0, 0] }] }).size, 1);
});

test("reconcileInkOverlay: chỉ một nét trong cụm khớp thì overlay vẫn ở lại", () => {
  const m = mergeInkPacket(
    new Map(),
    pkt({ seq: 1, moving: [{ id: 1, pts: [7, 7] }, { id: 2, pts: [8, 8] }], done: true }),
    NOW
  );
  const after = reconcileInkOverlay(m, { drawings: [{ id: 1, pts: [7, 7] }, { id: 2, pts: [0, 0] }] });
  assert.equal(after.size, 1);
});
