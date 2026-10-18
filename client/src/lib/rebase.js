// Ghép thay đổi của mình lên trên bản mới nhất của server, sau khi server từ
// chối một lần lưu vì có người khác lưu trước.
//
// Vì sao cần: mỗi lần lưu là một cú PUT mang TOÀN BỘ board, và server ghi đè cả
// document. Hai người cùng sửa thì người lưu sau đè mất thay đổi của người lưu
// trước — âm thầm, cả trên server lẫn trên màn hình người bị mất khi gói
// board:update phát lại về. Cửa sổ đúng bằng một vòng mạng, nên nó không xảy ra
// mỗi ngày, nhưng khi xảy ra thì không ai biết gì cả.
//
// Cách chữa ở đây KHÔNG phải là "ai lưu trước thắng" — như vậy chỉ đổi người
// mất. Server phát hiện va chạm và trả về bản của nó; phía này tính xem TỪ LÚC
// đồng bộ lần cuối MÌNH đã đổi những gì, rồi đắp đúng chừng ấy thay đổi lên bản
// của server. Hai người sửa hai thẻ khác nhau thì cả hai thay đổi cùng sống.
//
// Toàn bộ file là hàm thuần (board → board), không chạm React, không chạm mạng
// — vì đây là đường dữ liệu, chỗ mà một lỗi tinh vi nghĩa là mất việc của người
// dùng chứ không phải một khung hình xấu.

// Mọi bộ sưu tập trong board đều là mảng các đối tượng có `id`, mỗi bộ đi kèm
// một bộ đếm id kế tiếp. Liệt kê ra một chỗ để thêm bộ mới thì chỉ sửa ở đây.
export const COLLECTIONS = [
  { key: "nodes", counter: "nextNodeId" },
  { key: "edges", counter: "nextEdgeId" },
  { key: "groups", counter: "nextGroupId" },
  { key: "statuses", counter: "nextStatusId" },
  { key: "tags", counter: "nextTagId" },
  { key: "palette", counter: "nextPaletteId" },
  { key: "drawings", counter: "nextDrawingId" }
];

// Thiết lập cấp bảng: không có id, nên chỉ có luật "ai đổi thì người đó thắng".
const SCALARS = ["bg", "grid", "pack", "kind", "gameDesignBrief", "gameDesignFlow", "gameDesignBalance"];

function listOf(board, key) {
  const v = board ? board[key] : null;
  return Array.isArray(v) ? v : [];
}

function byId(list) {
  const m = new Map();
  for (const o of list) if (o && Number.isFinite(o.id)) m.set(o.id, o);
  return m;
}

// So sánh bằng JSON: đủ cho dữ liệu board (số, chuỗi, mảng, đối tượng phẳng) và
// không cần một hàm deepEqual riêng để bảo trì. Thứ tự khoá khác nhau có thể
// cho ra "đã đổi" dù nội dung y hệt — vô hại, chỉ khiến ta khẳng định lại đúng
// giá trị đó. Chiều ngược lại (nội dung khác mà báo giống) thì không xảy ra.
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Một bộ sưu tập đã đổi những gì giữa `base` (lần đồng bộ cuối) và `next`
 * (bản mình muốn lưu).
 */
export function diffCollection(base, next) {
  const B = byId(base || []);
  const N = byId(next || []);
  const removed = [];
  const added = [];
  const changed = [];
  for (const id of B.keys()) if (!N.has(id)) removed.push(id);
  for (const [id, item] of N) {
    const before = B.get(id);
    if (!before) added.push(item);
    else if (!same(before, item)) changed.push(item);
  }
  return { removed, added, changed };
}

export function diffBoard(base, next) {
  const collections = {};
  for (const { key } of COLLECTIONS) {
    collections[key] = diffCollection(listOf(base, key), listOf(next, key));
  }
  const scalars = {};
  for (const k of SCALARS) {
    const before = base ? base[k] ?? null : null;
    const after = next ? next[k] ?? null : null;
    if (before !== after) scalars[k] = after;
  }
  return { collections, scalars };
}

