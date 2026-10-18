import { test } from "node:test";
import assert from "node:assert/strict";
import { snapPolygon, CLOSE_STICK_PX, CLOSE_UNSTICK_PX } from "./polygon-snap.js";

// Góc của từng cạnh (độ) và chiều dài từng cạnh, theo thứ tự đi vòng quanh.
function angles(pts) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    out.push((Math.atan2(pts[j * 2 + 1] - pts[i * 2 + 1], pts[j * 2] - pts[i * 2]) * 180) / Math.PI);
  }
  return out;
}
function lengths(pts) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    out.push(Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]));
  }
  return out;
}
// Lệch góc giữa hai cạnh, quy về [0, 90]: cạnh đối chạy ngược chiều nhau.
function gap(a, b) {
  const d = Math.abs(a - b) % 180;
  return d > 90 ? 180 - d : d;
}
// Xoay một danh sách đỉnh quanh gốc, để kiểm cùng một hình ở nhiều hướng.
function rotate(pts, deg) {
  const t = (deg * Math.PI) / 180;
  const out = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    out.push(Math.round(pts[i] * Math.cos(t) - pts[i + 1] * Math.sin(t)),
      Math.round(pts[i] * Math.sin(t) + pts[i + 1] * Math.cos(t)));
  }
  return out;
}

// ── Số đỉnh quyết định có kind nào không ────────────────────────────────────

test("ba đỉnh → tam giác, giữ nguyên dáng đã vẽ", () => {
  const got = snapPolygon([0, 0, 200, 10, 90, 150]);
  assert.equal(got.kind, "triangle");
  assert.deepEqual(got.pts, [0, 0, 200, 10, 90, 150]);
});

// Không có kind nào cho đa giác 5 đỉnh (xem VERTEX_NUMBERS bên shape.js), và
// null ở đây là cách nói điều đó — chỗ gọi giữ nguyên nét gấp khúc.
test("từ năm đỉnh trở lên: không kind nào tả được, trả null", () => {
  assert.equal(snapPolygon([0, 0, 100, 0, 130, 80, 50, 130, -30, 80]), null);
  assert.equal(snapPolygon(new Array(12).fill(0)), null);
});

test("dưới ba đỉnh cũng không phải hình", () => {
  assert.equal(snapPolygon([0, 0, 100, 0]), null);
  assert.equal(snapPolygon([0, 0]), null);
  assert.equal(snapPolygon([]), null);
});

test("đầu vào rác không làm nổ", () => {
  assert.doesNotThrow(() => snapPolygon(null));
  assert.doesNotThrow(() => snapPolygon(undefined));
  assert.equal(snapPolygon(null), null);
  assert.equal(snapPolygon("0,0,1,1"), null);
});

// ── Chữ nhật và hình vuông ──────────────────────────────────────────────────

test("bốn cạnh gần thẳng trục → kind \"rect\" (dạng hộp bao)", () => {
  const got = snapPolygon([0, 0, 300, 4, 297, 200, -2, 197]);
  assert.equal(got.kind, "rect");
  assert.equal(got.pts.length, 4);
});

// Cạnh đầu tiên DỰNG ĐỨNG. Phép đo "thẳng trục" phải so với trục GẦN NHẤT, không
// so với trục ngang: đo nhầm thì một cạnh dựng đứng ra 90 độ và bị đọc là nghiêng
// hết cỡ, nên vẽ chữ nhật bắt đầu từ cạnh dọc sẽ không bao giờ ra "rect".
test("vẽ từ cạnh DỌC trước vẫn ra \"rect\"", () => {
  const got = snapPolygon([0, 0, 3, 200, 202, 197, 199, -2]);
  assert.equal(got.kind, "rect");
});

test("bốn cạnh xấp xỉ bằng nhau → hộp vuông chằn chặn", () => {
  const got = snapPolygon([0, 0, 200, 3, 204, 198, 2, 201]);
  assert.equal(got.kind, "rect");
  const w = Math.abs(got.pts[2] - got.pts[0]);
  const h = Math.abs(got.pts[3] - got.pts[1]);
  assert.ok(Math.abs(w - h) <= 1, `hai cạnh phải bằng nhau, đang là ${w}×${h}`);
});

// Xoay 30 độ thì không còn lưu bằng hộp bao được nữa, nhưng bốn GÓC vẫn phải
// vuông và hai cạnh đối vẫn phải bằng nhau — đó mới là "chữ nhật".
test("chữ nhật xoay: ra \"quad\" nhưng bốn góc vuông, cạnh đối bằng nhau", () => {
  const got = snapPolygon(rotate([-150, -80, 150, -80, 150, 80, -150, 80], 30));
  assert.equal(got.kind, "quad");
  const a = angles(got.pts);
  const l = lengths(got.pts);
  assert.ok(Math.abs(gap(a[0], a[1]) - 90) < 1.5, `góc kề phải vuông, đang lệch ${gap(a[0], a[1]).toFixed(2)}°`);
  assert.ok(Math.abs(l[0] - l[2]) < 2, `hai cạnh đối phải bằng nhau: ${l[0].toFixed(1)} và ${l[2].toFixed(1)}`);
  assert.ok(Math.abs(l[1] - l[3]) < 2, `hai cạnh đối phải bằng nhau: ${l[1].toFixed(1)} và ${l[3].toFixed(1)}`);
});

