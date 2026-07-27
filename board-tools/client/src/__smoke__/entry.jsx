import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../lib/i18n.js";
import IdeaMap from "../pages/IdeaMap.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";

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
  log(`thanh công cụ: ${railBtns()} nút ở mode Chuột`);
  if (railBtns() !== 7) throw new Error("mode Chuột phải có 7 nút (2 mode + 5 thêm), có " + railBtns());
  if (document.querySelector(".tool-options")) throw new Error("mode Chuột không được hiện khu 4");

  // Menu THÊM và nút Nối ý tưởng phải đã rời khỏi topbar — mỗi việc một chỗ bấm.
  const topbarText = document.querySelector(".topbar").textContent;
  if (topbarText.includes("Nối ý tưởng")) throw new Error("nút Nối ý tưởng vẫn còn trên topbar");

  const drawBtn = document.querySelectorAll(".tool-rail .tool-btn")[1];
  await act(async () => { drawBtn.click(); await new Promise((r) => setTimeout(r, 20)); });
  log(`sau khi bật mode Sửa: ${railBtns()} nút, khu 4 = ${document.querySelectorAll(".tool-options .pen-swatch").length} ô màu`);
  if (railBtns() !== 10) throw new Error("mode Sửa phải có 10 nút (2 mode + 3 tool + 5 thêm), có " + railBtns());
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
  const eraserBtn = document.querySelectorAll(".tool-rail .tool-btn")[3];
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
  const penBtn = document.querySelectorAll(".tool-rail .tool-btn")[2];
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
  const shapeBtn = document.querySelectorAll(".tool-rail .tool-btn")[4];
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

  return true;
}
