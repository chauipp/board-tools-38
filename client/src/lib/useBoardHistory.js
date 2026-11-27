import { useCallback, useState } from "react";
import { reconcileHistory } from "./board-history.js";

export function useBoardHistory({ board, setBoard, saveNow, setEditingId, nudgeBaseRef, nudgeTimerRef }) {
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const MAX_HISTORY = 50;
  function recordHistoryRaw(prevBoard) {
    setPast((p) => {
      const nextPast = [...p, prevBoard];
      return nextPast.length > MAX_HISTORY ? nextPast.slice(nextPast.length - MAX_HISTORY) : nextPast;
    });
    setFuture([]);
  }

  function flushNudgeBurst() {
    if (nudgeBaseRef.current == null) return;
    const base = nudgeBaseRef.current;
    nudgeBaseRef.current = null;
    if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
    recordHistoryRaw(base);
  }

  function recordHistory(prevBoard) {
    flushNudgeBurst();
    recordHistoryRaw(prevBoard);
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
    if (nudgeBaseRef.current != null) {
      const base = keepView(nudgeBaseRef.current);
      nudgeBaseRef.current = null;
      if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
      setFuture((f) => [board, ...f]);
      setEditingId(null);
      setBoard(base);
      saveNow(base);
      return;
    }
    if (past.length === 0) return;
    const prev = keepView(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [board, ...f]);
    setEditingId(null);
    setBoard(prev);
    saveNow(prev);
  }

  function redo() {
    if (nudgeBaseRef.current != null) { flushNudgeBurst(); return; }
    if (future.length === 0) return;
    const nextState = keepView(future[0]);
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, board]);
    setEditingId(null);
    setBoard(nextState);
    saveNow(nextState);
  }

  function resetHistory() {
    setPast([]);
    setFuture([]);
  }

  const acceptRemoteHistory = useCallback((previous, incoming) => {
    if (nudgeBaseRef.current) {
      [nudgeBaseRef.current = null] = reconcileHistory([nudgeBaseRef.current], previous, incoming);
    }
    setPast((entries) => reconcileHistory(entries, previous, incoming));
    setFuture((entries) => reconcileHistory([...entries].reverse(), previous, incoming).reverse());
  }, [nudgeBaseRef]);

  return { past, future, recordHistory, flushNudgeBurst, undo, redo, resetHistory, acceptRemoteHistory };
}
