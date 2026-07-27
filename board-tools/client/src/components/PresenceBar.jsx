import { useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { cursorColor } from "../lib/usePresence.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

// Ảnh Google hay hỏng (hết hạn, chặn referrer) và chỉ biết lúc <img> báo lỗi —
// nên fallback chữ cái đầu phải là state của từng avatar, không suy ra trước
// được từ việc có hay không có `picture`.
function Avatar({ name, email, picture, color, title, onClick }) {
  const [imgOk, setImgOk] = useState(true);
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={"presence-avatar" + (onClick ? " clickable" : "")}
      style={{ "--peer-color": color }}
      title={title}
      onClick={onClick}
    >
      {picture && imgOk ? (
        <img src={picture} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
      ) : (
        <span className="presence-avatar-initial">{initial}</span>
      )}
    </Tag>
  );
}

/**
 * Danh tính + những người đang mở cùng board, đặt ở cuối thanh filter.
 *
 * Chỉ hiện người đang kết nối (nguồn là presence socket). Thành viên được mời
 * nhưng chưa vào không xuất hiện ở đây — thanh này trả lời "ai đang ở đây",
 * không phải "board có những ai".
 */
export default function PresenceBar({ user, peers, canInvite, onInvite, onJumpToPeer, onLogout }) {
  const { t } = useLingui();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useCloseOnOutside(menuRef, () => setMenuOpen(false));

  return (
    <div className="presence-bar">
      {peers.length > 0 && (
        <div className="presence-peers">
          {peers.map((peer) => (
            <Avatar
              key={peer.socketId}
              name={peer.name}
              email={peer.email}
              picture={peer.picture}
              color={cursorColor(peer.email)}
              title={t`${peer.name} — bấm để nhảy tới con trỏ`}
              onClick={() => onJumpToPeer(peer)}
            />
          ))}
        </div>
      )}

      {canInvite && (
        <button type="button" className="btn ghost small" onClick={onInvite}>
          <Trans>+ Mời</Trans>
        </button>
      )}

      <div className="presence-me" ref={menuRef}>
        <Avatar
          name={user.name}
          email={user.email}
          picture={user.picture}
          color={cursorColor(user.email)}
          title={user.name}
          onClick={() => setMenuOpen((v) => !v)}
        />
        {menuOpen && (
          <div className="presence-menu">
            <div className="presence-menu-name">{user.name}</div>
            <div className="presence-menu-email mono">{user.email}</div>
            <button type="button" className="btn ghost" onClick={onLogout}>
              <Trans>Đăng xuất</Trans>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
