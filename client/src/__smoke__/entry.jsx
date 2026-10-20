import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../lib/i18n.js";
import IdeaMap from "../pages/IdeaMap.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import { LASER_FADE_DEFAULT, LASER_WIDTHS } from "../lib/laser.js";
import { PEN_COLORS } from "../lib/pen.js";
import { SNAP_HOLD_MS } from "../lib/recognize.js";
import { HOLD_ERASE_MS, HOLD_SWAP_MS } from "../lib/useInk.js";
import { BOARD_BGS, BOARD_GRIDS, COLOR_PACKS } from "../lib/board-theme.js";
import { MULTI_CLICK_MS } from "../lib/multi-click.js";
import { drawingsHitBy } from "../lib/shape.js";
import GameDesignFlowPanel from "../components/GameDesignFlowPanel.jsx";
import GameDesignPanel from "../components/GameDesignPanel.jsx";

export async function runTreePanelExclusive(log) {
  const root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(<I18nProvider i18n={i18n}><AuthProvider><MemoryRouter initialEntries={["/idea-map/b1"]}>
      <Routes><Route path="/idea-map/:boardId" element={<IdeaMap />} /></Routes>
    </MemoryRouter></AuthProvider></I18nProvider>);
  });
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
  await openTree();
  await click(document.querySelector('.idea-card[data-id="2"] .gd-card-btn'));
  if (document.querySelector(".edit-dock")) throw new Error("dock tái xuất hiện khi bảng cây còn mở");
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

