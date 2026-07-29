import { Trans } from "@lingui/react/macro";
import { cursorColor, usePeers } from "../lib/usePresence.js";

/**
 * Viền màu quanh màn hình + một dòng chữ, khi đang ghim màn hình người khác.
 *
 * Không phải trang trí: khi đang bám, camera không còn nghe lời người dùng nữa.
 * Không có dấu hiệu nào trên màn hình thì lần cuộn chuột đầu tiên (mà thực ra là
 * lệnh "bỏ ghim") trông hệt như app bị treo.
 *
 * Tự đăng ký usePeers thay vì nhận tên từ IdeaMap, cùng lý do với PeerLayer:
 * danh sách peer là state đổi theo nhịp con trỏ, kéo nó lên IdeaMap là mỗi nhịp
 * lại render lại toàn bộ thẻ, dây và khung. Ở đây nó chỉ chạm tới hai thẻ div.
 */
export default function FollowBanner({ socket, followingId, onStop }) {
  const peers = usePeers(socket);
  const peer = followingId ? peers.get(followingId) : null;
  // Người bị ghim vừa rời phòng: server đã thả mình ra và followingId sắp về
  // null, nhưng trong một nhịp render nó vẫn trỏ tới một socket không còn nữa.
  if (!peer) return null;

  return (
    <div className="follow-frame" style={{ "--peer-color": cursorColor(peer.email) }}>
      <div className="follow-chip">
        <span><Trans>Đang xem màn hình của {peer.name}</Trans></span>
        <button type="button" className="btn ghost small" onClick={onStop}>
          <Trans>Bỏ ghim</Trans>
        </button>
      </div>
    </div>
  );
}