// Có thay đổi nào để đắp lên không. Không có thì không cần lưu lại lần nữa.
export function isEmptyDelta(delta) {
  if (Object.keys(delta.scalars).length) return false;
  for (const { key } of COLLECTIONS) {
    const d = delta.collections[key];
    if (d.removed.length || d.added.length || d.changed.length) return false;
  }
  return true;
}

function maxId(list) {
  let m = 0;
  for (const o of list) if (o && Number.isFinite(o.id) && o.id > m) m = o.id;
  return m;
}

// Thứ mình vừa TẠO có thể trùng id với thứ người kia vừa tạo: hai máy cùng đọc
// nextNodeId = 57 rồi cùng cấp id 57 cho hai thẻ khác nhau. Đắp thẳng lên là
// board có hai thẻ id 57 — hỏng nặng hơn hẳn cái lỗi đang chữa. Nên thứ của
// MÌNH được cấp id mới, và mọi chỗ trỏ tới nó phải viết lại theo.
//
// Chỉ tính là va chạm khi server có id đó mà `base` thì không: nếu base cũng có
// thì đó chính là thứ mình đang sửa, không phải thứ mới.
function planRemap(server, base, delta) {
  const plan = {};
  for (const { key, counter } of COLLECTIONS) {
    const added = delta.collections[key].added;
    if (!added.length) continue;
    const serverIds = byId(listOf(server, key));
    const baseIds = byId(listOf(base, key));
    const map = new Map();
    let free = Math.max(
      maxId(listOf(server, key)),
      maxId(added),
      Number.isFinite(server?.[counter]) ? server[counter] - 1 : 0
    );
    for (const item of added) {
      if (!serverIds.has(item.id) || baseIds.has(item.id)) continue;
      free += 1;
      map.set(item.id, free);
    }
    if (map.size) plan[key] = map;
  }
  return plan;
}

function remapped(plan, key, id) {
  const m = plan[key];
  if (!m) return id;
  const next = m.get(id);
  return next === undefined ? id : next;
}

// Viết lại mọi tham chiếu id bên trong MỘT phần tử của mình. Phần tử của server
// không bao giờ đi qua đây: chúng đã nhất quán với nhau rồi, chỉ có phía mình
// mới bị đổi id.
//
// Bản đồ tham chiếu trong board:
//   edge.from/to  → nodes hoặc groups, tuỳ fromKind/toKind
//   node.statusId → statuses ·  node.tagId → tags
//   color         → palette, dưới dạng CHUỖI token "pal-<id>" (xem lib/palette.js)
function rewriteRefs(key, item, plan) {
  let out = item;
  const set = (field, value) => {
    if (out[field] === value) return;
    if (out === item) out = { ...item };
    out[field] = value;
  };

  if (Object.prototype.hasOwnProperty.call(item, "color") && typeof item.color === "string") {
    const m = /^pal-(\d+)$/.exec(item.color);
    if (m) {
      const to = remapped(plan, "palette", Number(m[1]));
      if (to !== Number(m[1])) set("color", "pal-" + to);
    }
  }

  if (key === "nodes") {
    if (Number.isFinite(item.statusId)) set("statusId", remapped(plan, "statuses", item.statusId));
    if (Number.isFinite(item.tagId)) set("tagId", remapped(plan, "tags", item.tagId));
  }

  if (key === "edges") {
    const endpoint = (kindField, idField) => {
      const bucket = (item[kindField] || "node") === "group" ? "groups" : "nodes";
      if (Number.isFinite(item[idField])) set(idField, remapped(plan, bucket, item[idField]));
    };
    endpoint("fromKind", "from");
    endpoint("toKind", "to");
  }

  const selfId = remapped(plan, key, item.id);
  if (selfId !== item.id) set("id", selfId);
  return out;
}

/**
 * Đắp thay đổi của mình (base → next) lên bản `server`.
 *
 * Trả về null khi kết quả không lành lặn (id trùng, dây nối trỏ vào hư không).
 * Người gọi phải coi null là "không ghép được, đi đường dự phòng" — thà quay về
 * đúng hành vi cũ còn hơn ghi một board hỏng.
 */
