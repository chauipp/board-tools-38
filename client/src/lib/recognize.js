// Nhận hình từ nét vẽ tay: vẽ xong một đường rồi GIỮ TAY tại chỗ, nét tự nhảy về
// hình chuẩn gần nhất — đường thẳng, ê-líp/tròn, chữ nhật/vuông, hình thoi, tam
// giác bất kỳ, tứ giác bất kỳ. Không dính React, không đụng DOM: nhờ vậy test
// được bằng node:test.
//
// KẾT QUẢ TRẢ VỀ dùng đúng khuôn của hình khối có sẵn — { kind, pts } với pts ở
// dạng hộp bao hoặc dạng đỉnh thật (xem shape.js). Cố ý: nét được nhận thành
// hình sẽ đi tiếp qua đúng đường của tool Hình khối — cùng cách vẽ, cùng
// hit-test của cục gôm, cùng lịch sử hoàn tác, cùng gói live. Không có loại vật
// thể mới nào sinh ra ở đây.

import { distToSegment, distToPolyline } from "./stroke.js";
import { shapeOutline } from "./shape.js";

// Giữ tay bao lâu thì chốt. Mốc thiết kế vẫn là 1200ms — đủ dài để không bắt
// hình oan khi người ta chỉ ngập ngừng giữa nét, mà ngắn hơn thì cảm giác "vẽ
// xong rồi phải đợi" bắt đầu thấy rõ.
//
// Con số ở đây là 900 chứ không phải 1200 vì nó KHÔNG phải cái người dùng cảm
// thấy. Phép đo "tay đã đứng chưa" (createStillWatch bên pointer-input.js) nhìn
// lui một cửa sổ 500ms, nên trong khoảng đó nó còn thấy cái đuôi của nét vừa vẽ
// và còn đặt lại đồng hồ thêm chừng 300ms sau khi tay đã thật sự dừng. Đo trên
// 400 lượt mô phỏng (vẽ 120 px/giây rồi giữ tay): chờ 900 cho độ trễ THẬT kể từ
// lúc tay dừng là 1228ms, chờ 1200 thì thành 1528ms — tức để nguyên 1200 là âm
// thầm đội thời gian chờ lên gần cái 1500ms mà ghi chú cũ đã cố tránh.
export const SNAP_HOLD_MS = 900;

// Đứng yên bao lâu thì hiện vòng báo "đang chờ bắt hình". Trễ một nhịp để nó
// không nhấp nháy theo từng lần ngập ngừng của tay.
export const SNAP_HINT_MS = 220;

// Bán kính "đã RỜI KHỎI CHỖ ẤN XUỐNG", tính bằng pixel MÀN HÌNH — không phải
// đơn vị canvas: tay người rung chừng vài pixel bất kể bảng đang zoom bao nhiêu,
// nên ngưỡng này không được co giãn theo scale.
//
// Đây KHÔNG phải phép đo "đang đứng yên" — hai thứ đó từng dùng chung một hằng
// số và đó là lỗi. Cái này đo từ một mốc CỐ ĐỊNH (chỗ mousedown) và trả lời
// "cú này còn là một cú giữ tay tại chỗ, hay đã thành một cú kéo?" — dùng cho
// giữ-để-tẩy và giữ-để-đổi-bút, nơi ngưỡng chặt là đúng. Còn "tay đang đi hay
// đang đứng" là phép đo VẬN TỐC, xem STILL_TOL bên pointer-input.js.
export const SNAP_MOVE_TOL = 6;

// Nét ngắn hơn chừng này (đường chéo hộp bao, đơn vị canvas) thì không đoán:
// một vệt 10 đơn vị thì hình gì cũng khớp, và đoán sai ở đó chỉ gây phiền.
const MIN_DIAG = 14;

// Số điểm tối thiểu để ĐOÁN XEM NÉT NÀY GIỐNG HÌNH GÌ. Ít hơn thì phép đo trung
// bình sai số không nói được gì: bốn điểm thì hình nào cũng khớp.
const MIN_POINTS = 6;

