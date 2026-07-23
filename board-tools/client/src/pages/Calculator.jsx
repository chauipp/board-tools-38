import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCalculator, saveCalculator } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
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
  const toggleTheme = useTheme();
  const [calc, setCalc] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [duelResult, setDuelResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCalculator()
      .then((data) => { if (!cancelled) setCalc(data); })
      .catch((e) => setLoadError(e.message || "Lỗi tải dữ liệu"));
    return () => { cancelled = true; };
  }, []);

  function saveNow(next) {
    saveCalculator(next).then(() => setSaveError(null)).catch(() => setSaveError("Không lưu được lên server."));
  }
  function commitAndSave(next) {
    setCalc(next);
    setDuelResult(null);
    saveNow(next);
  }

  if (loadError) {
    return (
      <div style={{ padding: 40 }}>
        Không tải được dữ liệu: {loadError}. Kiểm tra server đã chạy chưa (npm run dev trong thư mục server) và biến MONGODB_URI đã đúng chưa.
      </div>
    );
  }
  if (!calc) {
    return <div style={{ padding: 40, color: "var(--ink-dim)" }}>Đang tải…</div>;
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
    commitAndSave({ ...calc, stats: calc.stats.map((s) => (s.id === id ? { ...s, [field]: value } : s)) });
  }
  function addStat() {
    commitAndSave({
      ...calc,
      stats: [...calc.stats, { id: calc.nextStatId, name: "Chỉ số mới", cost: 1, a: 0, b: 0 }],
      nextStatId: calc.nextStatId + 1
    });
  }
  function removeStat(id) {
    commitAndSave({ ...calc, stats: calc.stats.filter((s) => s.id !== id) });
  }

  function runDuel() {
    if (!canSimulate) {
      setDuelResult("Thiếu chỉ số Máu / Giáp / Tấn công — không mô phỏng được.");
      return;
    }
    if (dmgToB === 0 && dmgToA === 0) {
      setDuelResult("Bế tắc: không bên nào đủ tấn công xuyên phá giáp đối phương. Đây là dấu hiệu nên xem lại cách quy đổi điểm.");
      return;
    }
    let hpA = hp.a, hpB = hp.b, rounds = 0;
    while (hpA > 0 && hpB > 0 && rounds < 500) {
      hpB -= dmgToB;
      hpA -= dmgToA;
      rounds++;
    }
    if (hpA <= 0 && hpB <= 0) setDuelResult(`Cả hai cùng gục ở lượt ${rounds} — hoà.`);
    else if (hpB <= 0) setDuelResult(`Build A thắng ở lượt ${rounds}, còn lại ${Math.max(0, Math.round(hpA))} máu.`);
    else if (hpA <= 0) setDuelResult(`Build B thắng ở lượt ${rounds}, còn lại ${Math.max(0, Math.round(hpB))} máu.`);
    else setDuelResult(`Chưa phân thắng bại sau ${rounds} lượt — trận kéo dài, có thể cần xem lại tỉ lệ sát thương/máu.`);
  }

  return (
    <div className="calc-shell">
      <div className="calc-top">
        <div>
          <div className="eyebrow">Sa bàn thiết kế</div>
          <h1 className="display">Bàn Tính Đối Đầu</h1>
          <div className="sub">Chia ngân sách điểm vào chỉ số chiến đấu cho hai build, rồi mô phỏng xem ai thắng.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/" className="btn ghost">← Trang chủ</Link>
          <button className="btn ghost icon" onClick={toggleTheme} title="Đổi giao diện sáng/tối">◐</button>
        </div>
      </div>

      {saveError && <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}>{saveError}</div>}

      <div className="budget-row">
        <label htmlFor="budgetInput">Ngân sách điểm</label>
        <input
          id="budgetInput" type="number" className="mono" min="0" step="10"
          value={calc.budget}
          onChange={(e) => commitAndSave({ ...calc, budget: Number(e.target.value) || 0 })}
        />
      </div>

      <div className="ledger-wrap">
        <table className="ledger">
          <thead>
            <tr><th>Chỉ số</th><th>Giá / điểm</th><th>Build A</th><th>Build B</th><th></th></tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id}>
                <td><input type="text" value={s.name} onChange={(e) => updateStat(s.id, "name", e.target.value)} /></td>
                <td><input type="number" className="mono num" min="0" step="1" value={s.cost} onChange={(e) => updateStat(s.id, "cost", Number(e.target.value) || 0)} /></td>
                <td><input type="number" className="mono num" min="0" step="1" value={s.a} onChange={(e) => updateStat(s.id, "a", Number(e.target.value) || 0)} /></td>
                <td><input type="number" className="mono num" min="0" step="1" value={s.b} onChange={(e) => updateStat(s.id, "b", Number(e.target.value) || 0)} /></td>
                <td className="col-remove">
                  <button className="icon-btn" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--ink-dim)" }} title="Xoá chỉ số" onClick={() => removeStat(s.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-actions">
        <button className="btn ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={addStat}>+ Thêm chỉ số</button>
      </div>

      <div className="remaining-row">
        <div className="remaining-card">
          <div className="label">Còn lại — Build A</div>
          <div className={"value mono" + (remA < 0 ? " over" : "")}>{remA}</div>
        </div>
        <div className="remaining-card">
          <div className="label">Còn lại — Build B</div>
          <div className={"value mono" + (remB < 0 ? " over" : "")}>{remB}</div>
        </div>
      </div>

      <div className="duel-box">
        <h3>Đối đầu thử</h3>
        <div className="duel-preview">
          {canSimulate
            ? <>A gây <strong>{dmgToB}</strong> sát thương/lượt lên B &nbsp;·&nbsp; B gây <strong>{dmgToA}</strong> sát thương/lượt lên A</>
            : "Cần có ít nhất Máu, Giáp và Tấn công trong bảng để xem trước đối đầu."}
        </div>
        <button className="btn" onClick={runDuel}>Mô phỏng đối đầu</button>
        {duelResult && <div className="duel-result">{duelResult}</div>}
      </div>
    </div>
  );
}
