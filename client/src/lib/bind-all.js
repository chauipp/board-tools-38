// Gắn CÙNG MỘT bảng tra (hàm/ref của IdeaMap) cho nhiều hook một lúc.
//
// Mỗi hook theo miền (useEdgeInteractions, useNodeInteractions, …) cần vài hàm
// mà IdeaMap chỉ có được SAU khi gọi hook đó — hàm của hook khác gọi sau, hoặc
// ref khai báo sau. Hook giữ chúng trong `depsRef` và chỉ đọc
// `depsRef.current.<tên>` lúc chạy handler, nên đưa chung một bảng (có thừa tên
// không dùng) là đủ. Gọi ở MỖI lượt render, sau lời gọi hook cuối cùng và
// trước nhánh return sớm: lúc đó mọi tên đều đã khai báo, nên truyền thẳng hàm
// được, không cần lớp vỏ gọi trễ.
export function bindAll(hooks, deps) {
  for (const hook of hooks) hook.bind(deps);
}