// Nhưng NẮN VỀ ĐOẠN THẲNG thì không cần con số đó, và đây không phải một chỗ nới
// lỏng cho tiện — hai việc hỏi hai câu khác hẳn nhau. "Nét này giống hình gì" là
// một phép thống kê, cần mẫu. "Tay đi từ đây tới kia" thì hai đầu là đủ, và điểm
// thứ ba không làm câu trả lời chắc hơn tí nào.
//
// Đòi cả sáu điểm cho cả hai việc là cái đã làm hỏng ĐÚNG những nét ngắn: một
// nét ngắn vẽ nhanh chỉ kịp ba bốn nhịp mousemove (nhịp đi theo khung hình, nên
// số nhịp là hệ quả của việc vẽ LÂU HAY MAU chứ không phải của hình vẽ ra), và
// con chuột đặt trên bàn lúc giữ tay thì không sinh thêm nhịp nào. Nét dài thì
// riêng phần vẽ đã dư điểm nên không bao giờ chạm chốt — thành ra nét dài giữ là
// thẳng, nét ngắn giữ mãi không ra gì, mà chẳng có gì giải thích sự khác nhau đó.
//
// Cùng một bài học "đừng đo bằng số điểm" đã ghi ở pathLength và resample bên
// dưới, chỗ này là lần thứ ba nó xuất hiện trong cùng một file.
const LINE_MIN_POINTS = 2;

// Đường thẳng đo bằng HAI ngưỡng, và cần cả hai vì mỗi cái bắt một kiểu hỏng
// khác nhau (tỉ lệ với đường chéo):
//   TRUNG BÌNH — chặn cái cong đều. Một cung cong thoai thoải lệch ít ở mọi
//     điểm nhưng lệch ở KHẮP NƠI, nên trung bình bắt được còn đỉnh thì không
//     nếu để ngưỡng đỉnh rộng.
//   ĐỈNH — chặn cái gấp khúc. Nét gãy làm đôi có trung bình nhỏ (hai đầu vẫn sát
//     dây cung) nhưng chỗ gãy vọt lên, nên phải có ngưỡng riêng cho điểm tệ nhất.
// Chỉ đo đỉnh như bản đầu thì một nét dài hơi vênh ở giữa — thứ tay người vẽ ra
// suốt — bị loại oan dù nhìn rõ ràng là một đường thẳng.
//
// Đo trên nét thật của người dùng: một đường "thẳng" vẽ tay dài chừng 350 đơn vị
// cho trung bình 0,033 và đỉnh 0,056 — tức nó võng chừng 5% khổ hình mà mắt vẫn
// đọc là thẳng. Ngưỡng để ở 0,05 cho có khoảng dư một nửa, chứ sát quá thì nét
// hôm nay bắt được, nét mai vênh thêm tí là không.
//
// Ngưỡng đỉnh 0,085 để cả hai phép ĐỀU có việc, đo trên ba nét mẫu: đường thẳng
// vẽ tay (tb 0,031 · đỉnh 0,056) qua được cả hai; cung võng 8% khổ (0,054 ·
// 0,082) chết ở phép trung bình; nét zíc zắc (0,043 · 0,089) lọt trung bình
// nhưng chết ở phép đỉnh. Để đỉnh rộng như bản trước (0,12) thì phép trung bình
// chặn hết mọi thứ và phép đỉnh chỉ là đồ trang trí.
const LINE_DEV = 0.05;
const LINE_DEV_MAX = 0.085;

// Đi lòng vòng rồi mới tới đích: đường thẳng thật có chiều dài xấp xỉ dây cung.
const LINE_SLACK = 1.3;

// Bước đo chiều dài đường đi, tỉ lệ với đường chéo. Xem pathLength: đo từng đoạn
// một là đo cái RUNG TAY chứ không đo cái nét.
const LENGTH_STEP = 0.02;

// Hai đầu nét cách nhau dưới chừng này (tỉ lệ đường chéo) thì coi như nét kín.
const CLOSE_GAP = 0.3;

// Hộp bao dẹt hơn tỉ lệ này thì không có hình kín nào hợp — thường là một nét đi
// rồi về trên cùng một đường.
const MIN_FLATNESS = 0.1;

// Sai số trung bình (tỉ lệ đường chéo) mà hình mẫu khớp nhất vẫn phải đạt. Trên
// ngưỡng này là nét tay không giống hình nào cả: thà không bắt còn hơn bắt sai.
const FIT_TOL = 0.075;