// ── Hình thoi ───────────────────────────────────────────────────────────────

test("hình thoi có hai đường chéo thẳng trục → kind \"diamond\"", () => {
  const got = snapPolygon([100, 2, 201, 80, 99, 161, 1, 79]);
  assert.equal(got.kind, "diamond");
  assert.equal(got.pts.length, 4);
});

test("hình thoi xoay: ra \"quad\" nhưng bốn cạnh bằng nhau", () => {
  const l = lengths(snapPolygon([0, 0, 100, 40, 60, 140, -40, 100]).pts);
  assert.ok(Math.max(...l) - Math.min(...l) < 2, "bốn cạnh phải bằng nhau: " + l.map((v) => v.toFixed(1)));
});

// ── Hình bình hành ──────────────────────────────────────────────────────────

test("hình bình hành: hai cặp cạnh đối được ép song song HẲN", () => {
  const got = snapPolygon([0, 0, 100, 3, 132, 80, 29, 79]);
  assert.equal(got.kind, "quad");
  const a = angles(got.pts);
  assert.ok(gap(a[0], a[2]) < 1.5, `cặp cạnh thứ nhất lệch ${gap(a[0], a[2]).toFixed(2)}°`);
  assert.ok(gap(a[1], a[3]) < 1.5, `cặp cạnh thứ hai lệch ${gap(a[1], a[3]).toFixed(2)}°`);
});

// ── Hình thang, và cái bẫy mà nó giăng ra ───────────────────────────────────

// ĐÂY LÀ PHÉP KIỂM QUAN TRỌNG NHẤT CỦA FILE.
//
// Hình thang cân này có bản dựng hình-bình-hành-gần-nhất là một CHỮ NHẬT, và sai
// số của bản dựng đó chỉ là 3,5% đường chéo. Nên nếu cửa chặn "có phải hình bình
// hành không" đo bằng SAI SỐ VỊ TRÍ thay vì bằng GÓC, hình thang này bị nuốt
// thành chữ nhật — hai cạnh xiên bị dựng đứng lên và thứ người dùng vẽ ra biến
// mất. Đo bằng góc thì cặp cạnh xiên lệch nhau 14 độ và không cửa nào cho qua.
test("hình thang KHÔNG bị hạ xuống thành chữ nhật", () => {
  const got = snapPolygon([0, 0, 100, 0, 130, 80, -30, 80]);
  assert.equal(got.kind, "quad");
  const a = angles(got.pts);
  assert.ok(gap(a[1], a[3]) > 10, `hai cạnh xiên phải còn xiên khác nhau, đang lệch ${gap(a[1], a[3]).toFixed(1)}°`);
  // Và chúng vẫn phải XIÊN chứ không dựng đứng.
  assert.ok(gap(a[1], 90) > 5, "cạnh xiên bị dựng thẳng đứng — hình thang đã bị nắn thành chữ nhật");
});

test("hình thang: ĐÚNG cặp cạnh gần song song được ép song song, cặp kia để yên", () => {
  const got = snapPolygon([0, 0, 100, 6, 136, 80, -30, 74]);
  const a = angles(got.pts);
  assert.ok(gap(a[0], a[2]) < 1.5, `cặp đáy phải song song hẳn, đang lệch ${gap(a[0], a[2]).toFixed(2)}°`);
  assert.ok(gap(a[1], a[3]) > 10, "cặp cạnh bên bị ép song song theo — nó là thứ làm nên hình thang");
});

// ── Không nhận ra thì giữ nguyên ────────────────────────────────────────────

test("tứ giác bất kỳ: đổi kind nhưng KHÔNG đụng vào đỉnh nào", () => {
  const raw = [0, 0, 120, 30, 90, 140, -40, 80];
  const got = snapPolygon(raw);
  assert.equal(got.kind, "quad");
  assert.deepEqual(got.pts, raw);
});

// Nắn một hình có cạnh dài 1 đơn vị chỉ ra kết quả ngẫu nhiên — thà để nguyên.
test("tứ giác suy biến: trả về đúng như đã vẽ, không nắn", () => {
  const raw = [0, 0, 1, 0, 1, 1, 0, 1];
  assert.deepEqual(snapPolygon(raw).pts, raw);
});

test("thừa toạ độ ở cuối bị bỏ, không làm lệch phép đếm đỉnh", () => {
  assert.equal(snapPolygon([0, 0, 200, 10, 90, 150, 7]).kind, "triangle");
});

// ── Bán kính dính ───────────────────────────────────────────────────────────

// Hai ngưỡng BẰNG nhau là bàn tay đậu đúng ở mép vòng sẽ dính/nhả liên tục theo
// từng cái rung, và mỗi lần nhả là bộ đếm khép hình chết rồi lên nòng lại — giữ
// mãi cũng không khép được. Chốt luôn quan hệ giữa hai con số ở đây để không ai
// vô tình chỉnh chúng về bằng nhau.
test("ngưỡng nhả phải RỘNG HƠN ngưỡng dính, để cử chỉ có vùng đệm", () => {
  assert.ok(CLOSE_STICK_PX > 0);
  assert.ok(CLOSE_UNSTICK_PX > CLOSE_STICK_PX,
    `nhả ${CLOSE_UNSTICK_PX}px phải rộng hơn dính ${CLOSE_STICK_PX}px`);
});
