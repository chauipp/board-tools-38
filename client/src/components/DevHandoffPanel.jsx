import { useMemo, useState } from "react";
import { GAME_DESIGN_TYPES, TEAM_HANDOFF_TEAMS, exportVersion, gameDesignMarkdown, normalizeTeamHandoff } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

export default function DevHandoffPanel({ board, boardName, selectedIds, onClose, outsideRef }) {
  const [scope, setScope] = useState("all");
  const [typeIds, setTypeIds] = useState([]);
  const [team, setTeam] = useState("dev");
  const selected = useMemo(() => board.nodes.filter((node) => selectedIds.has(node.id)), [board.nodes, selectedIds]);
  const types = new Set(typeIds);
  const nodes = scope === "selected" ? selected : scope === "types" ? board.nodes.filter((node) => types.has(node.type)) : board.nodes;
  const selectedTeam = TEAM_HANDOFF_TEAMS.find((item) => item.id === team);
  const version = exportVersion(board);
  const markdown = useMemo(() => gameDesignMarkdown({ ...board, name: boardName }, { team, ...(scope === "all" ? {} : { nodeIds: nodes.map((node) => node.id) }) }), [board, boardName, scope, nodes, team]);
  const summary = useMemo(() => Object.fromEntries(["draft", "ready", "handed-off"].map((status) => [status, nodes.filter((node) => normalizeTeamHandoff(node.design?.teamHandoff)[team].status === status).length])), [nodes, team]);
  const [copied, setCopied] = useState(false);
  useCloseOnOutside(outsideRef, onClose);

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const typeSuffix = scope === "types" && typeIds.length ? `-${typeIds.join("-")}` : "";
    anchor.href = url; anchor.download = `game-design-${team}${typeSuffix}-handoff-${version.replace(/[^a-zA-Z0-9]/g, "-")}.md`; anchor.click();
    URL.revokeObjectURL(url);
  }
  async function copy() {
    await navigator.clipboard?.writeText(markdown);
    setCopied(true);
  }

  return <section className="gd-handoff-panel">
    <div className="gd-panel-head"><div><span className="gd-kicker">Team handoff</span><h2>Bàn giao theo team</h2></div><button className="btn ghost icon" type="button" onClick={onClose}>×</button></div>
    <p className="gd-handoff-help">Xuất context chung cùng brief đúng team; nội dung không liên quan sẽ không bị lẫn vào tài liệu.</p>
    <p className="gd-handoff-help">Version: <code>{version}</code></p>
    <label>Team nhận
      <select value={team} onChange={(event) => setTeam(event.target.value)}>{TEAM_HANDOFF_TEAMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    </label>
    <label>Phạm vi xuất
      <select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="all">Tất cả card ({board.nodes.length})</option>
        <option value="selected" disabled={!selected.length}>Card đang chọn ({selected.length})</option>
        <option value="types">Theo loại card</option>
      </select>
    </label>
    {scope === "types" && <label>Loại card
      <select multiple value={typeIds} onChange={(event) => setTypeIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
        {GAME_DESIGN_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label} ({board.nodes.filter((node) => node.type === type.id).length})</option>)}
      </select><span className="gd-field-help">Giữ Ctrl/Cmd để chọn nhiều loại.</span>
    </label>}
    <p className="gd-handoff-count">Sẽ xuất <strong>{nodes.length}</strong> card.</p>
    <div className="gd-handoff-summary" aria-label={`Tóm tắt bàn giao ${selectedTeam.label}`}><span>Bản nháp: <strong>{summary.draft}</strong></span><span>Sẵn sàng: <strong>{summary.ready}</strong></span><span>Đã giao: <strong>{summary["handed-off"]}</strong></span></div>
    <label>Preview Markdown<textarea className="gd-handoff-preview" value={markdown} readOnly rows={14} /></label>
    <div className="gd-handoff-actions"><button className="btn" type="button" onClick={download}>Xuất Markdown</button><button className="btn ghost" type="button" onClick={copy}>{copied ? "Đã sao chép" : "Sao chép Markdown"}</button></div>
  </section>;
}
