import test from "node:test";
import assert from "node:assert/strict";
import { recognizeShape, snapShape, snapLine, SNAP_HOLD_MS, SNAP_MOVE_TOL } from "./recognize.js";

// Nét tay giả lập: mỗi điểm bị đẩy lệch một chút theo một dãy giả ngẫu nhiên CỐ
// ĐỊNH (không dùng Math.random — test phải cho cùng kết quả mọi lần chạy).
function jitter(seed) {
  let s = seed;
  return (amp) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return ((s / 0x7fffffff) * 2 - 1) * amp;
  };
}

// Đi hết một đường gấp khúc, rải điểm cách nhau `step`, có rung tay.
function sample(corners, step, amp, seed, close) {
  const j = jitter(seed);
  const path = close ? corners.concat([corners[0]]) : corners;
  const out = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.round(len / step));
    for (let k = 0; k < steps; k++) {
      const u = k / steps;
      out.push(ax + (bx - ax) * u + j(amp), ay + (by - ay) * u + j(amp));
    }
  }
  const [lx, ly] = path[path.length - 1];
  out.push(lx + j(amp), ly + j(amp));
  return out;
}

function ovalPts(cx, cy, rx, ry, amp, seed, n = 48) {
  const j = jitter(seed);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(cx + rx * Math.cos(a) + j(amp), cy + ry * Math.sin(a) + j(amp));
  }
  return out;
}

test("đường thẳng vẽ tay → kind line, hai đầu giữ nguyên", () => {
  const pts = sample([[10, 20], [210, 80]], 6, 2.5, 7, false);
  const got = recognizeShape(pts);
  assert.equal(got.kind, "line");
  // Điểm đầu và điểm cuối là hai đầu nét, không phải hộp bao.
  assert.ok(Math.abs(got.pts[0] - 10) <= 4 && Math.abs(got.pts[1] - 20) <= 4);
  assert.ok(Math.abs(got.pts[2] - 210) <= 4 && Math.abs(got.pts[3] - 80) <= 4);
});

test("đường gần ngang KHÔNG bị nắn về đúng ngang — hai đầu là hai đầu đã vẽ", () => {
  const pts = sample([[0, 100], [300, 108]], 8, 1.5, 3, false);
  const got = recognizeShape(pts);
  assert.equal(got.kind, "line");
  // Bản trước xoay nét về mốc 45° gần nhất khi đã sát, nên nét này bị ép thành
  // ngang tuyệt đối. Giờ độ dốc người ta vẽ ra được giữ.
  assert.ok(Math.abs(got.pts[3] - 108) <= 4, `y cuối = ${got.pts[3]}`);
});

test("đường chéo 30° giữ đúng độ dốc", () => {
  const pts = sample([[0, 0], [200, 115]], 8, 1.5, 11, false);
  const got = recognizeShape(pts);
  assert.equal(got.kind, "line");
  assert.ok(Math.abs(got.pts[3] - 115) <= 5, `dy = ${got.pts[3]}`);
});

test("đường dài hơi gãy ở giữa vẫn là đường thẳng", () => {
  // Đúng dáng nét trong ảnh người dùng gửi: gần thẳng nhưng đổi độ dốc một nhịp
  // ở khoảng 2/3 đường. Đo bằng ĐỈNH lệch thì chỗ gãy này loại nó ra.
  const pts = sample([[40, 207], [270, 100], [365, 42]], 5, 1.2, 23, false);
  const got = recognizeShape(pts);
  assert.equal(got?.kind, "line", `nhận ra ${got?.kind}`);
  assert.ok(Math.hypot(got.pts[0] - 40, got.pts[1] - 207) <= 3, `A = ${got.pts.slice(0, 2)}`);
});