// Tỉ lệ hai chiều nằm trong khoảng này thì ép về vuông / tròn đều. Chính là chỗ
// "ê-líp → tròn, chữ nhật → vuông": ngoài khoảng này thì giữ nguyên tỉ lệ đã vẽ,
// vì một chữ nhật dài rõ ràng là người ta muốn chữ nhật.
const SQUARE_LO = 0.82;
const SQUARE_HI = 1.22;

// Bán kính "chùm điểm lúc đứng yên" (tỉ lệ đường chéo) và số điểm tối thiểu để
// coi một chùm là ĐỨNG YÊN chứ không phải vẽ chậm. Xem trimHold.
//
// Cần cả ngưỡng đếm chứ không chỉ ngưỡng bán kính: mấy điểm đầu của một nét
// bình thường bao giờ chẳng nằm trong bán kính đó, cắt chúng đi thì điểm A xê
// dịch một chút ở MỌI nét — mà giữ đúng A với B lại chính là điều cần giữ.
const HOLD_TOL = 0.02;
const HOLD_MIN_POINTS = 8;

// Hình đơn giản hơn (chữ nhật, hình thoi, tam giác) được cộng thêm chừng này sai
// số mà vẫn thắng tứ giác bốn đỉnh tự do. Xem ghi chú ở chỗ dùng trong
// recognizeShape: không có nó thì mọi hình kín đều ra "tứ giác hơi méo".
//
// ĐƠN VỊ của khoản ưu ái này là CẠNH NGẮN của hộp bao, không phải đường chéo
// như mọi sai số khác trong file. Không phải cho gọn — đo bằng đường chéo là
// SAI, và sai đúng ở loại hình mà tính năng này sinh ra để bắt:
//
//   Một hình bình hành BẸT — rộng 282, cao 49 — lệch khỏi chữ nhật đúng ở hai
//   cạnh xiên, mà hai cạnh đó chỉ dài bằng chiều CAO. Chia sai số cho đường
//   chéo (282, tức gần bằng chiều rộng) là chia cho một con số không liên quan
//   gì tới chỗ sai: hiệu rect−quad tụt xuống còn 0,0085 và bị nuốt. Cũng hình
//   bình hành đó vẽ vuông vắn hơn thì hiệu là 0,0303 — gấp bốn lần, dù mắt
//   người thấy hai hình xiên như nhau.
//
// Chia cho cạnh ngắn thì hai trường hợp về cùng một thang, và con số dưới đây
// bị kẹp từ hai phía bằng sai số đo thật (đơn vị cạnh ngắn):
//   sàn  — chữ nhật vẽ tay 0,006 · chữ nhật bẹt 0,015 · hình vuông 0,003;
//          dưới ngưỡng này thì chữ nhật vẽ tay bị tứ giác cướp mất.
//   trần — hình bình hành bẹt 0,050 · hình bình hành vuông vắn 0,062 · hình
//          thang 0,078; vượt quá thì chính chúng bị hạ về chữ nhật.
const REGULAR_BIAS = 0.028;

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

// Chiều dài đường đi, đo bằng những bước dài `step` chứ không cộng từng đoạn
// giữa hai điểm liên tiếp.
//
// ĐÂY LÀ CHỖ PHẢI CẨN THẬN. Cộng từng đoạn thì con số nhận được phụ thuộc vào
// việc người ta vẽ NHANH HAY CHẬM, không phụ thuộc vào hình vẽ ra: vẽ chậm thì
// mousemove bắn dày, hai điểm liên tiếp cách nhau một hai đơn vị, mà tay rung
// cũng chừng đó — nên mỗi đoạn dài hơn phần thật nó đi được tới vài chục phần
// trăm, và tổng thì phình theo số điểm. Đo một nét thẳng vẽ chậm bằng cách đó ra
// 1,31 lần dây cung, tức nó bị loại khỏi nhánh đường thẳng TRƯỚC KHI kịp đo xem
// có thẳng không. Cùng một nét vẽ nhanh thì ra 1,01 và được nhận.
//
// Bước đo tỉ lệ với đường chéo nên không có hằng số tuyệt đối nào phải chỉnh
// theo mức zoom, và cái rung tay — luôn nhỏ hơn hẳn 2% khổ hình — bị nuốt hết.
function pathLength(pts, step) {
  let sum = 0;
  let ax = pts[0], ay = pts[1];
  for (let i = 2; i + 3 < pts.length; i += 2) {
    const d = Math.hypot(pts[i] - ax, pts[i + 1] - ay);
    if (d < step) continue;
    sum += d;
    ax = pts[i]; ay = pts[i + 1];
  }
  return sum + Math.hypot(pts[pts.length - 2] - ax, pts[pts.length - 1] - ay);
}

