import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserName } from "./user.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    map
  };
}

test("trả về tên có sẵn, không hỏi prompt", () => {
  const storage = fakeStorage({ "idea-map-user": "Linh" });
  let called = false;
  const name = getUserName(storage, () => { called = true; return "Khác"; });
  assert.equal(name, "Linh");
  assert.equal(called, false);
});

test("prompt rỗng → trả về null, không lưu", () => {
  const storage = fakeStorage();
  const name = getUserName(storage, () => "");
  assert.equal(name, null);
  assert.equal(storage.map.has("idea-map-user"), false);
});

test("nhập tên → trim rồi lưu vào storage", () => {
  const storage = fakeStorage();
  const name = getUserName(storage, () => "  Minh  ");
  assert.equal(name, "Minh");
  assert.equal(storage.getItem("idea-map-user"), "Minh");
});