test("vẽ CHẬM một đường thẳng vẫn ra đường thẳng", () => {
  // Vẽ chậm thì mousemove bắn dày: hai điểm liên tiếp cách nhau một hai đơn vị,
  // đúng bằng biên độ rung tay. Cộng chiều dài từng đoạn một thì tổng phình lên
  // theo SỐ ĐIỂM chứ không theo hình vẽ ra, và nét bị loại khỏi nhánh đường
  // thẳng trước khi kịp đo xem nó có thẳng không. Cùng một nét, chỉ khác chỗ vẽ
  // nhanh hay chậm, mà ra hai kết quả — đó là lỗi.
  for (const [step, amp] of [[12, 1.5], [5, 1.5], [2, 2], [1.2, 2]]) {
    const pts = sample([[15, 168], [150, 128], [240, 82], [335, 28]], step, amp, 7, false);
    assert.equal(recognizeShape(pts)?.kind, "line", `bước ${step}, rung ${amp} → hỏng`);
  }
});

test("cung võng và nét zíc zắc KHÔNG được thành đường thẳng", () => {
  // Hai phép đo, mỗi phép chặn một kiểu: cung võng đều chết ở TRUNG BÌNH (lệch
  // ít nhưng lệch khắp nơi), zíc zắc chết ở ĐỈNH (trung bình nhỏ vì hai đầu vẫn
  // sát dây cung, nhưng chỗ vọt lên thì vọt hẳn).
  const arc = [];
  for (let i = 0; i <= 60; i++) arc.push((i / 60) * 340, 4 * 28 * (i / 60) * (1 - i / 60));
  assert.notEqual(recognizeShape(arc)?.kind, "line");

  const zig = sample([[0, 0], [80, 30], [160, -30], [240, 30], [340, 0]], 4, 1, 3, false);
  assert.notEqual(recognizeShape(zig)?.kind, "line");
});

test("giữ tay ở cuối nét không làm hỏng phép nhận đường thẳng", () => {
  // Bảy chục khung hình rung tay tại chỗ dừng: chúng cộng vào chiều dài đường
  // đi mà không cộng vào khoảng cách hai đầu, nên nét trượt ngưỡng LINE_SLACK.
  const j = jitter(99);
  const pts = sample([[0, 0], [300, 90]], 6, 1.5, 5, false);
  const [ex, ey] = [pts[pts.length - 2], pts[pts.length - 1]];
  for (let i = 0; i < 72; i++) pts.push(ex + j(2), ey + j(2));
  assert.equal(recognizeShape(pts)?.kind, "line");
});

test("giữ tay ở cuối nét không đẻ ra góc giả trong hình kín", () => {
  const j = jitter(31);
  const pts = sample([[0, 0], [200, 0], [200, 120], [0, 120]], 7, 2, 13, true);
  const [ex, ey] = [pts[pts.length - 2], pts[pts.length - 1]];
  for (let i = 0; i < 72; i++) pts.push(ex + j(2.5), ey + j(2.5));
  // Chùm điểm rung có hướng đi ngẫu nhiên nên ngoặt gấp hơn cả bốn góc thật —
  // không cắt nó đi thì nó chiếm hết suất đỉnh và hình ra sai.
  assert.equal(recognizeShape(pts)?.kind, "rect");
});

test("vòng tròn vẽ tay → ellipse, và bị ép về tròn đều", () => {
  const got = recognizeShape(ovalPts(100, 100, 80, 74, 3, 5));
  assert.equal(got.kind, "ellipse");
  const w = got.pts[2] - got.pts[0];
  const h = got.pts[3] - got.pts[1];
  assert.equal(w, h);
});

test("ê-líp dài → ellipse, giữ nguyên tỉ lệ đã vẽ", () => {
  const got = recognizeShape(ovalPts(150, 100, 140, 50, 3, 9));
  assert.equal(got.kind, "ellipse");
  const w = got.pts[2] - got.pts[0];
  const h = got.pts[3] - got.pts[1];
  assert.ok(w / h > 2, `tỉ lệ = ${w / h}`);
});

test("hình vuông vẽ tay → rect, hai chiều bằng nhau", () => {
  const pts = sample([[20, 20], [170, 24], [166, 176], [16, 170]], 7, 2.5, 13, true);
  const got = recognizeShape(pts);
  assert.equal(got.kind, "rect");
  assert.equal(got.pts[2] - got.pts[0], got.pts[3] - got.pts[1]);
});

