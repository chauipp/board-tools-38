import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeGeom, MAX_LIVE_GEOM_ITEMS } from "./sanitize-geom.js";

test("geom: payload không phải object hoặc không có item nào thì bỏ", () => {
  assert.equal(sanitizeGeom(null), null);
  assert.equal(sanitizeGeom("x"), null);
  assert.equal(sanitizeGeom({}), null);
  assert.equal(sanitizeGeom({ nodes: "x", groups: 5 }), null);
  assert.equal(sanitizeGeom({ nodes: [{ id: 1, x: NaN, y: 0 }] }), null);
});

test("geom: item thiếu id/x/y số hữu hạn bị bỏ riêng, không bỏ cả gói", () => {
  const clean = sanitizeGeom({
    nodes: [null, { id: "1", x: 0, y: 0 }, { id: 2, x: Infinity, y: 0 }, { id: 3, x: 1, y: 2 }],
    groups: [{ id: 4, x: 0 }, { id: 5, x: 3, y: 4, w: 10, h: 20 }]
  });
  assert.deepEqual(clean, {
    nodes: [{ id: 3, x: 1, y: 2, w: undefined, h: undefined }],
    groups: [{ id: 5, x: 3, y: 4, w: 10, h: 20 }],
    done: false
  });
});

test("geom: w/h rác thành undefined, field lạ không đi qua", () => {
  const clean = sanitizeGeom({ nodes: [{ id: 1, x: 0, y: 0, w: "big", h: NaN, title: "x", image: "data:" }] });
  assert.deepEqual(clean.nodes, [{ id: 1, x: 0, y: 0, w: undefined, h: undefined }]);
});

test("geom: mỗi danh sách bị chặn ở MAX_LIVE_GEOM_ITEMS — không bơm được mảng khổng lồ", () => {
  const many = Array.from({ length: MAX_LIVE_GEOM_ITEMS + 50 }, (_, i) => ({ id: i, x: i, y: i }));
  const clean = sanitizeGeom({ nodes: many, groups: many });
  assert.equal(clean.nodes.length, MAX_LIVE_GEOM_ITEMS);
  assert.equal(clean.groups.length, MAX_LIVE_GEOM_ITEMS);
});

test("geom: done chỉ là true khi client gửi đúng `true`", () => {
  assert.equal(sanitizeGeom({ nodes: [{ id: 1, x: 0, y: 0 }], done: true }).done, true);
  assert.equal(sanitizeGeom({ nodes: [{ id: 1, x: 0, y: 0 }], done: "yes" }).done, false);
});