// Sai số TRUNG BÌNH, không phải lớn nhất: một cái móc nhỏ ở chỗ bắt đầu/kết thúc
// nét là chuyện thường của tay người, mà sai số lớn nhất thì bị đúng cái móc đó
// quyết định hết.
function meanDist(pts, outline) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    sum += distToPolyline(outline, pts[i], pts[i + 1]);
    n++;
  }
  return n ? sum / n : Infinity;
}

// Cửa sổ đo góc ngoặt, tính theo tỉ lệ số điểm của nét. Phải đủ rộng để cái run
// tay không đọc thành một cái góc, và đủ hẹp để hai góc gần nhau không nhoè vào
// nhau.
const CORNER_WINDOW = 0.07;

// Số điểm mà nét được rải lại trước khi dò góc. Xem resample ngay dưới.
const CORNER_SAMPLES = 64;

// RẢI LẠI NÉT THÀNH ĐÚNG N ĐIỂM CÁCH ĐỀU THEO CHIỀU DÀI ĐƯỜNG ĐI.
//
// ĐÂY LÀ CHỖ PHẢI CẨN THẬN, và là đúng cái bẫy mà pathLength ở trên đã dính một
// lần: số điểm của một nét là hệ quả của việc vẽ NHANH HAY CHẬM, không phải của
// hình vẽ ra. mousemove bắn theo khung hình, nên cùng một tam giác vẽ trong 0,2
// giây cho chừng chục điểm còn vẽ thong thả cho vài trăm.
//
// Hai chỗ trong polygonCorners đo bằng SỐ ĐIỂM:
//   cửa sổ đo góc  w = m * CORNER_WINDOW
//   bán kính triệt tiêu hai đỉnh sát nhau (cũng là w)
// Ý nghĩa mong muốn của cả hai là "một quãng ngắn dọc theo nét" — tức một tỉ lệ
// của CHIỀU DÀI. Chúng chỉ trùng nhau khi điểm rải đều. Với nét thật thì không,
// nên một tam giác vẽ nhanh có m = 10 rơi thẳng vào chốt `m < n * 4` (cần 12),
// tam giác KHÔNG được đưa vào danh sách ứng viên, và trong ba hình còn lại thì
// chữ nhật thắng — vẽ tam giác ra chữ nhật, đúng như đã gặp.
//
// Rải lại rồi mới đo thì CORNER_WINDOW mang đúng nghĩa mà ghi chú của nó nói:
// 7% chiều dài nét, bất kể người ta vẽ nhanh hay chậm.
//
// Cố ý KHÔNG lấy điểm cuối: polygonCorners đọc mảng như một VÒNG KÍN (chỉ số
// chạy qua `% m`), nên một điểm cuối trùng điểm đầu sẽ thành hai điểm chồng nhau
// ở cùng một chỗ.
function resample(pts, count) {
  const n = Math.floor(pts.length / 2);
  if (n < 2) return pts;
  const acc = new Array(n);
  acc[0] = 0;
  for (let i = 1; i < n; i++) {
    acc[i] = acc[i - 1] + Math.hypot(pts[i * 2] - pts[(i - 1) * 2], pts[i * 2 + 1] - pts[(i - 1) * 2 + 1]);
  }
  const total = acc[n - 1];
  if (!(total > 0)) return pts;

  const out = [];
  let seg = 1;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (seg < n - 1 && acc[seg] < target) seg++;
    const span = acc[seg] - acc[seg - 1];
    const u = span > 0 ? (target - acc[seg - 1]) / span : 0;
    const ax = pts[(seg - 1) * 2], ay = pts[(seg - 1) * 2 + 1];
    out.push(ax + (pts[seg * 2] - ax) * u, ay + (pts[seg * 2 + 1] - ay) * u);
  }
  return out;
}

