import { useRef } from "react";
import { drawingsHitBy } from "./shape.js";
import { isDragGesture } from "./multi-click.js";
import { useInk } from "./useInk.js";
import { pointInBounds } from "./selection-box.js";
import { SEL_GRAB_PAD, PICK_RADIUS } from "./board-constants.js";

// Đầu vào chuột trên khung nhìn: đổi mode và lên nòng khu 3 (Đặt), mousedown
// trên nền (lia, chọn nét, kéo vùng chọn, quét chọn), cử chỉ bấm hai lần lên
// nét, laser, phát vị trí con trỏ, tìm thẻ/khung dưới con trỏ, chặn menu chuột
// phải của trình duyệt. Trước nằm trong IdeaMap.jsx.
export function useViewportInput({
  board, boardRef, role, mode, setMode, placeTool, setPlaceTool, linkMode, setLinkMode, setPendingSource, view, viewRef, viewportRef, canvasRef, clickAnchorRef, multiClickRef, laserDownRef, spacePanRef, treeSwapClickUntilRef, ink, laser, laserPrefs, selBounds, clearSelection, sendCursor, dashTargetAt, eventToCanvas, handleDrawingMouseDown, handleInkCaptureMouseDown, handleMarqueeMouseDown, placeNodeAt, startPan, startPlaceGroup, startSelectionDrag, toggleDrawingDash
}) {
  const depsRef = useRef({});

  function handlePresenceMouseMove(e) {
    sendCursor(() => {
      const rect = viewportRef.current.getBoundingClientRect();
      const view = viewRef.current;
      return {
        x: (e.clientX - rect.left - view.panX) / view.scale,
        y: (e.clientY - rect.top - view.panY) / view.scale
      };
    });
  }

  function entityAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el && el.closest(".idea-card");
    if (card) return { id: Number(card.getAttribute("data-id")), kind: "node" };
    const frame = el && el.closest(".frame-box");
    if (frame) return { id: Number(frame.getAttribute("data-group-id")), kind: "group" };
    return null;
  }

  // Khu 3 lên nòng một việc rồi chờ người dùng chỉ chỗ. Bấm lại đúng nút đang
  // sáng thì hạ nòng — không có nút nào để "thoát" ngoài Esc thì nút đang sáng
  // phải tự làm được việc đó.
  function armPlace(next) {
    if (mode === "place" && placeTool === next) { enterMode("select"); return; }
    setPlaceTool(next);
    enterMode("place");
  }

  // Nhường đường cho lia bảng TRƯỚC khi nghĩ tới việc đặt — cùng thứ tự mà
  // handleInkCaptureMouseDown dùng, nên chuột phải và Space+trái vẫn lia bảng
  // bình thường trong lúc đang lên nòng.
  function handlePlaceCaptureMouseDown(e) {
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    if (placeTool === "node") placeNodeAt(e.clientX, e.clientY);
    else if (placeTool === "group") startPlaceGroup(e);
  }

  // Rời mode Chuột thì bỏ lựa chọn và tắt nối dây: để lại một thẻ đang chọn
  // trong lúc vẽ nghĩa là bấm Delete sẽ xoá thẻ đó, trong khi người dùng đang
  // nghĩ mình xoá nét vẽ. Mode "place" cũng vậy — lớp bắt chuột của nó phủ kín
  // viewport nên thẻ đang chọn không còn bấm tới được.
  function enterMode(next) {
    setMode(next);
    // Hạ nòng khu 3 khi đi sang mode khác. KHÔNG đụng tới placeTool khi vào
    // chính mode "place": armPlace() đặt nó ngay trước lời gọi này.
    if (next !== "place") setPlaceTool(null);
    if (next !== "select") {
      clearSelection();
      setLinkMode(false);
      setPendingSource(null);
    }
  }

  // ── Bấm nhiều lần lên một nét vẽ: 2 lần đổi nét liền ↔ nét đứt ─────────────
  //
  // Luật đếm và các hằng số nằm ở lib/multi-click.js; ở đây chỉ là phần nối
  // chuột: lọc ra đúng những cú bấm TRÊN NỀN, và tách bấm khỏi kéo. Hai cái ref
  // của cử chỉ này (multiClickRef, clickAnchorRef) nằm ở lib/useBoardRefs.js.

  // Nền trống của bảng, kể cả những lớp phủ kín khung nhìn của từng mode. KHÔNG
  // gồm lớp của mode Đặt: ở đó mỗi cú bấm là một cái thẻ mới, đếm chồng lên
  // thành ra vừa tạo thẻ vừa hoàn tác nó.
  function isBoardBackground(el) {
    if (el === viewportRef.current || el === canvasRef.current) return true;
    return el instanceof Element
      && (el.classList.contains("ink-capture") || el.classList.contains("laser-capture"));
  }

  // Ghi mốc ở pha BẮT (capture): nó chạy trước mọi handler con, nên một lớp phủ
  // gọi stopPropagation cũng không giấu được cú bấm khỏi bộ đếm.
  function handleViewportMouseDownCapture(e) {
    clickAnchorRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleViewportClickCapture(e) {
    if (Date.now() < treeSwapClickUntilRef.current) {
      e.preventDefault(); e.stopPropagation();
      multiClickRef.current.cancel();
      return;
    }
    const mc = multiClickRef.current;
    const anchor = clickAnchorRef.current;
    const dragged = !anchor || isDragGesture(anchor, { x: e.clientX, y: e.clientY });
    // Kéo, bấm trúng một vật thể, hoặc không có quyền sửa: chuỗi đứt tại đây.
    if (role === "viewer" || dragged || !isBoardBackground(e.target)) { mc.cancel(); return; }

    // Đích của cú bấm đi vào bộ đếm: một nét vẽ, hay nền trống (null). Đổi đích
    // là chuỗi bắt đầu lại, nên bấm một cái lên nét rồi một cái lên nền không
    // cộng thành cú đổi nét nào.
    const hitId = dashTargetAt(e);
    const count = mc.click(Date.now(), hitId);
    if (hitId == null) return;

    // Làm NGAY ở lần thứ hai. Đóng chuỗi ngay sau khi làm: bấm thêm hai lần
    // nữa là đổi ngược lại, chứ không phải lần thứ ba lại lật thêm một phát.
    if (count >= 2) { mc.cancel(); toggleDrawingDash(hitId); }
  }

  // Suppress the browser's native context menu across the whole page, so
  // right-click is free for our own gestures (chip → badge editor, drag to
  // pan). Text inputs keep the native menu so Copy/Paste still works there.
  function handlePageContextMenu(e) {
    const tag = (e.target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
    e.preventDefault();
  }

  function handleViewportMouseDown(e) {
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
    if (linkMode) { setPendingSource(null); return; }
    if (e.button === 2) { startPan(e); return; }
    if (e.button !== 0) return;
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    // Nét vẽ phải xét TRƯỚC vùng quét: cú bấm nào cũng rơi xuống nền canvas
    // (lớp vẽ không nhận chuột), nên nếu quét trước thì không bao giờ chạm được
    // vào một nét. Nét vẽ sau cùng nằm trên, nên trúng nhiều thì lấy cái trên.
    const p = eventToCanvas(e);
    const hits = drawingsHitBy(board.drawings || [], p, PICK_RADIUS);
    if (hits.length) { handleDrawingMouseDown(e, hits[hits.length - 1]); return; }
    // Khoảng TRỐNG bên trong vùng chọn: kéo cả cụm. Trước đây chỗ này quét vùng,
    // nghĩa là muốn dời một cụm đã gom xong thì phải nhắm cho trúng đúng một cái
    // thẻ hay đúng một cái nét — càng nhiều thứ mảnh trong cụm thì càng khó nhắm,
    // mà trượt một cái là mất luôn cả vùng chọn vừa gom.
    //
    // Ctrl vẫn đi đường quét: ở đó Ctrl nghĩa là "đang cộng dồn lựa chọn", và
    // vùng quét mới hoàn toàn có thể bắt đầu từ bên trong vùng chọn cũ.
    if (selBounds && !e.ctrlKey && !e.metaKey && pointInBounds(selBounds, p, SEL_GRAB_PAD / view.scale)) {
      startSelectionDrag(e);
      return;
    }
    handleMarqueeMouseDown(e);
  }

  // Mode Laser. Vệt CHỈ chạy khi đang giữ chuột trái — thả ra là không vẽ gì
  // nữa, đúng như cầm một cây laser thật phải bấm mới sáng. Nhờ vậy di chuột
  // qua bảng để đọc nội dung không để lại vệt nào.
  function handleLaserMouseDown(e) {
    // Nhường đường cho lia bảng y như .ink-capture: chuột phải và Space+trái
    // vẫn lia được.
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    if (!viewportRef.current || !boardRef.current) return;
    const p = eventToCanvas(e);
    laserDownRef.current = true;
    laser.begin(p.x, p.y, laserPrefs);
  }

  // Cố ý KHÔNG gắn listener vào window như useInk.js làm. Ở đó bắt buộc phải
  // gắn window vì thả chuột ngoài khung nhìn mà không nhận được `mouseup` là
  // nét vẽ treo lại vĩnh viễn và không bao giờ được lưu. Ở đây lượt chỉ chẳng
  // có gì để commit, mà .laser-capture lại phủ kín khung nhìn — rời khỏi nó là
  // rời khỏi bảng, nên `onMouseLeave` đủ để đóng lượt. Đổi lại: không có
  // listener nào sống sót ra ngoài lượt, nên không có đường nào rò như bẫy
  // "blur giữa nét" mà useInk.js phải dựng cả một cleanupRef để chặn.
  function handleLaserMouseMove(e) {
    if (!laserDownRef.current) return;
    if (!viewportRef.current || !boardRef.current) return;
    const p = eventToCanvas(e);
    laser.track(p.x, p.y, laserPrefs);
  }

  function handleLaserMouseUp() {
    if (!laserDownRef.current) return;
    laserDownRef.current = false;
    laser.end();
  }

  return {
    handlePresenceMouseMove, entityAtPoint, armPlace, handlePlaceCaptureMouseDown, enterMode, isBoardBackground, handleViewportMouseDownCapture, handleViewportClickCapture, handlePageContextMenu, handleViewportMouseDown, handleLaserMouseDown, handleLaserMouseMove, handleLaserMouseUp,
    bind: (d) => { depsRef.current = d; }
  };
}
