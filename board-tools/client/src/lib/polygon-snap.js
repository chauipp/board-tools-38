// KHÉP NÉT GẤP KHÚC THÀNH HÌNH.
//
// Cử chỉ giữ-tay-bắt-hình (recognize.js) chốt được MỘT đoạn thẳng mỗi lần giữ.
// Giữ nhiều lần liên tiếp thì các đoạn nối đuôi nhau thành một nét gấp khúc, và
// khi đoạn cuối quay về dính vào điểm xuất phát thì cái vòng kín đó mới là thứ
// người ta thật sự đang vẽ. File này trả lời đúng một câu hỏi: MẤY CÁI ĐỈNH ẤY
// LÀ HÌNH GÌ — và nếu là hình có tên thì nắn nó cho vuông vắn.
//
// KHÁC HẲN recognize.js dù nghe giống. Ở đó đầu vào là hàng trăm điểm rung tay
// và việc chính là đoán xem người ta ĐỊNH vẽ gì. Ở đây đầu vào là mấy cái đỉnh
// mà người dùng đã CỐ Ý đặt, từng cái một, bằng cách giữ tay tại chỗ hơn một
// giây. Không còn gì phải đoán; chỉ còn đúng một câu hỏi khó: cái xiên 3 độ kia
// là cố ý, hay là tay đặt trượt?
//
// Nên MỌI NGƯỠNG Ở ĐÂY ĐO BẰNG GÓC, không đo bằng sai số vị trí như recognize.js
// — và đó là khác biệt đáng kể nhất giữa hai file. "Hai cạnh này định cho song
// song" là một câu hỏi về góc: câu trả lời của nó không được đổi khi người ta vẽ
// hình to gấp đôi. Đo bằng khoảng cách thì nó đổi, và đổi theo hướng tệ nhất —
// hình càng to càng dễ bị nắn oan.
//
// KẾT QUẢ trả về dùng đúng khuôn của hình khối có sẵn ({ kind, pts }, xem
// shape.js), cùng lý do đã ghi ở đầu recognize.js: hình khép ra từ đây đi tiếp
// qua đúng đường của tool Hình khối — cùng cách vẽ, cùng hit-test, cùng tay cầm,
// cùng lịch sử hoàn tác. Không có loại vật thể mới nào sinh ra ở đây.

// Bán kính DÍNH vào điểm xuất phát, tính bằng pixel MÀN HÌNH — không phải đơn vị
// canvas, cùng lý do với SNAP_MOVE_TOL bên recognize.js: khả năng ngắm của tay
// người là chừng ấy pixel bất kể bảng đang zoom bao nhiêu.
//
// 16 chứ không rộng hơn, vì trong lúc dính thì nét KHÔNG đi theo tay nữa: đầu
// nét bị ghim vào đỉnh và bộ đếm khép hình chạy. Vùng dính rộng quá thì một cạnh
// chỉ tình cờ đi ngang gần điểm xuất phát cũng bị ghim lại, và người đang vẽ
// thấy nét mình đứng khựng không rõ vì sao.
//
// HAI ngưỡng chứ không một: dính ở 16, chỉ nhả ra khi đã đi quá 22. Vùng đệm này
// là thứ giữ cho cử chỉ mượt — một ngưỡng duy nhất thì bàn tay đậu đúng ở mép
// vòng sẽ dính/nhả liên tục theo từng cái rung, mà mỗi lần nhả là bộ đếm khép
// hình chết và lên nòng lại từ đầu. Triệu chứng: đứng đúng chỗ mà giữ mãi không
// khép được, còn lùi vào trong một tí thì khép ngay — kiểu lỗi không ai đoán ra.
export const CLOSE_STICK_PX = 16;
export const CLOSE_UNSTICK_PX = 22;

const DEG = Math.PI / 180;

// Hai cạnh đối lệch nhau dưới chừng này thì coi như người ta ĐỊNH cho chúng song
// song. Kẹp từ hai phía: nhỏ hơn thì một hình bình hành vẽ tay không bao giờ
// được nắn (đặt đỉnh thứ tư bằng tay thì trượt vài độ là chuyện thường), lớn hơn
// thì một hình thang thật bị hạ xuống thành hình bình hành. Hình thang vẽ ra để
// NHÌN THẤY là hình thang thì xiên ít nhất cỡ 15 độ, nên 7 nằm gọn giữa hai bên.
const PARALLEL_DEG = 7;