// Ngoặt dưới chừng này thì không phải góc. Đây cũng là chốt tách TAM GIÁC khỏi
// tứ giác: ép một tam giác thành bốn đỉnh thì đỉnh thứ tư phải rơi vào giữa một
// cạnh, mà ở giữa cạnh thì không có cú ngoặt nào cả.
const CORNER_MIN_DEG = 35;

// N ĐỈNH của đa giác mà nét tay vẽ ra, theo đúng thứ tự đi vòng quanh.
//
// Đỉnh là chỗ nét NGOẶT GẤP NHẤT — không phải chỗ lệch xa nhất khỏi một dây cung.
// Khác biệt này quyết định: với một HÌNH THANG, dây cung nối hai góc đáy chạy dọc
// cạnh đáy, nên CẢ CẠNH TRÊN đều cách nó đúng chiều cao hình. Chọn theo "xa nhất"
// thì cái run tay quyết định lấy điểm nào trên cạnh trên — và nó lấy một điểm ở
// GIỮA cạnh thay vì một góc. Chọn theo góc ngoặt thì giữa cạnh có ngoặt bằng 0,
// bất kể nó cách dây cung bao xa.
//
// Cách đo: tại mỗi điểm, lấy hướng đi TỚI nó (từ điểm cách w bước phía trước) và
// hướng đi TIẾP (tới điểm cách w bước phía sau), rồi lấy góc giữa hai hướng đó.
// Nét chạy thẳng thì hai hướng trùng nhau (góc 0), tới góc thì chúng tách ra.
function polygonCorners(raw, n) {
  // Rải lại TRƯỚC mọi phép đo: cả hàm này đo bằng số điểm, mà số điểm của nét
  // thô là hệ quả của tốc độ vẽ. Xem ghi chú dài ở resample.
  const pts = resample(raw, CORNER_SAMPLES);
  const m = Math.floor(pts.length / 2);
  // Cần đủ điểm để mỗi cạnh còn dài hơn cửa sổ đo, không thì mọi điểm đều "đang
  // ngoặt" và phép đo mất nghĩa. Sau khi rải lại thì chốt này gần như luôn thoả;
  // giữ nó cho trường hợp resample trả về nguyên nét thô (nét suy biến, dài 0).
  if (m < n * 4) return null;
  const at = (i) => ({ x: pts[i * 2], y: pts[i * 2 + 1] });
  const w = Math.max(2, Math.round(m * CORNER_WINDOW));

  const ang = new Array(m);
  for (let i = 0; i < m; i++) {
    const p = at(i);
    const a = at((i - w + m) % m);
    const b = at((i + w) % m);
    const v1x = p.x - a.x, v1y = p.y - a.y;
    const v2x = b.x - p.x, v2y = b.y - p.y;
    ang[i] = Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
  }

  // Lấy n cú ngoặt gấp nhất, nhưng KHÔNG lấy hai cái sát nhau: quanh một cái góc
  // thì cả một vạt điểm đều ngoặt, và nếu không triệt tiêu thì bốn "đỉnh" tìm
  // được sẽ là bốn điểm cạnh nhau ở cùng một góc.
  const minRad = (CORNER_MIN_DEG * Math.PI) / 180;
  const order = Array.from({ length: m }, (_, i) => i).sort((i, j) => ang[j] - ang[i]);
  const picked = [];
  for (const i of order) {
    if (ang[i] < minRad) break;
    // Khoảng cách theo VÒNG: điểm đầu và điểm cuối của một nét kín nằm sát nhau.
    if (picked.some((j) => Math.min(Math.abs(i - j), m - Math.abs(i - j)) < w)) continue;
    picked.push(i);
    if (picked.length === n) break;
  }
  if (picked.length < n) return null;
  // Sắp theo thứ tự nét vẽ: đa giác đi vòng quanh theo đúng chiều tay đã đi, nên
  // nó không bao giờ tự cắt.
  picked.sort((a, b) => a - b);
  return picked.map(at);
}

