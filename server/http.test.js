import { test } from "node:test";
import assert from "node:assert/strict";
import { asyncRoute } from "./http.js";

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("asyncRoute: handler chạy bình thường thì không đụng vào response", async () => {
  const res = fakeRes();
  const seen = [];
  await asyncRoute(async (req, r, next) => { seen.push(req.x, typeof next); r.json({ ok: true }); }, "lỗi")({ x: 1 }, res, () => {});
  assert.deepEqual(seen, [1, "function"]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});

test("asyncRoute: CastError thành 404 not_found", async () => {
  const res = fakeRes();
  await asyncRoute(async () => { throw Object.assign(new Error("bad id"), { name: "CastError" }); }, "Không đọc được.")({}, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: "not_found" });
});

test("asyncRoute: lỗi khác thành 500 với đúng câu lỗi của route, không lộ chi tiết", async () => {
  const res = fakeRes();
  await asyncRoute(async () => { throw new Error("mongo down: secret detail"); }, "Không lưu được dữ liệu board.")({}, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "Không lưu được dữ liệu board." });
});

test("asyncRoute: lỗi đồng bộ trong handler cũng bị bắt", async () => {
  const res = fakeRes();
  await asyncRoute(() => { throw new Error("sync"); }, "x")({}, res);
  assert.equal(res.statusCode, 500);
});

test("asyncRoute: onError chạy trước khi trả lỗi, cả với CastError lẫn lỗi khác", async () => {
  for (const [error, status] of [[Object.assign(new Error(), { name: "CastError" }), 404], [new Error("x"), 500]]) {
    const calls = [];
    const res = fakeRes();
    const req = { file: { path: "/tmp/x.pdf" } };
    await asyncRoute(async () => { throw error; }, "Không tải được PDF.", {
      onError: (r, e) => calls.push([r, e, res.body])
    })(req, res);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], req);
    assert.equal(calls[0][1], error);
    assert.equal(calls[0][2], undefined, "chưa trả lỗi lúc onError chạy");
    assert.equal(res.statusCode, status);
  }
});

test("asyncRoute: không lỗi thì onError không chạy", async () => {
  let called = false;
  await asyncRoute(async () => {}, "x", { onError: () => { called = true; } })({}, fakeRes());
  assert.equal(called, false);
});