test("chữ nhật dài vẽ tay → rect, KHÔNG bị ép thành vuông", () => {
  const pts = sample([[0, 0], [300, 6], [298, 106], [-4, 100]], 8, 2.5, 17, true);
  const got = recognizeShape(pts);
  assert.equal(got.kind, "rect");
  assert.ok(got.pts[2] - got.pts[0] > 2 * (got.pts[3] - got.pts[1]));
});

// Tam giác trả về BA ĐỈNH, không phải hộp bao — nên dáng đã vẽ được giữ nguyên.
// Ba đỉnh có thể ra theo thứ tự bất kỳ (thuật toán tìm đỉnh xa nhất trước), nên
// mọi phép so đều phải khớp theo TẬP đỉnh chứ không theo vị trí trong mảng.
function verticesOf(got) {
  const out = [];
  for (let i = 0; i + 1 < got.pts.length; i += 2) out.push([got.pts[i], got.pts[i + 1]]);
  return out;
}

function hasVertexNear(got, x, y, tol = 8) {
  return verticesOf(got).some(([vx, vy]) => Math.hypot(vx - x, vy - y) <= tol);
}

test("tam giác cân vẽ tay → triangle, ba đỉnh đúng chỗ", () => {
  const corners = [[100, 10], [200, 160], [4, 155]];
  const got = recognizeShape(sample(corners, 7, 2.5, 23, true));
  assert.equal(got.kind, "triangle");
  assert.equal(got.pts.length, 6, "tam giác phải trả về BA đỉnh, không phải hộp bao");
  for (const [x, y] of corners) assert.ok(hasVertexNear(got, x, y), `thiếu đỉnh ${x},${y}: ${JSON.stringify(got.pts)}`);
});

test("tam giác VUÔNG vẽ tay giữ nguyên góc vuông, không bị nắn về cân", () => {
  const corners = [[10, 10], [200, 160], [10, 160]];
  const got = recognizeShape(sample(corners, 7, 2.5, 29, true));
  assert.equal(got.kind, "triangle");
  for (const [x, y] of corners) assert.ok(hasVertexNear(got, x, y), `thiếu đỉnh ${x},${y}: ${JSON.stringify(got.pts)}`);
  // Hai đỉnh cùng x = 10: đó chính là cạnh đứng của tam giác vuông. Nếu bị nắn
  // về cân thì đỉnh trên phải nhảy ra giữa (x ≈ 105) và phép này gãy.
  assert.equal(verticesOf(got).filter(([vx]) => Math.abs(vx - 10) <= 8).length, 2);
});

test("tam giác TÙ (đỉnh lệch hẳn ra ngoài) vẫn giữ nguyên dáng", () => {
  const corners = [[240, 20], [300, 180], [20, 180]];
  const got = recognizeShape(sample(corners, 7, 2.5, 43, true));
  assert.equal(got.kind, "triangle");
  for (const [x, y] of corners) assert.ok(hasVertexNear(got, x, y), `thiếu đỉnh ${x},${y}: ${JSON.stringify(got.pts)}`);
});

test("tam giác BÈ (rộng và thấp) vẫn nhận ra và giữ nguyên dáng", () => {
  const corners = [[150, 40], [330, 130], [10, 130]];
  const got = recognizeShape(sample(corners, 6, 2, 47, true));
  assert.equal(got.kind, "triangle");
  for (const [x, y] of corners) assert.ok(hasVertexNear(got, x, y), `thiếu đỉnh ${x},${y}: ${JSON.stringify(got.pts)}`);
});

test("tam giác NGHIÊNG (không cạnh nào ngang) vẫn giữ nguyên dáng", () => {
  const corners = [[60, 20], [260, 90], [120, 210]];
  const got = recognizeShape(sample(corners, 7, 2.5, 53, true));
  assert.equal(got.kind, "triangle");
  for (const [x, y] of corners) assert.ok(hasVertexNear(got, x, y), `thiếu đỉnh ${x},${y}: ${JSON.stringify(got.pts)}`);
});

