import { useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar, statusById, tagById } from "../../lib/badges.js";
import BadgeEditor from "../BadgeEditor.jsx";
import ColorMenu from "../ColorMenu.jsx";
import { cardLevel, levelPatch } from "../../lib/card-levels.js";
import DropCount from "./DropCount.jsx";
import PaletteEditor from "./PaletteEditor.jsx";
import EdgeMenu from "./EdgeMenu.jsx";
import CommentsPopover from "./CommentsPopover.jsx";

// Mọi popover nổi trên bảng: bóng chip/màu đang kéo, menu màu của thẻ và khung,
// trình sửa badge, trình sửa màu, menu dây, bình luận. Trước là một khối JSX
// trong IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function BoardPopovers({ addComment, applyColorToSelection, applyGroupColor, applyNodeColor, applyNodeDashed, applyNodeLevel, applyNodeShape, applyToSelection, arrangeAsTree, badgeUI, board, chipDrag, colorDrag, colorMenu, commentsFor, createBadge, createPaletteColor, deleteBadge, deleteComment, deleteEdge, deleteGroup, deleteNode, deletePaletteColor, deleteSelection, dropIdsFor, dropTargetId, duplicateNodes, duplicateSelection, edgeMenu, groupSelectedCards, openTreePanel, paletteUI, selectedGroupIds, selectedIds, setBadgeUI, setColorMenu, setCommentsFor, setEdgeMenu, setEditingId, setFocusId, setPaletteUI, setSelectedIds, store, tidySelection, toggleGroupLock, toggleNodeLock, updateBadge, updateEdge, updatePaletteColor }) {
  const { t } = useLingui();
  return (
    <>
      {chipDrag && (
        <div className="chip-ghost" style={{ left: chipDrag.x, top: chipDrag.y }}>
          {(() => {
            const def = chipDrag.value === "none"
              ? null
              : (chipDrag.kind === "status" ? statusById(board, Number(chipDrag.value)) : tagById(board, Number(chipDrag.value)));
            return (
              <>
                <span className="dot" style={{ background: def ? colorVar(def.color) : "transparent" }}></span>
                {def ? def.name : (chipDrag.kind === "status" ? t`Không trạng thái` : t`Không nhãn`)}
                <DropCount targetId={dropTargetId} idsFor={dropIdsFor} />
              </>
            );
          })()}
        </div>
      )}

      {colorDrag && (
        <div className="chip-ghost" style={{ left: colorDrag.x, top: colorDrag.y }}>
          <span className="dot" style={{ background: colorVar(colorDrag.token) }}></span>
          <DropCount targetId={dropTargetId} idsFor={dropIdsFor} />
        </div>
      )}

      {colorMenu && colorMenu.kind === "card" && (() => {
        const node = board.nodes.find((n) => n.id === colorMenu.id);
        if (!node) return null;
        // Chuột phải vào thẻ đang nằm trong vùng chọn thì tác động lên cả vùng chọn.
        // Trước đây nó chỉ đổi đúng một thẻ, im lặng — chọn 5 thẻ rồi bấm màu là ra
        // một thẻ đổi màu. Lúc đó chỉ hiện những việc có nghĩa với nhiều thẻ.
        const multi = selectedIds.size > 1 && selectedIds.has(node.id);
        const one = (fn) => (multi ? undefined : fn);
        return (
          <ColorMenu
            x={colorMenu.x}
            y={colorMenu.y}
            count={multi ? selectedIds.size : 1}
            color={multi ? null : node.color ?? null}
            onPick={(color) => (multi ? applyToSelection({ color }) : applyNodeColor(node.id, color))}
            onEdit={one(() => { setColorMenu(null); setEditingId(node.id); })}
            onGroup={multi ? groupSelectedCards : undefined}
            onTidy={multi ? () => { setColorMenu(null); tidySelection(); } : undefined}
            onFocus={one(() => { setColorMenu(null); setFocusId(node.id); })}
            onDuplicate={() => {
              setColorMenu(null);
              if (multi) return duplicateSelection();
              const { next, cloneIds } = duplicateNodes([node.id]);
              store.commit(next);
              setSelectedIds(new Set(cloneIds));
            }}
            onComments={one(() => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id: node.id, x: colorMenu.x, y: colorMenu.y }); })}
            onCopyLink={one(() => {
              const url = new URL(window.location.href);
              url.searchParams.set("card", String(node.id));
              navigator.clipboard.writeText(url.toString());
              setColorMenu(null);
            })}
            onDelete={() => { setColorMenu(null); multi ? deleteSelection() : deleteNode(node.id); }}
            onClose={() => setColorMenu(null)}
            locked={node.locked ?? false}
            onToggleLock={one(() => toggleNodeLock(node.id))}
            shape={multi ? "rect" : node.shape ?? "rect"}
            onSetShape={one((shape) => applyNodeShape(node.id, shape))}
            dashed={multi ? false : !!node.dashed}
            onSetDashed={one((dashed) => applyNodeDashed(node.id, dashed))}
            // Đổi bậc dùng được cho cả một tập thẻ đang chọn: hạ cả một nhánh
            // xuống bậc phụ là việc hay làm, bắt sửa từng thẻ thì rất mỏi.
            level={multi ? null : cardLevel(node)}
            onSetLevel={(level) => (multi ? applyToSelection(levelPatch(level)) : applyNodeLevel(node.id, level))}
            onArrangeTree={one((direction) => arrangeAsTree("node", node.id, direction))}
            onTreePanel={one(() => openTreePanel("node", node.id))}
          />
        );
      })()}

      {colorMenu && colorMenu.kind === "group" && (() => {
        const group = board.groups.find((g) => g.id === colorMenu.id);
        if (!group) return null;
        // Cùng luật với menu của thẻ: chuột phải vào một khung đang nằm trong
        // vùng chọn thì tác động lên cả vùng chọn, và chỉ hiện những việc có
        // nghĩa với nhiều khung.
        const multi = selectedGroupIds.size > 1 && selectedGroupIds.has(group.id);
        const one = (fn) => (multi ? undefined : fn);
        return (
          <ColorMenu
            x={colorMenu.x}
            y={colorMenu.y}
            kind="group"
            count={multi ? selectedGroupIds.size : 1}
            color={multi ? null : group.color ?? null}
            onPick={(color) => (multi ? applyColorToSelection(color) : applyGroupColor(group.id, color))}
            onClose={() => setColorMenu(null)}
            locked={group.locked ?? false}
            onToggleLock={one(() => toggleGroupLock(group.id))}
            onDelete={() => { setColorMenu(null); multi ? deleteSelection() : deleteGroup(group.id); }}
            onArrangeTree={one((direction) => arrangeAsTree("group", group.id, direction))}
            onTreePanel={one(() => openTreePanel("group", group.id))}
          />
        );
      })()}

      {badgeUI && badgeUI.mode === "create" && (
        <BadgeEditor
          key={badgeUI.mode + "-" + (badgeUI.def?.id ?? "new")}
          x={badgeUI.x}
          y={badgeUI.y}
          initialName=""
          initialColor={BADGE_PALETTE[0]}
          submitLabel={t`Tạo`}
          onSubmit={(name, color) => createBadge(badgeUI.kind, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}
      {badgeUI && badgeUI.mode === "edit" && (
        <BadgeEditor
          key={badgeUI.mode + "-" + (badgeUI.def?.id ?? "new")}
          x={badgeUI.x}
          y={badgeUI.y}
          initialName={badgeUI.def.name}
          initialColor={badgeUI.def.color}
          submitLabel={t`Lưu`}
          onDelete={() => deleteBadge(badgeUI.kind, badgeUI.def.id)}
          onSubmit={(name, color) => updateBadge(badgeUI.kind, badgeUI.def.id, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}

      {paletteUI && (
        <PaletteEditor
          key={paletteUI.mode + "-" + (paletteUI.id ?? "new")}
          x={paletteUI.x}
          y={paletteUI.y}
          hex={paletteUI.hex}
          onPick={(hex) => (paletteUI.mode === "create" ? createPaletteColor(hex) : updatePaletteColor(paletteUI.id, hex))}
          onDelete={paletteUI.mode === "edit" ? () => deletePaletteColor(paletteUI.id) : undefined}
          onClose={() => setPaletteUI(null)}
        />
      )}

      {edgeMenu && (() => {
        const edge = board.edges.find((e) => e.id === edgeMenu.id);
        if (!edge) return null;
        return (
          <EdgeMenu
            key={edge.id}
            x={edgeMenu.x} y={edgeMenu.y}
            edge={edge}
            onStyleToggle={() => updateEdge(edge.id, { style: (edge.style === "dashed" ? "solid" : "dashed") })}
            onArrowToggle={() => updateEdge(edge.id, { arrow: edge.arrow === "none" ? undefined : "none" })}
            onReverse={() => updateEdge(edge.id, { from: edge.to, fromKind: edge.toKind, to: edge.from, toKind: edge.fromKind })}
            onLabel={(label) => updateEdge(edge.id, { label: label.trim() || undefined })}
            onColorChange={(color) => updateEdge(edge.id, { color: color || undefined })}
            onDelete={() => deleteEdge(edge.id)}
            onClose={() => setEdgeMenu(null)}
          />
        );
      })()}

      {commentsFor && (() => {
        const node = board.nodes.find((n) => n.id === commentsFor.id);
        if (!node) return null;
        return (
          <CommentsPopover
            key={node.id}
            x={commentsFor.x} y={commentsFor.y}
            comments={node.comments ?? []}
            onAdd={(text) => addComment(node.id, text)}
            onDelete={(index) => deleteComment(node.id, index)}
            onClose={() => setCommentsFor(null)}
          />
        );
      })()}
    </>
  );
}