function roundBox(l, t, r, b) {
  return [Math.round(l), Math.round(t), Math.round(r), Math.round(b)];
}

// Ép về vuông/tròn đều quanh TÂM CŨ: giữ nguyên chỗ người ta vẽ, chỉ sửa tỉ lệ.
function regularize(box) {
  const ratio = box.h === 0 ? Infinity : box.w / box.h;
  if (!(ratio >= SQUARE_LO && ratio <= SQUARE_HI)) return roundBox(box.l, box.t, box.r, box.b);
  const side = (box.w + box.h) / 2;
  const cx = box.l + box.w / 2;
  const cy = box.t + box.h / 2;
  return roundBox(cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2);
}

// CẮT VẠT ĐIỂM SINH RA LÚC ĐỨNG YÊN, ở cả hai đầu nét.
//
// Cả tính năng này chạy bằng cách GIỮ TAY một chỗ 1,2 giây — tức hơn bảy chục
// khung hình, mà chuột và touchpad thì rung một hai pixel mỗi khung. Nét đưa
// vào đây vì thế có một chùm mấy chục điểm chồng lên nhau ở đúng chỗ dừng, và
// chùm đó phá cả hai phép đo bên dưới:
//   ĐƯỜNG THẲNG — mỗi điểm rung cộng thêm vào chiều dài đường đi mà không cộng
//     vào khoảng cách hai đầu, nên len/gap phình lên và nét trượt LINE_SLACK.
//     Giữ càng lâu càng trượt: đúng cái thao tác dùng để bắt hình lại là cái
//     làm hỏng phép nhận hình.
//   DÒ GÓC — hướng đi giữa hai điểm rung liền nhau là ngẫu nhiên, nên góc ngoặt
//     ở đó gấp hơn cả góc thật của hình và chùm này chiếm hết suất đỉnh.
// Người ta cũng hay ngập ngừng một nhịp trước khi kéo, nên cắt đối xứng hai đầu.
function trimHold(pts, diag) {
  const tol = Math.max(2, diag * HOLD_TOL);
  const n = pts.length / 2;
  const near = (i, x, y) => Math.hypot(pts[i * 2] - x, pts[i * 2 + 1] - y) <= tol;
  let end = n - 1;
  while (end > 0 && near(end - 1, pts[(n - 1) * 2], pts[(n - 1) * 2 + 1])) end--;
  if (n - end < HOLD_MIN_POINTS) end = n - 1;
  let start = 0;
  while (start < end && near(start + 1, pts[0], pts[1])) start++;
  if (start + 1 < HOLD_MIN_POINTS) start = 0;
  return start === 0 && end === n - 1 ? pts : pts.slice(start * 2, (end + 1) * 2);
}

// Dọn nét thô về những con số mà mọi phép đo bên dưới đều cần: cắt vạt điểm
// đứng yên, chốt kích thước tối thiểu, lấy hai đầu A/B và khoảng cách giữa
// chúng. Tách ra vì snapShape cũng cần ĐÚNG những con số này — nhất là hai đầu
// phải lấy từ nét ĐÃ CẮT, không thì điểm B là một điểm rung tay trong chùm
// đứng yên chứ không phải chỗ người ta thật sự dừng bút.
function prepare(raw, need = MIN_POINTS) {
  if (!raw || typeof raw.length !== "number") return null;
  if (Math.floor(raw.length / 2) < need) return null;

  const rawBox = bbox(raw);
  const pts = trimHold(raw, Math.hypot(rawBox.w, rawBox.h));
  if (Math.floor(pts.length / 2) < need) return null;

  const box = bbox(pts);
  const diag = Math.hypot(box.w, box.h);
  if (!(diag >= MIN_DIAG)) return null;

  const x0 = pts[0], y0 = pts[1];
  const x1 = pts[pts.length - 2], y1 = pts[pts.length - 1];
  return { pts, box, diag, x0, y0, x1, y1, gap: Math.hypot(x1 - x0, y1 - y0) };
}

// Hai đầu nét có ĐỦ XA nhau để một đoạn thẳng nối chúng còn nói lên điều gì
// không. Cũng chính là chốt "nét này không kín" — nên hai chỗ dùng chung một
// phép, không lệch nhau được.
function isOpenStroke({ gap, diag }) {
  return gap > Math.max(diag * CLOSE_GAP, 8);
}

