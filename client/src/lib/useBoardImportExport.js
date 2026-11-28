import { useRef } from "react";
import { gridLayout } from "./layout.js";
import { drawBoardToCanvas } from "./png-export.js";
import { CARD_W } from "./board-constants.js";
import { normalizeGameDesignBoard } from "./normalize-board.js";
import { useLingui } from "@lingui/react/macro";

// Các lối đưa dữ liệu vào/ra board không đi qua thao tác trên canvas: xuất PNG,
// nhập JSON (camera trong bản nhập đi vào camera chứ không vào board), nhập
// nhanh mỗi dòng một thẻ, mở bảng và tạo snapshot, bật/tắt panel lọc. Trước nằm
// trong IdeaMap.jsx.
export function useBoardImportExport({
  store, board, view, setView, viewportRef, frameCardSize, theme, ioText, setIoOpen, captureText, setCaptureText, setCaptureOpen, setFocusId, setPanels, setSnapshots, setSnapshotsOpen
}) {
  const depsRef = useRef({});
  const { t } = useLingui();

  function openSnapshots() {
    setSnapshotsOpen(true);
  }

  async function createSnapshot(label) {
    const snapshot = await store.createSnapshot(label);
    setSnapshots((current) => [snapshot, ...current].slice(0, 30));
  }

  function exportPng() {
    const styles = getComputedStyle(document.documentElement);
    const v = (name) => styles.getPropertyValue(name).trim();
    const theme = {
      bg: v("--bg"), surface: v("--surface-2"), line: v("--line"),
      ink: v("--ink"), inkDim: v("--ink-dim"), accent: v("--accent"),
      colorOf: (token) => v(`--${token}`)
    };
    const canvas = drawBoardToCanvas(board, frameCardSize, theme);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "idea-map.png"; a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function handleImportConfirm() {
    try {
      const payload = JSON.parse(ioText);
      const parsed = payload?.format === "game-design-board-export/v1" && payload.board ? payload.board : payload;
      if (!parsed.nodes || !parsed.edges || !parsed.view) throw new Error("bad shape");
      if (!Array.isArray(parsed.groups)) parsed.groups = [];
      if (typeof parsed.nextGroupId !== "number") parsed.nextGroupId = 1;
      // `view` của bản nhập là camera, không phải nội dung: tách ra đặt riêng.
      const { view: importedView, ...content } = parsed;
      store.commit(normalizeGameDesignBoard(content));
      setView(importedView);
      setIoOpen(false);
    } catch (e) {
      alert(t`JSON không hợp lệ — kiểm tra lại nội dung đã dán.`);
    }
  }

  function confirmCapture() {
    const titles = captureText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (titles.length === 0) { setCaptureOpen(false); return; }
    setFocusId(null);
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - view.panX) / view.scale;
    const cy = (rect.height / 2 - view.panY) / view.scale;
    const estH = 90;
    const cols = Math.ceil(Math.sqrt(titles.length));
    const items = titles.map((_, i) => ({ id: i, w: CARD_W, h: estH }));
    const gridW = cols * (CARD_W + 24) - 24;
    const rows = Math.ceil(titles.length / cols);
    const gridH = rows * (estH + 24) - 24;
    const pos = gridLayout(items, { x: Math.round(cx - gridW / 2), y: Math.round(cy - gridH / 2) }, cols);
    let nextId = board.nextNodeId;
    const newNodes = titles.map((title, i) => ({
      id: nextId + i,
      title,
      desc: "",
      tagId: null,
      statusId: null,
      x: pos.get(i).x,
      y: pos.get(i).y
    }));
    store.commit({ ...board, nodes: [...board.nodes, ...newNodes], nextNodeId: nextId + titles.length });
    setCaptureOpen(false);
    setCaptureText("");
  }

  function togglePanel(key) {
    setPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return {
    openSnapshots, createSnapshot, exportPng, handleImportConfirm, confirmCapture, togglePanel,
    bind: (d) => { depsRef.current = d; }
  };
}
