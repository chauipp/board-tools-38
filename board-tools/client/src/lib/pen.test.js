// game-tools/client/src/lib/pen.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PEN_COLORS, PEN_WIDTHS, PEN_DEFAULT, penVar, loadPenPrefs, savePenPrefs, dashArray } from "./pen.js";
import { SHAPE_KINDS } from "./shape.js";
import { TEXT_SIZES } from "./text-el.js";

// localStorage giả: chỉ cần getItem/setItem, không cần cả Storage API.
function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

test("PEN_DEFAULT phải nằm trong danh sách hợp lệ", () => {
  assert.ok(PEN_COLORS.includes(PEN_DEFAULT.color));
  assert.ok(PEN_WIDTHS.includes(PEN_DEFAULT.w));
  assert.ok(SHAPE_KINDS.includes(PEN_DEFAULT.kind));
  assert.equal(PEN_DEFAULT.fill, false);
  assert.ok(TEXT_SIZES.includes(PEN_DEFAULT.size));
  assert.equal(PEN_COLORS.length, 7);
  assert.deepEqual(PEN_WIDTHS, [2, 4, 8]);
});

test("penVar: token thành biến CSS", () => {
  assert.equal(penVar("pen-red"), "var(--pen-red)");
  assert.equal(penVar("pen-mono"), "var(--pen-mono)");
});

test("loadPenPrefs: chưa có khoá thì trả mặc định", () => {
  assert.deepEqual(loadPenPrefs(fakeStorage()), PEN_DEFAULT);
});

test("loadPenPrefs: JSON hỏng thì trả mặc định chứ không nổ", () => {
  assert.deepEqual(loadPenPrefs(fakeStorage({ "ideamap.pen": "{{{" })), PEN_DEFAULT);
});

// Token cũ bị bỏ khỏi bộ màu không được làm người dùng kẹt với một giá trị
// không còn vẽ ra màu gì.
test("loadPenPrefs: giá trị lạ lùi về mặc định theo từng phần", () => {
  const bothBad = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-neon", w: 999 }) });
  assert.deepEqual(loadPenPrefs(bothBad), PEN_DEFAULT);

  const onlyWidthBad = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 999 }) });
  assert.deepEqual(loadPenPrefs(onlyWidthBad), { ...PEN_DEFAULT, color: "pen-blue" });
});

// Cỡ chữ hỏng không được kéo theo màu và độ dày nét — chúng là ba lựa chọn độc
// lập nằm chung một object chỉ vì khu 4 là một khối duy nhất.
test("loadPenPrefs: cỡ chữ lạ chỉ lùi phần của nó", () => {
  for (const bad of [999, "20", null, 0]) {
    const s = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 8, size: bad }) });
    assert.deepEqual(loadPenPrefs(s), { ...PEN_DEFAULT, color: "pen-blue", w: 8 }, String(bad));
  }
});

// Một `kind` bị bỏ khỏi bảng chọn, hoặc `fill` bị ghi sai kiểu, không được làm
// mất luôn màu và độ dày người dùng đang dùng.
test("loadPenPrefs: kind lạ và fill sai kiểu chỉ lùi phần của chúng", () => {
  const s = fakeStorage({
    "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 8, kind: "star", fill: "yes" })
  });
  assert.deepEqual(loadPenPrefs(s), { color: "pen-blue", w: 8, kind: PEN_DEFAULT.kind, fill: false, size: PEN_DEFAULT.size, snap: true, scratch: true, dashed: false, erase: PEN_DEFAULT.erase, ew: PEN_DEFAULT.ew });
});

test("loadPenPrefs: prefs cũ chỉ có color/w vẫn đọc được, kind/fill lấy mặc định", () => {
  const s = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-green", w: 2 }) });
  assert.deepEqual(loadPenPrefs(s), { color: "pen-green", w: 2, kind: PEN_DEFAULT.kind, fill: false, size: PEN_DEFAULT.size, snap: true, scratch: true, dashed: false, erase: PEN_DEFAULT.erase, ew: PEN_DEFAULT.ew });
});

test("savePenPrefs rồi loadPenPrefs trả lại đúng giá trị", () => {
  const s = fakeStorage();
  savePenPrefs(s, { color: "pen-green", w: 8, kind: "ellipse", fill: true, size: 30, snap: false, scratch: false, dashed: true, erase: "part", ew: 56 });
  assert.deepEqual(loadPenPrefs(s), { color: "pen-green", w: 8, kind: "ellipse", fill: true, size: 30, snap: false, scratch: false, dashed: true, erase: "part", ew: 56 });
});

// Cục gôm có bộ nhớ RIÊNG, và `ew` cố ý không dùng chung ô với `w`: gộp lại thì
// đổi cỡ cục tẩy sẽ lặng lẽ đổi luôn độ dày cây bút.
test("loadPenPrefs: kiểu tẩy và cỡ tẩy lạ thì lùi về mặc định, không kéo theo cái khác", () => {
  const s = fakeStorage({
    "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 8, erase: "vaporize", ew: 999 })
  });
  const got = loadPenPrefs(s);
  assert.equal(got.erase, PEN_DEFAULT.erase);
  assert.equal(got.ew, PEN_DEFAULT.ew);
  assert.equal(got.color, "pen-blue");
  assert.equal(got.w, 8);
});