export function rebaseBoard(server, base, next) {
  if (!server || !base || !next) return null;
  const delta = diffBoard(base, next);
  const plan = planRemap(server, base, delta);
  const out = { ...server };

  for (const { key, counter } of COLLECTIONS) {
    const d = delta.collections[key];
    const dropped = new Set(d.removed);
    const list = listOf(server, key).filter((o) => !dropped.has(o.id));
    const pos = new Map(list.map((o, i) => [o.id, i]));

    for (const raw of d.changed) {
      const item = rewriteRefs(key, raw, plan);
      const at = pos.get(item.id);
      // Người kia XOÁ thứ mình vừa sửa: tôn trọng cú xoá. Dựng lại một thẻ đã bị
      // xoá chỉ vì mình lỡ đổi màu nó là hồi sinh thứ người ta cố ý bỏ đi.
      if (at === undefined) continue;
      list[at] = item;
    }
    for (const raw of d.added) {
      const item = rewriteRefs(key, raw, plan);
      if (pos.has(item.id)) continue;
      pos.set(item.id, list.length);
      list.push(item);
    }

    out[key] = list;
    // Bộ đếm luôn tiến, không bao giờ lùi: lấy giá trị lớn nhất trong ba nguồn
    // và luôn lớn hơn mọi id đang có. Lùi bộ đếm là lần tạo sau sẽ cấp lại một
    // id đang được dùng.
    out[counter] = Math.max(
      Number.isFinite(server[counter]) ? server[counter] : 1,
      Number.isFinite(next[counter]) ? next[counter] : 1,
      maxId(list) + 1
    );
  }

  for (const [k, v] of Object.entries(delta.scalars)) out[k] = v;

  // Dây mồ côi. Mình xoá một cái thẻ (nên delta có cả cú xoá thẻ LẪN cú xoá
  // những dây nối vào nó), nhưng cùng lúc người kia vừa nối thêm một dây mới
  // vào đúng thẻ đó — dây ấy chỉ có trong bản của server nên delta của mình
  // không đụng tới, và sau khi thẻ biến mất nó treo lơ lửng. Cắt ở đây, đúng
  // như deleteNode vẫn làm khi xoá một thẻ.
  const nodeIds = new Set(listOf(out, "nodes").map((n) => n.id));
  const groupIds = new Set(listOf(out, "groups").map((g) => g.id));
  out.edges = listOf(out, "edges").filter((e) => {
    const from = (e.fromKind || "node") === "group" ? groupIds : nodeIds;
    const to = (e.toKind || "node") === "group" ? groupIds : nodeIds;
    return from.has(e.from) && to.has(e.to);
  });

  return isSaneBoard(out) ? out : null;
}

/**
 * Chốt chặn cuối trước khi một board ghép được đem đi lưu: id không trùng, và
 * mọi dây nối đều còn hai đầu. Rẻ (một lượt quét), và nó là thứ cho phép đường
 * dự phòng tồn tại — có nó thì kết quả ghép không bao giờ tệ hơn hành vi cũ.
 */
export function isSaneBoard(board) {
  if (!board) return false;
  for (const { key } of COLLECTIONS) {
    const list = listOf(board, key);
    const seen = new Set();
    for (const o of list) {
      if (!o || !Number.isFinite(o.id)) return false;
      if (seen.has(o.id)) return false;
      seen.add(o.id);
    }
  }
  const nodeIds = new Set(listOf(board, "nodes").map((n) => n.id));
  const groupIds = new Set(listOf(board, "groups").map((g) => g.id));
  for (const e of listOf(board, "edges")) {
    const from = (e.fromKind || "node") === "group" ? groupIds : nodeIds;
    const to = (e.toKind || "node") === "group" ? groupIds : nodeIds;
    if (!from.has(e.from) || !to.has(e.to)) return false;
  }
  return true;
}
