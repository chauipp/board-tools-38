import { test, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { Board } from "../models.js";
import boardFilesRouter from "./board-files.js";
import boardsRouter from "./boards.js";
import boardSnapshotsRouter from "./board-snapshots.js";
import boardMembersRouter from "./board-members.js";

const OWNER = "owner@example.test";
const ID = "abcdefabcdefabcdefabcdef";

const originals = { countDocuments: Board.countDocuments, create: Board.create, findById: Board.findById };
after(() => Object.assign(Board, originals));

async function fixture(t) {
  const created = [];
  Board.countDocuments = async () => 0;
  Board.create = async (doc) => { created.push(doc); return { _id: ID }; };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { email: OWNER }; next(); });
  // Cùng thứ tự mount với app.js.
  app.use("/api/boards", boardFilesRouter, boardsRouter, boardSnapshotsRouter, boardMembersRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = async (method, url, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  return { request, created };
}

test("routes: id không phải ObjectId thì 404 not_found (CastError), ở cả bốn router", async (t) => {
  const { request } = await fixture(t);
  Board.findById = () => {
    const q = { select() { return q; }, lean() { return q; }, then(_r, reject) { return Promise.reject(Object.assign(new Error("cast"), { name: "CastError" })).then(_r, reject); } };
    return q;
  };
  for (const [method, url] of [
    ["GET", "/api/boards/not-an-id"],
    ["GET", "/api/boards/not-an-id/files/00000000-0000-0000-0000-000000000000.pdf"],
    ["GET", "/api/boards/not-an-id/snapshots"],
    ["GET", "/api/boards/not-an-id/members"]
  ]) {
    const res = await request(method, url);
    assert.deepEqual(res, { status: 404, body: { error: "not_found" } }, url);
  }
});

test("routes: lỗi khác thì 500 với đúng câu lỗi của từng route", async (t) => {
  const { request } = await fixture(t);
  Board.findById = () => {
    const q = { select() { return q; }, lean() { return q; }, then(_r, reject) { return Promise.reject(new Error("down")).then(_r, reject); } };
    return q;
  };
  for (const [method, url, message] of [
    ["GET", `/api/boards/${ID}`, "Không đọc được dữ liệu board."],
    ["PUT", `/api/boards/${ID}`, "Không lưu được dữ liệu board."],
    ["DELETE", `/api/boards/${ID}`, "Không xoá được board."],
    ["GET", `/api/boards/${ID}/files/00000000-0000-0000-0000-000000000000.pdf`, "Không đọc được PDF."],
    ["GET", `/api/boards/${ID}/snapshots`, "Không đọc được snapshot."],
    ["POST", `/api/boards/${ID}/snapshots`, "Không tạo được snapshot."],
    ["POST", `/api/boards/${ID}/snapshots/s1/restore`, "Không khôi phục được snapshot."],
    ["GET", `/api/boards/${ID}/members`, "Không đọc được danh sách thành viên."],
    ["POST", `/api/boards/${ID}/members`, "Không mời được thành viên."],
    ["PATCH", `/api/boards/${ID}/members/a@b.c`, "Không đổi được vai trò."],
    ["DELETE", `/api/boards/${ID}/members/a@b.c`, "Không xoá được thành viên."]
  ]) {
    const res = await request(method, url, method === "GET" || method === "DELETE" ? undefined : {});
    assert.deepEqual(res, { status: 500, body: { error: message } }, `${method} ${url}`);
  }
});
