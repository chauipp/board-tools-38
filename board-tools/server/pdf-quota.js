import dotenv from "dotenv";
import { Board, PdfFile, PdfQuotaState } from "./models.js";
import { deletePdf, listStoredPdfs, isR2Enabled } from "./pdf-storage.js";
import { sendAlert } from "./notify.js";

// Cloudflare tính dung lượng theo GB thập phân (10^9), không phải GiB, nên quy
// đổi ở đây cũng vậy — lấy 2^30 thì ngưỡng 8 "GB" của mình sẽ to hơn 8 GB mà
// Cloudflare đếm, đúng cái phải tránh.
const GB = 1_000_000_000;
const HOUR = 60 * 60 * 1000;

// Cùng lý do như trong pdf-storage.js: module này được nạp trước thân index.js,
// nên phải tự nạp .env mới đọc được ngưỡng cấu hình lúc chạy local.
dotenv.config();

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} phải là số dương, đang là "${raw}"`);
  }
  return n;
}

// Gói free của R2 cho 10 GB. Trần cứng để ở 8 GB: còn 2 GB đệm cho phần usage
// Cloudflare đếm trễ và cho những file mồ côi chưa tới lượt dọn.
export const QUOTA = {
  limitBytes: envNumber("PDF_QUOTA_LIMIT_GB", 8) * GB,
  highBytes: envNumber("PDF_QUOTA_HIGH_GB", 7.5) * GB,
  warnBytes: envNumber("PDF_QUOTA_WARN_GB", 6) * GB,
  graceMs: envNumber("PDF_ORPHAN_GRACE_HOURS", 24) * HOUR,
  // Phần riêng của mỗi người, nằm TRONG hạn mức chung.
  //
  // Trần chung một mình nó không đủ khi app mở cho mọi tài khoản Google: nó giữ
  // cho khỏi bị Cloudflare tính tiền, nhưng không giữ được CHỖ của từng người —
  // một tài khoản lạ lấp đầy 8 GB là cả nhóm hết upload được. Có phần riêng thì
  // người lạ chỉ tiêu hết phần của họ.
  //
  // 500 MB ≈ 17 file cỡ trần 30MB, và 8 GB vẫn đủ chỗ cho 16 người dùng thật.
  userLimitBytes: envNumber("PDF_USER_QUOTA_MB", 500) * 1_000_000
};

if (QUOTA.warnBytes > QUOTA.highBytes || QUOTA.highBytes > QUOTA.limitBytes) {
  throw new Error("Ngưỡng PDF phải tăng dần: PDF_QUOTA_WARN_GB <= PDF_QUOTA_HIGH_GB <= PDF_QUOTA_LIMIT_GB");
}

const LEVELS = ["ok", "warn", "high", "full"];

export function formatBytes(bytes) {
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function levelFor(usedBytes, quota = QUOTA) {
  if (usedBytes >= quota.limitBytes) return "full";
  if (usedBytes >= quota.highBytes) return "high";
  if (usedBytes >= quota.warnBytes) return "warn";
  return "ok";
}

// Chỉ báo khi tình hình xấu đi thêm một mức, hoặc khi đã về lại bình thường.
// Không có chốt này thì cron 6 tiếng một lần sẽ gửi lại đúng một cảnh báo cho
// tới khi người ta tắt thông báo — và lúc thật sự nguy thì không ai đọc nữa.
export function shouldNotify(prevLevel, nextLevel) {
  const prev = LEVELS.indexOf(prevLevel);
  const next = LEVELS.indexOf(nextLevel);
  if (next < 0) return false;
  if (prev < 0) return nextLevel !== "ok";
  if (next > prev) return true;
  return nextLevel === "ok" && prev > 0;
}

// fileId của mọi PDF đang được một thẻ trỏ tới. Chịu được nodes[] rỗng, thiếu,
// hay lẫn thẻ không phải PDF — nơi gọi là bộ dọn rác, đoán sai theo hướng "còn
// dùng" thì chỉ tốn dung lượng, còn đoán sai hướng kia là mất file của người ta.
export function collectPdfFileIds(nodes) {
  const ids = new Set();
  if (!Array.isArray(nodes)) return ids;
  for (const node of nodes) {
    const fileId = node?.pdf?.fileId;
    if (typeof fileId === "string" && fileId) ids.add(fileId);
  }
  return ids;
}

// So sổ sách với danh sách fileId đang được dùng, ra hai việc cần làm: đánh dấu
// mồ côi (thẻ vừa bị xoá) và hồi sinh (thẻ quay lại nhờ Ctrl+Z, hoặc nhờ client
// rebase xong rồi lưu lại).
export function planRefSync(docs, referencedIds, now) {
  const orphan = [];
  const revive = [];
  for (const doc of docs) {
    const referenced = referencedIds.has(doc.fileId);
    if (referenced && doc.orphanedAt) revive.push(doc.fileId);
    else if (!referenced && !doc.orphanedAt) orphan.push(doc.fileId);
  }
  return { orphan, revive, at: now };
}

// Mồ côi đã quá thời gian chờ thì mới được xoá bytes.
export function pickSweepable(docs, now, graceMs = QUOTA.graceMs) {
  const deadline = now - graceMs;
  return docs
    .filter((doc) => doc.orphanedAt && new Date(doc.orphanedAt).getTime() <= deadline)
    .map((doc) => doc.fileId);
}

// Sổ sách và kho thật có thể lệch: một cú upload chết giữa đường để lại dòng sổ
// không có bytes ("ghost"), còn file có bytes mà không có dòng sổ ("untracked")
// thì đang chiếm dung lượng mà không ai đếm. Cả hai đều phải xử, nhưng lệch
// nhau về mức độ cẩn thận: xoá một dòng sổ vô hại, xoá một file thì không.
export function planReconcile({ stored, docs, referencedIds, now, graceMs = QUOTA.graceMs }) {
  const storedById = new Map(stored.map((obj) => [obj.fileId, obj]));
  const docById = new Map(docs.map((doc) => [doc.fileId, doc]));

  const ghosts = [];
  for (const doc of docs) {
    if (storedById.has(doc.fileId)) continue;
    // Chỉ dám coi là ghost khi dòng sổ đã đủ cũ. Mới ghi vài giây trước thì rất
    // có thể cú PutObject đang chạy, hoặc R2 chưa kịp hiện key ra bản liệt kê.
    if (new Date(doc.createdAt).getTime() <= now - 10 * 60 * 1000) ghosts.push(doc.fileId);
  }

  const adopt = [];
  for (const obj of stored) {
    if (docById.has(obj.fileId)) continue;
    const referenced = referencedIds.has(obj.fileId);
    adopt.push({
      fileId: obj.fileId,
      size: obj.size,
      createdAt: obj.lastModified ? new Date(obj.lastModified) : new Date(now),
      // Không biết file này thuộc board nào (chỉ nodes mới biết), nên nếu đang
      // được một thẻ dùng thì nhận vào sổ như file còn sống và để nguyên; per-PUT
      // sync sẽ không thấy nó, nhưng vòng reconcile sau vẫn xét lại được.
      orphanedAt: referenced ? null : new Date(now)
    });
  }

  const sweep = pickSweepable(
    docs.filter((doc) => storedById.has(doc.fileId) && !referencedIds.has(doc.fileId)),
    now,
    graceMs
  );

  return { ghosts, adopt, sweep };
}

// Báo cáo kèm phần riêng của một người. Tách khỏi usageReport() vì cron và
// script không có "người đang hỏi" nào cả.
export async function usageReportFor(email) {
  const [report, userUsed] = await Promise.all([usageReport(), usedBytesFor(email)]);
  return {
    ...report,
    you: {
      usedBytes: userUsed,
      limitBytes: QUOTA.userLimitBytes,
      usedText: formatBytes(userUsed),
      limitText: formatBytes(QUOTA.userLimitBytes),
      percent: QUOTA.userLimitBytes
        ? Math.round((userUsed / QUOTA.userLimitBytes) * 1000) / 10
        : 0
    }
  };
}

export async function usageReport() {
  const rows = await PdfFile.aggregate([
    {
      $group: {
        _id: { $cond: [{ $eq: ["$orphanedAt", null] }, "active", "orphan"] },
        bytes: { $sum: "$size" },
        count: { $sum: 1 }
      }
    }
  ]);
  const pick = (kind) => rows.find((r) => r._id === kind) || { bytes: 0, count: 0 };
  const active = pick("active");
  const orphan = pick("orphan");
  const usedBytes = active.bytes + orphan.bytes;
  return {
    usedBytes,
    limitBytes: QUOTA.limitBytes,
    freeBytes: Math.max(0, QUOTA.limitBytes - usedBytes),
    percent: QUOTA.limitBytes ? Math.round((usedBytes / QUOTA.limitBytes) * 1000) / 10 : 0,
    level: levelFor(usedBytes),
    // Đổi đơn vị ở server chứ không để client tự làm: chỗ này dùng GB thập phân
    // cho khớp cách Cloudflare đếm, mà đó đúng là loại quy ước hai bên rất dễ
    // cài lệch nhau rồi ra hai con số khác nhau cho cùng một kho.
    usedText: formatBytes(usedBytes),
    limitText: formatBytes(QUOTA.limitBytes),
    activeBytes: active.bytes,
    activeCount: active.count,
    orphanBytes: orphan.bytes,
    orphanCount: orphan.count,
    store: isR2Enabled ? "r2" : "local"
  };
}

export function describeUsage(report) {
  const parts = [
    `Kho PDF: ${formatBytes(report.usedBytes)} / ${formatBytes(report.limitBytes)} (${report.percent}%)`,
    `${report.activeCount} file đang dùng`,
    `${report.orphanCount} file chờ dọn (${formatBytes(report.orphanBytes)})`,
    `kho=${report.store}`
  ];
  return parts.join(" · ");
}

// Hai cửa, và thứ tự xét có ý nghĩa: kho chung đầy là việc cả nhóm phải xử lý
// (không ai upload được nữa), còn phần riêng đầy thì chỉ mình người đó bị chặn
// và tự xoá bớt là xong. Báo nhầm cái nọ thành cái kia là chỉ sai việc phải làm.
export function checkQuotas({ globalUsed, userUsed, incoming, globalLimit, userLimit }) {
  if (globalUsed + incoming > globalLimit) return { ok: false, reason: "storage_full" };
  if (userUsed + incoming > userLimit) return { ok: false, reason: "user_quota_full" };
  return { ok: true, reason: null };
}

// Dung lượng một người đang chiếm. Tính cả file mồ côi chưa tới lượt dọn: bytes
// của họ vẫn nằm trên R2, nên vẫn là phần họ đang giữ.
export async function usedBytesFor(email) {
  if (!email) return 0;
  const [row] = await PdfFile.aggregate([
    { $match: { email: String(email).toLowerCase() } },
    { $group: { _id: null, bytes: { $sum: "$size" } } }
  ]);
  return row?.bytes || 0;
}

// Cửa chặn upload. Trả về ok=false thì nơi gọi phải bỏ file tạm và trả lỗi —
// không được đẩy lên R2, vì đây là cái duy nhất giữ cho dung lượng không bò tới
// mốc 10 GB bị tính tiền.
export async function checkRoom(incomingBytes, email) {
  const [report, userUsed] = await Promise.all([usageReport(), usedBytesFor(email)]);
  const verdict = checkQuotas({
    globalUsed: report.usedBytes,
    userUsed,
    incoming: incomingBytes,
    globalLimit: QUOTA.limitBytes,
    userLimit: QUOTA.userLimitBytes
  });
  return { ...verdict, report, userUsed, userLimit: QUOTA.userLimitBytes };
}

export async function recordUpload({ fileId, boardId, email, name, size }) {
  await PdfFile.create({
    fileId,
    boardId: String(boardId),
    email: String(email || "").toLowerCase(),
    name,
    size,
    createdAt: new Date()
  });
}

export async function forgetUpload(fileId) {
  await PdfFile.deleteOne({ fileId });
}

// Gọi sau mỗi lần lưu board: thẻ PDF nào vừa mất khỏi nodes[] thì đánh dấu mồ
// côi để 24 giờ nữa dọn. Chỉ đọc đúng collection sổ sách của board đó, không
// đọc nội dung board — PUT cố tình không đọc nodes[] vì có ảnh base64.
export async function syncBoardRefs(boardId, nodes) {
  // Payload không mang nodes[] thì KHÔNG suy ra được điều gì: findByIdAndUpdate bỏ
  // qua field undefined nên board vẫn giữ nguyên thẻ, mà ở đây "không thấy thẻ
  // nào" lại giống hệt "vừa xoá hết thẻ" — đủ để một cú PUT thiếu field đánh dấu
  // mồ côi toàn bộ PDF của board.
  if (!Array.isArray(nodes)) return { orphan: [], revive: [] };
  const id = String(boardId);
  const docs = await PdfFile.find({ boardId: id }).select("fileId orphanedAt").lean();
  if (!docs.length) return { orphan: [], revive: [] };
  const plan = planRefSync(docs, collectPdfFileIds(nodes), Date.now());
  if (plan.orphan.length) {
    await PdfFile.updateMany({ boardId: id, fileId: { $in: plan.orphan } }, { orphanedAt: new Date() });
  }
  if (plan.revive.length) {
    await PdfFile.updateMany({ boardId: id, fileId: { $in: plan.revive } }, { orphanedAt: null });
  }
  return plan;
}

// Board bị xoá thì mọi PDF của nó thành mồ côi cùng lúc — vẫn qua thời gian chờ,
// không xoá thẳng, để một cú xoá board nhầm còn kịp cứu bytes.
export async function orphanBoardFiles(boardId) {
  const res = await PdfFile.updateMany(
    { boardId: String(boardId), orphanedAt: null },
    { orphanedAt: new Date() }
  );
  return res.modifiedCount || 0;
}

// fileId của mọi PDF còn được thẻ nào đó trỏ tới, trên toàn bộ board. Projection
// "nodes.pdf" là chỗ đáng chú ý: nó bảo Mongo chỉ trả field pdf của từng phần tử
// nodes[], nên ảnh base64 trong node không bị kéo về — nếu không thì một vòng
// reconcile có thể tải hàng chục MB.
async function collectAllReferencedIds() {
  const boards = await Board.find({}, { "nodes.pdf": 1 }).lean();
  const ids = new Set();
  for (const board of boards) {
    for (const fileId of collectPdfFileIds(board.nodes)) ids.add(fileId);
  }
  return ids;
}

async function deleteFiles(fileIds) {
  const deleted = [];
  for (const fileId of fileIds) {
    try {
      await deletePdf(fileId);
      await PdfFile.deleteOne({ fileId });
      deleted.push(fileId);
    } catch (e) {
      // Một file xoá không được thì bỏ qua, vòng sau dọn tiếp. Dừng cả lượt chỉ
      // vì một key là cách chắc chắn để rác không bao giờ được dọn.
      console.warn(`[pdf-quota] không xoá được ${fileId}: ${e.message}`);
    }
  }
  return deleted;
}

// Một lượt đối chiếu + dọn rác đầy đủ. dryRun=true thì chỉ trả về dự định.
export async function reconcile({ dryRun = false } = {}) {
  const now = Date.now();
  const [stored, docs, referencedIds] = await Promise.all([
    listStoredPdfs(),
    PdfFile.find({}).select("fileId size createdAt orphanedAt").lean(),
    collectAllReferencedIds()
  ]);

  const plan = planReconcile({ stored, docs, referencedIds, now, graceMs: QUOTA.graceMs });

  // Dòng sổ đang bảo "còn dùng" mà thật ra không thẻ nào trỏ tới (và ngược lại)
  // — per-PUT sync chỉ thấy board vừa lưu, nên vòng này mới là chốt cuối.
  const drift = planRefSync(
    docs.filter((doc) => !plan.ghosts.includes(doc.fileId)),
    referencedIds,
    now
  );

  if (dryRun) return { plan, drift, dryRun: true };

  if (plan.ghosts.length) await PdfFile.deleteMany({ fileId: { $in: plan.ghosts } });
  if (plan.adopt.length) {
    await PdfFile.insertMany(plan.adopt.map((f) => ({ ...f, boardId: "unknown", name: "" })));
  }
  if (drift.orphan.length) {
    await PdfFile.updateMany({ fileId: { $in: drift.orphan }, orphanedAt: null }, { orphanedAt: new Date() });
  }
  if (drift.revive.length) {
    await PdfFile.updateMany({ fileId: { $in: drift.revive } }, { orphanedAt: null });
  }
  const deleted = await deleteFiles(plan.sweep);

  return {
    ghosts: plan.ghosts.length,
    adopted: plan.adopt.length,
    orphaned: drift.orphan.length,
    revived: drift.revive.length,
    deleted: deleted.length,
    deletedBytes: docs
      .filter((doc) => deleted.includes(doc.fileId))
      .reduce((sum, doc) => sum + (doc.size || 0), 0)
  };
}

async function readState() {
  const doc = await PdfQuotaState.findOne({ singleton: "main" }).lean();
  return doc?.level || "ok";
}

async function writeState(level, notified) {
  await PdfQuotaState.findOneAndUpdate(
    { singleton: "main" },
    { level, ...(notified ? { notifiedAt: new Date() } : {}) },
    { upsert: true }
  );
}

// Cron 6 tiếng một lần là quá thưa cho một buổi upload liên tục: từ mốc cảnh báo
// 6 GB tới trần cứng 8 GB chỉ cách nhau vài chục file 30MB, đủ để bị chặn mà
// chưa từng nhận được lời nhắc nào. Nên mỗi cú upload cũng tự xét mức luôn; nó
// dùng chung sổ "mức đã báo" với cron nên không sinh tin nhắn trùng.
export async function noteUsageAfterUpload() {
  const report = await usageReport();
  const prevLevel = await readState();
  if (!shouldNotify(prevLevel, report.level)) {
    if (report.level !== prevLevel) await writeState(report.level, false);
    return false;
  }
  await sendAlert(alertText(report, prevLevel));
  await writeState(report.level, true);
  return true;
}

// Vòng chạy của cron: dọn rác trước rồi mới đo, để con số báo ra là dung lượng
// thật sau khi đã trả lại phần xoá được — báo động vì rác chưa dọn là báo động sai.
export async function runQuotaCheck({ sweep = true, notify = true } = {}) {
  const cleanup = sweep ? await reconcile() : null;
  const report = await usageReport();
  const prevLevel = await readState();
  const line = describeUsage(report);

  if (cleanup) {
    console.log(
      `[pdf-quota] dọn rác: xoá ${cleanup.deleted} file (${formatBytes(cleanup.deletedBytes)}), ` +
      `mồ côi thêm ${cleanup.orphaned}, hồi sinh ${cleanup.revived}, ` +
      `ghost ${cleanup.ghosts}, nhận vào sổ ${cleanup.adopted}`
    );
  }
  console.log(`[pdf-quota] ${line}`);

  const notified = notify && shouldNotify(prevLevel, report.level);
  if (notified) {
    await sendAlert(alertText(report, prevLevel));
  }
  if (report.level !== prevLevel || notified) await writeState(report.level, notified);

  return { report, cleanup, prevLevel, notified };
}

function alertText(report, prevLevel) {
  const head = {
    warn: "⚠️ Kho PDF đã qua mốc cảnh báo",
    high: "🔶 Kho PDF gần đầy",
    full: "🛑 Kho PDF ĐÃ ĐẦY — upload mới đang bị chặn",
    ok: "✅ Kho PDF đã về mức bình thường"
  }[report.level];
  const lines = [
    `**${head}**`,
    describeUsage(report),
    `Còn trống ${formatBytes(report.freeBytes)} trước trần cứng ${formatBytes(report.limitBytes)}.`,
    `Gói free của Cloudflare R2 là 10 GB — trần cứng đặt thấp hơn để không bị tính tiền.`
  ];
  if (report.level === "full") {
    lines.push("Xoá vài thẻ PDF không cần nữa; dung lượng được trả lại sau thời gian chờ dọn.");
  }
  if (prevLevel !== "ok" && report.level === "ok") lines.push("Không cần làm gì thêm.");
  return lines.join("\n");
}
