import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  isEmailAllowed,
  signSession,
  verifySession,
  parseSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
  getBoardRole
} from "./auth.js";

before(() => {
  process.env.SESSION_SECRET = "test-secret";
});

test("isEmailAllowed: denies everyone when ALLOWED_EMAILS is unset", () => {
  delete process.env.ALLOWED_EMAILS;
  assert.equal(isEmailAllowed("anyone@gmail.com"), false);
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
