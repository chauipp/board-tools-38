import { canLogin, parseSessionFromCookieHeader, getBoardRole } from "../auth.js";
import { Board } from "../models.js";

// Middleware io.use(): xác thực cookie session, kiểm quyền đăng nhập và quyền
// trên board rồi gắn user/boardId/role vào socket.data. Di chuyển nguyên văn từ
// index.js.
export async function handshake(socket, next) {
  const user = parseSessionFromCookieHeader(socket.handshake.headers.cookie);
  if (!user) return next(new Error("unauthorized"));
  let allowed;
  try {
    allowed = await canLogin(user.email);
  } catch (e) {
    console.error("Socket handshake: không kiểm tra được quyền đăng nhập", e);
    return next(new Error("forbidden"));
  }
  if (!allowed) return next(new Error("unauthorized"));
  const boardId = socket.handshake.query.boardId;
  if (!boardId) return next(new Error("missing_board"));
  let board;
  try {
    board = await Board.findById(boardId).select("ownerEmail members").lean();
  } catch (e) {
    // Mongo chết và "board id không hợp lệ" cùng ra `forbidden` ở phía client;
    // không log thì lỗi hạ tầng trông hệt như từ chối quyền và không debug được.
    console.error("Socket handshake: không đọc được board", boardId, e);
    return next(new Error("forbidden"));
  }
  if (!board) return next(new Error("forbidden"));
  const role = getBoardRole(board, user.email);
  if (!role) return next(new Error("forbidden"));
  socket.data.user = user;
  // Chuẩn hoá từ document, không từ query: hex id viết hoa/thường khác nhau vẫn
  // trỏ về cùng board nhưng sẽ tạo hai phòng presence riêng nếu lấy nguyên chuỗi.
  socket.data.boardId = String(board._id);
  socket.data.role = role;
  next();
}
