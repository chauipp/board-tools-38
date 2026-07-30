import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS } from "./glyphs.js";
import { recognizeInk, rankChar, splitChars, cloudify } from "./handwriting.js";

// ── Dựng nét viết tay giả ──────────────────────────────────────────────────

const BY_LABEL = new Map();
for (const g of GLYPHS) if (!BY_LABEL.has(g.label)) BY_LABEL.set(g.label, g.strokes);

// Chữ nào viết thấp hơn chữ hoa. Chỉ dùng cho bộ dựng mẫu này, để bài test
// hoa/thường có cái mà đo.
const SHORT = "acegimnopqrsuvwxyz";

// Viết một chuỗi thành các nét, đặt kề nhau từ trái sang.
//
// Mỗi chữ được dời về mép trái của CHÍNH NÓ trước khi đặt (`lo`), chứ không đặt
// theo hộp đơn vị 0..1 của mẫu. Chữ "i" có nét nằm giữa hộp, nên đặt theo hộp
// thì nó tự sinh ra một khe rộng nửa chiều cao ở bên trái — và bài test khoảng
// trắng sẽ đo phải cái khe bịa ấy chứ không đo cái mình định đo.
// `bend` (nếu có) được gọi trên TỪNG CHỮ, với cả mấy nét của chữ đó cùng lúc.
// Phải là cả chữ chứ không phải từng nét: méo mỗi nét một kiểu thì hai nét của
// số 4 nghiêng và xoay khác nhau, ra một thứ không bàn tay nào viết được — bài
// test khi ấy đo độ chịu đựng của bộ nhận dạng trước RÁC, không phải trước nét
// tay. Đo nhầm như thế cho ra 70% và tưởng là bộ nhận dạng yếu.
function write(text, { h = 60, gap = 12, space = 44, bend = null } = {}) {
  const out = [];
  let x = 0;
  for (const ch of text) {
    if (ch === " ") { x += space; continue; }
    const g = BY_LABEL.get(ch) || BY_LABEL.get(ch.toLowerCase());
    assert.ok(g, `không có mẫu cho ${ch}`);
    const sc = SHORT.includes(ch) ? h * 0.62 : h;
    const shaped = bend ? bend(g) : g;
    let lo = Infinity, hi = -Infinity, top = Infinity;
    for (const s of shaped) {
      for (let i = 0; i + 1 < s.length; i += 2) {
        lo = Math.min(lo, s[i]); hi = Math.max(hi, s[i]); top = Math.min(top, s[i + 1]);
      }
    }
    for (const s of shaped) {
      const o = [];
      for (let i = 0; i + 1 < s.length; i += 2) o.push(x + (s[i] - lo) * sc, (h - sc) + (s[i + 1] - top) * sc);
      out.push(o);
    }
    x += (hi - lo) * sc + gap;
  }
  return out;
}

// PRNG có hạt giống: bài đo độ chính xác phải ra cùng một con số ở mọi lần chạy,
// không thì "hôm nay 91%, mai 88%" và không ai biết là do sửa code hay do may.
function makeRandom(seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return { rnd, gauss: () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.7 };
}

