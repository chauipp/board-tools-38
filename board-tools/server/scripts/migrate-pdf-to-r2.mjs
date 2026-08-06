// Đẩy các PDF đang nằm ở server/uploads/pdf lên R2, một lần, lúc chuyển từ chế
// độ lưu local sang R2.
//
//   node scripts/migrate-pdf-to-r2.mjs           # xem sẽ đẩy những gì
//   node scripts/migrate-pdf-to-r2.mjs --go      # đẩy thật
//
// Vì sao cần: bật bốn biến R2 xong thì sendPdf đi tìm bytes trên R2, nên mọi PDF
// cũ ở disk local thành 404 và thẻ PDF trên bảng hỏng. Chạy cái này trước khi
// chạy pdf-usage.mjs --sweep, nếu không bộ dọn rác sẽ thấy "dòng sổ không có
// bytes" và bỏ luôn dòng sổ của chúng.
//
// File local KHÔNG bị xoá sau khi đẩy — giữ lại làm bản dự phòng cho tới khi bạn
// tự tin là R2 chạy ổn.
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { PdfFile } from "../models.js";
import { PDF_DIR, isR2Enabled, storePdf, listStoredPdfs } from "../pdf-storage.js";
import { formatBytes } from "../pdf-quota.js";

dotenv.config();

const go = process.argv.includes("--go");

if (!isR2Enabled) {
  console.error("Chưa bật R2 (thiếu bốn biến R2_*). Không có gì để chuyển sang.");
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error("Thiếu MONGODB_URI trong server/.env");
  process.exit(1);
}

const localNames = fs.existsSync(PDF_DIR)
  ? fs.readdirSync(PDF_DIR).filter((n) => n.toLowerCase().endsWith(".pdf"))
  : [];

if (!localNames.length) {
  console.log(`Không có file nào trong ${PDF_DIR}. Không cần chuyển gì.`);
  process.exit(0);
}

await mongoose.connect(process.env.MONGODB_URI);

try {
  const onR2 = new Set((await listStoredPdfs()).map((o) => o.fileId));
  const todo = localNames.filter((n) => !onR2.has(n));

  console.log(`${localNames.length} file ở local, ${onR2.size} file đã có trên R2, cần đẩy ${todo.length}.`);
  if (!todo.length) {
    console.log("Không còn gì để đẩy.");
  } else if (!go) {
    for (const name of todo) {
      const size = fs.statSync(path.join(PDF_DIR, name)).size;
      console.log(`  sẽ đẩy  ${name}  ${formatBytes(size)}`);
    }
    console.log("\nChạy lại với --go để đẩy thật.");
  } else {
    for (const name of todo) {
      const file = path.join(PDF_DIR, name);
      const size = fs.statSync(file).size;
      await storePdf(name, file);
      // Đảm bảo có dòng sổ. File nào đã được reconcile nhận vào sổ trước đó thì
      // giữ nguyên, đừng ghi đè boardId/orphanedAt của nó.
      await PdfFile.updateOne(
        { fileId: name },
        { $setOnInsert: { fileId: name, boardId: "unknown", name: "", size, createdAt: new Date(), orphanedAt: null } },
        { upsert: true }
      );
      console.log(`  đã đẩy  ${name}  ${formatBytes(size)}`);
    }
    const after = await listStoredPdfs();
    console.log(`\nXong. Trên R2 giờ có ${after.length} file, tổng ${formatBytes(after.reduce((s, o) => s + o.size, 0))}.`);
    console.log(`File local vẫn còn ở ${PDF_DIR} — tự xoá khi nào bạn thấy yên tâm.`);
  }
} finally {
  await mongoose.disconnect();
}
