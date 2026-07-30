// BỘ MẪU CHỮ VIẾT TAY: chữ số 0–9 và chữ Latin không dấu.
//
// Mỗi mẫu là một hoặc vài NÉT, toạ độ trong hộp đơn vị x∈[0,1], y∈[0,1] với y
// hướng XUỐNG (đúng chiều toạ độ canvas). Hộp là hộp bao của chính chữ đó, không
// phải một khung dòng kẻ chung: bên handwriting.js mỗi ký tự viết ra cũng được
// chuẩn hoá về hộp bao của chính nó trước khi đem so, nên hai bên cùng một thang.
//
// ── VÌ SAO KHÔNG CẦN MẪU CHO TỪNG THỨ TỰ NÉT ──
// Phép so là $P (point-cloud matching): mỗi ký tự bị rã thành một ĐÁM MÂY ĐIỂM,
// và phép khớp đi tìm cặp điểm gần nhau nhất chứ không đọc theo thứ tự. Nhờ vậy
// viết chữ "4" bằng cách kẻ nét dọc trước hay nét ngang trước đều ra cùng một
// đám mây, và viết ngược chiều cũng thế. Nên ở đây chỉ cần một mẫu cho mỗi HÌNH
// DÁNG, không phải cho mỗi cách đưa bút.
//
// Hệ quả: chỗ duy nhất đáng chép ra thành nhiều mẫu là khi cùng một chữ có hai
// dáng THẬT SỰ khác nhau — số 1 có chân cờ hay không, số 7 có gạch ngang hay
// không, số 4 hở hay kín đỉnh.
//
// ── VÌ SAO CÓ CỜ `caseless` ──
// Chữ C và c chỉ khác nhau ở CỠ, không khác hình. Cho chúng hai mẫu riêng thì
// hai mẫu ấy giống nhau tới mức phép so chọn bừa một cái — tức là tự tay biến
// một câu hỏi trả lời được (bằng chiều cao so với các chữ bên cạnh) thành một
// câu hỏi bốc thăm. Nên chúng dùng CHUNG một mẫu, và việc hoa hay thường để
// handwriting.js quyết bằng chiều cao tương đối trong cả cụm.
//
// ── ĐÃ BIẾT LÀ KHÔNG PHÂN BIỆT ĐƯỢC ──
// Có những cặp mà chữ viết tay vốn không phân biệt: 0/O, 1/I/l, 2/Z, 5/S, 6/G,
// 9/g/q. Không mẫu nào chữa được vì chúng ĐÚNG LÀ cùng một hình. Cách duy nhất
// là ngữ cảnh — xem phần chọn theo đa số chữ số/chữ cái bên handwriting.js.

// Cung tròn/ê-líp, góc tính bằng ĐỘ, 0° hướng sang phải và góc tăng đi XUỐNG
// (vì trục y hướng xuống). Viết mấy chữ tròn bằng tay thì lệch tâm ngay, mà
// lệch tâm là thứ phép so bắt được — nên chỗ nào là cung thật thì dựng bằng
// công thức, đừng gõ toạ độ bằng mắt.
function arc(cx, cy, rx, ry, a0, a1, n = 14) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = ((a0 + (a1 - a0) * (k / n)) * Math.PI) / 180;
    out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  return out;
}

// Vòng kín (số 0, chữ O/o).
const RING = arc(0.5, 0.5, 0.48, 0.5, -90, 270, 20);

// Dáng chữ C: vòng hở về bên phải, từ trên-phải vòng qua trái xuống dưới-phải.
const CURVE_C = arc(0.56, 0.5, 0.44, 0.5, -55, -305, 16);

