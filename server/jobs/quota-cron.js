import { runQuotaCheck } from "../pdf-quota.js";

// Cron dọn rác + đo dung lượng kho PDF. Là setInterval trong tiến trình, không
// phải Render Cron Job: cron của Render là dịch vụ trả tiền, còn cái này chạy
// miễn phí ngay trong web service.
//
// Đánh đổi phải biết: web service free của Render ngủ sau 15 phút không ai truy
// cập, và lúc ngủ thì interval không chạy. Nên đây là "mỗi 6 giờ nếu app còn
// thức", không phải đúng giờ tuyệt đối. Với việc chỉ để cảnh báo dung lượng thì
// đủ, vì dung lượng chỉ tăng khi có người dùng app — mà lúc đó app đang thức.
const QUOTA_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function scheduleQuotaChecks() {
  const run = () =>
    runQuotaCheck().catch((e) => console.warn(`[pdf-quota] vòng kiểm tra lỗi: ${e.message}`));
  // Chạy một lượt sau khi khởi động, chậm 30 giây để không giành tài nguyên với
  // lúc app đang lên và phục vụ request đầu tiên.
  setTimeout(run, 30_000).unref();
  setInterval(run, QUOTA_CHECK_INTERVAL_MS).unref();
}