// ── Tứ giác bốn đỉnh ────────────────────────────────────────────────────────
// Cùng lối với tam giác: giữ nguyên dáng đã vẽ. Nhưng tứ giác là ứng viên DỄ DÃI
// NHẤT (bốn đỉnh tự do bám được gần như mọi hình kín), nên nửa số phép dưới đây
// canh chiều ngược lại — canh nó KHÔNG nuốt mất chữ nhật, hình thoi và tam giác.

test("hình bình hành vẽ tay → quad, bốn đỉnh đúng chỗ", () => {
  const corners = [[60, 20], [260, 20], [200, 160], [0, 160]];
  const got = recognizeShape(sample(corners, 7, 2.5, 61, true));
  assert.equal(got.kind, "quad");
  assert.equal(got.pts.length, 8, "tứ giác phải trả về BỐN đỉnh");
  for (const [x, y] of corners) assert.ok(hasVertexNear(got, x, y), `thiếu đỉnh ${x},${y}: ${JSON.stringify(got.pts)}`);
});

test("hình thang vẽ tay → quad, hai cạnh đáy dài ngắn khác nhau được giữ", () => {
  const corners = [[100, 20], [220, 20], [300, 170], [20, 170]];
  const got = recognizeShape(sample(corners, 7, 2.5, 67, true));
  assert.equal(got.kind, "quad");
  for (const [x, y] of corners) assert.ok(hasVertexNear(got, x, y), `thiếu đỉnh ${x},${y}: ${JSON.stringify(got.pts)}`);
});

test("hình vuông XOAY 45° không ra quad méo — nó là hình thoi", () => {
  const corners = [[150, 10], [290, 150], [150, 290], [10, 150]];
  assert.equal(recognizeShape(sample(corners, 8, 2.5, 71, true)).kind, "diamond");
});

test("chữ nhật vẽ tay KHÔNG bị tứ giác cướp mất (bám bốn góc run tay)", () => {
  // Đây là phép canh quan trọng nhất của cả nhóm: tứ giác luôn khớp bằng hoặc
  // hơn chữ nhật, nên thiếu chốt nhường-hình-đơn-giản thì mọi chữ nhật vẽ tay
  // đều ra "tứ giác hơi méo" và tính năng bắt hình thành vô nghĩa.
  const corners = [[0, 0], [300, 6], [298, 106], [-4, 100]];
  assert.equal(recognizeShape(sample(corners, 8, 2.5, 17, true)).kind, "rect");
});

test("tam giác không bị tứ giác cướp mất (đỉnh thừa nằm ngay trên cạnh)", () => {
  const corners = [[100, 10], [200, 160], [4, 155]];
  assert.equal(recognizeShape(sample(corners, 7, 2.5, 23, true)).kind, "triangle");
});

test("hình thoi vẽ tay → diamond", () => {
  const pts = sample([[110, 10], [210, 105], [105, 200], [8, 100]], 7, 2.5, 31, true);
  assert.equal(recognizeShape(pts).kind, "diamond");
});

test("nét ngoáy lung tung → null, không bắt hình oan", () => {
  const pts = sample([[0, 0], [80, 120], [20, 40], [140, 90], [30, 130], [120, 10]], 6, 2, 37, false);
  assert.equal(recognizeShape(pts), null);
});

test("nét quá ngắn → null (một vệt 10 đơn vị thì hình gì cũng khớp)", () => {
  assert.equal(recognizeShape([0, 0, 2, 1, 4, 2, 6, 3, 8, 4, 10, 5]), null);
});

test("nét quá ít điểm → null", () => {
  assert.equal(recognizeShape([0, 0, 100, 100]), null);
});

test("dữ liệu rác không làm hàm nổ", () => {
  assert.equal(recognizeShape(null), null);
  assert.equal(recognizeShape(undefined), null);
  assert.equal(recognizeShape([]), null);
});

test("nét đi rồi về trên cùng một đường → null, không thành hình dẹt", () => {
  const pts = sample([[0, 0], [200, 4], [2, 2]], 6, 2, 41, false);
  assert.equal(recognizeShape(pts), null);
});

