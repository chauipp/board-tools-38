import { test } from "node:test";
import assert from "node:assert/strict";
import {
  levelFor,
  shouldNotify,
  collectPdfFileIds,
  planRefSync,
  pickSweepable,
  planReconcile,
  formatBytes
} from "./pdf-quota.js";

const GB = 1_000_000_000;
const HOUR = 3_600_000;
const quota = { warnBytes: 6 * GB, highBytes: 7.5 * GB, limitBytes: 8 * GB };

test("mức dung lượng chuyển đúng ở từng ngưỡng", () => {
  assert.equal(levelFor(0, quota), "ok");
  assert.equal(levelFor(5.9 * GB, quota), "ok");
  assert.equal(levelFor(6 * GB, quota), "warn");
  assert.equal(levelFor(7.4 * GB, quota), "warn");
  assert.equal(levelFor(7.5 * GB, quota), "high");
  assert.equal(levelFor(8 * GB, quota), "full");
  assert.equal(levelFor(9 * GB, quota), "full");
});

// Đây là lý do có sổ "mức đã báo": cron chạy 6 tiếng một lần, nếu mức nào cũng
// báo thì ở 6.1 GB người ta nhận 4 tin nhắn giống nhau mỗi ngày và thôi đọc —
// đúng lúc tin nhắn "đã đầy" tới thì nó chìm trong đám kia.
test("chỉ báo khi xấu đi thêm một mức, không nhắc lại cùng một mức", () => {
  assert.equal(shouldNotify("ok", "warn"), true);
  assert.equal(shouldNotify("warn", "warn"), false);
  assert.equal(shouldNotify("warn", "high"), true);
  assert.equal(shouldNotify("high", "full"), true);
  assert.equal(shouldNotify("full", "full"), false);
  assert.equal(shouldNotify("ok", "ok"), false);
});

test("tụt mức thì im, nhưng về hẳn mức bình thường thì báo một lần", () => {
  assert.equal(shouldNotify("full", "high"), false);
  assert.equal(shouldNotify("high", "warn"), false);
  assert.equal(shouldNotify("full", "ok"), true);
  assert.equal(shouldNotify("warn", "ok"), true);
});

test("chưa có sổ mức thì coi như đang ok", () => {
  assert.equal(shouldNotify(undefined, "warn"), true);
  assert.equal(shouldNotify(undefined, "ok"), false);
});

test("gom fileId từ nodes, bỏ qua thẻ không phải PDF", () => {
  const ids = collectPdfFileIds([
    { id: 1, title: "thẻ chữ" },
    { id: 2, pdf: { fileId: "a.pdf", size: 10 } },
    { id: 3, img: "data:image/png;base64,xxx" },
    { id: 4, pdf: { fileId: "b.pdf" } }
  ]);
  assert.deepEqual([...ids].sort(), ["a.pdf", "b.pdf"]);
});

// nodes[] tới từ body request, nên hình dạng nào cũng có thể tới. Đoán sai theo
// hướng "còn dùng" chỉ tốn dung lượng; đoán sai hướng kia là xoá PDF của người ta.
test("nodes[] méo mó không làm sập việc gom fileId", () => {
  assert.equal(collectPdfFileIds(undefined).size, 0);
  assert.equal(collectPdfFileIds(null).size, 0);
  assert.equal(collectPdfFileIds("không phải mảng").size, 0);
  assert.equal(collectPdfFileIds([null, undefined, {}, { pdf: null }]).size, 0);
  assert.equal(collectPdfFileIds([{ pdf: { fileId: "" } }, { pdf: { fileId: 42 } }]).size, 0);
});

test("thẻ bị xoá thì file thành mồ côi, thẻ quay lại thì file hồi sinh", () => {
  const docs = [
    { fileId: "con-dung.pdf", orphanedAt: null },
    { fileId: "vua-xoa.pdf", orphanedAt: null },
    { fileId: "da-mo-coi.pdf", orphanedAt: new Date(1000) },
    { fileId: "ctrl-z-lai.pdf", orphanedAt: new Date(1000) }
  ];
  const referenced = new Set(["con-dung.pdf", "ctrl-z-lai.pdf"]);
  const plan = planRefSync(docs, referenced, 5000);
  assert.deepEqual(plan.orphan, ["vua-xoa.pdf"]);
  assert.deepEqual(plan.revive, ["ctrl-z-lai.pdf"]);
});

