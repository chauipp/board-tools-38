// Phát board:update cho cả phòng sau khi lưu REST thành công. io lấy qua
// req.app (index.js gắn bằng app.set("io", io)), không import vòng.
export async function broadcastBoardUpdate(req, boardId, payload, clientId) {
  const io = req.app.get("io");
  const room = "board:" + String(boardId);
  if (clientId) io.in(room).except(clientId).emit("board:update", payload);
  else io.in(room).emit("board:update", payload);
}
