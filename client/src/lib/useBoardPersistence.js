import { useCallback, useRef } from "react";
import { restoreBoardSnapshot, saveBoard } from "./api.js";
import { normalizeGameDesignBoard } from "./game-design.js";
import { arrangeLockedTrees } from "./locked-tree.js";
import { rebaseBoard } from "./rebase.js";
import { isStaleUpdate, mergeRemoteBoard } from "./useLiveSync.js";

export function useBoardPersistence({ boardId, boardRef, roleRef, socketRef, treeSizeRef, setBoard, setSaveError, reconcileInk, acceptRemoteHistory }) {
  const saveTimerRef = useRef(null);
  const lastUpdatedAtRef = useRef(null);
  const serverBaseRef = useRef(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const deferredRemoteRef = useRef(null);
  const saveBlockedRef = useRef(false);

  function adoptServerVersion(version, board) {
    lastUpdatedAtRef.current = version;
    serverBaseRef.current = board;
  }

  // Overlay nào đã được board thật bắt kịp phải bỏ NGAY. Giữ lại nghĩa là tiếp
  // tục vẽ một bản tạm đè lên dữ liệu thật vừa nhận — nét nhấp nháy.
  const applyRemoteBoard = useCallback((next, incoming) => {
    if (savingRef.current || saveTimerRef.current || saveBlockedRef.current) {
      if (!isStaleUpdate(deferredRemoteRef.current?.updatedAt, incoming.updatedAt)) {
        deferredRemoteRef.current = incoming;
      }
      return false;
    }
    const normalized = normalizeGameDesignBoard(next);
    boardRef.current = normalized;
    lastUpdatedAtRef.current = incoming.updatedAt;
    setBoard(normalized);
    // Vừa áp bản của người khác → đó là bản mới nhất ta biết server đang giữ.
    // Thiếu dòng này thì lần va chạm sau sẽ tính delta từ một mốc quá cũ và đắp
    // lại cả những thay đổi đã được lưu từ lâu.
    const server = normalizeGameDesignBoard(incoming);
    acceptRemoteHistory(serverBaseRef.current, server);
    serverBaseRef.current = server;
    reconcileInk(normalized);
    return true;
  }, [boardRef, setBoard, reconcileInk, acceptRemoteHistory]);

  // Chạm trần thì giữ bản nháp để người dùng xử lý.
  const MAX_REBASE_TRIES = 3;

  // Cú lưu hiện tại (kể cả các vòng ghép lại của riêng nó) vừa xong — cho nó
  // chạy tiếp cú đang xếp hàng, nếu có, với `base` giờ đã mới nhất.
  function settleSave() {
    savingRef.current = false;
    // A debounce scheduled after an immediate queued save owns the newer draft.
    if (saveTimerRef.current) return;
    if (pendingSaveRef.current != null) {
      const queued = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveNow(queued);
      return;
    }
    const incoming = deferredRemoteRef.current;
    deferredRemoteRef.current = null;
    if (incoming && !isStaleUpdate(lastUpdatedAtRef.current, incoming.updatedAt)) {
      applyRemoteBoard(mergeRemoteBoard(boardRef.current, incoming), incoming);
    }
  }

  function pauseBoardSave(error) {
    savingRef.current = false;
    saveBlockedRef.current = true;
    setSaveError(error);
  }

  function retryBoardSave() {
    pendingSaveRef.current = null;
    saveBlockedRef.current = false;
    saveNow(boardRef.current);
  }

  function saveNow(next, tries = 0) {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (roleRef.current === "viewer") return;
    if (saveBlockedRef.current) return;
    const arranged = arrangeLockedTrees(next, treeSizeRef.current);
    if (arranged !== next) {
      next = arranged;
      setBoard(next);
      boardRef.current = next;
    }
    // Đang có một cú PUT bay (kể cả đang ghép lại): không bắn cú mới đè lên nó.
    // `base` chốt bên dưới sẽ là bản NGAY LÚC NÀY, mà cú đang bay có thể sắp
    // thêm một thẻ mà `base` chưa biết — bắn chồng lên là hạt giống của đúng
    // bug "dán ảnh rồi kéo rộng ra thì hiện thêm 1 ảnh cỡ gốc ở vị trí cũ" (xem
    // ghi chú ở savingRef). Chỉ giữ lại BẢN MỚI NHẤT cần lưu; những state ở giữa
    // không cần lưu riêng.
    if (tries === 0) {
      if (savingRef.current) { pendingSaveRef.current = next; return; }
      savingRef.current = true;
    }
    // Mốc và bản nền được CHỐT ngay đây, trước khi cú PUT rời máy: nếu đọc lại ở
    // trong .catch thì lúc đó chúng có thể đã bị một gói board:update chen vào
    // sửa mất, và delta sẽ tính từ nhầm mốc.
    const base = serverBaseRef.current;
    const baseUpdatedAt = lastUpdatedAtRef.current;
    saveBoard(boardId, next, socketRef.current?.id, baseUpdatedAt)
      .then((res) => {
        lastUpdatedAtRef.current = res.updatedAt;
        serverBaseRef.current = { ...next, updatedAt: res.updatedAt };
        setBoard((current) => current && { ...current, updatedAt: res.updatedAt });
        setSaveError(null);
        settleSave();
      })
      .catch((e) => {
        if (e.code !== "CONFLICT") { pauseBoardSave("save"); return; }
        // Có người lưu chen vào giữa. Bản của họ đi kèm ngay trong lỗi; đắp
        // những gì mình đã đổi (base → next) lên đó rồi lưu lại.
        const server = e.board ? normalizeGameDesignBoard(e.board) : null;
        const latestDraft = saveTimerRef.current ? boardRef.current : pendingSaveRef.current || next;
        const rebased = server ? rebaseBoard(server, base, latestDraft) : null;
        if (!rebased || tries >= MAX_REBASE_TRIES) {
          pauseBoardSave("conflict");
          return;
        }
        pendingSaveRef.current = null;
        // Giữ camera cục bộ, dùng dữ liệu đã ghép cho nội dung board.
        const local = boardRef.current;
        const merged = normalizeGameDesignBoard(local ? mergeRemoteBoard(local, rebased) : rebased);
        lastUpdatedAtRef.current = server.updatedAt;
        acceptRemoteHistory(base, server);
        serverBaseRef.current = server;
        setBoard(merged);
        boardRef.current = merged;
        reconcileInk(merged);
        saveNow(merged, tries + 1);
      });
  }

  function saveDebounced(next) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = null;
    saveTimerRef.current = setTimeout(() => saveNow(next), 500);
  }

  function hasPendingSave() {
    return savingRef.current || saveTimerRef.current !== null || saveBlockedRef.current;
  }

  async function restoreSnapshot(snapshotId, pendingMessage, onRestored) {
    if (hasPendingSave()) {
      throw new Error(pendingMessage);
    }
    savingRef.current = true;
    try {
      const result = await restoreBoardSnapshot(boardId, snapshotId, lastUpdatedAtRef.current);
      const restored = normalizeGameDesignBoard({ ...result.board, view: boardRef.current?.view });
      if (pendingSaveRef.current || saveTimerRef.current) {
        pauseBoardSave("conflict");
        return;
      }
      setBoard(restored);
      boardRef.current = restored;
      serverBaseRef.current = restored;
      lastUpdatedAtRef.current = restored.updatedAt;
      onRestored();
      reconcileInk(restored);
      setSaveError(null);
    } catch (error) {
      if (error.code === "CONFLICT" && !isStaleUpdate(deferredRemoteRef.current?.updatedAt, error.board?.updatedAt)) {
        deferredRemoteRef.current = error.board;
      }
      throw error;
    } finally {
      if (!saveBlockedRef.current) settleSave();
    }
  }

  return {
    adoptServerVersion, applyRemoteBoard, lastUpdatedAtRef, saveNow, saveDebounced,
    retryBoardSave, restoreSnapshot, hasPendingSave, saveBlocked: saveBlockedRef.current
  };
}