// Đã là hình bình hành rồi thì hai phép siết dưới đây làm việc trên HAI ĐƯỜNG
// CHÉO, không làm trên cạnh — và đó là chỗ khiến cả đoạn này gọn được:
//
//   hai đường chéo BẰNG NHAU   ⇔ bốn góc vuông  ⇒ chữ nhật
//   hai đường chéo VUÔNG GÓC   ⇔ bốn cạnh bằng  ⇒ hình thoi
//   cả hai                     ⇒ hình vuông
//
// Hai phép độc lập nhau: cho bằng nhau chỉ đụng tới ĐỘ DÀI, cho vuông góc chỉ
// đụng tới HƯỚNG. Nên làm cái nào trước cũng ra cùng một kết quả, không có thứ
// tự nào phải nhớ. Làm trên cạnh thì không được vậy — nắn góc vuông ở đỉnh này
// là hỏng góc vuông ở đỉnh kia.
const RECT_RATIO = 0.08;
const RHOMBUS_DEG = 6;

// Hình đã vuông vắn mà còn nghiêng dưới chừng này thì ép thẳng trục và lưu ở
// dạng HỘP BAO ("rect" / "diamond") thay vì dạng bốn đỉnh tự do ("quad").
//
// Đây là quyết định về CÁCH LƯU chứ không phải về hình dạng, và nó đáng làm:
// hình dạng hộp có tay cầm cạnh để co giãn (xem BOX_EDGE_KINDS bên shape.js),
// còn tứ giác bốn đỉnh tự do thì mỗi góc phải kéo riêng. Một cái chữ nhật vẽ
// thẳng trục mà lưu thành quad là lặng lẽ lấy mất của người dùng phép co giãn.
//
// 5 độ: đủ để nuốt cái nghiêng của một cái chữ nhật vẽ tay tử tế, mà chưa nuốt
// mất một hình xoay có chủ ý — xoay 5 độ thì mắt gần như không đọc ra là xoay.
const AXIS_DEG = 5;

// Cạnh ngắn hơn chừng này (đơn vị canvas) thì đa giác coi như suy biến: nắn một
// hình có cạnh dài 1 đơn vị chỉ tổ ra kết quả ngẫu nhiên.
const MIN_SIDE = 2;

// Lệch góc giữa hai HƯỚNG, quy về [0, π/2]. Hai cạnh đối của một đa giác chạy
// NGƯỢC CHIỀU nhau khi đi vòng quanh, nên "có song song không" chỉ trả lời được
// theo ĐƯỜNG THẲNG chứ không theo chiều đi — thiếu phép quy này thì mọi cặp cạnh
// đối của mọi hình bình hành đều lệch nhau đúng 180 độ.
function angleGap(a, b) {
  const d = Math.abs(a - b) % Math.PI;
  return d > Math.PI / 2 ? Math.PI - d : d;
}

// Lệch khỏi TRỤC GẦN NHẤT, quy về [0, π/4]. Khác angleGap ở trên và khác một
// cách dễ nhầm: cái kia so hai hướng với nhau, cái này so một hướng với CẢ HAI
// trục. Dùng nhầm angleGap(a, 0) thì một cạnh dựng đứng đo ra 90 độ và bị đọc là
// "nghiêng hết cỡ", trong khi nó thẳng trục hơn mọi thứ khác.
function axisGap(a) {
  const d = Math.abs(a) % (Math.PI / 2);
  return Math.min(d, Math.PI / 2 - d);
}

function round(pts) {
  return pts.map((v) => Math.round(v));
}

// Bốn cạnh theo thứ tự đi vòng quanh, mỗi cạnh một góc và một chiều dài.
function sides(v) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const dx = v[j * 2] - v[i * 2];
    const dy = v[j * 2 + 1] - v[i * 2 + 1];
    out.push({ i, j, dx, dy, ang: Math.atan2(dy, dx), len: Math.hypot(dx, dy) });
  }
  return out;
}

// Trung bình của mấy HƯỚNG (không phải chiều), có trọng số theo chiều dài cạnh.
//
// Không lấy trung bình cộng thẳng của mấy con số góc được: hai cạnh gần dọc có
// thể ra +89 độ và −89 độ, cộng lại chia đôi thành 0 — tức gần ngang, ngược hẳn
// thứ cần. Nhân đôi góc rồi cộng theo VECTƠ thì cái vòng khép lại đúng chỗ, và
// đó cũng là lý do phải chia đôi lại ở cuối.
function meanDirection(list) {
  let sx = 0, sy = 0;
  for (const s of list) {
    sx += s.len * Math.cos(2 * s.ang);
    sy += s.len * Math.sin(2 * s.ang);
  }
  return Math.atan2(sy, sx) / 2;
}

