import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeView, findsCycle, resolveFollow, countWatchers, releaseFollowersOf
} from "./follow.js";

function room(spec) {
  return new Map(Object.entries(spec).map(([id, followingId]) => [id, { followingId }]));
}

const OK_VIEW = { panX: -120, panY: 40, scale: 1.2, w: 1440, h: 900 };

test("view hợp lệ đi qua nguyên vẹn, không mang thêm field lạ", () => {
  assert.deepEqual(sanitizeView({ ...OK_VIEW, evil: "x" }), OK_VIEW);
});

test("view thiếu số hoặc số vô hạn thì bị chặn", () => {
  for (const bad of [null, undefined, "x", {}, { ...OK_VIEW, panX: NaN }, { ...OK_VIEW, scale: Infinity }]) {
    assert.equal(sanitizeView(bad), null, JSON.stringify(bad));
  }
});

// Camera của người bị ghim được áp THẲNG lên màn hình người ghim. Số hữu hạn mà
// khổng lồ vẫn là màn hình trắng, nên biên độ mới là chốt thật, không phải
// Number.isFinite.
test("pan/scale/viewport ngoài biên độ bị chặn dù vẫn là số hữu hạn", () => {
  assert.equal(sanitizeView({ ...OK_VIEW, panX: 1e9 }), null);
  assert.equal(sanitizeView({ ...OK_VIEW, scale: 1e6 }), null);
  assert.equal(sanitizeView({ ...OK_VIEW, scale: 0 }), null);
  assert.equal(sanitizeView({ ...OK_VIEW, w: 0 }), null, "w = 0 làm phép fit chia cho 0 → NaN");
  assert.equal(sanitizeView({ ...OK_VIEW, h: -900 }), null);
});

test("chuỗi ghim A→B→C là hợp lệ, chỉ vòng khép kín mới bị cấm", () => {
  // C tự lái, B nhìn theo C, A nhìn theo B — không ai đuổi ai.
  assert.equal(findsCycle(room({ a: "b", b: "c", c: null }), "a", "b"), false);
  // B đang ghim A, giờ A đòi ghim B → hai camera đuổi nhau.
  assert.equal(findsCycle(room({ a: null, b: "a" }), "a", "b"), true);
  // Vòng dài: C ghim B, B ghim A; A đòi ghim C là khép vòng ba người.
  assert.equal(findsCycle(room({ a: null, b: "a", c: "b" }), "a", "c"), true);
});

// Nếu dữ liệu đã hỏng tới mức có sẵn một vòng KHÔNG chứa người đang hỏi, phép
// đi ngược chuỗi sẽ quay mãi — trần lặp là thứ giữ cho server không treo.
test("vòng có sẵn không chứa người hỏi vẫn dừng, không lặp vô tận", () => {
  assert.equal(findsCycle(room({ a: null, b: "c", c: "b" }), "a", "b"), true);
});

test("resolveFollow chặn tự ghim mình, ghim người đã rời, và id không phải chuỗi", () => {
  const peers = room({ a: null, b: null });
  assert.deepEqual(resolveFollow(peers, "a", "a"), { ok: false, reason: "self" });
  assert.deepEqual(resolveFollow(peers, "a", "zzz"), { ok: false, reason: "gone" });
  assert.deepEqual(resolveFollow(peers, "a", 7), { ok: false, reason: "bad_target" });
  assert.deepEqual(resolveFollow(peers, "a", "b"), { ok: true, targetId: "b" });
});

// null = bỏ ghim. Phải luôn đi lọt, kể cả khi mục tiêu cũ vừa rời phòng — không
// thì người dùng bị kẹt trong trạng thái ghim một socket không còn tồn tại.
test("bỏ ghim (null) luôn hợp lệ", () => {
  assert.deepEqual(resolveFollow(room({}), "a", null), { ok: true, targetId: null });
});

test("đếm đúng số người đang xem màn hình của một người", () => {
  const peers = room({ a: "c", b: "c", c: null, d: "b" });
  assert.equal(countWatchers(peers, "c"), 2);
  assert.equal(countWatchers(peers, "b"), 1);
  assert.equal(countWatchers(peers, "a"), 0);
});

// Người bị ghim rời phòng mà không thả người ghim: người ghim ngồi chờ view của
// một socket đã chết, màn hình đứng im và trông hệt như mạng lag.
test("người bị ghim rời phòng thì người ghim được thả ra", () => {
  const peers = room({ a: "c", b: "c", c: null, d: null });
  assert.deepEqual(releaseFollowersOf(peers, "c").sort(), ["a", "b"]);
  assert.equal(peers.get("a").followingId, null);
  assert.equal(peers.get("b").followingId, null);
  assert.equal(peers.get("d").followingId, null, "người không ghim ai thì không bị đụng tới");
  assert.deepEqual(releaseFollowersOf(peers, "c"), [], "gọi lại lần nữa không thả thêm ai");
});
