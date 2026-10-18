// Ghim màn hình: ai đang bám camera của ai. Trạng thái nằm trên peer
// (`followingId`), module này chỉ giữ phần LOGIC THUẦN để test được — index.js
// còn socket, room và io thì không test bằng node --test được.

// Giới hạn cho gói view:update. Cùng lý do với MAX_LIVE_INK_COORD trong
// index.js: Number.isFinite một mình cho qua 1e9, mà camera của người bị ghim
// được áp thẳng lên màn hình người ghim — một scale khổng lồ hay pan ra vô cực
// là màn hình trắng không hiểu vì sao.
//
// .canvas là 4200×3200 và scale bị kẹp trong [0.3, 2.4] ở client, nên |pan| tối
// đa thực tế cỡ 4200×2.4 ≈ 10000. 40000 rộng hơn nhiều lần mà vẫn hữu hạn.
const MAX_PAN = 40000;
// Rộng hơn hẳn [MIN_SCALE, MAX_SCALE] của client (0.3–2.4): server không nên
// phải deploy lại mỗi lần client nới mức phóng. Client kẹp lần hai khi áp.
const MIN_SCALE = 0.01;
const MAX_SCALE = 100;
// Kích thước khung nhìn của người gửi, tính bằng pixel màn hình. 20000 vượt xa
// mọi màn hình thật; 0 hoặc âm thì phép fit ở client chia cho 0 → NaN.
const MAX_VIEWPORT = 20000;

export function sanitizeView(payload) {
  if (!payload || typeof payload !== "object") return null;
  const { panX, panY, scale, w, h } = payload;
  if (!Number.isFinite(panX) || Math.abs(panX) > MAX_PAN) return null;
  if (!Number.isFinite(panY) || Math.abs(panY) > MAX_PAN) return null;
  if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) return null;
  if (!Number.isFinite(w) || w <= 0 || w > MAX_VIEWPORT) return null;
  if (!Number.isFinite(h) || h <= 0 || h > MAX_VIEWPORT) return null;
  return { panX, panY, scale, w, h };
}

// A ghim B trong khi B đang ghim A: camera của hai người đuổi nhau, mỗi lần áp
// lại lệch đi một chút vì hai màn hình khác cỡ — thành ra tự zoom ra vô tận.
// Chuỗi A→B→C thì KHÔNG sao (C tự lái, A và B cùng nhìn theo), nên chỉ cấm đúng
// vòng khép kín: đi ngược chuỗi từ target, nếu gặp lại follower thì vòng.
//
// `peers` là Map<socketId, {followingId}> — chính là map presence của board.
export function findsCycle(peers, followerId, targetId) {
  let at = targetId;
  // Trần lặp = số peer: chuỗi dài nhất có thể đi qua mỗi người đúng một lần.
  // Nếu dữ liệu hỏng tới mức có vòng KHÔNG chứa followerId, vòng lặp vẫn dừng.
  for (let i = 0; i <= peers.size; i++) {
    if (at === followerId) return true;
    const p = peers.get(at);
    if (!p || !p.followingId) return false;
    at = p.followingId;
  }
  return true;
}

// Trả về { ok, targetId } hoặc { ok: false, reason } — index.js chỉ việc gán và
// phát, không phải tự nghĩ ra luật.
export function resolveFollow(peers, followerId, targetId) {
  if (targetId == null) return { ok: true, targetId: null };
  if (typeof targetId !== "string") return { ok: false, reason: "bad_target" };
  if (targetId === followerId) return { ok: false, reason: "self" };
  if (!peers.has(targetId)) return { ok: false, reason: "gone" };
  if (findsCycle(peers, followerId, targetId)) return { ok: false, reason: "cycle" };
  return { ok: true, targetId };
}

export function countWatchers(peers, targetId) {
  let n = 0;
  for (const p of peers.values()) if (p.followingId === targetId) n++;
  return n;
}

// Người bị ghim rời phòng: người ghim phải được thả ra, không thì họ ngồi im
// chờ view của một socket không còn tồn tại và tưởng là mạng lag. Trả về danh
// sách socketId vừa bị thả để index.js phát tiếp cho cả phòng.
export function releaseFollowersOf(peers, targetId) {
  const released = [];
  for (const [id, p] of peers) {
    if (p.followingId === targetId) {
      p.followingId = null;
      released.push(id);
    }
  }
  return released;
}
