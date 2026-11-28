import { useMemo, useRef } from "react";
import { createRelatedGameDesignCard, duplicateGameDesignCard, exportPackage, exportVersion, normalizeGameDesignBrief, normalizeGameDesignFlow, normalizeGameDesignBalance, createGameDesignNode, dependencyAnalysis, gameDesignMarkdown } from "./game-design.js";
import { outlineToMarkdown } from "./outline.js";
import { CARD_W } from "./board-constants.js";
import { useLingui } from "@lingui/react/macro";

// Phần riêng của board game-design: thêm/sửa/nhân bản thẻ GD và thẻ liên quan,
// lưu brief/flow/balance, phân tích dependency; cùng hai lối xuất Markdown và
// JSON có phiên bản (dùng cho cả board ý tưởng). Trước nằm trong IdeaMap.jsx.
// toCanvasPoint gắn qua bind() mỗi lượt render.
export function useGameDesignBoard({
  store, board, boardRef, role, view, boardName, frameCardSize, viewportRef, setDesignEditId
}) {
  const depsRef = useRef({});
  const { t } = useLingui();
  const toCanvasPoint = (...a) => depsRef.current.toCanvasPoint(...a);

  // Dependency chỉ là một lớp thông tin dẫn đường trên canvas: giữ phân tích
  // thuần theo snapshot board để card, dây và dock luôn nói cùng một sự thật.
  const dependency = useMemo(
    () => (board?.kind === "game-design" ? dependencyAnalysis(board) : null),
    [board]
  );

  function addGameDesignCard(type = "mechanic") {
    if (board.kind !== "game-design" || role === "viewer") return;
    const rect = viewportRef.current.getBoundingClientRect();
    const p = toCanvasPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const node = createGameDesignNode(board.nextNodeId, p.x - CARD_W / 2, p.y - 55, type);
    const next = { ...board, nodes: [...board.nodes, node], nextNodeId: node.id + 1 };
    store.commit(next, { from: board }); setDesignEditId(node.id);
  }

  function saveDesignNode(nextNode) {
    const current = boardRef.current;
    const next = { ...current, nodes: current.nodes.map((n) => n.id === nextNode.id ? nextNode : n) };
    // Panel là inspector của thẻ đang chọn, không phải modal dùng một lần. Giữ
    // nó mở sau khi lưu để người thiết kế nhìn ngay phần vừa điền và chuyển qua
    // thẻ khác bằng một cú bấm trên canvas.
    store.commit(next, { from: current });
  }

  function createRelatedDesignNode(sourceId, type, relation) {
    const current = boardRef.current; const next = createRelatedGameDesignCard(current, sourceId, type, relation);
    if (next === current) return; store.commit(next, { from: current }); setDesignEditId(next.nextNodeId - 1);
  }

  function duplicateDesignNode(sourceId) {
    const current = boardRef.current; const next = duplicateGameDesignCard(current, sourceId);
    if (next === current) return; store.commit(next, { from: current }); setDesignEditId(next.nextNodeId - 1);
  }

  function saveGameDesignBrief(nextBrief) {
    const current = boardRef.current;
    if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignBrief: normalizeGameDesignBrief(nextBrief) };
    store.commit(next, { from: current });
  }

  function saveGameDesignFlow(nextFlow) {
    const current = boardRef.current;
    if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignFlow: normalizeGameDesignFlow(nextFlow, current.nodes) };
    store.commit(next, { from: current });
  }

  function saveGameDesignBalance(nextBalance) {
    const current = boardRef.current; if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignBalance: normalizeGameDesignBalance(nextBalance, current.nodes) };
    store.commit(next, { from: current });
  }

  function exportMarkdown() {
    const md = board.kind === "game-design"
      ? gameDesignMarkdown(board)
      : outlineToMarkdown(board, frameCardSize, { other: t`Khác`, links: t`Liên kết` });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${board.kind === "game-design" ? "game-design" : "idea-map"}-${exportVersion(board).replace(/[^a-zA-Z0-9]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportVersionedJson() {
    const payload = board.kind === "game-design" ? exportPackage({ ...board, view, name: boardName }) : { ...board, view };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${board.kind === "game-design" ? "game-design" : "idea-map"}-${exportVersion(board).replace(/[^a-zA-Z0-9]/g, "-")}.json`; a.click(); URL.revokeObjectURL(url);
  }

  return {
    dependency, addGameDesignCard, saveDesignNode, createRelatedDesignNode, duplicateDesignNode, saveGameDesignBrief, saveGameDesignFlow, saveGameDesignBalance, exportMarkdown, exportVersionedJson,
    bind: (d) => { depsRef.current = d; }
  };
}
