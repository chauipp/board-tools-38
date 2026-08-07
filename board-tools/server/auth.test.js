import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  isEmailAllowed,
  isPublicMode,
  allowlistStartupError,
  signSession,
  verifySession,
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
  getBoardRole
} from "./auth.js";

before(() => {
  process.env.SESSION_SECRET = "test-secret";
});

// Đây là chốt an ninh quan trọng nhất của app: danh sách trống từng có nghĩa là
// "cho tất cả", nên chỉ cần quên một biến môi trường là mọi tài khoản Google vào
// được — và cùng tiêu chung hạn mức kho PDF.
test("isEmailAllowed: danh sách trống thì CẤM hết, không còn mặc định mở cửa", () => {
  delete process.env.ALLOWED_EMAILS;
  delete process.env.PUBLIC_MODE;
  assert.equal(isEmailAllowed("anyone@gmail.com"), false);
});

test("isEmailAllowed: chỉ mở cửa khi khai PUBLIC_MODE=true một cách rõ ràng", () => {
  delete process.env.ALLOWED_EMAILS;
  process.env.PUBLIC_MODE = "true";
  assert.equal(isEmailAllowed("anyone@gmail.com"), true);
  delete process.env.PUBLIC_MODE;
});

test("isPublicMode: chỉ đúng chữ 'true' mới tính, không nhận giá trị mơ hồ", () => {
  for (const v of ["1", "yes", "TRUE ", "True"]) {
    process.env.PUBLIC_MODE = v;
    // "TRUE " và "True" vẫn tính (cắt khoảng trắng, không phân biệt hoa thường);
    // "1" và "yes" thì không — đọc lướt qua .env phải thấy ngay là đang mở cửa.
    assert.equal(isPublicMode(), v.trim().toLowerCase() === "true", `PUBLIC_MODE=${v}`);
  }
  delete process.env.PUBLIC_MODE;
});

test("allowlistStartupError: chặn server khởi động khi chưa cấu hình gì", () => {
  delete process.env.ALLOWED_EMAILS;
  delete process.env.PUBLIC_MODE;
  assert.match(allowlistStartupError(), /ALLOWED_EMAILS/);
});

test("allowlistStartupError: im lặng khi đã có danh sách, hoặc đã cố ý mở cửa", () => {
  process.env.ALLOWED_EMAILS = "a@b.com";
  delete process.env.PUBLIC_MODE;
  assert.equal(allowlistStartupError(), null);

  delete process.env.ALLOWED_EMAILS;
  process.env.PUBLIC_MODE = "true";
  assert.equal(allowlistStartupError(), null);
  delete process.env.PUBLIC_MODE;
});

test("isEmailAllowed: matches case-insensitively against the list", () => {
  process.env.ALLOWED_EMAILS = "Alice@Gmail.com, bob@gmail.com";
  assert.equal(isEmailAllowed("alice@gmail.com"), true);
  assert.equal(isEmailAllowed("BOB@GMAIL.COM"), true);
  assert.equal(isEmailAllowed("carol@gmail.com"), false);
});

test("signSession/verifySession round-trip preserves user fields", () => {
  const token = signSession({ email: "a@b.com", name: "A B", picture: "http://x/p.png" });
  const decoded = verifySession(token);
  assert.deepEqual(decoded, { email: "a@b.com", name: "A B", picture: "http://x/p.png" });
});

test("verifySession returns null for a garbage token", () => {
  assert.equal(verifySession("not-a-jwt"), null);
});

test("parseSessionFromCookieHeader finds the session cookie among others", () => {
  const token = signSession({ email: "a@b.com", name: "A B", picture: null });
  const header = `theme-pref=dark; ${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; other=1`;
  assert.deepEqual(parseSessionFromCookieHeader(header), { email: "a@b.com", name: "A B", picture: null });
});

test("parseSessionFromCookieHeader returns null when the cookie is absent", () => {
  assert.equal(parseSessionFromCookieHeader("theme-pref=dark"), null);
  assert.equal(parseSessionFromCookieHeader(undefined), null);
});

test("getBoardRole: owner email returns 'owner', case-insensitively", () => {
  const board = { ownerEmail: "owner@x.com", members: [] };
  assert.equal(getBoardRole(board, "owner@x.com"), "owner");
  assert.equal(getBoardRole(board, "OWNER@X.COM"), "owner");
});

test("getBoardRole: member email returns their stored role", () => {
  const board = {
    ownerEmail: "owner@x.com",
    members: [{ email: "ed@x.com", role: "editor" }, { email: "vw@x.com", role: "viewer" }]
  };
  assert.equal(getBoardRole(board, "ed@x.com"), "editor");
  assert.equal(getBoardRole(board, "vw@x.com"), "viewer");
});

// Nhánh member là đường đi của mọi request không phải chủ sở hữu: email lưu
// trong members[] có thể khác hoa/thường với email trong session JWT.
test("getBoardRole: member email matches case-insensitively both ways", () => {
  const board = {
    ownerEmail: "owner@x.com",
    members: [{ email: "Ed@X.com", role: "editor" }, { email: "vw@x.com", role: "viewer" }]
  };
  assert.equal(getBoardRole(board, "ed@x.com"), "editor");
  assert.equal(getBoardRole(board, "ED@X.COM"), "editor");
  assert.equal(getBoardRole(board, "VW@X.COM"), "viewer");
});

test("getBoardRole: unrelated email returns null", () => {
  const board = { ownerEmail: "owner@x.com", members: [] };
  assert.equal(getBoardRole(board, "stranger@x.com"), null);
});

test("getBoardRole: empty or missing email returns null", () => {
  const board = { ownerEmail: "owner@x.com", members: [] };
  assert.equal(getBoardRole(board, ""), null);
  assert.equal(getBoardRole(board, undefined), null);
});
