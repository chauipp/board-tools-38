import { Trans, useLingui } from "@lingui/react/macro";
import { colorVar } from "../../lib/badges.js";
import FilterPanel from "../FilterPanel.jsx";
import { IconStatus, IconTag, IconPalette, IconStar } from "./icons.jsx";
import { useBoard } from "../../lib/board-context.js";

// Thanh đáy: đảo nút bật panel lọc (trạng thái, nhãn, bảng màu, yêu thích) và
// đảo nội dung của panel đang mở. Trước là một khối JSX trong IdeaMap.jsx; cây
// DOM và class giữ nguyên.
export default function BoardHudBottom({ anyPanelOn, filterFav, filterStatus, filterTags, handleChipMouseDown, handleColorMouseDown, hasNoStatus, hasNoTag, openBadgeCreate, openBadgeMenu, openPaletteEditor, panels, setFilterFav, setFilterStatus, setFilterTags, togglePanel }) {
  const { store, selection, camera } = useBoard();
  const { board } = store;
  const { t } = useLingui();
  return (
    <>
      {/* THANH ĐÁY — đảo nút bật panel, và ngay cạnh nó là đảo nội dung của panel
          đang bật. Panel chỉ sống ở đúng chỗ này: không neo, không nổi, không kéo
          đi đâu được. Đổi lại thì cũng không còn cách nào làm mất nó. */}
      <div className="hud-bottom">
        <div className="island">
          <div className="island-row">
            <button type="button" className={"island-btn" + (panels.status ? " on" : "")} title={t`Trạng thái`} onClick={() => togglePanel("status")}><IconStatus /></button>
            <button type="button" className={"island-btn" + (panels.tag ? " on" : "")} title={t`Nhãn`} onClick={() => togglePanel("tag")}><IconTag /></button>
            <button type="button" className={"island-btn" + (panels.palette ? " on" : "")} title={t`Bảng màu`} onClick={() => togglePanel("palette")}><IconPalette /></button>
            {/* ★ xuống đây theo ba nút kia: nó cũng là BỘ LỌC. Ở lại đảo trên trái
                thì nó đứng lẫn giữa menu, tên board và tìm kiếm — đúng kiểu trộn
                mà cả nhóm này vừa được dọn cho hết. Khác ba nút bên trái ở chỗ nó
                không mở ra khối nội dung nào, bật là ăn ngay. */}
            <button type="button" className={"island-btn" + (filterFav ? " on" : "")} title={t`Chỉ hiện thẻ yêu thích`} onClick={() => setFilterFav((v) => !v)}><IconStar /></button>
          </div>
        </div>

        {anyPanelOn && (
        <div className="island">
        <div className="filter-dock">
        {panels.status && (
          <FilterPanel title={t`Trạng thái`}>
            <div className="fb-chips">
              {board.statuses.map((s) => {
                const key = String(s.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle status" + (filterStatus[key] ? " on" : "")}
                    data-badge-kind="status"
                    data-badge-id={s.id}
                    onMouseDown={(e) => handleChipMouseDown(e, "status", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "status", s)}
                    onClick={() => setFilterStatus((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán trạng thái — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(s.color) }}></span>
                    {s.name}
                  </span>
                );
              })}
              {hasNoStatus && (
                <span
                  className={"chip-toggle status" + (filterStatus["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "status", "none")}
                  onClick={() => setFilterStatus((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa có trạng thái`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không trạng thái</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "status")} title={t`Thêm trạng thái`}>+</button>
            </div>
          </FilterPanel>
        )}

        {panels.tag && (
          <FilterPanel title={t`Nhãn`}>
            <div className="fb-chips">
              {board.tags.map((tg) => {
                const key = String(tg.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle tag" + (filterTags[key] ? " on" : "")}
                    data-badge-kind="tag"
                    data-badge-id={tg.id}
                    onMouseDown={(e) => handleChipMouseDown(e, "tag", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "tag", tg)}
                    onClick={() => setFilterTags((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán nhãn — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(tg.color) }}></span>
                    {tg.name}
                  </span>
                );
              })}
              {hasNoTag && (
                <span
                  className={"chip-toggle tag" + (filterTags["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "tag", "none")}
                  onClick={() => setFilterTags((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa gắn nhãn`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không nhãn</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "tag")} title={t`Thêm nhãn`}>+</button>
            </div>
          </FilterPanel>
        )}

        {panels.palette && (
          <FilterPanel title={t`Bảng màu`}>
            <div className="fb-chips">
              {board.palette.map((c) => (
                <button
                  key={c.id}
                  className="pal-swatch"
                  style={{ background: colorVar(`pal-${c.id}`) }}
                  onMouseDown={(e) => handleColorMouseDown(e, `pal-${c.id}`)}
                  onClick={(e) => openPaletteEditor(e, c)}
                  title={t`Bấm để sửa màu — kéo thả vào thẻ / dây / badge để tô màu`}
                />
              ))}
              <button className="fb-add" onClick={(e) => openPaletteEditor(e, null)} title={t`Thêm màu`}>+</button>
            </div>
            {board.palette.length === 0 && (
              <span className="fb-count"><Trans>Chưa có màu nào — bấm + để tạo.</Trans></span>
            )}
          </FilterPanel>
        )}
        </div>
        </div>
        )}
      </div>
    </>
  );
}
