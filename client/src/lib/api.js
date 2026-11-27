function apiError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function checkAuthExpired(res) {
  if (res.status === 401) window.dispatchEvent(new Event("auth:expired"));
}

async function parseErrorCode(res, fallback) {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

// Mã lỗi lấy từ thân lỗi của server (`{ error }`), rơi về `fallback` khi thân
// rỗng hoặc không phải JSON.
function serverCode(fallback) {
  return async (res) => apiError(await parseErrorCode(res, fallback));
}

// Một cửa cho mọi lời gọi HTTP của client.
//
// `errors` ánh xạ mã HTTP → cách xử lý; khoá `default` dùng cho mọi phản hồi
// !ok còn lại. Mỗi giá trị là:
// - chuỗi: ném apiError(chuỗi đó);
// - hàm (res) => …: trả về Error thì ném Error đó, trả về thứ khác thì lời gọi
//   kết thúc với giá trị ấy thay cho res.json() (ví dụ getMe coi 401 là "chưa
//   đăng nhập" chứ không phải lỗi).
// Mã HTTP được tra theo đúng `errors[res.status]` trước, rồi mới tới `default`,
// nên phản hồi ok cũng có thể bị chặn (không ai dùng, nhưng không cấm).
//
// `authExpired: false` cho các lời gọi mà 401 là câu trả lời BÌNH THƯỜNG (đăng
// nhập sai mật khẩu, hỏi "tôi là ai" khi chưa đăng nhập) — phát sự kiện
// auth:expired ở đó sẽ đá người dùng ra khỏi chính màn hình đăng nhập.
export async function request(path, { method, body, errors = {}, authExpired = true, credentials } = {}) {
  const init = {};
  if (method) init.method = method;
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  if (credentials) init.credentials = credentials;
  const res = Object.keys(init).length ? await fetch(path, init) : await fetch(path);
  if (authExpired) checkAuthExpired(res);
  const handler = res.status in errors ? errors[res.status] : res.ok ? undefined : errors.default;
  if (handler !== undefined) {
    if (typeof handler === "string") throw apiError(handler);
    const out = await handler(res);
    if (out instanceof Error) throw out;
    return out;
  }
  if (!res.ok) throw apiError("REQUEST_FAILED");
  return res.json();
}

export async function listBoards() {
  return request("/api/boards", { errors: { default: "BOARDS_LOAD_FAILED" } });
}

export async function createBoard(name, kind = "idea", template = "") {
  return request("/api/boards", {
    method: "POST",
    body: { name, kind, template },
    // Lấy mã lỗi thật của server thay vì gộp hết vào một mã: hai trường hợp
    // board_limit_reached và too_many_boards cần câu chữ khác nhau, và khác hẳn
    // với "server chết".
    errors: { default: serverCode("BOARD_CREATE_FAILED") }
  });
}

export async function getBoard(boardId) {
  return request(`/api/boards/${boardId}`, {
    errors: { 404: "BOARD_NOT_FOUND", default: "BOARD_LOAD_FAILED" }
  });
}

// `baseUpdatedAt` = mốc của bản mà `state` được dựng lên từ đó. Server so nó với
// mốc hiện có và trả 409 nếu đã có người lưu chen vào giữa — không có nó thì cú
// PUT này lặng lẽ xoá sổ thay đổi của người kia. Bỏ trống là tắt chốt (luồng
// "Nhập JSON" cố ý thay cả bảng).
export async function saveBoard(boardId, state, clientId, baseUpdatedAt) {
  // Camera (pan/zoom) không còn là dữ liệu đồng bộ — xem lib/camera.js.
  const { view, ...rest } = state;
  return request(`/api/boards/${boardId}`, {
    method: "PUT",
    body: { ...rest, clientId, baseUpdatedAt: baseUpdatedAt ?? undefined },
    errors: {
      403: "READ_ONLY",
      409: async (res) => {
        // Bản mới nhất của server đi kèm luôn trong thân lỗi, để chỗ gọi ghép thay
        // đổi của mình lên đó mà không phải tải lại board lần nữa.
        const err = apiError("CONFLICT");
        try { err.board = (await res.json()).board; } catch { err.board = null; }
        return err;
      },
      default: "BOARD_SAVE_FAILED"
    }
  });
}

export async function listBoardSnapshots(boardId) {
  return request(`/api/boards/${boardId}/snapshots`, { errors: { default: "SNAPSHOTS_LOAD_FAILED" } });
}

export async function createBoardSnapshot(boardId, label = "") {
  return request(`/api/boards/${boardId}/snapshots`, {
    method: "POST",
    body: { label },
    errors: { 403: "READ_ONLY", default: "SNAPSHOT_CREATE_FAILED" }
  });
}

export async function restoreBoardSnapshot(boardId, snapshotId) {
  return request(`/api/boards/${boardId}/snapshots/${snapshotId}/restore`, {
    method: "POST",
    errors: { 403: "READ_ONLY", 404: "SNAPSHOT_NOT_FOUND", default: "SNAPSHOT_RESTORE_FAILED" }
  });
}

export async function deleteBoard(boardId) {
  return request(`/api/boards/${boardId}`, { method: "DELETE", errors: { default: "BOARD_DELETE_FAILED" } });
}

export async function getMembers(boardId) {
  return request(`/api/boards/${boardId}/members`, { errors: { default: "MEMBERS_LOAD_FAILED" } });
}

export async function inviteMember(boardId, email, role) {
  return request(`/api/boards/${boardId}/members`, {
    method: "POST",
    body: { email, role },
    errors: { default: serverCode("MEMBER_INVITE_FAILED") }
  });
}

export async function updateMemberRole(boardId, email, role) {
  return request(`/api/boards/${boardId}/members/${encodeURIComponent(email)}`, {
    method: "PATCH",
    body: { role },
    errors: { default: serverCode("MEMBER_UPDATE_FAILED") }
  });
}

export async function removeMember(boardId, email) {
  return request(`/api/boards/${boardId}/members/${encodeURIComponent(email)}`, {
    method: "DELETE",
    errors: { default: serverCode("MEMBER_REMOVE_FAILED") }
  });
}

export async function getCalculator() {
  return request("/api/calculator", { errors: { default: "CALC_LOAD_FAILED" } });
}

// `savedAt` là mốc lúc người dùng sửa, không phải lúc gửi đi: server dùng nó để
// bỏ những cú ghi đã lỗi thời, nên nó phải nói về thời điểm SINH RA thay đổi.
export async function saveCalculator(state, savedAt = Date.now()) {
  return request("/api/calculator", {
    method: "PUT",
    body: {
      budget: state.budget,
      nextStatId: state.nextStatId,
      stats: state.stats,
      savedAt
    },
    errors: { default: "CALC_SAVE_FAILED" }
  });
}

// Dung lượng kho PDF (xem components/PdfUsage.jsx). Lỗi HTTP trả null chứ không
// ném: đây là thông tin phụ, chỗ gọi chỉ việc không hiện gì. Không phát
// auth:expired — giữ nguyên hành vi của lời gọi fetch cũ trong PdfUsage.
export async function getPdfUsage() {
  return request("/api/pdf-usage", {
    credentials: "include",
    authExpired: false,
    errors: { default: () => null }
  });
}

// ─── Đăng nhập (lib/auth.js re-export các hàm này) ─────────────────────────
// Không lời gọi nào ở đây phát auth:expired: 401 ở đây là câu trả lời bình
// thường (chưa đăng nhập / sai mật khẩu), không phải phiên vừa hết hạn.

export async function getMe() {
  const data = await request("/api/auth/me", {
    authExpired: false,
    errors: { 401: () => ({ user: null }), default: "AUTH_ME_FAILED" }
  });
  return data.user;
}

export async function loginWithGoogle(idToken) {
  const data = await request("/api/auth/google", {
    method: "POST",
    body: { idToken },
    authExpired: false,
    errors: { 403: "NOT_ALLOWED", default: "LOGIN_FAILED" }
  });
  return data.user;
}

export async function loginWithPassword(username, password) {
  const data = await request("/api/auth/password", {
    method: "POST",
    body: { username, password },
    authExpired: false,
    errors: {
      400: "INVALID_CREDENTIALS",
      401: "INVALID_CREDENTIALS",
      429: "TOO_MANY_ATTEMPTS",
      default: "LOGIN_FAILED"
    }
  });
  return data.user;
}

// Cố ý không qua request(): đăng xuất không đọc thân phản hồi và không coi mã
// lỗi nào là lỗi — chỉ lỗi mạng mới ném, đúng như trước.
export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}
