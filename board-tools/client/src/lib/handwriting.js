// ĐỌC CHỮ VIẾT TAY: mấy nét bút vừa viết → một chuỗi ký tự. Chữ số 0–9 và chữ
// Latin không dấu, chạy hoàn toàn tại máy, không gọi mạng.
//
// Không dính React, không đụng DOM — nhờ vậy test được bằng node:test, và cả
// phần đo độ chính xác (handwriting.test.js) chạy được ngay trong bộ test.
//
// ── PHÉP SO: $P (point-cloud matching) ─────────────────────────────────────
// Mỗi ký tự bị rã thành một ĐÁM MÂY N điểm rồi so với từng mẫu trong glyphs.js
// bằng cách ghép cặp điểm gần nhau nhất. Chọn phép này chứ không phải phép so
// theo thứ tự vì một lý do rất thực tế: người ta viết chữ "4" bằng nét dọc
// trước hay nét ngang trước, viết chữ "x" từ trái hay từ phải, đều là chuyện
// tuỳ người. Phép so theo thứ tự sẽ cần một mẫu cho mỗi cách đưa bút — tức là
// nhân bộ mẫu lên vài lần mà chẳng thêm được thông tin gì.
//
// ── CHUẨN HOÁ: CHỖ DỄ HỎNG NHẤT ────────────────────────────────────────────
// Cùng một bài học đã ghi ở recognize.js và scribble.js, lần thứ tư: PHÉP ĐO
// KHÔNG ĐƯỢC PHỤ THUỘC VÀO MẬT ĐỘ ĐIỂM. Số điểm của một nét là hệ quả của việc
// viết nhanh hay chậm, nên mọi thứ ở đây chạy trên nét ĐÃ RẢI LẠI thành đúng N
// điểm cách đều theo chiều dài.
//
// Chuyện thứ hai, riêng của chữ: co giãn về hộp đơn vị theo HAI CHIỀU RIÊNG
// (co ngang và co dọc khác nhau) là đúng cho chữ vuông vắn nhưng SAI THẢM HẠI
// cho chữ dẹt. Số 1 là một gạch dọc, hộp bao của nó rộng đúng bằng cái rung
// tay — co ngang về đủ 1 đơn vị thì cái rung ấy bị phóng to thành một đường
// ngoằn ngoèo chiếm trọn bề ngang, và số 1 không còn giống số 1 nữa. Nên chiều
// nhỏ bị CHẶN SÀN ở ASPECT_FLOOR lần chiều lớn: chữ vuông vắn vẫn được chuẩn
// hoá đầy đủ, chữ dẹt thì giữ nguyên độ dẹt — mà độ dẹt chính là dấu hiệu nhận
// ra nó.

import { GLYPHS, isDigitLabel } from "./glyphs.js";

// Số điểm mỗi đám mây. 32 là chỗ cân giữa hai phía: ít hơn thì hai chữ khác
// nhau ở một chi tiết nhỏ (chân cờ số 1, gạch ngang số 7) bị rải quá thưa để
// thấy chi tiết đó; nhiều hơn thì phép so tốn thời gian bình phương mà không
// phân biệt thêm được gì, vì bản thân nét tay không mịn tới mức ấy.
const N = 32;

// MỖI ĐIỂM MANG BỐN SỐ, không phải hai: x, y, và HƯỚNG của nét tại chỗ đó
// (đóng gói thành cos2θ, sin2θ). Trọng số dưới đây là chỗ hướng nặng bao nhiêu
// so với vị trí.
//
// Vì sao phải có: $P thuần tuý chỉ so vị trí, tức nó nhìn một chữ như một vốc
// cát chứ không nhìn ra nét. Chữ N và chữ H rải cát gần y hệt nhau — cùng hai
// cột dọc hai bên, cùng một vệt vắt qua giữa — nên đo ra chỉ cách nhau 1,03
// trong khi mắt người không bao giờ lẫn. Thứ phân biệt chúng là vệt giữa NẰM
// NGANG ở chữ H và NẰM CHÉO ở chữ N, mà đó đúng là thông tin bị vứt đi.
//
// Đóng gói bằng góc NHÂN ĐÔI chứ không phải góc thường, và đây là chỗ tinh:
// cos2θ/sin2θ cho hai hướng ngược nhau ra cùng một giá trị, nên kẻ một nét từ
// trái sang phải hay từ phải sang trái đều như nhau. Giữ được đúng tính chất
// "không phụ thuộc chiều đưa bút" mà cả phép $P sinh ra để có.
const ORIENT_W = 0.4;

