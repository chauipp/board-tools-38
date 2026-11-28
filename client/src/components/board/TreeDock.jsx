import { useLingui } from "@lingui/react/macro";
import TreePanel from "../TreePanel.jsx";
import { buildTree, edgeKey } from "../../lib/tree-layout.js";
import { normalizeTreeLock } from "../../lib/locked-tree.js";
import { TREE_OPTS } from "../../lib/board-constants.js";

// Bảng Xếp cây — dock bên phải. Trước là một khối JSX trong IdeaMap.jsx; cây DOM
// và class giữ nguyên.
export default function TreeDock({ board, closeTreePanel, commitTree, outlineOpen, previewTree, role, toggleTreeLock, treeOpts, treeUI }) {
  const { t } = useLingui();
  return (
    <>
      {/* Bảng Xếp cây — dock bên phải như bảng thuộc tính của Figma. Né sang
          trái khi Mục lục đang mở, hai bảng cùng neo mép phải. */}
      {treeUI && (() => {
        const root = treeUI.kind === "group"
          ? board.groups.find((g) => g.id === treeUI.id)
          : board.nodes.find((n) => n.id === treeUI.id);
        if (!root) return null;             // gốc vừa bị xoá: bảng tự biến mất
        const { order } = buildTree(board.edges, edgeKey(treeUI.kind, treeUI.id));
        return (
          <TreePanel
            canEdit={role !== "viewer"}
            opts={treeOpts}
            locked={!!normalizeTreeLock(root.treeLayoutLock)}
            onLock={toggleTreeLock}
            count={order.length}
            rootTitle={root.title || t`Không tên`}
            shifted={outlineOpen}
            onOpts={previewTree}
            onCommit={commitTree}
            onReset={() => { previewTree(TREE_OPTS); commitTree(); }}
            onClose={closeTreePanel}
          />
        );
      })()}
    </>
  );
}
