import { useEffect } from "react";
import { isBoardBg, isBoardGrid, isColorPack } from "./board-theme.js";

// Các listener DOM cấp trang của bảng: đo kích thước khung nhìn, bánh xe chuột
// và touchpad (lia hay phóng, qua lib/pointer-input.js), giữ Space để lia, chặn
// bôi đen và kéo-thả gốc của trình duyệt ngoài ô nhập, focus ô tìm khi vừa mở,
// và đặt nền/lưới/bộ màu của board lên <html>. Trước nằm trong IdeaMap.jsx.
export function useViewportGestures({
  board, boardRef, camera, viewportRef, wheelReaderRef, spacePanRef, searchInputRef, searchOpen, setViewportSize, stopFollow, wheelMode
}) {

  // Mở ô tìm là để gõ ngay, không phải để rồi bấm thêm một cú vào nó. Đặt ở
  // effect chứ không ở toggleSearch: Ctrl+F lúc ô đang đóng thì ô nhập chưa nằm
  // trong cây, không có gì để focus tại thời điểm xử lý phím.
  useEffect(() => {
    if (!searchOpen) return;
    const el = searchInputRef.current;
    if (el) { el.focus(); el.select(); }
  }, [searchOpen]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // Lùi về cỡ cửa sổ khi đo ra 0: khung nhìn vốn phủ kín cửa sổ, mà môi
      // trường không có layout thật (jsdom) trả về đúng 0×0 — không có bước lùi
      // này thì minimap không bao giờ dựng được ở đó.
      const w = r.width || window.innerWidth;
      const h = r.height || window.innerHeight;
      setViewportSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board != null]);

  // Nền và bộ màu là DỮ LIỆU BOARD, nhưng thuộc tính lại đặt trên <html> — cùng
  // chỗ với data-theme (thiết lập của người dùng). Hai lý do: chip nhãn/trạng
  // thái nằm trong đảo to, ngoài .viewport, mà vẫn phải đổi màu theo bộ màu;
  // và exportPng() đang đọc getComputedStyle của documentElement, để ở đây thì
  // nó không phải đổi cách lấy giá trị.
  useEffect(() => {
    const el = document.documentElement;
    // Lọc trước khi đặt: giá trị này có thể tới từ "Nhập JSON", không phải lúc
    // nào cũng từ cú bấm trong panel.
    const bg = isBoardBg(board?.bg) ? board?.bg : null;
    const grid = isBoardGrid(board?.grid) ? board?.grid : null;
    const pack = isColorPack(board?.pack) ? board?.pack : null;
    if (bg) el.setAttribute("data-bg", bg); else el.removeAttribute("data-bg");
    if (grid) el.setAttribute("data-grid", grid); else el.removeAttribute("data-grid");
    if (pack) el.setAttribute("data-pack", pack); else el.removeAttribute("data-pack");
    // Gỡ khi rời trang: sang danh sách board mà còn nền của board vừa xem thì
    // trông như lỗi hiển thị.
    return () => {
      el.removeAttribute("data-bg");
      el.removeAttribute("data-grid");
      el.removeAttribute("data-pack");
    };
  }, [board?.bg, board?.grid, board?.pack]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function wheelHandler(e) {
      // Dock/phần panel có vùng cuộn riêng: nếu canvas bắt wheel ở đây rồi
      // preventDefault thì scrollbar vẫn hiện nhưng người dùng không thể cuộn
      // form. Mọi panel nổi đều cùng luật này — di chuột trên panel chỉ cuộn
      // nội dung của nó, không lia/zoom sa bàn nằm dưới.
      if (e.target.closest(".outline-panel, .io-drawer, .tree-panel, .edit-dock")) return;
      e.preventDefault();
      const current = boardRef.current;
      if (!current) return;
      // Cuộn/zoom là người dùng tự lái camera → thôi bám theo người khác.
      stopFollow();
      // MỘT chỗ duy nhất quyết định "cú này là lia hay là phóng": lib/pointer-input.js.
      // Trước đây chỗ này tự xử, và nó xử cùng một kiểu cho nút lăn với touchpad —
      // nên trên laptop chỉ trượt nhẹ hai ngón là bảng phóng to vọt lên. Xem ghi
      // chú đầu file đó về từng dấu hiệu nhận thiết bị.
      const cmd = wheelReaderRef.current.read(e, wheelMode);
      if (cmd.intent === "pan") {
        camera.panBy(-cmd.dx, -cmd.dy);
        return;
      }
      camera.zoomAt(el.getBoundingClientRect(), e.clientX, e.clientY, cmd.factor);
    }
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
    // stopFollow là useCallback ổn định (chỉ phụ thuộc sendFollow, cũng ổn
    // định), nên thêm vào deps không làm listener gắn lại thêm lần nào.
    // Re-chạy khi board tải xong: lúc mount đầu board còn null nên viewport
    // chưa render (return "Đang tải…"), viewportRef.current == null và listener
    // sẽ không được gắn nếu chỉ phụ thuộc [].
    // wheelMode chỉ đổi khi người dùng bấm trong panel Giao diện — gắn lại
    // listener khi đó thì rẻ, và rẻ hơn hẳn một ref nữa phải đồng bộ tay.
  }, [board != null, stopFollow, wheelMode]);

  useEffect(() => {
    function down(e) {
      if (e.code !== "Space") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      e.preventDefault();            // chặn page scroll
      spacePanRef.current = true;
    }
    function up(e) { if (e.code === "Space") spacePanRef.current = false; }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Chặn thao tác mặc định của trình duyệt trên cả trang bảng ──────────────
  //
  // BÔI ĐEN và KÉO-THẢ GỐC là thao tác dành cho một trang TÀI LIỆU. Đây là một
  // cái bàn vẽ: mỗi cú bấm, cú kéo trên nền đều đã có nghĩa riêng, nên hai thứ
  // đó chỉ chen vào. Cụ thể chúng làm hỏng những việc này:
  //
  //   Bấm 3 lần để làm lại — trình duyệt hiểu là "chọn cả đoạn văn", bôi đen
  //     nguyên vùng rồi bật thanh công cụ chọn-chữ của nó đè lên bảng.
  //   Kéo một cái thẻ, một cái chip — trình duyệt dựng bóng kéo-thả gốc của nó
  //     đi kèm, trong khi cú kéo thật đã được xử lý bằng sự kiện chuột.
  //   Quét chọn một vùng — vệt bôi đen xanh chạy theo dưới khung quét.
  //
  // Nghe ở `document` chứ không rắc user-select: none vào từng khối CSS: chặn ở
  // một chỗ thì không có góc nào sót, và cái cần giữ lại chỉ là MỘT ngoại lệ —
  // ô nhập liệu. Trong ô nhập thì bôi đen là thao tác đúng và cần thiết (chọn
  // một từ để sửa, bấm 3 lần để chọn cả dòng), nên chúng đi qua nguyên vẹn.
  // Cùng ngoại lệ mà handlePageContextMenu đang dùng cho menu chuột phải.
  useEffect(() => {
    function blockNativeDefault(e) {
      const el = e.target;
      const tag = (el?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable === true) return;
      e.preventDefault();
    }
    document.addEventListener("selectstart", blockNativeDefault);
    document.addEventListener("dragstart", blockNativeDefault);
    return () => {
      document.removeEventListener("selectstart", blockNativeDefault);
      document.removeEventListener("dragstart", blockNativeDefault);
    };
  }, []);

}
