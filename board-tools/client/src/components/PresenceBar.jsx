import { useMemo, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { cursorColor, usePeers } from "../lib/usePresence.js";
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
 *
 * Tự đăng ký usePeers thay vì nhận danh sách từ IdeaMap, cùng lý do với
 * PeerLayer: nhịp con trỏ 20 lần/giây/người không được phép kéo cả bản đồ
 * render lại. Ở đây nhịp đó chỉ chạm tới vài cái avatar.
 */
export default function PresenceBar({ user, socket, canInvite, onInvite, onJumpToPeer, onLogout }) {
  const { t } = useLingui();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useCloseOnOutside(menuRef, () => setMenuOpen(false));

  const peers = usePeers(socket);
  // Avatar chỉ phụ thuộc danh tính, không phụ thuộc toạ độ con trỏ — dựng lại
  // mảng theo chữ ký socketId để mỗi gói cursor:move không tạo mảng mới.
  const identities = useMemo(
    () => Array.from(peers.values()).map((p) => ({ socketId: p.socketId, email: p.email, name: p.name, picture: p.picture })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Array.from(peers.keys()).join(",")]
  );

  return (
    <div className="presence-bar">
      {identities.length > 0 && (
        <div className="presence-peers">
          {identities.map((peer) => (
            <Avatar
              key={peer.socketId}
              name={peer.name}
              email={peer.email}
              picture={peer.picture}
              color={cursorColor(peer.email)}
              title={t`${peer.name} — bấm để nhảy tới con trỏ`}
              // Lấy bản mới nhất từ Map lúc bấm: `peer` ở đây là bản danh tính
              // đã memo, không mang toạ độ con trỏ hiện thời.
              onClick={() => { const live = peers.get(peer.socketId); if (live) onJumpToPeer(live); }}
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
