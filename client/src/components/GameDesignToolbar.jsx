import { Trans, useLingui } from "@lingui/react/macro";

const PANELS = [
  { type: "brief", label: "Game brief", title: "Mở Game brief" },
  { type: "flow", label: "Game flow", title: "Mở Game flow" },
  { type: "balance", label: "Balance", title: "Mở Balance sheet" },
  { type: "handoff", label: "Handoff", title: "Mở Team handoff" },
  { type: "decisions", label: "Decisions", title: "Mở Decision timeline" },
  { type: "insights", label: "Insights", title: "Mở Game Design insights" },
  { type: "impact", label: "Impact", title: "Mở dependency impact map" },
  { type: "playtests", label: "Playtests" },
  { type: "reports", label: "Reports", title: "Mở Report Center" }
];

export default function GameDesignToolbar({ open, activePanel, onToggle, onOpenPanel }) {
  const { t } = useLingui();
  return (
    <div className="island-row gd-tools-row">
      <button
        type="button"
        className="btn ghost gd-tools-toggle"
        aria-expanded={open}
        aria-controls="game-design-toolbar"
        title={open ? t`Thu gọn công cụ thiết kế` : t`Mở công cụ thiết kế`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onToggle}
      ><Trans>Thiết kế</Trans> <span aria-hidden="true">{open ? "▾" : "▸"}</span></button>
      <div id="game-design-toolbar" className="gd-toolbar-actions" hidden={!open}>
        {PANELS.map(({ type, label, title }) => (
          <button
            type="button"
            key={type}
            className={"btn ghost gd-brief-trigger" + (activePanel === type ? " active" : "")}
            title={title}
            onClick={() => onOpenPanel(type)}
          >{label}</button>
        ))}
      </div>
    </div>
  );
}