// Số ô mỗi điểm chiếm trong mảng đám mây: x, y, cos2θ, sin2θ.
const DIM = 4;

// Chiều nhỏ của hộp bao không được co xuống dưới ngần này lần chiều lớn. Xem
// ghi chú dài ở đầu file — đây là chốt giữ cho số 1 và chữ l còn là một gạch.
const ASPECT_FLOOR = 0.22;

// ε của $P: số điểm xuất phát thử trong phép ghép cặp tham lam là N^(1-ε).
const START_EPSILON = 0.5;

// ── VAN AN TOÀN: KHI NÀO THÌ TRẢ LỜI "KHÔNG ĐỌC ĐƯỢC" ─────────────────────
//
// Đây là phần quan trọng nhất của cả tính năng, không phải mấy con số tinh
// chỉnh cho vui. Cử chỉ này THAY nét viết tay bằng chữ máy: đọc sai thì người
// ta mất đúng cái vừa viết. Thà trả lời "không đọc được, để nguyên nét" còn hơn
// đoán bừa.
//
// Hai con số, và chúng chặn hai kiểu hỏng khác nhau:
//   TRUNG BÌNH (MAX_DIST) — chặn cả cụm nhìn chung không giống chữ.
//   TỆ NHẤT (HARD_DIST)   — chặn một ký tự hỏng hẳn nằm lẫn trong một cụm đẹp.
// Chỉ đo cái tệ nhất — như bản đầu — thì một chữ hơi nguệch trong một từ bốn
// chữ đủ giết cả từ: với tỉ lệ nhận 91% mỗi ký tự, đòi CẢ BỐN cùng đạt thì cụm
// chỉ qua được 69% số lần, tức cứ ba lần viết là một lần cử chỉ "không ăn" mà
// chẳng có gì trên màn hình giải thích vì sao.
//
// Một ký tự đứng MỘT MÌNH tự động bị đo chặt hơn mà không cần luật riêng: khi
// ấy nó vừa là trung bình vừa là cái tệ nhất, nên nó phải qua được ngưỡng chặt.
// Đúng như mong muốn — một ký tự lẻ không có gì bên cạnh để chứng thực.
//
// Con số lấy từ phép quét ngưỡng (xem handwriting.test.js): ở mức 2,2 thì 91%
// mẫu chữ bị méo tới mức người vẫn đọc được vẫn qua, còn CẢ BẢY thứ không phải
// chữ trong bộ đối chứng (ngôi sao, mũi tên, tam giác, vòng xoắn, ngoằn ngoèo,
// hai gạch chéo, nét nguệch ngoạc) đều bị loại.
//
// HẠN CHẾ ĐÃ BIẾT, ghi ra vì nó có thật: phân bố của "chữ thật" và của "hình
// vẽ" chồng lên nhau — vòng xoắn đo ra 2,21, chỉ nhỉnh hơn ngưỡng đúng một
// phần trăm. Không có con số nào vừa nhận hết chữ vừa loại hết hình, vì với
// máy thì một tam giác ĐÚNG LÀ giống chữ A. Đó là lý do cử chỉ này phải TỰ BẬT
// mới chạy: bật nó lên tức là người dùng đang nói "tôi đang viết chữ".
const MAX_DIST = 2.2;
const HARD_DIST = 3.4;