// ── CHỮ SỐ ─────────────────────────────────────────────────────────────────
// Nhiều dáng cho một chữ số là chuyện thường và phải chấp nhận: số 1 viết trần
// một gạch dọc, số 1 có chân cờ, và số 1 kiểu châu Âu có cả chân đế là ba thứ
// khác hẳn nhau trên giấy.
const DIGITS = [
  { label: "0", strokes: [RING] },
  { label: "1", strokes: [[0.5, 0, 0.5, 1]] },
  { label: "1", strokes: [[0.16, 0.22, 0.5, 0, 0.5, 1]] },
  { label: "1", strokes: [[0.2, 0.22, 0.52, 0, 0.52, 1], [0.14, 1, 0.9, 1]] },
  {
    label: "2",
    strokes: [arc(0.48, 0.28, 0.43, 0.28, 180, 360, 10)
      .concat([0.85, 0.45, 0.6, 0.66, 0.3, 0.86, 0.08, 0.97, 0.95, 0.97])]
  },
  {
    label: "3",
    strokes: [[0.08, 0.12, 0.3, 0, 0.62, 0.02, 0.76, 0.18, 0.62, 0.4,
      0.4, 0.47, 0.64, 0.53, 0.8, 0.7, 0.72, 0.92, 0.42, 1, 0.1, 0.9]]
  },
  { label: "4", strokes: [[0.7, 0.02, 0.06, 0.68, 0.96, 0.68], [0.7, 0.02, 0.7, 1]] },
  { label: "4", strokes: [[0.72, 0.05, 0.06, 0.7, 0.72, 0.7], [0.72, 0.05, 0.72, 1]] },
  {
    label: "5",
    strokes: [[0.85, 0.03, 0.24, 0.03, 0.16, 0.42, 0.45, 0.34,
      0.75, 0.45, 0.83, 0.7, 0.68, 0.93, 0.38, 1, 0.1, 0.9]]
  },
  {
    label: "6",
    strokes: [[0.78, 0.06, 0.5, 0, 0.26, 0.16, 0.13, 0.45, 0.12, 0.72,
      0.28, 0.95, 0.56, 0.98, 0.76, 0.82, 0.74, 0.58, 0.52, 0.46, 0.28, 0.52, 0.14, 0.68]]
  },
  { label: "7", strokes: [[0.08, 0.05, 0.92, 0.05, 0.36, 1]] },
  { label: "7", strokes: [[0.08, 0.05, 0.92, 0.05, 0.36, 1], [0.22, 0.52, 0.68, 0.52]] },
  {
    label: "8",
    strokes: [[0.5, 0.02, 0.26, 0.14, 0.28, 0.36, 0.5, 0.48, 0.74, 0.62,
      0.74, 0.86, 0.5, 0.98, 0.26, 0.86, 0.26, 0.62, 0.5, 0.48,
      0.72, 0.36, 0.74, 0.14, 0.5, 0.02]]
  },
  {
    label: "9",
    strokes: [[0.78, 0.42, 0.6, 0.55, 0.35, 0.52, 0.18, 0.34, 0.24, 0.12,
      0.5, 0.02, 0.72, 0.1, 0.8, 0.3, 0.8, 0.56, 0.72, 0.82, 0.5, 0.97, 0.24, 1]]
  }
];

