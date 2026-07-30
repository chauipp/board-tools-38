// game-tools/client/src/lib/erase.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ERASE_MODES, ERASE_STROKE, ERASE_PART, ERASE_WIDTHS,
  eraseRadius, eraseBounds, cuttableOutline, cutPolyline, cutPolylineAlong, cutPartsAlong
} from "./erase.js";

// Đường ngang từ (0,0) tới (100,0), lấy mẫu mỗi 10 đơn vị — giống một nét bút
// thật hơn là một đoạn hai điểm, nên phép cắt phải chạy đúng ở cả trong lòng một
// đoạn lẫn ngay tại một điểm mẫu.
function line(x0, x1, step = 10) {
  const out = [];
  for (let x = x0; x <= x1; x += step) out.push(x, 0);
  return out;
}

// Điểm đầu và điểm cuối của một mảnh, làm tròn — mọi phép so dưới đây chỉ quan
// tâm hai đầu, phần giữa là các điểm mẫu cũ chép nguyên.
function ends(part) {
  return [Math.round(part[0]), Math.round(part[1]),
          Math.round(part[part.length - 2]), Math.round(part[part.length - 1])];
}

test("hằng số tẩy phải nhất quán", () => {
  assert.deepEqual(ERASE_MODES, [ERASE_STROKE, ERASE_PART]);
  assert.ok(ERASE_WIDTHS.length >= 2);
  // Tăng dần: ba nút trên khu 4 xếp theo đúng thứ tự này, đảo lộn là nút "to
  // nhất" nằm giữa.
  for (let i = 1; i < ERASE_WIDTHS.length; i++) assert.ok(ERASE_WIDTHS[i] > ERASE_WIDTHS[i - 1]);
  // Bán kính là NỬA bề rộng — chỗ nào lẫn hai cái này thì cục tẩy to gấp đôi.
  assert.equal(eraseRadius(24), 12);
  assert.equal(eraseRadius(0), 0.5);
  assert.equal(eraseRadius(undefined), 0.5);
});

test("cutPolyline: không chạm thì trả null, không phải mảng", () => {
  // null ≠ []: "không đụng tới" và "xoá sạch" là hai việc khác hẳn, và chỗ gọi
  // phân biệt chúng để biết có phải ghi lại nét không.
  assert.equal(cutPolyline(line(0, 100), 50, 40, 10), null);
});

test("cutPolyline: cắt giữa nét ra đúng hai mảnh, đúng chỗ", () => {
  const parts = cutPolyline(line(0, 100), 50, 0, 10);
  assert.equal(parts.length, 2);
  assert.deepEqual(ends(parts[0]), [0, 0, 40, 0]);
  assert.deepEqual(ends(parts[1]), [60, 0, 100, 0]);
});

test("cutPolyline: cắt ở đầu nét chỉ còn một mảnh", () => {
  const parts = cutPolyline(line(0, 100), 0, 0, 15);
  assert.equal(parts.length, 1);
  assert.deepEqual(ends(parts[0]), [15, 0, 100, 0]);
});

test("cutPolyline: trùm cả nét thì trả mảng RỖNG", () => {
  assert.deepEqual(cutPolyline(line(0, 100), 50, 0, 200), []);
});

test("cutPolyline: mảnh vụn còn lại bị bỏ, không thành chấm rác", () => {
  // Vòng tròn ăn từ x=1 tới x=99, chừa lại hai mẩu dài 1 đơn vị ở hai đầu. Cả
  // hai đều dưới ngưỡng nên không mẩu nào được giữ.
  assert.deepEqual(cutPolyline(line(0, 100), 50, 0, 49), []);
});

test("cutPolyline: tiếp tuyến không chẻ đôi nét", () => {
  // Vòng tròn chạm đúng MỘT điểm của nét: không xoá được gì cả, nên chẻ nét làm
  // đôi ở đó là tạo ra hai nét từ một nét mà mắt không thấy khác gì.
  assert.equal(cutPolyline(line(0, 100), 50, 10, 10), null);
});

test("cutPolyline: nét một điểm nằm trong vòng thì mất, ngoài thì không", () => {
  assert.deepEqual(cutPolyline([50, 50], 50, 50, 10), []);
  assert.equal(cutPolyline([50, 50], 50, 90, 10), null);
});

test("cutPartsAlong: rê tay cắt ra một RÃNH, rộng đúng chặng đã rê", () => {
  const parts = cutPartsAlong([line(0, 200)], 60, 0, 140, 0, 10);
  assert.equal(parts.length, 2);
  assert.deepEqual(ends(parts[0]), [0, 0, 50, 0]);
  assert.deepEqual(ends(parts[1]), [150, 0, 200, 0]);
});