// Hai nét thuộc CÙNG một ký tự khi hình chiếu lên trục ngang của chúng chồng
// nhau quá ngần này lần bề ngang của nét hẹp hơn.
const MERGE_FRAC = 0.3;

// Bề ngang của một nét không bao giờ được coi là nhỏ hơn ngần này lần chiều cao
// dòng chữ. Không có sàn thì cái chấm trên chữ i (bề ngang gần bằng 0) nhân với
// MERGE_FRAC ra 0, tức là chạm hờ vào nét nào cũng bị gộp vào nét đó.
const MIN_W_FRAC = 0.12;

// HAI NÉT CHẠM NHAU MÀ KHÔNG CHỒNG NHAU thì vẫn là một ký tự, miễn khe hở dưới
// ngần này lần chiều cao dòng.
//
// Không có luật này thì phép gộp hỏng ở đúng những chữ thông dụng nhất, và hỏng
// một cách khó thấy: nét sổ của chữ a, chữ B, chữ H và số 4 nằm TIẾP TUYẾN với
// phần còn lại của chữ — mép phải cái bụng chữ a chính là mép trái nét sổ — nên
// độ chồng đo ra đúng 0. Đo trên bộ mẫu: "Max" tách thành M-0-1-x, "42" và
// "2024" và "Hi" thì rã ra tới mức bị từ chối hẳn.
//
// 0,04 chứ không rộng hơn, vì cái nó phải phân biệt là "chạm" với "cách một
// khe": chữ viết cạnh nhau bình thường cách nhau chừng 0,15–0,3 lần chiều cao,
// nên khe hở thật vẫn còn xa ngưỡng này. Viết chữ dính sát vào nhau thì có
// nhầm — đây là hạn chế đã biết, không có phép hình học nào gỡ được vì hai
// người viết cùng một cụm nét có thể định ra một chữ hay hai.
const TOUCH_FRAC = 0.04;

// Cách nhau quá ngần này lần chiều cao dòng thì giữa hai ký tự có một dấu cách.
const SPACE_FRAC = 0.45;

// Cao từ ngần này lần chữ cao nhất trong cụm trở lên thì là CHỮ HOA. Chỉ áp cho
// những chữ mà dáng hoa và dáng thường giống hệt nhau (xem `caseless` bên
// glyphs.js) — với chữ có hai dáng khác nhau thì hình đã trả lời rồi.
const CAP_FRAC = 0.78;

// Bao nhiêu phần của cụm phải đọc ra chữ số thì mấy ký tự lưng chừng cũng bị ép
// đọc thành chữ số (và ngược lại). Xem chooseByContext.
const CONTEXT_FRAC = 0.6;

// Một ký tự chỉ được BỎ PHIẾU "đây là cụm số" hay "đây là cụm chữ" khi ứng viên
// tốt nhất của phe kia tệ hơn nó ít nhất ngần này.
//
// Chốt này là thứ làm phép ép theo ngữ cảnh chạy đúng, và con số của nó không
// phải ước lượng — đo trên bộ mẫu thì khe hở lộ ra rất rõ:
//   0 với o, 1 với l  → chênh 0,00   (đúng một hình, không phân biệt được)
//   9 với g           → chênh 2,31   (gần nhất trong số phân biệt được)
//   4 với d, A với 4  → chênh 4,4+
// Tức mọi ký tự đọc được đều chênh trên 2,3, còn hai cặp mù thì chênh đúng 0.
// Lấy 1,0 là nằm giữa khe ấy, dư chỗ cho nét méo về cả hai phía.
//
// Không có chốt này thì cụm "Al" có một phiếu chữ (A) và một phiếu số (gạch dọc,
// mà gạch dọc thì đọc ra "1" hay "l" đều đúng như nhau) — hoà 50/50, không phe
// nào đủ đa số, và kết quả là "A1". Cái gạch ấy CHÍNH LÀ thứ đang cần được
// quyết; cho nó bỏ phiếu là để bị cáo tự tuyên án.
const VOTE_MARGIN = 1.0;