test("các mốc thời gian/khoảng chờ là số dương hợp lý", () => {
  assert.ok(SNAP_HOLD_MS >= 600 && SNAP_HOLD_MS <= 2500);
  assert.ok(SNAP_MOVE_TOL > 0 && SNAP_MOVE_TOL < 30);
});

// ── snapShape: phương án cuối khi không nhận ra hình nào ──────────────────
//
// recognizeShape trả lời "nét này GIỐNG hình gì", snapShape trả lời "giữ tay
// xong thì RA cái gì". Hai câu hỏi khác nhau, nên hai hàm — và mọi bài ở trên
// vẫn hỏi recognizeShape để giữ nguyên ý nghĩa của chúng.

test("snapShape: nét định vẽ thẳng nhưng GÃY ở giữa → đoạn thẳng đúng hai đầu", () => {
  // Đây là trường hợp hay gặp nhất và là lý do phương án cuối tồn tại: nét gãy
  // trượt phép đo đường thẳng (đỉnh vọt quá ngưỡng) rồi cũng trượt mọi hình kín
  // (hai đầu cách xa nhau), nên trước đây giữ tay không ra gì cả.
  const kinked = sample([[0, 0], [200, 40], [340, 0]], 4, 1, 21, false);
  assert.equal(recognizeShape(kinked), null, "phép nhận hình vẫn phải thành thật: đây không phải hình nào");
  const snapped = snapShape(kinked);
  assert.equal(snapped?.kind, "line");
  // Hai đầu phải là hai đầu ĐÃ VẼ, không bị nắn đi đâu khác.
  assert.ok(Math.hypot(snapped.pts[0] - kinked[0], snapped.pts[1] - kinked[1]) <= 3, "điểm A phải giữ nguyên");
  const [ex, ey] = [kinked[kinked.length - 2], kinked[kinked.length - 1]];
  assert.ok(Math.hypot(snapped.pts[2] - ex, snapped.pts[3] - ey) <= 3, "điểm B phải giữ nguyên");
});

// ĐÁNH ĐỔI CÓ CHỦ Ý, chốt lại bằng test để không ai lặng lẽ "sửa" nó: một cung
// cong HỞ mà giữ tay thì bị nắn thẳng. Với máy thì cung cong và nét gãy chỉ
// khác nhau ở mức độ, không có cách nào vừa cứu cái sau vừa tha cái trước.
test("snapShape: cung cong hở cũng bị nắn thẳng — cái giá của phương án cuối", () => {
  const arc = [];
  for (let i = 0; i <= 60; i++) arc.push((i / 60) * 340, 4 * 28 * (i / 60) * (1 - i / 60));
  assert.notEqual(recognizeShape(arc)?.kind, "line", "phép nhận hình vẫn KHÔNG gọi nó là đường thẳng");
  assert.equal(snapShape(arc)?.kind, "line", "nhưng cử chỉ giữ tay thì nắn nó thẳng");
});

test("snapShape: hình nhận ra được thì KHÔNG bị hạ xuống đường thẳng", () => {
  const rect = sample([[0, 0], [200, 0], [200, 120], [0, 120]], 7, 2, 13, true);
  assert.equal(snapShape(rect)?.kind, recognizeShape(rect)?.kind);
  assert.equal(snapShape(rect)?.kind, "rect");
  const oval = ovalPts(100, 100, 90, 60, 2, 5);
  assert.equal(snapShape(oval)?.kind, "ellipse");
});

// Nét KÍN mà không giống hình nào: hai đầu chập nhau nên "đoạn thẳng nối hai
// đầu" chỉ là một mẩu cụt chẳng liên quan gì tới thứ đã vẽ. Thà không làm gì.
test("snapShape: nét kín không ra hình thì trả null, không đẻ ra đoạn cụt", () => {
  // Bảy cánh, biên độ sâu: đủ nhiều góc và đủ méo để không hình mẫu nào khớp
  // nổi. (Sao năm cánh biên nông thì lại ra hình thoi — bốn cú ngoặt gấp nhất
  // của nó nằm khá đúng bốn đỉnh một hình thoi, và đó là câu trả lời hợp lý.)
  const star = [];
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r = 100 + 70 * Math.cos(a * 7);
    star.push(200 + r * Math.cos(a), 200 + r * Math.sin(a));
  }
  assert.equal(recognizeShape(star), null, "hình lởm chởm không giống hình mẫu nào");
  assert.equal(snapShape(star), null, "và cũng không được biến thành một đoạn thẳng");
});

