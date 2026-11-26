// Tạo một entry cho PASSWORD_ACCOUNTS.
//
//   node scripts/hash-password.mjs <username> [email]
//
// Mật khẩu đọc từ stdin (gõ vào khi được hỏi, hoặc pipe vào) để nó không nằm
// trong lịch sử shell. In ra đúng một dòng `username:email:salt:hash` — dán vào
// PASSWORD_ACCOUNTS (nhiều tài khoản thì nối bằng dấu phẩy).
import readline from "node:readline";
import { hashPassword } from "../auth.js";

const [username, email = ""] = process.argv.slice(2);
if (!username || !/^[a-z0-9._-]{3,64}$/i.test(username)) {
  console.error("Cách dùng: node scripts/hash-password.mjs <username> [email]");
  console.error("username: 3–64 ký tự a-z, 0-9, dấu chấm, gạch ngang, gạch dưới.");
  process.exit(1);
}

async function readPassword() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: false });
  if (process.stdin.isTTY) process.stderr.write("Mật khẩu: ");
  for await (const line of rl) {
    rl.close();
    return line;
  }
  return "";
}

const password = await readPassword();
if (!password) {
  console.error("Mật khẩu trống.");
  process.exit(1);
}
const { salt, hash } = await hashPassword(password);
console.log(`${username.toLowerCase()}:${email.trim().toLowerCase()}:${salt}:${hash}`);
