import { useCallback, useMemo, useRef } from "react";

// Mọi cờ panel và inspector của board (mục lục, minimap, thanh công cụ, Xếp cây,
// dock thiết kế, các bảng game-design, panel lọc) đọc từ trạng thái làm việc
// riêng của từng người (useWorkspaceState) cùng setter tương ứng. Trước nằm
// trong IdeaMap.jsx.
export function useWorkspaceInspectors({
  workspace, workspaceState
}) {
  const depsRef = useRef({});
  const workspaceSetters = useMemo(() => {
    const controller = workspace.controller;
    const flag = (key) => (value) => {
      const current = controller.getSnapshot().state[key];
      controller.update({ [key]: typeof value === "function" ? value(current) : value });
    };
    const inspector = (type) => (value) => {
      const current = controller.getSnapshot().state.inspector;
      if (value == null || value === false) {
        if (current?.type === type) controller.update({ inspector: null });
      } else if (current?.type !== type || type === "tree" || type === "design") controller.update({ inspector: { type, ...(type === "tree" ? value : type === "design" ? { id: value } : {}) } });
    };
    return { flag, inspector, panels: (value) => {
      const current = controller.getSnapshot().state;
      const next = typeof value === "function" ? value({ status: current.statusOpen, tag: current.tagOpen, palette: current.paletteOpen }) : value;
      controller.update({ statusOpen: next.status, tagOpen: next.tag, paletteOpen: next.palette });
    } };
  }, [workspace.controller]);

  const outlineOpen = workspaceState.outlineOpen;
  const setOutlineOpen = useMemo(() => workspaceSetters.flag("outlineOpen"), [workspaceSetters]);
  // Bản đồ thu nhỏ ở góc dưới phải. Mặc định BẬT: nó chỉ có nghĩa khi luôn ở
  // đó — thứ phải bật lên mới xem được thì lúc lạc đường đã không nhớ là có.
  const miniOpen = workspaceState.miniOpen;
  const toolsOpen = workspaceState.toolsOpen;
  const setMiniOpen = useMemo(() => workspaceSetters.flag("miniOpen"), [workspaceSetters]);
  // Bảng Xếp cây bên phải: { kind, id } của thẻ/khung đang làm gốc. Tuỳ chọn
  // sống riêng để đóng bảng rồi mở lại cây khác vẫn giữ nguyên cách xếp vừa dò
  // được. treeBaseRef giữ board TRƯỚC khi mở bảng: mọi lần kéo thanh trượt đều
  // tính lại từ đó chứ không chồng lên kết quả lần trước, nên kéo qua kéo lại
  // không làm cây trôi dần đi.
  const treeUI = workspaceState.inspector?.type === "tree" ? workspaceState.inspector : null;
  const setTreeUI = useMemo(() => workspaceSetters.inspector("tree"), [workspaceSetters]);
  // Mặc định mở Trạng thái + Nhãn để giữ đúng hành vi cũ khi mới vào; Bảng màu
  // đóng. Trạng thái riêng của tài khoản, board và nhóm màn hình.
  const panels = useMemo(() => ({ status: workspaceState.statusOpen, tag: workspaceState.tagOpen, palette: workspaceState.paletteOpen }), [workspaceState.statusOpen, workspaceState.tagOpen, workspaceState.paletteOpen]);
  const setPanels = workspaceSetters.panels;
  const inspector = workspaceState.inspector;
  const designEditId = inspector?.type === "design" ? inspector.id : null;
  const setDesignEditId = useMemo(() => workspaceSetters.inspector("design"), [workspaceSetters]);
  const briefOpen = inspector?.type === "brief", flowOpen = inspector?.type === "flow", handoffOpen = inspector?.type === "handoff", balanceOpen = inspector?.type === "balance", decisionTimelineOpen = inspector?.type === "decisions", snapshotsOpen = inspector?.type === "snapshots";
  const setBriefOpen = useMemo(() => workspaceSetters.inspector("brief"), [workspaceSetters]);
  const setFlowOpen = useMemo(() => workspaceSetters.inspector("flow"), [workspaceSetters]);
  const setHandoffOpen = useMemo(() => workspaceSetters.inspector("handoff"), [workspaceSetters]);
  const setBalanceOpen = useMemo(() => workspaceSetters.inspector("balance"), [workspaceSetters]);
  const setDecisionTimelineOpen = useMemo(() => workspaceSetters.inspector("decisions"), [workspaceSetters]);
  const setSnapshotsOpen = useMemo(() => workspaceSetters.inspector("snapshots"), [workspaceSetters]);
  const insightsOpen = inspector?.type === "insights", reportsOpen = inspector?.type === "reports", impactOpen = inspector?.type === "impact", playtestsOpen = inspector?.type === "playtests";
  const setInsightsOpen = useMemo(() => workspaceSetters.inspector("insights"), [workspaceSetters]);
  const setReportsOpen = useMemo(() => workspaceSetters.inspector("reports"), [workspaceSetters]);
  const setImpactOpen = useMemo(() => workspaceSetters.inspector("impact"), [workspaceSetters]);
  const impactCardId = inspector?.type === "impact" ? inspector.id ?? null : null;
  const setImpactCardId = useCallback((id) => workspace.update({ inspector: { type: "impact", ...(id != null ? { id } : {}) } }), [workspace.controller]);
  const setPlaytestsOpen = useMemo(() => workspaceSetters.inspector("playtests"), [workspaceSetters]);

  return {
    balanceOpen, briefOpen, decisionTimelineOpen, designEditId, flowOpen, handoffOpen, impactCardId, impactOpen, insightsOpen, inspector, miniOpen, outlineOpen, panels, playtestsOpen, reportsOpen, setBalanceOpen, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setMiniOpen, setOutlineOpen, setPanels, setPlaytestsOpen, setReportsOpen, setSnapshotsOpen, setTreeUI, snapshotsOpen, toolsOpen, treeUI, workspaceSetters,
    bind: (d) => { depsRef.current = d; }
  };
}