// ── CHỮ HOA ────────────────────────────────────────────────────────────────
// Chỉ những chữ mà dáng hoa KHÁC dáng thường. Số còn lại nằm ở CASELESS.
const UPPER = [
  { label: "A", strokes: [[0.5, 0, 0.06, 1], [0.5, 0, 0.94, 1], [0.22, 0.66, 0.78, 0.66]] },
  {
    label: "B",
    strokes: [[0.12, 0, 0.12, 1],
      [0.12, 0, 0.62, 0.04, 0.76, 0.22, 0.6, 0.45, 0.12, 0.48],
      [0.12, 0.48, 0.68, 0.52, 0.84, 0.74, 0.66, 0.96, 0.12, 1]]
  },
  { label: "D", strokes: [[0.12, 0, 0.12, 1], [0.12, 0, 0.6, 0.06, 0.86, 0.35, 0.86, 0.65, 0.6, 0.94, 0.12, 1]] },
  { label: "E", strokes: [[0.9, 0, 0.12, 0, 0.12, 1, 0.9, 1], [0.12, 0.5, 0.72, 0.5]] },
  { label: "F", strokes: [[0.9, 0, 0.12, 0, 0.12, 1], [0.12, 0.48, 0.72, 0.48]] },
  { label: "G", strokes: [CURVE_C, [0.86, 0.86, 0.9, 0.55, 0.56, 0.55]] },
  { label: "H", strokes: [[0.1, 0, 0.1, 1], [0.9, 0, 0.9, 1], [0.1, 0.5, 0.9, 0.5]] },
  { label: "I", strokes: [[0.2, 0.02, 0.8, 0.02], [0.5, 0.02, 0.5, 0.98], [0.2, 0.98, 0.8, 0.98]] },
  { label: "J", strokes: [[0.76, 0, 0.76, 0.74, 0.58, 0.97, 0.3, 0.98, 0.14, 0.78]] },
  { label: "L", strokes: [[0.14, 0, 0.14, 1, 0.92, 1]] },
  { label: "M", strokes: [[0.08, 1, 0.08, 0, 0.5, 0.62, 0.92, 0, 0.92, 1]] },
  { label: "N", strokes: [[0.1, 1, 0.1, 0, 0.9, 1, 0.9, 0]] },
  { label: "Q", strokes: [RING, [0.62, 0.7, 0.98, 1]] },
  {
    label: "R",
    strokes: [[0.12, 0, 0.12, 1],
      [0.12, 0, 0.66, 0.05, 0.8, 0.26, 0.62, 0.48, 0.12, 0.5],
      [0.4, 0.5, 0.9, 1]]
  },
  { label: "T", strokes: [[0.05, 0.03, 0.95, 0.03], [0.5, 0.03, 0.5, 1]] }
];

// ── CHỮ THƯỜNG ─────────────────────────────────────────────────────────────
// Dáng viết tay thông dụng, không phải dáng chữ in: chữ "a" ở đây là kiểu một
// tầng (vòng tròn + nét sổ), vì đó là thứ hầu như ai cũng viết bằng tay — chữ
// "a" hai tầng của nhà in thì gần như không ai kẻ tay bao giờ.
const LOWER = [
  { label: "a", strokes: [arc(0.42, 0.6, 0.36, 0.4, -90, 270, 14), [0.78, 0.2, 0.78, 1]] },
  { label: "b", strokes: [[0.15, 0, 0.15, 1], [0.15, 0.42, 0.5, 0.3, 0.8, 0.5, 0.78, 0.82, 0.5, 1, 0.15, 0.95]] },
  { label: "d", strokes: [[0.85, 0, 0.85, 1], [0.85, 0.42, 0.5, 0.3, 0.2, 0.5, 0.22, 0.82, 0.5, 1, 0.85, 0.95]] },
  { label: "e", strokes: [[0.15, 0.66, 0.86, 0.6, 0.78, 0.32, 0.48, 0.22, 0.2, 0.42, 0.18, 0.78, 0.45, 1, 0.8, 0.9]] },
  { label: "f", strokes: [[0.86, 0.08, 0.6, 0, 0.42, 0.2, 0.4, 1], [0.14, 0.42, 0.74, 0.42]] },
  {
    label: "g",
    strokes: [arc(0.5, 0.44, 0.32, 0.28, -90, 270, 12),
      [0.82, 0.2, 0.82, 0.82, 0.62, 0.99, 0.3, 0.96]]
  },
  { label: "h", strokes: [[0.15, 0, 0.15, 1], [0.15, 0.52, 0.45, 0.34, 0.78, 0.46, 0.8, 1]] },
  { label: "i", strokes: [[0.5, 0.32, 0.5, 1], [0.5, 0, 0.5, 0.08]] },
  { label: "j", strokes: [[0.58, 0.32, 0.58, 0.86, 0.42, 1, 0.16, 0.96], [0.58, 0, 0.58, 0.08]] },
  { label: "l", strokes: [[0.5, 0, 0.5, 1]] },
  {
    label: "m",
    strokes: [[0.08, 0.3, 0.08, 1],
      [0.08, 0.48, 0.3, 0.3, 0.5, 0.48, 0.5, 1],
      [0.5, 0.48, 0.72, 0.3, 0.92, 0.48, 0.92, 1]]
  },
  { label: "n", strokes: [[0.15, 0.3, 0.15, 1], [0.15, 0.48, 0.45, 0.3, 0.8, 0.46, 0.8, 1]] },
  { label: "q", strokes: [arc(0.5, 0.44, 0.32, 0.28, -90, 270, 12), [0.82, 0.2, 0.82, 1]] },
  { label: "r", strokes: [[0.22, 0.3, 0.22, 1], [0.22, 0.52, 0.48, 0.3, 0.84, 0.3]] },
  { label: "t", strokes: [[0.48, 0, 0.48, 0.86, 0.7, 1], [0.16, 0.28, 0.82, 0.28]] }
];