// Số nét tối đa cho một ký tự. Chữ Latin không dấu nhiều nhất là ba nét (chữ A,
// chữ E hoa viết rời...); quá bốn thì đó không phải một ký tự mà là hai chữ bị
// gộp nhầm, và cho nó chạy tiếp chỉ tổ ra một kết quả vô nghĩa.
const MAX_STROKES_PER_CHAR = 4;

function bbox(pts) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    if (pts[i] < l) l = pts[i];
    if (pts[i] > r) r = pts[i];
    if (pts[i + 1] < t) t = pts[i + 1];
    if (pts[i + 1] > b) b = pts[i + 1];
  }
  return { l, t, r, b, w: r - l, h: b - t };
}

function boxOf(strokes) {
  let box = null;
  for (const s of strokes) {
    const b = bbox(s);
    if (!box) { box = b; continue; }
    box = {
      l: Math.min(box.l, b.l), t: Math.min(box.t, b.t),
      r: Math.max(box.r, b.r), b: Math.max(box.b, b.b)
    };
    box.w = box.r - box.l;
    box.h = box.b - box.t;
  }
  return box;
}

function pathLen(pts) {
  let sum = 0;
  for (let i = 2; i + 1 < pts.length; i += 2) {
    sum += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  }
  return sum;
}

// Rải một nét thành ĐÚNG `count` điểm cách đều theo chiều dài đường đi. Nét dài
// 0 (một cái chấm) thì trả về `count` bản sao của cùng một điểm — đúng như ta
// muốn: cái chấm trên chữ i chiếm một chỗ trong đám mây, không hơn.
function resampleTo(pts, count) {
  const n = Math.floor(pts.length / 2);
  const out = [];
  if (n < 2 || count < 1) {
    for (let k = 0; k < count; k++) out.push(pts[0], pts[1]);
    return out;
  }
  const acc = new Array(n);
  acc[0] = 0;
  for (let i = 1; i < n; i++) {
    acc[i] = acc[i - 1] + Math.hypot(pts[i * 2] - pts[(i - 1) * 2], pts[i * 2 + 1] - pts[(i - 1) * 2 + 1]);
  }
  const total = acc[n - 1];
  if (!(total > 0)) {
    for (let k = 0; k < count; k++) out.push(pts[0], pts[1]);
    return out;
  }
  let seg = 1;
  for (let k = 0; k < count; k++) {
    const target = count === 1 ? 0 : (k / (count - 1)) * total;
    while (seg < n - 1 && acc[seg] < target) seg++;
    const span = acc[seg] - acc[seg - 1];
    const u = span > 0 ? (target - acc[seg - 1]) / span : 0;
    const ax = pts[(seg - 1) * 2], ay = pts[(seg - 1) * 2 + 1];
    out.push(ax + (pts[seg * 2] - ax) * u, ay + (pts[seg * 2 + 1] - ay) * u);
  }
  return out;
}

// Chia N điểm cho các nét theo CHIỀU DÀI, tối thiểu 2 điểm mỗi nét. Chia theo số
// nét thì một cái chấm nhỏ xíu được cấp bằng cả một nét sổ dài — đám mây khi ấy
// tả cái chấm kỹ hơn tả thân chữ.
function allotPoints(lens) {
  const k = lens.length;
  const base = 2;
  let left = N - base * k;
  if (left < 0) return null;
  const total = lens.reduce((a, b) => a + b, 0);
  const counts = lens.map(() => base);
  if (left === 0) return counts;
  if (!(total > 0)) { counts[0] += left; return counts; }
  // Chia phần dư theo phương pháp SỐ DƯ LỚN NHẤT, để tổng ra đúng N: làm tròn
  // từng cái rồi cộng lại thì lệch một hai điểm, mà $P đòi hai đám mây đúng
  // bằng nhau về số điểm.
  const want = lens.map((len) => (len / total) * left);
  const floors = want.map(Math.floor);
  let used = 0;
  for (let i = 0; i < k; i++) { counts[i] += floors[i]; used += floors[i]; }
  const order = want
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let j = 0; used < left; j++, used++) counts[order[j % k].i]++;
  return counts;
}

