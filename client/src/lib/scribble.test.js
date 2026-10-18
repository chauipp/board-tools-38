import test from "node:test";
import assert from "node:assert/strict";
import { isScribble, scribbleTargets, turnRuns, SCRIBBLE_MIN_TURNS } from "./scribble.js";

// Nét ngoằn ngoèo: đi dọc trục (dx,dy) `legs` nhát, mỗi nhát vọt sang hai bên
// một đoạn `amp` theo phương vuông góc.
function zigzag(x0, y0, dx, dy, amp, legs) {
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const out = [];
  for (let k = 0; k <= legs; k++) {
    const s = k % 2 ? 1 : -1;
    out.push(x0 + dx * k + nx * amp * s, y0 + dy * k + ny * amp * s);
  }
  return out;
}

// Chèn thêm điểm dọc mỗi đoạn — cùng HÌNH, khác SỐ ĐIỂM.
function densify(pts, per) {
  const out = [pts[0], pts[1]];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    for (let k = 1; k <= per; k++) {
      out.push(pts[i] + (pts[i + 2] - pts[i]) * (k / per), pts[i + 1] + (pts[i + 3] - pts[i + 1]) * (k / per));
    }
  }
  return out;
}

function polygon(cx, cy, r, n, step = 1) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = (-Math.PI / 2) + (2 * Math.PI * step * k) / n;
    out.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return out;
}

// ── Nhận ra cú gạch ────────────────────────────────────────────────────────

test("nét ngoằn ngoèo đè lên nhau là một cú gạch xoá", () => {
  assert.equal(isScribble(zigzag(0, 0, 25, 25, 60, 8)), true);
});

test("đoạn thẳng không phải cú gạch", () => {
  assert.equal(isScribble([0, 0, 100, 100, 200, 200, 300, 300]), false);
});

test("đường thẳng vẽ tay RUNG cũng không phải cú gạch", () => {
  // Rung ±2 đơn vị trên một nét dài 400: đây đúng là cảnh mà phép đếm góc chạy
  // trên điểm thô sẽ đọc ra hàng chục lần đổi chiều. Dung sai rút gọn tỉ lệ với
  // khổ nét phải dọn sạch nó trước khi đếm.
  const wob = [];
  for (let k = 0; k <= 80; k++) wob.push(k * 5, k * 5 + (k % 2 ? 2 : -2));
  assert.equal(isScribble(wob), false);
});

test("vòng tròn không phải cú gạch", () => {
  assert.equal(isScribble(polygon(100, 100, 80, 32)), false);
});

test("hình vuông không phải cú gạch", () => {
  // Bốn góc vuông, đường đi gấp 2,8 lần đường chéo — thoả mọi chốt "nhiều góc
  // nhọn, đường đi dài". Thứ duy nhất loại được nó là DẤU của góc quay.
  assert.equal(isScribble([0, 0, 200, 0, 200, 200, 0, 200, 0, 0]), false);
});

test("ngôi sao năm cánh không phải cú gạch", () => {
  assert.equal(isScribble(polygon(100, 100, 90, 5, 2)), false);
});

test("ngôi sao CHÍN cánh không phải cú gạch, dù có TÁM góc rất nhọn", () => {
  // Đây mới là ca thật sự thử phép so DẤU, và là lý do bài sao-năm-cánh ở trên
  // một mình thì không đủ: sao năm cánh chỉ có bốn đỉnh trong, nên chốt "đủ năm
  // lần" đã loại nó trước khi dấu kịp lên tiếng.
  //
  // Sao chín cánh {9/4} thì có tám góc nhọn liên tiếp, mỗi góc quay 160° — thừa
  // sức vượt mọi chốt đếm. Thứ duy nhất còn loại được nó là: cả tám góc đều quay
  // VỀ MỘT PHÍA. Vẽ một mạch quanh một cái ruột thì bao giờ cũng thế, còn gạch
  // xoá thì theo đúng nghĩa đen là quay ngược lại.
  const star9 = polygon(100, 100, 90, 9, 4);
  assert.ok(turnRuns(star9) < SCRIBBLE_MIN_TURNS,
    `sao chín cánh đếm ra ${turnRuns(star9)} lần ĐỔI CHIỀU — phép so dấu đã hỏng`);
  assert.equal(isScribble(star9), false);
});

test("vòng xoắn ốc không phải cú gạch", () => {
  // Cùng bài học, dạng khác: đi mãi về một phía thì dù đi bao lâu cũng không
  // thành gạch xoá.
  const spiral = [];
  for (let k = 0; k <= 14; k++) {
    const a = (2 * Math.PI * k) / 5;
    const r = 10 + k * 7;
    spiral.push(100 + r * Math.cos(a), 100 + r * Math.sin(a));
  }
  assert.equal(isScribble(spiral), false);
});

test("chữ W không phải cú gạch — mới ba lần đổi chiều", () => {
  assert.equal(isScribble([0, 0, 20, 60, 40, 0, 60, 60, 80, 0]), false);
});