// Méo một ký tự cho ra dáng nét tay: nghiêng, dẹt, xoay nhẹ, rung, và rải điểm
// dày thưa ngẫu nhiên (mô phỏng viết nhanh hay chậm).
//
// Biên độ rung tính THEO KHỔ CHỮ chứ không phải một số tuyệt đối: hàm này được
// gọi ở hai chỗ, một chỗ đưa chữ cao 100 đơn vị và một chỗ đưa chữ trong hộp
// đơn vị. Rung bằng số tuyệt đối thì cùng một tham số `level` là nhiễu 3,5% ở
// chỗ này và xoá sổ cả chữ ở chỗ kia.
function distort(strokes, level, R) {
  let lo = Infinity, hi = -Infinity, top = Infinity, bot = -Infinity;
  for (const s of strokes) {
    for (let i = 0; i + 1 < s.length; i += 2) {
      lo = Math.min(lo, s[i]); hi = Math.max(hi, s[i]);
      top = Math.min(top, s[i + 1]); bot = Math.max(bot, s[i + 1]);
    }
  }
  const size = Math.max(hi - lo, bot - top) || 1;
  const shear = R.gauss() * 0.22 * level;
  const ax = 1 + R.gauss() * 0.18 * level;
  const ay = 1 + R.gauss() * 0.18 * level;
  const rot = R.gauss() * 0.1 * level;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const jit = 0.035 * size * level;
  return strokes.map((s) => {
    const per = 1 + Math.floor(R.rnd() * 5);
    const dense = [];
    for (let i = 0; i + 3 < s.length; i += 2) {
      for (let k = 0; k < per; k++) {
        const u = k / per;
        dense.push(s[i] + (s[i + 2] - s[i]) * u, s[i + 1] + (s[i + 3] - s[i + 1]) * u);
      }
    }
    dense.push(s[s.length - 2], s[s.length - 1]);
    const out = [];
    for (let i = 0; i + 1 < dense.length; i += 2) {
      let x = dense[i] * ax, y = dense[i + 1] * ay;
      x += y * shear;
      out.push(x * cos - y * sin + R.gauss() * jit, x * sin + y * cos + R.gauss() * jit);
    }
    return out;
  });
}

function scaled(strokes, size) {
  return strokes.map((s) => s.map((v) => v * size));
}

// ── Chuẩn hoá ──────────────────────────────────────────────────────────────

test("hai người viết cùng một chữ nhanh chậm khác nhau ra cùng một đám mây", () => {
  // Cùng HÌNH, khác SỐ ĐIỂM. Đây là bài học đã ghi ở recognize.js và
  // scribble.js: số điểm là hệ quả của tốc độ viết, không của chữ viết ra.
  const thin = [[0, 0, 40, 0, 40, 90, 0, 90, 0, 0]];
  const thick = [[]];
  for (let k = 0; k <= 60; k++) {
    const u = (k / 60) * 4;
    const box = [[0, 0], [40, 0], [40, 90], [0, 90], [0, 0]];
    const i = Math.min(3, Math.floor(u));
    const f = u - i;
    thick[0].push(box[i][0] + (box[i + 1][0] - box[i][0]) * f, box[i][1] + (box[i + 1][1] - box[i][1]) * f);
  }
  const a = cloudify(thin), b = cloudify(thick);
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  assert.ok(worst < 0.06, `lệch tới ${worst.toFixed(3)} — phép chuẩn hoá còn phụ thuộc mật độ điểm`);
});

test("số 1 không bị phóng cái rung tay thành một nét ngoằn ngoèo", () => {
  // Một gạch dọc có hộp bao rộng gần bằng 0. Co ngang về đủ một đơn vị thì cái
  // rung tay chiếm trọn bề ngang và số 1 hết là số 1 — xem ASPECT_FLOOR.
  const bar = [[50, 0, 51, 20, 49, 40, 50, 60, 51, 80, 50, 100]];
  const cloud = cloudify(bar);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < cloud.length; i += 4) { lo = Math.min(lo, cloud[i]); hi = Math.max(hi, cloud[i]); }
  assert.ok(hi - lo < 0.35, `gạch dọc bị dàn rộng ra ${(hi - lo).toFixed(2)} đơn vị`);
});

test("viết ngược chiều vẫn ra cùng một chữ", () => {
  // Đây là tính chất mà cả phép $P sinh ra để có, và là lý do bộ mẫu không cần
  // một bản cho mỗi cách đưa bút.
  const z = BY_LABEL.get("z");
  const back = z.map((s) => {
    const o = [];
    for (let i = s.length - 2; i >= 0; i -= 2) o.push(s[i], s[i + 1]);
    return o;
  });
  assert.equal(rankChar(scaled(back, 80))[0].label, "z");
});

test("thứ tự viết nét không đổi kết quả", () => {
  const four = BY_LABEL.get("4");
  const swapped = [four[1], four[0]];
  assert.equal(rankChar(scaled(swapped, 80))[0].label, "4");
});

// ── Tách nét thành ký tự ───────────────────────────────────────────────────

