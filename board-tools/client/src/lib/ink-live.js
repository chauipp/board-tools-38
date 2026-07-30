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
  for (const [key, e] of prev) {
    let settled = false;
    if (e.erase) settled = e.erase.every((id) => !ids.has(id));
    else if (e.drawingId != null) settled = ids.has(e.drawingId);
    if (!settled) continue;
    if (!next) next = new Map(prev);
    next.delete(key);
  }
  return next || prev;
}
