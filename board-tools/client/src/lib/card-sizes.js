import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_CARD_W = 210;
export const DEFAULT_CARD_H = 110;

// Chiều cao thẻ phụ thuộc nội dung (mô tả dài ngắn, có ảnh hay không) nên bắt
// buộc phải đo DOM — không suy ra được từ dữ liệu. Nhưng cách đo cũ, gọi
// `canvasRef.querySelector(...).offsetWidth` mỗi lần cần, là nguồn giật lớn
// nhất của bản đồ:
//
//   - `offsetWidth/offsetHeight` đọc ngay sau khi vừa ghi style (left/top của
//     thẻ đang kéo) buộc trình duyệt tính lại layout ĐỒNG BỘ ngay tại chỗ
//     (forced reflow). Một lần kéo chuột gọi nó cho MỌI thẻ khác để tính bắt
//     dính (snap) → bảng 100 thẻ là 100 lần tính lại layout cho MỘT nhịp chuột.
//   - `querySelector` quét lại cây DOM mỗi lần, và lớp dây gọi nó 2 lần cho
//     mỗi cạnh ở mỗi lần render.
//
// Hook này lật ngược luồng: ResizeObserver báo khi kích thước thật sự đổi (chạy
// SAU khi trình duyệt đã tính layout, nên đọc lúc đó là miễn phí), kết quả nằm
// trong một Map tra cứu O(1). Kéo thẻ không làm đổi kích thước thẻ nào cả, nên
// trong suốt cú kéo không có lấy một phép đo nào chạy.
export function useCardSizes() {
  const sizesRef = useRef(new Map());
  const observerRef = useRef(null);
  const bumpFrameRef = useRef(0);
  // Đổi kích thước thẻ làm dây nối và khung bao phải vẽ lại → cần một lần render.
  // Gom vào một khung hình để 100 thẻ báo cùng lúc (lúc mới tải) chỉ tốn 1 render.
  const [, setSizeVersion] = useState(0);

  const scheduleBump = useCallback(() => {
    if (bumpFrameRef.current) return;
    bumpFrameRef.current = requestAnimationFrame(() => {
      bumpFrameRef.current = 0;
      setSizeVersion((v) => v + 1);
    });
  }, []);

  const getObserver = useCallback(() => {
    if (observerRef.current) return observerRef.current;
    if (typeof ResizeObserver === "undefined") return null;
    observerRef.current = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const el = entry.target;
        const id = Number(el.dataset.id);
        if (!Number.isFinite(id)) continue;
        // offsetWidth/Height (border-box, không chịu ảnh hưởng của transform
        // scale trên .canvas) — đọc trong callback của ResizeObserver là sau
        // pha layout nên không sinh reflow mới.
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const cur = sizesRef.current.get(id);
        if (cur && cur.w === w && cur.h === h) continue;
        sizesRef.current.set(id, { w, h });
        changed = true;
      }
      if (changed) scheduleBump();
    });
    return observerRef.current;
  }, [scheduleBump]);

  useEffect(() => () => {
    if (bumpFrameRef.current) cancelAnimationFrame(bumpFrameRef.current);
    observerRef.current?.disconnect();
  }, []);

  // Thẻ tự đăng ký phần tử gốc của nó; hàm trả về là cleanup cho useEffect bên
  // thẻ, nên thẻ bị xoá là ResizeObserver nhả tham chiếu ngay (observer giữ
  // tham chiếu MẠNH tới phần tử — quên unobserve là rò bộ nhớ thật).
  const observeCard = useCallback((el) => {
    const observer = getObserver();
    if (!observer || !el) return undefined;
    observer.observe(el);
    // Cố ý KHÔNG xoá số đo trong cache lúc gỡ: bấm sửa một thẻ là React thay
    // hẳn phần tử gốc (ô nhập thay cho nội dung), nên nếu xoá thì có một khung
    // hình cache rỗng và dây nối thẻ đó giật về kích thước mặc định trước khi
    // ResizeObserver kịp báo số đo mới. Số đo cũ của thẻ đã xoá thì vô hại —
    // không còn ai tra tới nó.
    return () => observer.unobserve(el);
  }, [getObserver]);

  // Tra cứu O(1), không chạm DOM. Thẻ vừa được tạo trong cùng một nhịp render
  // (ResizeObserver chưa kịp báo) rơi về kích thước mặc định — đúng như hành vi
  // cũ khi querySelector chưa tìm thấy phần tử.
  const cardSize = useCallback((id) => {
    return sizesRef.current.get(id) || { w: DEFAULT_CARD_W, h: DEFAULT_CARD_H };
  }, []);

  return { cardSize, observeCard, sizesRef };
}