// Nét tay → hình chuẩn, hoặc null nếu không giống hình nào. `raw` là mảng phẳng
// [x0,y0,x1,y1,…] toạ độ canvas, đúng thứ useInk đang tích trong ptsRef.
export function recognizeShape(raw) {
  const prep = prepare(raw);
  if (!prep) return null;
  const { pts, box, diag, x0, y0, x1, y1, gap } = prep;
  const len = pathLength(pts, diag * LENGTH_STEP);

  // ĐƯỜNG THẲNG xét trước mọi hình kín: nó là trường hợp duy nhất mà hộp bao có
  // thể dẹt tới mức các phép đo hình kín mất nghĩa.
  if (len <= gap * LINE_SLACK) {
    let worst = 0, sum = 0, count = 0;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const d = distToSegment(pts[i], pts[i + 1], x0, y0, x1, y1);
      if (d > worst) worst = d;
      sum += d;
      count++;
    }
    const mean = count ? sum / count : Infinity;
    if (mean <= Math.max(diag * LINE_DEV, 1.5) && worst <= Math.max(diag * LINE_DEV_MAX, 4)) {
      // ĐÚNG hai đầu A và B như đã vẽ, không bẻ gì thêm. Bản trước còn xoay nét
      // về mốc 45° gần nhất khi đã sát: nghe thì tiện, nhưng nó lấy mất quyền
      // đặt điểm B — vẽ một đường gần ngang mà muốn nó hơi dốc thì không cách
      // nào giữ được, vì mỗi lần giữ tay là nó lại bị nắn về ngang.
      return { kind: "line", pts: roundBox(x0, y0, x1, y1) };
    }
  }

  // HÌNH KÍN. Hai chốt: hai đầu phải gần nhau, và hộp bao không được dẹt — nét đi
  // rồi về trên cùng một đường cũng có hai đầu trùng nhau nhưng không phải hình.
  if (isOpenStroke(prep)) return null;
  if (Math.min(box.w, box.h) < diag * MIN_FLATNESS) return null;

  const rect = [box.l, box.t, box.r, box.b];
  const candidates = [
    { kind: "rect", outline: shapeOutline("rect", rect) },
    { kind: "ellipse", outline: shapeOutline("ellipse", rect) },
    { kind: "diamond", outline: shapeOutline("diamond", rect) }
  ];
  // Đa giác đo bằng ĐÚNG các đỉnh vừa tìm được, không phải bằng một hình chuẩn
  // dựng từ hộp bao: đo bằng hình chuẩn thì một tam giác vuông hay một hình bình
  // hành vẽ tay lệch quá ngưỡng và bị bỏ hẳn, dù chúng rõ ràng là hình gì.
  for (const [kind, verts] of [
    ["triangle", polygonCorners(pts, 3)],
    ["quad", polygonCorners(pts, 4)]
  ]) {
    if (!verts) continue;
    const flat = verts.flatMap((v) => [v.x, v.y]);
    candidates.push({ kind, outline: flat.concat([flat[0], flat[1]]), pts: flat.map(Math.round) });
  }

  let best = null;
  for (const c of candidates) {
    if (!c.outline.length) continue;
    const err = meanDist(pts, c.outline) / diag;
    if (!best || err < best.err) best = { ...c, err };
  }
  if (!best || best.err > FIT_TOL) return null;

  // NHƯỜNG HÌNH ĐƠN GIẢN HƠN khi sai số xấp xỉ nhau. Tứ giác bốn đỉnh tự do là
  // ứng viên DỄ DÃI NHẤT — nó bám được đúng bốn góc run tay của một chữ nhật, và
  // với một tam giác nó thừa ra một đỉnh nằm ngay trên cạnh nên vẫn khớp gần y
  // hệt. Lấy đơn thuần sai số nhỏ nhất thì gần như mọi hình kín đều ra "tứ giác
  // hơi méo", tức tính năng bắt hình mất đúng phần giá trị của nó. Nên tứ giác
  // chỉ thắng khi nó hơn HẲN — đúng lúc hình vẽ thật sự không phải chữ nhật,
  // hình thoi hay tam giác (một hình bình hành xiên, một hình thang).
  if (best.kind === "quad") {
    const simpler = candidates
      .filter((c) => c.kind !== "quad" && c.kind !== "ellipse")
      .map((c) => ({ ...c, err: meanDist(pts, c.outline) / diag }))
      .sort((a, b) => a.err - b.err)[0];
    // REGULAR_BIAS tính theo cạnh ngắn, còn `err` tính theo đường chéo — quy về
    // cùng thang ở đây. Xem ghi chú dài ở chỗ khai báo hằng số.
    const bias = (REGULAR_BIAS * Math.min(box.w, box.h)) / diag;
    if (simpler && simpler.err <= best.err + bias) best = simpler;
  }

  // Đa giác trả về ĐỈNH THẬT (xem ghi chú đầu shape.js), nên nó giữ nguyên dáng
  // đã vẽ — tam giác vuông/tù/bè, hình bình hành, hình thang đều được, chỉ cạnh
  // là được nắn thẳng. Cũng vì thế nó không đi qua regularize: "ép tỉ lệ về
  // vuông" là phép của hộp bao, áp vào đỉnh thật thì chỉ làm méo đúng cái dáng
  // vừa giữ được.
  return { kind: best.kind, pts: best.pts || regularize(box) };
}

