import { useEffect, useRef } from "react";
import { startDrag } from "./drag-session.js";
import { readImageFile } from "./image-utils.js";
import { canAddImage, formatMB } from "./image-budget.js";
import { CARD_W } from "./board-constants.js";
import { useLingui } from "@lingui/react/macro";

// Ảnh và PDF gắn vào thẻ: dán ảnh từ clipboard (listener paste gắn một lần), thả
// ảnh vào thẻ hoặc ra bảng, tải PDF lên, co giãn ảnh/PDF, gỡ ảnh, và chốt trần
// dung lượng board. Trước nằm trong IdeaMap.jsx.
export function useNodeMedia({
  store, board, boardId, boardRef, role, roleRef, view, viewRef, viewportRef, selectedIdsRef, setBoard, setSelectedIds, recordHistory, saveNow, handleGroupResizeMouseDown
}) {
  const depsRef = useRef({});
  const { t } = useLingui();
  const finishGeom = (...a) => depsRef.current.finishGeom(...a);
  const publishGeom = (...a) => depsRef.current.publishGeom(...a);

  useEffect(() => {
    function onPaste(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (roleRef.current === "viewer") return;
      const current = boardRef.current;
      if (!current) return;
      const sel = selectedIdsRef.current;
      if (sel.size > 1) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      const file = item.getAsFile();
      if (sel.size === 1) readImageFile(file).then((dataUrl) => applyImageToNode(Array.from(sel)[0], dataUrl)).catch(() => {});
      else readImageFile(file).then((dataUrl) => createImageNode(dataUrl)).catch(() => {});
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // Ảnh dán/thả vào thẻ: applyImageToNode phải đọc boardRef.current (không phải
  // `board`) vì nó được gọi từ readImageFile().then() bên trong listener "paste"
  // gắn-một-lần (deps: []), nơi `board` luôn là giá trị đóng gói lúc mount (stale).
  // store.commit mà không truyền `from` sẽ ghi lịch sử bằng `board` của lượt
  // render — cùng vấn đề đóng gói cũ; nên ở đây luôn truyền `from: current`.
  // Một board là một document MongoDB, trần 16MB. Ảnh giữ nguyên chất lượng gốc
  // nên trần đó với tới được — báo ngay tại chỗ dán, đừng để cú lưu chết ở server
  // rồi người dùng chỉ thấy "không lưu được".
  function imageFitsBoard(dataUrl, replaceNodeId = null) {
    const current = boardRef.current;
    if (!current) return false;
    const check = canAddImage(current.nodes, dataUrl, replaceNodeId);
    if (check.ok) return true;
    window.alert(t`Ảnh này ${formatMB(check.adding)}MB, mà bảng đã dùng ${formatMB(check.used)}MB trên ${formatMB(check.budget)}MB dành cho ảnh. Xoá bớt ảnh cũ hoặc tách sang board khác.`);
    return false;
  }

  function applyImageToNode(nodeId, dataUrl) {
    const current = boardRef.current;
    if (!current) return;
    if (!current.nodes.some((n) => n.id === nodeId)) return;
    if (!imageFitsBoard(dataUrl, nodeId)) return;
    const next = { ...current, nodes: current.nodes.map((n) => (n.id === nodeId ? { ...n, image: dataUrl } : n)) };
    store.commit(next, { from: current });
  }

  // Cùng kỷ luật refs-only như applyImageToNode: được gọi từ listener "paste"
  // gắn-một-lần và từ .then() của readImageFile.
  function createImageNode(dataUrl, pos) {
    const current = boardRef.current;
    if (!current || !viewportRef.current) return;
    if (!imageFitsBoard(dataUrl)) return;
    let x, y;
    if (pos) {
      ({ x, y } = pos);
    } else {
      const rect = viewportRef.current.getBoundingClientRect();
      x = Math.round((rect.width / 2 - viewRef.current.panX) / viewRef.current.scale - CARD_W / 2);
      y = Math.round((rect.height / 2 - viewRef.current.panY) / viewRef.current.scale - 80);
    }
    const id = current.nextNodeId;
    const node = { id, title: t`Ảnh`, desc: "", tagId: null, statusId: null, x, y, image: dataUrl };
    const next = { ...current, nodes: [...current.nodes, node], nextNodeId: id + 1 };
    store.commit(next, { from: current });
    setSelectedIds(new Set([id]));
  }

  function handleImageDrop(e, nodeId) {
    e.preventDefault();
    e.stopPropagation();
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
    if (f) readImageFile(f).then((d) => applyImageToNode(nodeId, d)).catch(() => {});
  }

  // Thả file ảnh lên chỗ trống canvas → tạo thẻ ảnh tại điểm thả (thả lên thẻ
  // có sẵn do handleImageDrop xử lý và đã stopPropagation).
  function handleViewportImageDrop(e) {
    if (role === "viewer") return;
    const f = Array.from(e.dataTransfer?.files ?? []).find((x) => x.type.startsWith("image/") || x.type === "application/pdf");
    if (!f) return;
    e.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - view.panX) / view.scale - CARD_W / 2);
    const y = Math.round((e.clientY - rect.top - view.panY) / view.scale - 40);
    if (f.type === "application/pdf") {
      uploadPdfFile(f, { x, y });
    } else {
      readImageFile(f).then((d) => createImageNode(d, { x, y })).catch(() => {});
    }
  }

  async function uploadPdfFile(file, pos) {
    if (!boardRef.current) return;
    const data = new FormData();
    data.append("file", file);
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/files`, {
        method: "POST", credentials: "include", body: data
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        let msg = t`Không thể tải PDF lên.`;
        if (body.error === "file_too_large") msg = t`PDF vượt giới hạn 30MB.`;
        // Ba lỗi dưới đây dẫn tới ba việc phải làm khác nhau, nên không gộp
        // chung: kho chung đầy là chuyện cả nhóm; phần riêng đầy thì tự xoá là
        // xong; còn quá tay thì chỉ cần chờ.
        else if (body.error === "storage_full") {
          msg = t`Kho PDF chung đã đầy (${body.used} / ${body.limit}). Xoá vài thẻ PDF không cần nữa rồi thử lại — dung lượng được trả lại sau khoảng một ngày.`;
        } else if (body.error === "user_quota_full") {
          msg = t`Bạn đã dùng hết phần dung lượng PDF của mình (${body.used} / ${body.limit}). Xoá vài thẻ PDF bạn đã tải lên rồi thử lại — dung lượng được trả lại sau khoảng một ngày.`;
        } else if (body.error === "too_many_uploads") {
          msg = t`Bạn vừa tải lên quá nhiều PDF trong một giờ. Chờ một lát rồi thử lại.`;
        }
        window.alert(msg);
        return;
      }
      const pdf = await res.json();
      const current = boardRef.current;
      if (!current) return;
      const id = current.nextNodeId;
      const node = {
        id, title: pdf.name, desc: "", tagId: null, statusId: null,
        x: pos.x, y: pos.y, w: 420, pdfH: 500,
        pdf: { fileId: pdf.fileId, name: pdf.name, size: pdf.size }
      };
      const next = { ...current, nodes: [...current.nodes, node], nextNodeId: id + 1 };
      store.commit(next, { from: current });
      setSelectedIds(new Set([id]));
    } catch {
      window.alert(t`Không thể tải PDF lên.`);
    }
  }

  // Kéo góc ảnh đổi bề rộng thẻ (node.w); chiều cao ảnh theo tỉ lệ. Cùng
  // pattern với handleGroupResizeMouseDown: live update, 1 history entry lúc thả.
  function handleImageResizeMouseDown(e, nodeId) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (e.button !== 0 || !node || node.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const scale = view.scale;
    const boardBeforeDrag = board;
    const startW = node.w || CARD_W;
    // Không có trần: kéo to tới đâu cũng được. Trần 560px cũ vô nghĩa từ khi ảnh
    // giữ nguyên độ phân giải gốc — ảnh 3000px vẫn nét ở 2000px, chặn ở 560 chỉ
    // là vứt đi phần dữ liệu đã lưu. MIN_W giữ lại để thẻ không co về 0 rồi mất
    // luôn chỗ để bấm vào.
    const MIN_W = 140;
    let latest = board;
    let moved = false;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      if (Math.abs(dx) > 0.5) moved = true;
      const w = Math.max(MIN_W, Math.round(startW + dx));
      setBoard((prev) => {
        const next = { ...prev, nodes: prev.nodes.map((n) => (n.id === node.id ? { ...n, w } : n)) };
        latest = next;
        return next;
      });
      if (moved) publishGeom({ nodes: [{ id: node.id, x: node.x, y: node.y, w }] });
    };
    function onUp() {
      if (!moved) return;
      recordHistory(boardBeforeDrag);
      finishGeom({ nodes: latest.nodes.filter((n) => n.id === node.id) });
      saveNow(latest);
    }
    startDrag(e, { onMove, onEnd: onUp });
  }

  // Khung PDF cần kéo cả hai chiều: chiều rộng quyết định cỡ trang, chiều cao
  // là cửa sổ đọc/scroll của tài liệu. Khác ảnh (giữ tỉ lệ), nên không dùng lại
  // tay cầm ảnh chỉ kéo ngang.
  function handlePdfResizeMouseDown(e, nodeId) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (e.button !== 0 || !node?.pdf || node.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const scale = view.scale;
    const boardBeforeDrag = board;
    const startW = node.w || 420, startH = node.pdfH || 500;
    let latest = board;
    let moved = false;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;
      const w = Math.max(260, Math.round(startW + dx));
      const pdfH = Math.max(220, Math.round(startH + dy));
      setBoard((prev) => {
        const next = { ...prev, nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, w, pdfH } : n)) };
        latest = next;
        return next;
      });
      if (moved) publishGeom({ nodes: [{ id: node.id, x: node.x, y: node.y, w, h: pdfH }] });
    };
    function onUp() {
      if (!moved) return;
      recordHistory(boardBeforeDrag);
      finishGeom({
        nodes: latest.nodes
          .filter((n) => n.id === node.id)
          .map((n) => ({ ...n, h: n.pdfH }))
      });
      saveNow(latest);
    }
    startDrag(e, { onMove, onEnd: onUp });
  }

  function removeNodeImage(id) {
    store.commit({
      ...board,
      nodes: board.nodes.map((n) => {
        if (n.id !== id) return n;
        const { image, ...rest } = n;
        return rest;
      })
    });
  }

  return {
    imageFitsBoard, applyImageToNode, createImageNode, handleImageDrop, handleViewportImageDrop, uploadPdfFile, handleImageResizeMouseDown, handlePdfResizeMouseDown, removeNodeImage,
    bind: (d) => { depsRef.current = d; }
  };
}
