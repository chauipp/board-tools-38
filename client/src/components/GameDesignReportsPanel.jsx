import { useMemo, useState } from "react";
import { GAME_DESIGN_REPORTS, exportVersion, gameDesignReport, gameDesignReportNodeIds } from "../lib/game-design.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";

export default function GameDesignReportsPanel({ board, boardName, onClose, outsideRef }) {
  const [reportId, setReportId] = useState("gdd");
  const [copied, setCopied] = useState(false);
  const report = GAME_DESIGN_REPORTS.find((item) => item.id === reportId) || GAME_DESIGN_REPORTS[0];
  const nodeIds = useMemo(() => gameDesignReportNodeIds(board, reportId), [board, reportId]);
  const count = nodeIds == null ? board.nodes.length : nodeIds.length;
  const markdown = useMemo(() => gameDesignReport({ ...board, name: boardName }, reportId), [board, boardName, reportId]);
  const version = exportVersion(board);
  useCloseOnOutside(outsideRef, onClose);

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `game-design-${reportId}-${version.replace(/[^a-zA-Z0-9]/g, "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard?.writeText(markdown);
    setCopied(true);
  }

  return <section className="gd-handoff-panel gd-reports-panel">
    <div className="gd-panel-head"><div><span className="gd-kicker">Documents</span><h2>Report Center</h2></div><button className="btn ghost icon" type="button" onClick={onClose} aria-label="Đóng Reports">×</button></div>
    <p className="gd-handoff-help">Xuất tài liệu đúng mục đích từ dữ liệu hiện có trên board. Version: <code>{version}</code></p>
    <label>Loại report
      <select value={reportId} onChange={(event) => { setReportId(event.target.value); setCopied(false); }}>
        {GAME_DESIGN_REPORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <p className="gd-handoff-help">{report.description} Phạm vi: <strong>{count}</strong> card.</p>
    <label>Preview Markdown<textarea className="gd-handoff-preview" value={markdown} readOnly rows={16} /></label>
    <div className="gd-handoff-actions"><button className="btn" type="button" onClick={download}>Xuất Markdown</button><button className="btn ghost" type="button" onClick={copy}>{copied ? "Đã sao chép" : "Sao chép Markdown"}</button></div>
  </section>;
}