// Mấy nét của MỘT ký tự → đám mây N điểm đã chuẩn hoá, hoặc null nếu không dựng
// nổi. Mảng phẳng, mỗi điểm DIM ô. Xuất ra ngoài để test đo trực tiếp được.
export function cloudify(strokes) {
  const clean = (strokes || []).filter((s) => s && s.length >= 2);
  if (!clean.length || clean.length > MAX_STROKES_PER_CHAR) return null;
  const counts = allotPoints(clean.map(pathLen));
  if (!counts) return null;

  // Giữ RIÊNG từng nét chứ không trộn hết vào một mảng: hướng nét phải đo trong
  // lòng một nét thôi. Nối hai nét lại rồi đo thì ở chỗ giáp ranh sinh ra một
  // "hướng" bịa ra từ cú nhấc bút — mà cú nhấc bút thì không có trên giấy.
  const segs = clean.map((s, i) => resampleTo(s, counts[i]));

  const flat = [];
  for (const seg of segs) flat.push(...seg);
  const box = bbox(flat);
  const maxDim = Math.max(box.w, box.h);
  if (!(maxDim > 0)) return null;
  // Chặn sàn chiều nhỏ — xem ASPECT_FLOOR.
  const fw = Math.max(box.w, ASPECT_FLOOR * maxDim);
  const fh = Math.max(box.h, ASPECT_FLOOR * maxDim);

  const cloud = new Float64Array(N * DIM);
  let at = 0, cx = 0, cy = 0;
  for (const seg of segs) {
    const m = Math.floor(seg.length / 2);
    // Co giãn TRƯỚC rồi mới đo hướng: hai chiều co khác nhau nên nó bẻ góc, và
    // đo trước khi co thì con số ghi lại là góc của một chữ chưa từng đem so.
    const sx = new Array(m), sy = new Array(m);
    for (let k = 0; k < m; k++) {
      sx[k] = (seg[k * 2] - box.l) / fw;
      sy[k] = (seg[k * 2 + 1] - box.t) / fh;
    }
    for (let k = 0; k < m; k++) {
      const a = k > 0 ? k - 1 : k;
      const b = k < m - 1 ? k + 1 : k;
      const dx = sx[b] - sx[a], dy = sy[b] - sy[a];
      const len2 = dx * dx + dy * dy;
      // Nét dài 0 (cái chấm trên chữ i): không có hướng nào cả. Để 0/0 thì nó
      // cách MỌI hướng đúng một khoảng như nhau — tức là im lặng không bỏ phiếu,
      // đúng thứ ta muốn ở một cái chấm.
      const c = len2 > 0 ? ((dx * dx - dy * dy) / len2) * ORIENT_W : 0;
      const s = len2 > 0 ? ((2 * dx * dy) / len2) * ORIENT_W : 0;
      cloud[at] = sx[k]; cloud[at + 1] = sy[k];
      cloud[at + 2] = c; cloud[at + 3] = s;
      cx += sx[k]; cy += sy[k];
      at += DIM;
    }
  }
  cx /= N; cy /= N;
  // Chỉ dời VỊ TRÍ về tâm, không đụng tới hai ô hướng: hướng vốn đã là một đại
  // lượng tương đối, trừ đi trung bình của nó là làm hỏng chính nó.
  for (let i = 0; i < N; i++) { cloud[i * DIM] -= cx; cloud[i * DIM + 1] -= cy; }
  return cloud;
}