test("gạch ngang một dòng chữ RỘNG mà THẤP vẫn được nhận", () => {
  // Cảnh thường gặp nhất của cử chỉ này, và cũng là cảnh mà chốt "đường đi phải
  // dài gấp mấy lần đường chéo" từng đánh trượt: nó rộng nên thưa. Xem ghi chú ở
  // SCRIBBLE_MIN_TURNS.
  const wide = [];
  for (let k = 0; k <= 12; k++) wide.push(k * 15, k % 2 ? 34 : 4);
  assert.equal(isScribble(wide), true);
});

test("câu trả lời KHÔNG đổi khi vẽ dày điểm hơn", () => {
  const thin = zigzag(0, 0, 25, 25, 60, 8);
  assert.equal(isScribble(thin), isScribble(densify(thin, 12)));
  assert.equal(isScribble(densify(thin, 12)), true);
});

test("câu trả lời KHÔNG đổi khi gạch to gấp ba", () => {
  const small = zigzag(0, 0, 25, 25, 60, 8);
  assert.equal(isScribble(small.map((v) => v * 3)), true);
  const sq = [0, 0, 200, 0, 200, 200, 0, 200, 0, 0];
  assert.equal(isScribble(sq.map((v) => v * 3)), false);
});

test("nét quá ngắn không đoán", () => {
  assert.equal(isScribble([0, 0, 5, 5]), false);
  assert.equal(isScribble(null), false);
  assert.equal(isScribble([]), false);
});

// ── Gạch vào cái gì ────────────────────────────────────────────────────────

const diagonal = { id: "line-1", kind: "pen", w: 3, pts: [0, 0, 200, 200] };

test("gạch chéo qua một nét thì xoá đúng nét đó", () => {
  const mark = zigzag(10, 10, 25, 25, 60, 8);
  assert.deepEqual(scribbleTargets(mark, [diagonal]), ["line-1"]);
});

test("gạch ở chỗ khác thì không đụng tới nét nào", () => {
  const mark = zigzag(600, 600, 25, 25, 60, 8);
  assert.deepEqual(scribbleTargets(mark, [diagonal]), []);
});

test("nét thường vẽ đè lên nhau KHÔNG xoá gì", () => {
  // Cái van an toàn: chỉ khi nét ĐÃ LÀ một cú gạch mới có chuyện xoá.
  assert.deepEqual(scribbleTargets([0, 300, 300, 0], [diagonal]), []);
});

test("gạch ở chỗ trống thì không xoá gì — nét đó được giữ lại", () => {
  assert.deepEqual(scribbleTargets(zigzag(0, 0, 25, 25, 60, 8), []), []);
});

test("chỉ CẮT QUA MỘT LẦN thì chưa phải bị gạch", () => {
  // Một cú gạch ở chỗ khác, chỉ có cái đuôi thò ra chạm ngang qua một nét đứng
  // gần đó đúng một lần. Đi ngang qua không phải là gạch bỏ.
  const near = { id: "line-2", kind: "pen", w: 3, pts: [-400, 0, -400, 600] };
  // Cả cú gạch nằm bên PHẢI đường thẳng; chỉ mỗi cái đuôi ở cuối vượt sang trái.
  const mark = [-380, 100, -350, 140, -380, 180, -350, 220, -380, 260, -350, 300, -380, 340, -460, 380];
  const hit = scribbleTargets(mark, [near]);
  assert.ok(!hit.includes("line-2"), "cắt qua một lần mà đã bị xoá");
});

test("gạch lên một dòng chữ thì xoá dòng chữ, dù không cắt qua mép nào", () => {
  const label = { id: "t-1", kind: "text", w: 200, h: 40, pts: [0, 0] };
  const inside = [];
  for (let k = 0; k <= 12; k++) inside.push(10 + k * 14, k % 2 ? 32 : 8);
  assert.deepEqual(scribbleTargets(inside, [label]), ["t-1"]);
});

test("gạch vào RUỘT hình tô đặc thì xoá, vào ruột hình chỉ có viền thì không", () => {
  const solid = { id: "s-1", kind: "rect", w: 3, fill: true, pts: [0, 0, 300, 300] };
  const hollow = { id: "s-2", kind: "rect", w: 3, fill: false, pts: [0, 0, 300, 300] };
  const inside = zigzag(80, 80, 10, 10, 40, 8);
  assert.deepEqual(scribbleTargets(inside, [solid]), ["s-1"]);
  assert.deepEqual(scribbleTargets(inside, [hollow]), []);
});

test("gạch cắt qua viền hình rỗng thì vẫn xoá được nó", () => {
  const hollow = { id: "s-2", kind: "rect", w: 3, fill: false, pts: [0, 0, 300, 300] };
  // Gạch dọc theo CẠNH TRÁI, vắt qua lại hai bên nó — mỗi nhát là một giao điểm.
  const across = zigzag(0, 60, 0, 30, 50, 7);
  assert.deepEqual(scribbleTargets(across, [hollow]), ["s-2"]);
});

test("gạch trùm nhiều nét thì xoá hết chỗ nó gạch qua", () => {
  const second = { id: "line-3", kind: "pen", w: 3, pts: [0, 40, 200, 240] };
  const mark = zigzag(10, 30, 25, 25, 60, 8);
  const hit = scribbleTargets(mark, [diagonal, second]);
  assert.deepEqual(hit.slice().sort(), ["line-1", "line-3"]);
});