test("nét sổ TIẾP TUYẾN với phần còn lại vẫn là cùng một chữ", () => {
  // Mép phải cái bụng chữ a chính là mép trái nét sổ, nên độ chồng đo ra đúng
  // 0. Luật gộp chỉ đo độ chồng đã tách "Max" thành M-0-1-x — xem TOUCH_FRAC.
  assert.equal(splitChars(write("a"), 60).length, 1);
  assert.equal(splitChars(write("4"), 60).length, 1);
  assert.equal(splitChars(write("B"), 60).length, 1);
  assert.equal(splitChars(write("H"), 60).length, 1);
});

test("cái chấm trên chữ i đi theo thân chữ", () => {
  const g = splitChars(write("i"), 60);
  assert.equal(g.length, 1);
  assert.equal(g[0].strokes.length, 2);
});

test("chữ viết cạnh nhau thì tách ra", () => {
  assert.equal(splitChars(write("42"), 60).length, 2);
  assert.equal(splitChars(write("2024"), 60).length, 4);
  assert.equal(splitChars(write("Hi"), 60).length, 2);
});

test("gạch ngang chữ t viết sau cả từ vẫn về đúng chữ t", () => {
  // Xếp theo MÉP TRÁI chứ không theo thứ tự đưa bút: chấm chữ i và gạch chữ t
  // thường được viết bù vào lúc đã xong cả từ.
  const [stem, bar] = write("t");
  const rest = write("o", { h: 60 }).map((s) => s.map((v, i) => (i % 2 ? v : v + 70)));
  const groups = splitChars([stem, ...rest, bar], 60);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].strokes.length, 2);
});

// ── Đọc cả cụm ─────────────────────────────────────────────────────────────

test("đọc được dãy số", () => {
  for (const s of ["42", "105", "2024", "7", "380"]) {
    assert.equal(recognizeInk(write(s))?.text, s);
  }
});

test("đọc được chữ, giữ đúng hoa thường", () => {
  for (const s of ["AB", "Hi", "Max", "Ax"]) {
    assert.equal(recognizeInk(write(s))?.text, s);
  }
});

test("cách xa nhau thì thành hai từ", () => {
  assert.equal(recognizeInk(write("80 90"))?.text, "80 90");
});

test("NGỮ CẢNH: nằm giữa dãy số thì vòng tròn là số 0, không phải chữ O", () => {
  // Vòng tròn viết tay của số 0 và của chữ O là MỘT HÌNH, không phép đo nào
  // tách được. Đa số ký tự xung quanh là thứ duy nhất trả lời được.
  assert.equal(recognizeInk(write("105"))?.text, "105");
  assert.equal(recognizeInk(write("1O"))?.text, "10");
});

test("NGỮ CẢNH: nằm giữa chữ thì gạch dọc là chữ l, không phải số 1", () => {
  const r = recognizeInk(write("Al"));
  assert.equal(r?.text, "Al");
});

test("một chữ cái đứng lẻ thì đọc thành CHỮ HOA", () => {
  // Viết mỗi một chữ cái lên bảng gần như bao giờ cũng là để đặt tên một thứ gì
  // đó (điểm A, nhóm C), nên chữ hoa mới là thứ mong đợi.
  assert.equal(recognizeInk(write("c"))?.text, "C");
});

// ── Van an toàn ────────────────────────────────────────────────────────────