export async function run(log) {
  const root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/idea-map/b1"]}>
            <Routes><Route path="/idea-map/:boardId" element={<IdeaMap />} /></Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

  const cards = document.querySelectorAll(".idea-card");
  log(`render: ${cards.length} thẻ · ${document.querySelectorAll(".frame-box").length} khung · ${document.querySelectorAll(".edge-layer .visible").length} dây`);
  if (cards.length !== 3) throw new Error("mong đợi 3 thẻ, có " + cards.length);

  const card = document.querySelector('.idea-card[data-id="1"]');
  const before = card.style.left;
  const mouse = (type, x, y, target) => {
    (target || window).dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
  };
  // Kéo một <input type="range">. Phải đi qua setter GỐC của prototype: React
  // thay setter `value` của phần tử bằng bản của nó để theo dõi giá trị, nên gán
  // el.value = … rồi bắn "input" sẽ bị React coi là "không có gì đổi" và bỏ qua
  // hẳn onChange. Đây là cái bẫy tiêu chuẩn khi test input có kiểm soát.
  const setRangeValue = (el, v) => {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    desc.set.call(el, String(v));
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  await act(async () => {
    mouse("mousedown", 100, 100, card);
    mouse("mousemove", 180, 160);
    mouse("mousemove", 240, 220);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 240, 220); await new Promise((r) => setTimeout(r, 30)); });

  const after = document.querySelector('.idea-card[data-id="1"]').style.left;
  log(`kéo thẻ 1: left ${before} → ${after}`);
  if (before === after) throw new Error("thẻ không dịch chuyển");

  const geom = globalThis.__emitted.filter((e) => e[0] === "live:geom");
  log(`live:geom đã phát: ${geom.length} gói; gói cuối = ${JSON.stringify(geom[geom.length - 1]?.[1])}`);
  if (!geom.length) throw new Error("không phát gói live:geom nào");
  if (!geom[geom.length - 1][1].done) throw new Error("gói cuối phải là done");
  if (geom.some((g) => g[1].nodes.length !== 1)) throw new Error("gói phải chỉ chứa đúng thẻ đang kéo");
  log(`PUT: ${globalThis.__puts.length} lần`);
  if (globalThis.__puts.length !== 1) throw new Error("một cú kéo phải đúng 1 lần lưu");

  // Người khác kéo thẻ 2 rồi thả — kiểm tra overlay giữ vị trí và không giật về.
  globalThis.__deliver("live:geom", { nodes: [{ id: 2, x: 500, y: 500 }], done: true });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  const peerCard = document.querySelector('.idea-card[data-id="2"]');
  log(`thẻ 2 do người khác kéo: left=${peerCard.style.left} top=${peerCard.style.top}`);
  if (peerCard.style.left !== "500px") throw new Error("overlay của người khác không được áp");

  // Bản lưu chính thức về sau đó, mang đúng vị trí mới → không được nhấp nháy.
  const emittedBefore = globalThis.__emitted.length;
  globalThis.__deliver("board:update", {
    ...globalThis.__board,
    nodes: globalThis.__board.nodes.map((n) => (n.id === 2 ? { ...n, x: 500, y: 500 } : n)),
    updatedAt: new Date(Date.now() + 10000).toISOString()
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  log(`sau board:update: thẻ 2 left=${document.querySelector('.idea-card[data-id="2"]').style.left}`);
  if (document.querySelector('.idea-card[data-id="2"]').style.left !== "500px") throw new Error("thẻ 2 nhảy chỗ sau board:update");
  const geomAfter = globalThis.__emitted.slice(emittedBefore).filter((e) => e[0] === "live:geom");
  log(`gói live:geom phát ra do NHẬN board:update: ${geomAfter.length} (phải là 0 — đây chính là vòng vọng gây giật)`);
  if (geomAfter.length !== 0) throw new Error("nhận board:update mà vẫn phát geometry → vòng vọng còn nguyên");

  // Thẻ đổi chiều cao thì dây nối phải bám theo NGAY.
  //
  // Cảnh này người dùng gặp mỗi lần tạo thẻ mới: lúc đang sửa, thẻ cao (có ô
  // nhập + ô mô tả), lưu xong nó co lại. Số đo nằm trong một ref, còn EdgeLayer
  // bọc memo — nếu tín hiệu "kích thước đã đổi" không lọt vào props của
  // EdgeLayer thì cache mới nhưng dây vẫn vẽ theo số đo cũ, đầu dây lơ lửng
  // cách thẻ cả trăm pixel.
  const edgeY = () => Array.from(document.querySelectorAll(".edge-layer g .visible")).map((l) => l.getAttribute("d")).join(",");
  const yBefore = edgeY();
  await act(async () => {
    globalThis.__resize(document.querySelector('.idea-card[data-id="2"]'), 210, 44);
    await new Promise((r) => setTimeout(r, 60));
  });
  const yAfter = edgeY();
  log(`thẻ 2 co từ 110px xuống 44px: đầu dây ${yBefore} → ${yAfter}`);
  if (yBefore === yAfter) throw new Error("thẻ co lại mà dây không vẽ lại — đầu dây kẹt ở số đo cũ");

  // Thanh công cụ bên trái: khu 1 và khu 3 luôn hiện, khu 2 và khu 4 chỉ hiện ở
  // mode Sửa. Đây là bất biến dễ vỡ nhất của vỏ giao diện này.
  const railBtns = () => document.querySelectorAll(".tool-rail .tool-btn").length;
  const railGroups = () => document.querySelectorAll(".tool-rail .tool-group").length;
  // Tra nút theo TÊN, không theo vị trí. Cả file này trước đây bấm nút bằng chỉ
  // số, mà thêm một nút vào khu 1 là mọi chỉ số phía sau dịch đi một — test sẽ
  // bấm nhầm nút và vẫn xanh cho tới khi vỡ ở một chỗ chẳng liên quan. Nút Laser
  // chính là lần đầu tiên chuyện đó xảy ra.
  const railBtn = (name) => Array.from(document.querySelectorAll(".tool-rail .tool-btn"))
    .find((b) => (b.title || "").startsWith(name));
  log(`thanh công cụ: ${railBtns()} nút trong ${railGroups()} khung ở mode Chuột`);
  if (railBtns() !== 7) throw new Error("mode Chuột phải có 7 nút (3 mode + 4 thêm), có " + railBtns());
  if (document.querySelector(".tool-options")) throw new Error("mode Chuột không được hiện khu 4");
  // Mỗi nhóm chức năng là một khung rời. Khu 2 (tool vẽ) chưa hiện ở mode Chuột
  // nên chỉ có 2 khung; mọi nút phải nằm TRONG một khung, không nút nào lạc ra
  // ngoài bao — nút lạc sẽ mất nền và đổ bóng mà jsdom không hề thấy.
  if (railGroups() !== 2) throw new Error("mode Chuột phải có 2 khung (mode + thêm), có " + railGroups());
  if (document.querySelectorAll(".tool-rail .tool-group .tool-btn").length !== railBtns()) {
    throw new Error("có nút nằm ngoài .tool-group — nút đó sẽ không có khung");
  }

  // Menu THÊM và nút Nối ý tưởng phải đã rời khỏi đảo to — mỗi việc một chỗ bấm.
  const islandText = document.querySelector(".island.tl").textContent;
  if (islandText.includes("Nối ý tưởng")) throw new Error("nút Nối ý tưởng vẫn còn trên đảo to");

  const drawBtn = railBtn("Sửa");
  await act(async () => { drawBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  log(`sau khi bật mode Sửa: ${railBtns()} nút, khu 4 = ${document.querySelectorAll(".tool-options .pen-swatch").length} ô màu`);
  if (railBtns() !== 11) throw new Error("mode Sửa phải có 11 nút (3 mode + 4 tool + 4 thêm), có " + railBtns());
  if (railGroups() !== 3) throw new Error("mode Sửa phải có 3 khung (mode + tool vẽ + thêm), có " + railGroups());
  if (document.querySelectorAll(".tool-rail .tool-group .tool-btn").length !== railBtns()) {
    throw new Error("có nút nằm ngoài .tool-group — nút đó sẽ không có khung");
  }
  if (document.querySelectorAll(".tool-options .pen-swatch").length !== 7) throw new Error("khu 4 phải có 7 ô màu");
  if (document.querySelectorAll(".tool-options .pen-width").length !== 3) throw new Error("khu 4 phải có 3 nút độ dày");

  // Vẽ một nét: kéo chuột trên lớp bắt chuột phải ra path trong .ink-layer và
  // đúng MỘT lần lưu.
  const capture = document.querySelector(".ink-capture");
  if (!capture) throw new Error("mode Sửa phải có lớp bắt chuột .ink-capture");
  const putsBeforeDraw = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 400, 400, capture);
    mouse("mousemove", 440, 420);
    mouse("mousemove", 480, 400);
    mouse("mousemove", 520, 430);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 520, 430); await new Promise((r) => setTimeout(r, 40)); });

  const paths = document.querySelectorAll(".ink-layer path");
  log(`sau khi vẽ: ${paths.length} path trong .ink-layer · PUT thêm ${globalThis.__puts.length - putsBeforeDraw} lần`);
  if (paths.length !== 1) throw new Error("mong đợi 1 nét đã lưu, có " + paths.length);
  if (globalThis.__puts.length - putsBeforeDraw !== 1) throw new Error("một nét phải đúng 1 lần lưu");
  const saved = globalThis.__puts[globalThis.__puts.length - 1];
  if (saved.drawings.length !== 1) throw new Error("payload lưu phải có 1 nét");
  if (saved.nextDrawingId !== 2) throw new Error("nextDrawingId phải tăng lên 2");
  if (saved.drawings[0].color !== "pen-red" || saved.drawings[0].w !== 4) throw new Error("nét phải mang màu và độ dày đang chọn");
  if (saved.drawings[0].pts.some((v) => !Number.isInteger(v))) throw new Error("toạ độ nét phải là số nguyên");

  // Bấm rồi nhả không di chuyển: một điểm, không phải nét — không được lưu.
  const putsBeforeClick = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 700, 700, capture);
    mouse("mouseup", 700, 700);
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`bấm-nhả không di: PUT thêm ${globalThis.__puts.length - putsBeforeClick} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeClick) throw new Error("bấm rồi nhả không được tạo nét rác");

  // Vẽ thêm hai nét nữa để có ba nét, rồi quét gôm qua cả ba.
  for (const y of [600, 620]) {
    await act(async () => {
      mouse("mousedown", 400, y, capture);
      mouse("mousemove", 500, y);
      await new Promise((r) => setTimeout(r, 50));
    });
    await act(async () => { mouse("mouseup", 500, y); await new Promise((r) => setTimeout(r, 30)); });
  }
  if (document.querySelectorAll(".ink-layer path").length !== 3) throw new Error("mong đợi 3 nét trước khi gôm");

  // Bật cục gôm: nút thứ 4 trên thanh (2 mode + bút + gôm).
  const eraserBtn = railBtn("Cục gôm");
  await act(async () => { eraserBtn.click(); await new Promise((r) => setTimeout(r, 20)); });

  const putsBeforeErase = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 420, 600, capture);
    mouse("mousemove", 450, 610);
    mouse("mousemove", 470, 620);
    await new Promise((r) => setTimeout(r, 60));
  });
  // Trong lúc quét, nét bị đánh dấu phải mờ đi để thấy trước khi mất.
  const dimmed = document.querySelectorAll(".ink-layer path.erasing").length;
  log(`đang quét gôm: ${dimmed} nét đang mờ đi`);
  if (dimmed < 2) throw new Error("quét qua 2 nét thì phải có ít nhất 2 nét mờ, có " + dimmed);

  await act(async () => { mouse("mouseup", 470, 620); await new Promise((r) => setTimeout(r, 40)); });
  const left = document.querySelectorAll(".ink-layer path").length;
  log(`sau khi gôm: còn ${left} nét · PUT thêm ${globalThis.__puts.length - putsBeforeErase} lần`);
  if (left !== 1) throw new Error("phải còn đúng 1 nét (nét đầu ở y≈400), có " + left);
  if (globalThis.__puts.length - putsBeforeErase !== 1) throw new Error("một lần quét gôm phải đúng 1 lần lưu");

  // Quét chỗ trống: không được tạo entry hoàn tác rác.
  const putsBeforeEmpty = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 1500, 1500, capture);
    mouse("mousemove", 1560, 1560);
    await new Promise((r) => setTimeout(r, 50));
  });
  await act(async () => { mouse("mouseup", 1560, 1560); await new Promise((r) => setTimeout(r, 30)); });
  log(`quét gôm chỗ trống: PUT thêm ${globalThis.__puts.length - putsBeforeEmpty} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeEmpty) throw new Error("quét chỗ trống không được tạo bước hoàn tác");

  // PHÁT: một nét bút phải ra gói seq 0 mang màu/độ dày, rồi các gói mang ĐIỂM
  // MỚI THÊM, rồi đúng một gói done mang drawingId.
  const penBtn = railBtn("Bút");
  await act(async () => { penBtn.click(); await new Promise((r) => setTimeout(r, 20)); });

  const emittedBeforeInk = globalThis.__emitted.length;
  await act(async () => {
    mouse("mousedown", 900, 200, capture);
    mouse("mousemove", 930, 220);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", 960, 200);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 960, 200); await new Promise((r) => setTimeout(r, 40)); });

  const inkPkts = globalThis.__emitted.slice(emittedBeforeInk).filter((e) => e[0] === "live:ink").map((e) => e[1]);
  log(`live:ink đã phát: ${inkPkts.length} gói; seq = ${inkPkts.map((p) => (p.done ? "done" : p.seq)).join(",")}`);
  if (inkPkts.length < 2) throw new Error("phải phát ít nhất gói đầu và gói done");
  const first = inkPkts[0];
  if (first.seq !== 0 || first.color !== "pen-red" || first.w !== 4) throw new Error("gói đầu phải mang seq 0, màu và độ dày");
  const last = inkPkts[inkPkts.length - 1];
  if (last.done !== true || !Number.isFinite(last.drawingId)) throw new Error("gói cuối phải là done kèm drawingId");
  if (inkPkts.filter((p) => p.done).length !== 1) throw new Error("một nét chỉ được có đúng 1 gói done");
  // Điểm không được gửi lặp: tổng số điểm đã phát phải bằng số điểm nét thô,
  // không phải bằng tổng luỹ tiến của cả nét ở mỗi gói.
  const sentNumbers = inkPkts.filter((p) => p.pts).reduce((n, p) => n + p.pts.length, 0);
  if (sentNumbers > 10) throw new Error("gói phải mang điểm MỚI THÊM, không mang lại cả nét (đã gửi " + sentNumbers + " số)");

  // NHẬN: gói của người khác phải hiện thành nét ngay, và biến mất khi
  // board:update mang nét thật về.
  const pathsBeforePeer = document.querySelectorAll(".ink-layer path").length;
  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer1", strokeId: 1, seq: 0, color: "pen-blue", w: 8, pts: [100, 900, 140, 940] });
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`nét của người khác đang vẽ: ${document.querySelectorAll(".ink-layer path").length} path (trước đó ${pathsBeforePeer})`);
  if (document.querySelectorAll(".ink-layer path").length !== pathsBeforePeer + 1) throw new Error("gói live:ink của người khác không hiện ra");

  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer1", strokeId: 1, seq: 1, pts: [180, 900] });
    await new Promise((r) => setTimeout(r, 30));
  });
  const peerPath = Array.from(document.querySelectorAll(".ink-layer path")).find((p) => (p.getAttribute("d") || "").startsWith("M 100 900"));
  if (!peerPath) throw new Error("không tìm thấy nét của người khác");
  if (!peerPath.getAttribute("d").includes("L 180 900")) throw new Error("gói sau phải NỐI THÊM điểm vào nét đang vẽ");

  // Bản lưu chính thức về, mang đúng nét đó → overlay phải bỏ ngay, không nháy.
  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer1", strokeId: 1, done: true, drawingId: 99 });
    await new Promise((r) => setTimeout(r, 30));
  });
  const emittedBeforeUpdate = globalThis.__emitted.length;
  const boardNow = globalThis.__puts[globalThis.__puts.length - 1];
  // Giữ lại board vừa áp để dùng làm mốc cho bài kiểm "board:update giữa
  // chừng nét" ngay dưới đây.
  const boardAfterPeerStroke = {
    ...boardNow,
    drawings: [...boardNow.drawings, { id: 99, kind: "pen", color: "pen-blue", w: 8, pts: [100, 900, 140, 940, 180, 900] }],
    nextDrawingId: 100,
    updatedAt: new Date(Date.now() + 20000).toISOString()
  };
  await act(async () => {
    globalThis.__deliver("board:update", boardAfterPeerStroke);
    await new Promise((r) => setTimeout(r, 30));
  });
  const dCount = Array.from(document.querySelectorAll(".ink-layer path")).filter((p) => (p.getAttribute("d") || "").startsWith("M 100 900")).length;
  log(`sau board:update mang nét thật: ${dCount} bản của nét đó (phải là 1 — 2 là overlay chưa bỏ, 0 là nháy mất)`);
  if (dCount !== 1) throw new Error("overlay không được đối chiếu với board:update");

  const inkAfterUpdate = globalThis.__emitted.slice(emittedBeforeUpdate).filter((e) => e[0] === "live:ink");
  log(`gói live:ink phát ra do NHẬN board:update: ${inkAfterUpdate.length} (phải là 0 — đây là vòng vọng)`);
  if (inkAfterUpdate.length !== 0) throw new Error("nhận board:update mà vẫn phát live:ink → vòng vọng");

  // Đóng gói lúc mousedown giữ mãi commitStroke/commitErase của lượt render
  // đó (finish() gắn vào window ngay từ mousedown, xem ghi chú tại
  // commitStroke trong IdeaMap.jsx). Nếu board:update của người khác về
  // GIỮA nét — hoàn toàn có thể xảy ra vì vẽ một nét mất cả giây — thì
  // commitStroke phải build `next` từ boardRef.current (mới nhất), không
  // phải từ `board` đóng gói cũ, nếu không PUT sẽ mang bản cũ và đè mất thay
  // đổi người khác vừa lưu.
  const putsBeforeMidStroke = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 300, 300, capture);
    mouse("mousemove", 330, 320);
    await new Promise((r) => setTimeout(r, 60));
  });
  const peerNodeMove = {
    ...boardAfterPeerStroke,
    nodes: boardAfterPeerStroke.nodes.map((n) => (n.id === 3 ? { ...n, x: 999, y: 999 } : n)),
    updatedAt: new Date(Date.now() + 30000).toISOString()
  };
  await act(async () => {
    globalThis.__deliver("board:update", peerNodeMove);
    await new Promise((r) => setTimeout(r, 30));
  });
  await act(async () => {
    mouse("mousemove", 360, 340);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 360, 340); await new Promise((r) => setTimeout(r, 40)); });

  log(`board:update giữa nét: PUT thêm ${globalThis.__puts.length - putsBeforeMidStroke} lần`);
  if (globalThis.__puts.length - putsBeforeMidStroke !== 1) throw new Error("kết thúc nét phải đúng 1 lần lưu");
  const savedMid = globalThis.__puts[globalThis.__puts.length - 1];
  const node3 = savedMid.nodes.find((n) => n.id === 3);
  log(`sau nét (board:update về giữa chừng): thẻ 3 x=${node3?.x} · số nét đã lưu=${savedMid.drawings.length}`);
  if (!node3 || node3.x !== 999 || node3.y !== 999) throw new Error("PUT sau nét phải giữ thay đổi thẻ 3 của người khác đến giữa chừng, không được đè mất");
  if (savedMid.drawings.length !== boardAfterPeerStroke.drawings.length + 1) throw new Error("PUT sau nét phải có thêm đúng 1 nét mới CHỒNG lên board mới nhất, không phải đè lên board cũ");

  // Tool hình khối: khu 4 phải mọc thêm bảng chọn hình và hai nút chế độ tô,
  // và nút "tô cả hình" phải mờ đi khi đang chọn một hình MỞ.
  const shapeBtn = railBtn("Hình khối");
  await act(async () => { shapeBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  const picks = document.querySelectorAll(".tool-options .shape-pick").length;
  const fills = document.querySelectorAll(".tool-options .fill-pick").length;
  log(`khu 4 của hình khối: ${picks} hình · ${document.querySelectorAll(".tool-options .pen-swatch").length} màu · ${document.querySelectorAll(".tool-options .pen-width").length} độ dày · ${fills} chế độ tô`);
  if (picks !== 8) throw new Error("khu 4 phải có 8 nút chọn hình, có " + picks);
  if (fills !== 2) throw new Error("khu 4 phải có 2 nút chế độ tô, có " + fills);
  if (document.querySelectorAll(".tool-options .pen-swatch").length !== 7) throw new Error("khu 4 của hình khối vẫn phải có 7 ô màu");
  if (document.querySelectorAll(".tool-options .pen-width").length !== 3) throw new Error("khu 4 của hình khối vẫn phải có 3 nút độ dày");

  const fillBtns = () => document.querySelectorAll(".tool-options .fill-pick");
  if (fillBtns()[1].disabled) throw new Error("chữ nhật là hình đóng, nút tô cả hình phải bấm được");
  // Nút chọn hình thứ 3 là "đường thẳng" — hình mở.
  await act(async () => { document.querySelectorAll(".tool-options .shape-pick")[2].click(); await new Promise((r) => setTimeout(r, 20)); });
  log(`chọn đường thẳng: nút tô cả hình disabled = ${fillBtns()[1].disabled}`);
  if (!fillBtns()[1].disabled) throw new Error("đường thẳng là hình mở, nút tô cả hình phải mờ đi");
  if (!fillBtns()[0].className.includes("on")) throw new Error("chọn hình mở phải tự về chế độ chỉ viền");

  // Kéo chuột ở tool hình khối: ra đúng một path mới, pts đúng 4 số, tô đặc thì
  // fill khác "none", và lưu đúng MỘT lần.
  const shapePicks = () => document.querySelectorAll(".tool-options .shape-pick");
  await act(async () => { shapePicks()[0].click(); await new Promise((r) => setTimeout(r, 20)); });   // chữ nhật
  await act(async () => { fillBtns()[1].click(); await new Promise((r) => setTimeout(r, 20)); });     // tô cả hình

  const pathsBeforeShape = document.querySelectorAll(".ink-layer path").length;
  const putsBeforeShape = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 1200, 300, capture);
    mouse("mousemove", 1280, 360);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", 1360, 420);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1360, 420); await new Promise((r) => setTimeout(r, 40)); });

  const pathsAfterShape = document.querySelectorAll(".ink-layer path").length;
  log(`vẽ hình khối: ${pathsBeforeShape} → ${pathsAfterShape} path · PUT thêm ${globalThis.__puts.length - putsBeforeShape} lần`);
  if (pathsAfterShape !== pathsBeforeShape + 1) throw new Error("một hình phải ra đúng 1 path mới");
  if (globalThis.__puts.length - putsBeforeShape !== 1) throw new Error("một hình phải đúng 1 lần lưu");

  const savedShape = globalThis.__puts[globalThis.__puts.length - 1];
  const lastDrawing = savedShape.drawings[savedShape.drawings.length - 1];
  log(`hình đã lưu: kind=${lastDrawing.kind} fill=${lastDrawing.fill} pts=${JSON.stringify(lastDrawing.pts)}`);
  if (lastDrawing.kind !== "rect") throw new Error("phải lưu kind = rect, có " + lastDrawing.kind);
  if (lastDrawing.fill !== true) throw new Error("đang bật tô cả hình thì phải lưu fill = true");
  if (lastDrawing.pts.length !== 4) throw new Error("pts của hình khối phải đúng 4 số, có " + lastDrawing.pts.length);
  if (lastDrawing.pts.some((v) => !Number.isInteger(v))) throw new Error("toạ độ hình khối phải là số nguyên");

  // fill trên <path> phải THẮNG được stylesheet — đây là cái bẫy CSS-vs-attribute.
  const rectPath = Array.from(document.querySelectorAll(".ink-layer path")).find((p) => (p.getAttribute("d") || "").includes(" Z"));
  if (!rectPath) throw new Error("không tìm thấy path của hình khối (chuỗi d phải khép kín bằng Z)");
  log(`fill của hình tô đặc: ${rectPath.getAttribute("fill")}`);
  if (!rectPath.getAttribute("fill") || rectPath.getAttribute("fill") === "none") throw new Error("hình tô đặc phải có fill khác none");

  // ── Giữ Shift để ép hình ────────────────────────────────────────────────
  // normalizeBox đã có test hàm thuần cho phép ép; ở đây kiểm cái nối dây: phím
  // Shift có thật sự tới được lượt kéo không, và có ăn ngay cả khi bấm GIỮA
  // CHỪNG lúc tay đứng yên không (bản cũ chỉ đọc Shift trong mousemove).
  const shiftMouse = (type, x, y, target, shift) => {
    (target || window).dispatchEvent(new window.MouseEvent(type, {
      bubbles: true, clientX: x, clientY: y, button: 0, shiftKey: shift
    }));
  };
  const lastShape = () => {
    const put = globalThis.__puts[globalThis.__puts.length - 1];
    return put.drawings[put.drawings.length - 1];
  };

  // Chữ nhật + Shift từ đầu → hình vuông, dù kéo ra một hộp 200×80.
  await act(async () => {
    shiftMouse("mousedown", 2000, 300, capture, true);
    shiftMouse("mousemove", 2100, 340, null, true);
    await new Promise((r) => setTimeout(r, 60));
    shiftMouse("mousemove", 2200, 380, null, true);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { shiftMouse("mouseup", 2200, 380, null, true); await new Promise((r) => setTimeout(r, 40)); });
  const sq = lastShape().pts;
  log(`Shift + chữ nhật: pts=${JSON.stringify(sq)} → ${Math.abs(sq[2] - sq[0])}×${Math.abs(sq[3] - sq[1])}`);
  if (Math.abs(sq[2] - sq[0]) !== Math.abs(sq[3] - sq[1])) throw new Error("giữ Shift mà chữ nhật không ra hình vuông");

  // Ê-líp + Shift → hình tròn (cùng đường ép, kiểm để chắc hình đóng nào cũng ăn).
  await act(async () => { shapePicks()[1].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    shiftMouse("mousedown", 2000, 700, capture, true);
    shiftMouse("mousemove", 2300, 780, null, true);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { shiftMouse("mouseup", 2300, 780, null, true); await new Promise((r) => setTimeout(r, 40)); });
  const ci = lastShape().pts;
  log(`Shift + ê-líp: ${Math.abs(ci[2] - ci[0])}×${Math.abs(ci[3] - ci[1])}`);
  if (Math.abs(ci[2] - ci[0]) !== Math.abs(ci[3] - ci[1])) throw new Error("giữ Shift mà ê-líp không ra hình tròn");

  // HÌNH BÌNH HÀNH và HÌNH THANG kéo bằng hộp: phải lưu ra BỐN ĐỈNH THẬT, không
  // phải cái hộp. Cái hộp không nói ra được bốn đỉnh muốn đặt ở đâu, nên hai
  // hình này chỉ có nghĩa khi ra thẳng dạng đỉnh — rồi kéo tay cầm góc mà đặt
  // lại. Cả hai lưu ra CÙNG kind "quad": chúng chỉ khác dáng khởi đầu.
  const boxShape = async (pickIndex, x0, y0) => {
    await act(async () => { shapePicks()[pickIndex].click(); await new Promise((r) => setTimeout(r, 20)); });
    await act(async () => {
      mouse("mousedown", x0, y0, capture);
      mouse("mousemove", x0 + 100, y0 + 50);
      await new Promise((r) => setTimeout(r, 60));
      mouse("mousemove", x0 + 200, y0 + 100);
      await new Promise((r) => setTimeout(r, 60));
    });
    await act(async () => { mouse("mouseup", x0 + 200, y0 + 100); await new Promise((r) => setTimeout(r, 40)); });
    return lastShape();
  };
  const edgeWidths = (d) => [d.pts[2] - d.pts[0], d.pts[4] - d.pts[6]];

  const para = await boxShape(6, 2600, 300);
  const trap = await boxShape(7, 2600, 700);
  log(`kéo hình bình hành / hình thang: kind="${para.kind}"/"${trap.kind}"`
    + ` · ${para.pts.length}/${trap.pts.length} số`
    + ` · cạnh trên–dưới ${JSON.stringify(edgeWidths(para))} và ${JSON.stringify(edgeWidths(trap))}`);
  for (const [tag, d] of [["hình bình hành", para], ["hình thang", trap]]) {
    if (d.kind !== "quad") throw new Error(`${tag} phải lưu kind "quad", lưu ra "${d.kind}"`);
    if (d.pts.length !== 8) throw new Error(`${tag} phải lưu BỐN ĐỈNH (8 số), lưu ra ${d.pts.length} số`);
    if (d.pts[0] === d.pts[6]) throw new Error(`${tag} có bốn đỉnh thẳng trục — đây là chữ nhật`);
  }
  // Khác biệt DUY NHẤT giữa hai nút: hình bình hành có cạnh trên bằng cạnh dưới
  // (chỉ lệch đi), hình thang có cạnh trên ngắn hơn.
  const [paraTop, paraBottom] = edgeWidths(para);
  if (paraTop !== paraBottom) throw new Error(`hình bình hành phải có hai cạnh ngang bằng nhau, có ${paraTop} và ${paraBottom}`);
  const [trapTop, trapBottom] = edgeWidths(trap);
  if (!(trapTop < trapBottom)) throw new Error(`hình thang phải có cạnh trên ngắn hơn, có ${trapTop} và ${trapBottom}`);

  // Đường thẳng + Shift ở hướng gần ngang → ép về ĐÚNG ngang.
  await act(async () => { shapePicks()[2].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    shiftMouse("mousedown", 3000, 1000, capture, true);
    shiftMouse("mousemove", 3200, 1012, null, true);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { shiftMouse("mouseup", 3200, 1012, null, true); await new Promise((r) => setTimeout(r, 40)); });
  const ln = lastShape().pts;
  log(`Shift + đường thẳng gần ngang: pts=${JSON.stringify(ln)}`);
  if (ln[3] !== ln[1]) throw new Error("giữ Shift mà đường gần ngang không ép về ngang");

  // Đường thẳng + Shift ở hướng gần 45 độ → ép về đúng 45 độ.
  await act(async () => {
    shiftMouse("mousedown", 3000, 1200, capture, true);
    shiftMouse("mousemove", 3200, 1380, null, true);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { shiftMouse("mouseup", 3200, 1380, null, true); await new Promise((r) => setTimeout(r, 40)); });
  const dg = lastShape().pts;
  log(`Shift + đường gần chéo: pts=${JSON.stringify(dg)}`);
  if (Math.abs(dg[2] - dg[0]) !== Math.abs(dg[3] - dg[1])) throw new Error("giữ Shift mà đường gần chéo không ép về 45 độ");

  // Bấm Shift GIỮA CHỪNG, tay đứng yên: hình phải ép lại ngay, không đợi cú di
  // chuột tiếp theo. Đây là chỗ bản cũ hụt.
  await act(async () => { shapePicks()[0].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    mouse("mousedown", 2500, 300, capture);
    mouse("mousemove", 2700, 380);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { mouse("mouseup", 2700, 380); await new Promise((r) => setTimeout(r, 40)); });
  const mid = lastShape().pts;
  log(`Shift bấm giữa chừng (tay đứng yên): pts=${JSON.stringify(mid)}`);
  if (Math.abs(mid[2] - mid[0]) !== Math.abs(mid[3] - mid[1])) {
    throw new Error("bấm Shift giữa chừng mà hình không ép lại ngay");
  }

  // Nhả Shift ra cũng phải trả hình về hộp tự do ngay lập tức.
  await act(async () => {
    shiftMouse("mousedown", 2500, 700, capture, true);
    shiftMouse("mousemove", 2700, 780, null, true);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keyup", { key: "Shift", bubbles: true }));
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { mouse("mouseup", 2700, 780); await new Promise((r) => setTimeout(r, 40)); });
  const freed = lastShape().pts;
  log(`nhả Shift giữa chừng: pts=${JSON.stringify(freed)}`);
  if (Math.abs(freed[2] - freed[0]) === Math.abs(freed[3] - freed[1])) {
    throw new Error("nhả Shift mà hình vẫn bị ép vuông");
  }

  // Bấm rồi nhả gần như không di: hình suy biến, không được lưu.
  const putsBeforeTiny = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 1600, 300, capture);
    mouse("mousemove", 1601, 301);
    await new Promise((r) => setTimeout(r, 50));
  });
  await act(async () => { mouse("mouseup", 1601, 301); await new Promise((r) => setTimeout(r, 30)); });
  log(`hình suy biến: PUT thêm ${globalThis.__puts.length - putsBeforeTiny} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeTiny) throw new Error("hình quá nhỏ không được lưu");

  // Cục gôm phải xoá được hình khối, và với hình TÔ ĐẶC thì quét vào GIỮA hình
  // cũng xoá — không chỉ chạm viền.
  const putsBeforeShapeErase = globalThis.__puts.length;
  const pathsBeforeShapeErase = document.querySelectorAll(".ink-layer path").length;
  await act(async () => { railBtn("Cục gôm").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    // (1280,360) nằm giữa hình chữ nhật tô đặc vẽ ở nhóm trước (1200,300)-(1360,420)
    mouse("mousedown", 1280, 360, capture);
    mouse("mousemove", 1285, 365);
    await new Promise((r) => setTimeout(r, 60));
  });
  const dimmedShape = document.querySelectorAll(".ink-layer path.erasing").length;
  log(`quét gôm vào giữa hình tô đặc: ${dimmedShape} hình đang mờ đi`);
  if (dimmedShape < 1) throw new Error("quét vào giữa hình tô đặc phải làm nó mờ đi");

  await act(async () => { mouse("mouseup", 1285, 365); await new Promise((r) => setTimeout(r, 40)); });
  const pathsAfterShapeErase = document.querySelectorAll(".ink-layer path").length;
  log(`sau khi gôm hình: ${pathsBeforeShapeErase} → ${pathsAfterShapeErase} path · PUT thêm ${globalThis.__puts.length - putsBeforeShapeErase} lần`);
  if (pathsAfterShapeErase !== pathsBeforeShapeErase - 1) throw new Error("hình tô đặc phải bị xoá");
  if (globalThis.__puts.length - putsBeforeShapeErase !== 1) throw new Error("một lần quét gôm phải đúng 1 lần lưu");

  // Hình CHỈ VIỀN: quét vào giữa vùng rỗng thì KHÔNG được xoá.
  await act(async () => { railBtn("Hình khối").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { fillBtns()[0].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    mouse("mousedown", 1200, 700, capture);
    mouse("mousemove", 1300, 780);
    await new Promise((r) => setTimeout(r, 60));
    // Hộp chỉ được cập nhật ở mousemove — mouseup KHÔNG cập nhật. Nên điểm cuối
    // phải là một mousemove, không thì hình dừng ở hộp của lần nhích trước.
    mouse("mousemove", 1360, 820);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1360, 820); await new Promise((r) => setTimeout(r, 40)); });
  const pathsWithOutlineRect = document.querySelectorAll(".ink-layer path").length;

  await act(async () => { railBtn("Cục gôm").click(); await new Promise((r) => setTimeout(r, 20)); });
  const putsBeforeHollow = globalThis.__puts.length;
  await act(async () => {
    // giữa hình chỉ viền → không chạm gì
    mouse("mousedown", 1270, 750, capture);
    mouse("mousemove", 1275, 755);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1275, 755); await new Promise((r) => setTimeout(r, 40)); });
  log(`quét vào giữa hình CHỈ VIỀN: còn ${document.querySelectorAll(".ink-layer path").length} path · PUT thêm ${globalThis.__puts.length - putsBeforeHollow} lần (phải là 0)`);
  if (document.querySelectorAll(".ink-layer path").length !== pathsWithOutlineRect) throw new Error("hình chỉ viền không được xoá khi quét vào vùng rỗng bên trong");
  if (globalThis.__puts.length !== putsBeforeHollow) throw new Error("quét vùng rỗng không được tạo bước hoàn tác");

  // PHÁT: mọi gói của hình khối phải mang kind và pts đúng 4 số, và tổng số
  // "số" đã gửi không được phình lên như gói nét bút.
  await act(async () => { railBtn("Hình khối").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { shapePicks()[1].click(); await new Promise((r) => setTimeout(r, 20)); });   // ê-líp
  // Bật TÔ CẢ HÌNH trước khi kéo. Nhóm trước vừa đặt chế độ chỉ viền, nên nếu
  // không bật lại ở đây thì assertion `fill` dưới chỉ từng thấy `false` — và
  // `beginShape` có thể phát `fill: false` vô điều kiện mà cả bộ test vẫn xanh,
  // trong khi lỗi người dùng thấy là thật: hình tô đặc của người khác hiện ra
  // chỉ-viền suốt lúc họ kéo rồi NHẢY thành tô đặc khi board:update về.
  await act(async () => { fillBtns()[1].click(); await new Promise((r) => setTimeout(r, 20)); });
  const emittedBeforeShape = globalThis.__emitted.length;
  await act(async () => {
    mouse("mousedown", 200, 1200, capture);
    mouse("mousemove", 260, 1250);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", 320, 1300);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 320, 1300); await new Promise((r) => setTimeout(r, 40)); });

  const shapePkts = globalThis.__emitted.slice(emittedBeforeShape).filter((e) => e[0] === "live:ink").map((e) => e[1]);
  log(`live:ink của hình khối: ${shapePkts.length} gói; seq = ${shapePkts.map((p) => (p.done ? "done" : p.seq)).join(",")}`);
  if (shapePkts.length < 2) throw new Error("phải phát ít nhất gói đầu và gói done");
  const shapeFirst = shapePkts[0];
  if (shapeFirst.seq !== 0 || shapeFirst.kind !== "ellipse") throw new Error("gói đầu phải mang seq 0 và kind");
  log(`gói đầu của hình tô đặc: fill=${JSON.stringify(shapeFirst.fill)}`);
  if (shapeFirst.fill !== true) throw new Error("đang bật tô cả hình thì gói live đầu phải mang fill = true, có " + JSON.stringify(shapeFirst.fill));
  for (const p of shapePkts) {
    if (p.done) continue;
    if (p.kind !== "ellipse") throw new Error("MỌI gói hình khối phải mang kind, gói seq " + p.seq + " thì không");
    if (p.pts.length !== 4) throw new Error("gói hình khối phải mang đúng 4 số, gói seq " + p.seq + " có " + p.pts.length);
  }
  const shapeDone = shapePkts[shapePkts.length - 1];
  if (shapeDone.done !== true || !Number.isFinite(shapeDone.drawingId)) throw new Error("gói cuối phải là done kèm drawingId");
  if (shapePkts.filter((p) => p.done).length !== 1) throw new Error("một hình chỉ được có đúng 1 gói done");

  // NHẬN: gói hình của người khác hiện ra ngay, và gói sau THAY hộp chứ không
  // làm hình phình ra.
  const pathsBeforePeerShape = document.querySelectorAll(".ink-layer path").length;
  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer9", strokeId: 5, seq: 0, kind: "rect", color: "pen-purple", w: 4, fill: false, pts: [2000, 100, 2100, 200] });
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`hình của người khác đang vẽ: ${document.querySelectorAll(".ink-layer path").length} path (trước đó ${pathsBeforePeerShape})`);
  if (document.querySelectorAll(".ink-layer path").length !== pathsBeforePeerShape + 1) throw new Error("gói hình khối của người khác không hiện ra");

  const peerRect = () => Array.from(document.querySelectorAll(".ink-layer path")).find((p) => (p.getAttribute("d") || "").startsWith("M 2000 100"));
  if (!peerRect()) throw new Error("không tìm thấy hình của người khác");
  await act(async () => {
    globalThis.__deliver("live:ink", { socketId: "peer9", strokeId: 5, seq: 1, kind: "rect", pts: [2000, 100, 2300, 400] });
    await new Promise((r) => setTimeout(r, 30));
  });
  const grown = peerRect();
  log(`sau gói seq 1: d = ${grown?.getAttribute("d")}`);
  if (!grown) throw new Error("hình của người khác biến mất sau gói seq 1");
  if (!grown.getAttribute("d").includes("2300")) throw new Error("gói sau phải THAY hộp — hình phải lớn ra tới 2300");
  // Fix round 1: đã bỏ assertion đếm lệnh "L" ở đây — nó nói dối. shapePath("rect", pts)
  // luôn destructure đúng 4 số ĐẦU của pts, nên dù hộp bị NỐI thành 6/8 số thì
  // chuỗi d vẫn ra đúng 3 lệnh L y như khi THAY; đếm L không phân biệt được hai
  // trường hợp. Thứ thật sự chứng minh "THAY chứ không nối" ở tầng smoke này là
  // assertion `includes("2300")` ngay trên — nếu bị NỐI thì shapePath đọc 4 số
  // ĐẦU là hộp CŨ [2000,100,2100,200], chuỗi d sẽ không có "2300". Việc chốt độ
  // dài `pts` phải đúng 4 số (không phình lên 6/8) là việc của unit test
  // `mergeInkPacket` trong client/src/lib/ink-live.test.js, không
  // phải của smoke test này.

  // Cửa sổ mất focus GIỮA nét rồi quay lại: không được sinh nét rác.
  //
  // Chuỗi này người dùng gặp thật: đang cầm tool, bấm chuột xuống → alt-tab /
  // thông báo hệ điều hành / bấm vào devtools làm cửa sổ mất focus → quay lại,
  // di chuột mà KHÔNG bấm → bấm một cái ở đâu đó ngoài lớp bắt chuột.
  //
  // Cái bẫy: `blur` dọn state nhưng nếu KHÔNG gỡ listener mousemove/mouseup thì
  // hai listener của lượt đã chết vẫn sống. mousemove sau đó rơi vào nhánh bút
  // và bơm điểm vào ptsRef, rồi mouseup gọi `finish` của lượt đã chết với
  // activeRef = null — commit ra một nét `kind: "pen"` chưa từng được vẽ, PUT cả
  // board nên nét rác lên server và sang màn hình mọi người. Với tool HÌNH KHỐI
  // thì còn sai kiểu: đang cầm hình khối mà lưu ra nét bút.
  //
  // mousedown/mouseup cuối phát trên document.body (không phải trên `capture`)
  // để mô phỏng đúng "bấm một cái ở chỗ khác": handleMouseDown gắn trên phần tử
  // .ink-capture nên không chạy, còn listener mouseup gắn trên window thì chạy.
  // Phát trên body chứ không trên window vì handler onDocMouseDown của IdeaMap
  // gọi el.contains(e.target), mà window không phải Node.
  for (const [name, btnName] of [["bút", "Bút"], ["hình khối", "Hình khối"]]) {
    await act(async () => { railBtn(btnName).click(); await new Promise((r) => setTimeout(r, 20)); });
    const putsBeforeBlur = globalThis.__puts.length;
    const pathsBeforeBlur = document.querySelectorAll(".ink-layer path").length;
    await act(async () => {
      mouse("mousedown", 2700, 2600, capture);
      await new Promise((r) => setTimeout(r, 30));
    });
    await act(async () => {
      window.dispatchEvent(new window.Event("blur"));
      await new Promise((r) => setTimeout(r, 30));
    });
    await act(async () => {
      mouse("mousemove", 2700, 2600);
      mouse("mousemove", 2900, 2700);
      mouse("mousemove", 3100, 2500);
      await new Promise((r) => setTimeout(r, 60));
    });
    await act(async () => {
      mouse("mousedown", 3100, 2500, document.body);
      mouse("mouseup", 3100, 2500, document.body);
      await new Promise((r) => setTimeout(r, 40));
    });
    const putsAfterBlur = globalThis.__puts.length - putsBeforeBlur;
    const pathsAfterBlur = document.querySelectorAll(".ink-layer path").length;
    log(`mất focus giữa nét (tool ${name}): PUT thêm ${putsAfterBlur} lần (phải là 0) · path ${pathsBeforeBlur} -> ${pathsAfterBlur}`);
    if (putsAfterBlur !== 0) {
      const junk = globalThis.__puts[globalThis.__puts.length - 1];
      throw new Error(`mất focus giữa nét (tool ${name}) đã lưu nét rác: ${JSON.stringify(junk.drawings[junk.drawings.length - 1])}`);
    }
    if (pathsAfterBlur !== pathsBeforeBlur) throw new Error(`mất focus giữa nét (tool ${name}) làm số nét đổi ${pathsBeforeBlur} -> ${pathsAfterBlur}`);
  }

  // ——— Phím tắt Bút: `p`, không còn `b` ———
  const press = (k) => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
  const cursorBtn = () => railBtn("Chuột");
  await act(async () => { cursorBtn().click(); await new Promise((r) => setTimeout(r, 20)); });
  if (document.querySelector(".tool-options")) throw new Error("bấm nút Chuột phải về mode Chuột");

  await act(async () => { press("b"); await new Promise((r) => setTimeout(r, 20)); });
  const bDidNothing = !document.querySelector(".tool-options") && !document.querySelector(".ink-capture");
  log(`phím b: ${bDidNothing ? "không làm gì (đúng)" : "VẪN bật mode Sửa"}`);
  if (!bDidNothing) throw new Error("`b` phải hết tác dụng sau khi đổi phím Bút sang `p`");

  await act(async () => { press("p"); await new Promise((r) => setTimeout(r, 20)); });
  const penOn = railBtn("Bút")?.classList.contains("on");
  log(`phím p: khu 4 ${document.querySelector(".tool-options") ? "hiện" : "KHÔNG hiện"} · nút Bút ${penOn ? "sáng" : "KHÔNG sáng"}`);
  if (!document.querySelector(".tool-options")) throw new Error("`p` phải vào mode Sửa (khu 4 hiện ra)");
  if (!penOn) throw new Error("`p` phải chọn đúng tool Bút, không phải gôm hay hình");

  // ——— Ctrl+click = thêm/bớt thẻ khỏi vùng chọn ———
  await act(async () => { cursorBtn().click(); await new Promise((r) => setTimeout(r, 20)); });
  const ctrlClick = async (id) => {
    const el = document.querySelector(`.idea-card[data-id="${id}"]`);
    await act(async () => {
      el.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 5, clientY: 5, button: 0, ctrlKey: true }));
      el.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true, clientX: 5, clientY: 5, button: 0, ctrlKey: true }));
      await new Promise((r) => setTimeout(r, 20));
    });
  };
  const selCount = () => document.querySelectorAll(".idea-card.selected").length;
  const cardLeft = (id) => document.querySelector(`.idea-card[data-id="${id}"]`).style.left;

  const putsBeforeCtrl = globalThis.__puts.length;
  const left1Before = cardLeft(1);
  await ctrlClick(1);
  const afterFirst = selCount();
  await ctrlClick(3);
  const afterSecond = selCount();
  log(`Ctrl+click thẻ 1 rồi thẻ 3: đang chọn ${afterFirst} → ${afterSecond} thẻ`);
  if (afterFirst !== 1) throw new Error("Ctrl+click thẻ đầu phải chọn đúng 1 thẻ, có " + afterFirst);
  if (afterSecond !== 2) throw new Error("Ctrl+click thẻ thứ hai phải CỘNG vào lựa chọn (2 thẻ), có " + afterSecond);

  const bulk = document.querySelector(".bulk-bar .bb-count");
  log(`thanh nhiều thẻ: ${bulk ? JSON.stringify(bulk.textContent) : "KHÔNG hiện"}`);
  if (!bulk) throw new Error("chọn 2 thẻ phải hiện thanh bulk-bar");

  // Ctrl+click lại thẻ đã chọn = bớt ra, không phải chọn lại một mình nó.
  await ctrlClick(1);
  log(`Ctrl+click lại thẻ 1: còn ${selCount()} thẻ`);
  if (selCount() !== 1) throw new Error("Ctrl+click thẻ đã chọn phải BỚT nó ra, còn 1 thẻ, có " + selCount());
  if (!document.querySelector('.idea-card[data-id="3"]').classList.contains("selected")) {
    throw new Error("bớt thẻ 1 mà thẻ 3 cũng rơi khỏi lựa chọn");
  }

  // Ctrl+click chỉ đổi lựa chọn: không lưu gì, và không được xê dịch thẻ (nhánh
  // này return sớm nên không gắn mousemove/mouseup nào).
  log(`Ctrl+click: PUT thêm ${globalThis.__puts.length - putsBeforeCtrl} lần (phải là 0) · thẻ 1 left ${left1Before} -> ${cardLeft(1)}`);
  if (globalThis.__puts.length !== putsBeforeCtrl) throw new Error("Ctrl+click không được lưu gì");
  if (cardLeft(1) !== left1Before) throw new Error("Ctrl+click làm thẻ xê dịch");

  // ——— Kéo trạng thái vào vùng chọn nhiều → cả vùng nhận ———
  // Đường này đi qua document.elementFromPoint, thứ jsdom không có; __hitAt của
  // smoke-run.mjs đặt sẵn phần tử "dưới con trỏ" (xem ghi chú ở đó).
  await ctrlClick(1); // đang chọn thẻ 3, cộng thêm thẻ 1 → {1, 3}
  if (selCount() !== 2) throw new Error("cần đúng 2 thẻ được chọn trước khi thử kéo badge");

  // Fixture vào đây với thẻ1=trạng thái 1, thẻ2=không, thẻ3=trạng thái 2. Giá
  // trị thả vào phải là giá trị mà thẻ đó CHƯA có, nếu không assertion đúng một
  // cách vô nghĩa và bài kiểm mất răng. Nên đi hai cú thả: cú đầu dồn thẻ 1 và
  // thẻ 3 về cùng trạng thái 2, cú sau đổi cả hai sang 1 — lúc đó "thẻ cùng
  // vùng chọn cũng nhận" mới thật sự là một phép đo.
  const dragChipOnto = async (statusId, targetCardId) => {
    const chip = document.querySelector(`.chip-toggle.status[data-badge-id="${statusId}"]`);
    if (!chip) throw new Error(`không thấy chip trạng thái id ${statusId} để kéo`);
    globalThis.__hitAt(document.querySelector(`.idea-card[data-id="${targetCardId}"]`));
    await act(async () => {
      chip.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 10, clientY: 10, button: 0 }));
      mouse("mousemove", 40, 40);
      mouse("mousemove", 90, 90);
      await new Promise((r) => setTimeout(r, 40));
    });
    await act(async () => { mouse("mouseup", 90, 90); await new Promise((r) => setTimeout(r, 40)); });
  };
  const lastPut = () => globalThis.__puts[globalThis.__puts.length - 1];
  const statusOf = (put, id) => put.nodes.find((n) => n.id === id).statusId;

  // Cú 1: thả trạng thái 2 vào thẻ 1 (thẻ 1 đang là 1 → phải đổi).
  await dragChipOnto(2, 1);
  const put1 = lastPut();
  log(`thả trạng thái 2 vào thẻ 1 (đang chọn 1+3): thẻ1=${statusOf(put1, 1)} thẻ2=${statusOf(put1, 2)} thẻ3=${statusOf(put1, 3)}`);
  if (statusOf(put1, 1) !== 2) throw new Error("thẻ được thả vào phải nhận trạng thái");
  if (statusOf(put1, 2) !== null) throw new Error("thẻ ngoài vùng chọn không được đổi");

  // Cú 2: thả trạng thái 1 vào thẻ 3. Giờ thẻ 1 VÀ thẻ 3 đều đang là 2, nên thẻ
  // 1 nhận được giá trị mới chỉ có thể là do nó cùng vùng chọn.
  await dragChipOnto(1, 3);
  const put2 = lastPut();
  log(`thả trạng thái 1 vào thẻ 3 (đang chọn 1+3): thẻ1=${statusOf(put2, 1)} thẻ2=${statusOf(put2, 2)} thẻ3=${statusOf(put2, 3)}`);
  if (statusOf(put2, 3) !== 1) throw new Error("thẻ được thả vào phải nhận trạng thái");
  if (statusOf(put2, 1) !== 1) throw new Error("thẻ CÙNG vùng chọn cũng phải nhận trạng thái (2 → 1)");
  if (statusOf(put2, 2) !== null) throw new Error("thẻ ngoài vùng chọn không được đổi");

  // Thả lại y nguyên: mọi thẻ đã đúng giá trị → không thêm bước hoàn tác, không
  // thêm lượt PUT cả bảng.
  const putsBeforeNoop = globalThis.__puts.length;
  await dragChipOnto(1, 3);
  log(`thả lại đúng trạng thái đó: PUT thêm ${globalThis.__puts.length - putsBeforeNoop} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeNoop) throw new Error("cú thả không đổi gì mà vẫn lưu");

  // Thả vào thẻ NGOÀI vùng chọn: chỉ thẻ đó nhận, vùng chọn không nhận gì và
  // cũng không bị phá.
  await dragChipOnto(2, 2);
  const put3 = lastPut();
  log(`thả trạng thái 2 vào thẻ 2 (NGOÀI vùng chọn): thẻ1=${statusOf(put3, 1)} thẻ2=${statusOf(put3, 2)} thẻ3=${statusOf(put3, 3)} · vẫn đang chọn ${selCount()} thẻ`);
  if (statusOf(put3, 2) !== 2) throw new Error("thẻ ngoài vùng chọn được thả vào thì phải nhận");
  if (statusOf(put3, 1) !== 1 || statusOf(put3, 3) !== 1) {
    throw new Error("thả vào thẻ NGOÀI vùng chọn mà vùng chọn cũng bị đổi theo");
  }
  if (selCount() !== 2) throw new Error("thả vào thẻ ngoài vùng chọn không được phá vùng chọn");
  globalThis.__hitAt(null);

  // ——— Khu 3: lên nòng rồi chỉ chỗ trên bảng ———
  // Bất biến của cả nhóm này: nút khu 3 KHÔNG tạo gì lúc bấm, và làm xong đúng
  // MỘT lần là tự về mode Chuột (khác khu 2, giữ nguyên tool cho tới khi đổi).
  await act(async () => { cursorBtn().click(); await new Promise((r) => setTimeout(r, 20)); });
  const addCardBtn = () => railBtn("Thêm ý tưởng");
  const addFrameBtn = () => railBtn("Thêm khung");

  const putsBeforeArm = globalThis.__puts.length;
  const cardsBeforePlace = document.querySelectorAll(".idea-card").length;
  await act(async () => { addCardBtn().click(); await new Promise((r) => setTimeout(r, 20)); });
  const levelPicks = () => document.querySelectorAll(".tool-options .level-pick");
  log(`lên nòng thêm thẻ: khu 4 có ${levelPicks().length} bậc · lớp bắt chuột ${document.querySelector(".place-capture") ? "có" : "KHÔNG"} · PUT thêm ${globalThis.__puts.length - putsBeforeArm} lần`);
  if (levelPicks().length !== 5) throw new Error("khu 4 của nút thêm thẻ phải có 5 nút bậc, có " + levelPicks().length);
  if (!document.querySelector(".place-capture")) throw new Error("lên nòng rồi phải có lớp bắt chuột .place-capture");
  if (document.querySelector(".ink-capture")) throw new Error("mode Đặt không được dựng lớp bắt chuột của mode Sửa");
  if (globalThis.__puts.length !== putsBeforeArm) throw new Error("bấm nút khu 3 KHÔNG được tạo gì — nó chỉ lên nòng");
  if (document.querySelectorAll(".idea-card").length !== cardsBeforePlace) throw new Error("bấm nút khu 3 đã tạo thẻ ngay, đáng lẽ phải chờ bấm lên bảng");
  if (!addCardBtn().className.includes("on")) throw new Error("nút khu 3 đang lên nòng phải sáng");

  // Chọn bậc 5 (nhỏ nhất) rồi đặt: thẻ mới phải mang đúng class bậc đó.
  await act(async () => { levelPicks()[4].click(); await new Promise((r) => setTimeout(r, 20)); });
  if (!levelPicks()[4].className.includes("on")) throw new Error("bậc vừa bấm phải sáng lên");
  await act(async () => {
    mouse("mousedown", 640, 480, document.querySelector(".place-capture"));
    await new Promise((r) => setTimeout(r, 40));
  });
  const placed = document.querySelectorAll(".idea-card.lv-5").length;
  log(`đặt thẻ bậc 5: ${cardsBeforePlace} → ${document.querySelectorAll(".idea-card").length} thẻ · lv-5 = ${placed} · PUT thêm ${globalThis.__puts.length - putsBeforeArm} lần`);
  if (document.querySelectorAll(".idea-card").length !== cardsBeforePlace + 1) throw new Error("bấm lên bảng phải ra đúng 1 thẻ mới");
  if (placed !== 1) throw new Error("thẻ mới phải mang class bậc đang chọn (lv-5), có " + placed);
  // Đây là điểm khác then chốt so với khu 2: xong một lần là hạ nòng.
  if (document.querySelector(".place-capture")) throw new Error("đặt xong phải tự về mode Chuột");
  if (document.querySelector(".tool-options")) throw new Error("về mode Chuột thì khu 4 phải biến mất");
  if (addCardBtn().className.includes("on")) throw new Error("đặt xong nút khu 3 phải hết sáng");

  const savedPlace = globalThis.__puts[globalThis.__puts.length - 1];
  const newNode = savedPlace.nodes[savedPlace.nodes.length - 1];
  log(`thẻ đã lưu: level=${newNode.level} isRoot=${newNode.isRoot}`);
  if (newNode.level !== 5) throw new Error("thẻ mới phải lưu level = 5, có " + newNode.level);
  // Cờ cũ phải được ghi cho khớp, nếu không board mở bằng bản client cũ sẽ thấy
  // một thẻ ghi chú đội vương miện.
  if (newNode.isRoot !== false) throw new Error("bậc khác 1 phải lưu isRoot = false");

  // Vẽ khung bằng cách TÔ một vùng, không phải thả một khung cỡ mặc định ra giữa
  // màn hình.
  const framesBefore = document.querySelectorAll(".frame-box").length;
  await act(async () => { addFrameBtn().click(); await new Promise((r) => setTimeout(r, 20)); });
  if (!document.querySelector(".place-capture.draw-frame")) throw new Error("nút thêm khung phải lên nòng ở chế độ tô");
  if (document.querySelector(".tool-options")) throw new Error("nút thêm khung không có tuỳ chọn nào — khu 4 phải ẩn");
  await act(async () => {
    mouse("mousedown", 200, 200, document.querySelector(".place-capture"));
    mouse("mousemove", 420, 380);
    await new Promise((r) => setTimeout(r, 60));
  });
  const draft = document.querySelector(".place-draft");
  log(`đang tô khung: khung nháp ${draft ? `${draft.style.width} x ${draft.style.height}` : "KHÔNG hiện"}`);
  if (!draft) throw new Error("đang tô phải hiện khung nháp .place-draft");
  await act(async () => { mouse("mouseup", 420, 380); await new Promise((r) => setTimeout(r, 40)); });

  const framesAfter = document.querySelectorAll(".frame-box").length;
  const savedFrame = globalThis.__puts[globalThis.__puts.length - 1];
  const newGroup = savedFrame.groups[savedFrame.groups.length - 1];
  log(`tô khung: ${framesBefore} → ${framesAfter} khung · khung mới ${newGroup.w}x${newGroup.h}`);
  if (framesAfter !== framesBefore + 1) throw new Error("tô một vùng phải ra đúng 1 khung mới");
  if (document.querySelector(".place-draft")) throw new Error("thả chuột xong khung nháp phải biến mất");
  if (document.querySelector(".place-capture")) throw new Error("vẽ khung xong phải tự về mode Chuột");
  // Khung phải lấy đúng vùng vừa tô, không phải cỡ mặc định 480x320.
  if (newGroup.w === 480 && newGroup.h === 320) throw new Error("khung phải theo vùng vừa tô, không phải cỡ mặc định");

  // ——— Bôi đen quét trúng cả khung ———
  // Quét một vùng rộng trùm cả bảng: phải dính cả thẻ LẪN khung. Trước đợt này
  // khung hoàn toàn nằm ngoài vùng chọn, quét kiểu gì cũng không trúng.
  const viewport = document.querySelector(".viewport");
  const selectedFrames = () => document.querySelectorAll(".frame-box.selected").length;
  await act(async () => {
    mouse("mousedown", -3000, -3000, viewport);
    mouse("mousemove", -1000, -1000);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", 4000, 4000);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 4000, 4000); await new Promise((r) => setTimeout(r, 40)); });
  log(`quét cả bảng: ${selCount()} thẻ · ${selectedFrames()} khung được chọn (có ${document.querySelectorAll(".frame-box").length} khung trên bảng)`);
  if (selectedFrames() !== document.querySelectorAll(".frame-box").length) {
    throw new Error("quét trùm cả bảng phải chọn được MỌI khung, chỉ có " + selectedFrames());
  }
  if (selCount() === 0) throw new Error("quét cả bảng vẫn phải chọn thẻ như cũ");

  // Thanh nhiều-lựa-chọn phải nói ra cả hai loại.
  const bulkText = document.querySelector(".bulk-bar .bb-count")?.textContent ?? "";
  log(`thanh nhiều lựa chọn: ${JSON.stringify(bulkText)}`);
  if (!bulkText.includes("thẻ") || !bulkText.includes("khung")) throw new Error("thanh phải đếm cả thẻ lẫn khung, đang là " + JSON.stringify(bulkText));

  // Kéo một khung đang trong vùng chọn: khung ĐI, và thẻ trong khung đi theo.
  const frameEl = document.querySelector(".frame-box.selected");
  const frameLeftBefore = frameEl.style.left;
  const anyCardLeftBefore = document.querySelector('.idea-card[data-id="1"]').style.left;
  const putsBeforeFrameDrag = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 60, 60, frameEl);
    mouse("mousemove", 130, 110);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", 200, 160);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 200, 160); await new Promise((r) => setTimeout(r, 60)); });
  const frameLeftAfter = document.querySelector(".frame-box").style.left;
  log(`kéo khung đang chọn: khung left ${frameLeftBefore} → ${frameLeftAfter} · thẻ 1 left ${anyCardLeftBefore} → ${document.querySelector('.idea-card[data-id="1"]').style.left} · PUT thêm ${globalThis.__puts.length - putsBeforeFrameDrag} lần`);
  if (frameLeftBefore === frameLeftAfter) throw new Error("kéo khung mà khung không dịch chuyển");
  if (globalThis.__puts.length - putsBeforeFrameDrag !== 1) throw new Error("một cú kéo khung phải đúng 1 lần lưu");

  // Xoá vùng chọn: khung biến mất, nhưng thẻ TRONG khung phải ở lại — khung là
  // cái vòng vẽ quanh, không phải cái hộp sở hữu thẻ.
  const framesBeforeDel = document.querySelectorAll(".frame-box").length;
  await act(async () => {
    document.querySelectorAll(".frame-box")[0].dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 60, clientY: 60, button: 0, ctrlKey: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  const afterCtrl = selectedFrames();
  log(`Ctrl+click khung đã chọn: còn ${afterCtrl}/${framesBeforeDel} khung được chọn`);
  if (afterCtrl !== framesBeforeDel - 1) throw new Error("Ctrl+click khung phải BỚT nó khỏi vùng chọn");

  // ── Tool text ──────────────────────────────────────────────────────────
  // Về mode Sửa rồi chọn tool Text.
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { railBtn("Text").click(); await new Promise((r) => setTimeout(r, 20)); });
  const sizeBtns = document.querySelectorAll(".tool-options .text-size").length;
  const textSwatches = document.querySelectorAll(".tool-options .pen-swatch").length;
  const widthBtns = document.querySelectorAll(".tool-options .pen-width").length;
  log(`khu 4 của text: ${sizeBtns} cỡ · ${textSwatches} màu · ${widthBtns} độ dày (phải là 0)`);
  if (sizeBtns !== 3) throw new Error("khu 4 của text phải có 3 nút cỡ chữ, có " + sizeBtns);
  if (textSwatches !== 7) throw new Error("khu 4 của text phải có 7 ô màu, có " + textSwatches);
  if (widthBtns !== 0) throw new Error("khu 4 của text KHÔNG được có nút độ dày nét");

  // Bấm lên bảng rồi Escape ngay, không gõ gì: không được đẻ ra phần tử rỗng.
  const inkCapture = document.querySelector(".ink-capture");
  const drawingsBeforeText = globalThis.__lastBoard ? globalThis.__lastBoard.drawings.length : null;
  const putsBeforeText = globalThis.__puts.length;
  await act(async () => { mouse("mousedown", 700, 400, inkCapture); await new Promise((r) => setTimeout(r, 30)); });
  if (!document.querySelector("textarea.text-input")) throw new Error("bấm bằng tool text phải mở ô nhập");
  // Ô nhập mở ra mà không giữ được tiêu điểm thì coi như không mở: người dùng
  // bấm xong gõ vào hư không. Trong trình duyệt thật, hành vi mặc định của
  // mousedown đẩy tiêu điểm về <body> và cướp mất nó ngay sau khi ô nhập gắn
  // vào cây — đó là lý do handleTextMouseDown phải gọi preventDefault. jsdom
  // không mô phỏng cú cướp đó nên chốt này chỉ bắt được ca "quên focus hẳn";
  // phần còn lại phải kiểm bằng tay trên trình duyệt.
  if (document.activeElement !== document.querySelector("textarea.text-input")) {
    throw new Error("ô nhập text phải đang giữ tiêu điểm ngay khi mở");
  }
  await act(async () => {
    document.querySelector("textarea.text-input").blur();
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`bấm rồi thoát, không gõ gì: PUT thêm ${globalThis.__puts.length - putsBeforeText} lần · ${document.querySelectorAll(".ink-layer text").length} text trên bảng`);
  if (globalThis.__puts.length !== putsBeforeText) throw new Error("không gõ gì mà vẫn lưu — sẽ đẻ ra phần tử text rỗng");
  if (document.querySelectorAll(".ink-layer text").length !== 0) throw new Error("không gõ gì mà vẫn ra text trên bảng");

  // Đang mở ô nhập mà bấm sang chỗ khác: ô nhập phải NHẢY sang chỗ mới, không
  // bắt bấm hai lần. Chưa gõ gì nên cũng không được lưu ra phần tử nào.
  await act(async () => { mouse("mousedown", 700, 400, inkCapture); await new Promise((r) => setTimeout(r, 30)); });
  const boxAt700 = document.querySelector("textarea.text-input").style.left;
  const putsBeforeJump = globalThis.__puts.length;
  await act(async () => { mouse("mousedown", 900, 560, inkCapture); await new Promise((r) => setTimeout(r, 30)); });
  const jumped = document.querySelector("textarea.text-input");
  log(`bấm sang chỗ khác lúc đang mở: ô nhập left ${boxAt700} → ${jumped?.style.left} · PUT thêm ${globalThis.__puts.length - putsBeforeJump} lần`);
  if (!jumped) throw new Error("bấm sang chỗ khác phải mở ô nhập ở chỗ mới, không phải đóng hẳn");
  if (jumped.style.left === boxAt700) throw new Error("ô nhập phải nhảy sang chỗ vừa bấm");
  if (globalThis.__puts.length !== putsBeforeJump) throw new Error("chưa gõ gì mà đã lưu — sẽ đẻ ra phần tử text rỗng");
  await act(async () => {
    jumped.blur();
    await new Promise((r) => setTimeout(r, 30));
  });
  if (document.querySelectorAll(".ink-layer text").length !== 0) throw new Error("nhảy chỗ không được để lại text rỗng nào");

  // Gõ thật, hai dòng, rồi Escape.
  await act(async () => { mouse("mousedown", 700, 400, inkCapture); await new Promise((r) => setTimeout(r, 30)); });
  const ta = document.querySelector("textarea.text-input");
  await act(async () => {
    // Đặt value qua setter gốc rồi phát `input`: React nghe onChange qua sự
    // kiện input, gán thẳng .value thì nó không hay biết gì.
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")
      .set.call(ta, "ghi chú\nhai dòng");
    ta.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  await act(async () => {
    ta.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.querySelector("textarea.text-input")?.blur();
    await new Promise((r) => setTimeout(r, 40));
  });
  const textEls = document.querySelectorAll(".ink-layer text");
  const savedText = globalThis.__puts.length ? globalThis.__puts[globalThis.__puts.length - 1] : null;
  const textDrawing = savedText && savedText.drawings.filter((d) => d.kind === "text");
  log(`gõ text hai dòng: ${textEls.length} <text> · ${textEls[0]?.querySelectorAll("tspan").length} tspan · lưu ${textDrawing?.length} phần tử kind=text · PUT thêm ${globalThis.__puts.length - putsBeforeText} lần`);
  if (textEls.length !== 1) throw new Error("phải có đúng 1 <text> trên bảng, có " + textEls.length);
  if (textEls[0].querySelectorAll("tspan").length !== 2) throw new Error("text hai dòng phải ra 2 tspan");
  if (!textDrawing || textDrawing.length !== 1) throw new Error("board phải có đúng 1 drawings kind=text");
  const td = textDrawing[0];
  if (td.pts.length !== 2) throw new Error("pts của text phải đúng 2 số (điểm neo), có " + td.pts.length);
  if (!(td.w > 0) || !(td.h > 0)) throw new Error("text phải lưu kèm hộp w/h cho hit-test");
  if (td.text !== "ghi chú\nhai dòng") throw new Error("nội dung text lưu sai: " + JSON.stringify(td.text));
  if (drawingsBeforeText != null && savedText.drawings.length !== drawingsBeforeText + 1) {
    throw new Error("phải thêm đúng 1 phần tử drawings");
  }

  // Một cú bấm lên text phục vụ hai việc, phân biệt bằng ngưỡng di chuyển.
  // Nhánh 1 — di quá ngưỡng: kéo đi, lưu đúng 1 lần, KHÔNG mở ô nhập.
  const posBefore = [...td.pts];
  const putsBeforeDrag = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 705, 405, inkCapture);
    mouse("mousemove", 760, 460);
    await new Promise((r) => setTimeout(r, 40));
    mouse("mousemove", 820, 520);
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { mouse("mouseup", 820, 520); await new Promise((r) => setTimeout(r, 40)); });
  const afterDrag = globalThis.__puts[globalThis.__puts.length - 1].drawings.find((d) => d.kind === "text");
  log(`kéo text: [${posBefore}] → [${afterDrag.pts}] · PUT thêm ${globalThis.__puts.length - putsBeforeDrag} lần · ô nhập mở = ${!!document.querySelector("textarea.text-input")}`);
  if (afterDrag.pts[0] === posBefore[0] && afterDrag.pts[1] === posBefore[1]) throw new Error("kéo text mà toạ độ không đổi");
  if (globalThis.__puts.length - putsBeforeDrag !== 1) throw new Error("một cú kéo text phải đúng 1 lần lưu, có " + (globalThis.__puts.length - putsBeforeDrag));
  if (document.querySelector("textarea.text-input")) throw new Error("kéo text không được mở ô nhập");

  // Nhánh 2 — bấm tại chỗ (di dưới ngưỡng): mở ô nhập mang sẵn nội dung cũ,
  // và KHÔNG lưu gì thêm.
  const putsBeforeReopen = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 825, 525, inkCapture);
    mouse("mousemove", 826, 526);
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => { mouse("mouseup", 826, 526); await new Promise((r) => setTimeout(r, 30)); });
  const reopened = document.querySelector("textarea.text-input");
  log(`bấm tại chỗ lên text: ô nhập mở = ${!!reopened} · nội dung = ${JSON.stringify(reopened?.value)} · PUT thêm ${globalThis.__puts.length - putsBeforeReopen} lần`);
  if (!reopened) throw new Error("bấm tại chỗ lên text phải mở ô nhập để sửa");
  if (reopened.value !== "ghi chú\nhai dòng") throw new Error("ô nhập phải mang sẵn nội dung cũ");
  if (globalThis.__puts.length !== putsBeforeReopen) throw new Error("mở ra sửa mà chưa đổi gì thì không được lưu");
  // Đóng lại mà không sửa gì: KHÔNG được lưu. Ghi lại một nội dung y hệt vừa
  // tốn một lượt PUT vừa đẻ ra một bước hoàn tác rỗng — Ctrl+Z mấy lần liền mà
  // màn hình không đổi gì.
  const putsBeforeNoopClose = globalThis.__puts.length;
  await act(async () => {
    reopened.blur();
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`đóng ô nhập mà không sửa gì: PUT thêm ${globalThis.__puts.length - putsBeforeNoopClose} lần`);
  if (globalThis.__puts.length !== putsBeforeNoopClose) throw new Error("đóng mà không sửa gì thì không được lưu");

  // Ca quan trọng nhất của việc "ô nhập nhảy chỗ": GÕ RỒI mới bấm sang chỗ khác.
  // Phải chốt cái cũ đúng MỘT lần rồi mở ô mới. Đây là chỗ mà thiếu chốt chống
  // chốt-hai-lần (textEditRef) sẽ đẻ ra hai phần tử text giống hệt nhau.
  const textsBeforeTypedJump = document.querySelectorAll(".ink-layer text").length;
  const putsBeforeTypedJump = globalThis.__puts.length;
  await act(async () => { mouse("mousedown", 1100, 650, inkCapture); await new Promise((r) => setTimeout(r, 30)); });
  const ta2 = document.querySelector("textarea.text-input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(ta2, "chú thích hai");
    ta2.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  await act(async () => { mouse("mousedown", 1250, 700, inkCapture); await new Promise((r) => setTimeout(r, 40)); });
  const stillOpen = document.querySelector("textarea.text-input");
  const afterTypedJump = globalThis.__puts[globalThis.__puts.length - 1].drawings.filter((d) => d.kind === "text");
  log(`gõ rồi bấm sang chỗ khác: lưu ${afterTypedJump.length} text · PUT thêm ${globalThis.__puts.length - putsBeforeTypedJump} lần · ô nhập mới mở = ${!!stillOpen} · nội dung = ${JSON.stringify(stillOpen?.value)}`);
  if (globalThis.__puts.length - putsBeforeTypedJump !== 1) {
    throw new Error("gõ rồi bấm sang chỗ khác phải lưu ĐÚNG 1 lần, có " + (globalThis.__puts.length - putsBeforeTypedJump));
  }
  if (afterTypedJump.length !== textsBeforeTypedJump + 1) {
    throw new Error(`phải thêm đúng 1 text, có ${afterTypedJump.length} (trước: ${textsBeforeTypedJump}) — dấu hiệu chốt hai lần`);
  }
  if (!stillOpen) throw new Error("chốt xong phải mở ngay ô nhập ở chỗ vừa bấm");
  if (stillOpen.value !== "") throw new Error("ô nhập mới phải rỗng, không mang chữ của cái vừa chốt");
  await act(async () => {
    stillOpen.blur();
    await new Promise((r) => setTimeout(r, 30));
  });

  // Skin vẽ tay: lưới an toàn cho việc đổi nét ở lớp dây. Bấm
  // đúng cái nút thật thay vì tự đặt data-skin — làm vậy mới đi qua useSkin (nạp
  // font lười, ghi localStorage) và mới bắt được lỗi ở đó.
  // Nút giờ là bảng Giao diện bung ra dưới nút của nó trên đảo trên trái — cùng
  // chỗ với ngôn ngữ, sáng/tối, nền bảng, bộ màu. Phải mở bảng đó ra trước.
  // Tìm theo title chứ không theo thứ tự: đảo trên trái có HAI .menubar-trigger
  // (☰ và Giao diện), lấy theo index thì thêm cái thứ ba là test trỏ nhầm.
  const edgesClean = document.querySelectorAll(".edge-layer .visible").length;
  const cleanPath = document.querySelector(".edge-layer .visible")?.getAttribute("d");
  const stylePanelBtn = Array.from(document.querySelectorAll(".island.tl .menubar-trigger"))
    .find((b) => b.title === "Giao diện");
  if (!stylePanelBtn) throw new Error("không tìm thấy nút Giao diện trên đảo trên trái");
  await act(async () => { stylePanelBtn.click(); await new Promise((r) => setTimeout(r, 20)); });

  // Hai nút rời (Sạch / Vẽ tay) chứ không còn một nút bật-tắt: phải tìm theo chữ.
  // Nút "Vẽ tay" mang cả icon lẫn chữ, nhưng <svg> không góp gì vào textContent.
  async function pickSkin(label) {
    const btn = Array.from(document.querySelectorAll(".menubar-dropdown.wide .btn"))
      .find((b) => b.textContent.trim() === label);
    if (!btn) throw new Error(`không tìm thấy nút "${label}" trong bảng Giao diện`);
    await act(async () => {
      btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 80));
    });
  }
  await pickSkin("Vẽ tay");
  const skinAttr = document.documentElement.getAttribute("data-skin");
  const edgePaths = document.querySelectorAll(".edge-layer path.visible").length;
  const edgeLines = document.querySelectorAll(".edge-layer line.visible").length;
  log(`skin vẽ tay: data-skin=${skinAttr} · ${edgePaths}/${edgesClean} dây path (còn ${edgeLines} line)`);
  if (skinAttr !== "sketch") throw new Error("bấm nút mà data-skin không thành sketch");
  if (edgePaths !== edgesClean) throw new Error(`mất dây khi đổi skin: ${edgesClean} → ${edgePaths}`);
  if (edgeLines !== 0) throw new Error("còn sót <line> hiển thị ở skin vẽ tay");
  const dAttr = document.querySelector(".edge-layer path.visible")?.getAttribute("d") || "";
  if (!/[CQ]/.test(dAttr) || dAttr === cleanPath) throw new Error("skin vẽ tay không tạo nét cong rung khác nét sạch");

  // Tắt đi phải về đúng trạng thái cũ — không phải đường một chiều.
  await pickSkin("Sạch");
  if (document.documentElement.getAttribute("data-skin") !== "clean") throw new Error("tắt skin không về clean");
  if (document.querySelectorAll(".edge-layer path.visible").length !== edgesClean) throw new Error("mất dây cong khi tắt skin");
  if (document.querySelector(".edge-layer .visible")?.getAttribute("d") !== cleanPath) throw new Error("tắt skin không khôi phục tuyến sạch ban đầu");

  // Panel Giao diện gom cả thiết lập của MÌNH lẫn dữ liệu của BOARD; hai nửa đó
  // phải có nhãn phân định, nếu không thì người ta đổi nền bảng mà tưởng chỉ mình
  // thấy. Kiểm luôn là ngôn ngữ và sáng/tối đã về đây, không còn nằm trong ☰.
  const styleRows = Array.from(document.querySelectorAll(".menubar-dropdown.wide .theme-row .fb-count"))
    .map((el) => el.textContent);
  const sections = Array.from(document.querySelectorAll(".menubar-dropdown.wide .theme-section"))
    .map((el) => el.textContent);
  log(`bảng Giao diện: ${styleRows.length} hàng (${styleRows.join(", ")}) · ${sections.length} nhãn phân định`);
  for (const want of ["Ngôn ngữ", "Sáng/tối", "Kiểu vẽ", "Nền bảng", "Lưới", "Bộ màu"]) {
    if (!styleRows.includes(want)) throw new Error(`bảng Giao diện thiếu hàng "${want}"`);
  }
  if (sections.length !== 2) throw new Error("bảng Giao diện phải có 2 nhãn phân định của-mình / của-board");

  // Ba trục preset của board. Kiểm hai thứ ở mỗi trục: nút có ĐỦ không (số nút =
  // số preset + 1 nút mặc định), và bấm vào thì vừa đổi thuộc tính trên <html>
  // vừa đi vào bản lưu — đổi được trên màn hình mà không lưu thì tải lại trang
  // là mất, một lỗi không ai thấy trong lúc thử tay.
  const swatchCount = document.querySelectorAll(".menubar-dropdown.wide .bg-swatch").length;
  const gridCount = document.querySelectorAll(".menubar-dropdown.wide .grid-swatch").length;
  const packCount = Array.from(document.querySelectorAll(".menubar-dropdown.wide .theme-row"))
    .find((r) => r.querySelector(".fb-count")?.textContent === "Bộ màu")
    ?.querySelectorAll(".btn").length || 0;
  log(`preset: ${swatchCount} nền · ${gridCount} lưới · ${packCount} bộ màu`);
  if (swatchCount !== BOARD_BGS.length + 1) throw new Error(`nút nền: ${swatchCount}, phải là ${BOARD_BGS.length + 1}`);
  if (gridCount !== BOARD_GRIDS.length + 1) throw new Error(`nút lưới: ${gridCount}, phải là ${BOARD_GRIDS.length + 1}`);
  if (packCount !== COLOR_PACKS.length + 1) throw new Error(`nút bộ màu: ${packCount}, phải là ${COLOR_PACKS.length + 1}`);

  async function clickPreset(sel, what) {
    const btn = document.querySelector(".menubar-dropdown.wide " + sel);
    if (!btn) throw new Error(`không tìm thấy nút ${what} (${sel})`);
    await act(async () => {
      btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
    });
  }
  const putsBeforePreset = globalThis.__puts.length;
  await clickPreset('.bg-swatch[data-bg="blueprint"]', "nền Bản vẽ");
  await clickPreset('.grid-swatch[data-grid="lines"]', "lưới ô");
  const packBtn = Array.from(document.querySelectorAll(".menubar-dropdown.wide .btn"))
    .find((b) => b.textContent.trim() === "Đất");
  if (!packBtn) throw new Error("không tìm thấy nút bộ màu Đất");
  await act(async () => {
    packBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  const htmlEl = document.documentElement;
  const savedPreset = globalThis.__puts[globalThis.__puts.length - 1];
  log(`chọn preset: data-bg=${htmlEl.getAttribute("data-bg")} data-grid=${htmlEl.getAttribute("data-grid")}`
    + ` data-pack=${htmlEl.getAttribute("data-pack")} · bản lưu {bg:${savedPreset.bg}, grid:${savedPreset.grid}, pack:${savedPreset.pack}}`
    + ` · PUT thêm ${globalThis.__puts.length - putsBeforePreset} lần`);
  if (htmlEl.getAttribute("data-bg") !== "blueprint") throw new Error("chọn nền mới mà data-bg không đổi");
  if (htmlEl.getAttribute("data-grid") !== "lines") throw new Error("chọn lưới ô mà data-grid không đổi");
  if (htmlEl.getAttribute("data-pack") !== "earth") throw new Error("chọn bộ màu Đất mà data-pack không đổi");
  if (savedPreset.bg !== "blueprint" || savedPreset.grid !== "lines" || savedPreset.pack !== "earth") {
    throw new Error("preset đổi trên màn hình nhưng không đi vào bản lưu");
  }
  if (globalThis.__puts.length - putsBeforePreset !== 3) throw new Error("ba cú chọn preset phải là đúng 3 lần lưu");

  // Về mặc định phải GỠ thuộc tính, không phải đặt data-grid="dots": CSS không
  // có khối nào cho "dots", đặt vào là lưới biến mất.
  await clickPreset('.grid-swatch[data-grid="dots"]', "lưới chấm (mặc định)");
  if (htmlEl.hasAttribute("data-grid")) throw new Error("về lưới chấm mà data-grid vẫn còn trên <html>");
  if (globalThis.__puts[globalThis.__puts.length - 1].grid !== null) throw new Error("về lưới chấm phải lưu grid = null");
  // Bấm hai lần vào hai nút KHÁC nhau trong bảng mà bảng vẫn mở: đây là lý do
  // TopMenu phải có closeOnClick tắt được. Menu hành động đóng sau một cú bấm là
  // đúng, bảng thiết lập thì bắt mở lại năm lần.
  if (!document.querySelector(".menubar-dropdown.wide")) throw new Error("bấm trong bảng Giao diện mà bảng tự đóng");
  await act(async () => { stylePanelBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  if (document.querySelector(".menubar-dropdown.wide")) throw new Error("bấm lại nút mà bảng Giao diện không đóng");

  // Giao diện KHÔNG được nằm trong nhóm lọc ở thanh đáy nữa — nó là thiết lập.
  const bottomTitles = Array.from(document.querySelectorAll(".hud-bottom .island-btn")).map((b) => b.title);
  if (bottomTitles.includes("Giao diện")) throw new Error("nút Giao diện vẫn còn trong nhóm lọc ở thanh đáy");
  if (!bottomTitles.some((x) => x.includes("yêu thích"))) throw new Error("★ phải nằm cùng nhóm lọc ở thanh đáy");

  // HUD đảo nổi. jsdom KHÔNG tính layout, nên không kiểm được "canvas cao bằng
  // cửa sổ" — thứ duy nhất kiểm được là cấu trúc: hai dải cũ đã rời khỏi cây, và
  // ba đảo có mặt. Đó cũng đúng là thứ hay hỏng khi sửa lại JSX sau này.
  if (document.querySelector(".topbar") || document.querySelector(".filterbar")) {
    throw new Error("dải .topbar/.filterbar vẫn còn trong cây — canvas không tràn viền");
  }
  for (const cls of [".island.tl", ".island.tr", ".island.bl", ".hud-bottom"]) {
    if (!document.querySelector(cls)) throw new Error("thiếu đảo " + cls);
  }
  // Kéo thả panel đã bỏ hẳn — không còn phần tử nào của cơ chế đó được sinh ra.
  for (const cls of [".dock-panel", ".dock-grip", ".dock-guide", ".island-dock"]) {
    if (document.querySelector(cls)) throw new Error("còn sót phần tử kéo-thả panel: " + cls);
  }

  // Đảo nội dung chỉ tồn tại khi có panel bật; tắt hết là nó biến mất khỏi cây,
  // không phải chỉ rỗng ruột. Panel sống đúng một chỗ, không neo không nổi.
  const panelBtn = (title) => Array.from(document.querySelectorAll(".hud-bottom .island-btn"))
    .find((b) => b.title === title);
  const dockOn = !!document.querySelector(".filter-dock");
  const titlesOn = Array.from(document.querySelectorAll(".filter-dock .filter-title"))
    .map((el) => el.textContent);
  for (const title of ["Trạng thái", "Nhãn"]) {
    const btn = panelBtn(title);
    if (!btn) throw new Error(`không tìm thấy nút bật panel "${title}" ở thanh đáy`);
    await act(async () => { btn.click(); await new Promise((r) => setTimeout(r, 20)); });
  }
  const dockOff = !!document.querySelector(".filter-dock");
  log(`thanh đáy: bật ${titlesOn.length} panel (${titlesOn.join(", ")}) · tắt hết → đảo nội dung ${dockOff ? "VẪN còn" : "biến mất"}`);
  if (!dockOn) throw new Error("mặc định có panel bật mà không thấy đảo nội dung");
  if (titlesOn.length !== 2) throw new Error("mỗi panel phải tự xưng tên, chờ 2 nhãn, có " + titlesOn.length);
  if (dockOff) throw new Error("tắt hết panel rồi mà đảo nội dung vẫn còn");
  // Bật lại một cái: đảo nội dung phải quay lại.
  await act(async () => { panelBtn("Nhãn").click(); await new Promise((r) => setTimeout(r, 20)); });
  if (!document.querySelector(".filter-dock")) throw new Error("bật lại panel mà đảo nội dung không quay lại");

  // Ô tìm kiếm thu gọn: đóng lại phải XOÁ từ khoá, nếu không thì còn một bộ lọc
  // vô hình đang làm mờ thẻ mà không còn chỗ nào nhìn ra vì sao.
  const searchBtn = Array.from(document.querySelectorAll(".island.tl .island-btn"))
    .find((b) => b.title.includes("Tìm kiếm"));
  if (!searchBtn) throw new Error("không tìm thấy nút tìm kiếm trên đảo to");
  await act(async () => { searchBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  const searchInput = document.querySelector(".island.tl .search-box input");
  if (!searchInput) throw new Error("bấm nút tìm kiếm mà không hiện ô nhập");
  if (document.activeElement !== searchInput) throw new Error("mở ô tìm mà con trỏ không vào ô");
  await act(async () => {
    // Cùng lý do với ô nhập text ở trên: gán thẳng .value thì React không hay biết.
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
      .set.call(searchInput, "thẻ");
    searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
  const hadTail = !!document.querySelector(".island.tl .fb-tail");
  await act(async () => { searchBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  const stillTail = !!document.querySelector(".island.tl .fb-tail");
  log(`ô tìm: gõ vào → đuôi lọc ${hadTail ? "hiện" : "KHÔNG hiện"} · đóng ô → ${stillTail ? "VẪN còn lọc" : "hết lọc"}`);
  if (!hadTail) throw new Error("gõ từ khoá mà đuôi lọc không hiện");
  if (document.querySelector(".island.tl .search-box")) throw new Error("bấm lần hai mà ô tìm không đóng");
  if (stillTail) throw new Error("đóng ô tìm mà từ khoá vẫn còn — bộ lọc vô hình");

  // ── Bút laser ──────────────────────────────────────────────────────────────
  // Điều đáng kiểm nhất ở đây KHÔNG phải là vệt có vẽ ra không, mà là vệt có
  // TỰ BIẾN MẤT không và có ghi gì vào board không. Một cây laser để lại vết
  // hoặc để lại một entry trong drawings thì nó đã thành cây bút.
  const laserBtn = Array.from(document.querySelectorAll(".tool-rail .tool-btn"))
    .find((b) => (b.title || "").startsWith("Laser"));
  if (!laserBtn) throw new Error("không tìm thấy nút Laser trên thanh công cụ");
  if (laserBtn.disabled) throw new Error("nút Laser bị khoá — laser không ghi gì vào board, người chỉ xem cũng phải dùng được");

  const putsBeforeLaser = globalThis.__puts.length;
  const drawingsBeforeLaser = document.querySelectorAll(".ink-layer path").length;
  await act(async () => { laserBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  const laserCapture = document.querySelector(".laser-capture");
  if (!laserCapture) throw new Error("bật Laser mà không có lớp bắt chuột .laser-capture");

  // Khu 4 của laser: bảy màu + ba độ đậm. KHÔNG có bảng hình và không có chế độ
  // tô — laser không tạo ra hình nào.
  const laserSwatches = document.querySelectorAll(".tool-options .pen-swatch").length;
  const laserWidths = document.querySelectorAll(".tool-options .pen-width").length;
  const fadeRange = document.querySelector(".tool-options .tool-range");
  log(`khu 4 của laser: ${laserSwatches} màu · ${laserWidths} độ đậm · thanh thời gian ${fadeRange ? fadeRange.value + "ms" : "KHÔNG CÓ"} · ${document.querySelectorAll(".tool-options .shape-pick").length} hình (phải là 0)`);
  if (laserSwatches !== 7) throw new Error("khu 4 của laser phải có 7 màu, có " + laserSwatches);
  if (laserWidths !== 3) throw new Error("khu 4 của laser phải có 3 độ đậm, có " + laserWidths);
  if (!fadeRange) throw new Error("khu 4 của laser phải có thanh trượt thời gian tan");
  if (Number(fadeRange.value) !== LASER_FADE_DEFAULT) throw new Error(`thanh thời gian mở ra ở ${fadeRange.value}, phải là mặc định ${LASER_FADE_DEFAULT}`);
  if (document.querySelector(".tool-options .shape-pick")) throw new Error("khu 4 của laser không được có bảng chọn hình");

  // DI CHUỘT KHÔNG GIỮ NÚT: không được ra vệt nào. Đây là bất biến chính của
  // nhóm này — đọc bảng bằng cách rê chuột qua không được để lại vết.
  await act(async () => {
    for (const x of [300, 340, 380]) mouse("mousemove", x, 200, laserCapture);
    await new Promise((r) => setTimeout(r, 40));
  });
  log(`laser: di chuột KHÔNG giữ nút → ${document.querySelectorAll(".laser-layer g").length} vệt (phải là 0)`);
  if (document.querySelector(".laser-layer g")) throw new Error("di chuột mà không giữ nút vẫn ra vệt — laser phải bấm mới sáng");
  if (globalThis.__emitted.some((e) => e[0] === "live:laser")) throw new Error("di chuột không giữ nút mà vẫn phát gói live:laser");

  // Đổi màu và độ đậm TRƯỚC khi chỉ, để kiểm luôn là lựa chọn có đi vào gói.
  //
  // HAI act() riêng, không gộp: cả hai handler đều là onPrefs({ ...prefs, … }) và
  // đều đóng gói `prefs` của CÙNG một lượt render, nên bấm liền hai cái trong
  // một act thì cú sau ghi đè cú trước — màu quay về mặc định mà vẫn khớp
  // assertion (mặc định cũng là một màu hợp lệ). Người dùng thật không gặp: giữa
  // hai cú bấm luôn có một lượt render.
  await act(async () => { document.querySelectorAll(".tool-options .pen-swatch")[4].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { document.querySelectorAll(".tool-options .pen-width")[2].click(); await new Promise((r) => setTimeout(r, 20)); });
  // Thanh thời gian: đặt NGẮN hơn mặc định. Cố ý ngắn — vệt của chính mình phải
  // tan xong trước mốc kiểm "đứng yên một nhịp là hết vệt" ở dưới, không thì
  // test đó bắt được vệt của chính nó và tưởng laser không tan.
  await act(async () => {
    setRangeValue(document.querySelector(".tool-options .tool-range"), 400);
    await new Promise((r) => setTimeout(r, 20));
  });
  const fadeLabel = document.querySelector(".tool-options .tool-range-val").textContent;
  log(`laser: kéo thanh thời gian về 400ms → nhãn "${fadeLabel}"`);
  if (Number(document.querySelector(".tool-options .tool-range").value) !== 400) {
    throw new Error("kéo thanh thời gian mà giá trị không đổi — onChange không nối vào prefs");
  }
  if (!fadeLabel.includes("0,4")) throw new Error(`nhãn phải đọc ra số giây, đang là "${fadeLabel}"`);
  const pickedColorOn = document.querySelectorAll(".tool-options .pen-swatch")[4].classList.contains("on");
  const pickedWidthOn = document.querySelectorAll(".tool-options .pen-width")[2].classList.contains("on");
  if (!pickedColorOn || !pickedWidthOn) throw new Error("chọn màu/độ đậm laser mà nút không sáng lên");

  // Giữ nút rồi rê: giờ mới ra vệt.
  await act(async () => {
    mouse("mousedown", 400, 300, laserCapture);
    for (const x of [440, 480, 520, 560]) mouse("mousemove", x, 300, laserCapture);
    await new Promise((r) => setTimeout(r, 60));
  });
  const selfTrail = document.querySelectorAll(".laser-layer g").length;
  const emittedLaser = globalThis.__emitted.filter((e) => e[0] === "live:laser");
  const sentPts = emittedLaser.reduce((n, e) => n + e[1].pts.length / 2, 0);
  log(`laser: giữ nút rồi rê → ${selfTrail} vệt · phát ${emittedLaser.length} gói mang ${sentPts} điểm · kiểu ${JSON.stringify({ color: emittedLaser[0][1].color, w: emittedLaser[0][1].w })}`);
  if (selfTrail !== 1) throw new Error("giữ nút rồi rê mà không ra vệt nào");
  if (!document.querySelector(".laser-layer .laser-core")) throw new Error("vệt không có lõi");
  if (!document.querySelector(".laser-layer .laser-head")) throw new Error("vệt không có chấm ở đầu con trỏ");
  if (!emittedLaser.length) throw new Error("không phát gói live:laser nào — người khác sẽ không thấy gì");
  // Hợp đồng của pushLaserPoint: chỉ điểm nào THẬT SỰ vào vệt mới được phát.
  // Lệch số là vệt hai bên tan theo hai nhịp khác nhau.
  if (sentPts !== 5) throw new Error(`phát ${sentPts} điểm nhưng chỉ có 5 điểm vào vệt — hai bên sẽ thấy vệt khác nhau`);
  // Gói ĐẦU phải mang cờ reset: thiếu nó thì bên kia nối lượt mới vào lượt cũ
  // và có một vạch thẳng băng qua bảng.
  if (emittedLaser[0][1].reset !== true) throw new Error("gói đầu của một lượt chỉ phải mang cờ reset");
  // Kiểu vệt đi kèm MỌI gói, không chỉ gói đầu — gói đầu đi đường .volatile nên
  // có thể rơi, và rơi nó thì cả lượt chỉ đó mất màu.
  if (emittedLaser.some((e) => !e[1].color || !e[1].w)) throw new Error("có gói live:laser không mang màu/độ đậm");
  if (emittedLaser.some((e) => e[1].color !== emittedLaser[0][1].color)) throw new Error("màu không nhất quán giữa các gói của cùng một lượt");
  // Và phải là ĐÚNG thứ vừa chọn, không phải mặc định. So với PEN_COLORS[4] /
  // LASER_WIDTHS[2] chứ không viết cứng token: đổi bảng màu là test đổi theo.
  if (emittedLaser[0][1].color !== PEN_COLORS[4]) throw new Error(`chọn màu ${PEN_COLORS[4]} nhưng gói mang ${emittedLaser[0][1].color}`);
  if (emittedLaser[0][1].w !== LASER_WIDTHS[2]) throw new Error(`chọn độ đậm ${LASER_WIDTHS[2]} nhưng gói mang ${emittedLaser[0][1].w}`);
  // Thời gian tan cũng phải đi theo MỌI gói, cùng lý do với màu và độ đậm: nó là
  // lựa chọn của NGƯỜI CHỈ, nên vệt của họ phải tan đúng nhịp đó trên màn hình
  // mọi người, không phải nhịp mặc định của từng máy.
  if (emittedLaser.some((e) => e[1].fade !== 400)) {
    throw new Error("có gói live:laser không mang đúng thời gian tan vừa đặt: " + JSON.stringify(emittedLaser.map((e) => e[1].fade)));
  }
  const selfColor = document.querySelector(".laser-layer g").style.color;
  if (!selfColor.includes(PEN_COLORS[4])) throw new Error(`vệt của mình vẽ màu ${selfColor}, không phải màu vừa chọn`);

  await act(async () => { mouse("mouseup", 560, 300, laserCapture); await new Promise((r) => setTimeout(r, 20)); });

  // Vệt của người khác: màu đi theo LỰA CHỌN của người chỉ, mang trong gói.
  globalThis.__deliver("presence:join", { socketId: "peer-1", email: "ban@example.com", name: "Bạn" });
  globalThis.__deliver("live:laser", {
    socketId: "peer-1", reset: true, color: "pen-green", w: 5, pts: [100, 700, 160, 700, 220, 700]
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  const colors = Array.from(document.querySelectorAll(".laser-layer g")).map((g) => g.style.color);
  log(`laser: thêm vệt của người khác → ${colors.length} vệt, màu ${JSON.stringify(colors)}`);
  if (colors.length !== 2) throw new Error("gói live:laser của người khác không dựng ra vệt");
  if (colors[0] === colors[1]) throw new Error("hai người chọn hai màu mà vệt vẽ ra cùng màu");

  // Gói mang token màu lạ phải bị lọc về mặc định, không được làm mất màu vệt.
  globalThis.__deliver("live:laser", {
    socketId: "peer-2", reset: true, color: "red; }", w: 999, pts: [900, 700, 960, 700]
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  const badColor = Array.from(document.querySelectorAll(".laser-layer g")).pop().style.color;
  log(`laser: gói mang màu/độ đậm lạ → vệt vẫn có màu ${JSON.stringify(badColor)}`);
  if (!badColor) throw new Error("gói mang token màu lạ làm vệt mất màu hẳn — sanitizeLaserStyle không chạy");

  // Đứng yên một nhịp là vệt phải tan HẾT. Đây là thứ tách laser khỏi bút, và
  // là thứ duy nhất ở đây cần thời gian thật trôi qua.
  await act(async () => { await new Promise((r) => setTimeout(r, LASER_FADE_DEFAULT + 300)); });
  const leftover = document.querySelectorAll(".laser-layer g").length;
  log(`laser: đứng yên ${LASER_FADE_DEFAULT + 300}ms → còn ${leftover} vệt`);
  if (leftover !== 0) throw new Error("vệt laser không tự tan — nó đang là nét vẽ chứ không phải cây laser");

  // Thời gian tan là của TỪNG VỆT: gói mang fade dài thì vệt đó phải còn sống ở
  // đúng cái mốc mà vệt mặc định đã tan hết. Không có chốt này thì một hằng số
  // dùng chung nằm lại đâu đó trong đường đi vẫn làm mọi test trên xanh.
  globalThis.__deliver("live:laser", {
    socketId: "peer-3", reset: true, color: "pen-blue", w: 8, fade: 3500, pts: [200, 900, 260, 900, 320, 900]
  });
  await act(async () => { await new Promise((r) => setTimeout(r, LASER_FADE_DEFAULT + 300)); });
  const longLived = document.querySelectorAll(".laser-layer g").length;
  log(`laser: vệt đặt 3500ms sau ${LASER_FADE_DEFAULT + 300}ms → còn ${longLived} vệt (phải là 1)`);
  if (longLived !== 1) throw new Error("vệt mang fade dài vẫn tan theo nhịp mặc định — fade không đi theo từng vệt");
  // Dọn ngay, không để một cái đuôi của người đã đi treo sang các phần test sau.
  await act(async () => {
    globalThis.__deliver("presence:leave", { socketId: "peer-3" });
    await new Promise((r) => setTimeout(r, 40));
  });
  if (document.querySelector(".laser-layer g")) throw new Error("người rời board mà vệt của họ vẫn treo lại");

  // Và không để lại dấu vết nào trong dữ liệu.
  const drawingsAfterLaser = document.querySelectorAll(".ink-layer path").length;
  if (drawingsAfterLaser !== drawingsBeforeLaser) throw new Error("laser thêm nét vào .ink-layer — nó phải không ghi gì vào board");
  if (globalThis.__puts.length !== putsBeforeLaser) throw new Error("laser gây ra một lần lưu board");

  // Bấm lại nút là tắt, về mode Chuột — laser là thứ bật trong dăm câu nói rồi tắt.
  await act(async () => { laserBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  if (document.querySelector(".laser-capture")) throw new Error("bấm lại nút Laser mà lớp bắt chuột vẫn còn");

  // ── Bảng Xếp cây ────────────────────────────────────────────────────────
  // Thứ chỉ dựng cả component lên mới thấy: kéo thanh trượt phải tính lại từ
  // board TRƯỚC khi mở bảng (không chồng lên kết quả lần trước), và cả phiên
  // chỉnh chỉ được đúng một mốc hoàn tác dù kéo bao nhiêu nấc.
  const treeCard = document.querySelector('.idea-card[data-id="1"]');
  await act(async () => {
    treeCard.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 200 }));
    await new Promise((r) => setTimeout(r, 20));
  });
  const openBtn = Array.from(document.querySelectorAll(".ctx-menu .cm-item"))
    .find((b) => b.textContent.includes("Tuỳ chỉnh cây"));
  if (!openBtn) throw new Error("menu chuột phải không có lối mở bảng Xếp cây");

  const putsBeforeTree = globalThis.__puts.length;
  await act(async () => { openBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  const panel = document.querySelector(".tree-panel");
  if (!panel) throw new Error("bấm 'Tuỳ chỉnh cây…' mà bảng bên phải không hiện");
  if (panel.querySelectorAll('input[type="range"]').length !== 2) throw new Error("bảng cây phải có hai khoảng cách");
  const posAfterOpen = () => Array.from(document.querySelectorAll(".idea-card"))
    .map((c) => c.dataset.id + ":" + c.style.left + "," + c.style.top).join(" | ");
  const openedLayout = posAfterOpen();
  log(`mở bảng cây: ${openedLayout}`);

  // Cây mọc xuống: thẻ 2 (con) và thẻ 3 (cháu) phải nằm dưới gốc, thẳng một cột.
  const topOf = (id) => parseFloat(document.querySelector(`.idea-card[data-id="${id}"]`).style.top);
  const leftOf = (id) => parseFloat(document.querySelector(`.idea-card[data-id="${id}"]`).style.left);
  if (!(topOf(2) > topOf(1) && topOf(3) > topOf(2))) throw new Error("hướng xuống mà con không nằm dưới cha");
  if (leftOf(2) !== leftOf(1) || leftOf(3) !== leftOf(1)) throw new Error("nhánh một con phải thẳng cột dưới cha");

  // Hướng đang bật một mình là nút không tắt được: bỏ nốt thì cây hết chỗ mọc.
  const dirBtns = panel.querySelectorAll(".tp-dir");
  if (dirBtns.length !== 4) throw new Error("bảng phải có đúng 4 nút hướng");
  await act(async () => { dirBtns[0].click(); await new Promise((r) => setTimeout(r, 20)); });
  if (panel.querySelectorAll(".tp-dir.on").length !== 1) throw new Error("tắt được hướng cuối cùng — cây không còn chỗ nào để mọc");

  // Bật thêm "lên" rồi tắt "xuống" → cây lật ngược lên trên. (Gốc ở đây chỉ có
  // MỘT nhánh nên chọn hai hướng không tách được: nhánh độc nhất theo hướng đầu.)
  await act(async () => { dirBtns[1].click(); await new Promise((r) => setTimeout(r, 20)); });
  if (panel.querySelectorAll(".tp-dir.on").length !== 2) throw new Error("bật hướng thứ hai mà chỉ một nút sáng");
  await act(async () => { dirBtns[0].click(); await new Promise((r) => setTimeout(r, 20)); });
  if (!(topOf(2) < topOf(1) && topOf(3) < topOf(2))) throw new Error("chỉ còn hướng lên mà cây vẫn mọc xuống");
  log(`chỉ hướng lên: thẻ 1 top=${topOf(1)} · thẻ 2 top=${topOf(2)} · thẻ 3 top=${topOf(3)}`);

  // Về lại đúng "chỉ hướng xuống" rồi kéo thanh "giữa các cấp": khoảng cách tầng
  // phải giãn ra, và vì tính lại từ board gốc nên gốc vẫn đứng nguyên chỗ cũ.
  await act(async () => { dirBtns[0].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { dirBtns[1].click(); await new Promise((r) => setTimeout(r, 20)); });
  if (posAfterOpen() !== openedLayout) throw new Error("về lại đúng một hướng xuống mà bố cục không như lúc mở bảng");
  const rootTop = topOf(1), gapBefore = topOf(2) - topOf(1);
  const putsBeforeTreeDrag = globalThis.__puts.length;
  const depthSlider = panel.querySelectorAll('input[type="range"]')[0];
  const setRange = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(value));
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  await act(async () => { setRange(depthSlider, 300); await new Promise((r) => setTimeout(r, 20)); });
  const gapAfter = topOf(2) - topOf(1);
  log(`kéo 'giữa các cấp' → khoảng cách tầng ${gapBefore} → ${gapAfter}`);
  if (!(gapAfter > gapBefore)) throw new Error("kéo thanh trượt mà khoảng cách tầng không giãn ra");
  if (topOf(1) !== rootTop) throw new Error("gốc phải đứng yên khi chỉnh khoảng cách");

  // Kéo tiếp một nấc nữa rồi trả về đúng trị cũ: phải ra lại y hệt bố cục lúc
  // mở bảng. Nếu mỗi lần kéo lại chồng lên kết quả lần trước thì cây đã trôi đi.
  await act(async () => { setRange(depthSlider, 400); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { setRange(depthSlider, 110); await new Promise((r) => setTimeout(r, 20)); });
  if (posAfterOpen() !== openedLayout) throw new Error("kéo qua kéo lại về đúng trị cũ mà bố cục không về như cũ — cây bị trôi");

  // Ba nấc kéo vừa rồi KHÔNG được lưu lần nào; nhả tay mới lưu đúng một lần.
  log(`ba nấc kéo thanh trượt: PUT thêm ${globalThis.__puts.length - putsBeforeTreeDrag} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeTreeDrag) throw new Error("kéo thanh trượt đang lưu từng nấc");
  await act(async () => {
    depthSlider.dispatchEvent(new window.PointerEvent("pointerup", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
  if (globalThis.__puts.length - putsBeforeTreeDrag !== 1) throw new Error("nhả tay khỏi thanh trượt mà không lưu");

  // Bấm ra ngoài là đóng (nút × cũng gọi đúng lối này), rồi Ctrl+Z: cả phiên
  // chỉnh phải lùi về một phát.
  await act(async () => {
    document.querySelector(".viewport").dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true, clientX: 900, clientY: 400, button: 0 })
    );
    await new Promise((r) => setTimeout(r, 20));
  });
  if (document.querySelector(".tree-panel")) throw new Error("bấm ra ngoài mà bảng cây vẫn còn");
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
  if (posAfterOpen() === openedLayout) throw new Error("Ctrl+Z sau khi xếp cây không lùi được");
  log(`Ctrl+Z sau khi đóng bảng: ${posAfterOpen()}`);


  // ── Chọn nét vẽ / hình / chữ ở mode Chuột ───────────────────────────────
  // Lớp vẽ là một <svg> pointer-events: none, nên MỌI thao tác ở đây đi qua
  // hit-test hình học trên toạ độ canvas. Thứ không có test hàm thuần nào bắt
  // được: cú bấm có tới đúng nét không, và nó có bị vùng quét nuốt mất không.
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 20)); });
  const pickCapture = document.querySelector(".ink-capture");
  await act(async () => {
    mouse("mousedown", 1000, 200, pickCapture);
    mouse("mousemove", 1100, 200);
    mouse("mousemove", 1200, 200);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1200, 200); await new Promise((r) => setTimeout(r, 40)); });
  const savedDrawings = globalThis.__puts[globalThis.__puts.length - 1].drawings;
  const drawnId = savedDrawings[savedDrawings.length - 1].id;
  await act(async () => { railBtn("Chuột").click(); await new Promise((r) => setTimeout(r, 20)); });

  const canvasEl = document.querySelector(".viewport");
  const inkSelCount = () => document.querySelectorAll(".ink-layer .ink-selected").length;
  const inkNow = () => {
    const put = globalThis.__puts[globalThis.__puts.length - 1];
    return put.drawings.find((d) => d.id === drawnId);
  };
  // Dọn sạch lựa chọn còn sót từ các mục trước (cú bấm đóng bảng cây ở trên rơi
  // đúng vào một hình đã vẽ, nên nó đang được chọn — đúng như thiết kế).
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
  if (inkSelCount() !== 0) throw new Error("Esc mà nét vẫn còn được chọn");

  // Bấm trúng thân nét → chọn nó; bấm chỗ trống → bỏ chọn.
  await act(async () => { mouse("mousedown", 1100, 200, canvasEl); mouse("mouseup", 1100, 200); await new Promise((r) => setTimeout(r, 20)); });
  log(`bấm trúng nét: ${inkSelCount()} nét đang chọn`);
  if (inkSelCount() !== 1) throw new Error("bấm trúng nét vẽ mà không chọn được nó");
  await act(async () => { mouse("mousedown", 1100, 800, canvasEl); mouse("mouseup", 1100, 800); await new Promise((r) => setTimeout(r, 20)); });
  if (inkSelCount() !== 0) throw new Error("bấm chỗ trống mà nét vẫn còn được chọn");

  // Kéo nét đi: đúng một lần lưu, và toạ độ dịch đúng lượng đã kéo.
  const beforeMove = inkNow().pts.slice();
  const putsBeforeMove = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 1100, 200, canvasEl);
    mouse("mousemove", 1130, 260);
    mouse("mousemove", 1160, 320);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1160, 320); await new Promise((r) => setTimeout(r, 40)); });
  const afterMove = inkNow().pts;
  log(`kéo nét: ${beforeMove.slice(0, 2)} → ${afterMove.slice(0, 2)} · PUT thêm ${globalThis.__puts.length - putsBeforeMove} lần`);
  if (afterMove[0] - beforeMove[0] !== 60 || afterMove[1] - beforeMove[1] !== 120) {
    throw new Error("nét không dịch đúng lượng đã kéo");
  }
  if (globalThis.__puts.length - putsBeforeMove !== 1) throw new Error("một cú kéo nét phải đúng 1 lần lưu");

  // Thả một màu của Bảng màu vào nét: nét nhận đúng token màu bảng.
  const palBtn = Array.from(document.querySelectorAll(".hud-bottom .island-btn"))
    .find((b) => (b.title || "").includes("Bảng màu"));
  await act(async () => { palBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  const palSwatch = document.querySelector(".filter-panel .pal-swatch");
  if (!palSwatch) throw new Error("không tìm thấy ô màu nào trong panel Bảng màu");
  await act(async () => {
    palSwatch.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 300, clientY: 900, button: 0 }));
    mouse("mousemove", 1160, 320);
    await new Promise((r) => setTimeout(r, 40));
    mouse("mouseup", 1160, 320);
    await new Promise((r) => setTimeout(r, 40));
  });
  log(`thả màu vào nét: color = ${inkNow().color}`);
  if (inkNow().color === "pen-red") throw new Error("thả màu vào nét mà màu không đổi");

  // Vùng chọn hỗn hợp: quét trúng cả thẻ lẫn nét rồi kéo cái THẺ — nét phải đi
  // theo. Đây là chỗ dễ sai nhất: hai loại vật thể, hai đường kéo khác nhau.
  const mixCard = document.querySelector('.idea-card[data-id="1"]');
  const cardX = parseFloat(mixCard.style.left), cardY = parseFloat(mixCard.style.top);
  // Quét từ dưới-phải nét vẽ (nó đang ở ~1060..1260 × 320) ngược lên tới thẻ 1.
  await act(async () => {
    mouse("mousedown", 1400, 500, canvasEl);
    mouse("mousemove", 1000, 300);
    mouse("mousemove", cardX + 5, cardY + 5);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mouseup", cardX + 5, cardY + 5);
    await new Promise((r) => setTimeout(r, 30));
  });
  if (inkSelCount() < 1) throw new Error("quét vùng không dính nét vẽ nào");
  if (!document.querySelector('.idea-card[data-id="1"].selected')) throw new Error("quét vùng không dính thẻ 1");
  const inkBeforeMix = inkNow().pts.slice();
  await act(async () => {
    mouse("mousedown", cardX + 10, cardY + 10, mixCard);
    mouse("mousemove", cardX + 60, cardY + 10);
    mouse("mousemove", cardX + 110, cardY + 10);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", cardX + 110, cardY + 10); await new Promise((r) => setTimeout(r, 40)); });
  const inkAfterMix = inkNow().pts;
  log(`kéo thẻ trong vùng chọn hỗn hợp: thẻ ${cardX} → ${document.querySelector('.idea-card[data-id="1"]').style.left} · nét ${inkBeforeMix[0]} → ${inkAfterMix[0]} · chọn ${inkSelCount()} nét`);
  if (inkAfterMix[0] - inkBeforeMix[0] !== 100) throw new Error("kéo thẻ mà nét vẽ cùng vùng chọn không đi theo");
  if (inkAfterMix[1] !== inkBeforeMix[1]) throw new Error("nét vẽ dịch cả theo trục không hề kéo");

  // Delete xoá nét đang chọn. Bấm lại đúng vào thân nét ở chỗ mới của nó — toạ
  // độ đọc từ dữ liệu, không viết cứng, vì nó vừa bị dời hai lần.
  const inkAt = inkNow().pts;
  // Bỏ chọn cả cụm trước: bấm vào một nét ĐANG nằm trong vùng chọn thì cả cụm
  // giữ nguyên (đúng thiết kế), mà ở đây cần đúng một nét để kiểm Delete.
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    mouse("mousedown", inkAt[0] + 20, inkAt[1], canvasEl);
    mouse("mouseup", inkAt[0] + 20, inkAt[1]);
    await new Promise((r) => setTimeout(r, 20));
  });
  log(`bấm lại vào nét ở (${inkAt[0] + 20}, ${inkAt[1]}): ${inkSelCount()} nét đang chọn`);
  if (inkSelCount() !== 1) throw new Error("không chọn lại được nét sau khi dời và đổi màu");
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  if (inkNow()) throw new Error("bấm Delete mà nét đang chọn vẫn còn");
  log("Delete: nét đang chọn đã bị xoá");

  // Quét một vùng chỉ có nét vẽ (không thẻ, không khung) rồi Backspace. Đây là
  // đúng cái bẫy closure cũ: chọn riêng nét vẽ thì selectedIds/selectedGroupIds
  // không đổi, effect gắn phím tắt không chạy lại, và handler cũ đọc phải một
  // vùng chọn rỗng — bấm Backspace không xoá gì.
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
  // Hai nét mới ở một góc trống, để chắc chắn vùng này không dính thẻ nào.
  const inkCountNow = () => globalThis.__puts[globalThis.__puts.length - 1].drawings.length;
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 20)); });
  const twoCapture = document.querySelector(".ink-capture");
  for (const y of [1500, 1600]) {
    await act(async () => {
      mouse("mousedown", 1500, y, twoCapture);
      mouse("mousemove", 1600, y);
      mouse("mousemove", 1700, y);
      await new Promise((r) => setTimeout(r, 60));
    });
    await act(async () => { mouse("mouseup", 1700, y); await new Promise((r) => setTimeout(r, 40)); });
  }
  await act(async () => { railBtn("Chuột").click(); await new Promise((r) => setTimeout(r, 20)); });
  const inkBeforeSweep = inkCountNow();

  // Bấm nét thứ nhất, rồi Ctrl+bấm nét thứ hai: cú Ctrl+bấm CHỈ đổi tập nét,
  // không đụng tới thẻ/khung — nên nếu effect phím tắt không theo dõi tập nét,
  // handler sẽ còn giữ vùng chọn của lượt trước và xoá thiếu một nét.
  await act(async () => { mouse("mousedown", 1600, 1500, canvasEl); mouse("mouseup", 1600, 1500); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    canvasEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 1600, clientY: 1600, button: 0, ctrlKey: true }));
    window.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true, clientX: 1600, clientY: 1600, button: 0, ctrlKey: true }));
    await new Promise((r) => setTimeout(r, 20));
  });
  const sweptInk = inkSelCount();
  log(`bấm + Ctrl+bấm hai nét: ${sweptInk} nét đang chọn`);
  if (sweptInk !== 2) throw new Error("Ctrl+bấm không cộng dồn được nét thứ hai");
  if (document.querySelector(".idea-card.selected")) throw new Error("không được dính thẻ nào ở bước này");
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  log(`Backspace với 2 nét đang chọn: còn ${inkCountNow()}/${inkBeforeSweep} nét`);
  if (inkCountNow() !== inkBeforeSweep - 2) throw new Error("Backspace không xoá hết nét đang chọn");
  if (inkSelCount() !== 0) throw new Error("xoá xong mà viền chọn vẫn còn");

  // ── Dây nối: trái để chọn, phải để sửa ──────────────────────────────────
  const edgeHit = document.querySelector(".edge-layer .hit");
  if (!edgeHit) throw new Error("không thấy vùng bấm của dây nối");
  const edgeId = edgeHit.getAttribute("data-edge-id");
  await act(async () => {
    edgeHit.dispatchEvent(new window.MouseEvent("click", { bubbles: true, clientX: 400, clientY: 400, button: 0 }));
    await new Promise((r) => setTimeout(r, 20));
  });
  const selectedEdges = () => document.querySelectorAll(".edge-layer .visible.selected").length;
  log(`chuột trái lên dây ${edgeId}: ${selectedEdges()} dây đang chọn · menu mở = ${!!document.querySelector(".edge-menu")}`);
  if (document.querySelector(".edge-menu")) throw new Error("chuột trái lên dây không được mở menu sửa");
  if (selectedEdges() !== 1) throw new Error("chuột trái lên dây phải chọn đúng dây đó");

  // Ctrl+trái cộng dồn dây thứ hai.
  const edgeHits = document.querySelectorAll(".edge-layer .hit");
  if (edgeHits.length > 1) {
    await act(async () => {
      edgeHits[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true, clientX: 420, clientY: 420, button: 0, ctrlKey: true }));
      await new Promise((r) => setTimeout(r, 20));
    });
    log(`Ctrl+trái lên dây thứ hai: ${selectedEdges()} dây đang chọn`);
    if (selectedEdges() !== 2) throw new Error("Ctrl+trái không cộng dồn được dây thứ hai");
  }

  // Chuột phải mới mở menu sửa dây (nhãn, kiểu nét, hướng, màu).
  await act(async () => {
    edgeHit.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, clientX: 400, clientY: 400, button: 2 }));
    await new Promise((r) => setTimeout(r, 20));
  });
  const edgeMenuEl = document.querySelector(".edge-menu");
  log(`chuột phải lên dây: menu mở = ${!!edgeMenuEl}`);
  if (!edgeMenuEl) throw new Error("chuột phải lên dây phải mở menu sửa");
  const labelInput = edgeMenuEl.querySelector("input.be-name");
  if (!labelInput) throw new Error("menu dây phải có ô nhập nhãn");

  // Gõ nhãn + Enter: chữ phải hiện lên giữa dây.
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(labelInput, "phụ thuộc");
    labelInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    labelInput.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  const labelEl = Array.from(document.querySelectorAll(".edge-layer .edge-label"))
    .find((el) => el.textContent === "phụ thuộc");
  log(`nhãn dây: ${labelEl ? labelEl.textContent : "(không thấy)"}`);
  if (!labelEl) throw new Error("gõ nhãn cho dây mà chữ không hiện lên trên bản đồ");
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
  });

  // ── Bản đồ thu nhỏ ──────────────────────────────────────────────────────
  // Thứ chỉ dựng cả app lên mới thấy: ô "đang xem ở đây" có bám theo camera
  // không, và bấm vào bản đồ có dời camera mà KHÔNG đổi mức phóng, KHÔNG lưu
  // board (camera là của riêng từng người) không.
  const mini = document.querySelector(".minimap");
  if (!mini) throw new Error("không thấy bản đồ thu nhỏ ở góc dưới phải");
  const viewBox = () => {
    const r = mini.querySelector(".mini-view");
    return { x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width") };
  };
  if (!mini.querySelectorAll(".mini-node").length) throw new Error("bản đồ thu nhỏ không vẽ thẻ nào");
  const zoomPct = () => document.querySelector(".zoom-ctrl .pct").textContent;
  const beforeGo = viewBox();
  const pctBefore = zoomPct();
  const putsBeforeMini = globalThis.__puts.length;

  const miniSvg = mini.querySelector("svg");
  await act(async () => {
    miniSvg.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 20, clientY: 20, button: 0 }));
    window.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true, clientX: 20, clientY: 20, button: 0 }));
    await new Promise((r) => setTimeout(r, 30));
  });
  const afterGo = viewBox();
  log(`bấm minimap: ô khung nhìn ${beforeGo.x.toFixed(1)},${beforeGo.y.toFixed(1)} → ${afterGo.x.toFixed(1)},${afterGo.y.toFixed(1)} · zoom ${pctBefore} → ${zoomPct()}`);
  if (Math.abs(afterGo.x - beforeGo.x) < 0.5 && Math.abs(afterGo.y - beforeGo.y) < 0.5) {
    throw new Error("bấm vào minimap mà khung nhìn không dời");
  }
  if (zoomPct() !== pctBefore) throw new Error("bấm minimap không được đổi mức phóng");
  if (globalThis.__puts.length !== putsBeforeMini) throw new Error("lia camera không được lưu board");

  // Lia bảng bằng chuột thì ô khung nhìn trên minimap phải chạy theo.
  const beforePan = viewBox();
  await act(async () => {
    canvasEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 600, clientY: 400, button: 2 }));
    mouse("mousemove", 900, 550);
    await new Promise((r) => setTimeout(r, 40));
    mouse("mouseup", 900, 550);
    await new Promise((r) => setTimeout(r, 30));
  });
  const afterPan = viewBox();
  log(`lia bảng: ô khung nhìn ${beforePan.x.toFixed(1)} → ${afterPan.x.toFixed(1)}`);
  if (Math.abs(afterPan.x - beforePan.x) < 0.5 && Math.abs(afterPan.y - beforePan.y) < 0.5) {
    throw new Error("lia bảng mà ô khung nhìn trên minimap không nhúc nhích");
  }

  // Nút trong cụm zoom bật/tắt được, và × trên bản đồ cũng tắt được.
  const miniToggle = Array.from(document.querySelectorAll(".zoom-ctrl button"))
    .find((b) => (b.title || "").includes("bản đồ thu nhỏ"));
  if (!miniToggle) throw new Error("cụm zoom không có nút bật/tắt bản đồ thu nhỏ");
  await act(async () => { miniToggle.click(); await new Promise((r) => setTimeout(r, 20)); });
  if (document.querySelector(".minimap")) throw new Error("bấm nút mà bản đồ thu nhỏ vẫn còn");
  await act(async () => { miniToggle.click(); await new Promise((r) => setTimeout(r, 20)); });
  if (!document.querySelector(".minimap")) throw new Error("bấm lại mà bản đồ thu nhỏ không hiện lại");
  await act(async () => { document.querySelector(".minimap .mini-close").click(); await new Promise((r) => setTimeout(r, 20)); });
  if (document.querySelector(".minimap")) throw new Error("bấm × mà bản đồ thu nhỏ vẫn còn");
  log("minimap: nút zoom và nút × đều bật/tắt được");

  // ── Ghim màn hình người khác ────────────────────────────────────────────
  const camera = () => {
    const s = document.querySelector(".canvas").style.transform;
    const m = s.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)/);
    if (!m) throw new Error("không đọc được transform của .canvas: " + s);
    return { panX: +m[1], panY: +m[2], scale: +m[3] };
  };

  // Chưa ai ghim ai: KHÔNG được phát một gói view:update nào. Đây là điểm mấu
  // chốt của thiết kế — cả buổi không ai dùng ghim thì kênh này phải câm.
  if (globalThis.__emitted.some((e) => e[0] === "view:update")) {
    throw new Error("chưa ai ghim mà đã phát view:update — kênh camera không được mặc định bật");
  }

  await act(async () => {
    globalThis.__deliver("presence:join", { socketId: "peer-f", email: "sep@example.com", name: "Sếp" });
    await new Promise((r) => setTimeout(r, 20));
  });

  // Chọn ĐÚNG avatar của "Sếp": phần laser ở trên đã cho peer-1 và peer-2 vào
  // phòng, nên avatar đầu hàng không phải người mình muốn ghim.
  const peerAvatar = Array.from(document.querySelectorAll(".presence-peer .presence-avatar"))
    .find((a) => a.title === "Sếp");
  if (!peerAvatar) throw new Error("người mới vào không hiện avatar trong PresenceBar");
  await act(async () => { peerAvatar.click(); await new Promise((r) => setTimeout(r, 20)); });
  const pinBtn = Array.from(document.querySelectorAll(".peer-menu .btn"))
    .find((b) => (b.textContent || "").includes("Ghim màn hình"));
  if (!pinBtn) throw new Error("menu của peer không có nút Ghim màn hình");
  await act(async () => { pinBtn.click(); await new Promise((r) => setTimeout(r, 20)); });

  const followEmits = globalThis.__emitted.filter((e) => e[0] === "follow:update");
  if (followEmits.length !== 1 || followEmits[0][1].targetId !== "peer-f") {
    throw new Error("bấm Ghim không gửi follow:update đúng mục tiêu: " + JSON.stringify(followEmits));
  }

  // Chưa có xác nhận của server: được phép hiện "đang chờ", nhưng TUYỆT ĐỐI
  // không được hiện như đã ghim xong. Đây đúng là ca đã lọt lần trước — server
  // chạy code cũ, không hồi âm, mà giao diện vẫn lên viền đặc như thật.
  const pendingFrame = document.querySelector(".follow-frame");
  if (!pendingFrame) throw new Error("bấm Ghim mà không có dấu hiệu nào là đang chờ");
  if (!pendingFrame.classList.contains("pending")) {
    throw new Error("server chưa xác nhận mà đã hiện như ghim xong — giao diện đang nói dối");
  }

  // Server ừ → giờ mới là ghim thật. Gói xác nhận và gói view ĐẦU TIÊN về sát
  // nhau trong đời thật (server báo cho người kia là có khán giả ngay khi nhận
  // cú ghim, họ trả lời tức thì), nên thả cả hai trong CÙNG một nhịp: đúng cuộc
  // đua đã làm cú nhảy đầu tiên bị nuốt mất.
  const camAtPin = camera();
  await act(async () => {
    globalThis.__deliver("follow:update", { socketId: "self-socket", followingId: "peer-f" });
    globalThis.__deliver("view:update", {
      socketId: "peer-f",
      view: { panX: -900, panY: -700, scale: 1, w: window.innerWidth, h: window.innerHeight }
    });
    await new Promise((r) => setTimeout(r, 250));
  });
  const liveFrame = document.querySelector(".follow-frame");
  if (!liveFrame || liveFrame.classList.contains("pending")) {
    throw new Error("server đã xác nhận mà viền vẫn ở trạng thái chờ");
  }
  const camAfterPin = camera();
  log(`ghim: gói view đầu về cùng nhịp với xác nhận → camera ${camAtPin.panX.toFixed(0)},${camAtPin.panY.toFixed(0)} → ${camAfterPin.panX.toFixed(0)},${camAfterPin.panY.toFixed(0)}`);
  // Cùng cỡ màn hình nên phải nhảy tới ĐÚNG khung nhìn của họ, ngay lập tức,
  // không cần họ lia thêm cú nào nữa.
  if (Math.abs(camAfterPin.panX + 900) > 1 || Math.abs(camAfterPin.panY + 700) > 1) {
    throw new Error(`bấm ghim mà không nhảy ngay tới màn hình người kia: đang ở ${camAfterPin.panX},${camAfterPin.panY}, phải là -900,-700`);
  }

  // Camera của người kia về → màn hình mình phải chạy theo. Người kia có màn
  // hình RỘNG GẤP ĐÔI, nên mình phải THU NHỎ lại để thấy trọn vùng họ thấy,
  // chứ không phải copy nguyên scale của họ.
  const camBefore = camera();
  await act(async () => {
    globalThis.__deliver("view:update", {
      socketId: "peer-f",
      view: { panX: -2400, panY: -1600, scale: 1, w: window.innerWidth * 2, h: window.innerHeight * 2 }
    });
    await new Promise((r) => setTimeout(r, 400));
  });
  const camAfter = camera();
  log(`ghim: camera ${camBefore.panX.toFixed(0)},${camBefore.panY.toFixed(0)}@${camBefore.scale.toFixed(2)} → ${camAfter.panX.toFixed(0)},${camAfter.panY.toFixed(0)}@${camAfter.scale.toFixed(2)}`);
  if (Math.abs(camAfter.panX - camBefore.panX) < 1 && Math.abs(camAfter.panY - camBefore.panY) < 1) {
    throw new Error("nhận view của người bị ghim mà camera mình không nhúc nhích");
  }
  if (camAfter.scale >= 0.9) {
    throw new Error(`màn hình họ rộng gấp đôi thì mình phải thu nhỏ còn ~0.5, đang là ${camAfter.scale}`);
  }

  // Người kia đứng yên thì camera mình cũng phải ĐỨNG HẲN, không rung tiệm cận.
  const settled1 = camera();
  await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
  const settled2 = camera();
  if (settled1.panX !== settled2.panX || settled1.scale !== settled2.scale) {
    throw new Error("người kia đứng yên mà camera mình vẫn còn bò — vòng bám không dừng");
  }

  // Tự lăn chuột = tự lái camera → phải TỰ BỎ GHIM. Không có chốt này thì cú
  // cuộn đầu tiên bị vòng bám kéo ngược lại, trông y như app treo.
  const emittedBeforeUnfollow = globalThis.__emitted.length;
  await act(async () => {
    canvasEl.dispatchEvent(new window.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -240, clientX: 500, clientY: 400 }));
    await new Promise((r) => setTimeout(r, 40));
  });
  const unfollow = globalThis.__emitted.slice(emittedBeforeUnfollow).filter((e) => e[0] === "follow:update");
  log(`ghim: lăn chuột → ${unfollow.length} gói bỏ ghim, viền ${document.querySelector(".follow-frame") ? "còn" : "mất"}`);
  if (unfollow.length !== 1 || unfollow[0][1].targetId !== null) {
    throw new Error("tự lăn chuột mà không tự bỏ ghim: " + JSON.stringify(unfollow));
  }
  if (document.querySelector(".follow-frame")) throw new Error("đã bỏ ghim mà viền chỉ báo vẫn còn");

  // Bỏ ghim rồi thì gói view của người cũ (còn trên đường) không được kéo camera.
  const camAfterUnfollow = camera();
  await act(async () => {
    globalThis.__deliver("view:update", {
      socketId: "peer-f", view: { panX: 500, panY: 500, scale: 2, w: 1200, h: 800 }
    });
    await new Promise((r) => setTimeout(r, 200));
  });
  if (camera().panX !== camAfterUnfollow.panX || camera().scale !== camAfterUnfollow.scale) {
    throw new Error("đã bỏ ghim mà gói view cũ vẫn kéo được camera");
  }

  // Chiều ngược lại: có người ghim MÌNH thì mới bắt đầu phát camera, và phải
  // hiện cho mình biết là đang bị xem.
  await act(async () => {
    globalThis.__deliver("follow:watched", { count: 2 });
    await new Promise((r) => setTimeout(r, 30));
  });
  const chip = document.querySelector(".watched-chip");
  if (!chip) throw new Error("có người ghim mình mà không hiện chỉ báo nào");
  const viewEmits = globalThis.__emitted.filter((e) => e[0] === "view:update");
  log(`ghim: bị ${2} người xem → chip "${chip.textContent}" · phát ${viewEmits.length} gói view`);
  if (viewEmits.length === 0) throw new Error("có người ghim mình mà không phát gói view nào");
  const v = viewEmits[viewEmits.length - 1][1];
  if (!(v.w > 0 && v.h > 0) || !Number.isFinite(v.scale)) {
    throw new Error("gói view thiếu kích thước khung nhìn — người xem không khớp được hai màn hình: " + JSON.stringify(v));
  }

  // Server câm hẳn (đúng cảnh chạy nhầm bản cũ): phải HẾT GIỜ rồi kêu lên, chứ
  // không được treo mãi ở trạng thái chờ. Đây là lưới an toàn cho đúng loại lỗi
  // đã làm mất cả buổi để lần ra.
  const peerAvatar2 = Array.from(document.querySelectorAll(".presence-peer .presence-avatar"))
    .find((a) => a.title === "Sếp");
  await act(async () => { peerAvatar2.click(); await new Promise((r) => setTimeout(r, 20)); });
  const pinAgain = Array.from(document.querySelectorAll(".peer-menu .btn"))
    .find((b) => (b.textContent || "").includes("Ghim màn hình"));
  await act(async () => { pinAgain.click(); await new Promise((r) => setTimeout(r, 20)); });
  if (!document.querySelector(".follow-frame.pending")) throw new Error("bấm ghim lại mà không vào trạng thái chờ");
  await act(async () => { await new Promise((r) => setTimeout(r, 3000)); });
  const errFrame = document.querySelector(".follow-frame.error");
  log(`ghim: server câm 3s → ${errFrame ? "báo lỗi \"" + errFrame.textContent.trim() + "\"" : "KHÔNG báo gì"}`);
  if (!errFrame) throw new Error("server không hồi âm mà giao diện treo mãi ở trạng thái chờ, không báo lỗi");
  if (document.querySelector(".follow-frame.pending")) throw new Error("hết giờ rồi mà vẫn còn trạng thái chờ");

  // ---- Hai người lưu đè nhau ----
  // Test thuần trong lib/rebase.test.js đã phủ phép ghép, và bài kiểm tích hợp
  // đã phủ phía server. Cái CHƯA ai chạy là đoạn nối trong IdeaMap.jsx: chốt
  // đúng mốc trước khi PUT, bắt được 409, ghép, rồi lưu lại. Đúng loại đường
  // nối mà hai lần trước đã lọt lưới vì mọi test khác vẫn xanh.
  await act(async () => { await new Promise((r) => setTimeout(r, 600)); });   // để mọi lần lưu đang treo lắng xuống
  const putsBefore = globalThis.__puts.length;

  // Người khác thêm một cái thẻ, ngay trong lúc mình đang kéo một thẻ khác.
  globalThis.__conflictOnce((server) => {
    const id = server.nextNodeId;
    server.nodes = [...server.nodes, { id, title: "THẺ CỦA NGƯỜI KHÁC", desc: "", x: 900, y: 900, tagId: null, statusId: null }];
    server.nextNodeId = id + 1;
    return server;
  });

  const victim = document.querySelector(".idea-card");
  const victimId = Number(victim.dataset.id);
  await act(async () => {
    mouse("mousedown", 300, 300, victim);
    mouse("mousemove", 380, 380);
    mouse("mousemove", 460, 460);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 460, 460); await new Promise((r) => setTimeout(r, 200)); });

  const tries = globalThis.__puts.length - putsBefore;
  const rebasedPut = globalThis.__puts[globalThis.__puts.length - 1];
  const peerCardInPut = rebasedPut.nodes.find((n) => n.title === "THẺ CỦA NGƯỜI KHÁC");
  const minePut = rebasedPut.nodes.find((n) => n.id === victimId);
  const mineNow = document.querySelector(`.idea-card[data-id="${victimId}"]`);
  log(`va chạm lưu: ${tries} lượt PUT (1 bị từ chối + 1 ghép lại) · trong bản gửi lại có thẻ người kia = ${!!peerCardInPut} · thẻ mình ở ${minePut?.x},${minePut?.y}`);

  if (tries !== 2) throw new Error(`bị 409 thì phải ghép rồi lưu LẠI: mong 2 lượt PUT, có ${tries}`);
  // Không khai mốc thì server không có gì để so, và va chạm sẽ lại trôi qua âm
  // thầm y như trước — nên bản thân cái mốc cũng phải được canh.
  const rejectedPut = globalThis.__puts[putsBefore];
  if (!rejectedPut.baseUpdatedAt) throw new Error("cú PUT không khai baseUpdatedAt — server không thể phát hiện va chạm");
  if (!rebasedPut.baseUpdatedAt || rebasedPut.baseUpdatedAt === rejectedPut.baseUpdatedAt) {
    throw new Error("lần gửi lại phải dựa trên MỐC MỚI của server, không thì nó lại bị từ chối ngay");
  }
  if (!peerCardInPut) throw new Error("bản gửi lại không có thẻ của người kia — đã đè mất họ, đúng cái lỗi cần chữa");
  if (!minePut || minePut.x !== Number.parseFloat(mineNow.style.left)) {
    throw new Error(`thay đổi của mình không sống sót qua lần ghép: gửi ${minePut?.x}, trên màn hình ${mineNow?.style.left}`);
  }
  if (!document.querySelector(`.idea-card[data-id="${peerCardInPut.id}"]`)) {
    throw new Error("ghép xong mà thẻ của người kia không hiện trên màn hình — board cục bộ chưa được cập nhật");
  }
  log(`va chạm lưu: thẻ người kia (id ${peerCardInPut.id}) đã hiện trên bảng, thẻ mình vẫn ở chỗ vừa kéo`);

  // ── Cuộn hai ngón trên touchpad: LIA bảng, không phóng ───────────────────
  // Đây là toàn bộ lý do lib/pointer-input.js tồn tại. Test thuần ở đó đã phủ
  // từng dấu hiệu nhận thiết bị; cái CHƯA ai chạy là đoạn nối trong IdeaMap:
  // sự kiện wheel thật → bộ đọc → camera.
  const camBeforePad = camera();
  await act(async () => {
    // Số LẺ là dấu hiệu chắc nhất của touchpad chính xác — nút lăn chuột không
    // bao giờ cho ra 12,5px.
    for (let i = 0; i < 3; i++) {
      canvasEl.dispatchEvent(new window.WheelEvent("wheel", {
        bubbles: true, cancelable: true, deltaX: 6.5, deltaY: 12.5, deltaMode: 0, clientX: 500, clientY: 400
      }));
    }
    await new Promise((r) => setTimeout(r, 40));
  });
  const camAfterPad = camera();
  log(`touchpad: cuộn hai ngón → camera ${camBeforePad.panX.toFixed(0)},${camBeforePad.panY.toFixed(0)}@${camBeforePad.scale.toFixed(2)} → ${camAfterPad.panX.toFixed(0)},${camAfterPad.panY.toFixed(0)}@${camAfterPad.scale.toFixed(2)}`);
  if (camAfterPad.scale !== camBeforePad.scale) {
    throw new Error(`trượt hai ngón mà bảng PHÓNG (${camBeforePad.scale} → ${camAfterPad.scale}) — đúng cái lỗi cần chữa`);
  }
  if (camAfterPad.panX >= camBeforePad.panX || camAfterPad.panY >= camBeforePad.panY) {
    throw new Error("trượt hai ngón mà bảng không lia theo cả hai trục");
  }

  // Cắm chuột rời vào: vài nấc lăn là bộ đọc lật lại, và lăn phải THU PHÓNG.
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      canvasEl.dispatchEvent(new window.WheelEvent("wheel", {
        bubbles: true, cancelable: true, deltaY: -100, deltaMode: 0, clientX: 500, clientY: 400
      }));
      await new Promise((r) => setTimeout(r, 20));
    });
  }
  const scaleBeforeNotch = camera().scale;
  await act(async () => {
    canvasEl.dispatchEvent(new window.WheelEvent("wheel", {
      bubbles: true, cancelable: true, deltaY: -100, deltaMode: 0, clientX: 500, clientY: 400
    }));
    await new Promise((r) => setTimeout(r, 20));
  });
  log(`chuột rời: lăn một nấc → zoom ${scaleBeforeNotch.toFixed(3)} → ${camera().scale.toFixed(3)}`);
  if (camera().scale === scaleBeforeNotch) {
    throw new Error("lăn nút chuột mà bảng không thu phóng — bộ đọc không lật lại được khi đổi thiết bị");
  }

  // ── Giữ tay để nét về hình chuẩn ─────────────────────────────────────────
  // Phép nhận hình đã được phủ kỹ ở lib/recognize.test.js. Ở đây chỉ kiểm đúng
  // cái không test thuần nào với tới: bộ đếm đứng-yên, vòng báo trên màn hình,
  // và việc nét được LƯU RA HÌNH chứ không phải nét tay.
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 20)); });
  // Tra lại MỖI LẦN DÙNG, không giữ một tham chiếu: nhóm test này có đoạn đổi
  // sang mode Chuột rồi quay về, mà đổi mode là .ink-capture bị tháo ra dựng lại.
  // Bắn chuột vào một nút đã lìa khỏi cây thì sự kiện không nổi bọt tới React
  // nữa — không có gì xảy ra, và phép kiểm ngay sau đó lại tưởng là app hỏng.
  const snapCapture = () => document.querySelector(".ink-capture");
  if (!snapCapture()) throw new Error("mode Sửa phải có lớp bắt chuột .ink-capture");
  const snapToggle = Array.from(document.querySelectorAll(".tool-options .tool-btn"))
    .find((b) => (b.title || "").startsWith("Giữ tay"));
  if (!snapToggle) {
    throw new Error("khu 4 của bút phải có nút bật/tắt giữ-tay-để-bắt-hình. khu 4 hiện có: "
      + JSON.stringify(Array.from(document.querySelectorAll(".tool-options .tool-btn")).map((b) => b.title))
      + " · có .ink-capture = " + !!snapCapture()
      + " · nút rail đang sáng: " + JSON.stringify(Array.from(document.querySelectorAll(".tool-rail .tool-btn.on")).map((b) => b.title)));
  }
  if (!snapToggle.classList.contains("on")) throw new Error("giữ-tay-để-bắt-hình phải BẬT sẵn, không thì gần như không ai biết nó có ở đó");

  // Vẽ một đường "thẳng" đúng kiểu tay người: đích đến đúng nhưng đường đi rung.
  const wobble = [0, 3, -2, 4, -3, 2, -1, 3, 0];
  const drawWobblyLine = () => {
    mouse("mousedown", 300, 500, snapCapture());
    wobble.forEach((dy, i) => mouse("mousemove", 300 + (i + 1) * 45, 500 + dy));
  };

  const putsBeforeSnap = globalThis.__puts.length;
  await act(async () => { drawWobblyLine(); await new Promise((r) => setTimeout(r, 60)); });
  // Giữa lúc chờ: vòng báo phải hiện ra. Không có nó thì tính năng vô hình —
  // người dùng chỉ tình cờ gặp một lần rồi không hiểu vừa xảy ra chuyện gì.
  await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
  const hintShown = !!document.querySelector(".snap-hint");
  // Rồi đủ giờ: nét nhảy thành hình và vòng báo tắt.
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS)); });
  const hintGone = !document.querySelector(".snap-hint");
  log(`giữ tay: vòng báo hiện = ${hintShown} · sau ${SNAP_HOLD_MS}ms vòng tắt = ${hintGone}`);
  if (!hintShown) throw new Error("tay đứng yên giữa nét mà không có vòng báo nào");
  if (!hintGone) throw new Error("đã bắt hình rồi mà vòng báo còn treo trên màn hình");

  // Thả chuột NGAY sau khi bắt được hình: đoạn thẳng vừa nắn là thứ được lưu.
  //
  // Cố ý không di chuột thêm rồi mới thả, khác bản trước của phép kiểm này: một
  // đoạn thẳng đã nắn xong giờ CHO VẼ TIẾP từ đầu mút của nó (xem phần nét gấp
  // khúc bên dưới), nên "di chuột sau khi bắt hình" không còn là chuyện vô nghĩa
  // để mà chặn — nó là chính tính năng.
  await act(async () => { mouse("mouseup", 705, 500); await new Promise((r) => setTimeout(r, 60)); });

  if (globalThis.__puts.length - putsBeforeSnap !== 1) throw new Error("một nét được bắt thành hình phải đúng 1 lần lưu");
  const snapPut = globalThis.__puts[globalThis.__puts.length - 1];
  const snapped = snapPut.drawings[snapPut.drawings.length - 1];
  log(`giữ tay: nét lưu ra kind="${snapped.kind}" pts=${JSON.stringify(snapped.pts)}`);
  if (snapped.kind !== "line") throw new Error(`đường thẳng vẽ tay phải lưu ra kind "line", lưu ra "${snapped.kind}"`);
  if (snapped.pts.length !== 4) throw new Error("hình khối phải là ĐÚNG 4 số (hai đầu), có " + snapped.pts.length);
  // Cú di chuột SAU khi đã bắt hình không được kéo nét đi theo. So bằng toạ độ
  // CANVAS, không phải toạ độ màn hình: bảng đang ở zoom 0.98 và pan khác 0 sau
  // các phần test trên, nên hai hệ lệch nhau cả nghìn đơn vị.
  const camAtSnap = camera();
  const canvasX = (screenX) => (screenX - camAtSnap.panX) / camAtSnap.scale;
  if (Math.abs(snapped.pts[2] - canvasX(705)) > 20) {
    throw new Error(`nét phải kết ở điểm vẽ cuối (canvas x≈${canvasX(705).toFixed(0)}), đang ở ${snapped.pts[2]}`);
  }

  // GIỮ TAY MÀ KHÔNG NHẬN RA HÌNH NÀO → đoạn thẳng nối hai đầu.
  //
  // Nét gãy ở giữa là trường hợp hay gặp nhất: nó trượt phép đo đường thẳng (chỗ
  // gãy vọt quá ngưỡng đỉnh) rồi trượt luôn mọi hình kín (hai đầu cách xa nhau),
  // nên trước đây giữ tay hơn một giây mà KHÔNG có gì xảy ra — người dùng chỉ
  // thấy tính năng hỏng. Đo trên DOM chứ không chỉ ở hàm thuần, vì phần dễ sai
  // là cái nối dây: cử chỉ phải gọi snapShape, không phải recognizeShape.
  const putsBeforeKink = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 300, 980, snapCapture());
    // Đủ điểm để qua MIN_POINTS của recognize.js — dưới ngưỡng đó thì phép đo
    // trung bình sai số không nói lên gì và nét bị bỏ qua từ trước khi xét.
    for (let i = 1; i <= 10; i++) {
      const x = 300 + i * 40;
      mouse("mousemove", x, 980 + (x <= 500 ? (x - 300) * 0.2 : (700 - x) * 0.2));
    }
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 400)); });
  await act(async () => { mouse("mouseup", 700, 980); await new Promise((r) => setTimeout(r, 60)); });
  if (globalThis.__puts.length - putsBeforeKink !== 1) throw new Error("nét gãy được nắn thành hình phải đúng 1 lần lưu");
  const kinkPut = globalThis.__puts[globalThis.__puts.length - 1];
  const kinked = kinkPut.drawings[kinkPut.drawings.length - 1];
  const camAtKink = camera();
  const kinkCanvasX = (sx) => (sx - camAtKink.panX) / camAtKink.scale;
  log(`giữ tay trên nét GÃY: kind="${kinked.kind}" ${kinked.pts.length} số`
    + ` · hai đầu x ${kinked.pts[0]},${kinked.pts[2]} (phải ≈ ${kinkCanvasX(300).toFixed(0)},${kinkCanvasX(700).toFixed(0)})`);
  if (kinked.kind !== "line") throw new Error(`nét không ra hình nào phải được nắn thành "line", lưu ra "${kinked.kind}"`);
  if (kinked.pts.length !== 4) throw new Error("đoạn thẳng phải là ĐÚNG 4 số (hai đầu), có " + kinked.pts.length);
  // Hai đầu phải là hai đầu ĐÃ VẼ — đó là toàn bộ ý nghĩa của "đoạn thẳng nối
  // điểm đầu với điểm cuối". Sai chỗ này thì nét nhảy đi đâu đó và tệ hơn hẳn
  // việc không làm gì.
  if (Math.abs(kinked.pts[0] - kinkCanvasX(300)) > 20) throw new Error(`điểm A phải giữ nguyên, đang ở ${kinked.pts[0]}`);
  if (Math.abs(kinked.pts[2] - kinkCanvasX(700)) > 20) throw new Error(`điểm B phải giữ nguyên, đang ở ${kinked.pts[2]}`);

  // VẼ CHẬM một đường xiên gần 45°. Hai thứ được canh cùng lúc ở đây:
  //
  //  1. Vẽ chậm thì mousemove bắn DÀY — hai điểm liên tiếp cách nhau vài pixel,
  //     đúng cỡ biên độ rung tay. Cộng chiều dài đường đi từng đoạn một thì tổng
  //     phình lên theo SỐ ĐIỂM chứ không theo hình vẽ ra, và nét bị loại khỏi
  //     nhánh đường thẳng trước khi kịp đo xem nó có thẳng không. Cùng một nét,
  //     chỉ khác chỗ vẽ nhanh hay chậm, mà ra hai kết quả.
  //  2. Gần 45° nhưng KHÔNG đúng 45°: hai đầu phải ở đúng chỗ đã vẽ. Nét không
  //     được xoay về mốc — đặt điểm B ở đâu là quyền của người vẽ.
  let slowSeed = 20260730;
  const slowJit = () => {
    slowSeed = (slowSeed * 1103515245 + 12345) & 0x7fffffff;
    return ((slowSeed / 0x7fffffff) * 2 - 1) * 2;
  };
  const slowA = [250, 700], slowB = [700, 270];      // 450 ngang, 430 dọc → 43,7°
  const putsBeforeSlow = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", slowA[0], slowA[1], snapCapture());
    for (let i = 1; i <= 260; i++) {
      const u = i / 260;
      mouse("mousemove",
        slowA[0] + (slowB[0] - slowA[0]) * u + slowJit(),
        slowA[1] + (slowB[1] - slowA[1]) * u + slowJit());
    }
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 300)); });
  await act(async () => { mouse("mouseup", slowB[0], slowB[1]); await new Promise((r) => setTimeout(r, 60)); });

  const slowPut = globalThis.__puts[globalThis.__puts.length - 1];
  const slowLine = slowPut.drawings[slowPut.drawings.length - 1];
  log(`vẽ chậm 260 điểm: kind="${slowLine.kind}" pts=${JSON.stringify(slowLine.pts)}`);
  if (globalThis.__puts.length - putsBeforeSlow !== 1) throw new Error("một nét được bắt thành hình phải đúng 1 lần lưu");
  if (slowLine.kind !== "line") {
    throw new Error(`vẽ chậm một đường thẳng vẫn phải ra kind "line", ra "${slowLine.kind}"`
      + " — chiều dài đường đi đang bị đo theo số điểm chứ không theo hình vẽ");
  }
  const camSlow = camera();
  const toCanvasS = (sx, sy) => [(sx - camSlow.panX) / camSlow.scale, (sy - camSlow.panY) / camSlow.scale];
  for (const [tag, want, got] of [
    ["đầu A", toCanvasS(...slowA), slowLine.pts.slice(0, 2)],
    ["đầu B", toCanvasS(...slowB), slowLine.pts.slice(2, 4)]
  ]) {
    if (Math.hypot(want[0] - got[0], want[1] - got[1]) > 12) {
      throw new Error(`${tag} phải ở đúng chỗ đã vẽ (${want.map(Math.round)}), đang ở ${got}`
        + " — nét đang bị xoay về mốc 45° thay vì giữ đúng hai điểm A, B");
    }
  }

  // TAM GIÁC VUÔNG vẽ tay: phải lưu ra BA ĐỈNH và giữ nguyên góc vuông, không bị
  // nắn về tam giác cân. Đây là thứ chỉ chạy hết đường mới thấy: ba đỉnh phải đi
  // trọn từ recognize.js qua useInk, qua commitStroke, tới payload lưu — mà giữa
  // đường có mấy chỗ vốn chỉ biết hình khối là "hai góc đối, đúng 4 số".
  const triCorners = [[900, 300], [1100, 500], [900, 500]];
  const putsBeforeTri = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", triCorners[0][0], triCorners[0][1], snapCapture());
    const path = triCorners.concat([triCorners[0]]);
    for (let i = 0; i + 1 < path.length; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      for (let k = 1; k <= 8; k++) mouse("mousemove", ax + ((bx - ax) * k) / 8, ay + ((by - ay) * k) / 8);
    }
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 300)); });
  await act(async () => { mouse("mouseup", triCorners[0][0], triCorners[0][1]); await new Promise((r) => setTimeout(r, 60)); });

  const triPut = globalThis.__puts[globalThis.__puts.length - 1];
  const triShape = triPut.drawings[triPut.drawings.length - 1];
  log(`giữ tay: tam giác vuông → kind="${triShape.kind}" ${triShape.pts.length} số ${JSON.stringify(triShape.pts)}`);
  if (globalThis.__puts.length - putsBeforeTri !== 1) throw new Error("một tam giác được bắt phải đúng 1 lần lưu");
  if (triShape.kind !== "triangle") throw new Error(`tam giác vẽ tay phải lưu ra kind "triangle", lưu ra "${triShape.kind}"`);
  if (triShape.pts.length !== 6) throw new Error(`tam giác phải lưu ra BA ĐỈNH (6 số), lưu ra ${triShape.pts.length} số — nó đang bị hạ về hộp bao`);
  // Hai đỉnh cùng nằm trên cạnh đứng x = 900 (màn hình): đó chính là góc vuông.
  // Nếu bị nắn về cân thì đỉnh trên nhảy ra giữa và phép này gãy.
  const camTri = camera();
  const canvasXTri = (sx) => (sx - camTri.panX) / camTri.scale;
  const triVerts = [];
  for (let i = 0; i + 1 < triShape.pts.length; i += 2) triVerts.push([triShape.pts[i], triShape.pts[i + 1]]);
  const onLeftEdge = triVerts.filter(([vx]) => Math.abs(vx - canvasXTri(900)) <= 12).length;
  log(`giữ tay: ${onLeftEdge}/3 đỉnh nằm trên cạnh đứng — góc vuông ${onLeftEdge === 2 ? "được giữ" : "BỊ NẮN MẤT"}`);
  if (onLeftEdge !== 2) {
    throw new Error("tam giác vuông bị nắn về tam giác cân — dáng người dùng vẽ ra không được giữ");
  }
  // Và nó phải VẼ RA được: chuỗi `d` của ba đỉnh, không phải chuỗi rỗng.
  if (document.querySelectorAll(".ink-layer path").length < 2) throw new Error("tam giác lưu rồi mà không vẽ ra path nào");

  // HÌNH BÌNH HÀNH vẽ tay: bốn đỉnh, giữ nguyên độ xiên. Cái đáng canh nhất
  // không phải "nó ra quad" mà là nó KHÔNG bị hạ về chữ nhật — tứ giác bốn đỉnh
  // phải thắng được chữ nhật ở đúng những hình mà chữ nhật tả sai.
  const quadCorners = [[1000, 300], [1200, 300], [1140, 440], [940, 440]];
  const putsBeforeQuad = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", quadCorners[0][0], quadCorners[0][1], snapCapture());
    const path = quadCorners.concat([quadCorners[0]]);
    for (let i = 0; i + 1 < path.length; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      for (let k = 1; k <= 10; k++) mouse("mousemove", ax + ((bx - ax) * k) / 10, ay + ((by - ay) * k) / 10);
    }
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 300)); });
  await act(async () => { mouse("mouseup", quadCorners[0][0], quadCorners[0][1]); await new Promise((r) => setTimeout(r, 60)); });

  const quadPut = globalThis.__puts[globalThis.__puts.length - 1];
  const quadShape = quadPut.drawings[quadPut.drawings.length - 1];
  log(`giữ tay: hình bình hành → kind="${quadShape.kind}" ${quadShape.pts.length} số`);
  if (globalThis.__puts.length - putsBeforeQuad !== 1) throw new Error("một tứ giác được bắt phải đúng 1 lần lưu");
  if (quadShape.kind !== "quad") throw new Error(`hình bình hành phải lưu ra kind "quad", lưu ra "${quadShape.kind}" — nó đang bị hạ về hình chuẩn gần nhất`);
  if (quadShape.pts.length !== 8) throw new Error(`tứ giác phải lưu ra BỐN ĐỈNH (8 số), lưu ra ${quadShape.pts.length} số`);
  // Hai cạnh đứng phải còn XIÊN: hai đỉnh trên lệch khỏi hai đỉnh dưới. Nếu bị
  // hạ về chữ nhật thì bốn đỉnh sẽ thẳng trục và phép này gãy.
  const qv = [];
  for (let i = 0; i + 1 < quadShape.pts.length; i += 2) qv.push([quadShape.pts[i], quadShape.pts[i + 1]]);
  const xs = qv.map((v) => v[0]).sort((a, b) => a - b);
  if (xs[1] - xs[0] < 20) throw new Error("bốn đỉnh thẳng trục — hình bình hành bị nắn thành chữ nhật: " + JSON.stringify(qv));

  // NÉT NGẮN, VẼ NHANH, RỒI GIỮ TAY THẬT YÊN.
  //
  // Chỉ BA nhịp mousemove, và KHÔNG nhịp nào trong lúc giữ. Cả hai vế đều là
  // chuyện thường ngày chứ không phải ca dựng lên: nét ngắn vẽ nhanh thì trình
  // duyệt chỉ kịp bắn vài nhịp (mousemove đi theo khung hình), còn con chuột đặt
  // trên bàn mà tay không đẩy thì KHÔNG sinh nhịp nào cả — khác hẳn touchpad,
  // nơi ngón tay đặt yên vẫn rung ra hàng chục nhịp.
  //
  // Hệ quả: cả nét chỉ có bốn điểm. Nét dài thì riêng phần vẽ đã dư điểm nên
  // không bao giờ chạm tới chốt này — đúng triệu chứng "nét dài thì được, nét
  // ngắn thì giữ mãi cũng không ra đường thẳng".
  const shortA = [700, 1560], shortB = [790, 1500];
  const putsBeforeShort = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", shortA[0], shortA[1], snapCapture());
    for (let k = 1; k <= 3; k++) {
      mouse("mousemove", shortA[0] + ((shortB[0] - shortA[0]) * k) / 3, shortA[1] + ((shortB[1] - shortA[1]) * k) / 3);
    }
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 250)); });
  await act(async () => { mouse("mouseup", shortB[0], shortB[1]); await new Promise((r) => setTimeout(r, 60)); });

  const shortPut = globalThis.__puts[globalThis.__puts.length - 1];
  const shortLine = shortPut.drawings[shortPut.drawings.length - 1];
  log(`nét ngắn 3 nhịp chuột, giữ tay không rung → kind="${shortLine.kind}" ${shortLine.pts.length} số`);
  if (globalThis.__puts.length - putsBeforeShort !== 1) throw new Error("phải đúng 1 lần lưu");
  if (shortLine.kind !== "line") {
    throw new Error(`nét ngắn giữ tay mà không thành đường thẳng: kind="${shortLine.kind}"`
      + ` ${shortLine.pts.length} số — cả nét chỉ có 4 điểm, đang bị chốt "đủ điểm để đo" loại từ vòng gác đầu`);
  }

  // ── Nét GẤP KHÚC: giữ tay nhiều lần, rồi khép về điểm xuất phát ──────────
  //
  // Phần hình học đã phủ ở lib/polygon-snap.test.js. Ở đây kiểm đúng cái không
  // test thuần nào với tới, và cũng là cái dễ sai nhất: BỐN lượt giữ tay nối
  // tiếp nhau trong MỘT phiên mousedown, cộng cú dính vào điểm xuất phát.
  //
  // Ba chỗ chỉ chạy hết đường mới lộ ra:
  //  1. Sau mỗi lần chốt, đoạn kế tiếp phải mở lại được. Cửa chặn "đợi tay đi
  //     thật" mà đóng nhầm thì cạnh thứ hai không bao giờ ghi được điểm nào.
  //  2. Cú dính phải giữ được bộ đếm khép hình: tay nhích trong vùng dính không
  //     được đặt lại đồng hồ, không thì giữ mãi cũng không khép.
  //  3. Cả chuỗi là ĐÚNG MỘT lần lưu — bốn lần chốt không được thành bốn nét.
  const chainAt = [[1400, 300], [1700, 302], [1698, 500], [1401, 498]];
  const chainDraw = async (from, to, steps) => {
    await act(async () => {
      for (let k = 1; k <= steps; k++) {
        mouse("mousemove", from[0] + ((to[0] - from[0]) * k) / steps, from[1] + ((to[1] - from[1]) * k) / steps);
      }
      await new Promise((r) => setTimeout(r, 40));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 250)); });
  };

  const putsBeforeChain = globalThis.__puts.length;
  await act(async () => { mouse("mousedown", chainAt[0][0], chainAt[0][1], snapCapture()); });
  for (let i = 0; i < 3; i++) await chainDraw(chainAt[i], chainAt[i + 1], 14);

  // Cạnh cuối về ĐIỂM XUẤT PHÁT — rồi RUNG TAY trong vùng dính suốt lúc chờ.
  //
  // Cái rung mới là phần đáng giá của phép kiểm này. Đứng im tuyệt đối thì mọi
  // cách viết đều khép được hình; tay người thì không đứng im bao giờ, và nếu
  // mỗi nhịp rung đặt lại đồng hồ thì giữ tay bao lâu cũng không khép — đúng
  // triệu chứng "giữ mãi cũng không ra hình". Ba lần rung cách nhau 150ms rồi
  // chờ thêm 500ms: tổng 1100ms, nên bản đúng khép ở mốc 900ms, còn bản đặt lại
  // đồng hồ thì mãi tới 1500ms mới khép — mà lúc đó chuột đã nhả.
  await act(async () => {
    for (let k = 1; k <= 14; k++) {
      mouse("mousemove", chainAt[3][0] + ((chainAt[0][0] - chainAt[3][0]) * k) / 14,
        chainAt[3][1] + ((chainAt[0][1] - chainAt[3][1]) * k) / 14);
    }
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => {
    // Lệch dưới 8px, tức nằm gọn trong bán kính dính (16px).
    for (const [jx, jy] of [[6, -4], [-5, 5], [4, 6], [-6, -3]]) {
      mouse("mousemove", chainAt[0][0] + jx, chainAt[0][1] + jy);
      await new Promise((r) => setTimeout(r, 150));
    }
    await new Promise((r) => setTimeout(r, 500));
  });
  // Vòng chờ khép hình phải đã tắt: nó tắt đúng lúc hình được khép, nên còn treo
  // nghĩa là cú dính không dẫn tới đâu cả.
  const chainHintGone = !document.querySelector(".snap-hint");
  await act(async () => { mouse("mouseup", chainAt[0][0], chainAt[0][1]); await new Promise((r) => setTimeout(r, 60)); });

  const chainPut = globalThis.__puts[globalThis.__puts.length - 1];
  const chainShape = chainPut.drawings[chainPut.drawings.length - 1];
  log(`nét gấp khúc 4 cạnh khép về điểm đầu → kind="${chainShape.kind}" pts=${JSON.stringify(chainShape.pts)}`
    + ` · ${globalThis.__puts.length - putsBeforeChain} lần lưu · vòng chờ đã tắt = ${chainHintGone}`);
  if (globalThis.__puts.length - putsBeforeChain !== 1) {
    throw new Error(`cả chuỗi bốn cạnh phải là ĐÚNG 1 lần lưu, có ${globalThis.__puts.length - putsBeforeChain}`
      + " — mỗi lần chốt một cạnh đang tự lưu ra một nét riêng");
  }
  if (!chainHintGone) throw new Error("đã khép hình rồi mà vòng chờ còn treo trên màn hình");
  if (chainShape.kind !== "rect") {
    throw new Error(`bốn cạnh thẳng trục khép lại phải ra kind "rect", ra "${chainShape.kind}"`
      + ` pts=${JSON.stringify(chainShape.pts)} — cú khép vòng không tới được polygon-snap,`
      + " hoặc một cạnh nào đó không chốt được thành đỉnh");
  }
  if (chainShape.pts.length !== 4) throw new Error("chữ nhật phải là ĐÚNG 4 số (hai góc đối), có " + chainShape.pts.length);
  // Hai góc đối phải trùng hai chỗ đã vẽ. Đây là phép kiểm của cú DÍNH: cạnh cuối
  // dừng ở chỗ nào cũng được, nhưng nó phải bị kéo về đúng điểm xuất phát, không
  // thì hình lệch đi đúng bằng chỗ tay dừng hụt.
  const camChain = camera();
  const chainToCanvas = (sx, sy) => [(sx - camChain.panX) / camChain.scale, (sy - camChain.panY) / camChain.scale];
  for (const [tag, want, got] of [
    ["góc trên trái", chainToCanvas(chainAt[0][0], chainAt[0][1]), chainShape.pts.slice(0, 2)],
    ["góc dưới phải", chainToCanvas(chainAt[2][0], chainAt[2][1]), chainShape.pts.slice(2, 4)]
  ]) {
    if (Math.hypot(want[0] - got[0], want[1] - got[1]) > 14) {
      throw new Error(`${tag} phải ở đúng chỗ đã vẽ (${want.map(Math.round)}), đang ở ${got}`);
    }
  }

  // CHỐT VÀI CẠNH RỒI THẢ CHUỘT, không khép vòng: lưu ra nét gấp khúc HỞ, giữ
  // đúng những cái đỉnh đã chốt. Đây là đường thoát của cả cử chỉ — không có nó
  // thì lỡ tay dựng dở một hình là mất trắng.
  // Đặt xa hẳn khu 1450–1740 × 580–720: phần test quét chọn nét ở dưới quét đúng
  // vùng đó và đếm số nét bắt được.
  const openAt = [[300, 1200], [600, 1203], [597, 1400]];
  const putsBeforeOpen = globalThis.__puts.length;
  await act(async () => { mouse("mousedown", openAt[0][0], openAt[0][1], snapCapture()); });
  await chainDraw(openAt[0], openAt[1], 14);
  await chainDraw(openAt[1], openAt[2], 14);
  await act(async () => { mouse("mouseup", openAt[2][0], openAt[2][1]); await new Promise((r) => setTimeout(r, 60)); });

  const openPut = globalThis.__puts[globalThis.__puts.length - 1];
  const openChain = openPut.drawings[openPut.drawings.length - 1];
  log(`nét gấp khúc 2 cạnh, thả không khép → kind="${openChain.kind}" ${openChain.pts.length} số`);
  if (globalThis.__puts.length - putsBeforeOpen !== 1) throw new Error("nét gấp khúc hở phải đúng 1 lần lưu");
  if (openChain.kind !== "pen") throw new Error(`nét gấp khúc hở phải lưu ra kind "pen", lưu ra "${openChain.kind}"`);
  if (openChain.pts.length !== 6) {
    throw new Error(`hai cạnh đã chốt phải cho ĐÚNG ba đỉnh (6 số), có ${openChain.pts.length}`
      + ` pts=${JSON.stringify(openChain.pts)} — cạnh thứ hai không mở được, hoặc đuôi tay vẽ bị lưu kèm`);
  }
  // Đỉnh giữa là chỗ chốt cạnh đầu: nó phải nằm đúng góc, không xê dịch. Sai chỗ
  // này thì hai cạnh hở một mẩu ở khớp nối.
  const openMid = chainToCanvas(openAt[1][0], openAt[1][1]);
  if (Math.hypot(openMid[0] - openChain.pts[2], openMid[1] - openChain.pts[3]) > 14) {
    throw new Error(`đỉnh giữa phải ở đúng chỗ chốt (${openMid.map(Math.round)}), đang ở ${openChain.pts.slice(2, 4)}`);
  }

  // CHỐT XONG MỘT ĐOẠN RỒI NHẢ CHUỘT — TAY GIẬT MỘT CÁI TRONG LÚC NHẢ.
  //
  // Đây là cảnh thường gặp NHẤT của cả cử chỉ: giữ tay cho nét thành đường
  // thẳng, rồi buông. Mà buông chuột (nhất là trên touchpad) thì tay giật vài
  // chục pixel — và cái giật đó không được biến thành một cạnh nữa. Nếu nó
  // thành, người dùng thấy một đường thẳng có cái MÓC ở đầu, và với họ thì đó
  // đúng là "lúc được lúc không": cùng một thao tác, khi ra đường thẳng sạch,
  // khi ra đường thẳng có đuôi.
  const jerkFrom = [900, 1200], jerkTo = [1200, 1200];
  const putsBeforeJerk = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", jerkFrom[0], jerkFrom[1], snapCapture());
    for (let k = 1; k <= 12; k++) mouse("mousemove", jerkFrom[0] + ((jerkTo[0] - jerkFrom[0]) * k) / 12, jerkFrom[1]);
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 250)); });
  // Cái giật đi hẳn 60px — vượt xa ngưỡng quãng đường, nên phép kiểm này chốt
  // đúng vế THỜI GIAN: nó gọn trong một hai khung hình rồi nút chuột nhả ngay.
  await act(async () => {
    for (const [jx, jy] of [[20, 12], [42, 26], [52, 32]]) mouse("mousemove", jerkTo[0] + jx, jerkTo[1] + jy);
    mouse("mouseup", jerkTo[0] + 52, jerkTo[1] + 32);
    await new Promise((r) => setTimeout(r, 60));
  });

  const jerkPut = globalThis.__puts[globalThis.__puts.length - 1];
  const jerked = jerkPut.drawings[jerkPut.drawings.length - 1];
  log(`chốt xong rồi giật tay 60px lúc nhả → kind="${jerked.kind}" ${jerked.pts.length} số`);
  if (globalThis.__puts.length - putsBeforeJerk !== 1) throw new Error("phải đúng 1 lần lưu");
  if (jerked.kind !== "line" || jerked.pts.length !== 4) {
    throw new Error(`cái giật lúc nhả chuột bị biến thành một cạnh nữa: kind="${jerked.kind}"`
      + ` ${jerked.pts.length} số ${JSON.stringify(jerked.pts)} — phải là "line" 4 số`);
  }

  // MẶT KIA CỦA CÙNG PHÉP CHẶN: vẽ tiếp THẬT rồi mới nhả thì đuôi phải được GIỮ.
  // Không có phép này thì cách chặn cái móc dễ nhất là vứt mọi cái đuôi, và tính
  // năng "vẽ tiếp từ đầu mút" chết mà không ai biết.
  const contFrom = [900, 1400], contMid = [1200, 1400], contEnd = [1200, 1250];
  const putsBeforeCont = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", contFrom[0], contFrom[1], snapCapture());
    for (let k = 1; k <= 12; k++) mouse("mousemove", contFrom[0] + ((contMid[0] - contFrom[0]) * k) / 12, contFrom[1]);
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 250)); });
  // Cạnh thứ hai vẽ thật: 150px trải trong ~480ms, rồi nhả (không giữ tay).
  await act(async () => {
    for (let k = 1; k <= 6; k++) {
      mouse("mousemove", contMid[0], contMid[1] + ((contEnd[1] - contMid[1]) * k) / 6);
      await new Promise((r) => setTimeout(r, 80));
    }
    mouse("mouseup", contEnd[0], contEnd[1]);
    await new Promise((r) => setTimeout(r, 60));
  });

  const contPut = globalThis.__puts[globalThis.__puts.length - 1];
  const cont = contPut.drawings[contPut.drawings.length - 1];
  log(`chốt xong rồi vẽ tiếp thật 150px/480ms → kind="${cont.kind}" ${cont.pts.length} số`);
  if (globalThis.__puts.length - putsBeforeCont !== 1) throw new Error("phải đúng 1 lần lưu");
  if (cont.kind !== "pen" || cont.pts.length < 6) {
    throw new Error(`vẽ tiếp thật mà đuôi bị vứt: kind="${cont.kind}" ${cont.pts.length} số`
      + ` ${JSON.stringify(cont.pts)} — phép chặn cái móc đang chặn cả cú vẽ thật`);
  }
  const camCont = camera();
  const contWant = [(contEnd[0] - camCont.panX) / camCont.scale, (contEnd[1] - camCont.panY) / camCont.scale];
  const contGot = cont.pts.slice(-2);
  if (Math.hypot(contWant[0] - contGot[0], contWant[1] - contGot[1]) > 14) {
    throw new Error(`nét phải kết ở chỗ tay dừng (${contWant.map(Math.round)}), đang ở ${contGot}`);
  }

  // ── Kéo tay cầm để đặt lại góc / cạnh ────────────────────────────────────
  // Chọn ĐÚNG MỘT hình ở mode Chuột thì hiện tay cầm: ô vuông ở mỗi đỉnh, ô tròn
  // ở mỗi trung điểm cạnh.
  await act(async () => { railBtn("Chuột").click(); await new Promise((r) => setTimeout(r, 20)); });
  const camQuad = camera();
  const toScreenQ = (cx, cy) => ({ x: cx * camQuad.scale + camQuad.panX, y: cy * camQuad.scale + camQuad.panY });
  const pickAt = toScreenQ((qv[0][0] + qv[1][0]) / 2, (qv[0][1] + qv[1][1]) / 2);
  await act(async () => {
    canvasEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: pickAt.x, clientY: pickAt.y, button: 0 }));
    mouse("mouseup", pickAt.x, pickAt.y);
    await new Promise((r) => setTimeout(r, 40));
  });
  const vHandles = document.querySelectorAll(".shape-handle:not(.edge)").length;
  const eHandles = document.querySelectorAll(".shape-handle.edge").length;
  log(`chọn một tứ giác: ${vHandles} tay cầm góc · ${eHandles} tay cầm cạnh`);
  if (vHandles !== 4 || eHandles !== 4) {
    throw new Error(`tứ giác phải có 4 tay cầm góc + 4 tay cầm cạnh, có ${vHandles} + ${eHandles}`);
  }

  // Kéo MỘT tay cầm góc: đúng một đỉnh đi, ba đỉnh kia đứng yên tuyệt đối.
  const beforeEdit = quadShape.pts.slice();
  const handleEl = document.querySelectorAll(".shape-handle:not(.edge)")[0];
  const hPos = toScreenQ(Number.parseFloat(handleEl.style.left), Number.parseFloat(handleEl.style.top));
  const putsBeforeEdit = globalThis.__puts.length;
  await act(async () => {
    handleEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: hPos.x, clientY: hPos.y, button: 0 }));
    mouse("mousemove", hPos.x + 60, hPos.y - 40);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", hPos.x + 60, hPos.y - 40); await new Promise((r) => setTimeout(r, 80)); });
  const editPut = globalThis.__puts[globalThis.__puts.length - 1];
  const edited = editPut.drawings.find((d) => d.id === quadShape.id) || editPut.drawings[editPut.drawings.length - 1];
  const movedVerts = [];
  for (let i = 0; i + 1 < edited.pts.length; i += 2) {
    if (edited.pts[i] !== beforeEdit[i] || edited.pts[i + 1] !== beforeEdit[i + 1]) movedVerts.push(i / 2);
  }
  log(`kéo tay cầm góc: ${movedVerts.length}/4 đỉnh đổi chỗ · PUT thêm ${globalThis.__puts.length - putsBeforeEdit} lần`);
  if (globalThis.__puts.length - putsBeforeEdit !== 1) throw new Error("một cú kéo tay cầm phải đúng 1 lần lưu");
  if (movedVerts.length !== 1) {
    throw new Error(`kéo một góc phải dời ĐÚNG một đỉnh, đã dời ${movedVerts.length}: ${JSON.stringify(edited.pts)} vs ${JSON.stringify(beforeEdit)}`);
  }

  // Kéo tay cầm CẠNH: hai đỉnh của cạnh đó đi cùng nhau.
  const beforeEdge = edited.pts.slice();
  const edgeEl = document.querySelectorAll(".shape-handle.edge")[0];
  const ePos = toScreenQ(Number.parseFloat(edgeEl.style.left), Number.parseFloat(edgeEl.style.top));
  await act(async () => {
    edgeEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: ePos.x, clientY: ePos.y, button: 0 }));
    mouse("mousemove", ePos.x, ePos.y - 50);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", ePos.x, ePos.y - 50); await new Promise((r) => setTimeout(r, 80)); });
  const edgePut = globalThis.__puts[globalThis.__puts.length - 1];
  const edgeEdited = edgePut.drawings.find((d) => d.id === quadShape.id) || edgePut.drawings[edgePut.drawings.length - 1];
  let movedByEdge = 0;
  for (let i = 0; i + 1 < edgeEdited.pts.length; i += 2) {
    if (edgeEdited.pts[i] !== beforeEdge[i] || edgeEdited.pts[i + 1] !== beforeEdge[i + 1]) movedByEdge++;
  }
  log(`kéo tay cầm cạnh: ${movedByEdge}/4 đỉnh đi theo (phải là 2)`);
  if (movedByEdge !== 2) {
    throw new Error(`kéo một cạnh phải dời ĐÚNG hai đỉnh của nó, đã dời ${movedByEdge}: ${JSON.stringify(edgeEdited.pts)}`);
  }

  // Kéo góc một CHỮ NHẬT: nó lưu bằng hộp bao hai góc đối, nên "ba góc kia đứng
  // yên" chỉ có được khi hình bỏ hộp mà chuyển sang bốn đỉnh thật. Đây là chỗ
  // canh điều đó — kind phải đổi, và đúng MỘT góc được dời.
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { railBtn("Hình khối").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { document.querySelectorAll(".tool-options .shape-pick")[0].click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => {
    mouse("mousedown", 1250, 620, snapCapture());
    mouse("mousemove", 1330, 670);
    await new Promise((r) => setTimeout(r, 40));
    mouse("mousemove", 1410, 720);
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { mouse("mouseup", 1410, 720); await new Promise((r) => setTimeout(r, 60)); });
  const rcPut = globalThis.__puts[globalThis.__puts.length - 1];
  const rcRect = rcPut.drawings[rcPut.drawings.length - 1];
  if (rcRect.kind !== "rect" || rcRect.pts.length !== 4) {
    throw new Error(`cần một chữ nhật hộp bao để thử, nhận được kind="${rcRect.kind}" ${rcRect.pts.length} số`);
  }

  await act(async () => { railBtn("Chuột").click(); await new Promise((r) => setTimeout(r, 20)); });
  const camRect = camera();
  const toScreenR = (cx, cy) => ({ x: cx * camRect.scale + camRect.panX, y: cy * camRect.scale + camRect.panY });
  const rcTopMid = toScreenR((rcRect.pts[0] + rcRect.pts[2]) / 2, rcRect.pts[1]);
  await act(async () => {
    canvasEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: rcTopMid.x, clientY: rcTopMid.y, button: 0 }));
    mouse("mouseup", rcTopMid.x, rcTopMid.y);
    await new Promise((r) => setTimeout(r, 40));
  });
  const rcHandles = document.querySelectorAll(".shape-handle:not(.edge)");
  log(`chọn một chữ nhật: ${rcHandles.length} tay cầm góc · ${document.querySelectorAll(".shape-handle.edge").length} tay cầm cạnh`);
  if (rcHandles.length !== 4) throw new Error(`chữ nhật phải có 4 tay cầm góc, có ${rcHandles.length} — có thể đã chọn nhầm hình khác`);

  const rcPutsBefore = globalThis.__puts.length;
  const rcPos = toScreenR(Number.parseFloat(rcHandles[0].style.left), Number.parseFloat(rcHandles[0].style.top));
  await act(async () => {
    rcHandles[0].dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: rcPos.x, clientY: rcPos.y, button: 0 }));
    mouse("mousemove", rcPos.x - 70, rcPos.y - 45);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", rcPos.x - 70, rcPos.y - 45); await new Promise((r) => setTimeout(r, 80)); });
  const rcAfterPut = globalThis.__puts[globalThis.__puts.length - 1];
  const rcAfter = rcAfterPut.drawings.find((d) => d.id === rcRect.id);
  // Bốn góc TRƯỚC khi kéo, dựng lại từ hộp bao theo đúng thứ tự shapeHandles trả.
  const [rl, rt, rr, rb] = rcRect.pts;
  const rcBefore = [rl, rt, rr, rt, rr, rb, rl, rb];
  let rcMoved = 0;
  for (let i = 0; i + 1 < rcBefore.length; i += 2) {
    if (rcAfter.pts[i] !== rcBefore[i] || rcAfter.pts[i + 1] !== rcBefore[i + 1]) rcMoved++;
  }
  log(`kéo góc chữ nhật: kind="${rcRect.kind}" → "${rcAfter.kind}" · ${rcMoved}/4 góc đổi chỗ · PUT thêm ${globalThis.__puts.length - rcPutsBefore} lần`);
  if (rcAfter.kind !== "quad" || rcAfter.pts.length !== 8) {
    throw new Error(`kéo góc chữ nhật phải cho tứ giác 4 đỉnh, cho kind="${rcAfter.kind}" ${rcAfter.pts.length} số`);
  }
  if (rcMoved !== 1) {
    throw new Error(`kéo một góc phải dời ĐÚNG một góc, đã dời ${rcMoved}: ${JSON.stringify(rcAfter.pts)} vs ${JSON.stringify(rcBefore)}`);
  }

  // Về lại mode Sửa + bút cho phần test còn lại.
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 20)); });
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 20)); });

  // Tắt nút: nét phải ở lại là nét tay, dù có giữ tay bao lâu.
  // Tra LẠI nút, không dùng tham chiếu bắt từ trước: khu 4 đã bị tháo ra dựng lại
  // khi đổi qua mode Chuột rồi quay về, nên nút cũ là một nút đã lìa khỏi cây —
  // bấm nó không có chuyện gì xảy ra và phép kiểm ngay dưới sẽ nói dối.
  const snapToggleNow = Array.from(document.querySelectorAll(".tool-options .tool-btn"))
    .find((b) => (b.title || "").startsWith("Giữ tay"));
  if (!snapToggleNow) throw new Error("quay lại tool Bút mà khu 4 không còn nút giữ-tay-để-bắt-hình");
  await act(async () => { snapToggleNow.click(); await new Promise((r) => setTimeout(r, 20)); });
  if (document.querySelector(".tool-options .tool-btn.on[title^='Giữ tay']")) throw new Error("bấm tắt mà nút vẫn sáng");
  const putsBeforeOff = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 300, 800, snapCapture());
    wobble.forEach((dy, i) => mouse("mousemove", 300 + (i + 1) * 45, 800 + dy));
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 400)); });
  const hintWhenOff = !!document.querySelector(".snap-hint");
  await act(async () => { mouse("mouseup", 705, 800); await new Promise((r) => setTimeout(r, 60)); });
  const offPut = globalThis.__puts[globalThis.__puts.length - 1];
  const notSnapped = offPut.drawings[offPut.drawings.length - 1];
  log(`tắt giữ-tay: vòng báo hiện = ${hintWhenOff} (phải là false) · nét lưu ra kind="${notSnapped.kind}"`);
  if (globalThis.__puts.length - putsBeforeOff !== 1) throw new Error("nét tay vẫn phải đúng 1 lần lưu");
  if (hintWhenOff) throw new Error("đã tắt mà vẫn hiện vòng báo");
  if (notSnapped.kind !== "pen") throw new Error(`đã tắt thì nét phải ở lại là nét tay, lưu ra "${notSnapped.kind}"`);

  // ── Đang cầm bút, giữ lâu trên một nét = tẩy nét đó ──────────────────────
  // Cái đáng kiểm ở đây là nó KHÔNG cướp cú vẽ bình thường: chỉ ăn khi tay ấn
  // xuống đúng một nét có sẵn rồi đứng yên, và nhích tay ra là huỷ.
  const drawingsBeforeHold = document.querySelectorAll(".ink-layer path").length;
  const putsBeforeHoldErase = globalThis.__puts.length;
  // Nét vừa lưu ở trên nằm ngang qua màn hình y = 800, từ x = 300 tới x = 705.
  await act(async () => {
    mouse("mousedown", 500, 800, snapCapture());
    await new Promise((r) => setTimeout(r, 400));
  });
  const eraseHint = document.querySelector(".snap-hint.erase");
  const dimmedTarget = document.querySelectorAll(".ink-layer path.erasing").length;
  log(`giữ trên nét: vòng báo tẩy = ${!!eraseHint} · nét mờ đi = ${dimmedTarget}`);
  if (!eraseHint) throw new Error("giữ tay trên một nét mà không có vòng báo tẩy — người dùng không biết mình đang nhắm vào cái gì");
  if (dimmedTarget !== 1) throw new Error(`nét sắp bị tẩy phải mờ đi để thấy trước khi mất, đang mờ ${dimmedTarget} nét`);
  await act(async () => { await new Promise((r) => setTimeout(r, HOLD_ERASE_MS)); });
  await act(async () => { mouse("mouseup", 500, 800); await new Promise((r) => setTimeout(r, 60)); });

  const drawingsAfterHold = document.querySelectorAll(".ink-layer path").length;
  log(`giữ trên nét: ${drawingsBeforeHold} → ${drawingsAfterHold} nét · PUT thêm ${globalThis.__puts.length - putsBeforeHoldErase} lần`);
  if (drawingsAfterHold !== drawingsBeforeHold - 1) throw new Error("giữ lâu trên một nét mà nét không bị tẩy");
  if (globalThis.__puts.length - putsBeforeHoldErase !== 1) throw new Error("một lần tẩy phải đúng 1 lần lưu — không được lưu kèm một nét bút rác");
  if (document.querySelector(".snap-hint")) throw new Error("tẩy xong mà vòng báo còn treo");

  // Nhích tay ra là HUỶ cử chỉ tẩy: đây mới là cú vẽ bình thường bắt đầu từ trên
  // một nét có sẵn, và nó không được làm mất nét đó.
  const drawingsBeforeMoveAway = document.querySelectorAll(".ink-layer path").length;
  await act(async () => {
    mouse("mousedown", 400, 500, snapCapture());
    await new Promise((r) => setTimeout(r, 150));
    for (const x of [430, 470, 510]) mouse("mousemove", x, 560);
    await new Promise((r) => setTimeout(r, HOLD_ERASE_MS + 200));
  });
  await act(async () => { mouse("mouseup", 510, 560); await new Promise((r) => setTimeout(r, 60)); });
  const drawingsAfterMoveAway = document.querySelectorAll(".ink-layer path").length;
  log(`ấn lên nét rồi vẽ tiếp: ${drawingsBeforeMoveAway} → ${drawingsAfterMoveAway} nét (phải +1, không mất nét cũ)`);
  if (drawingsAfterMoveAway !== drawingsBeforeMoveAway + 1) {
    throw new Error("bắt đầu vẽ từ trên một nét có sẵn mà nét đó bị tẩy mất — cử chỉ tẩy cướp cú vẽ bình thường");
  }

  // ── Vùng chọn nhiều: hộp bao, kéo từ chỗ trống, thả màu, kéo góc ─────────
  await act(async () => { railBtn("Chuột").click(); await new Promise((r) => setTimeout(r, 20)); });
  const cardEls = Array.from(document.querySelectorAll(".idea-card"));
  await act(async () => {
    mouse("mousedown", 20, 20, cardEls[0]);
    mouse("mouseup", 20, 20);
    await new Promise((r) => setTimeout(r, 30));
  });
  await act(async () => {
    cardEls[1].dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 30, clientY: 30, button: 0, ctrlKey: true }));
    mouse("mouseup", 30, 30);
    await new Promise((r) => setTimeout(r, 40));
  });
  const selBox = document.querySelector(".selection-box");
  const handles = document.querySelectorAll(".selection-handle").length;
  log(`chọn 2 thẻ: hộp bao = ${!!selBox} · ${handles} tay cầm ở góc`);
  if (!selBox) throw new Error("chọn nhiều mà không có hộp bao — không ai biết cầm chỗ nào thì kéo được cả cụm");
  if (handles !== 4) throw new Error("hộp bao phải có đúng 4 tay cầm ở bốn góc, có " + handles);

  // Toạ độ hộp bao là toạ độ CANVAS (nó nằm trong .canvas đã transform), đổi về
  // toạ độ màn hình mới bắn chuột vào giữa nó được.
  const selCam = camera();
  const boxRect = () => {
    const st = document.querySelector(".selection-box").style;
    const x = Number.parseFloat(st.left), y = Number.parseFloat(st.top);
    const w = Number.parseFloat(st.width), h = Number.parseFloat(st.height);
    return { x, y, w, h };
  };
  const toScreen = (cx, cy) => ({ x: cx * selCam.scale + selCam.panX, y: cy * selCam.scale + selCam.panY });
  const box0 = boxRect();
  const selMid = toScreen(box0.x + box0.w / 2, box0.y + box0.h / 2);

  // KÉO TỪ CHỖ TRỐNG trong vùng chọn: cả cụm phải đi, không phải bắt đầu một cú
  // quét mới. Bắn thẳng vào .viewport — đúng phần tử mà cú bấm rơi xuống nền
  // canvas sẽ tới, và là điều kiện handleViewportMouseDown đòi hỏi.
  const cardLeftBefore = cardEls[0].style.left;
  const putsBeforeClusterDrag = globalThis.__puts.length;
  await act(async () => {
    canvasEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: selMid.x, clientY: selMid.y, button: 0 }));
    mouse("mousemove", selMid.x + 60, selMid.y + 40);
    await new Promise((r) => setTimeout(r, 60));
    mouse("mousemove", selMid.x + 120, selMid.y + 80);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", selMid.x + 120, selMid.y + 80); await new Promise((r) => setTimeout(r, 80)); });
  const cardLeftAfter = document.querySelectorAll(".idea-card")[0].style.left;
  const stillSelected = document.querySelectorAll(".idea-card.selected").length;
  log(`kéo từ chỗ trống trong vùng chọn: thẻ left ${cardLeftBefore} → ${cardLeftAfter} · còn ${stillSelected} thẻ được chọn · PUT thêm ${globalThis.__puts.length - putsBeforeClusterDrag} lần`);
  if (cardLeftBefore === cardLeftAfter) throw new Error("kéo từ chỗ trống trong vùng chọn mà cụm không đi — vẫn đang quét vùng như cũ");
  if (stillSelected !== 2) throw new Error("kéo cụm xong mà mất vùng chọn, còn " + stillSelected);
  if (globalThis.__puts.length - putsBeforeClusterDrag !== 1) throw new Error("một cú kéo cụm phải đúng 1 lần lưu");

  // THẢ MÀU vào chỗ trống trong vùng chọn: cả cụm đổi màu, không phải nhắm vào
  // từng cái một.
  const selMid2 = (() => { const b = boxRect(); return toScreen(b.x + b.w / 2, b.y + b.h / 2); })();
  const palSwatch2 = document.querySelector(".filter-panel .pal-swatch");
  if (!palSwatch2) throw new Error("panel Bảng màu không còn ô màu nào để kéo");
  const putsBeforeClusterColor = globalThis.__puts.length;
  await act(async () => {
    palSwatch2.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 300, clientY: 900, button: 0 }));
    mouse("mousemove", selMid2.x, selMid2.y);
    await new Promise((r) => setTimeout(r, 40));
  });
  const boxLit = !!document.querySelector(".selection-box.drop");
  await act(async () => { mouse("mouseup", selMid2.x, selMid2.y); await new Promise((r) => setTimeout(r, 60)); });
  const colorPut = globalThis.__puts[globalThis.__puts.length - 1];
  const selIds = Array.from(document.querySelectorAll(".idea-card.selected")).map((el) => Number(el.dataset.id));
  const colored = colorPut.nodes.filter((n) => selIds.includes(n.id));
  log(`thả màu vào chỗ trống trong vùng chọn: hộp sáng lên = ${boxLit} · ${colored.length} thẻ nhận màu ${JSON.stringify(colored.map((n) => n.color))}`);
  if (!boxLit) throw new Error("kéo màu vào vùng chọn mà hộp không sáng lên — không có gì nói là nó sẽ ăn");
  if (globalThis.__puts.length - putsBeforeClusterColor !== 1) throw new Error("một cú thả màu phải đúng 1 lần lưu");
  if (colored.length !== 2 || colored.some((n) => !n.color)) {
    throw new Error("thả màu vào chỗ trống trong vùng chọn mà không phải cả cụm nhận màu: " + JSON.stringify(colored.map((n) => n.color)));
  }

  // KÉO GÓC: cả cụm phóng to — thẻ dãn ra xa nhau VÀ bề rộng thẻ nhân lên, còn
  // góc đối diện thì đứng yên tuyệt đối.
  const box1 = boxRect();
  const seScreen = toScreen(box1.x + box1.w, box1.y + box1.h);
  const nwBefore = { x: box1.x, y: box1.y };
  const seHandle = document.querySelector(".selection-handle.se");
  const nodesBefore = new Map(colorPut.nodes.filter((n) => selIds.includes(n.id)).map((n) => [n.id, { ...n }]));
  const putsBeforeResize = globalThis.__puts.length;
  await act(async () => {
    seHandle.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: seScreen.x, clientY: seScreen.y, button: 0 }));
    mouse("mousemove", seScreen.x + box1.w * selCam.scale, seScreen.y + box1.h * selCam.scale);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => {
    mouse("mouseup", seScreen.x + box1.w * selCam.scale, seScreen.y + box1.h * selCam.scale);
    await new Promise((r) => setTimeout(r, 80));
  });
  const box2 = boxRect();
  const resizePut = globalThis.__puts[globalThis.__puts.length - 1];
  const grownCards = resizePut.nodes.filter((n) => selIds.includes(n.id));
  log(`kéo góc: hộp ${box1.w.toFixed(0)}×${box1.h.toFixed(0)} → ${box2.w.toFixed(0)}×${box2.h.toFixed(0)} · bề rộng thẻ ${grownCards.map((n) => n.w)} · PUT thêm ${globalThis.__puts.length - putsBeforeResize} lần`);
  if (box2.w <= box1.w * 1.2) throw new Error(`kéo góc ra mà cụm không phóng to: ${box1.w} → ${box2.w}`);
  if (Math.abs(box2.x - nwBefore.x) > 2 || Math.abs(box2.y - nwBefore.y) > 2) {
    throw new Error(`kéo góc se thì góc nw phải đứng yên: ${nwBefore.x},${nwBefore.y} → ${box2.x},${box2.y}`);
  }
  if (grownCards.some((n) => !(n.w > 0))) throw new Error("thẻ trong cụm không nhận bề rộng mới — cụm chỉ dãn ra chứ không to lên");
  if (globalThis.__puts.length - putsBeforeResize !== 1) throw new Error("một cú kéo góc phải đúng 1 lần lưu");
  // Thứ KHÔNG được chọn phải đứng im tuyệt đối.
  const selOutsider = resizePut.nodes.find((n) => !selIds.includes(n.id));
  const selOutsiderBefore0 = colorPut.nodes.find((n) => n.id === selOutsider.id);
  if (selOutsider.x !== selOutsiderBefore0.x || selOutsider.y !== selOutsiderBefore0.y) {
    throw new Error("kéo góc mà thẻ ngoài vùng chọn cũng bị dời");
  }
  // Hoàn tác phải trả cả cụm về đúng cỡ cũ, trong MỘT bước.
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
  });
  const box3 = boxRect();
  log(`Ctrl+Z sau khi kéo góc: hộp ${box2.w.toFixed(0)} → ${box3.w.toFixed(0)} (phải về ${box1.w.toFixed(0)})`);
  if (Math.abs(box3.w - box1.w) > 2) throw new Error("một cú kéo góc phải hoàn tác được trong đúng một bước");

  // ── Bấm nhiều lần trên NỀN TRỐNG: 2 lần hoàn tác, 3 lần làm lại ──────────
  // Cử chỉ này thay chỗ "bấm đúp nền trống để tạo thẻ", nên phần đầu canh luôn
  // rằng bấm đúp KHÔNG còn đẻ ra thẻ nữa.
  const mcCard = () => document.querySelector('.idea-card[data-id="1"]');
  const viewportEl = document.querySelector(".viewport");
  const bgClick = (x, y, upX, upY) => {
    mouse("mousedown", x, y, viewportEl);
    mouse("mouseup", upX ?? x, upY ?? y, viewportEl);
    viewportEl.dispatchEvent(new window.MouseEvent("click", {
      bubbles: true, clientX: upX ?? x, clientY: upY ?? y, button: 0
    }));
  };
  const settle = () => new Promise((r) => setTimeout(r, MULTI_CLICK_MS + 150));

  // Chỗ NỀN THẬT SỰ TRỐNG để thử cử chỉ hoàn tác. Không viết cứng một toạ độ
  // được: tới đoạn này bảng đã có 20 nét vẽ rải khắp nơi, camera đã lia và zoom
  // vài lần, mà bấm trúng một cái nét thì cử chỉ chạy là "đổi nét liền/đứt" chứ
  // không phải hoàn tác — test sẽ đỏ ở một chỗ chẳng liên quan gì tới nguyên
  // nhân. Dò bằng ĐÚNG hàm hit-test mà ứng dụng dùng, nên nó tự đúng lại mỗi khi
  // có ai thêm một nét vẽ mới vào các khối phía trên.
  const emptyBg = (() => {
    const cam = camera();
    const put = globalThis.__puts[globalThis.__puts.length - 1];
    const list = put.drawings || [];
    for (let sx = 700; sx <= 1500; sx += 40) {
      for (let sy = 150; sy <= 700; sy += 40) {
        const p = { x: (sx - cam.panX) / cam.scale, y: (sy - cam.panY) / cam.scale };
        // Nới rộng hơn PICK_RADIUS của ứng dụng: chỉ cần một chỗ trống thoáng,
        // không cần chỗ trống sát sao.
        if (!drawingsHitBy(list, p, 24).length) return { x: sx, y: sy };
      }
    }
    throw new Error("không tìm được chỗ nền trống nào để thử cử chỉ bấm nhiều lần");
  })();
  log(`chỗ nền trống để thử cử chỉ: ${emptyBg.x},${emptyBg.y}`);

  // Một bước để mà lùi: kéo thẻ 1 đi một đoạn.
  const mcStart = mcCard().style.left;
  await act(async () => {
    mouse("mousedown", 300, 300, mcCard());
    mouse("mousemove", 460, 300);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 460, 300); await new Promise((r) => setTimeout(r, 60)); });
  const mcMoved = mcCard().style.left;
  if (mcMoved === mcStart) throw new Error("không kéo được thẻ thì không có bước hoàn tác để thử");

  const mcCardsBefore = document.querySelectorAll(".idea-card").length;
  await act(async () => { bgClick(emptyBg.x, emptyBg.y); bgClick(emptyBg.x, emptyBg.y); await settle(); });
  const mcUndone = mcCard().style.left;
  log(`bấm 2 lần nền trống: thẻ ${mcMoved} → ${mcUndone} (phải về ${mcStart})`
    + ` · số thẻ ${mcCardsBefore} → ${document.querySelectorAll(".idea-card").length}`);
  if (document.querySelectorAll(".idea-card").length !== mcCardsBefore) {
    throw new Error("bấm đúp nền trống vẫn đẻ ra thẻ mới — cử chỉ cũ chưa được gỡ");
  }
  if (mcUndone !== mcStart) throw new Error(`bấm 2 lần phải hoàn tác về ${mcStart}, đang ở ${mcUndone}`);

  await act(async () => { bgClick(emptyBg.x, emptyBg.y); bgClick(emptyBg.x, emptyBg.y); bgClick(emptyBg.x, emptyBg.y); await settle(); });
  log(`bấm 3 lần nền trống: thẻ ${mcUndone} → ${mcCard().style.left} (phải về ${mcMoved})`);
  if (mcCard().style.left !== mcMoved) {
    throw new Error(`bấm 3 lần phải làm lại về ${mcMoved}, đang ở ${mcCard().style.left}`);
  }

  // Bấm 1 lần: không được động vào dữ liệu. Đây là cú bấm hay dùng nhất trên
  // bảng (bỏ chọn), nên nó mà lùi được một bước thì hỏng hẳn.
  const mcOnePos = mcCard().style.left;
  await act(async () => { bgClick(emptyBg.x, emptyBg.y); await settle(); });
  if (mcCard().style.left !== mcOnePos) throw new Error("bấm MỘT lần trên nền mà bảng đổi trạng thái");

  // KÉO không phải BẤM: quét chọn hai lượt liền nhau không được thành hoàn tác.
  // Không có chốt này thì mỗi lần quét hụt là một bước lùi không ai gọi.
  await act(async () => {
    bgClick(700, 300, 860, 420);
    bgClick(700, 300, 860, 420);
    await settle();
  });
  log(`kéo 2 lượt trên nền: thẻ vẫn ở ${mcCard().style.left} (phải là ${mcOnePos})`);
  if (mcCard().style.left !== mcOnePos) throw new Error("hai cú KÉO bị đếm thành hai cú bấm → hoàn tác oan");

  // Bấm 4 lần: bấm loạn tay không được biến thành một chuỗi thao tác.
  await act(async () => {
    for (let i = 0; i < 4; i++) bgClick(emptyBg.x, emptyBg.y);
    await settle();
  });
  if (mcCard().style.left !== mcOnePos) throw new Error("bấm 4 lần mà bảng vẫn đổi trạng thái");

  // Bấm 3 lần là thao tác "chọn cả đoạn văn" của trình duyệt: nó bôi đen nguyên
  // vùng rồi bật thanh công cụ chọn-chữ đè lên bảng. Phải chặn từ gốc — nhưng
  // ĐÚNG MỘT ngoại lệ: trong ô nhập thì bôi đen là thao tác cần thiết, bấm 3 lần
  // ở đó phải chọn được cả dòng như mọi ô nhập khác.
  const selStart = (target) => {
    const ev = new window.Event("selectstart", { bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const dragStart = (target) => {
    const ev = new window.Event("dragstart", { bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const onCanvas = selStart(viewportEl);
  const onCard = selStart(mcCard());
  // Ô nhập dựng tạm: lúc này trên bảng không có ô nào đang mở, mà thứ cần canh
  // là LUẬT ngoại lệ (thẻ INPUT/TEXTAREA đi qua nguyên vẹn) chứ không phải một ô
  // cụ thể nào. Đặt trong .shell để nó nằm đúng trong tầm của cả handler lẫn CSS.
  const boardInput = document.createElement("textarea");
  document.querySelector(".shell").appendChild(boardInput);
  const inInput = selStart(boardInput);
  log(`chặn bôi đen: nền ${onCanvas} · thẻ ${onCard} · ô nhập ${inInput} (ô nhập phải là false)`);
  if (!onCanvas || !onCard) throw new Error("bôi đen trên bảng chưa bị chặn — bấm 3 lần sẽ dính thanh công cụ chọn-chữ của trình duyệt");
  if (inInput !== false) throw new Error("ô nhập cũng bị chặn bôi đen — không sửa chữ trong đó được nữa");
  if (!dragStart(mcCard())) throw new Error("kéo-thả gốc của trình duyệt chưa bị chặn trên thẻ");
  if (dragStart(boardInput)) throw new Error("ô nhập không được chặn kéo-thả");
  boardInput.remove();

  // ── Bấm hai lần lên MỘT NÉT: đổi nét liền ↔ nét đứt ─────────────────────
  //
  // Khối này nằm CUỐI cùng và tự vẽ lấy nét của nó thay vì mượn một nét có sẵn:
  // cử chỉ cần biết chính xác một điểm NẰM TRÊN nét để nhắm vào, mà một nét vẽ
  // từ đầu file thì vị trí của nó còn phụ thuộc mọi cú kéo, lia bảng và hoàn tác
  // xảy ra ở giữa. Vẽ ngay tại chỗ thì toạ độ màn hình để bấm chính là toạ độ đã
  // dùng để vẽ, không phải quy đổi gì cả.
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 30)); });
  const dashCapture = document.querySelector(".ink-capture");
  if (!dashCapture) throw new Error("mode Sửa phải có lớp bắt chuột .ink-capture");
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 30)); });

  // Hai nút nét liền / nét đứt phải có ở CẢ tool bút, không riêng hình khối.
  const dashBtns = () => document.querySelectorAll(".tool-options .dash-pick");
  log(`khu 4 của bút: ${dashBtns().length} nút nét liền/đứt`);
  if (dashBtns().length !== 2) throw new Error("khu 4 của bút phải có 2 nút nét liền/nét đứt, có " + dashBtns().length);
  if (!dashBtns()[0].className.includes("on")) throw new Error("mặc định phải là nét LIỀN");

  // Vẽ một đoạn ngang bằng bút NÉT ĐỨT: nét lưu ra phải mang dashed = true, và
  // path trên màn hình phải có stroke-dasharray.
  await act(async () => { dashBtns()[1].click(); await new Promise((r) => setTimeout(r, 30)); });
  const dashY = 620;
  const putsBeforeDashed = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 1500, dashY, dashCapture);
    for (const x of [1560, 1620, 1680]) mouse("mousemove", x, dashY);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1680, dashY); await new Promise((r) => setTimeout(r, 60)); });
  if (globalThis.__puts.length - putsBeforeDashed !== 1) throw new Error("một nét phải đúng 1 lần lưu");
  const dashPut = globalThis.__puts[globalThis.__puts.length - 1];
  const dashDrawing = dashPut.drawings[dashPut.drawings.length - 1];
  const dashPath = () => {
    const paths = document.querySelectorAll(".ink-layer path");
    return paths[paths.length - 1];
  };
  log(`vẽ bằng bút nét đứt: dashed=${dashDrawing.dashed} · stroke-dasharray="${dashPath().getAttribute("stroke-dasharray")}"`);
  if (dashDrawing.dashed !== true) throw new Error("vẽ bằng bút nét đứt mà nét lưu ra không mang dashed = true");
  if (!dashPath().getAttribute("stroke-dasharray")) throw new Error("nét đứt mà path không có stroke-dasharray — trên màn hình vẫn là nét liền");
  // Nhịp đứt phải tỉ lệ với độ dày nét, không phải một chuỗi cố định.
  const dashW = Number(dashPath().getAttribute("stroke-width"));
  const dashParts = dashPath().getAttribute("stroke-dasharray").split(" ").map(Number);
  if (!dashParts.every((v) => v > 0)) throw new Error("stroke-dasharray có số 0 — nét sẽ biến mất chứ không thành nét đứt");
  if (dashParts[0] < dashW) throw new Error("nhịp đứt phải tính theo độ dày nét, đang nhỏ hơn cả bề dày");

  // Trả bút về nét liền để phần dưới đo đúng cái CỬ CHỈ, không phải đo lựa chọn
  // đang cầm trên tay.
  await act(async () => { dashBtns()[0].click(); await new Promise((r) => setTimeout(r, 30)); });
  await act(async () => { railBtn("Chuột").click(); await new Promise((r) => setTimeout(r, 30)); });

  // Bấm hai lần lên chính cái nét vừa vẽ. Nó là nét MỚI NHẤT nên nằm trên cùng —
  // trúng nhiều nét thì cử chỉ lấy cái trên, nên đích là xác định.
  const dashId = dashDrawing.id;
  const drawingById = (put, id) => put.drawings.find((d) => d.id === id);
  const dashHit = { x: 1590, y: dashY };
  const putsBeforeToggle = globalThis.__puts.length;
  await act(async () => { bgClick(dashHit.x, dashHit.y); bgClick(dashHit.x, dashHit.y); await settle(); });
  const togglePut = globalThis.__puts[globalThis.__puts.length - 1];
  log(`bấm 2 lần lên nét đứt: dashed ${dashDrawing.dashed} → ${drawingById(togglePut, dashId).dashed}`
    + ` · PUT thêm ${globalThis.__puts.length - putsBeforeToggle} lần`);
  if (globalThis.__puts.length - putsBeforeToggle !== 1) throw new Error("một cú đổi nét phải đúng 1 lần lưu");
  if (drawingById(togglePut, dashId).dashed !== false) throw new Error("bấm 2 lần lên nét đứt phải đổi nó thành nét liền");
  if (dashPath().getAttribute("stroke-dasharray")) throw new Error("đã đổi sang nét liền mà path vẫn còn stroke-dasharray");

  // Chỉ ĐÚNG cái nét được nhắm đổi, mọi nét khác y nguyên. Đây là chốt quan
  // trọng nhất: cử chỉ này chạy trên một hit-test, nhắm trượt là sửa nhầm nét.
  const otherChanged = togglePut.drawings.filter((d) => {
    if (d.id === dashId) return false;
    const before = drawingById(dashPut, d.id);
    return !before || JSON.stringify(before) !== JSON.stringify(d);
  });
  if (otherChanged.length) throw new Error(`bấm 2 lần lên một nét mà ${otherChanged.length} nét khác cũng đổi theo`);

  // Bấm hai lần nữa: đổi ngược lại. Tức lần thứ 3 KHÔNG lật thêm một phát —
  // chuỗi đóng lại ngay sau khi làm, hai lần bấm mới là một cử chỉ mới.
  await act(async () => { bgClick(dashHit.x, dashHit.y); bgClick(dashHit.x, dashHit.y); await settle(); });
  const backPut = globalThis.__puts[globalThis.__puts.length - 1];
  log(`bấm 2 lần nữa: dashed → ${drawingById(backPut, dashId).dashed} (phải quay lại true)`);
  if (drawingById(backPut, dashId).dashed !== true) throw new Error("bấm 2 lần nữa phải đổi ngược về nét đứt");

  // MỘT lần bấm lên nét thì không được đổi gì — đây là cú bấm để CHỌN nét, cú
  // hay dùng nhất trên một nét vẽ.
  const putsBeforeSingle = globalThis.__puts.length;
  await act(async () => { bgClick(dashHit.x, dashHit.y); await settle(); });
  log(`bấm 1 lần lên nét: PUT thêm ${globalThis.__puts.length - putsBeforeSingle} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeSingle) throw new Error("bấm MỘT lần lên một nét mà bảng đã đổi trạng thái");

  // Bấm một cái lên NÉT rồi một cái lên NỀN trong cùng cửa sổ thời gian: hai đích
  // khác nhau nên KHÔNG được cộng thành "bấm đúp" của cái nào — không đổi nét, và
  // cũng không hoàn tác.
  const putsBeforeMixed = globalThis.__puts.length;
  const mixedDashed = drawingById(backPut, dashId).dashed;
  await act(async () => { bgClick(dashHit.x, dashHit.y); bgClick(emptyBg.x, emptyBg.y); await settle(); });
  log(`bấm nét rồi bấm nền: PUT thêm ${globalThis.__puts.length - putsBeforeMixed} lần (phải là 0)`);
  if (globalThis.__puts.length !== putsBeforeMixed) {
    const mixedPut = globalThis.__puts[globalThis.__puts.length - 1];
    throw new Error(`bấm lên nét rồi lên nền bị đếm chung thành một cử chỉ — dashed đang là ${drawingById(mixedPut, dashId)?.dashed}, trước đó ${mixedDashed}`);
  }

  // ── Nét liền / nét đứt cho CẢ VÙNG CHỌN ─────────────────────────────────
  //
  // Vẽ thêm một nét thứ hai ngay cạnh nét cũ, quét chọn cả hai, rồi kiểm hai
  // đường: nút trên thanh vùng chọn, và cử chỉ bấm hai lần lên một nét TRONG
  // cụm — cái sau phải kéo theo cả cụm chứ không chỉ cái nét bị nhắm.
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 30)); });
  const selDashCapture = document.querySelector(".ink-capture");
  const selDashY = dashY + 60;
  await act(async () => {
    mouse("mousedown", 1500, selDashY, selDashCapture);
    for (const x of [1560, 1620, 1680]) mouse("mousemove", x, selDashY);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1680, selDashY); await new Promise((r) => setTimeout(r, 60)); });
  const twoPut = globalThis.__puts[globalThis.__puts.length - 1];
  const dashId2 = twoPut.drawings[twoPut.drawings.length - 1].id;
  // Nét thứ hai vẽ bằng bút đã trả về NÉT LIỀN ở khối trên, nét thứ nhất đang là
  // nét đứt: cụm lẫn lộn — đúng trường hợp cần canh.
  if (drawingById(twoPut, dashId).dashed !== true) throw new Error("nét 1 phải đang là nét đứt");
  if (drawingById(twoPut, dashId2).dashed === true) throw new Error("nét 2 phải đang là nét liền");

  await act(async () => { railBtn("Chuột").click(); await new Promise((r) => setTimeout(r, 30)); });
  // Quét một vùng trùm cả hai nét. Bắn thẳng vào .viewport — đúng phần tử mà cú
  // bấm rơi xuống nền canvas sẽ tới.
  await act(async () => {
    viewportEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 1450, clientY: dashY - 40, button: 0 }));
    mouse("mousemove", 1600, selDashY + 20);
    await new Promise((r) => setTimeout(r, 40));
    mouse("mousemove", 1740, selDashY + 40);
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { mouse("mouseup", 1740, selDashY + 40); await new Promise((r) => setTimeout(r, 60)); });
  const selMarks = document.querySelectorAll(".ink-layer .ink-selected").length;
  const bulkBar = document.querySelector(".bulk-bar");
  log(`quét chọn 2 nét: ${selMarks} nét được chọn · thanh vùng chọn = ${!!bulkBar}`);
  if (selMarks !== 2) throw new Error(`quét phải chọn đúng 2 nét, được ${selMarks}`);
  if (!bulkBar) throw new Error("chọn nét vẽ mà không hiện thanh vùng chọn");

  // Hai nút phải CÓ MẶT trên thanh — quét xong mà không thấy chỗ bấm thì tính
  // năng coi như không tồn tại với người dùng.
  const dashBulkBtns = () => Array.from(document.querySelectorAll(".bulk-bar .bb-clear"))
    .filter((b) => b.textContent === "Nét liền" || b.textContent === "Nét đứt");
  log(`thanh vùng chọn: ${dashBulkBtns().length} nút nét liền/đứt`);
  if (dashBulkBtns().length !== 2) throw new Error("thanh vùng chọn phải có 2 nút nét liền/nét đứt, có " + dashBulkBtns().length);

  // Bấm "Nét đứt": CẢ CỤM về nét đứt, kể cả cái đang liền, trong ĐÚNG một lần lưu.
  const putsBeforeBulk = globalThis.__puts.length;
  await act(async () => {
    dashBulkBtns().find((b) => b.textContent === "Nét đứt").click();
    await new Promise((r) => setTimeout(r, 60));
  });
  const bulkPut = globalThis.__puts[globalThis.__puts.length - 1];
  log(`nút "Nét đứt" cho vùng chọn: nét 1 → ${drawingById(bulkPut, dashId).dashed}`
    + ` · nét 2 → ${drawingById(bulkPut, dashId2).dashed} · PUT thêm ${globalThis.__puts.length - putsBeforeBulk} lần`);
  if (globalThis.__puts.length - putsBeforeBulk !== 1) throw new Error("đổi nét cho cả cụm phải đúng 1 lần lưu");
  if (drawingById(bulkPut, dashId).dashed !== true || drawingById(bulkPut, dashId2).dashed !== true) {
    throw new Error("bấm Nét đứt mà không phải cả vùng chọn thành nét đứt");
  }

  // Bấm hai lần lên MỘT nét trong cụm: cả cụm đổi theo, không chỉ cái bị nhắm.
  // Cú bấm đầu rơi vào một nét ĐANG NẰM TRONG vùng chọn nên vùng chọn được giữ
  // nguyên (không thu về một nét) — đó là điều kiện để cử chỉ thấy được cả cụm.
  const putsBeforeClusterDash = globalThis.__puts.length;
  await act(async () => { bgClick(dashHit.x, dashHit.y); bgClick(dashHit.x, dashHit.y); await settle(); });
  const clusterPut = globalThis.__puts[globalThis.__puts.length - 1];
  log(`bấm 2 lần lên 1 nét trong cụm: nét 1 → ${drawingById(clusterPut, dashId).dashed}`
    + ` · nét 2 → ${drawingById(clusterPut, dashId2).dashed} (cả hai phải là false)`
    + ` · còn ${document.querySelectorAll(".ink-layer .ink-selected").length} nét được chọn`);
  if (globalThis.__puts.length - putsBeforeClusterDash !== 1) throw new Error("đổi nét cả cụm bằng cử chỉ phải đúng 1 lần lưu");
  if (drawingById(clusterPut, dashId).dashed !== false || drawingById(clusterPut, dashId2).dashed !== false) {
    throw new Error("bấm 2 lần lên một nét TRONG vùng chọn phải đổi cả cụm, không chỉ cái bị nhắm");
  }

  // ── Ctrl+Z / Ctrl+Shift+Z KHÔNG được kéo màn hình về chỗ cũ ─────────────
  //
  // `view` (pan + zoom) nằm chung trong board và board là thứ được chụp lại vào
  // lịch sử, nên nếu khôi phục cả cục thì lùi một bước là màn hình nhảy về chỗ
  // đứng lúc làm việc đó. Cách đo: sau một thao tác, LIA BẢNG đi chỗ khác rồi
  // mới hoàn tác — camera phải đứng nguyên chỗ vừa lia, còn nội dung thì lùi.
  const camBeforePan = camera();
  await act(async () => {
    // Chuột PHẢI trên nền là lia bảng (xem handleViewportMouseDown).
    viewportEl.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, clientX: 1000, clientY: 400, button: 2 }));
    mouse("mousemove", 1180, 520);
    await new Promise((r) => setTimeout(r, 40));
    mouse("mousemove", 1300, 600);
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { mouse("mouseup", 1300, 600); await new Promise((r) => setTimeout(r, 60)); });
  const camPanned = camera();
  if (Math.abs(camPanned.panX - camBeforePan.panX) < 50) {
    throw new Error(`không lia được bảng thì không thử được chuyện Ctrl+Z nhảy màn hình: ${camBeforePan.panX} → ${camPanned.panX}`);
  }

  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
  });
  const camAfterUndo = camera();
  const undonePut = globalThis.__puts[globalThis.__puts.length - 1];
  log(`Ctrl+Z sau khi lia bảng: camera ${camPanned.panX.toFixed(0)},${camPanned.panY.toFixed(0)}`
    + ` → ${camAfterUndo.panX.toFixed(0)},${camAfterUndo.panY.toFixed(0)} (phải đứng yên)`
    + ` · nét 1 dashed → ${drawingById(undonePut, dashId).dashed} (phải lùi về true)`);
  if (Math.abs(camAfterUndo.panX - camPanned.panX) > 1 || Math.abs(camAfterUndo.panY - camPanned.panY) > 1) {
    throw new Error(`Ctrl+Z kéo màn hình về chỗ cũ: ${camPanned.panX},${camPanned.panY} → ${camAfterUndo.panX},${camAfterUndo.panY}`);
  }
  if (Math.abs(camAfterUndo.scale - camPanned.scale) > 0.001) throw new Error("Ctrl+Z đổi cả mức zoom");
  // Vẫn phải lùi THẬT: giữ nguyên camera không được biến hoàn tác thành vô tác dụng.
  if (drawingById(undonePut, dashId).dashed !== true) throw new Error("Ctrl+Z giữ được camera nhưng không lùi được nội dung");

  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
  });
  const camAfterRedo = camera();
  const redonePut = globalThis.__puts[globalThis.__puts.length - 1];
  log(`Ctrl+Shift+Z: camera đứng yên = ${Math.abs(camAfterRedo.panX - camPanned.panX) <= 1}`
    + ` · nét 1 dashed → ${drawingById(redonePut, dashId).dashed} (phải về lại false)`);
  if (Math.abs(camAfterRedo.panX - camPanned.panX) > 1 || Math.abs(camAfterRedo.panY - camPanned.panY) > 1) {
    throw new Error("Ctrl+Shift+Z cũng kéo màn hình đi chỗ khác");
  }
  if (drawingById(redonePut, dashId).dashed !== false) throw new Error("Ctrl+Shift+Z không làm lại được nội dung");

  // Nét NGOÀI vùng chọn vẫn phải y nguyên — cử chỉ áp cho cụm, không phải cho bảng.
  const clusterOutsiders = clusterPut.drawings.filter((d) => {
    if (d.id === dashId || d.id === dashId2) return false;
    const before = drawingById(bulkPut, d.id);
    return !before || JSON.stringify(before) !== JSON.stringify(d);
  });
  if (clusterOutsiders.length) throw new Error(`đổi nét cho vùng chọn mà ${clusterOutsiders.length} nét ngoài vùng chọn cũng đổi theo`);

  // ── Đang cầm BÚT: bấm một cái là chọn nét, rồi sửa ngay tại chỗ ──────────
  //
  // Trọn vòng người dùng đi: giữ tay cho nét về hình chuẩn → bấm một cái lên nó
  // để chọn → kéo góc. Không rời cây bút lần nào. Trước đây cú bấm không di rơi
  // vào hư không và muốn sửa thì phải sang mode Chuột.
  await act(async () => { railBtn("Sửa").click(); await new Promise((r) => setTimeout(r, 30)); });
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 30)); });
  const penCapture = () => document.querySelector(".ink-capture");
  if (!penCapture()) throw new Error("mode Sửa phải có lớp bắt chuột .ink-capture");
  // Khối "tắt giữ-tay" ở trên tắt nút này và không bật lại — bật lại ở đây chứ
  // không sửa khối kia, để bài test ở đó vẫn kết thúc ở đúng trạng thái nó đang
  // canh. Đọc trạng thái rồi mới bấm, không bấm mù.
  const penSnapToggle = () => Array.from(document.querySelectorAll(".tool-options .tool-btn"))
    .find((b) => (b.title || "").startsWith("Giữ tay"));
  if (!penSnapToggle()) throw new Error("khu 4 của bút phải có nút giữ-tay-để-bắt-hình");
  if (!penSnapToggle().classList.contains("on")) {
    await act(async () => { penSnapToggle().click(); await new Promise((r) => setTimeout(r, 30)); });
  }
  if (!penSnapToggle().classList.contains("on")) throw new Error("không bật lại được giữ-tay-để-bắt-hình");

  // Vẽ một tam giác rồi GIỮ TAY cho nó về hình chuẩn.
  const penTriPath = [[1500, 760], [1560, 880], [1440, 880]];
  await act(async () => {
    mouse("mousedown", penTriPath[0][0], penTriPath[0][1], penCapture());
    const loop = penTriPath.concat([penTriPath[0]]);
    for (let i = 0; i + 1 < loop.length; i++) {
      const [ax, ay] = loop[i], [bx, by] = loop[i + 1];
      for (let k = 1; k <= 8; k++) mouse("mousemove", ax + (bx - ax) * (k / 8), ay + (by - ay) * (k / 8));
    }
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 400)); });
  await act(async () => { mouse("mouseup", penTriPath[0][0], penTriPath[0][1]); await new Promise((r) => setTimeout(r, 60)); });
  const penTriPut = globalThis.__puts[globalThis.__puts.length - 1];
  const penTriDrawing = penTriPut.drawings[penTriPut.drawings.length - 1];
  log(`bút + giữ tay: tam giác → kind="${penTriDrawing.kind}" ${penTriDrawing.pts.length} số`);
  if (penTriDrawing.kind !== "triangle") throw new Error(`giữ tay trên tam giác phải ra "triangle", ra "${penTriDrawing.kind}"`);

  // Chưa chọn gì thì chưa có tay cầm nào.
  if (document.querySelectorAll(".shape-handle").length) throw new Error("chưa chọn hình nào mà đã có tay cầm");

  // BẤM MỘT CÁI lên hình vừa ra — vẫn đang cầm bút. Bấm vào một ĐỈNH của tam
  // giác: chắc chắn nằm trên đường bao, nên hit-test không thể trượt.
  const camPen = camera();
  const toScreenPen = (cx, cy) => ({ x: cx * camPen.scale + camPen.panX, y: cy * camPen.scale + camPen.panY });
  const penApex = toScreenPen(penTriDrawing.pts[0], penTriDrawing.pts[1]);
  const putsBeforePick = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", penApex.x, penApex.y, penCapture());
    mouse("mouseup", penApex.x, penApex.y);
    await new Promise((r) => setTimeout(r, 60));
  });
  const pickedMarks = document.querySelectorAll(".ink-layer .ink-selected").length;
  const penHandles = document.querySelectorAll(".shape-handle").length;
  log(`bút + bấm 1 cái lên hình: ${pickedMarks} nét được chọn · ${penHandles} tay cầm hiện ra`
    + ` · PUT thêm ${globalThis.__puts.length - putsBeforePick} lần (phải là 0)`);
  if (pickedMarks !== 1) throw new Error(`bấm một cái khi đang cầm bút phải chọn đúng 1 nét, được ${pickedMarks}`);
  // Tam giác ở dạng đỉnh thật: 3 tay cầm góc + 3 tay cầm cạnh.
  if (penHandles !== 6) throw new Error(`chọn tam giác phải hiện 6 tay cầm, có ${penHandles}`);
  // Cú bấm để CHỌN không được là một thao tác sửa dữ liệu.
  if (globalThis.__puts.length !== putsBeforePick) throw new Error("cú bấm để chọn lại ghi thêm một bản lưu");

  // KÉO MỘT TAY CẦM — vẫn đang cầm bút. Đây là chỗ dễ hỏng nhất: tay cầm nằm
  // trong .canvas (có transform → ngữ cảnh xếp lớp riêng) nên z-index của nó
  // không bao giờ thắng .ink-capture; nếu handleInkCaptureMouseDown không tự dò
  // thì cú kéo này biến thành một nét vẽ mới đè lên hình.
  const penGrab = toScreenPen(penTriDrawing.pts[0], penTriDrawing.pts[1]);
  const pathsBeforeGrab = document.querySelectorAll(".ink-layer path").length;
  const putsBeforeGrab = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", penGrab.x, penGrab.y, penCapture());
    mouse("mousemove", penGrab.x + 70, penGrab.y - 50);
    await new Promise((r) => setTimeout(r, 50));
    mouse("mousemove", penGrab.x + 140, penGrab.y - 100);
    await new Promise((r) => setTimeout(r, 50));
  });
  await act(async () => { mouse("mouseup", penGrab.x + 140, penGrab.y - 100); await new Promise((r) => setTimeout(r, 80)); });
  const grabPut = globalThis.__puts[globalThis.__puts.length - 1];
  const penMoved = grabPut.drawings.find((d) => d.id === penTriDrawing.id);
  const penMovedVerts = [];
  for (let i = 0; i + 1 < penMoved.pts.length; i += 2) {
    const same = Math.abs(penMoved.pts[i] - penTriDrawing.pts[i]) < 2 && Math.abs(penMoved.pts[i + 1] - penTriDrawing.pts[i + 1]) < 2;
    if (!same) penMovedVerts.push(i / 2);
  }
  log(`bút + kéo tay cầm góc: ${penMovedVerts.length}/3 đỉnh đổi chỗ · ${pathsBeforeGrab} → ${document.querySelectorAll(".ink-layer path").length} path`
    + ` · PUT thêm ${globalThis.__puts.length - putsBeforeGrab} lần`);
  if (document.querySelectorAll(".ink-layer path").length !== pathsBeforeGrab) {
    throw new Error("kéo tay cầm khi đang cầm bút lại đẻ ra một nét vẽ mới — cú bấm rơi xuống lớp vẽ chứ không vào tay cầm");
  }
  if (globalThis.__puts.length - putsBeforeGrab !== 1) throw new Error("một cú kéo tay cầm phải đúng 1 lần lưu");
  if (penMovedVerts.length !== 1) throw new Error(`kéo MỘT góc thì chỉ một đỉnh được đi, có ${penMovedVerts.length} đỉnh đổi chỗ`);
  // Hình sau khi kéo — dùng lại ở bài cục gôm bên dưới.
  const penTriTarget = penMoved;

  // Bấm vào CHỖ TRỐNG khi đang cầm bút thì bỏ chọn — cùng phản xạ với mode Chuột.
  await act(async () => {
    mouse("mousedown", emptyBg.x, emptyBg.y, penCapture());
    mouse("mouseup", emptyBg.x, emptyBg.y);
    await new Promise((r) => setTimeout(r, 60));
  });
  log(`bút + bấm chỗ trống: còn ${document.querySelectorAll(".ink-layer .ink-selected").length} nét được chọn · ${document.querySelectorAll(".shape-handle").length} tay cầm`);
  if (document.querySelectorAll(".ink-layer .ink-selected").length !== 0) throw new Error("bấm chỗ trống khi đang cầm bút mà không bỏ chọn");

  // CÚ BẤM CÓ RUNG TAY. Bài ngay trên bấm-nhả đúng một toạ độ, không nhích một
  // pixel nào — chuột thật thì gần như không bao giờ như vậy: bấm một cái là
  // con trỏ trôi vài pixel. Chỉ vài pixel đó thôi cũng đủ ghi ra hai điểm, và
  // "hai điểm" từng bị tính là một NÉT VẼ thay vì một cú bấm: người dùng bấm để
  // chọn thì chẳng chọn được gì, lại còn đẻ ra một chấm mực bằng hạt bụi lên
  // bảng. Ngưỡng phải đo bằng PIXEL MÀN HÌNH (tay rung bao nhiêu là chuyện của
  // bàn tay, không phải của mức zoom) — cùng một lỗi đo nhầm đại lượng đã gặp ở
  // recognize.js.
  const jitApex = toScreenPen(penTriTarget.pts[0], penTriTarget.pts[1]);
  const jitPuts = globalThis.__puts.length;
  const jitPaths = document.querySelectorAll(".ink-layer path").length;
  await act(async () => {
    mouse("mousedown", jitApex.x, jitApex.y, penCapture());
    mouse("mousemove", jitApex.x + 3, jitApex.y + 1);
    mouse("mousemove", jitApex.x + 5, jitApex.y + 2);
    mouse("mouseup", jitApex.x + 5, jitApex.y + 2);
    await new Promise((r) => setTimeout(r, 60));
  });
  const jitMarks = document.querySelectorAll(".ink-layer .ink-selected").length;
  log(`bút + bấm rung tay 5px lên hình: ${jitMarks} nét được chọn`
    + ` · PUT thêm ${globalThis.__puts.length - jitPuts} lần (phải là 0)`
    + ` · ${jitPaths} → ${document.querySelectorAll(".ink-layer path").length} path`);
  if (jitMarks !== 1) throw new Error(`bấm rung tay lên một nét phải chọn nó, được ${jitMarks} nét đang chọn`);
  if (globalThis.__puts.length !== jitPuts) throw new Error("cú bấm rung tay lại ghi thêm một bản lưu — nó đã thành một nét vẽ");
  if (document.querySelectorAll(".ink-layer path").length !== jitPaths) {
    throw new Error("cú bấm rung tay đẻ ra thêm một path — chấm mực rác trên bảng");
  }
  // Dọn lại lựa chọn cho các bài dưới, đúng như bài bấm-chỗ-trống ở trên để lại.
  await act(async () => {
    mouse("mousedown", emptyBg.x, emptyBg.y, penCapture());
    mouse("mouseup", emptyBg.x, emptyBg.y);
    await new Promise((r) => setTimeout(r, 60));
  });

  // ── Gạch ngoằn ngoèo đè lên một nét = xoá nét đó ─────────────────────────
  //
  // Cử chỉ này XOÁ mà không hỏi, nên bài test phải canh cả hai chiều: gạch trúng
  // thì mất đúng cái bị gạch, mà gạch vào chỗ trống thì nét ngoằn ngoèo đó vẫn
  // phải nằm lại trên bảng như một hình vẽ bình thường.
  const scratchBtn = () => Array.from(document.querySelectorAll(".tool-options .tool-btn"))
    .find((b) => (b.title || "").startsWith("Gạch"));
  if (!scratchBtn()) throw new Error("khu 4 của bút phải có nút bật/tắt gạch xoá");
  if (!scratchBtn().classList.contains("on")) throw new Error("gạch xoá phải bật sẵn");

  // Một khoảng trống đủ rộng để đặt cả cái nét lẫn cú gạch đè lên nó. Dò bằng
  // đúng hit-test của ứng dụng, cùng lý do đã ghi ở emptyBg.
  const scrArea = (() => {
    const cam = camera();
    const put = globalThis.__puts[globalThis.__puts.length - 1];
    const list = put.drawings || [];
    const clear = (sx, sy) => {
      for (let dx = -140; dx <= 140; dx += 35) {
        for (let dy = -90; dy <= 90; dy += 30) {
          const p = { x: (sx + dx - cam.panX) / cam.scale, y: (sy + dy - cam.panY) / cam.scale };
          if (drawingsHitBy(list, p, 20).length) return false;
        }
      }
      return true;
    };
    for (let sx = 300; sx <= 1200; sx += 60) {
      for (let sy = 200; sy <= 1000; sy += 60) if (clear(sx, sy)) return { x: sx, y: sy };
    }
    throw new Error("không tìm được khoảng trống nào để thử cử chỉ gạch xoá");
  })();
  log(`khoảng trống để thử gạch xoá: ${scrArea.x},${scrArea.y}`);

  // Nét ngoằn ngoèo: chạy ngang `legs` nhát, mỗi nhát vọt lên/xuống `amp`. Nhả
  // tay ngay, không dừng lại — nếu dừng thì bộ đếm bắt hình sẽ chen vào trước.
  const scrawl = async (cx, cy, legs, amp) => {
    const step = 30;
    const x0 = cx - (legs * step) / 2;
    await act(async () => {
      mouse("mousedown", x0, cy, penCapture());
      for (let k = 1; k <= legs; k++) {
        mouse("mousemove", x0 + k * step, cy + (k % 2 ? amp : -amp));
        await new Promise((r) => setTimeout(r, 12));
      }
    });
    const endX = x0 + legs * step, endY = cy + (legs % 2 ? amp : -amp);
    await act(async () => { mouse("mouseup", endX, endY); await new Promise((r) => setTimeout(r, 80)); });
  };
  const drawingIds = () => {
    const put = globalThis.__puts[globalThis.__puts.length - 1];
    return (put.drawings || []).map((d) => d.id);
  };

  // Một nét thẳng nằm ngang để mà gạch.
  await act(async () => {
    mouse("mousedown", scrArea.x - 130, scrArea.y, penCapture());
    mouse("mousemove", scrArea.x - 40, scrArea.y);
    mouse("mousemove", scrArea.x + 50, scrArea.y);
    mouse("mousemove", scrArea.x + 130, scrArea.y);
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { mouse("mouseup", scrArea.x + 130, scrArea.y); await new Promise((r) => setTimeout(r, 60)); });
  const scrIdsBefore = drawingIds();
  const scrVictimId = scrIdsBefore[scrIdsBefore.length - 1];

  // Gạch đè lên nó. Giữa chừng, nét sắp mất phải MỜ ĐI — cử chỉ xoá mà không báo
  // trước thì người dùng không kịp nhấc tay ra khi nhắm sai.
  let dimmedMid = 0;
  const scrPutsBefore = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", scrArea.x - 120, scrArea.y, penCapture());
    for (let k = 1; k <= 8; k++) {
      mouse("mousemove", scrArea.x - 120 + k * 30, scrArea.y + (k % 2 ? 45 : -45));
      await new Promise((r) => setTimeout(r, 12));
    }
  });
  // Đọc DOM ở một lượt act RIÊNG: setEraseIds vừa gọi trong nhịp chuột cuối chỉ
  // được flush khi lượt act đang chạy kết thúc, nên đọc ngay trong đó thì bao giờ
  // cũng thấy trạng thái của nhịp trước.
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  dimmedMid = document.querySelectorAll(".ink-layer .erasing").length;
  await act(async () => { mouse("mouseup", scrArea.x + 120, scrArea.y - 45); await new Promise((r) => setTimeout(r, 80)); });
  const scrIdsAfter = drawingIds();
  log(`gạch xoá: giữa chừng ${dimmedMid} nét mờ đi · ${scrIdsBefore.length} → ${scrIdsAfter.length} nét`
    + ` · PUT thêm ${globalThis.__puts.length - scrPutsBefore} lần`);
  if (dimmedMid < 1) throw new Error("đang gạch mà nét sắp bị xoá không hề mờ đi — cử chỉ xoá không báo trước");
  if (scrIdsAfter.includes(scrVictimId)) throw new Error("gạch ngoằn ngoèo đè lên một nét mà nét đó vẫn còn");
  // Nét gạch là một CỬ CHỈ, không phải hình vẽ: nó không được nằm lại trên bảng.
  if (scrIdsAfter.length !== scrIdsBefore.length - 1) {
    throw new Error(`gạch xoá phải làm mất đúng 1 nét, số nét đi từ ${scrIdsBefore.length} xuống ${scrIdsAfter.length}`);
  }
  // Xoá được thì hoàn tác lại được — nó đi đúng đường của cục gôm.
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  });
  if (!drawingIds().includes(scrVictimId)) throw new Error("Ctrl+Z sau khi gạch xoá không trả lại nét đã mất");
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  });

  // VAN AN TOÀN: gạch y hệt thế nhưng ở chỗ trống thì không xoá gì, và cái ngoằn
  // ngoèo đó được giữ lại làm một nét vẽ. Không có vế này thì không ai vẽ nổi
  // một cái răng cưa nữa.
  const freeIdsBefore = drawingIds();
  await scrawl(scrArea.x, scrArea.y + 160, 8, 45);
  const freeIdsAfter = drawingIds();
  log(`gạch ở chỗ trống: ${freeIdsBefore.length} → ${freeIdsAfter.length} nét (phải +1, nét ngoằn ngoèo được giữ)`);
  if (freeIdsAfter.length !== freeIdsBefore.length + 1) {
    throw new Error(`gạch ở chỗ trống phải để lại đúng nét đó, số nét đi từ ${freeIdsBefore.length} thành ${freeIdsAfter.length}`);
  }

  // TẮT đi thì nét gạch quay về làm một nét vẽ bình thường, kể cả khi đè lên nét khác.
  await act(async () => { scratchBtn().click(); await new Promise((r) => setTimeout(r, 30)); });
  if (scratchBtn().classList.contains("on")) throw new Error("không tắt được gạch xoá");
  const offIdsBefore = drawingIds();
  const offVictim = offIdsBefore[offIdsBefore.length - 1];
  await scrawl(scrArea.x, scrArea.y + 160, 8, 45);
  const offIdsAfter = drawingIds();
  log(`tắt gạch xoá rồi gạch đè lên nét: ${offIdsBefore.length} → ${offIdsAfter.length} nét (phải +1)`);
  if (!offIdsAfter.includes(offVictim)) throw new Error("đã tắt gạch xoá mà nét bị gạch vẫn mất");
  if (offIdsAfter.length !== offIdsBefore.length + 1) throw new Error("đã tắt gạch xoá mà nét gạch không được lưu lại");
  await act(async () => { scratchBtn().click(); await new Promise((r) => setTimeout(r, 30)); });
  if (!scratchBtn().classList.contains("on")) throw new Error("không bật lại được gạch xoá");

  // CỤC GÔM không được dính cử chỉ đổi nét đứt: ở đó cú bấm ĐÃ CÓ VIỆC (xoá nét
  // ngay từ cú bấm đầu), chồng thêm là vừa xoá vừa đổi. Bài này sinh ra từ một
  // lỗi thật: chốt loại trừ viết `mode === "ink"` trong khi giá trị thật là
  // "draw", nên nó chưa bao giờ đúng và cử chỉ vẫn ăn ở cục gôm.
  await act(async () => { railBtn("Cục gôm").click(); await new Promise((r) => setTimeout(r, 30)); });
  const eraserCapture = document.querySelector(".ink-capture");
  const putsBeforeEraserDbl = globalThis.__puts.length;
  const eraserHit = toScreenPen(penTriTarget.pts[0], penTriTarget.pts[1]);
  await act(async () => {
    for (let i = 0; i < 2; i++) {
      mouse("mousedown", eraserHit.x, eraserHit.y, eraserCapture);
      mouse("mouseup", eraserHit.x, eraserHit.y);
      eraserCapture.dispatchEvent(new window.MouseEvent("click", {
        bubbles: true, clientX: eraserHit.x, clientY: eraserHit.y, button: 0
      }));
    }
    await settle();
  });
  const eraserPut = globalThis.__puts[globalThis.__puts.length - 1];
  const survivor = eraserPut.drawings.find((d) => d.id === penTriTarget.id);
  log(`cục gôm + bấm 2 lần: PUT thêm ${globalThis.__puts.length - putsBeforeEraserDbl} lần`
    + ` · hình còn lại = ${!!survivor}${survivor ? ` dashed=${survivor.dashed}` : ""}`);
  if (survivor && survivor.dashed) throw new Error("bấm 2 lần khi đang cầm CỤC GÔM lại đổi nét đứt — chốt loại trừ không ăn");
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 30)); });

  // VẼ vẫn phải bình thường: cú bấm CÓ DI vẫn ra nét, không bị cử chỉ chọn nuốt.
  const pathsBeforeStillDraw = document.querySelectorAll(".ink-layer path").length;
  await act(async () => {
    mouse("mousedown", 1450, 1100, penCapture());
    for (const x of [1500, 1550, 1600]) mouse("mousemove", x, 1100 + (x % 7));
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", 1600, 1100); await new Promise((r) => setTimeout(r, 60)); });
  log(`bút vẫn vẽ được: ${pathsBeforeStillDraw} → ${document.querySelectorAll(".ink-layer path").length} path`);
  if (document.querySelectorAll(".ink-layer path").length !== pathsBeforeStillDraw + 1) {
    throw new Error("cử chỉ bấm-để-chọn đã nuốt mất cú vẽ bình thường");
  }

  // ═══ CỤC GÔM: HAI KIỂU TẨY, VÀ CỬ CHỈ ĐỔI BÚT ↔ CỤC GÔM ═════════════════════

  await act(async () => { railBtn("Cục gôm").click(); await new Promise((r) => setTimeout(r, 30)); });
  const erasePicks = () => document.querySelectorAll(".tool-options .erase-pick");
  const eraseWidths = () => document.querySelectorAll(".tool-options .erase-width");
  log(`khu 4 của cục gôm: ${erasePicks().length} kiểu tẩy · ${eraseWidths().length} nút cỡ (đang ở kiểu "cả nét" nên phải là 0)`);
  if (erasePicks().length !== 2) throw new Error(`cục gôm phải có 2 kiểu tẩy, có ${erasePicks().length}`);
  // Ở kiểu "cả nét" thì bề rộng KHÔNG có tác dụng gì — để ba nút cỡ nằm đó là
  // mời người dùng chỉnh một thứ không đổi được gì.
  if (eraseWidths().length !== 0) throw new Error("kiểu \"cả nét\" không dùng tới bề rộng — ba nút cỡ không được hiện");

  await act(async () => { erasePicks()[1].click(); await new Promise((r) => setTimeout(r, 30)); });
  log(`chọn "tẩy theo độ rộng": ${eraseWidths().length} nút cỡ hiện ra`);
  if (eraseWidths().length !== 3) throw new Error(`kiểu theo độ rộng phải hiện 3 nút cỡ, có ${eraseWidths().length}`);
  await act(async () => { eraseWidths()[1].click(); await new Promise((r) => setTimeout(r, 30)); });

  // Một DẢI NGANG trống để vẽ nét thí nghiệm rồi cắt nó. Dò bằng đúng hàm
  // hit-test của ứng dụng, cùng lý do với emptyBg ở khối trên: tới đây bảng đã
  // đầy nét, viết cứng toạ độ thì nhát cắt sẽ ăn nhầm nét của bài khác và test
  // đỏ ở chỗ chẳng liên quan.
  const bandX0 = 700, bandX1 = 1400;
  const clearAt = (list, cam, sx, sy, pad) => {
    const p = { x: (sx - cam.panX) / cam.scale, y: (sy - cam.panY) / cam.scale };
    return !drawingsHitBy(list, p, pad).length;
  };
  const cutRow = (() => {
    const cam = camera();
    const list = (globalThis.__puts[globalThis.__puts.length - 1].drawings) || [];
    for (let sy = 200; sy <= 1000; sy += 25) {
      let ok = true;
      // Trống cả theo chiều NGANG (chỗ đặt nét) lẫn chiều DỌC ±80 (chỗ rê cục
      // tẩy cắt ngang qua nó).
      for (let sx = bandX0 - 40; sx <= bandX1 + 40 && ok; sx += 20) {
        for (const dy of [-80, -40, 0, 40, 80]) if (!clearAt(list, cam, sx, sy + dy, 30)) { ok = false; break; }
      }
      if (ok) return sy;
    }
    throw new Error("không tìm được dải ngang trống nào để thử cục tẩy theo độ rộng");
  })();
  log(`dải trống để thử cắt nét: y=${cutRow}`);

  // Vẽ một nét NGANG DÀI bằng bút.
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 30)); });
  await act(async () => {
    mouse("mousedown", bandX0, cutRow, penCapture());
    for (let x = bandX0 + 50; x <= bandX1; x += 50) mouse("mousemove", x, cutRow);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", bandX1, cutRow); await new Promise((r) => setTimeout(r, 60)); });
  const longPut = globalThis.__puts[globalThis.__puts.length - 1];
  const longStroke = longPut.drawings[longPut.drawings.length - 1];
  if (longStroke.kind !== "pen") throw new Error(`nét thí nghiệm phải là nét bút, ra "${longStroke.kind}"`);
  const beforeCutIds = new Set(longPut.drawings.map((d) => d.id));
  const longX0 = Math.min(longStroke.pts[0], longStroke.pts[longStroke.pts.length - 2]);
  const longX1 = Math.max(longStroke.pts[0], longStroke.pts[longStroke.pts.length - 2]);

  // RÊ CỤC TẨY cắt ngang qua giữa nét đó.
  await act(async () => { railBtn("Cục gôm").click(); await new Promise((r) => setTimeout(r, 30)); });
  const cutMidX = Math.round((bandX0 + bandX1) / 2);
  await act(async () => {
    mouse("mousedown", cutMidX, cutRow - 60, document.querySelector(".ink-capture"));
    for (const dy of [-40, -20, 0, 20, 40, 60]) mouse("mousemove", cutMidX, cutRow + dy);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", cutMidX, cutRow + 60); await new Promise((r) => setTimeout(r, 80)); });
  const cutPut = globalThis.__puts[globalThis.__puts.length - 1];
  const fragments = cutPut.drawings.filter((d) => !beforeCutIds.has(d.id) && d.kind === "pen");
  const originalGone = !cutPut.drawings.some((d) => d.id === longStroke.id);
  log(`tẩy theo độ rộng: nét gốc còn = ${!originalGone} · cắt ra ${fragments.length} mảnh`);
  if (!originalGone) throw new Error("nét bị cắt vẫn còn nguyên bản cũ trong bảng — mảnh mới và nét cũ đang cùng tồn tại");
  if (fragments.length !== 2) throw new Error(`cắt ngang giữa một nét thẳng phải ra đúng 2 mảnh, ra ${fragments.length}`);

  // Hai mảnh phải nằm HAI BÊN nhát cắt và chừa ra một khoảng hở ở giữa — nếu
  // không thì nó chỉ xoá nét rồi vẽ lại y hệt, chứ không cắt gì cả.
  const spanOf = (d) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i + 1 < d.pts.length; i += 2) { lo = Math.min(lo, d.pts[i]); hi = Math.max(hi, d.pts[i]); }
    return { lo, hi };
  };
  const spans = fragments.map(spanOf).sort((a, b) => a.lo - b.lo);
  const gap = spans[1].lo - spans[0].hi;
  log(`  hai mảnh: [${Math.round(spans[0].lo)}…${Math.round(spans[0].hi)}] và [${Math.round(spans[1].lo)}…${Math.round(spans[1].hi)}] · hở ${Math.round(gap)}`);
  if (!(gap > 0)) throw new Error(`hai mảnh phải chừa ra một khoảng hở, đo được ${gap}`);
  // Hai đầu NGOÀI của nét gốc phải còn nguyên: cục tẩy chỉ đi qua giữa.
  if (Math.abs(spans[0].lo - longX0) > 3 || Math.abs(spans[1].hi - longX1) > 3) {
    throw new Error("hai đầu ngoài của nét bị xê dịch — nhát cắt ăn cả phần cục tẩy chưa đi qua");
  }
  // Mảnh vẫn là chính cái nét đó, chỉ ngắn đi.
  for (const f of fragments) {
    if (f.color !== longStroke.color || f.w !== longStroke.w) {
      throw new Error("mảnh cắt ra không giữ màu / độ dày của nét gốc");
    }
    // `from` là dữ liệu NỘI BỘ của lượt tẩy (nét gốc nào đẻ ra mảnh này, để đặt
    // nó đúng tầng trên/dưới). Nó phải bị bóc ra ở chỗ commit, không được lưu.
    if ("from" in f) throw new Error("mảnh cắt ra vẫn mang field `from` — dữ liệu nội bộ của lượt tẩy lọt vào bảng");
  }

  // ——— Cắt được cả HÌNH KHỐI, không riêng nét bút ———
  //
  // Đây là bài quan trọng nhất của khối này, và nó sinh ra từ một lỗi thật: bản
  // đầu chỉ cắt kind "pen". Mà cử chỉ giữ-tay-để-bắt-hình biến nét bút THÀNH
  // HÌNH, nên trên một cái bảng dùng thật thì phần lớn thứ trông như nét vẽ lại
  // có kind là triangle/rect/ellipse — và cục tẩy theo độ rộng gặp gì cũng xoá
  // cả cục, đúng ngược với thứ nó hứa.
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 30)); });
  const boxTop = cutRow + 150;
  const boxPath = [[bandX0 + 80, boxTop], [bandX0 + 320, boxTop], [bandX0 + 320, boxTop + 160], [bandX0 + 80, boxTop + 160]];
  await act(async () => {
    mouse("mousedown", boxPath[0][0], boxPath[0][1], penCapture());
    const loop = boxPath.concat([boxPath[0]]);
    for (let i = 0; i + 1 < loop.length; i++) {
      const [ax, ay] = loop[i], [bx, by] = loop[i + 1];
      for (let k = 1; k <= 8; k++) mouse("mousemove", ax + (bx - ax) * (k / 8), ay + (by - ay) * (k / 8));
    }
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, SNAP_HOLD_MS + 400)); });
  await act(async () => { mouse("mouseup", boxPath[0][0], boxPath[0][1]); await new Promise((r) => setTimeout(r, 80)); });
  const shapePut = globalThis.__puts[globalThis.__puts.length - 1];
  const cutTarget = shapePut.drawings[shapePut.drawings.length - 1];
  log(`vẽ + giữ tay ra một HÌNH: kind="${cutTarget.kind}"`);
  if (cutTarget.kind === "pen") throw new Error("bài này cần một HÌNH để cắt, giữ tay không bắt được hình nào");

  // Rê cục tẩy theo độ rộng ngang qua CẠNH TRÁI của cái hình đó.
  await act(async () => { railBtn("Cục gôm").click(); await new Promise((r) => setTimeout(r, 30)); });
  await act(async () => { erasePicks()[1].click(); await new Promise((r) => setTimeout(r, 30)); });
  const beforeShapeCut = new Set(shapePut.drawings.map((d) => d.id));
  const shapeEdgeX = bandX0 + 80;
  const shapeEdgeY = boxTop + 80;
  await act(async () => {
    mouse("mousedown", shapeEdgeX - 45, shapeEdgeY, document.querySelector(".ink-capture"));
    for (const dx of [-30, -15, 0, 15, 30, 45]) mouse("mousemove", shapeEdgeX + dx, shapeEdgeY);
    await new Promise((r) => setTimeout(r, 60));
  });
  await act(async () => { mouse("mouseup", shapeEdgeX + 45, shapeEdgeY); await new Promise((r) => setTimeout(r, 80)); });
  const shapeCutPut = globalThis.__puts[globalThis.__puts.length - 1];
  const shapeGone = !shapeCutPut.drawings.some((d) => d.id === cutTarget.id);
  const shapeParts = shapeCutPut.drawings.filter((d) => !beforeShapeCut.has(d.id));
  log(`tẩy theo độ rộng lên HÌNH "${cutTarget.kind}": hình cũ mất = ${shapeGone} · cắt ra ${shapeParts.length} mảnh kind="${shapeParts.map((p) => p.kind).join(",")}"`);
  if (!shapeGone) throw new Error("cục tẩy không đụng được vào hình");
  // Đây là chốt của cả bài: PHẢI còn mảnh. Không mảnh nào = đã xoá cả cục, tức
  // là lỗi cũ quay lại.
  if (!shapeParts.length) {
    throw new Error(`cục tẩy theo độ rộng XOÁ CẢ cái hình "${cutTarget.kind}" thay vì cắt nó — nhánh cắt lại chỉ nhận kind "pen"`);
  }
  for (const p of shapeParts) {
    if (p.kind !== "pen") throw new Error(`mảnh cắt từ hình phải thành nét bút, ra "${p.kind}"`);
  }
  // Cắt một chỗ trên một đường bao KÍN thì ra đúng MỘT mảnh: chỗ mối nối (điểm
  // đầu trùng điểm cuối) phải được nối lại, không thì mỗi lần chạm vào một hình
  // là bảng đẻ thêm một bản ghi vô cớ.
  if (shapeParts.length !== 1) throw new Error(`cắt một nhát vào hình kín phải ra 1 mảnh, ra ${shapeParts.length}`);

  // KIỂU "CẢ NÉT" vẫn phải nguyên như cũ: quét trúng là mất trọn mảnh, không
  // cắt thêm mảnh con nào nữa.
  await act(async () => { erasePicks()[0].click(); await new Promise((r) => setTimeout(r, 30)); });
  const cutVictim = fragments.sort((a, b) => spanOf(a).lo - spanOf(b).lo)[0];
  const camCut = camera();
  const cutVictimMid = {
    x: ((cutVictim.pts[0] + cutVictim.pts[cutVictim.pts.length - 2]) / 2) * camCut.scale + camCut.panX,
    y: cutVictim.pts[1] * camCut.scale + camCut.panY
  };
  // Mốc so sánh phải lấy NGAY TRƯỚC cú quét này, không mượn lại mốc của bài
  // trên: giữa hai bài còn một bài khác đã thêm nét vào bảng.
  const beforeWholeIds = new Set(globalThis.__puts[globalThis.__puts.length - 1].drawings.map((d) => d.id));
  await act(async () => {
    mouse("mousedown", cutVictimMid.x, cutVictimMid.y, document.querySelector(".ink-capture"));
    mouse("mousemove", cutVictimMid.x + 12, cutVictimMid.y);
    await new Promise((r) => setTimeout(r, 40));
  });
  await act(async () => { mouse("mouseup", cutVictimMid.x + 12, cutVictimMid.y); await new Promise((r) => setTimeout(r, 80)); });
  const wholePut = globalThis.__puts[globalThis.__puts.length - 1];
  const wholeAdded = wholePut.drawings.filter((d) => !beforeWholeIds.has(d.id));
  const cutVictimGone = !wholePut.drawings.some((d) => d.id === cutVictim.id);
  log(`tẩy cả nét: mảnh bị chạm mất hẳn = ${cutVictimGone} · sinh thêm ${wholeAdded.length} nét (phải là 0)`);
  if (!cutVictimGone) throw new Error("kiểu \"cả nét\" chạm vào mà nét không mất");
  if (wholeAdded.length !== 0) throw new Error(`kiểu "cả nét" không được đẻ ra mảnh nào, đẻ ra ${wholeAdded.length}`);

  // ——— Giữ tay ở CHỖ TRỐNG = đổi bút ↔ cục gôm ———
  const freeSpot = (() => {
    const cam = camera();
    const list = (globalThis.__puts[globalThis.__puts.length - 1].drawings) || [];
    for (let sx = 660; sx <= 1500; sx += 40) {
      for (let sy = 160; sy <= 1000; sy += 40) if (clearAt(list, cam, sx, sy, 40)) return { x: sx, y: sy };
    }
    throw new Error("không tìm được chỗ trống nào để thử cử chỉ đổi tool");
  })();
  const toolOn = () => (railBtn("Bút").classList.contains("on") ? "Bút" : (railBtn("Cục gôm").classList.contains("on") ? "Cục gôm" : "?"));
  const holdAt = async (p, moveAway) => {
    await act(async () => {
      mouse("mousedown", p.x, p.y, document.querySelector(".ink-capture"));
      if (moveAway) { mouse("mousemove", p.x + 120, p.y + 90); }
      await new Promise((r) => setTimeout(r, HOLD_SWAP_MS + 250));
    });
    await act(async () => { mouse("mouseup", p.x, p.y); await new Promise((r) => setTimeout(r, 60)); });
  };

  const putsBeforeSwap = globalThis.__puts.length;
  const toolBeforeSwap = toolOn();
  await holdAt(freeSpot, false);
  log(`giữ tay ở chỗ trống (đang cầm ${toolBeforeSwap}): giờ đang cầm ${toolOn()} · PUT thêm ${globalThis.__puts.length - putsBeforeSwap} lần (phải là 0)`);
  if (toolBeforeSwap !== "Cục gôm") throw new Error(`bài này phải bắt đầu từ cục gôm, đang cầm ${toolBeforeSwap}`);
  if (toolOn() !== "Bút") throw new Error(`giữ tay ở chỗ trống khi đang cầm cục gôm phải đổi sang bút, vẫn là ${toolOn()}`);
  // Cử chỉ này KHÔNG được là một thao tác sửa dữ liệu: nó chỉ đổi thứ đang cầm.
  if (globalThis.__puts.length !== putsBeforeSwap) throw new Error("cử chỉ đổi tool lại ghi thêm một bản lưu");

  // Chiều ngược lại.
  await holdAt(freeSpot, false);
  log(`giữ tay lần nữa: giờ đang cầm ${toolOn()}`);
  if (toolOn() !== "Cục gôm") throw new Error(`giữ tay ở chỗ trống khi đang cầm bút phải đổi sang cục gôm, vẫn là ${toolOn()}`);

  // GIỮ RỒI DI TAY thì KHÔNG đổi: cú đó là một cú quét/vẽ thật. Thiếu chốt này
  // thì dừng tay giữa một cú quét dài là mất trắng đoạn vừa quét.
  await holdAt(freeSpot, true);
  log(`giữ rồi DI tay: vẫn đang cầm ${toolOn()} (phải là Cục gôm)`);
  if (toolOn() !== "Cục gôm") throw new Error("rê tay đi rồi mà cử chỉ đổi tool vẫn ăn — bộ đếm không bị huỷ khi tay rời chỗ ấn");

  // Ấn TRÚNG MỘT NÉT thì cử chỉ đổi tool không được ăn — ở đó cú ấn đã có việc.
  const survivorFrag = wholePut.drawings.find((d) => d.kind === "pen" && d.id !== cutVictim.id && !beforeCutIds.has(d.id));
  if (survivorFrag) {
    await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 30)); });
    const onStroke = {
      x: ((survivorFrag.pts[0] + survivorFrag.pts[survivorFrag.pts.length - 2]) / 2) * camera().scale + camera().panX,
      y: survivorFrag.pts[1] * camera().scale + camera().panY
    };
    await holdAt(onStroke, false);
    log(`bút + giữ tay TRÊN một nét: đang cầm ${toolOn()} (phải là Bút — đó là cử chỉ tẩy, không phải đổi tool)`);
    if (toolOn() !== "Bút") throw new Error("giữ tay trên một nét lại đổi tool — cử chỉ tẩy và cử chỉ đổi tool đang giẫm chân nhau");
  }

  // ——— VẼ CHẬM KHÔNG ĐƯỢC BỊ CƯỚP MẤT TOOL ———
  //
  // Bộ đếm "giữ ở chỗ trống để đổi bút ↔ cục gôm" lên nòng ngay từ mousedown.
  // Thứ giết nó phải là "tay đã rời chỗ ấn xuống" — một phép đo riêng, không
  // dính gì tới bắt hình. Trước đây nó chết nhờ ăn may: lời gọi lên nòng bắt
  // hình tình cờ dọn hộ. Khi cửa chặn của bắt hình chuyển sang đo VẬN TỐC thì
  // cái ăn may đó mất, và nét nào vẽ chậm hơn 36 px/giây sẽ bị đổi tool giữa
  // chừng rồi mất trắng. Ở đây vẽ 20 px/giây, tức tổng 1 giây — dài hơn hẳn
  // 650ms của bộ đếm đổi tool.
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 30)); });
  await act(async () => { mouse("mousedown", freeSpot.x, freeSpot.y, document.querySelector(".ink-capture")); });
  for (let i = 1; i <= 10; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
      mouse("mousemove", freeSpot.x + i * 2, freeSpot.y);
    });
  }
  await act(async () => { mouse("mouseup", freeSpot.x + 20, freeSpot.y); await new Promise((r) => setTimeout(r, 60)); });
  log(`vẽ CHẬM 20px/giây ở chỗ trống: vẫn đang cầm ${toolOn()} (phải là Bút)`);
  if (toolOn() !== "Bút") {
    throw new Error("vẽ chậm mà bị đổi sang cục gôm — bộ đếm đổi tool không chết khi tay rời chỗ ấn,"
      + " nên nó nổ giữa nét và nuốt mất nét đang vẽ");
  }

  // ——— BẮT ĐOẠN THẲNG VỚI BÀN TAY TRÔI ———
  //
  // ĐÂY LÀ LỖI NGƯỜI DÙNG BÁO: "bắt đoạn thẳng lúc được lúc không". Không phải
  // phép nhận hình sai — bắn 3200 nét thẳng mô phỏng qua snapShape thì 3200 nét
  // đều ra "line". Cái sai là ở CỬA CHẶN của cử chỉ: bản trước chốt một mốc rồi
  // đòi tay ở lì trong bán kính 6px của mốc đó suốt thời gian chờ, mà bàn tay tì
  // trên chuột thì trôi đều 8–25 px/giây, nên cứ chừng 400ms là đồng hồ về 0 và
  // cử chỉ KHÔNG BAO GIỜ nổ. Ai tay chắc thì chạy, ai tay hơi trượt thì chịu.
  //
  // Test này giữ tay nhưng KHÔNG đứng im: trôi đều chừng 15 px/giây, tổng cộng
  // đi hơn 20px — gấp mấy lần cái ngưỡng 6px cũ. Chạy trên code cũ thì nó treo ở
  // đây, không có PUT nào cả.
  await act(async () => { railBtn("Bút").click(); await new Promise((r) => setTimeout(r, 30)); });
  const driftRow = (() => {
    const cam = camera();
    const list = (globalThis.__puts[globalThis.__puts.length - 1].drawings) || [];
    for (let sy = 220; sy <= 1000; sy += 25) {
      let ok = true;
      for (let sx = 700; sx <= 1300 && ok; sx += 25) {
        for (const dy of [-60, 0, 60]) if (!clearAt(list, cam, sx, sy + dy, 30)) { ok = false; break; }
      }
      if (ok) return sy;
    }
    throw new Error("không tìm được dải trống nào để thử bắt đoạn thẳng");
  })();
  const putsBeforeDrift = globalThis.__puts.length;
  await act(async () => {
    mouse("mousedown", 700, driftRow, document.querySelector(".ink-capture"));
    // Nét thẳng, đủ điểm để qua MIN_POINTS của recognize.js.
    for (let i = 1; i <= 12; i++) mouse("mousemove", 700 + i * 50, driftRow);
    await new Promise((r) => setTimeout(r, 40));
  });
  // Giữ tay: mỗi 45ms nhích 0,7px ⇒ ~15 px/giây, đúng kiểu bàn tay trượt trên
  // chuột. Phải rải ra theo THỜI GIAN THẬT, không dồn một cục — cả phép đo mới
  // nằm ở chỗ nó đọc vận tốc qua một cửa sổ thời gian.
  let driftX = 1300, driftY = driftRow;
  for (let i = 0; i < 34; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 45));
      driftX += 0.7;
      driftY += 0.25;
      mouse("mousemove", Math.round(driftX), Math.round(driftY));
    });
  }
  await act(async () => {
    mouse("mouseup", Math.round(driftX), Math.round(driftY));
    await new Promise((r) => setTimeout(r, 80));
  });
  const driftPuts = globalThis.__puts.length - putsBeforeDrift;
  if (driftPuts !== 1) {
    throw new Error(`giữ tay với bàn tay TRÔI phải bắt được hình và lưu đúng 1 lần, lưu ${driftPuts} lần`
      + " — cửa chặn của cử chỉ lại đang cộng dồn cái trôi tay thay vì đo vận tốc");
  }
  const driftPut = globalThis.__puts[globalThis.__puts.length - 1];
  const drifted = driftPut.drawings[driftPut.drawings.length - 1];
  log(`giữ tay TRÔI ${Math.round(driftX - 1300)}px trong lúc chờ: kind="${drifted.kind}"`
    + ` (mốc cứng 6px của bản cũ đã chết ở đây)`);
  if (drifted.kind !== "line") throw new Error(`phải bắt ra "line", ra "${drifted.kind}"`);

  // ——— GÕ CHỮ CŨNG PHẢI REALTIME ———
  //
  // Trước đây chữ chỉ đi qua PUT lúc chốt, nên người khác không thấy gì suốt cả
  // lúc mình đang gõ — khác hẳn nét bút và hình khối, vốn hiện ngay từng nhịp.
  // Kiểm CẢ HAI CHIỀU vì chúng hỏng độc lập nhau.
  await act(async () => { railBtn("Text").click(); await new Promise((r) => setTimeout(r, 30)); });

  // CHIỀU PHÁT: mở ô nhập rồi gõ → phải có gói seq 0 mang màu/cỡ chữ, rồi gói
  // giữa chừng mang chữ, rồi gói done mang id vừa lưu.
  const liveTextBefore = globalThis.__emitted.length;
  await act(async () => {
    mouse("mousedown", 420, 300, document.querySelector(".ink-capture"));
    await new Promise((r) => setTimeout(r, 30));
  });
  const liveTa = document.querySelector("textarea.text-input");
  if (!liveTa) throw new Error("bấm bằng tool text phải mở ô nhập");
  for (const chunk of ["đang", "đang gõ", "đang gõ dở"]) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(liveTa, chunk);
      liveTa.dispatchEvent(new window.Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
    });
  }
  const midPkts = globalThis.__emitted.slice(liveTextBefore)
    .filter((e) => e[0] === "live:ink").map((e) => e[1]);
  const openPkt = midPkts.find((p) => p.seq === 0);
  const typedPkts = midPkts.filter((p) => p.kind === "text" && p.seq > 0);
  log(`gõ chữ: phát ${midPkts.length} gói live:ink · gói mở kind="${openPkt?.kind}" size=${openPkt?.size}`
    + ` · gói giữa chừng mang chữ: ${typedPkts.map((p) => JSON.stringify(p.text)).join(" → ")}`);
  if (!openPkt || openPkt.kind !== "text") throw new Error("gõ chữ phải phát gói live:ink kind=\"text\"");
  if (!Number.isFinite(openPkt.size)) throw new Error("gói mở phải mang cỡ chữ — người nhận không đoán được");
  if (openPkt.pts.length !== 2) throw new Error("chữ neo bằng ĐÚNG một điểm, gói mang " + openPkt.pts.length + " số");
  if (!typedPkts.length) throw new Error("gõ mà không phát gói nào — chữ vẫn không realtime");
  if (typedPkts[typedPkts.length - 1].text !== "đang gõ dở") {
    throw new Error(`gói cuối phải mang trọn đoạn đang gõ, mang "${typedPkts[typedPkts.length - 1].text}"`);
  }
  await act(async () => {
    liveTa.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.querySelector("textarea.text-input")?.blur();
    await new Promise((r) => setTimeout(r, 60));
  });
  const donePkt = globalThis.__emitted.slice(liveTextBefore)
    .filter((e) => e[0] === "live:ink").map((e) => e[1]).filter((p) => p.done === true).pop();
  log(`chốt lượt gõ: gói done drawingId=${donePkt?.drawingId}`);
  if (!donePkt || !Number.isFinite(donePkt.drawingId)) {
    throw new Error("chốt lượt gõ phải phát gói done kèm id vừa lưu, không thì overlay của người khác treo lại 6 giây");
  }

  // CHIỀU NHẬN: gói của người khác phải hiện ra chữ, và phải GIẤU bản đã lưu của
  // đoạn họ đang sửa — để cả hai cùng hiện thì mỗi ký tự xoá đi lại lòi ra một
  // mẩu chữ cũ nằm dưới.
  const savedTextEl = (globalThis.__puts[globalThis.__puts.length - 1].drawings || [])
    .filter((d) => d.kind === "text").pop();
  if (!savedTextEl) throw new Error("không tìm thấy đoạn text vừa lưu để thử chiều nhận");
  const textElsBefore = document.querySelectorAll(".ink-layer text").length;
  await act(async () => {
    globalThis.__deliver("live:ink", {
      socketId: "peer9", strokeId: 1, seq: 0, kind: "text",
      color: "pen-blue", size: 24, text: "người khác gõ", editId: savedTextEl.id,
      pts: [savedTextEl.pts[0], savedTextEl.pts[1] + 200]
    });
    await new Promise((r) => setTimeout(r, 40));
  });
  const textElsAfter = document.querySelectorAll(".ink-layer text").length;
  const shown = Array.from(document.querySelectorAll(".ink-layer text"))
    .some((el) => el.textContent === "người khác gõ");
  log(`nhận gói chữ của người khác: <text> ${textElsBefore} → ${textElsAfter}`
    + ` · hiện đúng chữ = ${shown} · bản đã lưu (id ${savedTextEl.id}) bị giấu = ${textElsAfter === textElsBefore}`);
  if (!shown) throw new Error("gói chữ của người khác không hiện ra");
  if (textElsAfter !== textElsBefore) {
    throw new Error("đoạn text người kia đang sửa phải bị GIẤU đi, đang chồng hai lớp chữ lên nhau");
  }
  // Gõ tiếp: gói giữa chừng phải THAY cả đoạn, không nối thêm.
  await act(async () => {
    globalThis.__deliver("live:ink", {
      socketId: "peer9", strokeId: 1, seq: 1, kind: "text", text: "người khác gõ xong",
      pts: [savedTextEl.pts[0], savedTextEl.pts[1] + 200]
    });
    await new Promise((r) => setTimeout(r, 40));
  });
  const liveGrown = Array.from(document.querySelectorAll(".ink-layer text"))
    .some((el) => el.textContent === "người khác gõ xong");
  log(`gói giữa chừng của người khác: thay được cả đoạn = ${liveGrown}`);
  if (!liveGrown) throw new Error("gói chữ giữa chừng không cập nhật được đoạn văn");

  // ——— KÉO NÉT CŨNG PHẢI REALTIME ———
  //
  // Trước đây IdeaMap còn ghi chú thừa nhận chỗ này: gói geom chỉ chở thẻ và
  // khung, nên nét vẽ / hình / chữ bị kéo thì người khác chỉ thấy nó nhảy tới
  // chỗ mới ở lần lưu.
  await act(async () => { railBtn("Chuột").click(); await new Promise((r) => setTimeout(r, 30)); });
  const moveViewport = document.querySelector(".viewport");
  const moveBoard0 = globalThis.__puts[globalThis.__puts.length - 1];
  const moveTarget = (moveBoard0.drawings || []).find((d) => d.kind === "pen" && (d.pts || []).length >= 4);
  if (!moveTarget) throw new Error("không tìm thấy nét bút nào để thử kéo");
  const moveCam = camera();
  const grabX = Math.round(moveTarget.pts[0] * moveCam.scale + moveCam.panX);
  const grabY = Math.round(moveTarget.pts[1] * moveCam.scale + moveCam.panY);
  const moveEmitBefore = globalThis.__emitted.length;
  await act(async () => {
    mouse("mousedown", grabX, grabY, moveViewport);
    await new Promise((r) => setTimeout(r, 20));
  });
  for (let i = 1; i <= 5; i++) {
    await act(async () => {
      mouse("mousemove", grabX + i * 14, grabY + i * 9);
      await new Promise((r) => setTimeout(r, 55));
    });
  }
  const movePkts = globalThis.__emitted.slice(moveEmitBefore)
    .filter((e) => e[0] === "live:ink").map((e) => e[1]).filter((p) => Array.isArray(p.moving));
  if (!movePkts.length) throw new Error("kéo nét mà không phát gói `moving` nào — vẫn chưa realtime");
  const lastMoving = movePkts[movePkts.length - 1].moving[0];
  // Tra lại nét theo ĐÚNG id mà gói báo, thay vì đòi nó phải là nét mình nhắm:
  // cuối phiên smoke bảng đã dày nét, cú bấm có thể trúng nét khác — mà điều cần
  // kiểm là "gói mang trạng thái tuyệt đối của một nét ĐÃ DỜI", không phải là
  // "cú bấm trúng đúng nét nào".
  const movedOrig = (moveBoard0.drawings || []).find((d) => d.id === lastMoving.id);
  log(`kéo nét: phát ${movePkts.length} gói \`moving\` · gói cuối mang ${movePkts[movePkts.length - 1].moving.length} nét`
    + ` · id ${lastMoving.id} kind="${movedOrig?.kind}"`);
  if (!movedOrig) throw new Error("gói dời mang id không có trong board");
  // Trạng thái TUYỆT ĐỐI, không phải độ dời: đây là thứ giữ cho việc đắp overlay
  // lên một board đã cập nhật là phép rỗng thay vì dời lần thứ hai.
  if (lastMoving.pts.length !== movedOrig.pts.length) {
    throw new Error(`gói dời phải mang trọn pts hiện tại (${movedOrig.pts.length} số), mang ${lastMoving.pts.length}`);
  }
  if (lastMoving.pts[0] === movedOrig.pts[0] && lastMoving.pts[1] === movedOrig.pts[1]) {
    throw new Error("gói dời mang pts CŨ — nó đang phát vị trí gốc chứ không phát vị trí hiện tại");
  }
  await act(async () => {
    mouse("mouseup", grabX + 70, grabY + 45);
    await new Promise((r) => setTimeout(r, 60));
  });
  const moveDone = globalThis.__emitted.slice(moveEmitBefore)
    .filter((e) => e[0] === "live:ink").map((e) => e[1]).filter((p) => p.done && Array.isArray(p.moving)).pop();
  log(`chốt cú kéo: gói done mang ${moveDone?.moving.length} nét (phải cầm cự tới lúc board:update về)`);
  if (!moveDone) throw new Error("chốt cú kéo phải phát gói done kèm trạng thái CUỐI, không thì cụm nhảy về chỗ cũ rồi nhảy lại");

  // CHIỀU NHẬN: gói của người khác phải DỜI nét sẵn có, không vẽ thêm bản thứ hai.
  const recvBoard = globalThis.__puts[globalThis.__puts.length - 1];
  const recvTarget = (recvBoard.drawings || []).find((d) => d.kind === "pen" && (d.pts || []).length >= 4);
  if (recvTarget) {
    const pathsBefore = document.querySelectorAll(".ink-layer path").length;
    await act(async () => {
      globalThis.__deliver("live:ink", {
        socketId: "peer8", strokeId: 77, seq: 1,
        moving: [{ id: recvTarget.id, pts: recvTarget.pts.map((v, i) => v + (i % 2 === 0 ? 400 : 250)) }]
      });
      await new Promise((r) => setTimeout(r, 40));
    });
    const pathsAfter = document.querySelectorAll(".ink-layer path").length;
    log(`nhận gói dời của người khác: số path ${pathsBefore} → ${pathsAfter} (phải bằng nhau — DỜI chứ không nhân bản)`);
    if (pathsAfter !== pathsBefore) {
      throw new Error("gói dời phải THAY vị trí nét sẵn có, không được vẽ thêm một bản thứ hai");
    }
  }

  // Game Flow là inspector cấp board, nên thử riêng phần form: thêm một bước
  // Player Loop, nhập dữ liệu, chọn card reference và lưu phải trả đúng shape.
  const flowHost = document.createElement("div");
  document.body.append(flowHost);
  const flowRoot = createRoot(flowHost);
  let savedFlow = null;
  await act(async () => {
    flowRoot.render(<GameDesignFlowPanel flow={null} nodes={[{ id: 1, title: "Dash" }]} canEdit onSave={(flow) => { savedFlow = flow; }} onClose={() => {}} />);
  });
  const flowAdd = flowHost.querySelector(".gd-flow-add");
  await act(async () => { flowAdd.click(); });
  const flowTitle = flowHost.querySelector("input");
  const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => {
    inputSetter.call(flowTitle, "Khám phá");
    flowTitle.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const reference = flowHost.querySelector("select[multiple]");
  reference.options[0].selected = true;
  await act(async () => { reference.dispatchEvent(new window.Event("change", { bubbles: true })); flowHost.querySelector(".gd-save").click(); });
  if (!savedFlow?.playerLoop?.length || savedFlow.playerLoop[0].title !== "Khám phá" || savedFlow.playerLoop[0].cardIds[0] !== "1") {
    throw new Error("Game Flow panel không lưu được bước Player Loop và card reference");
  }
  await act(async () => { flowHost.querySelector(".gd-flow-collapse").click(); });
  if (flowHost.querySelector(".gd-flow-item")) throw new Error("Game Flow không thu được section Player Loop");
  log(`Game flow: lưu ${savedFlow.playerLoop.length} bước · reference=${savedFlow.playerLoop[0].cardIds.join(",")}`);
  await act(async () => { flowRoot.unmount(); });
  flowHost.remove();

  const viewerHost = document.createElement("div");
  document.body.append(viewerHost);
  const viewerRoot = createRoot(viewerHost);
  await act(async () => {
    viewerRoot.render(<GameDesignFlowPanel flow={savedFlow} nodes={[{ id: 1, title: "Dash" }]} canEdit={false} onSave={() => { throw new Error("viewer không được lưu Game Flow"); }} onClose={() => {}} />);
  });
  if (!viewerHost.querySelector("input")?.disabled || viewerHost.querySelector(".gd-flow-add, .gd-save, .gd-journey-remove")) {
    throw new Error("viewer Game Flow còn control chỉnh sửa");
  }
  await act(async () => { viewerRoot.unmount(); });
  viewerHost.remove();

  // Chi tiết spec nằm trong từng thẻ GD: ba section phải thêm/sửa/xóa, thu gọn
  // được và khi lưu phải trả về shape có cấu trúc. Kiểm riêng panel để không
  // phụ thuộc vào màn đăng nhập hay thao tác canvas.
  const detailsHost = document.createElement("div");
  document.body.append(detailsHost);
  const detailsRoot = createRoot(detailsHost);
  const detailNode = { id: "detail-card", title: "Dash", desc: "", type: "mechanic", design: {} };
  let savedDetails = null;
  await act(async () => {
    detailsRoot.render(<GameDesignPanel node={detailNode} canEdit onSave={(next) => { savedDetails = next; }} onClose={() => {}} />);
  });
  const detailAdd = Array.from(detailsHost.querySelectorAll(".gd-detail-add")).find((button) => button.textContent.includes("ví dụ"));
  await act(async () => { detailAdd.click(); });
  const detailInput = detailsHost.querySelector(".gd-detail-item input");
  const detailInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => {
    detailInputSetter.call(detailInput, "Đòn lướt qua bẫy");
    detailInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const failureAdd = Array.from(detailsHost.querySelectorAll(".gd-detail-add")).find((button) => button.textContent.includes("failure state"));
  await act(async () => { failureAdd.click(); });
  const failureSection = Array.from(detailsHost.querySelectorAll(".gd-detail-section")).find((section) => section.textContent.includes("Failure States"));
  await act(async () => { failureSection.querySelector(".gd-detail-collapse").click(); });
  await act(async () => { failureSection.querySelector(".gd-detail-remove").click(); });
  if (failureSection.querySelector(".gd-detail-item")) throw new Error("Game Design details không xóa được failure state");
  await act(async () => { detailsHost.querySelector(".gd-save").click(); });
  if (savedDetails?.design?.examples?.[0]?.title !== "Đòn lướt qua bẫy") {
    throw new Error("Game Design panel không lưu được Example");
  }
  const detailSection = detailsHost.querySelector(".gd-detail-section");
  await act(async () => { detailSection.querySelector(".gd-detail-collapse").click(); });
  if (detailSection.querySelector(".gd-detail-list")) throw new Error("Game Design details không thu được section");
  await act(async () => { detailsRoot.unmount(); });
  detailsHost.remove();

  const detailViewerHost = document.createElement("div");
  document.body.append(detailViewerHost);
  const detailViewerRoot = createRoot(detailViewerHost);
  await act(async () => {
    detailViewerRoot.render(<GameDesignPanel node={savedDetails} canEdit={false} onSave={() => { throw new Error("viewer không được lưu details"); }} onClose={() => {}} />);
  });
  await act(async () => { detailViewerHost.querySelector(".gd-detail-collapse").click(); });
  if (!detailViewerHost.querySelector(".gd-detail-item input")?.disabled || detailViewerHost.querySelector(".gd-detail-add, .gd-detail-remove, .gd-save")) {
    throw new Error("viewer Game Design details còn control chỉnh sửa");
  }
  log("Game Design details: lưu Example, thu section, viewer read-only");
  await act(async () => { detailViewerRoot.unmount(); });
  detailViewerHost.remove();

  return true;
}
