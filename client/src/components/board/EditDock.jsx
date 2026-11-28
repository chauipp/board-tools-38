import { Trans, useLingui } from "@lingui/react/macro";
import { BADGE_PALETTE, colorVar } from "../../lib/badges.js";
import { RELATION_OPTIONS, relationDefinition, isGameDesignRelation } from "../../lib/game-design.js";
import { lazyPanel } from "../../lib/lazy-panel.jsx";

// Các panel game-design tách chunk riêng (task 2.9): board ý tưởng không phải
// tải chúng.
const GameDesignPanel = lazyPanel(() => import("../GameDesignPanel.jsx"));
const GameDesignBriefPanel = lazyPanel(() => import("../GameDesignBriefPanel.jsx"));
const GameDesignFlowPanel = lazyPanel(() => import("../GameDesignFlowPanel.jsx"));
const DevHandoffPanel = lazyPanel(() => import("../DevHandoffPanel.jsx"));
const GameDesignBalancePanel = lazyPanel(() => import("../GameDesignBalancePanel.jsx"));
const DecisionTimelinePanel = lazyPanel(() => import("../DecisionTimelinePanel.jsx"));
const BoardSnapshotsPanel = lazyPanel(() => import("../BoardSnapshotsPanel.jsx"));
const GameDesignInsightsPanel = lazyPanel(() => import("../GameDesignInsightsPanel.jsx"));
const GameDesignReportsPanel = lazyPanel(() => import("../GameDesignReportsPanel.jsx"));
const GameDesignImpactPanel = lazyPanel(() => import("../GameDesignImpactPanel.jsx"));
const PlaytestComparisonPanel = lazyPanel(() => import("../PlaytestComparisonPanel.jsx"));

