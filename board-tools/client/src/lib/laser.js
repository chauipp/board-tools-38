import { PEN_COLORS } from "./pen.js";

// Bút laser: vệt sáng chạy theo con trỏ rồi tự tan. KHÔNG phải nét vẽ —
// không lưu vào board, không có lịch sử hoàn tác, không có id. Đây là lý do nó
// nằm ở file riêng thay vì thêm một `kind` nữa vào shape.js: mọi thứ trong
// drawings đều tồn tại vĩnh viễn, còn cái này sống đúng LASER_FADE_MS.
//
// Vì không ghi dữ liệu nên người CHỈ XEM cũng được dùng — khác hẳn bút, cục
// gôm, hình khối và text (xem chốt viewer ở server/index.js).

// Một điểm sống 900ms rồi rụng khỏi ĐUÔI vệt. Ngắn hơn thì vệt cụt ngủn, không
// kịp nhìn theo; dài hơn thì lia con trỏ một vòng là màn hình đầy vạch.
export const LASER_FADE_MS = 900;

// Trần số điểm. Ở nhịp chuột 120Hz và LASER_MIN_DIST bên dưới thì một vệt thật
// hiếm khi quá 60 điểm; trần này là lưới an toàn cho trường hợp lia rất nhanh
// (mỗi khung hình đi được cả trăm đơn vị) chứ không phải giới hạn thường gặp.
export const LASER_MAX_POINTS = 96;

// Điểm mới phải cách điểm cuối ít nhất chừng này (đơn vị toạ độ canvas) mới
// được nhận. Hai việc cùng lúc: bỏ nhiễu run tay, và cắt hẳn lưu lượng mạng khi
// con trỏ gần như đứng yên — không có chốt này thì chuột 1000Hz bơm cả nghìn
// điểm trùng nhau mỗi giây lên kênh live:laser.
export const LASER_MIN_DIST = 2;

// Bề rộng ĐẦU vệt tính bằng pixel MÀN HÌNH, không phải đơn vị canvas — khác hẳn
// PEN_WIDTHS. Nét bút cố ý dày lên khi phóng to ("mực trên giấy" — xem
// InkLayer.jsx), nhưng laser là cái que chỉ chứ không phải mực: nó phải giữ
// nguyên cỡ trên màn hình dù bảng đang zoom bao nhiêu. LaserLayer chia giá trị
// này cho view.scale.
export const LASER_WIDTHS = [5, 8, 12];

// Màu dùng chung hệ token với bút (PEN_COLORS) thay vì bịa một bảng riêng: nó
// đã có sẵn bảy màu hợp cả nền sáng lẫn nền tối, và người dùng đã quen bảng đó
// ở khu 4 của bút.
export const LASER_DEFAULT = { color: "pen-red", w: 8 };

const KEY = "ideamap.laser";

// Khoá localStorage RIÊNG, không nhét vào object của pen.js: hai thứ có đơn vị
// độ dày khác nhau (pixel màn hình vs đơn vị canvas), nên dùng chung một `w` là
// đổi độ đậm laser sẽ đổi luôn độ dày nét bút, và ngược lại.
export function loadLaserPrefs(storage) {
  let saved = null;
  try {
    saved = JSON.parse(storage.getItem(KEY));
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== "object") return { ...LASER_DEFAULT };
  // Lọc từng key: một giá trị hỏng không được làm mất luôn giá trị còn lại.
  return {
    color: PEN_COLORS.includes(saved.color) ? saved.color : LASER_DEFAULT.color,
    w: LASER_WIDTHS.includes(saved.w) ? saved.w : LASER_DEFAULT.w
  };
}

export function saveLaserPrefs(storage, prefs) {
  try {
    storage.setItem(KEY, JSON.stringify({ color: prefs.color, w: prefs.w }));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất lựa chọn laser, không đáng làm sập app.
  }
}

// Lọc gói từ mạng. Server chỉ chặn được "chuỗi ngắn" và "số trong biên độ"; ở
// đây mới biết được đâu là token màu THẬT và đâu là bề rộng có trong bảng.
// Không lọc thì một client lỗi gửi w = 63 là vệt của họ phủ ngang màn hình mọi
// người, và một token màu lạ làm vệt mất màu hẳn (var(--gì-đó) không tồn tại).
export function sanitizeLaserStyle(color, w) {
  return {
    color: PEN_COLORS.includes(color) ? color : LASER_DEFAULT.color,
    w: LASER_WIDTHS.includes(w) ? w : LASER_DEFAULT.w
  };
}

// Thêm một điểm vào vệt. Trả về CHÍNH mảng cũ nếu điểm bị chối (quá gần điểm
// cuối) — người gọi so sánh tham chiếu để biết có phải phát lên mạng không, nhờ
// vậy vệt của mình và vệt người khác thấy luôn gồm đúng cùng một tập điểm.
export function pushLaserPoint(pts, x, y, now) {
  const last = pts.length ? pts[pts.length - 1] : null;
  if (last && Math.hypot(x - last.x, y - last.y) < LASER_MIN_DIST) return pts;
  const next = pts.concat({ x, y, t: now });
  return next.length > LASER_MAX_POINTS ? next.slice(next.length - LASER_MAX_POINTS) : next;
}

// Rụng những điểm đã hết hạn. Điểm xếp theo thời gian tăng dần nên chỉ cần cắt
// một khúc đầu mảng, không phải lọc cả mảng.
//
// Trả về CHÍNH mảng cũ khi không có gì rụng: vòng lặp rAF gọi hàm này 60
// lần/giây cho từng vệt, và LaserLayer dựa vào phép so tham chiếu để biết có
// cần vẽ lại hay không.
export function trimLaserTrail(pts, now) {
  const cut = now - LASER_FADE_MS;
  let i = 0;
  while (i < pts.length && pts[i].t <= cut) i++;
  return i === 0 ? pts : pts.slice(i);
}

function fmt(v) {
  return Math.round(v * 10) / 10;
}

// Viền ngoài của vệt, dạng chuỗi `d` của một hình KÍN để tô đặc — không phải
// một đường để kẻ.
//
// Vì sao không kẻ một <polyline> cho xong: vệt laser phải thon dần về đuôi, mà
// stroke-width của SVG là một số duy nhất cho cả đường. Cách còn lại là chẻ vệt
// thành mấy chục đoạn <line> mỗi đoạn một bề rộng — tức mấy chục phần tử DOM
// cho mỗi người, vẽ lại 60 lần/giây. Ở đây một vệt là ĐÚNG MỘT <path>.
//
// Nửa bề rộng chạy tuyến tính từ 0 ở đuôi tới headW/2 ở đầu, lấy pháp tuyến của
// hướng đi tại từng điểm (dùng điểm trước và điểm sau để hướng không giật ở
// những khúc gấp).
export function laserOutline(pts, headW) {
  const n = pts.length;
  if (n < 2) return "";
  const half = headW / 2;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[i === 0 ? 0 : i - 1];
    const next = pts[i === n - 1 ? n - 1 : i + 1];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    // Hai điểm trùng nhau (không xảy ra với LASER_MIN_DIST, nhưng gói từ mạng
    // thì không có gì bảo đảm): lấy một hướng bất kỳ thay vì chia cho 0.
    if (len > 0) { dx /= len; dy /= len; } else { dx = 1; dy = 0; }
    const r = half * (i / (n - 1));
    left.push(fmt(p.x - dy * r) + " " + fmt(p.y + dx * r));
    right.push(fmt(p.x + dy * r) + " " + fmt(p.y - dx * r));
  }
  right.reverse();
  return "M" + left.join("L") + "L" + right.join("L") + "Z";
}
