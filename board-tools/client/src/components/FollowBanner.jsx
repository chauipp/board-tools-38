import { Trans } from "@lingui/react/macro";
import { cursorColor, usePeers } from "../lib/usePresence.js";

// Vì sao server từ chối, nói bằng tiếng người. "cycle" là ca duy nhất người dùng
// gặp trong lúc dùng bình thường (hai người ghim chéo nhau); mấy ca còn lại là
// đua trạng thái hoặc dữ liệu hỏng, gộp chung một câu.
function reasonText(reason) {
  if (reason === "cycle") return <Trans>Người đó đang xem màn hình bạn — hai bên không ghim chéo nhau được.</Trans>;
  if (reason === "gone") return <Trans>Người đó vừa rời khỏi bảng.</Trans>;
  if (reason === "timeout") return <Trans>Server không phản hồi — chưa ghim được màn hình.</Trans>;
  return <Trans>Không ghim được màn hình.</Trans>;
}

/**
 * Viền màu quanh màn hình + một dòng chữ, khi đang ghim màn hình người khác.
 *
 * Không phải trang trí: khi đang bám, camera không còn nghe lời người dùng nữa.
 * Không có dấu hiệu nào trên màn hình thì lần cuộn chuột đầu tiên (mà thực ra là
 * lệnh "bỏ ghim") trông hệt như app bị treo.
 *
 * Ba trạng thái, cố ý vẽ KHÁC nhau: đang chờ server ừ (viền đứt), đang bám
 * (viền đặc), và không ghim được (chỉ một dòng báo lỗi, không viền). Bản đầu chỉ
 * có một trạng thái và bật ngay lúc bấm — thành ra khi server chạy code cũ,
 * viền vẫn lên đầy đủ trong khi chẳng có gói nào được relay.
 *
 * Tự đăng ký usePeers thay vì nhận tên từ IdeaMap, cùng lý do với PeerLayer:
 * danh sách peer là state đổi theo nhịp con trỏ, kéo nó lên IdeaMap là mỗi nhịp
 * lại render lại toàn bộ thẻ, dây và khung. Ở đây nó chỉ chạm tới hai thẻ div.
 */
export default function FollowBanner({ socket, followingId, pendingId, followError, onStop }) {
  const peers = usePeers(socket);

  if (followError) {
    return (
      <div className="follow-frame error">
        <div className="follow-chip">{reasonText(followError)}</div>
      </div>
    );
  }

  const id = followingId || pendingId;
  const peer = id ? peers.get(id) : null;
  // Người bị ghim vừa rời phòng: server đã thả mình ra và followingId sắp về
  // null, nhưng trong một nhịp render nó vẫn trỏ tới một socket không còn nữa.
  if (!peer) return null;

  const waiting = !followingId;
  return (
    <div className={"follow-frame" + (waiting ? " pending" : "")} style={{ "--peer-color": cursorColor(peer.email) }}>
      <div className="follow-chip">
        <span>
          {waiting
            ? <Trans>Đang ghim màn hình của {peer.name}…</Trans>
            : <Trans>Đang xem màn hình của {peer.name}</Trans>}
        </span>
        <button type="button" className="btn ghost small" onClick={onStop}>
          <Trans>Bỏ ghim</Trans>
        </button>
      </div>
    </div>
  );
}