// Prefs lưu từ TRƯỚC khi cục gôm có hai kiểu: phải ra kiểu "cả nét" — đúng hành
// vi mà những người dùng đó đang quen — chứ không phải kiểu cắt theo độ rộng.
test("loadPenPrefs: prefs cũ không có field erase thì tẩy CẢ NÉT", () => {
  const s = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 8 }) });
  assert.equal(loadPenPrefs(s).erase, "stroke");
});

// Prefs lưu từ TRƯỚC khi có "giữ tay để bắt hình" không có field `snap`, mà mặc
// định của nó là BẬT — đọc bằng `=== true` sẽ tắt tính năng cho đúng những người
// đã dùng app lâu nhất.
test("loadPenPrefs: prefs cũ không có field snap thì snap vẫn BẬT", () => {
  const s = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 8 }) });
  assert.equal(loadPenPrefs(s).snap, true);
});

test("loadPenPrefs: chỉ đúng false mới là tắt, giá trị rác thì coi như bật", () => {
  const off = fakeStorage({ "ideamap.pen": JSON.stringify({ snap: false }) });
  assert.equal(loadPenPrefs(off).snap, false);
  const junk = fakeStorage({ "ideamap.pen": JSON.stringify({ snap: "no" }) });
  assert.equal(loadPenPrefs(junk).snap, true);
});

// Prefs lưu từ TRƯỚC khi có nét đứt không có field `dashed`, mà mặc định của nó
// là TẮT — ngược hẳn với `snap` ngay trên, nên phải có test riêng.
test("loadPenPrefs: prefs cũ không có field dashed thì là nét LIỀN", () => {
  const s = fakeStorage({ "ideamap.pen": JSON.stringify({ color: "pen-blue", w: 8 }) });
  assert.equal(loadPenPrefs(s).dashed, false);
});

test("loadPenPrefs: chỉ đúng true mới là nét đứt, giá trị rác thì là nét liền", () => {
  const on = fakeStorage({ "ideamap.pen": JSON.stringify({ dashed: true }) });
  assert.equal(loadPenPrefs(on).dashed, true);
  const junk = fakeStorage({ "ideamap.pen": JSON.stringify({ dashed: "yes" }) });
  assert.equal(loadPenPrefs(junk).dashed, false);
});

// Nhịp đứt phải tỉ lệ với độ dày nét: đây là toàn bộ lý do dashArray tồn tại
// thay vì một chuỗi cố định. Nét dày gấp bốn thì vạch và khoảng hở cũng phải
// gấp bốn, nếu không thì ở nét dày các vạch chạm nhau thành đường gần liền.
test("dashArray: nhịp đứt tỉ lệ thẳng với độ dày nét", () => {
  const [d2, g2] = dashArray(2).split(" ").map(Number);
  const [d8, g8] = dashArray(8).split(" ").map(Number);
  assert.equal(d8, d2 * 4);
  assert.equal(g8, g2 * 4);
});

// Khoảng hở phải RỘNG HƠN vạch trong con số thô, vì .ink-layer path có
// stroke-linecap: round: mỗi vạch tự dài thêm w/2 ở mỗi đầu, ăn vào khoảng hở
// đúng một lượt w. Bù xong thì mắt thấy vạch dài hơn hở — nhưng con số phải
// ngược lại. Test này canh đúng phép bù đó, thứ dễ bị "sửa cho hợp lý" nhất.
test("dashArray: con số thô có khoảng hở rộng hơn vạch, để bù đầu tròn", () => {
  for (const w of PEN_WIDTHS) {
    const [dash, gap] = dashArray(w).split(" ").map(Number);
    assert.ok(gap > dash, `w=${w}: hở ${gap} phải rộng hơn vạch ${dash}`);
    // Sau khi cộng lại phần đầu tròn (w), vạch nhìn thấy phải dài hơn hở.
    assert.ok(dash + w > gap - w, `w=${w}: vạch nhìn thấy phải dài hơn hở`);
  }
});

// Độ dày 0 hay rác không được sinh ra "0 0" — dasharray đó làm nét BIẾN MẤT
// hoàn toàn trên một số trình duyệt, chứ không phải hiện ra nét liền.
test("dashArray: độ dày rác vẫn ra nhịp dùng được, không ra 0", () => {
  for (const bad of [0, -5, undefined, null, NaN, "abc"]) {
    const [dash, gap] = dashArray(bad).split(" ").map(Number);
    assert.ok(dash > 0 && gap > 0, String(bad));
  }
});

// Hết quota hoặc chế độ riêng tư — mất lựa chọn bút không đáng làm sập app.
test("savePenPrefs: storage ném lỗi thì im lặng bỏ qua", () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.doesNotThrow(() => savePenPrefs(broken, PEN_DEFAULT));
});
