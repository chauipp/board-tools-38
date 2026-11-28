import { useRef } from "react";
import { drawingsHitBy, moveDrawing, shapeHandles, moveShapeHandle } from "./shape.js";
import { edgeKey } from "./tree-layout.js";
import { startDrag } from "./drag-session.js";
import { toggleId } from "./selection.js";
import { useInk } from "./useInk.js";
import { useInkLive } from "./useInkLive.js";
import { anchorFor, scaleFactorFor, scaleSelection } from "./selection-box.js";
import { TEXT_DRAG_THRESHOLD, PICK_RADIUS, EMPTY_SET } from "./board-constants.js";
import { useLingui } from "@lingui/react/macro";

// Nét vẽ, hình khối và chữ trên bảng: chốt nét vừa vẽ và cú tẩy, đổi bút ↔ gôm,
// chọn nét khi đang cầm bút, nét liền/đứt, kéo nét (kèm cả vùng chọn), tay cầm
// sửa hình, co giãn cả vùng chọn, và cú bấm trên lớp bắt chuột của mode vẽ.
// Trước nằm trong IdeaMap.jsx. Những hàm IdeaMap khai báo sau hook gắn qua
// bind() mỗi lượt render.
export function useDrawingSelection({
  store, board, boardRef, role, mode, tool, setTool, ink, inkLive, editShape, layoutOwners, selBounds, selectionSet, selectedIds, selectedGroupIds, selectedDrawingIds, selectionDragSet, clearSelection, setSelectedIds, setSelectedEdgeIds, setSelectedGroupIds, setSelectedDrawingIds, setBoard, recordHistory, saveNow, spacePanRef, view, applyImageToNode
}) {
  const depsRef = useRef({});
  const { t } = useLingui();
  const clientToCanvas = (...a) => depsRef.current.clientToCanvas(...a);
  const eventToCanvas = (...a) => depsRef.current.eventToCanvas(...a);
  const handleViewportMouseDown = (...a) => depsRef.current.handleViewportMouseDown(...a);
  const finishGeom = (...a) => depsRef.current.finishGeom(...a);
  const publishGeom = (...a) => depsRef.current.publishGeom(...a);
  const handleTextMouseDown = (...a) => depsRef.current.handleTextMouseDown(...a);
  const movingPayload = (...a) => depsRef.current.movingPayload(...a);
  const startPan = (...a) => depsRef.current.startPan(...a);
  const startTextDrag = (...a) => depsRef.current.startTextDrag(...a);

  // Chỗ nào thì tay cầm sửa hình có hiệu lực. MỘT nguồn sự thật cho cả phần vẽ
  // ra (JSX) lẫn phần bắt chuột (shapeHandleAt): hai chỗ lệch nhau thì hoặc là
  // tay cầm hiện ra mà bấm không được, hoặc là có một vùng vô hình cướp chuột.
  const canGrabShapeHandles = mode === "select" || (mode === "draw" && tool === "pen");
  // Nhường đường cho lia bảng TRƯỚC khi nghĩ tới việc vẽ — đúng thứ tự
  // handleViewportMouseDown đang dùng, nên chuột phải và Space+trái vẫn lia
  // bảng bình thường ở mode Sửa.
  // Tay cầm sửa hình nằm gần chỗ bấm tới mức nào thì coi là bấm trúng nó, tính
  // bằng pixel MÀN HÌNH: tay cầm được bù trừ zoom nên trên màn hình nó luôn to
  // 11px, bất kể bảng đang phóng bao nhiêu. Rộng hơn cỡ thật một chút cho dễ tóm.
  const SHAPE_HANDLE_GRAB = 9;

  // Trả về id đã cấp để useInk gửi kèm vào gói live `done` — người xem cần id
  // thật mới đối chiếu được overlay với board:update sắp về.
  //
  // Cùng kỷ luật refs-only như applyImageToNode (xem ghi chú ở đó): finish()
  // trong useInk.js gắn listener "mouseup" vào window NGAY LÚC mousedown, nên
  // closure của nó giữ commitStroke/commitErase của lượt render tại thời điểm
  // đó. Vẽ một nét mất vài giây; nếu board:update của người khác về TRONG lúc
  // đang vẽ, `board` đóng gói sẽ là bản cũ — build `next` từ nó rồi PUT cả bản
  // cũ sẽ đè mất thay đổi của người kia, cả cục bộ, cả trên server, cả trên
  // màn hình họ khi gói phát lại về tới. Phải đọc boardRef.current, và không
  // để store.commit tự lấy `board` làm bản trước — cùng vấn đề đóng gói cũ;
  // nên luôn truyền `from: current`.
  function commitStroke(stroke) {
    const current = boardRef.current;
    // Không có board thì không có gì để commit — nhưng vẫn phải trả về một id
    // hợp lệ cho useInk gọi live?.endStroke(drawingId): endStroke đã chịu được
    // id null/undefined (`drawingId ?? null`), nên trả undefined ở đây là an
    // toàn, không làm useInk hay useInkLive vỡ.
    if (!current) return undefined;
    const id = current.nextDrawingId;
    const next = {
      ...current,
      drawings: [...current.drawings, { id, ...stroke }],
      nextDrawingId: id + 1
    };
    store.commit(next, { from: current });
    return id;
  }

  // `adds` là các MẢNH còn lại sau khi cục tẩy theo độ rộng cắt ngang một nét:
  // nét cũ nằm trong `ids` (bỏ đi), mỗi mảnh vào làm một nét mới. Cục tẩy kiểu
  // "cả nét" không bao giờ truyền tham số này, nên nó đi đúng đường cũ.
  //
  // Xoá và thêm phải nằm trong CÙNG MỘT bản ghi: tách làm hai lượt commit thì
  // có một khoảnh khắc nét đã mất mà mảnh chưa có, và quan trọng hơn là hoàn tác
  // sẽ phải bấm hai lần mới về được chỗ cũ — trong khi người dùng chỉ làm đúng
  // một việc.
  function commitErase(ids, adds) {
    const current = boardRef.current;
    if (!current) return;
    const kill = new Set(ids);
    let nextId = current.nextDrawingId;
    // Gom mảnh theo nét gốc, rồi đặt chúng ĐÚNG CHỖ nét đó đang đứng trong mảng
    // thay vì nối vào cuối. Thứ tự trong `drawings` chính là thứ tự trên/dưới
    // khi vẽ: nối vào cuối thì một nét nằm dưới hình tô đặc, cắt xong lại nhảy
    // lên nằm trên nó — người dùng vừa tẩy một tí mà cả bức đổi tầng.
    const byFrom = new Map();
    for (const { from, ...part } of adds || []) {
      const list = byFrom.get(from) || [];
      list.push({ id: nextId++, ...part });
      byFrom.set(from, list);
    }
    const drawings = [];
    for (const d of current.drawings) {
      if (!kill.has(d.id)) { drawings.push(d); continue; }
      const parts = byFrom.get(d.id);
      if (parts) drawings.push(...parts);
    }
    const next = { ...current, drawings, nextDrawingId: nextId };
    store.commit(next, { from: current });
  }

  // Giữ tay ở CHỖ TRỐNG: đổi qua lại giữa bút và cục gôm. useInk lo toàn bộ
  // phần cử chỉ (đo thời gian, vòng báo, bỏ lượt vẽ dở); ở đây chỉ còn đúng
  // việc lật một ô state.
  //
  // Vẽ rồi xoá rồi vẽ tiếp là nhịp làm việc thường xuyên nhất trên một cái bảng,
  // mà cho tới giờ mỗi lần đổi đều phải với tay lên thanh công cụ bên trái hoặc
  // nhớ phím tắt — cả hai đều bắt rời mắt khỏi chỗ đang vẽ.
  function swapPenEraser() {
    if (role === "viewer") return;
    setTool(tool === "eraser" ? "pen" : "eraser");
  }

  // Bấm-mà-không-di khi đang cầm BÚT: chọn cái nét dưới tay, hoặc bỏ chọn nếu
  // bấm vào chỗ trống. useInk gọi hàm này từ nhánh "cú bấm không tạo ra nét nào"
  // — xem ghi chú dài ở đó về việc vì sao cú bấm này rảnh.
  //
  // Chọn xong thì mọi thứ vốn chỉ có ở mode Chuột đều dùng được ngay mà không
  // phải rời cây bút: tay cầm sửa hình, hai nút nét liền/đứt trên thanh vùng
  // chọn, phím Delete, phím mũi tên để nhích.
  function pickDrawingWhileDrawing(id, additive) {
    if (role === "viewer") return;
    if (id == null) { if (!additive) clearSelection(); return; }
    setSelectedDrawingIds(additive ? toggleId(selectedDrawingIds, id) : new Set([id]));
    // Cú bấm này chọn MỘT nét vẽ, nên vùng chọn cũ của thẻ/khung/dây phải nhường
    // chỗ — không thì thanh vùng chọn báo "3 thẻ · 1 nét vẽ" sau một cú bấm mà
    // người dùng chỉ định chỉ vào đúng một cái nét.
    if (!additive) {
      setSelectedIds(EMPTY_SET);
      setSelectedEdgeIds(EMPTY_SET);
      setSelectedGroupIds(EMPTY_SET);
    }
  }

  // Đặt nét liền / nét đứt cho một TẬP nét. Text bị bỏ qua dù có nằm trong vùng
  // chọn: nó vẽ bằng `fill`, không có nét nào để làm đứt.
  function setDrawingsDashed(ids, dashed) {
    const list = board.drawings || [];
    if (!ids.size || !list.some((d) => ids.has(d.id) && d.kind !== "text")) return;
    store.commit({
      ...board,
      drawings: list.map((d) => (ids.has(d.id) && d.kind !== "text" ? { ...d, dashed } : d))
    });
  }

  // Bấm hai lần lên một nét đã vẽ: đổi nét liền ↔ nét đứt.
  //
  // Nét được nhắm nằm TRONG vùng chọn thì cả vùng chọn đổi theo — cùng luật với
  // cú thả màu vào vùng chọn, và cùng luật với việc bấm vào một nét trong cụm là
  // kéo cả cụm. Quét chọn chục cái nét xong mà vẫn phải nhắm lại từng cái một
  // thì vùng chọn coi như không tồn tại.
  //
  // Cả cụm nhận CÙNG một giá trị lấy từ cái nét được nhắm, chứ không phải mỗi
  // nét tự lật lấy: vùng chọn lẫn lộn nửa liền nửa đứt mà lật từng cái thì nó
  // vẫn lẫn lộn mãi mãi, chỉ đảo vai. Lấy một giá trị chung thì một cử chỉ là cả
  // cụm về cùng một kiểu — thứ người ta thật sự muốn khi bôi cả đám rồi bấm.
  //
  // `dashed` vắng mặt nghĩa là nét liền, nên `!d.dashed` là phép lật đúng cho cả
  // những nét đã lưu từ trước khi có tính năng này.
  function toggleDrawingDash(id) {
    const target = (board.drawings || []).find((d) => d.id === id);
    if (!target) return;
    setDrawingsDashed(selectedDrawingIds.has(id) ? selectedDrawingIds : new Set([id]), !target.dashed);
  }

  // Nét nằm ngay dưới cú bấm, hoặc null nếu cú bấm rơi vào chỗ trống.
  //
  // Trả null luôn ở cục gôm và ở tool Text, dù có nét ở dưới: ở hai chỗ đó CÚ BẤM
  // ĐÃ CÓ VIỆC RỒI — cục gôm xoá nét ngay từ cú bấm đầu, tool Text mở ô nhập tại
  // chỗ bấm. Chồng thêm cử chỉ này lên là vừa xoá vừa đổi nét, hoặc vừa mở ô nhập
  // vừa đổi một nét mà người dùng còn không nhắm tới.
  function dashTargetAt(e) {
    if (mode === "draw" && (tool === "eraser" || tool === "text")) return null;
    const list = board.drawings || [];
    const hits = drawingsHitBy(list, clientToCanvas(e.clientX, e.clientY), PICK_RADIUS);
    // Nét vẽ sau cùng nằm trên, nên trúng nhiều thì lấy cái trên — cùng luật với
    // cú bấm chọn ở mode Chuột. Text bị bỏ qua: nó vẽ bằng `fill`, không có nét
    // nào để làm đứt.
    for (let i = hits.length - 1; i >= 0; i--) {
      const d = list.find((x) => x.id === hits[i]);
      if (d && d.kind !== "text") return d.id;
    }
    return null;
  }

  // Bấm trúng nét bút / hình khối / chữ ở mode Sửa: chọn nó (Ctrl để cộng dồn),
  // rồi cùng cú bấm đó kéo luôn được cả cụm đang chọn — đúng lối của thẻ, không
  // cần bấm chọn xong mới được kéo.
  function handleDrawingMouseDown(e, id) {
    if (e.ctrlKey || e.metaKey) {
      setSelectedDrawingIds(toggleId(selectedDrawingIds, id));
      // Ctrl+bấm là thao tác gom lựa chọn, không phải cú kéo: bỏ một nét ra khỏi
      // vùng chọn rồi lỡ tay di chuột không được kéo đi chỗ khác.
      return;
    }
    if (selectedDrawingIds.has(id)) {
      // Bấm vào cụm đang chọn: giữ nguyên cả cụm, và thẻ/khung trong cùng vùng
      // chọn cũng đi theo — đối xứng với cú kéo thẻ.
      startDrawingDrag(e, selectedDrawingIds, selectedIds, selectedGroupIds);
      return;
    }
    const picked = new Set([id]);
    setSelectedDrawingIds(picked);
    setSelectedIds(EMPTY_SET);
    setSelectedEdgeIds(EMPTY_SET);
    setSelectedGroupIds(EMPTY_SET);
    // Vùng chọn cũ vừa bị xoá ở trên, nhưng setState chỉ có hiệu lực ở lượt
    // render sau — nên truyền tường minh tập RỖNG, không để hàm dưới tự đọc
    // state và kéo theo mấy cái thẻ người dùng vừa bỏ chọn.
    startDrawingDrag(e, picked, EMPTY_SET, EMPTY_SET);
  }

  // `onClickNoDrag` chỉ có ở lối vào từ chỗ TRỐNG trong vùng chọn (xem
  // startSelectionDrag): ở đó bấm-không-kéo phải bỏ chọn. Bấm trúng một cái nét
  // thì không — đó là cú chọn chính cái nét đó, bỏ chọn ngay sau khi vừa chọn là
  // vô nghĩa.
  function startDrawingDrag(e, ids, carryNodeIds, carryGroupIds, onClickNoDrag) {
    // `ids` rỗng vẫn đi tiếp nếu còn thẻ/khung: cú kéo từ chỗ trống trong một
    // vùng chọn toàn thẻ không có nét nào để mà kéo, nhưng vẫn phải kéo được.
    if (role === "viewer") return;
    if (ids.size === 0 && carryNodeIds.size === 0 && carryGroupIds.size === 0) return;
    const start = eventToCanvas(e);
    const base = boardRef.current;
    // Chốt toạ độ gốc một lần, mỗi nhịp chuột tính lại TỪ ĐÓ chứ không cộng dồn
    // — cùng kỷ luật với cú kéo thẻ, và là thứ giữ cho cú kéo không trôi.
    const startPts = new Map(
      (base.drawings || []).filter((d) => ids.has(d.id)).map((d) => [d.id, d.pts])
    );
    // Đối xứng với cú kéo thẻ: kéo một nét trong vùng chọn hỗn hợp thì thẻ và
    // khung đang chọn cũng đi theo. Không thì cùng một vùng chọn lại cho hai kết
    // quả khác nhau tuỳ vào việc người dùng bấm trúng cái gì để kéo.
    const carry = selectionDragSet(base, carryGroupIds, carryNodeIds);
    const startNodes = new Map(
      base.nodes.filter((n) => carry.nodeIds.includes(n.id)).map((n) => [n.id, { x: n.x, y: n.y }])
    );
    const startGroups = new Map(
      base.groups.filter((g) => carry.groupIds.includes(g.id)).map((g) => [g.id, { x: g.x, y: g.y }])
    );
    let moved = false;
    let latest = base;
    inkLive.beginMove();

    const onMove = (ev) => {
      const p = eventToCanvas(ev);
      const dx = p.x - start.x, dy = p.y - start.y;
      if (!moved && Math.hypot(dx, dy) < TEXT_DRAG_THRESHOLD) return;
      moved = true;
      setBoard((prev) => {
        const next = {
          ...prev,
          drawings: prev.drawings.map((d) => {
            const from = startPts.get(d.id);
            return from ? moveDrawing({ ...d, pts: from }, dx, dy) : d;
          }),
          nodes: startNodes.size === 0 ? prev.nodes : prev.nodes.map((n) => {
            const from = startNodes.get(n.id);
            return from ? { ...n, x: Math.round(from.x + dx), y: Math.round(from.y + dy) } : n;
          }),
          groups: startGroups.size === 0 ? prev.groups : prev.groups.map((g) => {
            const from = startGroups.get(g.id);
            return from ? { ...g, x: Math.round(from.x + dx), y: Math.round(from.y + dy) } : g;
          })
        };
        latest = next;
        return next;
      });
      // Nét đi qua kênh ink, còn thẻ/khung bị kéo theo thì đi qua kênh geom —
      // hai loại vật thể, hai kênh, cùng một cú kéo. Trước đây cú kéo này không
      // phát gì cả, kể cả thẻ.
      inkLive.pushMove(movingPayload(latest, ids));
      if (startNodes.size || startGroups.size) {
        publishGeom({
          nodes: latest.nodes.filter((n) => startNodes.has(n.id)),
          groups: latest.groups.filter((g) => startGroups.has(g.id))
        });
      }
    };

    function onUp(ev) {
      // bấm-không-kéo: chỉ là cú chọn (hoặc cú bỏ chọn), không lưu gì. Chỉ tính
      // là "bấm" khi thật sự có cú NHẢ CHUỘT — hàm này còn là handler của `blur`,
      // mà mất focus giữa lúc đang giữ chuột thì người dùng không hề bấm xong,
      // và bỏ mất vùng chọn của họ ở đó là vô cớ.
      if (!moved) { inkLive.cancelMove(); if (ev?.type === "mouseup") onClickNoDrag?.(); return; }
      inkLive.endMove(movingPayload(latest, ids));
      if (startNodes.size || startGroups.size) {
        finishGeom({
          nodes: latest.nodes.filter((n) => startNodes.has(n.id)),
          groups: latest.groups.filter((g) => startGroups.has(g.id))
        });
      }
      recordHistory(base);
      saveNow(latest);
    }

    // Cửa sổ mất focus giữa lượt kéo thì mouseup không bao giờ tới (cùng cái bẫy
    // đã ghi ở startTextDrag). Ở đây vị trí mới đã nằm sẵn trong board rồi, nên
    // đường thoát đúng là CHỐT nó lại — bỏ ngang thì người dùng thấy nét đã dời
    // mà server không hề biết, và F5 một cái là nó nhảy về chỗ cũ.
    startDrag(e, { onMove, onEnd: onUp, release: "cancel", blur: "end" });
  }

  // Kéo cả cụm từ một chỗ trống trong vùng chọn. Dùng lại nguyên đường của cú
  // kéo nét vẽ — nó vốn đã kéo được cả ba loại cùng lúc — chỉ khác một điểm:
  // bấm-mà-không-kéo ở đây là BỎ CHỌN, giữ đúng phản xạ "bấm ra chỗ trống là bỏ
  // chọn" đã có từ trước, chứ không im lặng như khi bấm trúng một cái nét.
  function startSelectionDrag(e) {
    startDrawingDrag(e, selectedDrawingIds, selectedIds, selectedGroupIds, clearSelection);
  }

  // Kéo một tay cầm của MỘT hình = đặt đúng cái góc / cái cạnh đó vào chỗ muốn.
  // Ý nghĩa từng tay cầm nằm hết ở lib/shape.js (shapeHandles/moveShapeHandle);
  // ở đây chỉ là phần nối chuột và phần lưu.
  function handleShapeHandleMouseDown(e, handle) {
    if (e.button !== 0 || role === "viewer" || !editShape) return;
    e.preventDefault();
    e.stopPropagation();
    const base = boardRef.current;
    const id = editShape.d.id;
    // Hình LÚC BẮT ĐẦU kéo. Mọi nhịp chuột tính lại từ nó chứ không từ bản vừa
    // sửa: cộng dồn thì tay cầm cạnh (dời theo delta) sẽ trôi mỗi khung hình một
    // ít, và kéo ra rồi kéo về không quay lại đúng chỗ cũ.
    const start = (base.drawings || []).find((x) => x.id === id);
    if (!start) return;
    let latest = base;
    let moved = false;
    const oneId = new Set([id]);
    inkLive.beginMove();

    const onMove = (ev) => {
      const p = eventToCanvas(ev);
      if (!moved && Math.hypot(p.x - handle.x, p.y - handle.y) < TEXT_DRAG_THRESHOLD / view.scale) return;
      moved = true;
      // Ghi đè CẢ kind: kéo góc một chữ nhật thì nó thành tứ giác, kéo góc một
      // tam giác cân thì nó thành tam giác thường (xem ghi chú ở lib/shape.js).
      const { kind, pts } = moveShapeHandle(start, handle, p.x, p.y);
      setBoard((prev) => {
        const next = {
          ...prev,
          drawings: (prev.drawings || []).map((x) => (x.id === id ? { ...x, kind, pts } : x))
        };
        latest = next;
        return next;
      });
      inkLive.pushMove(movingPayload(latest, oneId));
    };

    function onUp() {
      if (!moved) { inkLive.cancelMove(); return; }
      inkLive.endMove(movingPayload(latest, oneId));
      recordHistory(base);
      saveNow(latest);
    }
    // Mất focus giữa cú kéo: hình mới đã nằm sẵn trong board, nên đường thoát
    // đúng là CHỐT nó lại — cùng lý do đã ghi ở startDrawingDrag.
    startDrag(e, { onMove, onEnd: onUp, blur: "end" });
  }

  // Kéo một trong bốn góc hộp bao = co giãn CẢ CỤM, đều hai chiều, quanh góc đối
  // diện (góc đó đứng yên tuyệt đối). Phép tính nằm hết ở lib/selection-box.js.
  function handleSelectionResizeMouseDown(e, corner) {
    if (e.button !== 0 || role === "viewer" || !selBounds) return;
    if ([...selectedIds].some((id) => layoutOwners.has(edgeKey("node", id)))
      || [...selectedGroupIds].some((id) => layoutOwners.has(edgeKey("group", id)))) return;
    e.preventDefault();
    e.stopPropagation();
    const bounds = selBounds;
    const anchor = anchorFor(bounds, corner);
    // MỌI khung hình tính lại từ `base`, không cộng dồn lên kết quả lần trước:
    // nhân hệ số lên một bản đã bị nhân rồi thì cụm phình theo cấp số nhân, và
    // kéo ra rồi kéo về không quay lại đúng chỗ cũ. Cùng kỷ luật với
    // startPositions của cú kéo thẻ.
    const base = boardRef.current;
    const sel = selectionSet;
    let latest = base;
    let moved = false;
    inkLive.beginMove();

    const onMove = (ev) => {
      const k = scaleFactorFor(bounds, corner, eventToCanvas(ev));
      if (!moved && Math.abs(k - 1) < 0.02) return;
      moved = true;
      const scaled = scaleSelection(base, sel, anchor, k);
      // Đắp lên `prev` chứ không thay thẳng bằng `scaled`: một gói board:update
      // của người khác hoàn toàn có thể về giữa cú kéo, và `scaled` dựng từ bản
      // board LÚC BẮT ĐẦU — trả nguyên nó ra là xoá mất mọi thứ họ vừa sửa.
      // Chỉ lấy các trường HÌNH HỌC, phần còn lại của mỗi phần tử giữ nguyên bản
      // mới nhất (tiêu đề họ vừa gõ, màu họ vừa đổi…).
      const nodeGeom = new Map(scaled.nodes.filter((n) => sel.nodeIds.has(n.id)).map((n) => [n.id, n]));
      const groupGeom = new Map(scaled.groups.filter((g) => sel.groupIds.has(g.id)).map((g) => [g.id, g]));
      const drawGeom = new Map((scaled.drawings || []).filter((d) => sel.drawingIds.has(d.id)).map((d) => [d.id, d]));
      setBoard((prev) => {
        const next = {
          ...prev,
          nodes: prev.nodes.map((n) => {
            const s = nodeGeom.get(n.id);
            return s ? { ...n, x: s.x, y: s.y, w: s.w } : n;
          }),
          groups: prev.groups.map((g) => {
            const s = groupGeom.get(g.id);
            return s ? { ...g, x: s.x, y: s.y, w: s.w, h: s.h } : g;
          }),
          drawings: (prev.drawings || []).map((d) => {
            const s = drawGeom.get(d.id);
            if (!s) return d;
            // `size` chỉ có ở text, `w`/`h` mang nghĩa khác nhau giữa text và nét
            // vẽ — nên chép theo những gì scaleSelection thật sự trả về, không
            // dựng sẵn một danh sách trường thứ hai ở đây để rồi lệch với nó.
            const geom = { pts: s.pts };
            if (s.w !== undefined) geom.w = s.w;
            if (s.h !== undefined) geom.h = s.h;
            if (s.size !== undefined) geom.size = s.size;
            return { ...d, ...geom };
          })
        };
        latest = next;
        return next;
      });
      // Co giãn đổi cả pts lẫn cỡ chữ, và thẻ/khung trong cụm cũng co theo —
      // nên cú này phải phát trên CẢ HAI kênh.
      inkLive.pushMove(movingPayload(latest, sel.drawingIds));
      if (sel.nodeIds.size || sel.groupIds.size) {
        publishGeom({
          nodes: latest.nodes.filter((n) => sel.nodeIds.has(n.id)),
          groups: latest.groups.filter((g) => sel.groupIds.has(g.id))
        });
      }
    };

    function onUp() {
      if (!moved) { inkLive.cancelMove(); return; }
      inkLive.endMove(movingPayload(latest, sel.drawingIds));
      if (sel.nodeIds.size || sel.groupIds.size) {
        finishGeom({
          nodes: latest.nodes.filter((n) => sel.nodeIds.has(n.id)),
          groups: latest.groups.filter((g) => sel.groupIds.has(g.id))
        });
      }
      recordHistory(base);
      saveNow(latest);
    }
    // Mất focus giữa cú kéo: vị trí mới đã nằm sẵn trong board rồi, nên đường
    // thoát đúng là CHỐT nó lại — cùng lý do đã ghi ở startDrawingDrag.
    startDrag(e, { onMove, onEnd: onUp, blur: "end" });
  }

  // Tay cầm nằm dưới chỗ bấm, nếu có.
  //
  // VÌ SAO PHẢI TỰ DÒ thay vì để trình duyệt lo bằng pointer-events: tay cầm là
  // con của `.canvas`, mà `.canvas` có `transform` — thứ tạo ra một NGỮ CẢNH XẾP
  // LỚP riêng. Mọi z-index bên trong đó chỉ so với nhau, không bao giờ leo ra
  // ngoài để thắng `.ink-capture` (z-index 8) đang phủ kín khung nhìn. Nên ở mode
  // Sửa, cú bấm luôn rơi vào lớp vẽ trước. Bắt ở đây, bằng đúng toạ độ canvas mà
  // tay cầm đang đứng, là đường duy nhất không phải bê cả hệ tay cầm ra khỏi
  // `.canvas` và tự tính lại pan/zoom cho chúng.
  function shapeHandleAt(e) {
    if (!editShape || role === "viewer") return null;
    const p = clientToCanvas(e.clientX, e.clientY);
    const limit = SHAPE_HANDLE_GRAB / view.scale;
    let best = null;
    let bestD = Infinity;
    for (const h of editShape.handles) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d <= limit && d < bestD) { best = h; bestD = d; }
    }
    return best;
  }

  function handleInkCaptureMouseDown(e) {
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    if (tool === "text") { handleTextMouseDown(e); return; }
    // Tay cầm xét TRƯỚC nét vẽ: nó nhỏ và luôn nằm ngay trên đường bao của hình
    // đang chọn, nên nếu để lượt vẽ ăn trước thì không bao giờ tóm được nó.
    // Chỉ ở tool Bút — xem ghi chú ở chỗ render tay cầm.
    if (canGrabShapeHandles) {
      const handle = shapeHandleAt(e);
      if (handle) { handleShapeHandleMouseDown(e, handle); return; }
    }
    ink.handleMouseDown(e);
  }

  return {
    canGrabShapeHandles, commitStroke, commitErase, swapPenEraser, pickDrawingWhileDrawing, setDrawingsDashed, toggleDrawingDash, dashTargetAt, handleDrawingMouseDown, startDrawingDrag, startSelectionDrag, handleShapeHandleMouseDown, handleSelectionResizeMouseDown, shapeHandleAt, handleInkCaptureMouseDown,
    bind: (d) => { depsRef.current = d; }
  };
}
