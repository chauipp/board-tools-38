import { useMemo, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { cursorColor, usePeers } from "../lib/usePresence.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

// Ảnh Google hay hỏng (hết hạn, chặn referrer) và chỉ biết lúc <img> báo lỗi —
// nên fallback chữ cái đầu phải là state của từng avatar, không suy ra trước
// được từ việc có hay không có `picture`.
function Avatar({ name, email, picture, color, title, className, onClick }) {
  const [imgOk, setImgOk] = useState(true);
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={"presence-avatar" + (onClick ? " clickable" : "") + (className ? " " + className : "")}
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
export default function PresenceBar({
  user, socket, canInvite, onInvite, onJumpToPeer, onLogout,
  followingId, watcherCount, onFollowPeer, onStopFollow
}) {
  const { t } = useLingui();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPeerId, setOpenPeerId] = useState(null);
  const menuRef = useRef(null);
  const peerMenuRef = useRef(null);
  useCloseOnOutside(menuRef, () => setMenuOpen(false));
  useCloseOnOutside(peerMenuRef, () => setOpenPeerId(null));

  const peers = usePeers(socket);
  // Avatar chỉ phụ thuộc danh tính, không phụ thuộc toạ độ con trỏ — dựng lại
  // mảng theo chữ ký socketId để mỗi gói cursor:move không tạo mảng mới.
  // `followingId` của từng người thì có vào chữ ký: nó đổi khi có người bấm
  // ghim, tức là hiếm, nhưng phải vẽ lại thì chấm "đang xem bạn" mới hiện.
  const identities = useMemo(
    () => Array.from(peers.values()).map((p) => ({
      socketId: p.socketId, email: p.email, name: p.name, picture: p.picture,
      followingId: p.followingId ?? null
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Array.from(peers.values()).map((p) => p.socketId + ">" + (p.followingId ?? "")).join(",")]
  );

  const openPeer = openPeerId ? identities.find((p) => p.socketId === openPeerId) : null;

  return (
    <div className="presence-bar">
      {/* Người khác đang nhìn màn hình mình thì phải BIẾT. Không hiện gì thì
          camera của mình lặng lẽ được phát đi mà không ai nói cho mình. */}
      {watcherCount > 0 && (
        <span className="watched-chip" title={t`Camera của bạn đang được chia sẻ cho những người đang ghim`}>
          <Trans>{watcherCount} đang xem màn hình bạn</Trans>
        </span>
      )}

      {identities.length > 0 && (
        <div className="presence-peers">
          {identities.map((peer) => (
            <div className="presence-peer" key={peer.socketId} ref={openPeerId === peer.socketId ? peerMenuRef : null}>
              <Avatar
                name={peer.name}
                email={peer.email}
                picture={peer.picture}
                color={cursorColor(peer.email)}
                className={
                  (followingId === peer.socketId ? "following" : "") +
                  (peer.followingId === socket?.id ? " watching-me" : "")
                }
                title={peer.name}
                onClick={() => setOpenPeerId((cur) => (cur === peer.socketId ? null : peer.socketId))}
              />
              {openPeerId === peer.socketId && (
                <div className="presence-menu peer-menu">
                  <div className="presence-menu-name">{peer.name}</div>
                  {peer.followingId === socket?.id && (
                    <div className="presence-menu-note"><Trans>Đang xem màn hình bạn</Trans></div>
                  )}
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setOpenPeerId(null);
                      // Lấy bản mới nhất từ Map lúc bấm: `peer` ở đây là bản
                      // danh tính đã memo, không mang toạ độ con trỏ hiện thời.
                      const live = peers.get(peer.socketId);
                      if (live) onJumpToPeer(live);
                    }}
                  >
                    <Trans>Nhảy tới con trỏ</Trans>
                  </button>
                  {followingId === peer.socketId ? (
                    <button type="button" className="btn ghost" onClick={() => { setOpenPeerId(null); onStopFollow(); }}>
                      <Trans>Bỏ ghim màn hình</Trans>
                    </button>
                  ) : (
                    <button type="button" className="btn ghost" onClick={() => { setOpenPeerId(null); onFollowPeer(peer.socketId); }}>
                      <Trans>Ghim màn hình</Trans>
                    </button>
                  )}
                </div>
              )}
            </div>
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
