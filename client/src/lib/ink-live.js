// Overlay nét vẽ đang chạy của NGƯỜI KHÁC. Cùng bài học TTL hai mức với
// lib/useLiveSync.js: gói giữa chừng hết hạn nhanh (người vẽ rớt mạng thì nét
// tạm tự dọn), gói CUỐI sống lâu hơn hẳn vì nó phải cầm cự cho tới khi
// board:update chính thức của lần lưu đó về — bỏ sớm là nét biến mất rồi hiện
// lại, đúng hiện tượng nháy.
export const INK_LIVE_TTL_MS = 1200;
export const INK_SETTLE_TTL_MS = 6000;

export function inkKey(packet) {
  return packet.socketId + ":" + packet.strokeId;
}

// NÉT ĐANG BỊ NGƯỜI KHÁC DỜI / CO GIÃN / SỬA HÌNH.
//
// Gói `moving` mang TRẠNG THÁI TUYỆT ĐỐI (pts hiện tại), không mang độ dời. Đây
// là chỗ đáng cân nhắc nhất của cả tính năng, và bài học lấy thẳng từ
// reconcileGeomOverlay bên useLiveSync.js: overlay tuyệt đối thì đắp lên một
// board đã cập nhật là PHÉP RỖNG, còn overlay dạng độ dời thì đắp chồng là dời
// hai lần — mà "board:update về trong lúc overlay chưa hết hạn" là chuyện xảy
// ra ở mọi lần kéo, không phải ca hiếm. Tuyệt đối cũng làm reconcile thành một
// phép so khớp tầm thường, thay vì phải đoán xem bản lưu đã gồm cú dời hay chưa.
//
// Cái giá là kích thước gói, nên gói CHỈ mang `pts` (và `size` cho chữ, vì co
// giãn đổi cả cỡ chữ). Màu, độ dày, kind, nét đứt thì người nhận đã có sẵn
// trong board của họ — gửi lại là trả tiền hai lần cho cùng một thứ.
export function applyInkMoves(drawings, liveStrokes) {
  if (!drawings || !liveStrokes || !liveStrokes.size) return drawings;
  let patch = null;
  for (const e of liveStrokes.values()) {
    if (!e.moving) continue;
    for (const m of e.moving) {
      if (!patch) patch = new Map();
      patch.set(m.id, m);
    }
  }
  if (!patch) return drawings;
  return drawings.map((d) => {
    const m = patch.get(d.id);
    if (!m) return d;
    const next = { ...d, pts: m.pts };
    if (m.kind) next.kind = m.kind;
    // Chữ: co giãn đổi cả cỡ chữ và hộp chữ. `w`/`h` của chữ là KÍCH THƯỚC HỘP,
    // còn `w` của nét bút và hình khối là ĐỘ DÀY NÉT — cùng tên field, hai đại
    // lượng khác hẳn nhau, nên chỉ đụng tới chúng ở đúng nhánh chữ.
    if (m.size != null) next.size = m.size;
    if (m.w != null) next.w = m.w;
    if (m.h != null) next.h = m.h;
    return next;
  });
}

