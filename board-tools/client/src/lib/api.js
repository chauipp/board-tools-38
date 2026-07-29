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

export async function listBoards() {
  const res = await fetch("/api/boards");
  checkAuthExpired(res);
  if (!res.ok) throw apiError("BOARDS_LOAD_FAILED");
  return res.json();
}

export async function createBoard(name) {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("BOARD_CREATE_FAILED");
  return res.json();
}

export async function getBoard(boardId) {
  const res = await fetch(`/api/boards/${boardId}`);
  checkAuthExpired(res);
  if (res.status === 404) throw apiError("BOARD_NOT_FOUND");
  if (!res.ok) throw apiError("BOARD_LOAD_FAILED");
  return res.json();
}

// `baseUpdatedAt` = mốc của bản mà `state` được dựng lên từ đó. Server so nó với
// mốc hiện có và trả 409 nếu đã có người lưu chen vào giữa — không có nó thì cú
// PUT này lặng lẽ xoá sổ thay đổi của người kia. Bỏ trống là tắt chốt (luồng
// "Nhập JSON" cố ý thay cả bảng).
export async function saveBoard(boardId, state, clientId, baseUpdatedAt) {
  // Camera (pan/zoom) không còn là dữ liệu đồng bộ — xem lib/camera.js.
  const { view, ...rest } = state;
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...rest, clientId, baseUpdatedAt: baseUpdatedAt ?? undefined })
  });
  checkAuthExpired(res);
  if (res.status === 403) throw apiError("READ_ONLY");
  if (res.status === 409) {
    // Bản mới nhất của server đi kèm luôn trong thân lỗi, để chỗ gọi ghép thay
    // đổi của mình lên đó mà không phải tải lại board lần nữa.
    const err = apiError("CONFLICT");
    try { err.board = (await res.json()).board; } catch { err.board = null; }
    throw err;
  }
  if (!res.ok) throw apiError("BOARD_SAVE_FAILED");
  return res.json();
}

export async function deleteBoard(boardId) {
  const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("BOARD_DELETE_FAILED");
  return res.json();
}

export async function getMembers(boardId) {
  const res = await fetch(`/api/boards/${boardId}/members`);
  checkAuthExpired(res);
  if (!res.ok) throw apiError("MEMBERS_LOAD_FAILED");
  return res.json();
}

export async function inviteMember(boardId, email, role) {
  const res = await fetch(`/api/boards/${boardId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role })
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError(await parseErrorCode(res, "MEMBER_INVITE_FAILED"));
  return res.json();
}

export async function updateMemberRole(boardId, email, role) {
  const res = await fetch(`/api/boards/${boardId}/members/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role })
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError(await parseErrorCode(res, "MEMBER_UPDATE_FAILED"));
  return res.json();
}

export async function removeMember(boardId, email) {
  const res = await fetch(`/api/boards/${boardId}/members/${encodeURIComponent(email)}`, {
    method: "DELETE"
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError(await parseErrorCode(res, "MEMBER_REMOVE_FAILED"));
  return res.json();
}

export async function getCalculator() {
  const res = await fetch("/api/calculator");
  checkAuthExpired(res);
  if (!res.ok) throw apiError("CALC_LOAD_FAILED");
  return res.json();
}

export async function saveCalculator(state) {
  const res = await fetch("/api/calculator", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  checkAuthExpired(res);
  if (!res.ok) throw apiError("CALC_SAVE_FAILED");
  return res.json();
}
