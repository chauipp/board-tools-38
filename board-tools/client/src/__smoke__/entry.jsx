import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../lib/i18n.js";
import IdeaMap from "../pages/IdeaMap.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import { LASER_FADE_MS, LASER_WIDTHS } from "../lib/laser.js";
import { PEN_COLORS } from "../lib/pen.js";
import { BOARD_BGS, BOARD_GRIDS, COLOR_PACKS } from "../lib/board-theme.js";

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
  const edgeY = () => Array.from(document.querySelectorAll(".edge-layer g line.visible")).map((l) => l.getAttribute("y2")).join(",");
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
  if (picks !== 6) throw new Error("khu 4 phải có 6 nút chọn hình, có " + picks);
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
  // `mergeInkPacket` trong game-tools/client/src/lib/ink-live.test.js, không
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

  // Skin vẽ tay: lưới an toàn cho việc đổi <line> thành <path> ở lớp dây. Bấm
  // đúng cái nút thật thay vì tự đặt data-skin — làm vậy mới đi qua useSkin (nạp
  // font lười, ghi localStorage) và mới bắt được lỗi ở đó.
  // Nút giờ là bảng Giao diện bung ra dưới nút của nó trên đảo trên trái — cùng
  // chỗ với ngôn ngữ, sáng/tối, nền bảng, bộ màu. Phải mở bảng đó ra trước.
  // Tìm theo title chứ không theo thứ tự: đảo trên trái có HAI .menubar-trigger
  // (☰ và Giao diện), lấy theo index thì thêm cái thứ ba là test trỏ nhầm.
  const edgesClean = document.querySelectorAll(".edge-layer .visible").length;
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
  log(`skin vẽ tay: data-skin=${skinAttr} · dây ${edgesClean} <line> → ${edgePaths} <path> (còn ${edgeLines} line)`);
  if (skinAttr !== "sketch") throw new Error("bấm nút mà data-skin không thành sketch");
  if (edgePaths !== edgesClean) throw new Error(`mất dây khi đổi skin: ${edgesClean} → ${edgePaths}`);
  if (edgeLines !== 0) throw new Error("còn sót <line> hiển thị ở skin vẽ tay");
  const dAttr = document.querySelector(".edge-layer path.visible")?.getAttribute("d") || "";
  if (!dAttr.includes("C")) throw new Error("path dây không phải nét rung (không có đoạn cong)");

  // Tắt đi phải về đúng trạng thái cũ — không phải đường một chiều.
  await pickSkin("Sạch");
  if (document.documentElement.getAttribute("data-skin") !== "clean") throw new Error("tắt skin không về clean");
  if (document.querySelectorAll(".edge-layer line.visible").length !== edgesClean) throw new Error("tắt skin mà dây không về <line>");

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
  log(`khu 4 của laser: ${laserSwatches} màu · ${laserWidths} độ đậm · ${document.querySelectorAll(".tool-options .shape-pick").length} hình (phải là 0)`);
  if (laserSwatches !== 7) throw new Error("khu 4 của laser phải có 7 màu, có " + laserSwatches);
  if (laserWidths !== 3) throw new Error("khu 4 của laser phải có 3 độ đậm, có " + laserWidths);
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
  await act(async () => { await new Promise((r) => setTimeout(r, LASER_FADE_MS + 300)); });
  const leftover = document.querySelectorAll(".laser-layer g").length;
  log(`laser: đứng yên ${LASER_FADE_MS + 300}ms → còn ${leftover} vệt`);
  if (leftover !== 0) throw new Error("vệt laser không tự tan — nó đang là nét vẽ chứ không phải cây laser");

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
  const edgeHit = document.querySelector(".edge-layer line.hit");
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
  const edgeHits = document.querySelectorAll(".edge-layer line.hit");
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

  return true;
}
