import { Router } from "express";
import { Calculator } from "../models.js";
import { sanitizeCalculator, isStaleWrite } from "../calculator.js";

const router = Router();

const defaultCalculator = {
  budget: 500,
  nextStatId: 5,
  stats: [
    { id: 1, name: "Máu", cost: 1, a: 200, b: 220 },
    { id: 2, name: "Giáp", cost: 2, a: 60, b: 30 },
    { id: 3, name: "Xuyên giáp", cost: 2, a: 20, b: 50 },
    { id: 4, name: "Tấn công", cost: 1, a: 80, b: 70 }
  ]
};

// Bàn tính của một người, dựng ra lúc họ mở lần đầu.
//
// Bản mẫu lấy từ document dùng chung cũ nếu nó còn: người đang dùng app mở lại
// trang là thấy đúng bảng chỉ số họ đã dựng bấy lâu, không phải bảng mặc định.
// Hết bản cũ (cài mới) thì dùng defaultCalculator.
async function ensureCalculatorFor(email) {
  const existing = await Calculator.findOne({ email });
  if (existing) return existing;

  const legacy = await Calculator.findOne({ email: { $exists: false } }).lean();
  const seed = legacy
    ? { budget: legacy.budget, nextStatId: legacy.nextStatId, stats: legacy.stats }
    : defaultCalculator;
  return Calculator.create({ email, ...seed });
}

// Chỉ trả ra phần client cần. `email` cũng bị bỏ: client đã biết mình là ai, và
// không có lý do gì để địa chỉ email đi lại trong payload của mỗi lần tải bàn tính.
function calculatorPayload(doc) {
  return {
    budget: doc.budget,
    nextStatId: doc.nextStatId,
    stats: doc.stats,
    savedAt: doc.savedAt ?? null
  };
}

router.get("/", async (req, res) => {
  try {
    const doc = await ensureCalculatorFor(req.user.email.toLowerCase());
    res.json(calculatorPayload(doc));
  } catch (e) {
    res.status(500).json({ error: "Không đọc được dữ liệu bàn tính." });
  }
});

router.put("/", async (req, res) => {
  try {
    const clean = sanitizeCalculator(req.body);
    if (!clean) return res.status(400).json({ error: "invalid_payload" });

    const email = req.user.email.toLowerCase();
    const savedAt = typeof req.body.savedAt === "number" ? req.body.savedAt : null;
    const current = await Calculator.findOne({ email }).select("savedAt").lean();
    // Cú ghi đã lỗi thời (một request cũ về sau request mới, hoặc tab khác đang
    // mở bản cũ hơn) thì bỏ qua — nhưng vẫn trả ok, vì với client thì "bản của
    // tôi không phải bản mới nhất" không phải lỗi cần báo đỏ lên màn hình.
    if (isStaleWrite(savedAt, current?.savedAt)) {
      return res.json({ ok: true, stale: true });
    }

    await Calculator.findOneAndUpdate(
      { email },
      { ...clean, savedAt },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Không lưu được dữ liệu bàn tính." });
  }
});

export default router;