// Xoay một cạnh quanh TRUNG ĐIỂM của chính nó về hướng `ang`, giữ nguyên chiều
// dài. Quanh trung điểm chứ không quanh một đầu: giữ cho cạnh nằm đúng chỗ cũ,
// nên hai cạnh kề nó chỉ phải xê dịch một nửa so với cách kia.
//
// Hai cạnh ĐỐI NHAU có bốn đầu mút rời nhau hẳn, nên xoay cả hai cùng lúc không
// bao giờ tranh nhau một cái đỉnh. Đó là lý do phép này chỉ dùng được cho cặp
// cạnh đối, không dùng được cho cặp cạnh kề.
function alignSide(v, s, ang) {
  const mx = (v[s.i * 2] + v[s.j * 2]) / 2;
  const my = (v[s.i * 2 + 1] + v[s.j * 2 + 1]) / 2;
  // Hướng chung là một ĐƯỜNG THẲNG nên nó không biết chiều; lấy chiều nào cùng
  // phía với cạnh đang có, không thì cạnh bị lộn đầu và tứ giác tự thắt nút.
  const flip = Math.cos(ang) * s.dx + Math.sin(ang) * s.dy < 0 ? -1 : 1;
  const hx = (flip * Math.cos(ang) * s.len) / 2;
  const hy = (flip * Math.sin(ang) * s.len) / 2;
  const out = v.slice();
  out[s.i * 2] = mx - hx;
  out[s.i * 2 + 1] = my - hy;
  out[s.j * 2] = mx + hx;
  out[s.j * 2 + 1] = my + hy;
  return out;
}

// Tứ giác → tâm và HAI NỬA ĐƯỜNG CHÉO. Đây là bản dựng hình bình hành gần nhất
// theo nghĩa bình phương tối thiểu: một tứ giác là hình bình hành đúng khi hai
// đường chéo cắt nhau tại trung điểm của cả hai, tức khi bốn đỉnh viết được
// thành c ± d1 và c ± d2. Lấy c là trung bình bốn đỉnh và d là nửa hiệu hai đỉnh
// đối thì đó chính là nghiệm.
function diagonals(v) {
  return {
    cx: (v[0] + v[2] + v[4] + v[6]) / 4,
    cy: (v[1] + v[3] + v[5] + v[7]) / 4,
    a1: Math.atan2(v[1] - v[5], v[0] - v[4]),
    l1: Math.hypot(v[0] - v[4], v[1] - v[5]) / 2,
    a2: Math.atan2(v[3] - v[7], v[2] - v[6]),
    l2: Math.hypot(v[2] - v[6], v[3] - v[7]) / 2
  };
}

function fromDiagonals(d) {
  const x1 = d.l1 * Math.cos(d.a1), y1 = d.l1 * Math.sin(d.a1);
  const x2 = d.l2 * Math.cos(d.a2), y2 = d.l2 * Math.sin(d.a2);
  return [
    d.cx + x1, d.cy + y1,
    d.cx + x2, d.cy + y2,
    d.cx - x1, d.cy - y1,
    d.cx - x2, d.cy - y2
  ];
}

// Tứ giác → hình bình hành gần nhất, rồi siết tiếp thành hình có tên hơn nếu nó
// gần tới mức đáng nắn. Không cần dựng hình bình hành trước rồi mới gọi: chính
// diagonals() ở dòng đầu đã là phép dựng đó.
function tighten(v) {
  const d = diagonals(v);
  if (!(d.l1 > 0) || !(d.l2 > 0)) return { pts: v, rect: false, rhombus: false, d: null };

  // Hai đường chéo bằng nhau ⇒ bốn góc vuông. Chỉ đụng tới độ dài.
  const rect = Math.abs(d.l1 - d.l2) <= RECT_RATIO * Math.max(d.l1, d.l2);
  if (rect) d.l1 = d.l2 = (d.l1 + d.l2) / 2;

  // Hai đường chéo vuông góc ⇒ bốn cạnh bằng nhau. Chỉ đụng tới hướng, và chia
  // đôi phần phải sửa cho mỗi đường chéo để tâm với hướng chung của hình không
  // bị xoay theo.
  let gap = d.a2 - d.a1;
  while (gap > Math.PI) gap -= 2 * Math.PI;
  while (gap <= -Math.PI) gap += 2 * Math.PI;
  const rhombus = Math.abs(Math.abs(gap) - Math.PI / 2) <= RHOMBUS_DEG * DEG;
  if (rhombus) {
    const fix = ((Math.PI / 2 - Math.abs(gap)) / 2) * (gap >= 0 ? 1 : -1);
    d.a1 -= fix;
    d.a2 += fix;
  }
  return { pts: fromDiagonals(d), rect, rhombus, d };
}

