import { memo, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { colorVar, contrastInk } from "../lib/badges.js";
import { cardLevel } from "../lib/card-levels.js";
import { parseDesc } from "../lib/mdlite.js";
import { abTestProgress, acceptanceProgress, balanceMetricsForCard, followUpProgress, gameDesignPreview, hasLiveOps, hasPostLaunchReview, normalizeAnalyticsEvents, normalizeDelivery, normalizeLiveOps, normalizePostLaunchReview } from "../lib/game-design.js";

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
  node, boardId, statusDef, tagDef, statuses, tags, currentUser,
  editing, dimmed, linkPending, dropTarget, selected, flash,
  observeCard, gameDesign, balance, blocked, dependencyCycle, onDesign, h
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
  // Màu thẻ tô NỀN chứ không còn là vạch viền trái. Giá trị thật do CSS trộn ra
  // từ --tint (xem .idea-card.tinted), nên một token màu tự cho ra nền đúng ở
  // cả hai theme.
  if (node.color) classNames.push("tinted");
  const tintStyle = node.color ? { "--tint": colorVar(node.color) } : null;
  if (node.shape === "ellipse") classNames.push("shape-ellipse");
  if (node.dashed) classNames.push("border-dashed");
  // Bậc 5 mặc định viền đứt, nên chọn "viền liền" ở menu chuột phải phải có một
  // class riêng để đè lại — `dashed: false` mà không có class thì không có gì
  // thắng được `.idea-card.lv-5 { border-style: dashed }`.
  else if (node.dashed === false) classNames.push("border-solid");
  const level = cardLevel(node);
  const designPreview = gameDesign ? gameDesignPreview(node) : [];
  const criteriaProgress = gameDesign ? acceptanceProgress(node) : { done: 0, total: 0 };
  const delivery = gameDesign ? normalizeDelivery(node.design?.delivery) : null;
  const analyticsCount = gameDesign ? normalizeAnalyticsEvents(node.design?.analyticsEvents).length : 0;
  const abTests = gameDesign ? abTestProgress(node) : { total: 0, running: 0 };
  const liveOps = gameDesign ? normalizeLiveOps(node.design?.liveOps) : null;
  const postLaunchReview = gameDesign ? normalizePostLaunchReview(node.design?.postLaunchReview) : null;
  const followUps = gameDesign ? followUpProgress(node) : { done: 0, total: 0 };
  const balanceCount = gameDesign ? balanceMetricsForCard(balance, node.id).length : 0;
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
        data-wob={node.id % 4}
        ref={setEl}
        style={{ left: node.x, top: node.y, ...(node.w ? { width: node.w } : {}), ...tintStyle }}
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
      // Bốn kiểu viền méo của skin vẽ tay, chọn theo id chứ không theo chỉ số
      // trong mảng: chỉ số đổi khi xoá một thẻ khác, và thẻ này sẽ đột nhiên méo
      // sang kiểu khác dù chẳng ai đụng vào nó.
      data-wob={node.id % 4}
      ref={setEl}
      style={{
        left: node.x, top: node.y,
        ...(node.w ? { width: node.w } : {}),
        ...tintStyle
      }}
      onMouseDown={(e) => h.mouseDown(e, node.id)}
      onClick={() => { h.click(node.id); if (gameDesign) onDesign(); }}
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
          {gameDesign && (
            <button className="icon-btn gd-card-btn" title={t`Mở chi tiết Game Design`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDesign(); }}>
              GD
            </button>
          )}
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
      {gameDesign && <div className="gd-card-type">{node.type || "freeform"}</div>}
      {gameDesign && (blocked || dependencyCycle) && (
        <div className="gd-card-dependency" aria-label="Trạng thái phụ thuộc">
          {blocked && <span className="gd-dependency-badge blocked">Blocked</span>}
          {dependencyCycle && <span className="gd-dependency-badge cycle">Vòng lặp</span>}
        </div>
      )}
      {gameDesign && delivery && (delivery.milestone || delivery.assignee || delivery.deadline || delivery.blocker || delivery.blockerLevel !== "none") && (
        <div className="gd-card-delivery">
          {delivery.milestone && <span>{delivery.milestone}</span>}
          {delivery.deadline && <time dateTime={delivery.deadline}>⌛ {delivery.deadline}</time>}
          {delivery.assignee && <span>◎ {delivery.assignee}</span>}
          {delivery.blockerLevel !== "none" && <span className={`gd-delivery-blocker ${delivery.blockerLevel}`}>{delivery.blockerLevel === "blocked" ? "Bị chặn" : "Rủi ro"}</span>}
        </div>
      )}
      {gameDesign && analyticsCount > 0 && <div className="gd-card-analytics">◌ Analytics {analyticsCount}</div>}
      {gameDesign && abTests.total > 0 && <div className="gd-card-ab-tests">⇄ A/B {abTests.total}{abTests.running ? " · Running" : ""}</div>}
      {gameDesign && hasLiveOps(liveOps) && <div className={`gd-card-live-ops ${liveOps.status}`}>◉ Live · {liveOps.status === "paused" ? "Paused" : liveOps.status === "rolled-back" ? "Rolled back" : liveOps.status === "full" ? "Full" : liveOps.rolloutPercent ? `${liveOps.rolloutPercent}%` : liveOps.status === "running" ? "Running" : "Planned"}</div>}
      {gameDesign && hasPostLaunchReview(postLaunchReview) && <div className={`gd-card-post-launch ${postLaunchReview.status}`}>◒ Post-launch · {postLaunchReview.status === "healthy" ? "Healthy" : postLaunchReview.status === "needs-iteration" ? "Iterate" : postLaunchReview.status === "sunset" ? "Sunset" : "Pending"}</div>}
      {gameDesign && followUps.total > 0 && <div className="gd-card-follow-ups">✓ Follow-up {followUps.done}/{followUps.total}</div>}
      {gameDesign && balanceCount > 0 && <div className="gd-card-balance">◈ Balance {balanceCount}</div>}
      {criteriaProgress.total > 0 && (
        <div className="gd-card-progress" aria-label={`Tiến độ tiêu chí ${criteriaProgress.done}/${criteriaProgress.total}`}>
          Tiêu chí {criteriaProgress.done}/{criteriaProgress.total}
        </div>
      )}
      {node.image && (
        <div className="card-img-wrap">
          <img className="card-img" src={node.image} alt="" draggable={false} />
          {!node.locked && (
            <span className="img-resize" title={t`Kéo để đổi cỡ ảnh`} onMouseDown={(e) => h.imageResize(e, node.id)} onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
      {node.pdf && (
        <div
          className="card-pdf-wrap"
          style={{ "--pdf-h": `${node.pdfH || node.h || 500}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <iframe
            className="card-pdf"
            title={node.pdf.name || node.title}
            src={`/api/boards/${encodeURIComponent(boardId)}/files/${encodeURIComponent(node.pdf.fileId)}#toolbar=0&navpanes=0`}
          />
          {!node.locked && (
            <span className="pdf-resize" title={t`Kéo để đổi cỡ khung PDF`}
              onMouseDown={(e) => h.pdfResize(e, node.id)} onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
      <div className="desc">{node.desc ? <MdLite text={node.desc} /> : null}</div>
      {designPreview.length > 0 && (
        <div className="gd-card-preview">
          {designPreview.map((item) => <div key={item.field}><span>{item.label}</span>{item.value}</div>)}
        </div>
      )}
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