// ── HOA VÀ THƯỜNG CÙNG MỘT DÁNG ────────────────────────────────────────────
// Nhãn ghi bằng chữ thường; handwriting.js đổi sang chữ hoa khi ký tự đó CAO
// bằng những chữ cao nhất trong cụm. Xem ghi chú `caseless` ở đầu file.
const CASELESS = [
  { label: "c", strokes: [CURVE_C] },
  { label: "k", strokes: [[0.15, 0, 0.15, 1], [0.85, 0.32, 0.18, 0.72], [0.4, 0.58, 0.9, 1]] },
  { label: "o", strokes: [RING] },
  { label: "p", strokes: [[0.15, 0, 0.15, 1], [0.15, 0.1, 0.52, 0, 0.82, 0.2, 0.78, 0.48, 0.45, 0.6, 0.15, 0.55]] },
  {
    label: "s",
    strokes: [[0.85, 0.14, 0.6, 0.01, 0.28, 0.05, 0.18, 0.26, 0.4, 0.42,
      0.64, 0.55, 0.83, 0.72, 0.74, 0.93, 0.42, 1, 0.14, 0.88]]
  },
  { label: "u", strokes: [[0.12, 0, 0.12, 0.7, 0.32, 0.96, 0.68, 0.96, 0.88, 0.7], [0.88, 0, 0.88, 1]] },
  { label: "v", strokes: [[0.08, 0, 0.5, 1, 0.92, 0]] },
  { label: "w", strokes: [[0.04, 0, 0.28, 1, 0.5, 0.36, 0.72, 1, 0.96, 0]] },
  { label: "x", strokes: [[0.08, 0, 0.92, 1], [0.92, 0, 0.08, 1]] },
  { label: "y", strokes: [[0.1, 0, 0.52, 0.6], [0.9, 0, 0.42, 1, 0.14, 0.98]] },
  { label: "z", strokes: [[0.08, 0.03, 0.92, 0.03, 0.1, 0.97, 0.92, 0.97]] }
];

// Toàn bộ bộ mẫu, mỗi phần tử { label, strokes, caseless }. `caseless` chỉ có
// mặt (và bằng true) ở nhóm cuối.
export const GLYPHS = [
  ...DIGITS,
  ...UPPER,
  ...LOWER,
  ...CASELESS.map((g) => ({ ...g, caseless: true }))
];

// Nhãn nào là chữ số. Dùng cho phép chọn theo NGỮ CẢNH: một cụm mà đa số ký tự
// đọc chắc chắn ra chữ số thì mấy ký tự lưng chừng (0 hay O, 1 hay l) cũng phải
// đọc ra chữ số.
export function isDigitLabel(label) {
  return label >= "0" && label <= "9";
}
