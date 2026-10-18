import { test } from "node:test";
import assert from "node:assert/strict";
import { rafThrottle, trailingThrottle } from "./raf-throttle.js";

// rafThrottle chạy trên requestAnimationFrame của trình duyệt; ở node ta thay
// bằng một hàng đợi tự chạy tay để kiểm được đúng thời điểm "khung hình" nổ.
function withFakeRaf(run) {
  const queue = [];
  let nextId = 1;
  globalThis.requestAnimationFrame = (cb) => { queue.push([nextId, cb]); return nextId++; };
  globalThis.cancelAnimationFrame = (id) => {
    const i = queue.findIndex(([qid]) => qid === id);
    if (i >= 0) queue.splice(i, 1);
  };
  const frame = () => {
    const pending = queue.splice(0, queue.length);
    pending.forEach(([, cb]) => cb());
  };
  try {
    run(frame);
  } finally {
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  }
}

test("rafThrottle: nhiều lần gọi trong cùng khung hình chỉ chạy MỘT lần", () => {
  withFakeRaf((frame) => {
    const seen = [];
    const fn = rafThrottle((v) => seen.push(v));
    fn(1); fn(2); fn(3);
    assert.deepEqual(seen, [], "chưa qua khung hình thì chưa chạy");
    frame();
    assert.deepEqual(seen, [3], "và chạy với tham số MỚI NHẤT");
  });
});

test("rafThrottle: loạt gọi ở khung hình sau lại được chạy tiếp", () => {
  withFakeRaf((frame) => {
    const seen = [];
    const fn = rafThrottle((v) => seen.push(v));
    fn("a"); frame();
    fn("b"); frame();
    assert.deepEqual(seen, ["a", "b"]);
  });
});

test("rafThrottle: flush chạy ngay lần gọi còn treo — thả chuột không mất nhịp cuối", () => {
  withFakeRaf(() => {
    const seen = [];
    const fn = rafThrottle((v) => seen.push(v));
    fn(1); fn(2);
    fn.flush();
    assert.deepEqual(seen, [2]);
  });
});

test("rafThrottle: flush khi không có gì treo là no-op", () => {
  withFakeRaf((frame) => {
    const seen = [];
    const fn = rafThrottle((v) => seen.push(v));
    fn(1); frame();
    fn.flush();
    assert.deepEqual(seen, [1]);
  });
});

test("rafThrottle: cancel bỏ hẳn lần gọi còn treo", () => {
  withFakeRaf((frame) => {
    const seen = [];
    const fn = rafThrottle((v) => seen.push(v));
    fn(1);
    fn.cancel();
    frame();
    assert.deepEqual(seen, []);
  });
});

test("trailingThrottle: lần đầu chạy ngay, các lần trong cửa sổ bị gộp", async () => {
  const seen = [];
  const fn = trailingThrottle((v) => seen.push(v), 30);
  fn("a");
  assert.deepEqual(seen, ["a"]);
  fn("b"); fn("c");
  assert.deepEqual(seen, ["a"], "b và c vẫn đang chờ");
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(seen, ["a", "c"], "chỉ giá trị CUỐI của loạt được gửi");
});

test("trailingThrottle: flush đẩy ngay giá trị đang chờ", async () => {
  const seen = [];
  const fn = trailingThrottle((v) => seen.push(v), 50);
  fn("a");
  fn("b");
  fn.flush();
  assert.deepEqual(seen, ["a", "b"]);
});

test("trailingThrottle: cancel bỏ giá trị đang chờ", async () => {
  const seen = [];
  const fn = trailingThrottle((v) => seen.push(v), 20);
  fn("a");
  fn("b");
  fn.cancel();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(seen, ["a"]);
});
