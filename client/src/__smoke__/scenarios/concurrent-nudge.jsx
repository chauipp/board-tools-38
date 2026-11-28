// Hai người sửa gần như đồng thời (review PR #7, vòng 2): mình nhích thẻ 1 bằng
// phím mũi tên — cú lưu hẹn giờ 500ms — và gói board:update của người kia (dời
// thẻ 2) về TRƯỚC khi timer nổ. Trước bản sửa, timer gửi board cũ kèm mốc mới,
// server chấp nhận và thẻ 2 lùi về chỗ cũ sau khi tải lại.
import { act } from "react-dom/test-utils";
import { mountBoard, mouse } from "../harness.jsx";

export async function run(log) {
  const root = await mountBoard();
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
  const card = (id) => document.querySelector(`.idea-card[data-id="${id}"]`);
  if (!card(1) || !card(2)) throw new Error("thiếu thẻ 1/2 trong fixture");

  // Chọn thẻ 1 (bấm-không-kéo).
  await act(async () => {
    mouse("mousedown", 100, 100, card(1));
    mouse("mouseup", 100, 100);
    await new Promise((r) => setTimeout(r, 30));
  });
  if (!card(1).classList.contains("selected")) throw new Error("không chọn được thẻ 1");
  const putsBefore = globalThis.__puts.length;
  const x1Before = globalThis.__board.nodes.find((n) => n.id === 1).x;

  // Nhích thẻ 1 sang phải 1 đơn vị: chỉ hẹn lưu, chưa PUT.
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  if (globalThis.__puts.length !== putsBefore) throw new Error("nhích phím phải hẹn giờ, chưa được PUT ngay");

  // Người kia lưu: thẻ 2 sang x = 777. Gói về trong lúc timer còn chờ.
  const remote = {
    ...globalThis.__board,
    nodes: globalThis.__board.nodes.map((n) => (n.id === 2 ? { ...n, x: 777 } : n)),
    updatedAt: new Date(Date.now() + 10000).toISOString()
  };
  delete remote.id; delete remote.name; delete remote.role; delete remote.view;
  await act(async () => {
    globalThis.__deliver("board:update", remote);
    await new Promise((r) => setTimeout(r, 30));
  });
  // Màn hình: giữ cú nhích của mình VÀ nhận thay đổi của người kia.
  if (card(2).style.left !== "777px") throw new Error("không áp thay đổi của người kia lên màn hình: " + card(2).style.left);
  if (card(1).style.left !== (x1Before + 1) + "px") throw new Error("cú nhích chưa lưu bị mất khỏi màn hình khi board:update về: " + card(1).style.left);

  // Chờ timer nổ rồi xem cú PUT.
  await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
  const put = globalThis.__puts[globalThis.__puts.length - 1];
  if (globalThis.__puts.length === putsBefore) throw new Error("cú nhích không được lưu");
  const n1 = put.nodes.find((n) => n.id === 1), n2 = put.nodes.find((n) => n.id === 2);
  log(`nhích + board:update đồng thời: PUT mang thẻ 1 x=${n1.x} (phải ${x1Before + 1}) · thẻ 2 x=${n2.x} (phải 777) · mốc ${put.baseUpdatedAt === remote.updatedAt ? "mới" : "cũ"}`);
  if (n1.x !== x1Before + 1) throw new Error("PUT làm mất cú nhích của mình");
  if (n2.x !== 777) throw new Error("PUT gửi board cũ: thay đổi của người kia bị lùi về " + n2.x);
  await act(async () => { root.unmount(); });
}