// Hình đã vuông vắn mà còn nằm gần thẳng trục → dạng HỘP BAO. Trả null nếu nó
// nghiêng thật, và khi đó chỗ gọi giữ nguyên dạng bốn đỉnh.
function toBox(tight) {
  const { pts, d } = tight;
  if (!d) return null;
  if (tight.rect) {
    // Cạnh của chữ nhật: hai cạnh kề nhau là đủ, cạnh đối đã bằng nó rồi.
    const s = sides(pts);
    if (axisGap(s[0].ang) > AXIS_DEG * DEG) return null;
    // Cạnh nào ngang hơn thì nó là BỀ RỘNG. Hai cạnh vuông góc nhau nên chỉ cần
    // hỏi một cái.
    const flat = Math.abs(Math.cos(s[0].ang)) >= Math.abs(Math.sin(s[0].ang));
    const w = flat ? s[0].len : s[1].len;
    const h = flat ? s[1].len : s[0].len;
    return { kind: "rect", pts: round([d.cx - w / 2, d.cy - h / 2, d.cx + w / 2, d.cy + h / 2]) };
  }
  if (tight.rhombus) {
    // Hình thoi lưu bằng hộp bao thì bốn ĐỈNH của nó nằm ở giữa bốn mép hộp, tức
    // hộp được quyết định bởi hai ĐƯỜNG CHÉO chứ không phải bởi cạnh.
    if (axisGap(d.a1) > AXIS_DEG * DEG) return null;
    const flat = Math.abs(Math.cos(d.a1)) >= Math.abs(Math.sin(d.a1));
    const hx = flat ? d.l1 : d.l2;
    const hy = flat ? d.l2 : d.l1;
    return { kind: "diamond", pts: round([d.cx - hx, d.cy - hy, d.cx + hx, d.cy + hy]) };
  }
  return null;
}

// ĐỈNH CỦA NÉT GẤP KHÚC → hình chuẩn. `verts` là mảng phẳng [x0,y0,x1,y1,…]
// theo thứ tự đã vẽ, KHÔNG lặp lại đỉnh đầu ở cuối: cạnh khép kín là ngầm định
// với mọi hình đóng, và lặp lại nó ở đây thì một tam giác sẽ đếm ra bốn đỉnh.
//
// Trả null nghĩa là "không có kind nào tả được cái này" — với 5 đỉnh trở lên thì
// đúng là không có (xem VERTEX_NUMBERS bên shape.js). Chỗ gọi giữ nguyên nét gấp
// khúc, chỉ khép kín nó lại, và đó là câu trả lời đúng: người dùng đã đặt từng
// cái đỉnh một, nên thứ họ vẽ ra vẫn còn nguyên giá trị kể cả khi nó không mang
// tên nào.
export function snapPolygon(verts) {
  if (!Array.isArray(verts)) return null;
  const n = Math.floor(verts.length / 2);

  // Tam giác: ba cạnh đã thẳng sẵn (mỗi cạnh là một đoạn đã chốt), nên không còn
  // gì để nắn — việc duy nhất còn lại là ĐỔI KIND, và chỉ riêng nó đã đáng: từ
  // một nét bút gấp khúc thành một hình đóng, tô được, có tay cầm ở từng đỉnh.
  if (n === 3) return { kind: "triangle", pts: round(verts.slice(0, 6)) };
  if (n !== 4) return null;

  const v = verts.slice(0, 8);
  const s = sides(v);
  if (s.some((e) => e.len < MIN_SIDE)) return { kind: "quad", pts: round(v) };

  const tol = PARALLEL_DEG * DEG;
  // s[0] đối s[2], s[1] đối s[3].
  const gapA = angleGap(s[0].ang, s[2].ang);
  const gapB = angleGap(s[1].ang, s[3].ang);

  // HAI cặp song song ⇒ hình bình hành, và từ đó còn siết được tiếp.
  if (gapA <= tol && gapB <= tol) {
    const tight = tighten(v);
    return toBox(tight) || { kind: "quad", pts: round(tight.pts) };
  }

  // ĐÚNG MỘT cặp song song ⇒ hình thang. Ép cặp đó song song hẳn; cặp kia giữ
  // nguyên vì chính nó là thứ làm nên hình thang.
  const near = gapA <= gapB ? [s[0], s[2]] : [s[1], s[3]];
  if (Math.min(gapA, gapB) <= tol) {
    const ang = meanDirection(near);
    let out = alignSide(v, near[0], ang);
    // Cạnh thứ hai phải đọc lại từ mảng ĐÃ SỬA: alignSide dời hai đầu mút của
    // cạnh trước, mà `s` là ảnh chụp lúc chưa dời.
    out = alignSide(out, sides(out)[near[1].i], ang);
    return { kind: "quad", pts: round(out) };
  }

  // Không cặp nào song song: tứ giác bất kỳ, giữ đúng như đã vẽ. Vẫn đổi kind —
  // xem ghi chú ở nhánh tam giác.
  return { kind: "quad", pts: round(v) };
}