// Hai nét coi là đã khớp khi pts giống hệt. Dùng cho reconcile: bản lưu về tới
// nơi rồi thì overlay hết việc.
function sameMoved(d, m) {
  if (!d || !m) return false;
  const a = d.pts || [], b = m.pts || [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  if (m.size != null && d.size !== m.size) return false;
  if (m.kind != null && d.kind !== m.kind) return false;
  return true;
}

export function mergeInkPacket(prev, packet, now) {
  if (!packet || typeof packet !== "object") return prev;
  // socketId do server đính vào; strokeId là số đếm cục bộ của người vẽ. Thiếu
  // một trong hai thì không khoá được entry.
  if (typeof packet.socketId !== "string" || !Number.isFinite(packet.strokeId)) return prev;

  const key = inkKey(packet);
  const cur = prev.get(key);

  if (packet.cancel === true) {
    if (!cur) return prev;
    const next = new Map(prev);
    next.delete(key);
    return next;
  }

  // Lượt dời/co giãn/sửa hình: gói mang trạng thái tuyệt đối nên THAY hẳn entry,
  // không gộp với gói trước. Gói sau đã tả trọn vẹn hiện trạng.
  if (Array.isArray(packet.moving)) {
    const moving = packet.moving.filter((m) => m && Number.isFinite(m.id) && Array.isArray(m.pts));
    if (!moving.length) return prev;
    const next = new Map(prev);
    next.set(key, {
      kind: null, fill: false, dashed: false,
      color: null, w: null, pts: null, text: null, size: null, editId: null,
      drawingId: null, erase: null, moving,
      expiresAt: now + (packet.done === true ? INK_SETTLE_TTL_MS : INK_LIVE_TTL_MS)
    });
    return next;
  }

  // Lượt gôm: gói mang danh sách id đang bị đánh dấu xoá, cộng dồn qua các gói.
  if (Array.isArray(packet.erase)) {
    const merged = cur && cur.erase ? cur.erase.slice() : [];
    for (const id of packet.erase) {
      if (Number.isFinite(id) && !merged.includes(id)) merged.push(id);
    }
    const next = new Map(prev);
    next.set(key, {
      kind: null, fill: false, dashed: false,
      color: null, w: null, pts: null, text: null, size: null, editId: null,
      drawingId: null, erase: merged,
      expiresAt: now + (packet.done === true ? INK_SETTLE_TTL_MS : INK_LIVE_TTL_MS)
    });
    return next;
  }

  if (packet.done === true) {
    if (!cur) return prev;
    const next = new Map(prev);
    next.set(key, {
      ...cur,
      drawingId: Number.isFinite(packet.drawingId) ? packet.drawingId : null,
      expiresAt: now + INK_SETTLE_TTL_MS
    });
    return next;
  }

  const pts = Array.isArray(packet.pts) ? packet.pts : null;
  if (!pts || pts.length < 2) return prev;
  // Vào giữa nét: không có gói seq 0 nên thiếu màu và độ dày, bỏ qua.
  if (!cur && packet.seq !== 0) return prev;

  // Gói hình khối mang kind ở MỌI gói, không chỉ gói đầu — nhờ vậy nhánh dưới
  // không phải nhớ kind của entry, và server kiểm được pts đúng 4 số.
  //
  // Fix round 1: fallback "pen" chỉ áp cho gói seq 0 (lúc đó KHÔNG có cur nào
  // đáng tin — dựng entry mới hoàn toàn nên phải theo đúng cái packet mang).
  // Gói seq > 0 thì cur LUÔN tồn tại (chặn ở `if (!cur && packet.seq !== 0)`
  // trên), nên nếu gói lỡ THIẾU kind (client cũ hơn tính năng này, hoặc field
  // bị rơi trên đường truyền) phải tin kind của entry đã lưu (`cur.kind`) thay
  // vì mặc định về "pen" — mặc định sai sẽ rơi vào nhánh NỐI dưới đây và làm
  // hộp phình từ 4 lên 8, 12... số, hình đứng khựng/lệch tới khi board:update
  // về dọn overlay.
  const next = new Map(prev);
  if (packet.seq === 0) {
    const kind = typeof packet.kind === "string" ? packet.kind : "pen";
    next.set(key, {
      // `dashed` chỉ đi ở gói seq 0, cùng chỗ với color/w/fill: nó không đổi
      // giữa chừng một nét. Gói sau chỉ mang điểm, và nhánh `{ ...cur }` bên
      // dưới tự giữ lại nó.
      kind, fill: packet.fill === true, dashed: packet.dashed === true,
      color: packet.color, w: packet.w, pts: pts.slice(),
      // CHỮ ĐANG GÕ. `size` đi cùng chỗ với color/w vì nó không đổi giữa chừng,
      // còn `text` thì đi ở MỌI gói — nó chính là thứ đang thay đổi.
      //
      // `editId` là id của đoạn text ĐANG ĐƯỢC SỬA (null nếu đang tạo mới), và
      // nó cố ý KHÔNG dùng chung ô với `drawingId`. Hai thứ nghe giống nhau
      // nhưng ngược nghĩa với reconcileInkOverlay: `drawingId` nghĩa là "lượt
      // này đã chốt thành id đó", nên hễ id có trong board là bỏ overlay. Nếu
      // nhét id đang sửa vào đó thì id ấy CÓ SẴN trong board ngay từ đầu, và
      // overlay bị dọn ngay gói đầu tiên — người khác không thấy gì cả.
      text: kind === "text" ? String(packet.text ?? "") : null,
      size: kind === "text" && Number.isFinite(packet.size) ? packet.size : null,
      editId: kind === "text" && Number.isFinite(packet.editId) ? packet.editId : null,
      drawingId: null, erase: null, expiresAt: now + INK_LIVE_TTL_MS
    });
  } else if ((typeof packet.kind === "string" ? packet.kind : cur.kind) !== "pen") {
    // Hộp mang trọn thông tin: THAY, không nối. Nối thì hộp dài ra và shapePath
    // đọc sai hình. Điều kiện trên tự chấp nhận packet THIẾU kind bằng cách
    // rơi về cur.kind — xem ghi chú "Fix round 1" ngay trên.
    const e = { ...cur, pts: pts.slice(), expiresAt: now + INK_LIVE_TTL_MS };
    // Gói chữ giữa chừng mang trọn cả đoạn văn bản, nên cũng THAY như hộp. Chỉ
    // ghi khi gói thật sự có field: gói thiếu `text` phải giữ lại chữ cũ của
    // entry chứ không xoá nó thành rỗng.
    if (cur.kind === "text" && packet.text !== undefined) e.text = String(packet.text);
    next.set(key, e);
  } else {
    next.set(key, { ...cur, pts: cur.pts.concat(pts), expiresAt: now + INK_LIVE_TTL_MS });
  }
  return next;
}

// Sau khi áp một board:update chính thức: overlay nào đã được board thật bắt
// kịp phải bỏ NGAY, giữ lại nghĩa là tiếp tục vẽ một bản tạm đè lên dữ liệu
// thật vừa nhận. Cùng vai trò reconcileGeomOverlay trong useLiveSync.js.
export function reconcileInkOverlay(prev, board) {
  if (!prev.size || !board) return prev;
  const ids = new Set((board.drawings || []).map((d) => d.id));
  let next = null;
  // Chỉ mục dựng LƯỜI: chỉ lượt dời/co giãn mới cần tra nét theo id, mà phần
  // lớn board:update thì không có overlay loại đó đang chạy.
  let index = null;
  for (const [key, e] of prev) {
    let settled = false;
    if (e.erase) settled = e.erase.every((id) => !ids.has(id));
    else if (e.moving) {
      // Bản lưu đã về và khớp với overlay ⇒ overlay hết việc. Cùng phép so khớp
      // mà reconcileGeomOverlay dùng, và nó chỉ đúng được nhờ overlay lưu trạng
      // thái TUYỆT ĐỐI — xem ghi chú ở applyInkMoves.
      if (!index) index = new Map((board.drawings || []).map((d) => [d.id, d]));
      settled = e.moving.every((m) => sameMoved(index.get(m.id), m));
    } else if (e.drawingId != null) settled = ids.has(e.drawingId);
    if (!settled) continue;
    if (!next) next = new Map(prev);
    next.delete(key);
  }
  return next || prev;
}
