import { memo } from "react";
import { useLingui } from "@lingui/react/macro";
import { HANDLE_EDGE } from "../../lib/shape.js";
import FrameBox from "../FrameBox.jsx";
import IdeaCard from "../IdeaCard.jsx";
import EdgeLayer from "../EdgeLayer.jsx";
import PeerLayer from "../PeerLayer.jsx";
import { edgeKey } from "../../lib/tree-layout.js";
import InkLayer from "../InkLayer.jsx";
import LaserLayer from "../LaserLayer.jsx";
import { cornerPoint, SELECTION_CORNERS } from "../../lib/selection-box.js";
import { useBoard } from "../../lib/board-context.js";

// Lớp .canvas: mọi thứ di chuyển theo camera — khung, dây, thẻ, nét vẽ, laser,
// con trỏ người khác, tay cầm. Bọc memo; nhưng thứ thực sự chặn việc dựng lại
// toàn bộ thẻ khi kéo một thẻ vẫn là React.memo của IdeaCard/FrameBox/EdgeLayer
// cùng các prop hàm ổn định (useStableHandlers) — giữ nguyên như trước. Trước là
// một khối JSX trong IdeaMap.jsx; cây DOM và class giữ nguyên.
function BoardCanvas({ boardId, canGrabShapeHandles, canvasRef, cardHandlers, currentUser, dependency, dropTargetId, edgeDrag, edgeRoutes, editShape, editingGroupTitleId, editingId, flashId, focusSet, frameCardSize, gameDesign, groupById, groupHandlers, handleEdgeEndpointMouseDown, handleInkCaptureMouseDown, handleSelectionResizeMouseDown, handleShapeHandleMouseDown, handleViewportMouseDown, hoveredEdgeId, ink, inkDrawings, inkLive, isNodeDropTarget, laser, layoutOwners, linkDraft, linkMode, liveGroups, liveNodes, mode, nodeById, observeCard, onEdgeClick, onEdgeContextMenu, onEdgeEnter, onEdgeLeave, passesFilter, pendingSource, placeDraft, setDesignEditId, setHoveredEdgeId, shapeHandleAt, skin, snapGuides, socket, spotlightPeerId, statusDefById, tagDefById, textEdit, textOverlay, tool, treeSwapState }) {
  const { store, selection, camera } = useBoard();
  const { board, role } = store;
  const { marquee, selBounds, selectedDrawingIds, selectedEdgeIds, selectedGroupIds, selectedIds } = selection;
  const { view } = camera;
  const { t } = useLingui();
  return (
    <>
      <div
        className="canvas"
        ref={canvasRef}
        style={{ transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.scale})` }}
      >
        {marquee && (
          <div className="marquee-box" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
        )}
        {placeDraft && (
          <div className="place-draft" style={{ left: placeDraft.x, top: placeDraft.y, width: placeDraft.w, height: placeDraft.h }} />
        )}
        {/* TAY CẦM SỬA HÌNH — hiện khi chọn đúng MỘT hình khối. Kéo tay cầm
            góc để đặt từng đỉnh, kéo tay cầm cạnh (ô tròn ở giữa cạnh) để dời
            trọn một cạnh. Với hình định nghĩa bằng hộp bao (chữ nhật, ê-líp,
            hình thoi, tam giác cân) thì góc là góc hộp và cạnh là mép hộp —
            xem ghi chú dài ở lib/shape.js về lý do hai ý nghĩa khác nhau.
            Hiện ở mode Chuột, VÀ ở mode Sửa khi đang cầm BÚT. Ở mode Sửa thì
            `.ink-capture` phủ kín khung nhìn nên chúng không tự nhận được
            chuột — handleInkCaptureMouseDown dò tay để bắt hộ (xem
            shapeHandleAt). Cố ý chỉ ở tool Bút: cục gôm quét trúng tay cầm là
            xoá mất hình, còn tool Hình khối thì việc đang làm là ĐẶT hình mới,
            mấy ô vuông nhỏ nằm giữa vùng kéo chỉ tổ vướng. */}
        {editShape && canGrabShapeHandles && role !== "viewer" && editShape.handles.map((h) => (
          <div
            key={h.t + h.i}
            className={"shape-handle" + (h.t === HANDLE_EDGE ? " edge" : "")}
            // Bù trừ zoom, cùng lý do với tay cầm của hộp bao vùng chọn: cỡ cố
            // định thì ở zoom 40% không bấm nổi, ở 240% thì to hơn cả cái hình.
            style={{
              left: h.x, top: h.y,
              transform: `translate(-50%, -50%) scale(${1 / view.scale})`
            }}
            title={h.t === HANDLE_EDGE ? t`Kéo để dời cả cạnh này` : t`Kéo để đặt góc này vào chỗ khác`}
            onMouseDown={(e) => handleShapeHandleMouseDown(e, h)}
          />
        ))}
        {/* HỘP BAO VÙNG CHỌN. Bản thân hộp KHÔNG nhận chuột (pointer-events:
            none trong CSS) — nó chỉ nói cho mắt biết "cả vùng này là một cụm".
            Cú kéo trong lòng hộp do handleViewportMouseDown bắt, nên bấm trúng
            một cái thẻ ở giữa vùng vẫn là bấm vào cái thẻ đó: bấm đúp để sửa,
            kéo góc ảnh, bấm chip… tất cả còn nguyên.
            Bốn tay cầm ở góc thì NGƯỢC LẠI, chúng bật lại pointer-events —
            chúng là thứ duy nhất trong hộp cướp chuột, và chỉ ở đúng 4 ô nhỏ.
            Chỉ hiện ở mode Chuột: ở mode Sửa cả khung nhìn đã bị .ink-capture
            phủ kín, tay cầm sẽ không bao giờ bấm được, mà vẫn che mất chỗ vẽ. */}
        {selBounds && mode === "select" && (
          <div
            className={"selection-box" + (dropTargetId?.kind === "selection" ? " drop" : "")}
            style={{ left: selBounds.x, top: selBounds.y, width: selBounds.w, height: selBounds.h }}
          >
            {role !== "viewer" && SELECTION_CORNERS.map((corner) => {
              const p = cornerPoint(selBounds, corner);
              return (
                <div
                  key={corner}
                  className={"selection-handle " + corner}
                  // Bù trừ zoom: tay cầm nằm trong .canvas (đã scale) nên nếu
                  // để cỡ cố định thì ở zoom 40% nó bé tới mức không bấm nổi,
                  // còn ở zoom 240% thì nó to hơn cả cái thẻ.
                  style={{
                    left: p.x - selBounds.x,
                    top: p.y - selBounds.y,
                    transform: `translate(-50%, -50%) scale(${1 / view.scale})`
                  }}
                  title={t`Kéo để phóng to / thu nhỏ cả cụm`}
                  onMouseDown={(e) => handleSelectionResizeMouseDown(e, corner)}
                />
              );
            })}
          </div>
        )}
        {liveGroups.map((group) => (
          <FrameBox
            key={group.id}
            group={group}
            treeSwapState={treeSwapState(edgeKey("group", group.id))}
            editingTitle={editingGroupTitleId === group.id}
            dropTarget={!!dropTargetId && dropTargetId.kind === "group" && dropTargetId.id === group.id}
            selected={selectedGroupIds.has(group.id)}
            h={groupHandlers}
          />
        ))}

        <EdgeLayer
          edges={board.edges}
          routes={edgeRoutes}
          nodeById={nodeById}
          groupById={groupById}
          cardSize={frameCardSize}
          sketch={skin === "sketch"}
          gameDesign={board.kind === "game-design"}
          cycleEdgeIds={dependency?.cycleEdgeIds}
          hoveredEdgeId={hoveredEdgeId}
          selectedEdgeIds={selectedEdgeIds}
          edgeDragId={edgeDrag ? edgeDrag.edgeId : null}
          snapGuides={snapGuides}
          linkDraft={linkDraft}
          edgeDraft={edgeDrag}
          onEdgeEnter={onEdgeEnter}
          onEdgeLeave={onEdgeLeave}
          onEdgeClick={onEdgeClick}
          onEdgeContextMenu={onEdgeContextMenu}
        />

        {liveNodes.map((liveNode) => {
          const liveText = editingId === liveNode.id ? null : textOverlay.get(String(liveNode.id));
          const renderNode = liveText
            ? { ...liveNode, title: liveText.title ?? liveNode.title, desc: liveText.desc ?? liveNode.desc }
            : liveNode;
          return (
            <IdeaCard
              key={liveNode.id}
              node={renderNode}
              layoutLocked={layoutOwners.has(edgeKey("node", liveNode.id))}
              layoutSwappable={!liveNode.locked && layoutOwners.has(edgeKey("node", liveNode.id)) && layoutOwners.get(edgeKey("node", liveNode.id)) !== edgeKey("node", liveNode.id)}
              treeSwapState={treeSwapState(edgeKey("node", liveNode.id))}
              boardId={boardId}
              statusDef={statusDefById.get(liveNode.statusId) ?? null}
              tagDef={tagDefById.get(liveNode.tagId) ?? null}
              statuses={board.statuses}
              tags={board.tags}
              currentUser={currentUser}
              observeCard={observeCard}
              editing={editingId === liveNode.id}
              dimmed={(!passesFilter(liveNode) || (focusSet != null && !focusSet.has(liveNode.id))) && editingId !== liveNode.id}
              linkPending={linkMode && pendingSource === liveNode.id}
              dropTarget={isNodeDropTarget(liveNode.id)}
              selected={selectedIds.has(liveNode.id)}
              flash={flashId === liveNode.id}
              gameDesign={board.kind === "game-design"}
              balance={board.gameDesignBalance}
              blocked={dependency?.blockedNodeIds.has(String(liveNode.id))}
              dependencyCycle={dependency?.cycleNodeIds.has(String(liveNode.id))}
              onDesign={() => setDesignEditId(liveNode.id)}
              h={cardHandlers}
            />
          );
        })}

        <PeerLayer socket={socket} nodeById={nodeById} groupById={groupById} cardSize={frameCardSize} spotlightPeerId={spotlightPeerId} />

        <InkLayer
          drawings={inkDrawings}
          draft={ink.draft}
          eraseIds={ink.eraseIds}
          cut={ink.cut}
          liveStrokes={inkLive.liveStrokes}
          sketch={skin === "sketch"}
          editingTextId={textEdit ? textEdit.id : null}
          selectedIds={selectedDrawingIds}
        />

        {/* Nằm trong .canvas nên vệt bám theo bảng khi lia/phóng — chỉ vào
            một cái thẻ thì vệt ở lại đúng cái thẻ đó, không trôi ra chỗ khác
            khi người xem lia bảng. */}
        <LaserLayer socket={socket} store={laser.store} scale={view.scale} />

        {/* Tay cầm nổi trên cùng, tách khỏi .edge-layer: đầu dây thường trùng
            đúng chỗ connector-zone của thẻ (cả hai đều ở tâm cạnh), và thẻ
            luôn vẽ sau .edge-layer nên connector-zone sẽ che tay cầm nếu để
            chung lớp — chuột sẽ trúng connector-zone thay vì tay cầm. */}
        {hoveredEdgeId != null && !edgeDrag && (() => {
          const edge = board.edges.find((e) => e.id === hoveredEdgeId);
          if (!edge) return null;
          const route = edgeRoutes.get(edge.id);
          if (!route) return null;
          const p1 = route.start, p2 = route.end;
          return (
            <svg
              className="edge-handle-layer"
              onMouseLeave={() => setHoveredEdgeId((id) => (id === edge.id ? null : id))}
            >
              <circle
                className="edge-handle" cx={p1.x} cy={p1.y} r={6}
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseDown={(e) => handleEdgeEndpointMouseDown(e, edge, "from")}
              />
              <circle
                className="edge-handle" cx={p2.x} cy={p2.y} r={6}
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseDown={(e) => handleEdgeEndpointMouseDown(e, edge, "to")}
              />
            </svg>
          );
        })()}
      </div>
    </>
  );
}

export default memo(BoardCanvas);
