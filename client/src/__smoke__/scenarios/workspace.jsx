// Khôi phục giao diện riêng từng người (camera, panel, minimap) trên board game-design.
import { act } from "react-dom/test-utils";
import { mountBoard } from "../harness.jsx";

export async function run(log) {
  const root = await mountBoard();
  if (!document.querySelector(".tree-panel") || document.querySelector(".edit-dock")) throw new Error("không khôi phục được inspector cây duy nhất");
  if (document.querySelector(".minimap")) throw new Error("minimap đã đóng nhưng lại hiện sau khôi phục");
  if (!document.querySelector(".outline-panel")) throw new Error("mục lục không được khôi phục");
  if (globalThis.__puts.length) throw new Error("khôi phục giao diện đã ghi board");
  const undo = document.querySelector('button[title="Hoàn tác (Ctrl+Z)"]');
  if (!undo?.disabled) throw new Error("khôi phục cây đã thêm history");
  const transform = document.querySelector(".canvas").style.transform;
  if (transform !== "translate(152px, 144px) scale(1.2)") throw new Error("camera đã lưu không được khôi phục: " + transform);
  await act(async () => { document.querySelector(".tree-panel .op-close").click(); });
  if (globalThis.__puts.length) throw new Error("đóng cây vừa khôi phục đã ghi board");
  log("workspace restore: camera/panel/minimap được phục hồi, không ghi board hoặc tạo undo");
  await act(async () => { root.unmount(); });
}