// Dock bên phải cho các bảng game-design (brief, flow, balance, handoff,
// decision timeline, snapshot, insights, reports, impact, playtest) và chi tiết
// thẻ/dây. Trước là một khối JSX trong IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function EditDock({ applyColorToSelection, applyToSelection, balanceOpen, board, boardName, briefOpen, clearSelection, createRelatedDesignNode, createSnapshot, decisionTimelineOpen, deleteEdge, deleteSelection, dependency, designEditId, duplicateDesignNode, duplicateSelection, editDockRef, flowOpen, groupSelectedCards, handoffOpen, hasDashableSelected, impactCardId, impactOpen, insightsOpen, inspector, playtestsOpen, reportsOpen, restoreSnapshot, role, saveDesignNode, saveGameDesignBalance, saveGameDesignBrief, saveGameDesignFlow, selectedDrawingIds, selectedEdgeIds, selectedGroupIds, selectedIds, setBalanceOpen, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setDrawingsDashed, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setPlaytestsOpen, setReportsOpen, setSnapshotsOpen, snapshots, snapshotsLoading, snapshotsOpen, tidySelection, treeUI, updateEdge }) {
  const { t } = useLingui();
  return (
    <>
      {/* Dock bên phải là chỗ DUY NHẤT cho mọi thao tác làm đổi dữ liệu: spec
          của thẻ GD và batch edit của mọi loại board cùng sống ở đây. */}
      {!treeUI && (briefOpen || flowOpen || balanceOpen || handoffOpen || decisionTimelineOpen || snapshotsOpen || insightsOpen || reportsOpen || impactOpen || playtestsOpen || designEditId != null || selectedEdgeIds.size >= 1 || selectedIds.size + selectedGroupIds.size >= 2 || selectedGroupIds.size >= 1 || selectedDrawingIds.size >= 1) && (
        <aside className="edit-dock" ref={editDockRef}>
          {briefOpen && board.kind === "game-design" && <GameDesignBriefPanel brief={board.gameDesignBrief} canEdit={role !== "viewer"} onSave={saveGameDesignBrief} onClose={() => setBriefOpen(false)} outsideRef={editDockRef} />}
          {flowOpen && board.kind === "game-design" && <GameDesignFlowPanel flow={board.gameDesignFlow} nodes={board.nodes} canEdit={role !== "viewer"} onSave={saveGameDesignFlow} onClose={() => setFlowOpen(false)} outsideRef={editDockRef} />}
          {balanceOpen && board.kind === "game-design" && <GameDesignBalancePanel balance={board.gameDesignBalance} nodes={board.nodes} canEdit={role !== "viewer"} onSave={saveGameDesignBalance} onClose={() => setBalanceOpen(false)} outsideRef={editDockRef} />}
          {handoffOpen && board.kind === "game-design" && <DevHandoffPanel board={board} boardName={boardName} selectedIds={selectedIds} onClose={() => setHandoffOpen(false)} outsideRef={editDockRef} />}
          {decisionTimelineOpen && board.kind === "game-design" && <DecisionTimelinePanel nodes={board.nodes} onOpenCard={(id) => { setDecisionTimelineOpen(false); setDesignEditId(id); }} onClose={() => setDecisionTimelineOpen(false)} outsideRef={editDockRef} />}
          {snapshotsOpen && <BoardSnapshotsPanel snapshots={snapshots} loading={snapshotsLoading} canEdit={role !== "viewer"} onCreate={createSnapshot} onRestore={restoreSnapshot} onClose={() => setSnapshotsOpen(false)} outsideRef={editDockRef} />}
          {insightsOpen && board.kind === "game-design" && <GameDesignInsightsPanel nodes={board.nodes} onOpenCard={(id) => { setInsightsOpen(false); setDesignEditId(id); }} onClose={() => setInsightsOpen(false)} outsideRef={editDockRef} />}
          {impactOpen && board.kind === "game-design" && <GameDesignImpactPanel board={board} initialCardId={impactCardId} onOpenCard={(id) => { setImpactOpen(false); setDesignEditId(id); }} onClose={() => setImpactOpen(false)} outsideRef={editDockRef} />}
          {playtestsOpen && board.kind === "game-design" && <PlaytestComparisonPanel nodes={board.nodes} onOpenCard={(id) => { setPlaytestsOpen(false); setDesignEditId(id); }} onClose={() => setPlaytestsOpen(false)} outsideRef={editDockRef} />}
          {reportsOpen && board.kind === "game-design" && <GameDesignReportsPanel board={board} boardName={boardName} onClose={() => setReportsOpen(false)} outsideRef={editDockRef} />}
          {designEditId != null && board.kind === "game-design" && (() => {
            const node = board.nodes.find((n) => n.id === designEditId);
            return node ? <GameDesignPanel node={node} nodes={board.nodes} balance={board.gameDesignBalance} canEdit={role !== "viewer"} onSave={saveDesignNode} onDuplicate={() => duplicateDesignNode(node.id)} onCreateRelated={(type, relation) => createRelatedDesignNode(node.id, type, relation)} onClose={() => setDesignEditId(null)} onOpenBalance={() => { setDesignEditId(null); setBalanceOpen(true); }} onOpenImpact={() => { setDesignEditId(null); setImpactCardId(node.id); setImpactOpen(true); }} outsideRef={editDockRef} /> : null;
          })()}
          {board.kind === "game-design" && selectedEdgeIds.size === 1 && (() => {
            const edge = board.edges.find((item) => item.id === [...selectedEdgeIds][0]);
            if (!edge) return null;
            const relation = relationDefinition(edge.relation);
            const isDependency = edge.relation === "depends-on";
            const chain = isDependency ? dependency?.chainFrom(edge.from) || [] : [];
            const chainLabels = chain.map((id) => board.nodes.find((node) => String(node.id) === id)?.title || `#${id}`);
            const hasCycle = dependency?.cycleEdgeIds.has(edge.id);
            const isBlocked = dependency?.blockedNodeIds.has(String(edge.from));
            return (
              <div className="edge-inspector" onMouseDown={(e) => e.stopPropagation()}>
                <div className="gd-kicker">Quan hệ edge</div>
                <h2>Liên kết thẻ</h2>
                <label>Loại quan hệ
                  <select value={isGameDesignRelation(edge.relation) ? edge.relation : "depends-on"} disabled={role === "viewer"} onChange={(e) => updateEdge(edge.id, { relation: e.target.value })}>
                    {RELATION_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <p className="edge-relation-help">{relation.description}</p>
                {isDependency && (
                  <div className="dependency-inspector">
                    <div className="dependency-chain"><strong>Chuỗi phụ thuộc</strong><span>{chainLabels.join(" → ")}</span></div>
                    {isBlocked && <p className="dependency-warning">Thẻ nguồn đang bị chặn: có prerequisite chưa ở trạng thái Done.</p>}
                    {hasCycle && <p className="dependency-warning">Vòng lặp phụ thuộc: chuỗi này không thể được hoàn tất theo thứ tự hiện tại.</p>}
                  </div>
                )}
                {role !== "viewer" && <button className="btn danger edge-delete" onClick={() => deleteEdge(edge.id)}>Xóa dây</button>}
              </div>
            );
          })()}
          {/* Quét trúng cả khung/nét vẽ cũng cần edit dock; nút chỉ có nghĩa
              với thẻ thì tự ẩn khi không có thẻ nào trong vùng chọn. */}
          {(selectedIds.size + selectedGroupIds.size >= 2 || selectedGroupIds.size >= 1 || selectedDrawingIds.size >= 1) && (
            <div className="bulk-bar" onMouseDown={(e) => e.stopPropagation()}>
          <span className="bb-count mono">
            {selectedIds.size > 0 && <Trans>{selectedIds.size} thẻ</Trans>}
            {selectedIds.size > 0 && selectedGroupIds.size > 0 && " · "}
            {selectedGroupIds.size > 0 && <Trans>{selectedGroupIds.size} khung</Trans>}
            {(selectedIds.size > 0 || selectedGroupIds.size > 0) && selectedDrawingIds.size > 0 && " · "}
            {selectedDrawingIds.size > 0 && <Trans>{selectedDrawingIds.size} nét vẽ</Trans>}
          </span>
          {selectedIds.size >= 2 && (
            <>
              <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ statusId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
                <option value="">{t`Trạng thái…`}</option>
                <option value="none">{t`Không trạng thái`}</option>
                {board.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ tagId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
                <option value="">{t`Nhãn…`}</option>
                <option value="none">{t`Không nhãn`}</option>
                {board.tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
              </select>
            </>
          )}
          {/* Ô màu áp cho CẢ thẻ lẫn khung đang chọn — cả hai đều nhận cùng
              một `color` token, nên một hàng màu là đủ cho mọi thứ đang chọn. */}
          <div className="bb-swatches">
            <button className="be-swatch dot-empty" onClick={() => applyColorToSelection(null)} title={t`Không màu`} />
            {BADGE_PALETTE.map((token) => (
              <button key={token} className="be-swatch" style={{ background: colorVar(token) }} onClick={() => applyColorToSelection(token)} title={token} />
            ))}
          </div>
          {/* NÉT LIỀN / NÉT ĐỨT cho cả vùng chọn. Cử chỉ bấm hai lần đã làm
              được việc này, nhưng nó đòi nhắm TRÚNG một cái nét — với một nét
              mảnh giữa một đám vừa quét thì đó là việc khó chịu. Ở đây thì
              không phải nhắm gì cả.
              Hai nút đặt giá trị TƯỜNG MINH chứ không phải một nút lật: vùng
              chọn có thể đang nửa liền nửa đứt, mà "lật" một tập lẫn lộn thì
              không có nghĩa gì rõ ràng. */}
          {hasDashableSelected && (
            <>
              <button className="bb-clear" onClick={() => setDrawingsDashed(selectedDrawingIds, false)}><Trans>Nét liền</Trans></button>
              <button className="bb-clear" onClick={() => setDrawingsDashed(selectedDrawingIds, true)}><Trans>Nét đứt</Trans></button>
            </>
          )}
          {selectedIds.size >= 2 && (
            <>
              <button className="bb-clear" onClick={groupSelectedCards}><Trans>Gom nhóm</Trans></button>
              <button className="bb-clear" onClick={tidySelection}><Trans>Xếp gọn</Trans></button>
              <button className="bb-clear" onClick={duplicateSelection}><Trans>Nhân bản</Trans></button>
            </>
          )}
          <button className="bb-clear danger" onClick={deleteSelection}><Trans>Xoá</Trans></button>
          <span className="bb-sep" />
          <button className="bb-clear" onClick={clearSelection}><Trans>Bỏ chọn</Trans></button>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
