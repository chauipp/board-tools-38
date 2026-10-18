// Giới hạn tần suất theo cửa sổ cố định, đếm trong bộ nhớ tiến trình.
//
// Vì sao tự viết thay vì lấy express-rate-limit: app chạy đúng MỘT tiến trình
// trên Render, nên bộ đếm trong RAM là đủ và không cần Redis; phần logic đáng
// kiểm chỉ vỏn vẹn một hàm, và viết tay thì test được nó như hàm thuần.
//
// Hạn chế phải biết: chạy nhiều instance thì mỗi instance đếm riêng, nên trần
// thật sẽ là max × số instance. Lúc nào scale ra nhiều instance thì phải đổi
// sang store dùng chung.

// Một lần gọi. Tách khỏi middleware để test được mà không cần dựng Express, và
// để `now` truyền vào được — thời gian là thứ không mock thì không kiểm nổi.
export function hit(store, key, now, windowMs, max) {
  // Xét trần TRƯỚC khi mở cửa sổ mới. Bỏ qua bước này thì max=0 (cách tắt hẳn
  // một endpoint) vẫn cho lọt request đầu tiên của mỗi cửa sổ.
  if (max <= 0) return { allowed: false, remaining: 0, retryAfterMs: windowMs };

  const entry = store.get(key);
  // Hết cửa sổ cũ (hoặc chưa từng có) thì mở cửa sổ mới.
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }
  if (entry.count >= max) {
    // KHÔNG cộng thêm và KHÔNG dời resetAt: dời hạn mỗi lần bị chặn là biến
    // giới hạn thành lệnh cấm vĩnh viễn cho ai cứ thử lại đều đều.
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }
  entry.count += 1;
  return { allowed: true, remaining: max - entry.count, retryAfterMs: 0 };
}

// Bỏ các cửa sổ đã hết hạn. Không có bước này thì Map phình theo số key từng
// thấy — với key là IP thì đó là rò rỉ bộ nhớ chậm nhưng không có đáy.
export function prune(store, now) {
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
  return store.size;
}

export function rateLimit({ windowMs, max, keyOf, error = "rate_limited" }) {
  const store = new Map();
  let lastPrune = 0;
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    if (now - lastPrune >= windowMs) {
      prune(store, now);
      lastPrune = now;
    }
    const key = keyOf(req);
    // Không rút ra được key (chưa đăng nhập, không có IP) thì thả qua: chốt
    // quyền là việc của requireAuth, không phải của bộ đếm này.
    if (!key) return next();

    const result = hit(store, String(key), now, windowMs, max);
    if (result.allowed) return next();

    const retryAfterSec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({ error, retryAfterSec });
  };
}