// Ghép cặp THAM LAM từ điểm thứ `start`: mỗi điểm của `a` lấy điểm gần nhất còn
// trống của `b`. Trọng số giảm dần theo thứ tự ghép — mấy cặp ghép sau là mấy
// cặp còn lại sau khi những điểm dễ đã bị lấy hết, nên chúng vốn kém tin cậy.
//
// `ceiling` cho phép BỎ CUỘC SỚM: đang so với mẫu thứ chín mươi mà tổng đã vượt
// cái tốt nhất từng thấy thì mẫu này thua rồi, không cần cộng nốt.
function cloudDistance(a, b, start, ceiling) {
  const used = new Uint8Array(N);
  let sum = 0;
  let i = start;
  for (let step = 0; step < N; step++) {
    let best = Infinity, at = -1;
    for (let j = 0; j < N; j++) {
      if (used[j]) continue;
      let d = 0;
      for (let k = 0; k < DIM; k++) {
        const t = a[i * DIM + k] - b[j * DIM + k];
        d += t * t;
      }
      if (d < best) { best = d; at = j; }
    }
    used[at] = 1;
    sum += (1 - step / N) * Math.sqrt(best);
    if (sum >= ceiling) return Infinity;
    i = (i + 1) % N;
  }
  return sum;
}

function greedyMatch(a, b, ceiling) {
  const step = Math.max(1, Math.floor(Math.pow(N, 1 - START_EPSILON)));
  let best = ceiling;
  for (let i = 0; i < N; i += step) {
    const d1 = cloudDistance(a, b, i, best);
    if (d1 < best) best = d1;
    const d2 = cloudDistance(b, a, i, best);
    if (d2 < best) best = d2;
  }
  // Không cải thiện được gì so với trần: mẫu này tệ hơn trần, và con số CHÍNH
  // XÁC tệ bao nhiêu thì không ai hỏi. Trả Infinity chứ không trả lại cái trần,
  // để người gọi không nhầm nó là một phép đo thật.
  return best === ceiling ? Infinity : best;
}

// Bộ mẫu đã chuẩn hoá sẵn, dựng một lần. Chuẩn hoá lại ở mỗi lần đọc thì mỗi cú
// giữ tay phải rải lại chín chục cái mẫu mà chúng có đổi bao giờ đâu.
let TEMPLATES = null;
function templates() {
  if (TEMPLATES) return TEMPLATES;
  TEMPLATES = [];
  for (const g of GLYPHS) {
    const cloud = cloudify(g.strokes);
    if (cloud) TEMPLATES.push({ label: g.label, caseless: g.caseless === true, cloud });
  }
  return TEMPLATES;
}

// Một ký tự → danh sách nhãn xếp theo độ khớp, tốt nhất trước. Mỗi phần tử
// { label, caseless, dist }, và MỖI NHÃN CHỈ XUẤT HIỆN MỘT LẦN — số 1 có ba mẫu
// nhưng chỉ nên chiếm một chỗ trong bảng xếp hạng, không thì nó đẩy các ứng
// viên khác ra khỏi tầm nhìn của phép chọn theo ngữ cảnh.
export function rankChar(strokes) {
  const cloud = cloudify(strokes);
  if (!cloud) return [];
  const best = new Map();
  for (const t of templates()) {
    const prev = best.get(t.label);
    // TRẦN LÀ HARD_DIST, không phải vô cực. Mẫu nào tệ hơn ngưỡng ấy thì không
    // đường nào chọn được nó nữa — cả phép ép theo ngữ cảnh lẫn van an toàn đều
    // đã chặn ở đó — nên đo cho ra con số chính xác của nó là công đổ đi.
    //
    // Không phải tối ưu vặt: nó cắt hơn nửa thời gian đọc một ký tự, vì tuyệt
    // đại đa số trong năm mươi mấy mẫu là mẫu tệ, và mỗi mẫu tệ thì bỏ cuộc
    // ngay sau vài điểm đầu thay vì chạy hết bốn nghìn phép so.
    const cap = Math.min(prev ? prev.dist : Infinity, HARD_DIST);
    const d = greedyMatch(cloud, t.cloud, cap);
    if (!prev || d < prev.dist) best.set(t.label, { label: t.label, caseless: t.caseless, dist: d });
  }
  // Hoà thì CHỮ SỐ đứng trước. Chuyện này có thật chứ không phải phòng xa: mẫu
  // của số 0 và chữ o giống nhau tới từng điểm, số 1 với chữ l cũng vậy, nên
  // hai cặp ấy hoà đúng 0,00 ở mọi lần đọc. Không định đoạt ở đây thì thứ tự
  // xếp hạng của chúng do thứ tự duyệt Map quyết — tức là do thứ tự khai báo
  // trong glyphs.js, một thứ không ai coi là hợp đồng và ai cũng có thể đảo khi
  // thêm mẫu mới. Chọn chữ số vì viết một ký tự lẻ không có gì xung quanh thì
  // "0" là cách đọc thường gặp hơn "o".
  return Array.from(best.values()).sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return (isDigitLabel(b.label) ? 1 : 0) - (isDigitLabel(a.label) ? 1 : 0);
  });
}

