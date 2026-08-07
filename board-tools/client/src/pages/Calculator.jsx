import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { getCalculator, saveCalculator } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import LoadError from "../components/LoadError.jsx";
import LocaleToggle from "../components/LocaleToggle.jsx";
import "../styles/calculator.css";

function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function findStat(stats, includes, excludes) {
  excludes = excludes || [];
  return stats.find((s) => {
    const n = normalize(s.name);
    const hasInclude = includes.some((k) => n.indexOf(k) !== -1);
    const hasExclude = excludes.some((k) => n.indexOf(k) !== -1);
    return hasInclude && !hasExclude;
  });
}

export default function Calculator() {
  const { toggle: toggleTheme } = useTheme();
  const { t } = useLingui();
  const [calc, setCalc] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [duelResult, setDuelResult] = useState(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const fieldSnapshotRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getCalculator()
      .then((data) => { if (!cancelled) setCalc(data); })
      .catch((e) => setLoadError(e.code || "UNKNOWN"));
    return () => { cancelled = true; };
  }, []);

  // Gõ một ký tự là một cú PUT. Gõ "1500" vào ô ngân sách trước đây bắn bốn
  // request chồng nhau, và không gì bảo đảm chúng về đúng thứ tự gửi đi — cú cũ
  // về sau sẽ ghi đè cú mới và con số tự lùi lại trước mắt người đang gõ.
  //
  // Gộp lại thành một cú sau 400ms không gõ nữa. Mốc thời gian gửi kèm là lúc
  // SỬA, không phải lúc gửi, để server bỏ được cú đã lỗi thời (xem
  // isStaleWrite trong server/calculator.js).
  const SAVE_DELAY_MS = 400;
  const saveTimerRef = useRef(null);
  const pendingRef = useRef(null);
  const saveSeqRef = useRef(0);

  const flushSaveRef = useRef(() => {});
  flushSaveRef.current = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const seq = ++saveSeqRef.current;
    saveCalculator(pending.state, pending.savedAt)
      // Chỉ cú mới nhất được quyền đổi đèn báo lỗi: một cú cũ về muộn và hỏng
      // không nên bật báo đỏ khi cú mới sau đó đã lưu xong xuôi.
      .then(() => { if (seq === saveSeqRef.current) setSaveError(null); })
      .catch(() => { if (seq === saveSeqRef.current) setSaveError(true); });
  };

  function saveNow(next) {
    pendingRef.current = { state: next, savedAt: Date.now() };
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSaveRef.current(), SAVE_DELAY_MS);
  }

  // Rời trang trong lúc còn cú chờ thì gửi ngay, đừng nuốt mất thay đổi cuối.
  useEffect(() => () => {
    clearTimeout(saveTimerRef.current);
    flushSaveRef.current();
  }, []);

  function applyFieldChange(next) {
    setCalc(next);
    setDuelResult(null);
    saveNow(next);
  }

  const MAX_HISTORY = 50;
  function recordHistory(prevCalc) {
    setPast((p) => {
      const nextPast = [...p, prevCalc];
      return nextPast.length > MAX_HISTORY ? nextPast.slice(nextPast.length - MAX_HISTORY) : nextPast;
    });
    setFuture([]);
  }

  function commitAndSave(next) {
    recordHistory(calc);
    applyFieldChange(next);
  }

  function beginFieldEdit() {
    if (fieldSnapshotRef.current === null) fieldSnapshotRef.current = calc;
  }
  function endFieldEdit() {
    const snap = fieldSnapshotRef.current;
    fieldSnapshotRef.current = null;
    if (snap && JSON.stringify(snap) !== JSON.stringify(calc)) recordHistory(snap);
  }

  function undo() {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [calc, ...f]);
    applyFieldChange(prev);
  }
  function redo() {
    if (future.length === 0) return;
    const nextState = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, calc]);
    applyFieldChange(nextState);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      e.preventDefault();
      if (key === "y" || (key === "z" && e.shiftKey)) redo(); else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calc, past, future]);

  if (loadError) {
    return <LoadError code={loadError} />;
  }
  if (!calc) {
    return <div style={{ padding: 40, color: "var(--ink-dim)" }}><Trans>Đang tải…</Trans></div>;
  }

  const { stats } = calc;
  let spentA = 0, spentB = 0;
  stats.forEach((s) => { spentA += s.a * s.cost; spentB += s.b * s.cost; });
  const remA = calc.budget - spentA;
  const remB = calc.budget - spentB;

  const hp = findStat(stats, ["mau", "hp"]);
  const armor = findStat(stats, ["giap", "armor"], ["xuyen"]);
  const pierce = findStat(stats, ["xuyen", "pierce"]);
  const atk = findStat(stats, ["tan cong", "atk", "attack", "sat thuong", "damage"]);
  const canSimulate = Boolean(hp && armor && atk);

  let dmgToB = 0, dmgToA = 0;
  if (canSimulate) {
    const pierceA = pierce ? pierce.a : 0;
    const pierceB = pierce ? pierce.b : 0;
    dmgToB = Math.max(0, atk.a - Math.max(0, armor.b - pierceA));
    dmgToA = Math.max(0, atk.b - Math.max(0, armor.a - pierceB));
  }

  function updateStat(id, field, value) {
    applyFieldChange({ ...calc, stats: calc.stats.map((s) => (s.id === id ? { ...s, [field]: value } : s)) });
  }
  function addStat() {
    commitAndSave({
      ...calc,
      stats: [...calc.stats, { id: calc.nextStatId, name: t`Chỉ số mới`, cost: 1, a: 0, b: 0 }],
      nextStatId: calc.nextStatId + 1
    });
  }
  function removeStat(id) {
    commitAndSave({ ...calc, stats: calc.stats.filter((s) => s.id !== id) });
  }

  function runDuel() {
    if (!canSimulate) {
      setDuelResult({ kind: "cannotSimulate" });
      return;
    }
    if (dmgToB === 0 && dmgToA === 0) {
      setDuelResult({ kind: "stalemate" });
      return;
    }
    let hpA = hp.a, hpB = hp.b, rounds = 0;
    while (hpA > 0 && hpB > 0 && rounds < 500) {
      hpB -= dmgToB;
      hpA -= dmgToA;
      rounds++;
    }
    if (hpA <= 0 && hpB <= 0) setDuelResult({ kind: "draw", rounds });
    else if (hpB <= 0) setDuelResult({ kind: "aWins", rounds, hp: Math.max(0, Math.round(hpA)) });
    else if (hpA <= 0) setDuelResult({ kind: "bWins", rounds, hp: Math.max(0, Math.round(hpB)) });
    else setDuelResult({ kind: "timeout", rounds });
  }

  return (
    <div className="calc-shell">
      <div className="calc-top">
        <div>
          <div className="eyebrow"><Trans>Sa bàn thiết kế</Trans></div>
          <h1 className="display"><Trans>Bàn Tính Đối Đầu</Trans></h1>
          <div className="sub"><Trans>Chia ngân sách điểm vào chỉ số chiến đấu cho hai build, rồi mô phỏng xem ai thắng.</Trans></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/" className="btn ghost"><Trans>← Trang chủ</Trans></Link>
          <button className="btn ghost icon" onClick={undo} disabled={past.length === 0} title={t`Hoàn tác (Ctrl+Z)`}>↶</button>
          <button className="btn ghost icon" onClick={redo} disabled={future.length === 0} title={t`Làm lại (Ctrl+Shift+Z)`}>↷</button>
          <LocaleToggle />
          <button className="btn ghost icon" onClick={toggleTheme} title={t`Đổi giao diện sáng/tối`}>◐</button>
        </div>
      </div>

      {saveError && <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}><Trans>Không lưu được lên server.</Trans></div>}

      <div className="budget-row">
        <label htmlFor="budgetInput"><Trans>Ngân sách điểm</Trans></label>
        <input
          id="budgetInput" type="number" className="mono" min="0" step="10"
          value={calc.budget}
          onFocus={beginFieldEdit}
          onBlur={endFieldEdit}
          onChange={(e) => applyFieldChange({ ...calc, budget: Number(e.target.value) || 0 })}
        />
      </div>

      <div className="ledger-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th><Trans>Chỉ số</Trans></th>
              <th><Trans>Giá / điểm</Trans></th>
              <th><Trans>Build A</Trans></th>
              <th><Trans>Build B</Trans></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id}>
                <td><input type="text" value={s.name} onFocus={beginFieldEdit} onBlur={endFieldEdit} onChange={(e) => updateStat(s.id, "name", e.target.value)} /></td>
                <td><input type="number" className="mono num" min="0" step="1" value={s.cost} onFocus={beginFieldEdit} onBlur={endFieldEdit} onChange={(e) => updateStat(s.id, "cost", Number(e.target.value) || 0)} /></td>
                <td><input type="number" className="mono num" min="0" step="1" value={s.a} onFocus={beginFieldEdit} onBlur={endFieldEdit} onChange={(e) => updateStat(s.id, "a", Number(e.target.value) || 0)} /></td>
                <td><input type="number" className="mono num" min="0" step="1" value={s.b} onFocus={beginFieldEdit} onBlur={endFieldEdit} onChange={(e) => updateStat(s.id, "b", Number(e.target.value) || 0)} /></td>
                <td className="col-remove">
                  <button className="icon-btn" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--ink-dim)" }} title={t`Xoá chỉ số`} onClick={() => removeStat(s.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-actions">
        <button className="btn ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={addStat}><Trans>+ Thêm chỉ số</Trans></button>
      </div>

      <div className="remaining-row">
        <div className="remaining-card">
          <div className="label"><Trans>Còn lại — Build A</Trans></div>
          <div className={"value mono" + (remA < 0 ? " over" : "")}>{remA}</div>
        </div>
        <div className="remaining-card">
          <div className="label"><Trans>Còn lại — Build B</Trans></div>
          <div className={"value mono" + (remB < 0 ? " over" : "")}>{remB}</div>
        </div>
      </div>

      <div className="duel-box">
        <h3><Trans>Đối đầu thử</Trans></h3>
        <div className="duel-preview">
          {canSimulate
            ? <Trans>A gây <strong>{dmgToB}</strong> sát thương/lượt lên B &nbsp;·&nbsp; B gây <strong>{dmgToA}</strong> sát thương/lượt lên A</Trans>
            : <Trans>Cần có ít nhất Máu, Giáp và Tấn công trong bảng để xem trước đối đầu.</Trans>}
        </div>
        <button className="btn" onClick={runDuel}><Trans>Mô phỏng đối đầu</Trans></button>
        {duelResult && <div className="duel-result"><DuelMessage result={duelResult} /></div>}
      </div>
    </div>
  );
}

function DuelMessage({ result }) {
  const rounds = result.rounds;
  const hp = result.hp;
  switch (result.kind) {
    case "cannotSimulate":
      return <Trans>Thiếu chỉ số Máu / Giáp / Tấn công — không mô phỏng được.</Trans>;
    case "stalemate":
      return <Trans>Bế tắc: không bên nào đủ tấn công xuyên phá giáp đối phương. Đây là dấu hiệu nên xem lại cách quy đổi điểm.</Trans>;
    case "draw":
      return <Trans>Cả hai cùng gục ở lượt {rounds} — hoà.</Trans>;
    case "aWins":
      return <Trans>Build A thắng ở lượt {rounds}, còn lại {hp} máu.</Trans>;
    case "bWins":
      return <Trans>Build B thắng ở lượt {rounds}, còn lại {hp} máu.</Trans>;
    case "timeout":
      return <Trans>Chưa phân thắng bại sau {rounds} lượt — trận kéo dài, có thể cần xem lại tỉ lệ sát thương/máu.</Trans>;
    default:
      return null;
  }
}
