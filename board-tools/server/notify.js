import dotenv from "dotenv";

dotenv.config();

// Discord webhook: dán URL vào DISCORD_WEBHOOK_URL là xong, không cần thêm thư
// viện nào — chỉ là một POST JSON. URL của Slack cũng nhận đúng field "content"
// cho tin nhắn thường, nên biến này dùng được cho cả hai.
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

// Discord cắt tin nhắn ở 2000 ký tự và trả 400 nếu vượt; cảnh báo của mình ngắn
// hơn nhiều, nhưng cắt sẵn để một thông báo dài bất thường không làm mất luôn cả
// tin nhắn.
const MAX_LEN = 1900;

// Cảnh báo mà làm chết luồng gọi nó thì tệ hơn là không cảnh báo: nơi gọi là
// cron dọn rác và route upload. Nên hàm này không bao giờ throw — thất bại thì
// ghi log rồi trả về false.
export async function sendAlert(text) {
  console.log(`[notify] ${text.replace(/\n/g, " | ")}`);
  if (!WEBHOOK_URL) return false;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.slice(0, MAX_LEN) }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) {
      console.warn(`[notify] webhook trả ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[notify] không gửi được cảnh báo: ${e.message}`);
    return false;
  }
}
