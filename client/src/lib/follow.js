// Toán của tính năng ghim màn hình: đổi khung nhìn của NGƯỜI KHÁC thành khung
// nhìn của MÌNH.
//
// Chỗ dễ làm sai nhất là tưởng chỉ cần copy panX/panY/scale. Không được: máy họ
// 2560px, máy mình 1440px thì copy y nguyên là mình chỉ thấy nửa trái màn hình
// họ, mà lại không có cách nào biết mình đang thiếu phần nào. Đúng thì phải đi
// vòng qua toạ độ canvas: tính VÙNG canvas họ đang thấy, rồi nhét trọn vùng đó
// vào khung của mình — cùng phép "fit" mà jumpToGroup/zoomToNodes đang dùng.

// Vùng canvas mà một khung nhìn đang thấy. Đảo ngược đúng phép biến hình mà
// .canvas dùng: translate(panX, panY) scale(scale).
export function viewToRect(view) {
  return {
    x: -view.panX / view.scale,
    y: -view.panY / view.scale,
    w: view.w / view.scale,
    h: view.h / view.scale
  };
}

// Nhét trọn `rect` vào khung `size`. Lấy min của hai tỉ lệ (không phải max):
// mình thà thấy THỪA ra ngoài rìa còn hơn thấy thiếu — người thuyết trình trỏ
// vào một thẻ ở mép mà mình không có thẻ đó trên màn hình là hỏng cả buổi.
export function fitRect(rect, size, minScale, maxScale) {
  const scale = Math.min(maxScale, Math.max(minScale, Math.min(size.w / rect.w, size.h / rect.h)));
  return {
    scale,
    panX: size.w / 2 - (rect.x + rect.w / 2) * scale,
    panY: size.h / 2 - (rect.y + rect.h / 2) * scale
  };
}

// Khung nhìn mình nên có để "thấy trọn cái họ thấy". Khi hai màn hình cùng cỡ
// thì kết quả trùng khít với view của họ — trường hợp thường gặp nhất phải là
// trường hợp đúng nhất.
export function followCamera(peerView, size, minScale, maxScale) {
  return fitRect(viewToRect(peerView), size, minScale, maxScale);
}

// Gói view tới từ mạng. Server đã lọc một lần (server/follow.js), đây là lần
// hai: scale = 0 lọt qua tới đây là chia cho 0 → NaN → transform hỏng và màn
// hình trắng, không có lỗi nào ném ra để lần ra nguyên nhân.
export function isUsableView(v) {
  return !!v
    && Number.isFinite(v.panX) && Number.isFinite(v.panY)
    && Number.isFinite(v.scale) && v.scale > 0
    && Number.isFinite(v.w) && v.w > 0
    && Number.isFinite(v.h) && v.h > 0;
}

// Dưới ngưỡng này coi như đã tới đích: dừng vòng lặp thay vì bò tiệm cận mãi.
// 0.4px là dưới một pixel màn hình, 0.002 scale là dưới 0.2% — không mắt nào
// thấy, mà bỏ chốt này thì rAF chạy vĩnh viễn kể cả khi người kia đứng yên.
const SETTLED_PAN = 0.4;
const SETTLED_SCALE = 0.002;

export function viewSettled(cur, target) {
  return Math.abs(cur.panX - target.panX) < SETTLED_PAN
    && Math.abs(cur.panY - target.panY) < SETTLED_PAN
    && Math.abs(cur.scale - target.scale) < SETTLED_SCALE;
}

// Người kia nhảy hẳn sang góc khác của board (bấm tìm kiếm, nhảy tới thẻ): nội
// suy mượt qua quãng đó là vài giây nhìn cảnh vật lướt vun vút — vừa chóng mặt
// vừa tới nơi muộn hơn người đang nói. Quá ngưỡng thì cắt thẳng.
const SNAP_PAN = 900;
const SNAP_SCALE_RATIO = 1.8;

export function shouldSnap(cur, target) {
  if (Math.hypot(cur.panX - target.panX, cur.panY - target.panY) > SNAP_PAN) return true;
  const r = cur.scale > target.scale ? cur.scale / target.scale : target.scale / cur.scale;
  return r > SNAP_SCALE_RATIO;
}

// Nội suy một nhịp. `t` là phần quãng đường đi được trong nhịp này (0..1).
//
// scale nội suy theo LOGARIT chứ không tuyến tính: thu phóng là phép nhân, nên
// đi tuyến tính từ 0.3 tới 2.4 sẽ phóng rất nhanh ở đầu rồi ì ra ở cuối. Trong
// log thì mỗi nhịp đổi cùng một TỈ LỆ, mắt thấy đều.
export function lerpView(cur, target, t) {
  const k = Math.min(1, Math.max(0, t));
  return {
    panX: cur.panX + (target.panX - cur.panX) * k,
    panY: cur.panY + (target.panY - cur.panY) * k,
    scale: Math.exp(Math.log(cur.scale) + (Math.log(target.scale) - Math.log(cur.scale)) * k)
  };
}

// Một nhịp của vòng bám: trả về camera kế tiếp, hoặc null nếu đã tới đích và
// vòng lặp nên dừng.
export function stepFollow(cur, target, t) {
  if (viewSettled(cur, target)) return null;
  if (shouldSnap(cur, target)) return { panX: target.panX, panY: target.panY, scale: target.scale };
  return lerpView(cur, target, t);
}
