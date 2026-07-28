// Một panel lọc nằm trong đảo nội dung ở thanh đáy. Bật là hiện ở đúng một chỗ,
// tắt là biến mất — không còn neo/nổi, không còn kéo thả.
//
// Component này trước tên DockPanel và mang trong mình cả một lượt kéo: hút mép
// vùng vẽ, căn hàng với panel khác, vẽ đường gióng, nhận diện thả-vào-khay, kẹp
// lại vị trí cũ mỗi lần đổi cỡ cửa sổ. Toàn bộ đã bỏ. Kéo theo đó là lib/dock.js
// (snapPanel/clampToBounds/loadLayouts/saveLayouts) và state `layouts` bên
// IdeaMap — panel không còn vị trí nào để mà nhớ.
//
// Tên panel LUÔN hiện, khác bản cũ chỉ hiện khi panel nổi: nhiều panel bật cùng
// lúc thì chúng nằm liền một dải trong cùng một đảo, không còn khối riêng có
// viền để mắt tự tách ra.
// `stack` = xếp theo cột thay vì một dải ngang. Ba panel lọc chỉ là một dải chip
// nên nằm ngang gọn hơn; panel Giao diện gom năm hàng thiết lập có nhãn riêng
// từng hàng, nằm ngang thì mắt không lần ra hàng nào của hàng nào.
export default function FilterPanel({ title, stack, children }) {
  return (
    <div className={"filter-panel" + (stack ? " stack" : "")}>
      <span className="filter-title">{title}</span>
      {children}
    </div>
  );
}
