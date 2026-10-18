import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";

// boards.js được import trước thân index.js trong ESM, nên nạp .env ngay tại
// đây để local R2 nhận được cấu hình; trên Render các biến đã có sẵn sớm hơn.
dotenv.config();

const localDir = path.join(process.cwd(), "uploads", "pdf");
const r2Vars = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
const present = r2Vars.filter((name) => Boolean(process.env[name]));

if (present.length && present.length !== r2Vars.length) {
  throw new Error(`Thiếu cấu hình R2: ${r2Vars.filter((name) => !process.env[name]).join(", ")}`);
}

const r2 = present.length === r2Vars.length
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    })
  : null;

export const isR2Enabled = Boolean(r2);
export const PDF_DIR = localDir;

function keyFor(fileId) {
  return `pdf/${fileId}`;
}

export async function storePdf(fileId, temporaryPath) {
  if (!r2) return;
  const body = await fs.promises.readFile(temporaryPath);
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: keyFor(fileId),
    Body: body,
    ContentType: "application/pdf",
    ContentDisposition: "inline"
  }));
}

// Xoá bytes đi hẳn. Không tìm thấy file cũng coi là thành công: nơi gọi là bộ
// dọn rác, và "đã không còn" đúng là kết quả nó muốn.
export async function deletePdf(fileId) {
  if (!r2) {
    await fs.promises.unlink(path.join(localDir, fileId)).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    return;
  }
  await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: keyFor(fileId) }));
}

// Đọc thẳng từ kho: file nào đang thật sự chiếm dung lượng, mỗi file bao nhiêu
// bytes. Dùng để đối chiếu với sổ sách trong Mongo — sổ có thể lệch nếu một cú
// upload chết giữa đường, và con số Cloudflare tính tiền là con số ở đây.
export async function listStoredPdfs() {
  if (!r2) {
    const names = await fs.promises.readdir(localDir).catch(() => []);
    const out = [];
    for (const name of names) {
      const stat = await fs.promises.stat(path.join(localDir, name)).catch(() => null);
      if (stat?.isFile()) out.push({ fileId: name, size: stat.size, lastModified: stat.mtime });
    }
    return out;
  }
  const out = [];
  let token;
  // Mỗi trang là một lần gọi Class A, nên lấy trần 1000 key/trang để cron ít gọi
  // nhất có thể.
  do {
    const page = await r2.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
      Prefix: "pdf/",
      MaxKeys: 1000,
      ContinuationToken: token
    }));
    for (const obj of page.Contents || []) {
      out.push({
        fileId: obj.Key.slice("pdf/".length),
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? null
      });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function sendPdf(fileId, res) {
  if (!r2) {
    const file = path.join(localDir, fileId);
    if (!fs.existsSync(file)) return false;
    res.type("application/pdf");
    res.sendFile(file);
    return true;
  }
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: keyFor(fileId) }));
    res.type(object.ContentType || "application/pdf");
    if (object.ContentLength != null) res.setHeader("Content-Length", String(object.ContentLength));
    object.Body.pipe(res);
    return true;
  } catch (e) {
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}
