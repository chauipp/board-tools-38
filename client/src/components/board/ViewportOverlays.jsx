import { textLines, textBox, TEXT_LINE_H } from "../../lib/text-el.js";
import ToolRail from "../ToolRail.jsx";
import ToolOptions from "../ToolOptions.jsx";
import { penVar } from "../../lib/pen.js";
import { useInk } from "../../lib/useInk.js";

// Mọi thứ nằm trên khung nhìn nhưng ngoài .canvas: thanh công cụ trái và khu 4,
// lớp bắt chuột của mode vẽ/laser/Đặt, vòng báo giữ tay, ô nhập chữ. Trước là
// một khối JSX trong IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function ViewportOverlays({ addGameDesignCard, armPlace, board, camera, cardLevelPref, commitText, enterMode, eraseCursor, gameDesign, handleInkCaptureMouseDown, handleLaserMouseDown, handleLaserMouseMove, handleLaserMouseUp, handlePlaceCaptureMouseDown, ink, inkLive, laser, laserPrefs, linkMode, measureTextWidth, mode, penPrefs, placeTool, role, setCaptureOpen, setCardLevelPref, setLaserPrefs, setPenPrefs, setTextEdit, setTool, textEdit, toggleLinkMode, tool, view }) {
  return (
    <>
      <ToolRail
        mode={mode}
        tool={tool}
        placeTool={mode === "place" ? placeTool : null}
        canEdit={role !== "viewer"}
        linkMode={linkMode}
        gameDesign={board.kind === "game-design"}
        onGameTemplate={addGameDesignCard}
        onMode={enterMode}
        onTool={(next) => { enterMode("draw"); setTool(next); }}
        onPlace={armPlace}
        onToggleLink={toggleLinkMode}
        onCapture={() => setCaptureOpen(true)}
      />
      {(mode === "draw" || mode === "place" || mode === "laser") && (
        <ToolOptions
          tool={mode === "place" ? placeTool : (mode === "laser" ? "laser" : tool)}
          // Laser có bộ nhớ riêng: màu thì cùng bảng với bút nhưng độ đậm là
          // đơn vị khác hẳn, nên hai thứ không được dùng chung một object.
          prefs={mode === "laser" ? laserPrefs : penPrefs}
          onPrefs={mode === "laser" ? setLaserPrefs : setPenPrefs}
          level={cardLevelPref}
          onLevel={setCardLevelPref}
        />
      )}
      {mode === "draw" && (
        <div className="ink-capture" style={{ cursor: eraseCursor }} onMouseDown={handleInkCaptureMouseDown} />
      )}
      {/* Vòng báo "đang giữ tay" — hiện ngay dưới con trỏ khi tay đứng lại.
          BA việc dùng chung một vòng: sắp BẮT HÌNH (nét vừa vẽ về hình chuẩn),
          sắp TẨY nét đang nằm dưới tay, và sắp ĐỔI bút ↔ cục gôm. `kind` thành
          luôn tên class nên mỗi việc một màu, và nét sắp bị tẩy thì mờ đi song
          song (useInk gọi setEraseIds).
          Không có vòng này thì cả hai cử chỉ đều vô hình: người dùng chỉ tình
          cờ gặp một lần rồi không hiểu vừa xảy ra chuyện gì.
          position: fixed nên toạ độ là toạ độ MÀN HÌNH, không phải toạ độ
          canvas — nó bám ngón tay, không bám bảng.
          Thời gian chạy do useInk tính sẵn và gửi kèm: hai chỗ giữ hai con số
          rồi lệch nhau thì vòng đầy xong mà chưa có gì xảy ra (hoặc ngược
          lại), và đó là kiểu lỗi không ai đọc code ra được. */}
      {ink.snapHint && (
        <div
          className={"snap-hint " + ink.snapHint.kind}
          style={{
            left: ink.snapHint.x,
            top: ink.snapHint.y,
            "--snap-hold": `${ink.snapHint.ms}ms`
          }}
        />
      )}
      {/* Cùng vai trò .ink-capture: phủ kín khung nhìn để di chuột ngang qua
          một cái thẻ vẫn ra vệt laser chứ không bị thẻ ăn mất chuột. */}
      {mode === "laser" && (
        <div
          className="laser-capture"
          onMouseDown={handleLaserMouseDown}
          onMouseMove={handleLaserMouseMove}
          onMouseUp={handleLaserMouseUp}
          // Rời khỏi lớp phủ (ra mép màn hình, hay đi lên thanh công cụ) thì
          // đóng lượt luôn: `mouseup` sau đó sẽ không rơi vào đây nữa, và bỏ
          // sót nó là lượt chỉ treo lại — quay vào bảng là vẽ tiếp dù đã thả
          // chuột từ lâu.
          onMouseLeave={handleLaserMouseUp}
        />
      )}
      {/* Ô nhập text. Nằm NGOÀI .canvas nên phải tự nhân camera vào: .canvas
          khai will-change: transform → nó là một stacking context, con của nó
          không thể nổi lên trên .ink-capture (z-index 8) để nhận được chuột.
          Cái giá là toạ độ và cỡ chữ phải tự quy đổi ở đây — bù lại ô nhập
          vẫn trùng khít với chữ sẽ vẽ ra vì dùng chung một phép biến đổi. */}
      {textEdit && (
        <textarea
          className="text-input"
          // Lưới an toàn cho tiêu điểm, thay cho autoFocus (chỉ chạy lúc gắn
          // vào cây). Nếu có thứ gì cướp mất tiêu điểm giữa chừng thì lần vẽ
          // lại kế tiếp đòi lại. Điều kiện activeElement giữ cho nó là lệnh
          // rỗng ở mọi phím gõ, không phải một lệnh focus mỗi ký tự.
          ref={(el) => { if (el && document.activeElement !== el) el.focus(); }}
          value={textEdit.value}
          style={{
            left: view.panX + textEdit.x * view.scale,
            top: view.panY + textEdit.y * view.scale,
            fontSize: textEdit.size * view.scale,
            lineHeight: TEXT_LINE_H,
            color: penVar(textEdit.color),
            // Tự nới theo nội dung. Cộng thêm một khoảng cho con trỏ nháy ở
            // cuối dòng dài nhất, không thì gõ tới đâu chữ trượt sang trái tới đó.
            width: (textBox(textLines(textEdit.value), textEdit.size, measureTextWidth).w + 12) * view.scale,
            height: textLines(textEdit.value).length * textEdit.size * TEXT_LINE_H * view.scale
          }}
          onChange={(e) => {
            setTextEdit((prev) => ({ ...prev, value: e.target.value }));
            inkLive.pushText(e.target.value);
          }}
          onBlur={commitText}
          // Escape kết thúc — blur() rồi để onBlur lo phần lưu, nên chỉ có MỘT
          // đường commit. Enter thì XUỐNG DÒNG chứ không kết thúc: chú thích
          // nhiều dòng là chuyện thường, và đó chính là lý do phím kết thúc
          // phải là Escape.
          // Các phím tắt khác (p, e, s, t, Delete…) không cần chặn ở đây:
          // handler keydown chung đã bỏ qua mọi sự kiện phát từ textarea.
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); }
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      )}
      {/* Lớp bắt chuột của mode Đặt: cùng vai trò với .ink-capture, để bấm
          trúng một cái thẻ có sẵn vẫn ra thẻ mới chứ không phải chọn thẻ đó. */}
      {mode === "place" && (
        <div
          className={"place-capture" + (placeTool === "group" ? " draw-frame" : "")}
          onMouseDown={handlePlaceCaptureMouseDown}
        />
      )}
    </>
  );
}
