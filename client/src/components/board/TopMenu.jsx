import { useState, useRef } from "react";
import { useCloseOnOutside } from "../../lib/useCloseOnOutside.js";

// Một nhãn (chữ hoặc icon), bấm mở khối nội dung ngay dưới nó. Đảo trên trái
// dùng hai cái: ☰ (việc thỉnh thoảng mới làm — về danh sách board, xuất/nhập
// JSON, trình chiếu, mục lục) và nút Giao diện (ngôn ngữ, sáng/tối, kiểu vẽ,
// nền bảng, bộ màu).
//
// `closeOnClick` phải tắt được: menu hành động thì bấm một mục là xong việc, nên
// đóng lại là đúng; còn bảng thiết lập thì người ta bấm "Tối" rồi bấm tiếp
// "Pastel" — đóng sau mỗi cú bấm là bắt mở lại năm lần.
// `wide` cho khối nội dung rộng hơn 190px của menu hành động: hàng swatch nền
// bảng và bốn nút bộ màu không vừa bề ngang đó.
export default function TopMenu({ label, title, active, align = "left", wide, closeOnClick = true, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useCloseOnOutside(ref, () => setOpen(false));
  return (
    <div className="menubar-item" ref={ref}>
      <button
        type="button"
        className={"menubar-trigger" + (active ? " active" : "") + (open ? " open" : "")}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        // onClick (bubble), không phải onClickCapture: bubble chạy sau khi nút con
        // đã xử lý xong click của chính nó — capture đóng menu (unmount) trước khi
        // click kịp bubble tới nút, khiến hành động không chạy (vd bấm "+ Ý tưởng"
        // không tạo thẻ nào).
        <div
          className={"menubar-dropdown" + (align === "right" ? " align-right" : "") + (wide ? " wide" : "")}
          onClick={closeOnClick ? () => setOpen(false) : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}
