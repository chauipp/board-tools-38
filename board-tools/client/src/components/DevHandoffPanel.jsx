import { useMemo, useState } from "react";
import { gameDesignMarkdown } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

export default function DevHandoffPanel({ board, boardName, selectedIds, onClose, outsideRef }) {
  const [scope, setScope] = useState("all");
  const selected = useMemo(() => board.nodes.filter((node) => selectedIds.has(node.id)), [board.nodes, selectedIds]);
  const nodes = scope === "selected" ? selected : board.nodes;
  const markdown = useMemo(() => gameDesignMarkdown({ ...board, name: boardName }, scope === "selected" ? { nodeIds: selected.map((node) => node.id) } : {}), [board, boardName, scope, selected]);
  const [copied, setCopied] = useState(false);
  useCloseOnOutside(outsideRef, onClose);

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "game-design-handoff.md"; anchor.click();
    URL.revokeObjectURL(url);
  }
  async function copy() {
    await navigator.clipboard?.writeText(markdown);
    setCopied(true);
  }

  return <section className="gd-handoff-panel">
    <div className="gd-panel-head"><div><span className="gd-kicker">Dev handoff</span><h2>Bàn giao cho dev</h2></div><button className="btn ghost icon" type="button" onClick={onClose}>×</button></div>
    <p className="gd-handoff-help">Xuất spec theo thẻ, gồm acceptance criteria, ví dụ, failure states, tuning, technical notes và dependency nội bộ.</p>
    <label>Phạm vi xuất
      <select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="all">Tất cả card ({board.nodes.length})</option>
        <option value="selected" disabled={!selected.length}>Card đang chọn ({selected.length})</option>
      </select>
    </label>
    <p className="gd-handoff-count">Sẽ xuất <strong>{nodes.length}</strong> card.</p>
    <label>Preview Markdown<textarea className="gd-handoff-preview" value={markdown} readOnly rows={14} /></label>
    <div className="gd-handoff-actions"><button className="btn" type="button" onClick={download}>Xuất Markdown</button><button className="btn ghost" type="button" onClick={copy}>{copied ? "Đã sao chép" : "Sao chép Markdown"}</button></div>
  </section>;
}