test("thứ KHÔNG PHẢI chữ thì trả về null, không đoán bừa", () => {
  // Cử chỉ này THAY nét viết tay bằng chữ máy, nên đoán sai là mất việc của
  // người ta. Bảy hình dưới đây là bộ đối chứng đã dùng để chọn MAX_DIST.
  const zig = []; for (let k = 0; k <= 14; k++) zig.push(k * 12, k % 2 ? 80 : 10);
  const spiral = []; for (let k = 0; k <= 22; k++) { const a = k / 2.2, r = 6 + k * 3.4; spiral.push(50 + r * Math.cos(a), 50 + r * Math.sin(a)); }
  const star = []; for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + (2 * Math.PI * 2 * k) / 5; star.push(50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)); }
  const mess = []; for (let k = 0; k <= 30; k++) mess.push(50 + 45 * Math.sin(k * 1.7), 50 + 45 * Math.sin(k * 0.9));
  const cases = {
    "ngoằn ngoèo": [zig],
    "vòng xoắn": [spiral],
    "ngôi sao": [star],
    "nguệch ngoạc": [mess],
    "mũi tên": [[0, 50, 100, 50], [70, 25, 100, 50, 70, 75]],
    "tam giác": [[50, 0, 0, 95, 100, 95, 50, 0]],
    "hai gạch chéo": [[0, 0, 100, 100], [0, 100, 100, 0], [50, 0, 50, 100], [0, 50, 100, 50]]
  };
  for (const [name, strokes] of Object.entries(cases)) {
    const r = recognizeInk(strokes);
    assert.equal(r, null, `${name} bị đọc thành "${r?.text}" (d=${r?.dist.toFixed(2)})`);
  }
});

test("nét quá ngắn hoặc rỗng thì không đoán", () => {
  assert.equal(recognizeInk([]), null);
  assert.equal(recognizeInk(null), null);
  assert.equal(recognizeInk([[0, 0]]), null);
});

// ── Độ chính xác thật ──────────────────────────────────────────────────────

test("ĐỘ CHÍNH XÁC dưới nét tay bị méo", () => {
  // Con số này là thứ nói lên tính năng có dùng được không, nên nó được ghim
  // lại ở đây chứ không nằm trong một ghi chú nào.
  //
  // ĐỌC CON SỐ CHO ĐÚNG: mẫu đem thử là chính bộ mẫu bị méo đi, nên đây là
  // "nhận ra được bản méo của chữ mình đã biết" — DỄ HƠN chữ của một người
  // thật, người có nét chữ riêng chứ không phải bản méo của mẫu nào cả. Coi nó
  // là TRẦN TRÊN, không phải là độ chính xác sẽ gặp.
  //
  // Giá trị của bài này nằm ở chỗ khác: nó bắt được REGRESSION. Sửa phép chuẩn
  // hoá hay bộ mẫu mà con số tụt là biết ngay.
  const R = makeRandom(20260730);
  for (const [level, floor] of [[0.5, 0.93], [1.0, 0.9], [1.5, 0.85]]) {
    let ok = 0, tot = 0;
    for (const g of GLYPHS) {
      for (let k = 0; k < 8; k++) {
        const r = rankChar(distort(scaled(g.strokes, 100), level, R));
        tot++;
        // Chữ l và số 1, chữ o và số 0 là MỘT HÌNH — bộ mẫu của chúng giống hệt
        // nhau tới từng điểm. Tính chúng là sai ở đây thì con số đo được là con
        // số của một bài toán không ai giải được, chứ không phải của bài toán
        // này; việc phân biệt chúng thuộc về phép chọn theo ngữ cảnh.
        const same = { l: "1", "1": "l", o: "0", "0": "o" }[g.label];
        if (r.length && (r[0].label === g.label || r[0].label === same)) ok++;
      }
    }
    const rate = ok / tot;
    assert.ok(rate >= floor,
      `méo ${level}: chỉ đúng ${(rate * 100).toFixed(1)}%, dưới mức đã ghim ${(floor * 100).toFixed(0)}%`);
  }
});

test("đọc được dãy số viết bằng nét méo", () => {
  // Bài trên đo từng ký tự rời; bài này đo cả đường đi thật — tách nét, ép theo
  // ngữ cảnh, ghép chuỗi — trên nét đã méo.
  const R = makeRandom(777);
  let ok = 0;
  const want = ["42", "105", "2024", "380", "7"];
  const miss = [];
  for (const s of want) {
    for (let k = 0; k < 6; k++) {
      const got = recognizeInk(write(s, { bend: (g) => distort(g, 0.8, R) }))?.text;
      if (got === s) ok++;
      else miss.push(`${s}→${got ?? "null"}`);
    }
  }
  const rate = ok / (want.length * 6);
  assert.ok(rate >= 0.85,
    `chỉ đọc đúng ${(rate * 100).toFixed(0)}% dãy số — hỏng ở: ${miss.join(" ")}`);
});