test("cutPartsAlong: rê NHANH vẫn ra rãnh liền, không thành chuỗi lỗ", () => {
  // Đây là bẫy cố hữu của cả lớp vẽ này: nhịp chuột thưa hay mau là do TỐC ĐỘ
  // TAY, nên mọi phép đo chỉ cắt tại đúng các điểm nhận được sẽ cho kết quả khác
  // nhau giữa người vẽ nhanh và người vẽ chậm. Ở đây một nhịp nhảy 200 đơn vị
  // với cục tẩy bán kính 10 — nếu không nội suy dọc đường thì ra 2 lỗ và 3 mảnh.
  const parts = cutPartsAlong([line(0, 400, 5)], 100, 0, 300, 0, 10);
  assert.equal(parts.length, 2);
  assert.deepEqual(ends(parts[0]), [0, 0, 90, 0]);
  assert.deepEqual(ends(parts[1]), [310, 0, 400, 0]);
});

test("cutPartsAlong: cắt tiếp trên mảnh đã cắt, không quay về nét gốc", () => {
  const first = cutPartsAlong([line(0, 300)], 100, 0, 100, 0, 10);
  assert.equal(first.length, 2);
  const second = cutPartsAlong(first, 200, 0, 200, 0, 10);
  // Nhát hai chỉ đụng mảnh phải; mảnh trái phải còn nguyên và ĐÚNG BẢN CŨ.
  assert.equal(second.length, 3);
  assert.deepEqual(ends(second[0]), [0, 0, 90, 0]);
  assert.deepEqual(ends(second[1]), [110, 0, 190, 0]);
  assert.deepEqual(ends(second[2]), [210, 0, 300, 0]);
});

test("cutPartsAlong: rê ngoài nét thì trả null, không phải bản sao", () => {
  const parts = [line(0, 100)];
  assert.equal(cutPartsAlong(parts, 0, 80, 100, 80, 10), null);
});

test("cutPartsAlong: rê trùm hết thì còn mảng rỗng", () => {
  assert.deepEqual(cutPartsAlong([line(0, 100)], -20, 0, 120, 0, 30), []);
});

// ── Nhát cắt là VIÊN THUỐC, không phải chuỗi vòng tròn ───────────────────────
//
// Bản đầu bổ một chuỗi nhát tròn dọc đường rê, cách nhau nửa bán kính. Nó cho
// kết quả gần đúng, nhưng đắt (86ms cho một nhịp chuột trên bảng 400 nét) và để
// lại gợn ở mép rãnh. Mấy bài dưới chốt rằng phép cắt giờ là hình học ĐÚNG.

test("cutPolylineAlong: rãnh rộng đúng bằng đường kính, không hơn không kém", () => {
  // Rê VUÔNG GÓC với nét, đi qua đúng một điểm trên nó: rãnh phải rộng đúng 2r.
  // Chuỗi vòng tròn cho ra rãnh rộng hơn ở chỗ hai vòng chồng nhau.
  const parts = cutPolylineAlong(line(0, 200, 1), 100, -50, 100, 50, 7);
  assert.equal(parts.length, 2);
  assert.equal(Math.round(parts[0][parts[0].length - 2]), 93);
  assert.equal(Math.round(parts[1][0]), 107);
});

test("cutPolylineAlong: rê CHÉO cắt đúng chỗ giao, không cắt oan", () => {
  // Đường rê đi chéo 45° và chỉ chạm nét ngang ở quãng x≈100. Hai đầu nét phải
  // còn nguyên vẹn.
  const parts = cutPolylineAlong(line(0, 200, 1), 60, -40, 140, 40, 5);
  assert.equal(parts.length, 2);
  assert.equal(Math.round(parts[0][0]), 0);
  assert.equal(Math.round(parts[1][parts[1].length - 2]), 200);
  const hole = [parts[0][parts[0].length - 2], parts[1][0]];
  assert.ok(hole[0] > 80 && hole[1] < 120, `lỗ phải quanh x=100, đo được ${hole}`);
});

test("cutPolylineAlong: rê SONG SONG dọc theo nét thì ăn hết khúc đi qua", () => {
  const parts = cutPolylineAlong(line(0, 200, 1), 50, 0, 150, 0, 6);
  assert.equal(parts.length, 2);
  assert.equal(Math.round(parts[0][parts[0].length - 2]), 44);
  assert.equal(Math.round(parts[1][0]), 156);
});

test("cutPolylineAlong: rê xa nét thì không đụng gì", () => {
  assert.equal(cutPolylineAlong(line(0, 200, 1), 0, 60, 200, 60, 20), null);
});

test("eraseBounds: hộp bao ôm trọn viên thuốc, kể cả khi rê ngược chiều", () => {
  assert.deepEqual(eraseBounds(100, 50, 20, 90, 10), { x: 10, y: 40, w: 100, h: 60 });
});

// ── Cái gì cắt được, cái gì chỉ xoá cả được ──────────────────────────────────

