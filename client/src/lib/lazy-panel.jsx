import { lazy, Suspense } from "react";

// Panel tải chậm (React.lazy) mà chỗ dùng không phải đổi gì: component trả về
// tự bọc Suspense với fallback rỗng. Suspense không thêm nút DOM nào, nên khi
// panel đã tải thì cây DOM y hệt lúc import tĩnh; lần mở đầu tiên panel chỉ
// hiện trễ đúng thời gian tải chunk của nó.
export function lazyPanel(load) {
  const Lazy = lazy(load);
  return function LazyPanel(props) {
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
