import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { rateLimit } from "../rate-limit.js";
import { asyncRoute } from "../http.js";
import { AUTH_FIELDS, loadBoardWithRole } from "../board-access.js";
import { PDF_DIR, isR2Enabled, sendPdf, storePdf } from "../pdf-storage.js";
import { checkRoom, recordUpload, forgetUpload, noteUsageAfterUpload, formatBytes } from "../pdf-quota.js";

// File PDF gắn vào board. Mount TRƯỚC routes/boards.js dưới /api/boards, giữ
// đúng thứ tự khớp route như khi còn chung một router (/:id/files/:fileId trước /:id).
const router = Router();

// PDF không nằm trong document MongoDB của board: chỉ metadata sống trong node.
// Nếu đủ biến R2, bytes ở Cloudflare R2; còn local thì dùng disk để phát triển.
fs.mkdirSync(PDF_DIR, { recursive: true });
const PDF_MAX_BYTES = 30 * 1024 * 1024;
const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PDF_DIR),
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.pdf`)
  }),
  limits: { fileSize: PDF_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("pdf_only"));
  }
}).single("file");

// Upload phải kiểm quyền board ngay trong route, và nếu người dùng không có
// quyền thì xoá file Multer vừa ghi trước khi trả lỗi. URL file đi qua route GET
// bên dưới, nên không có PDF nào bị public chỉ vì biết tên file.
// Chặn theo EMAIL chứ không theo IP: kho PDF là tài nguyên dùng chung có hạn
// mức, nên thứ cần giới hạn là "một người ngốn bao nhiêu", không phải "một
// đường mạng gửi bao nhiêu" — cả văn phòng ngồi chung một IP là chuyện thường.
// 20 file/giờ × 30MB là 600MB/giờ cho mỗi người: thoải mái cho việc dùng thật,
// nhưng để lấp 8 GB thì một tài khoản phải cày liên tục hơn nửa ngày.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyOf: (req) => req.user?.email,
  error: "too_many_uploads"
});

// Lỗi bất kỳ giữa chừng: xoá file tạm Multer vừa ghi, rồi mới trả lỗi.
function cleanupUpload(req) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

router.post("/:id/files", uploadLimiter, (req, res, next) => {
  pdfUpload(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "file_too_large" : "pdf_only" });
  });
}, asyncRoute(async (req, res) => {
  const found = await loadBoardWithRole(req, res, "editor", AUTH_FIELDS);
  if (!found) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return;
  }
  if (!req.file) return res.status(400).json({ error: "missing_file" });

  // Trần dung lượng, đặt trước cú PutObject: đây là chỗ duy nhất giữ cho kho
  // không bò tới mốc 10 GB mà Cloudflare bắt đầu tính tiền, và giữ cho một
  // người không chiếm hết chỗ của những người còn lại.
  const room = await checkRoom(req.file.size, req.user.email);
  if (!room.ok) {
    fs.unlink(req.file.path, () => {});
    const full = room.reason === "storage_full";
    return res.status(507).json({
      error: room.reason,
      used: formatBytes(full ? room.report.usedBytes : room.userUsed),
      limit: formatBytes(full ? room.report.limitBytes : room.userLimit)
    });
  }

  const name = path.basename(req.file.originalname || "Tài liệu.pdf").slice(0, 180) || "Tài liệu.pdf";
  // Ghi sổ TRƯỚC khi đẩy bytes lên. Làm ngược lại thì một lỗi Mongo sẽ để lại
  // bytes trên R2 mà không dòng sổ nào đếm — dung lượng bị chiếm âm thầm. Theo
  // thứ tự này, lỗi tệ nhất là một dòng sổ không có bytes, và reconcile dọn được.
  await recordUpload({
    fileId: req.file.filename,
    boardId: String(found.board._id),
    email: req.user.email,
    name,
    size: req.file.size
  });
  try {
    await storePdf(req.file.filename, req.file.path);
  } catch (e) {
    await forgetUpload(req.file.filename).catch(() => {});
    throw e;
  }
  if (isR2Enabled) fs.unlink(req.file.path, () => {});
  // Không chờ: cảnh báo vượt ngưỡng không được làm người ta đợi lâu hơn khi tải
  // PDF, và cron vẫn là cái chốt nếu cú này lỗi.
  noteUsageAfterUpload().catch(() => {});
  res.status(201).json({
    fileId: req.file.filename,
    name,
    size: req.file.size,
    url: `/api/boards/${encodeURIComponent(req.params.id)}/files/${encodeURIComponent(req.file.filename)}`
  });
}, "Không tải được PDF.", { onError: cleanupUpload }));

router.get("/:id/files/:fileId", asyncRoute(async (req, res) => {
  const found = await loadBoardWithRole(req, res, "viewer", AUTH_FIELDS);
  if (!found) return;
  // fileId do server sinh ra; chặn path traversal trước cả khi ghép đường dẫn.
  if (!/^[0-9a-f-]{36}\.pdf$/i.test(req.params.fileId)) return res.status(404).json({ error: "not_found" });
  if (!await sendPdf(req.params.fileId, res)) return res.status(404).json({ error: "not_found" });
}, "Không đọc được PDF."));

export default router;