test("cuttableOutline: nét bút cắt bằng chính nó", () => {
  const pts = [0, 0, 10, 10, 20, 0];
  assert.equal(cuttableOutline({ kind: "pen", pts }), pts);
});

// Đây là bài quan trọng nhất của cả file: giữ-tay-để-bắt-hình biến nét bút THÀNH
// HÌNH, nên trên một cái bảng dùng thật thì phần lớn "nét" lại có kind là
// triangle / rect / ellipse. Bản đầu chỉ cắt kind "pen", nên cục tẩy theo độ
// rộng gặp gì cũng xoá cả cục — đúng thứ người dùng báo hỏng.
test("cuttableOutline: HÌNH KHỐI cắt được, theo đường bao của nó", () => {
  for (const kind of ["rect", "triangle", "diamond", "ellipse", "line", "arrow"]) {
    const outline = cuttableOutline({ kind, pts: [0, 0, 100, 60] });
    assert.ok(outline && outline.length >= 4, `${kind} phải cắt được`);
  }
  // Tứ giác dạng đỉnh thật cũng vậy.
  assert.ok(cuttableOutline({ kind: "quad", pts: [0, 0, 100, 0, 90, 60, 10, 60] }).length >= 8);
});

test("cuttableOutline: ê-líp cắt ra phải MỊN hơn mức dùng cho hit-test", () => {
  // Mảnh cắt ra nằm lại trên bảng dưới dạng nét bút thật, nên 32 cạnh (mức đủ
  // cho hit-test) sẽ hiện nguyên hình đa giác trên một cái ê-líp to.
  const outline = cuttableOutline({ kind: "ellipse", pts: [0, 0, 400, 300] });
  assert.ok(outline.length / 2 > 80, `ê-líp cắt ra chỉ có ${outline.length / 2} đỉnh, quá thô`);
});

test("cuttableOutline: chữ và hình TÔ ĐẶC chỉ xoá cả được", () => {
  assert.equal(cuttableOutline({ kind: "text", pts: [0, 0], text: "xin chào" }), null);
  // Ruột đặc không phải một đường, mà khoét một miếng khỏi vùng tô thì không
  // dạng dữ liệu nào ở đây tả được.
  assert.equal(cuttableOutline({ kind: "rect", pts: [0, 0, 100, 60], fill: true }), null);
  // Cùng cái chữ nhật đó mà chỉ viền thì cắt được.
  assert.ok(cuttableOutline({ kind: "rect", pts: [0, 0, 100, 60] }));
});

test("cắt một CHỮ NHẬT ở một cạnh thì ba cạnh kia còn nguyên", () => {
  const rect = cuttableOutline({ kind: "rect", pts: [0, 0, 100, 60] });
  // Rê ngang qua giữa cạnh TRÊN.
  const parts = cutPartsAlong([rect], 50, -20, 50, 20, 6);
  assert.equal(parts.length, 1, "cắt một chỗ trên đường bao KÍN thì phải còn đúng một mảnh hở");
  // Mảnh đó vẫn phải dài gần bằng chu vi cũ trừ đi cái rãnh.
  let len = 0;
  const p = parts[0];
  for (let i = 0; i + 3 < p.length; i += 2) len += Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
  assert.ok(len > 300 && len < 320, `chu vi còn lại phải quanh 320-12=308, đo được ${Math.round(len)}`);
});

test("cắt HAI chỗ trên một hình kín thì ra đúng hai mảnh", () => {
  const rect = cuttableOutline({ kind: "rect", pts: [0, 0, 100, 60] });
  const once = cutPartsAlong([rect], 50, -20, 50, 20, 6);      // cạnh trên
  const twice = cutPartsAlong(once, 50, 40, 50, 80, 6);        // cạnh dưới
  assert.equal(twice.length, 2);
});

test("cắt ĐÚNG CHỖ MỐI NỐI thì không nối liền hai đầu lại", () => {
  // Mối nối của chữ nhật nằm ở góc trên-trái (0,0) — đó là chỗ đường bao vừa bắt
  // đầu vừa kết thúc. Cắt ngay tại đó thì hai đầu còn lại là hai MÉP của rãnh;
  // nối chúng lại là lấp mất chính cái rãnh vừa tạo ra.
  const rect = cuttableOutline({ kind: "rect", pts: [0, 0, 100, 60] });
  const parts = cutPartsAlong([rect], 0, 0, 0, 0, 10);
  assert.equal(parts.length, 1);
  const p = parts[0];
  // Hai đầu mảnh phải nằm cách góc (0,0) đúng bán kính — tức cái rãnh còn đó.
  assert.ok(Math.hypot(p[0], p[1]) > 9, "đầu mảnh bị kéo về sát góc — rãnh đã bị lấp");
  assert.ok(Math.hypot(p[p.length - 2], p[p.length - 1]) > 9, "cuối mảnh bị kéo về sát góc");
});
