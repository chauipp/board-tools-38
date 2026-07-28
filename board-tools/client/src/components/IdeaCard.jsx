import { memo, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { colorVar, contrastInk } from "../lib/badges.js";
import { cardLevel } from "../lib/card-levels.js";
import { parseDesc } from "../lib/mdlite.js";

// Phân tích markdown rút gọn của mô tả là việc thuần tuý theo `text`; bọc memo
// để kéo/zoom/di chuột không bắt nó chạy lại cho từng thẻ ở mỗi khung hình.
const MdLite = memo(function MdLite({ text }) {
  const blocks = parseDesc(text);
  const renderInline = (tokens) => tokens.map((tk, i) => {
    if (tk.type === "bold") return <strong key={i}>{tk.value}</strong>;
    if (tk.type === "link") {
      return (
        <a key={i} href={tk.value} target="_blank" rel="noopener noreferrer"
           onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {tk.value}
        </a>
      );
    }
    return tk.value;
  });
  return (
    <>
      {blocks.map((b, i) => b.type === "bullet"
        ? <div key={i} className="md-bullet">{renderInline(b.inline)}</div>
        : <div key={i}>{renderInline(b.inline)}</div>)}
    </>
  );
});

// `h` gom TẤT CẢ hành động của thẻ vào một object có định danh ỔN ĐỊNH (xem
// cardHandlers trong IdeaMap.jsx). Đây là điều kiện để memo() bên dưới có tác
// dụng: nếu vẫn truyền `onMouseDown={(e) => handleNodeMouseDown(e, node)}` thì
// mọi prop hàm đều là object mới ở mỗi lần render cha, memo không bao giờ ăn và
// kéo một thẻ vẫn dựng lại cả trăm thẻ còn lại.
function IdeaCard({
  node, statusDef, tagDef, statuses, tags, currentUser,
  editing, dimmed, linkPending, dropTarget, selected, flash,
  observeCard, h
}) {
  const { t } = useLingui();
  const [title, setTitle] = useState(node.title);
  const [desc, setDesc] = useState(node.desc);
  const [tagId, setTagId] = useState(node.tagId ?? null);
  const [statusId, setStatusId] = useState(node.statusId ?? null);
  // Giữ phần tử gốc trong state (không phải ref) để effect đo kích thước chạy
  // lại đúng lúc React thay phần tử — chuyển qua/lại chế độ sửa là một cây DOM
  // khác hẳn, ref.current đổi âm thầm còn effect thì không hay biết.
  const [el, setEl] = useState(null);

  useEffect(() => {
    if (editing) {
      setTitle(node.title); setDesc(node.desc); setTagId(node.tagId ?? null); setStatusId(node.statusId ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    if (!el) return undefined;
    return observeCard(el);
  }, [el, node.id, observeCard]);

  const classNames = ["idea-card"];
  if (dimmed) classNames.push("dim");
  if (linkPending) classNames.push("link-pending");
  if (dropTarget) classNames.push("drop-target");
  if (selected) classNames.push("selected");
  if (flash) classNames.push("flash");
  if (node.shape === "ellipse") classNames.push("shape-ellipse");
  if (node.dashed) classNames.push("border-dashed");
  // Bậc 5 mặc định viền đứt, nên chọn "viền liền" ở menu chuột phải phải có một
  // class riêng để đè lại — `dashed: false` mà không có class thì không có gì
  // thắng được `.idea-card.lv-5 { border-style: dashed }`.
  else if (node.dashed === false) classNames.push("border-solid");
  const level = cardLevel(node);
  classNames.push(`lv-${level}`);

  function handleEditKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      h.saveAndNext(node.id, { title: title.trim() || t`Ý tưởng mới`, desc: desc.trim(), tagId, statusId });
    } else if (e.key === "Enter" && e.currentTarget.tagName === "INPUT") {
      // Enter thường chỉ lưu ở ô tiêu đề (input 1 dòng) — textarea mô tả
      // vẫn cần Enter để xuống dòng.
      e.preventDefault();
      h.save(node.id, { title: title.trim() || t`Ý tưởng mới`, desc: desc.trim(), tagId, statusId });
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      h.cancelEdit();
    }
  }

  if (editing) {
    return (
      <div
        className={classNames.join(" ")}
        data-id={node.id}
        ref={setEl}
        style={{ left: node.x, top: node.y, ...(node.w ? { width: node.w } : {}) }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="edit-form">
          <input type="text" autoFocus value={title} onChange={(e) => { setTitle(e.target.value); h.liveText(node.id, "title", e.target.value); }} placeholder={t`Tên ý tưởng`} onKeyDown={handleEditKeyDown} />
          <textarea value={desc} onChange={(e) => { setDesc(e.target.value); h.liveText(node.id, "desc", e.target.value); }} placeholder={t`Mô tả ngắn`} onKeyDown={handleEditKeyDown} />
          <div className="edit-row">
            <select value={tagId ?? ""} onChange={(e) => setTagId(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">{t`Không nhãn`}</option>
              {tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
            </select>
            <select value={statusId ?? ""} onChange={(e) => setStatusId(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">{t`Không trạng thái`}</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="edit-actions">
            <button className="save-btn" onClick={() => h.save(node.id, { title: title.trim() || t`Ý tưởng mới`, desc: desc.trim(), tagId, statusId })}><Trans>Lưu</Trans></button>
            <button className="cancel-btn" onClick={h.cancelEdit}><Trans>Hủy</Trans></button>
            {node.image && <button className="cancel-btn" onClick={() => h.removeImage(node.id)}><Trans>Xoá ảnh</Trans></button>}
          </div>
          <div className="edit-hint"><Trans>Enter: lưu · Ctrl+Enter: lưu & tạo ý nối tiếp</Trans></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={classNames.join(" ")}
      data-id={node.id}
      ref={setEl}
      style={{
        left: node.x, top: node.y,
        ...(node.w ? { width: node.w } : {}),
        ...(node.color ? { borderLeftColor: colorVar(node.color), borderLeftWidth: 4 } : {})
      }}
      onMouseDown={(e) => h.mouseDown(e, node.id)}
      onClick={() => h.click(node.id)}
      onContextMenu={(e) => h.contextMenu(e, node.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => h.dropImage(e, node.id)}
    >
      {/* Nút nằm cùng hàng với tiêu đề, không absolute: absolute thì tiêu đề dài
          chạy xuống dưới ngôi sao và bị đè. Tiêu đề co lại, nút giữ nguyên. */}
      <div className="card-top">
        {level === 1 && <span className="root-badge" title={t`Thẻ gốc`}>👑</span>}
        {node.locked && <span className="lock-badge">🔒</span>}
        <div className="title">{node.title}</div>
        <div className="card-actions">
          <button
            className={"icon-btn fav-btn" + ((node.favorites ?? []).includes(currentUser) ? " on" : "")}
            title={t`Yêu thích`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); h.toggleFavorite(node.id); }}
          >
            ★{(node.favorites?.length ?? 0) > 0 ? node.favorites.length : ""}
          </button>
          <button className="icon-btn" title={t`Sửa`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); h.edit(node.id); }}>✎</button>
          <button className="icon-btn" title={t`Xoá`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); h.remove(node.id); }}>×</button>
        </div>
      </div>
      {node.image && (
        <div className="card-img-wrap">
          <img className="card-img" src={node.image} alt="" draggable={false} />
          {!node.locked && (
            <span className="img-resize" title={t`Kéo để đổi cỡ ảnh`} onMouseDown={(e) => h.imageResize(e, node.id)} onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
      <div className="desc">{node.desc ? <MdLite text={node.desc} /> : null}</div>
      <div className="meta-row">
        {statusDef && (
          <span className="status-pill" data-badge-kind="status" data-badge-id={statusDef.id} style={{ background: colorVar(statusDef.color), color: contrastInk(statusDef.color) }}>{statusDef.name}</span>
        )}
        {tagDef && (
          <span className="tag-pill" data-badge-kind="tag" data-badge-id={tagDef.id}>
            <span className="dot" style={{ background: colorVar(tagDef.color) }}></span>
            {tagDef.name}
          </span>
        )}
        {(node.comments?.length ?? 0) > 0 && (
          <button
            className="cmt-pill"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); h.openComments(e, node.id); }}
          >
            💬 {node.comments.length}
          </button>
        )}
      </div>
      <span className="connector-zone top" title={t`Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác`}><span className="connector-dot" onMouseDown={(e) => h.connectorMouseDown(e, node.id, "top")} onClick={(e) => e.stopPropagation()}>+</span></span>
      <span className="connector-zone right" title={t`Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác`}><span className="connector-dot" onMouseDown={(e) => h.connectorMouseDown(e, node.id, "right")} onClick={(e) => e.stopPropagation()}>+</span></span>
      <span className="connector-zone bottom" title={t`Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác`}><span className="connector-dot" onMouseDown={(e) => h.connectorMouseDown(e, node.id, "bottom")} onClick={(e) => e.stopPropagation()}>+</span></span>
      <span className="connector-zone left" title={t`Bấm để tạo ý tưởng nối tiếp — giữ và kéo để nối tới thẻ khác`}><span className="connector-dot" onMouseDown={(e) => h.connectorMouseDown(e, node.id, "left")} onClick={(e) => e.stopPropagation()}>+</span></span>
    </div>
  );
}

export default memo(IdeaCard);