test("snapShape: nét quá ngắn vẫn trả null", () => {
  const tiny = sample([[0, 0], [8, 3]], 1, 0.2, 4, false);
  assert.equal(snapShape(tiny), null);
});

// Phương án cuối phải đi qua ĐÚNG phép dọn nét của recognizeShape, không được
// tự đọc thẳng raw[0] và raw[cuối]: cả cử chỉ này chạy bằng cách giữ tay hơn một
// giây, nên nét đưa vào bao giờ cũng có một chùm mấy chục điểm rung tay ở cuối.
//
// Sai số cho phép là BÁN KÍNH CHÙM (diag * HOLD_TOL, chừng 7 ở nét này), không
// phải 0: trimHold cắt lùi về điểm đầu tiên của chùm, nên điểm B nằm đâu đó
// trong chùm là đúng thiết kế. Cái phải chặn là B trôi đi HẲN theo cả chùm.
test("snapShape: chùm điểm lúc giữ tay không kéo lệch điểm B", () => {
  const j = jitter(77);
  const kinked = sample([[0, 0], [200, 40], [340, 0]], 4, 1, 21, false);
  const [ex, ey] = [kinked[kinked.length - 2], kinked[kinked.length - 1]];
  const held = kinked.slice();
  for (let i = 0; i < 72; i++) held.push(ex + j(3), ey + j(3));
  const a = snapShape(kinked);
  const b = snapShape(held);
  assert.equal(b?.kind, "line", "giữ tay lâu mà không còn ra đoạn thẳng nữa");
  assert.ok(Math.hypot(b.pts[2] - a.pts[2], b.pts[3] - a.pts[3]) <= 8,
    `giữ tay làm điểm B trôi: ${a.pts.slice(2)} → ${b.pts.slice(2)}`);
});

// ── Tốc độ vẽ không được đổi kết quả ──────────────────────────────────────
//
// mousemove bắn theo KHUNG HÌNH, nên số điểm của một nét là hệ quả của việc vẽ
// nhanh hay chậm chứ không phải của hình vẽ ra. Mọi phép đo trong file này phải
// độc lập với mật độ điểm — đây là lần thứ HAI cùng một lớp lỗi (lần đầu là
// pathLength cộng từng đoạn, làm đường thẳng vẽ chậm không được nhận).
//
// Lần này: polygonCorners đo cửa sổ góc bằng SỐ ĐIỂM, và một tam giác vẽ nhanh
// (10 điểm) rơi thẳng vào chốt `m < n * 4` (cần 12) → tam giác không được đưa
// vào danh sách ứng viên → trong ba hình còn lại thì CHỮ NHẬT thắng.
test("tam giác vẽ NHANH (ít điểm) vẫn ra tam giác, không ra chữ nhật", () => {
  const tri = [[150, 0], [300, 220], [0, 220]];
  for (const step of [90, 60, 40, 20, 8, 3]) {
    const pts = sample(tri, step, 1.5, 7, true);
    const got = recognizeShape(pts);
    assert.equal(got?.kind, "triangle",
      `bước ${step} (${pts.length / 2} điểm) → "${got?.kind}"`);
  }
});

test("chữ nhật, hình thoi, tứ giác cũng không đổi kết quả theo tốc độ vẽ", () => {
  const cases = [
    ["rect", [[0, 0], [220, 0], [220, 140], [0, 140]]],
    ["diamond", [[110, 0], [220, 70], [110, 140], [0, 70]]],
    ["quad", [[60, 0], [280, 0], [220, 140], [0, 140]]]     // hình bình hành
  ];
  for (const [want, corners] of cases) {
    for (const step of [70, 40, 15, 5]) {
      const pts = sample(corners, step, 1.5, 11, true);
      const got = recognizeShape(pts);
      assert.equal(got?.kind, want,
        `${want} bước ${step} (${pts.length / 2} điểm) → "${got?.kind}"`);
    }
  }
});

