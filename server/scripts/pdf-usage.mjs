// Xem và dọn kho PDF bằng tay, không phải đợi cron 6 tiếng.
//
//   node scripts/pdf-usage.mjs            # chỉ xem: đang dùng bao nhiêu, sắp dọn gì
//   node scripts/pdf-usage.mjs --sweep    # dọn thật: xoá file mồ côi đã hết thời gian chờ
//   node scripts/pdf-usage.mjs --sweep --notify   # dọn và gửi cảnh báo nếu vượt ngưỡng
//
// Chạy từ trong thư mục server/, và cần .env có MONGODB_URI (cùng bốn biến R2
// nếu muốn xem kho thật thay vì thư mục uploads/pdf local).
import mongoose from "mongoose";
import dotenv from "dotenv";
import { PdfFile } from "../models.js";
import {
  QUOTA,
  usageReport,
  describeUsage,
  formatBytes,
  reconcile,
  runQuotaCheck
} from "../pdf-quota.js";

dotenv.config();

const args = new Set(process.argv.slice(2));
const sweep = args.has("--sweep");
const notify = args.has("--notify");

if (!process.env.MONGODB_URI) {
  console.error("Thiếu MONGODB_URI trong server/.env");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

try {
  console.log(
    `Ngưỡng: cảnh báo ${formatBytes(QUOTA.warnBytes)} · gần đầy ${formatBytes(QUOTA.highBytes)} · ` +
    `trần cứng ${formatBytes(QUOTA.limitBytes)} · chờ dọn ${QUOTA.graceMs / 3_600_000} giờ`
  );

  if (sweep) {
    const { report, cleanup } = await runQuotaCheck({ sweep: true, notify });
    console.log(`Đã dọn: xoá ${cleanup.deleted} file (${formatBytes(cleanup.deletedBytes)}).`);
    console.log(describeUsage(report));
  } else {
    const { plan, drift } = await reconcile({ dryRun: true });
    console.log(describeUsage(await usageReport()));
    console.log(
      `Nếu chạy --sweep: xoá ${plan.sweep.length} file, đánh dấu mồ côi thêm ${drift.orphan.length}, ` +
      `hồi sinh ${drift.revive.length}, bỏ ${plan.ghosts.length} dòng sổ không có bytes, ` +
      `nhận vào sổ ${plan.adopt.length} file chưa được đếm.`
    );
    // Danh sách file đang chờ dọn — xem trước để biết mình sắp mất gì, nhất là
    // lần đầu chạy trên dữ liệu cũ.
    const waiting = await PdfFile.find({ orphanedAt: { $ne: null } })
      .select("fileId name size boardId orphanedAt")
      .sort({ orphanedAt: 1 })
      .limit(50)
      .lean();
    if (waiting.length) {
      console.log(`\n${waiting.length} file đang chờ dọn (mới nhất ở cuối):`);
      for (const f of waiting) {
        const hours = Math.round((Date.now() - new Date(f.orphanedAt).getTime()) / 3_600_000);
        const ready = hours * 3_600_000 >= QUOTA.graceMs ? "ĐẾN LƯỢT" : `còn chờ`;
        console.log(`  ${f.fileId}  ${formatBytes(f.size)}  mồ côi ${hours}h  ${ready}  ${f.name || "(không tên)"}`);
      }
    }
  }
} finally {
  await mongoose.disconnect();
}