// Tách một mớ nét thành từng ký tự, theo chỗ hình chiếu lên trục ngang của
// chúng chồng lên nhau. Trả về mảng các { strokes, box } đã xếp từ trái sang.
//
// Xếp theo MÉP TRÁI chứ không theo thứ tự viết: người ta viết gạch ngang chữ t
// hay chấm chữ i sau khi đã viết xong cả từ là chuyện thường, nên thứ tự đưa bút
// không nói được gì về thứ tự đọc.
export function splitChars(strokes, lineH) {
  const items = (strokes || [])
    .filter((s) => s && s.length >= 2)
    .map((s) => ({ s, box: bbox(s) }))
    .sort((a, b) => a.box.l - b.box.l);
  if (!items.length) return [];
  const h = lineH > 0 ? lineH : 1;
  const floor = MIN_W_FRAC * h;
  const touch = TOUCH_FRAC * h;

  const groups = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g) {
      // Số âm nghĩa là hai nét KHÔNG chồng nhau, và trị tuyệt đối của nó là bề
      // rộng khe hở giữa chúng.
      const overlap = Math.min(g.box.r, it.box.r) - Math.max(g.box.l, it.box.l);
      const narrow = Math.max(Math.min(g.box.w, it.box.w), floor);
      const same = overlap > MERGE_FRAC * narrow || overlap > -touch;
      if (same && g.strokes.length < MAX_STROKES_PER_CHAR) {
        g.strokes.push(it.s);
        g.box = {
          l: Math.min(g.box.l, it.box.l), t: Math.min(g.box.t, it.box.t),
          r: Math.max(g.box.r, it.box.r), b: Math.max(g.box.b, it.box.b)
        };
        g.box.w = g.box.r - g.box.l;
        g.box.h = g.box.b - g.box.t;
        continue;
      }
    }
    groups.push({ strokes: [it.s], box: { ...it.box } });
  }
  return groups;
}

