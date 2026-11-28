import PresenceBar from "../PresenceBar.jsx";
import FollowBanner from "../FollowBanner.jsx";

// Đảo người ở góc trên phải (ai đang mở board, nút mời) và băng báo đang ghim
// màn hình người khác. Trước là một khối JSX trong IdeaMap.jsx; cây DOM và class
// giữ nguyên.
export default function PresenceIsland({ board, follow, followError, followingId, jumpToPeer, logout, pendingId, role, setInviteOpen, socket, stopFollow, user, watcherCount }) {
  return (
    <>
      {/* ĐẢO NGƯỜI — góc trên phải. Ai đang mở board + nút mời. */}
      <div className="island tr">
        <div className="island-row">
          <PresenceBar
            user={user}
            socket={socket}
            canInvite={role === "owner"}
            onInvite={() => setInviteOpen(true)}
            onJumpToPeer={jumpToPeer}
            onLogout={logout}
            followingId={followingId}
            watcherCount={watcherCount}
            onFollowPeer={follow}
            onStopFollow={stopFollow}
          />
        </div>
      </div>

      <FollowBanner
        socket={socket}
        followingId={followingId}
        pendingId={pendingId}
        followError={followError}
        onStop={stopFollow}
      />
    </>
  );
}