test("file đang mồ côi mà vẫn không ai dùng thì không bị đánh dấu lại", () => {
  const docs = [{ fileId: "x.pdf", orphanedAt: new Date(1000) }];
  const plan = planRefSync(docs, new Set(), 999_999);
  // Đánh dấu lại là dời mốc chờ về hiện tại, và file sẽ không bao giờ tới lượt
  // dọn — mỗi vòng reconcile lại đẩy hạn của nó ra xa thêm 24 giờ.
  assert.deepEqual(plan.orphan, []);
  assert.deepEqual(plan.revive, []);
});

test("chỉ file mồ côi quá thời gian chờ mới tới lượt xoá", () => {
  const now = 100 * HOUR;
  const docs = [
    { fileId: "moi-xoa.pdf", orphanedAt: new Date(now - 1 * HOUR) },
    { fileId: "vua-du.pdf", orphanedAt: new Date(now - 24 * HOUR) },
    { fileId: "qua-lau.pdf", orphanedAt: new Date(now - 200 * HOUR) },
    { fileId: "con-dung.pdf", orphanedAt: null }
  ];
  assert.deepEqual(pickSweepable(docs, now, 24 * HOUR), ["vua-du.pdf", "qua-lau.pdf"]);
});

test("thời gian chờ 0 thì mồ côi là xoá ngay", () => {
  const now = 100 * HOUR;
  const docs = [{ fileId: "a.pdf", orphanedAt: new Date(now) }];
  assert.deepEqual(pickSweepable(docs, now, 0), ["a.pdf"]);
});

test("dòng sổ không có bytes trên kho bị bỏ, nhưng chỉ khi đã đủ cũ", () => {
  const now = 100 * HOUR;
  const { ghosts } = planReconcile({
    stored: [],
    docs: [
      { fileId: "upload-chet.pdf", size: 100, createdAt: new Date(now - 2 * HOUR), orphanedAt: null },
      { fileId: "vua-ghi-so.pdf", size: 100, createdAt: new Date(now - 5000), orphanedAt: null }
    ],
    referencedIds: new Set(),
    now
  });
  // "vua-ghi-so" rất có thể đang giữa cú PutObject, hoặc R2 chưa kịp hiện key ra
  // bản liệt kê. Bỏ dòng sổ của nó là để lại bytes không ai đếm trên R2.
  assert.deepEqual(ghosts, ["upload-chet.pdf"]);
});

test("file có bytes mà không có dòng sổ thì nhận vào sổ để được đếm", () => {
  const now = 100 * HOUR;
  const { adopt } = planReconcile({
    stored: [
      { fileId: "la.pdf", size: 5000, lastModified: new Date(now - 50 * HOUR) },
      { fileId: "dang-dung.pdf", size: 7000, lastModified: new Date(now - 50 * HOUR) }
    ],
    docs: [],
    referencedIds: new Set(["dang-dung.pdf"]),
    now
  });
  assert.equal(adopt.length, 2);
  const byId = new Map(adopt.map((f) => [f.fileId, f]));
  // Đang có thẻ trỏ tới thì nhận vào như file còn sống, không phải mồ côi — nếu
  // không thì 24 giờ sau bộ dọn rác xoá mất một PDF đang hiển thị trên bảng.
  assert.equal(byId.get("dang-dung.pdf").orphanedAt, null);
  assert.notEqual(byId.get("la.pdf").orphanedAt, null);
  assert.equal(byId.get("la.pdf").size, 5000);
});

test("dòng sổ ghost không bị tính vào danh sách xoá bytes", () => {
  const now = 100 * HOUR;
  const { ghosts, sweep } = planReconcile({
    stored: [],
    docs: [{ fileId: "ghost.pdf", size: 1, createdAt: new Date(0), orphanedAt: new Date(0) }],
    referencedIds: new Set(),
    now
  });
  assert.deepEqual(ghosts, ["ghost.pdf"]);
  // Không có bytes thì không có gì để gọi DeleteObject — gọi là tốn một lần
  // Class A operation cho không.
  assert.deepEqual(sweep, []);
});

test("đổi đơn vị dung lượng theo cỡ, GB thập phân như cách Cloudflare đếm", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(999), "999 B");
  assert.equal(formatBytes(15_000), "15 KB");
  assert.equal(formatBytes(2_500_000), "2.5 MB");
  assert.equal(formatBytes(8 * GB), "8.00 GB");
  assert.equal(formatBytes(7.53 * GB), "7.53 GB");
});
