import { useCallback, useEffect, useRef, useState } from "react";
import { createBoardSnapshot, getBoard, restoreBoardSnapshot, saveBoard } from "./api.js";
import { normalizeGameDesignBoard } from "./normalize-board.js";
import { arrangeLockedTrees } from "./locked-tree.js";
import { mergeRemoteBoard } from "./useLiveSync.js";
import { rebaseBoard } from "./rebase.js";
import { createSaveQueue } from "./save-queue.js";
import { emptyHistory, record as recordStep, undo as undoStep, redo as redoStep, beginNudge as beginNudgeStep, flushNudge } from "./history.js";

// Một cửa ghi board cho IdeaMap: tải board, giữ `board` + `boardRef` khớp nhau,
// hàng đợi lưu (save-queue.js), lịch sử hoàn tác (history.js), áp board:update
// của người khác và khôi phục snapshot.
//
// API ghi:
// - preview(next)                     đặt board + boardRef cùng lúc; không lưu,
//                                     không ghi lịch sử (dùng trong lúc kéo).
// - commit(next, { historical, from }) ghi lịch sử (bản trước = `from`, mặc định
//                                     là `board` của lượt render này), xếp lại
//                                     cây khoá, đặt board + boardRef, lưu.
// - undo(), redo().
//
// Những thứ của IdeaMap mà store cần nhưng được khai báo SAU board (inkLive,
// treeSizeRef, socketRef, editingIdRef…) được gắn qua `bind()` ở mỗi lượt
// render. Chúng chỉ được đọc trong handler/effect/callback, tức là sau khi
// render xong, nên lúc đó luôn đã có.
export function useBoardStore(boardId) {
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [role, setRole] = useState(null);
  const [boardName, setBoardName] = useState("");

  const depsRef = useRef({});
  const deps = () => depsRef.current;

  const boardRef = useRef(null);
  // Gán ngay trong lúc render, không qua useEffect: các handler kéo đọc
  // boardRef.current để biết trạng thái MỚI NHẤT, mà effect thì chạy sau khi
  // render xong — có một khoảng ref còn giữ board của lượt trước, đủ để một
  // phép tính kéo hoặc một gói realtime lấy nhầm toạ độ cũ.
  boardRef.current = board;
  // Listener "paste" gắn-một-lần (deps: []) đóng gói `role` lúc mount, khi đó
  // board chưa tải xong nên role vẫn là null — phải đọc qua ref mới đúng.
  const roleRef = useRef(null);
  useEffect(() => { roleRef.current = role; }, [role]);
  // updatedAt của lần lưu/nhận gần nhất để so sánh gói đến sau có mới hơn
  // không (useLiveSync.js: isStaleUpdate).
  const lastUpdatedAtRef = useRef(null);
  // Bản board mà ta TIN là server đang giữ. Không phải `board`: board còn chứa
  // những thay đổi mình vừa làm và chưa chắc đã lưu xong. Khi server từ chối một
  // lần lưu vì có người chen vào, đây là mốc để tính "từ lần đồng bộ cuối tới
  // giờ mình đã đổi những gì" rồi đắp đúng chừng ấy lên bản của họ
  // (lib/rebase.js). Cập nhật ở ba chỗ: lúc tải xong, lúc lưu thành công, và
  // lúc áp một board:update của người khác.
  const serverBaseRef = useRef(null);

  // ── Tải board ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    // Không reset state ở đây: IdeaMapRoute (main.jsx) truyền key={boardId} nên
    // đổi board là remount hẳn — board/role/past/future/selectedIds đều mới.
    // Reset thủ công chỉ xoá được vài ô state và bỏ sót lịch sử undo.
    getBoard(boardId)
      .then((data) => {
        if (cancelled) return;
        deps().onLoaded?.(data);
        const { id, name, role: r, updatedAt, ...boardData } = data;
        setRole(r);
        setBoardName(name);
        lastUpdatedAtRef.current = updatedAt;
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        const loaded = normalizeGameDesignBoard({ kind: "idea", palette: [], nextPaletteId: 1, drawings: [], nextDrawingId: 1, bg: null, grid: null, pack: null, ...boardData, view: { panX: 0, panY: 0, scale: 1 } });
        setBoard(loaded);
        serverBaseRef.current = loaded;
      })
      .catch((e) => { if (!cancelled) setLoadError(e.code || "UNKNOWN"); });
    return () => { cancelled = true; };
  }, [boardId]);

  // ── Hàng đợi lưu (lib/save-queue.js) ───────────────────────────────────────
  // Một cú PUT bay tại một thời điểm, 409 thì ghép lại. Tạo MỘT lần; các
  // callback đọc saveHooksRef — gán lại mỗi lượt render ngay dưới — nên luôn
  // thấy closure mới nhất.
  const saveHooksRef = useRef(null);
  const saveQueueRef = useRef(null);
  if (!saveQueueRef.current) {
    const hook = (name) => (...args) => saveHooksRef.current[name](...args);
    saveQueueRef.current = createSaveQueue({
      canSave: hook("canSave"),
      prepare: hook("prepare"),
      save: hook("save"),
      rebase: rebaseBoard,
      merge: hook("merge"),
      adopt: hook("adopt"),
      getBase: () => serverBaseRef.current,
      setBase: (b) => { serverBaseRef.current = b; },
      getStamp: () => lastUpdatedAtRef.current,
      setStamp: (t) => { lastUpdatedAtRef.current = t; },
      onState: ({ error }) => setSaveError(error)
    });
  }
  // Đọc roleRef chứ không đọc `role`: saveNow là chốt chặn cuối, nó phải đúng kể
  // cả khi được gọi từ một closure cũ. Handler nào gắn với deps [] (listener
  // paste, .then() của readImageFile…) đóng gói `role` lúc mount — khi đó board
  // chưa tải xong nên role vẫn null và chốt chặn sẽ hở. Ref thì luôn mới.
  saveHooksRef.current = {
    canSave: () => roleRef.current !== "viewer",
    prepare: (next) => {
      const arranged = arrangeLockedTrees(next, deps().treeSizeRef.current);
      if (arranged !== next) {
        next = arranged;
        setBoard(next);
        boardRef.current = next;
      }
      return next;
    },
    save: (next, baseUpdatedAt) => saveBoard(boardId, next, deps().socketRef.current?.id, baseUpdatedAt),
    // Giữ nguyên camera của mình và giữ nguyên đúng cái thẻ đang gõ dở —
    // cùng luật với lúc áp một board:update, nên không có hai cách trộn
    // khác nhau để lệch nhau.
    merge: (rebased) => {
      const local = boardRef.current;
      return normalizeGameDesignBoard(local ? mergeRemoteBoard(local, rebased, deps().editingIdRef.current) : rebased);
    },
    adopt: (merged) => {
      setBoard(merged);
      boardRef.current = merged;
      deps().inkLive.reconcile(merged);
    }
  };

  function saveNow(next) {
    saveQueueRef.current.saveNow(next);
  }

  function saveDebounced(next) {
    saveQueueRef.current.saveDebounced(next, 500);
  }

  // ── Lịch sử hoàn tác (lib/history.js) ──────────────────────────────────────
  // Giữ trong ref để mọi handler — kể cả closure cũ — đọc được bản mới nhất ngay
  // lập tức; setHistoryVersion chỉ để render lại nút Hoàn tác/Làm lại.
  // `past`/`future` là mảng mới mỗi lần đổi, nên dùng làm deps của effect vẫn
  // đúng như khi chúng còn là state.
  const historyRef = useRef(null);
  if (!historyRef.current) historyRef.current = emptyHistory();
  const [, setHistoryVersion] = useState(0);
  const { past, future } = historyRef.current;
  // Đồng hồ chốt loạt nhích phím mũi tên. IdeaMap (nudgeSelection) đặt nó; ở
  // đây chỉ huỷ khi loạt bị chốt sớm.
  const nudgeTimerRef = useRef(null);

  function setHistory(next) {
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistoryVersion((v) => v + 1);
  }

  function clearNudgeTimer() {
    if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
  }

  function flushNudgeBurst() {
    if (historyRef.current.nudgeBase == null) return;
    clearNudgeTimer();
    setHistory(flushNudge(historyRef.current));
  }

  function recordHistory(prevBoard) {
    if (historyRef.current.nudgeBase != null) clearNudgeTimer();
    setHistory(recordStep(historyRef.current, prevBoard));
  }

  function beginNudge(current) {
    if (historyRef.current.nudgeBase != null) return false;
    setHistory(beginNudgeStep(historyRef.current, current));
    return true;
  }

  // ── Cửa ghi ────────────────────────────────────────────────────────────────
  function preview(next) {
    setBoard(next);
    boardRef.current = next;
  }

  function commit(next, opts) {
    if (!opts || opts.historical !== false) recordHistory(opts && "from" in opts ? opts.from : board);
    next = arrangeLockedTrees(next, deps().treeSizeRef.current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
  }

  // Hoàn tác / làm lại chỉ trả lại NỘI DUNG bảng, KHÔNG trả lại chỗ đang xem.
  //
  // `view` (pan + zoom) nằm chung trong board vì nó cũng được lưu lên server,
  // nhưng nó không phải thứ vừa được sửa — nó là chỗ mình đang đứng nhìn. Trả
  // lại nó cùng với nội dung thì lùi một bước là màn hình nhảy về chỗ đứng lúc
  // làm việc đó, và người dùng mất phương hướng đúng vào lúc cần nhìn rõ nhất
  // cái vừa bị lùi. Lùi vài bước liên tiếp thì mỗi bước nhảy một chỗ.
  //
  // Áp cho cả `undo` lẫn `redo`, và cả nhánh gộp phím mũi tên — ba đường vào
  // cùng một chỗ ra, không để đường nào sót lại hành vi cũ.
  function keepView(snapshot) {
    return board?.view ? { ...snapshot, view: board.view } : snapshot;
  }

  function undo() {
    const hadNudge = historyRef.current.nudgeBase != null;
    const step = undoStep(historyRef.current, board);
    if (!step) return;
    if (hadNudge) clearNudgeTimer();
    setHistory(step.history);
    const prev = keepView(step.board);
    deps().onHistoryJump?.();
    setBoard(prev);
    saveNow(prev);
  }

  function redo() {
    if (historyRef.current.nudgeBase != null) { flushNudgeBurst(); return; }
    const step = redoStep(historyRef.current, board);
    if (!step) return;
    setHistory(step.history);
    const nextState = keepView(step.board);
    deps().onHistoryJump?.();
    setBoard(nextState);
    saveNow(nextState);
  }

  // ── Bản của người khác, snapshot ──────────────────────────────────────────
  // Overlay nào đã được board thật bắt kịp phải bỏ NGAY. Giữ lại nghĩa là tiếp
  // tục vẽ một bản tạm đè lên dữ liệu thật vừa nhận — nét nhấp nháy.
  const applyRemoteBoard = useCallback((next) => {
    const normalized = normalizeGameDesignBoard(next);
    setBoard(normalized);
    // Vừa áp bản của người khác → đó là bản mới nhất ta biết server đang giữ.
    // Thiếu dòng này thì lần va chạm sau sẽ tính delta từ một mốc quá cũ và đắp
    // lại cả những thay đổi đã được lưu từ lâu.
    serverBaseRef.current = normalized;
    deps().inkLive.reconcile(normalized);
  }, []);

  async function createSnapshot(label) {
    try {
      const result = await createBoardSnapshot(boardId, label);
      setSaveError(null);
      return result.snapshot;
    } catch (error) {
      setSaveError(true);
      throw error;
    }
  }

  async function restoreSnapshot(snapshotId) {
    try {
      const result = await restoreBoardSnapshot(boardId, snapshotId);
      const restored = normalizeGameDesignBoard({ ...result.board, view: boardRef.current?.view });
      setBoard(restored);
      boardRef.current = restored;
      serverBaseRef.current = restored;
      lastUpdatedAtRef.current = restored.updatedAt;
      setHistory({ ...historyRef.current, past: [], future: [] });
      deps().inkLive.reconcile(restored);
      setSaveError(null);
    } catch (error) {
      setSaveError(true);
      throw error;
    }
  }

  return {
    board, setBoard, boardRef,
    role, roleRef, boardName, setBoardName,
    loadError, saveError, setSaveError,
    serverBaseRef, lastUpdatedAtRef,
    past, future, nudgeTimerRef,
    bind: (d) => { depsRef.current = d; },
    preview, commit, undo, redo,
    saveNow, saveDebounced, recordHistory, flushNudgeBurst, beginNudge,
    applyRemoteBoard, createSnapshot, restoreSnapshot
  };
}
