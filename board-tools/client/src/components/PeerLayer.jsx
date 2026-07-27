import { memo } from "react";
import { cursorColor, usePeers } from "../lib/usePresence.js";
import { edgeEndpoint } from "../lib/board-geometry.js";

// Mọi thứ thuộc về NGƯỜI KHÁC (con trỏ, vùng họ đang chọn, đầu dây họ đang kéo)
// nằm gọn trong component này và tự đăng ký socket của mình. Trước đây danh sách
// peer là state của IdeaMap, nên mỗi nhịp con trỏ của mỗi người — khoảng 20
// lần/giây/người — kéo theo một lượt render TOÀN BỘ thẻ, dây, khung. Bốn người
// cùng mở board là 80 lượt render thừa mỗi giây, và đó là loại giật không liên
// quan gì tới việc mình đang làm gì.
//
// Lớp này vẫn phải đọc vị trí thẻ (viền chọn và đầu dây phải bám theo thẻ khi
// thẻ chạy), nên nhận nodeById/groupById dạng Map — tra cứu O(1), và chúng chỉ
// đổi khi board đổi, không đổi theo nhịp con trỏ.
function PeerLayer({ socket, nodeById, groupById, cardSize }) {
  const peers = usePeers(socket);
  if (peers.size === 0) return null;
  const list = Array.from(peers.values());

  return (
    <>
      <svg className="edge-layer peer-draft-layer">
        {list.map((peer) => {
          if (!peer.edgeDraft) return null;
          const from = edgeEndpoint(peer.edgeDraft.fromKind || "node", peer.edgeDraft.fromId, nodeById, groupById, cardSize);
          if (!from) return null;
          return (
            <line
              key={"peer-draft-" + peer.socketId}
              className="draft"
              x1={from.x} y1={from.y} x2={peer.edgeDraft.x} y2={peer.edgeDraft.y}
              style={{ stroke: cursorColor(peer.email) }}
            />
          );
        })}
      </svg>

      {list.map((peer) => (
        <div
          key={peer.socketId}
          className="peer-cursor"
          style={{ left: peer.x, top: peer.y, "--peer-color": cursorColor(peer.email) }}
        >
          <svg viewBox="0 0 20 20" width="16" height="16">
            <path d="M2 2 L18 9 L10 11 L8 18 Z" fill="var(--peer-color)" stroke="var(--bg)" strokeWidth="1" />
          </svg>
          <span className="peer-cursor-label" style={{ background: "var(--peer-color)" }}>{peer.name}</span>
        </div>
      ))}

      {list.flatMap((peer, pi) =>
        (peer.selectedIds || []).map((id) => {
          const n = nodeById.get(id);
          if (!n) return null;
          // Mỗi người lùi ra xa thêm một nấc để hai người cùng chọn một thẻ
          // không vẽ đè khít nhau (chỉ còn thấy 1 màu).
          const { w, h } = cardSize(id);
          const pad = 4 + pi * 3;
          return (
            <div
              key={peer.socketId + ":sel:" + id}
              className="peer-select-outline"
              style={{
                left: n.x - pad,
                top: n.y - pad,
                width: w + pad * 2,
                height: h + pad * 2,
                borderColor: cursorColor(peer.email)
              }}
              title={peer.name}
            />
          );
        })
      )}
    </>
  );
}

export default memo(PeerLayer);