// Cùng một hình, vẽ nhanh và vẽ chậm, phải ra ĐÚNG CÙNG một đáp án — chốt trực
// tiếp cho bất biến "kết quả không phụ thuộc mật độ điểm", không đi qua tên hình
// cụ thể nào.
test("cùng một hình vẽ ở mọi tốc độ đều cho cùng một đáp án", () => {
  const shapes = [
    [[150, 0], [300, 220], [0, 220]],
    [[0, 0], [220, 0], [220, 140], [0, 140]],
    [[0, 0], [0, 200], [220, 200]],
    [[60, 0], [280, 0], [220, 140], [0, 140]]
  ];
  for (const corners of shapes) {
    const kinds = [80, 45, 25, 10, 4].map((step) => recognizeShape(sample(corners, step, 1.5, 3, true))?.kind);
    assert.equal(new Set(kinds).size, 1, `đổi đáp án theo tốc độ vẽ: ${JSON.stringify(kinds)}`);
  }
});

// ── snapLine: cố ý KHÔNG đoán hình ──────────────────────────────────────────
//
// Cử chỉ dựng nét gấp khúc gọi hàm này thay cho snapShape, và cả giá trị của nó
// nằm ở chỗ nó KHÔNG nhận ra hình: đang chốt dần từng cạnh của một hình mà một
// cạnh vẽ hơi vòng lại ra cái ê-líp thì mấy đỉnh đã đặt công phu bị vứt sạch.
test("snapLine trả về đoạn thẳng ngay cả khi nét rõ ràng là hình khác", () => {
  const arc = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI;
    arc.push(150 - 150 * Math.cos(a), -120 * Math.sin(a));
  }
  assert.equal(recognizeShape(arc), null, "cung cong này vốn không được nhận là hình nào");
  const got = snapLine(arc);
  assert.equal(got.kind, "line");
  // So từng số chứ không deepEqual cả mảng: Math.round(-0.0) ra -0, mà -0 khác 0
  // với deepStrictEqual (và chỉ với nó — JSON, phép so, phép vẽ đều coi như nhau).
  assert.deepEqual(got.pts.map((v) => v + 0), [0, 0, 300, 0], "hai đầu của đoạn thẳng phải là hai đầu đã vẽ");
});

test("snapLine bỏ qua nét KÍN — đoạn nối hai đầu chập nhau thì vô nghĩa", () => {
  const ring = sample([[0, 0], [200, 0], [200, 200], [0, 200]], 12, 1.5, 5, true);
  assert.equal(snapLine(ring), null);
  assert.equal(snapShape(ring)?.kind, "rect", "cùng nét đó qua snapShape thì vẫn phải ra hình");
});

// NÉT NGẮN VẼ NHANH. Số điểm của một nét là hệ quả của việc vẽ LÂU HAY MAU chứ
// không phải của hình vẽ ra (cùng bài học với pathLength và resample), nên đòi
// đủ sáu điểm cho cả phép nắn-về-đoạn-thẳng là loại đúng những nét ngắn: chúng
// chỉ kịp ba bốn nhịp mousemove, và con chuột đặt yên trên bàn lúc giữ tay thì
// không sinh thêm nhịp nào.
test("snapLine nắn được nét chỉ có bốn điểm", () => {
  const few = [0, 0, 30, -1, 61, 1, 90, 0];
  assert.equal(recognizeShape(few), null, "bốn điểm thì đúng là không đủ để ĐOÁN ra hình");
  assert.equal(snapLine(few)?.kind, "line", "nhưng hai đầu thì vẫn đọc được");
  assert.equal(snapShape(few)?.kind, "line");
});

test("nới số điểm KHÔNG nới luôn ngưỡng độ dài", () => {
  assert.equal(snapLine([0, 0, 5, 0]), null, "một vệt 5 đơn vị vẫn không đáng nắn");
  assert.equal(snapLine([0, 0]), null, "một điểm thì không có hai đầu nào cả");
});
