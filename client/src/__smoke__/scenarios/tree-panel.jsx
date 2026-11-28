// Bảng Xếp cây và dock Chi tiết thiết kế không được mở chồng nhau.
import { act } from "react-dom/test-utils";
import { mountBoard } from "../harness.jsx";

export async function run(log) {
  const root = await mountBoard();
  const click = async (element) => {
    if (!element) throw new Error("thiếu nút trong luồng chuyển bảng");
    await act(async () => { element.click(); });
  };
  const openTree = async () => {
    await act(async () => {
      document.querySelector('.idea-card[data-id="1"]').dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 200 }));
    });
    await click(document.querySelector(".tp-open"));
    if (!document.querySelector(".tree-panel")) throw new Error("Xếp cây không mở");
    if (document.querySelector(".edit-dock")) throw new Error("dock Chi tiết thiết kế vẫn che bảng Xếp cây");
  };
  await click(document.querySelector('.idea-card[data-id="1"]'));
  if (!document.querySelector(".gd-panel")) throw new Error("chọn card không mở Chi tiết thiết kế");
  await click(document.querySelector(".gd-panel-head .btn.icon"));
  const draggedCard = document.querySelector('.idea-card[data-id="1"]');
  await act(async () => {
    draggedCard.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 100, clientY: 100, button: 0 }));
    window.dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true, clientX: 180, clientY: 150, button: 0 }));
    window.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true, clientX: 180, clientY: 150, button: 0 }));
    draggedCard.dispatchEvent(new window.MouseEvent("click", { bubbles: true, clientX: 180, clientY: 150, button: 0 }));
  });
  if (document.querySelector(".gd-panel")) throw new Error("kéo thẻ không được mở Chi tiết thiết kế");
  await click(document.querySelector('.idea-card[data-id="1"]'));
  if (!document.querySelector(".gd-panel")) throw new Error("click thẻ sau khi kéo không mở lại Chi tiết thiết kế");
  await openTree();
  await click(document.querySelector('.idea-card[data-id="2"] .gd-card-btn'));
  if (document.querySelector(".tree-panel") || !document.querySelector(".gd-panel")) throw new Error("chọn thiết kế phải thay bảng cây, không mở chồng");
  await openTree();
  await click(document.querySelector(".tree-panel .op-close"));
  if (document.querySelector(".tree-panel")) throw new Error("không đóng được bảng cây");
  await click(document.querySelector('.idea-card[data-id="2"]'));
  if (!document.querySelector(".gd-panel")) throw new Error("không mở lại được Chi tiết thiết kế");
  await openTree();
  await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  if (document.querySelector(".tree-panel")) throw new Error("Escape không đóng bảng cây");
  await click(document.querySelector('.idea-card[data-id="1"]'));
  if (!document.querySelector(".gd-panel")) throw new Error("không mở lại thiết kế sau Escape");
  log("chọn card → Xếp cây không có dock chồng → đóng/Escape → chọn lại card: đạt");
  await act(async () => { root.unmount(); });
}