// ÉP THEO ĐA SỐ. Một cụm mà đa số ký tự đọc chắc chắn ra chữ số thì mấy ký tự
// lưng chừng cũng phải là chữ số — đây là thứ DUY NHẤT chữa được mấy cặp mà chữ
// viết tay vốn không phân biệt (0/O, 1/l, 5/S, 2/Z). Không có nó thì viết "105"
// ra "1O5" là chuyện gần như chắc chắn xảy ra.
//
// Chỉ ép khi đa số đủ rõ VÀ cụm có từ hai ký tự: một ký tự đứng một mình thì
// "đa số" chính là nó, tức là phép này chẳng nói thêm được gì mà lại tự tin.
function chooseByContext(ranks) {
  const picks = ranks.map((r) => r[0]);
  if (ranks.length < 2) return picks;
  // Chỉ đếm phiếu của những ký tự ĐỌC CHẮC — xem VOTE_MARGIN. Ký tự lưng chừng
  // đứng ngoài, vì nó chính là thứ cuộc bỏ phiếu này sinh ra để quyết.
  let digits = 0, voters = 0;
  for (const r of ranks) {
    const top = r[0];
    const other = r.find((c) => isDigitLabel(c.label) !== isDigitLabel(top.label));
    if (other && other.dist - top.dist < VOTE_MARGIN) continue;
    voters++;
    if (isDigitLabel(top.label)) digits++;
  }
  // Cả cụm đều lưng chừng (viết "10" chẳng hạn): không có gì để dựa vào, giữ
  // nguyên hạng nhất. Khi ấy phép sắp hạng đã ưu tiên chữ số ở chỗ hoà — xem
  // rankChar.
  if (!voters) return picks;
  const frac = digits / voters;
  const wantDigit = frac >= CONTEXT_FRAC;
  const wantAlpha = 1 - frac >= CONTEXT_FRAC;
  if (!wantDigit && !wantAlpha) return picks;
  return ranks.map((r, i) => {
    const fit = r.find((c) => isDigitLabel(c.label) === wantDigit);
    // Không có ứng viên nào thuộc phe đa số, hoặc ứng viên ấy tệ hơn hẳn ngưỡng
    // chấp nhận: giữ nguyên lựa chọn cũ. Ép bằng mọi giá thì một chữ "A" nằm
    // giữa dãy số sẽ bị bẻ thành "4".
    return fit && fit.dist <= HARD_DIST ? fit : picks[i];
  });
}

// Toàn bộ đường đọc: mấy nét bút → chuỗi ký tự.
//
// Trả về null khi KHÔNG ĐỌC ĐƯỢC, và người gọi phải hiểu đó là "giữ nguyên nét
// tay". Xem MAX_DIST: cử chỉ này thay chữ viết tay bằng chữ máy, nên im lặng bỏ
// qua bao giờ cũng đỡ hơn đoán bừa.
export function recognizeInk(strokes) {
  const all = (strokes || []).filter((s) => s && s.length >= 4);
  if (!all.length) return null;
  const outer = boxOf(all);
  if (!outer || !(outer.h > 0)) return null;

  const chars = splitChars(all, outer.h);
  if (!chars.length) return null;

  const ranks = chars.map((c) => rankChar(c.strokes));
  if (ranks.some((r) => !r.length)) return null;

  const picks = chooseByContext(ranks);
  // Đo van an toàn TRÊN LỰA CHỌN CUỐI CÙNG, không trên hạng nhất thô: phép ép
  // theo ngữ cảnh có thể đổi "O" thành "0" và khoảng cách đi kèm cũng đổi theo.
  // Đo trước khi ép là đo một kết quả sắp bị vứt đi.
  let sum = 0, worst = 0;
  for (const p of picks) { sum += p.dist; if (p.dist > worst) worst = p.dist; }
  if (worst > HARD_DIST || sum / picks.length > MAX_DIST) return null;
  // Chiều cao của chữ CAO NHẤT trong cụm là mốc chữ hoa. Đo trên chính cụm này
  // chứ không lấy một con số cố định: cùng một người viết to nhỏ khác nhau tuỳ
  // chỗ, mà cái cần biết chỉ là cao THẤP HƠN hay BẰNG mấy chữ bên cạnh.
  const capH = Math.max(...chars.map((c) => c.box.h));

  let text = "";
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    if (i > 0) {
      const gap = chars[i].box.l - chars[i - 1].box.r;
      if (gap > SPACE_FRAC * outer.h) text += " ";
    }
    const pick = picks[i];
    // Chữ đứng một mình mà hoa hay thường không phân biệt được bằng hình thì
    // lấy CHỮ HOA: viết mỗi một chữ cái lên bảng gần như bao giờ cũng là để đặt
    // tên một thứ gì đó (điểm A, nhóm B), và ở đó chữ hoa mới là thứ mong đợi.
    const upper = pick.caseless && (chars.length === 1 || chars[i].box.h >= CAP_FRAC * capH);
    const label = upper ? pick.label.toUpperCase() : pick.label;
    text += label;
    out.push({ label, dist: pick.dist, box: chars[i].box });
  }
  return { text, chars: out, dist: worst, box: outer };
}