// ĐÂY mới là thứ cử chỉ "giữ tay" gọi, không phải recognizeShape.
//
// Khác nhau ở chỗ: recognizeShape trả lời "nét này GIỐNG hình gì", còn hàm này
// trả lời "giữ tay xong thì RA cái gì". Khi không nhận ra hình nào, câu trả lời
// đúng không phải là im lặng — người dùng đã chủ động giữ tay hơn một giây để
// yêu cầu nắn lại nét, mà cử chỉ không làm gì cả thì họ chỉ thấy tính năng hỏng.
// Đoạn thẳng nối điểm đầu với điểm cuối là câu trả lời hợp lý duy nhất còn lại:
// nó giữ đúng hai đầu người ta đã đặt, và một nét "định vẽ thẳng nhưng hơi gãy ở
// giữa" — thứ trượt cả phép đo đường thẳng lẫn mọi hình kín — chính là trường
// hợp hay gặp nhất.
//
// ĐÁNH ĐỔI, cố ý: một đường cong HỞ (cung, chữ S) mà giữ tay sẽ bị nắn thẳng.
// Không có cách nào vừa cứu được nét gãy vừa tha cho cung cong, vì với máy thì
// hai thứ đó chỉ khác nhau ở mức độ. Chọn theo chủ ý của thao tác: giữ tay là
// yêu cầu nắn, không giữ thì nét tay được để nguyên. Ctrl+Z trả lại nét cũ.
//
// Hai chốt vẫn giữ. Nét KÍN không rơi vào đây: hai đầu chập nhau thì "đoạn thẳng
// nối hai đầu" là một mẩu cụt chẳng liên quan gì tới thứ đã vẽ — thà không làm
// gì. Và đoạn thẳng phải đủ dài (MIN_DIAG) mới đáng thay cho cả một nét.
export function snapShape(raw) {
  return recognizeShape(raw) || snapLine(raw);
}

// CHỈ đoạn thẳng nối hai đầu, không đoán hình gì khác. Tách ra khỏi snapShape vì
// cử chỉ dựng NÉT GẤP KHÚC cần đúng phép này: khi đang chốt dần từng cạnh của
// một hình, mỗi lần giữ tay chỉ được ra một đoạn thẳng — để snapShape đoán tự do
// thì một cạnh vẽ hơi vòng sẽ ra một cái ê-líp và cả cái hình đang dựng dở bị
// vứt đi. Việc đoán hình để dành cho lúc khép vòng (polygon-snap.js), khi đã có
// đủ các đỉnh để nói chắc chắn.
export function snapLine(raw) {
  const prep = prepare(raw, LINE_MIN_POINTS);
  if (!prep || !isOpenStroke(prep) || prep.gap < MIN_DIAG) return null;
  return { kind: "line", pts: roundBox(prep.x0, prep.y0, prep.x1, prep.y1) };
}
