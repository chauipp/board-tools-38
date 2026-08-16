import { normalizeABTests, normalizeAnalyticsEvents, normalizeDelivery, normalizeFollowUpTasks, normalizePlaytestSession, normalizePostLaunchReview } from "../lib/game-design.js";

function title(node) { return node.title || `Thẻ ${node.id}`; }

export default function GameDesignInsightsPanel({ nodes, onOpenCard, onClose, outsideRef }) {
  const today = new Date().toISOString().slice(0, 10);
  const allNodes = Array.isArray(nodes) ? nodes : [];
  const cards = allNodes.map((node) => {
    const delivery = normalizeDelivery(node.design?.delivery);
    const followUps = normalizeFollowUpTasks(node.design?.followUpTasks, allNodes);
    const tests = normalizeABTests(node.design?.abTests);
    const postLaunch = normalizePostLaunchReview(node.design?.postLaunchReview, allNodes);
    return { node, delivery, followUps, tests, postLaunch };
  });
  const blocked = cards.filter((item) => item.delivery.blockerLevel === "blocked");
  const overdue = cards.filter((item) => item.delivery.deadline && item.delivery.deadline < today);
  const pendingTasks = cards.flatMap((item) => item.followUps.filter((task) => !task.done).map((task) => ({ ...task, node: item.node })))
    .sort((a, b) => (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31"));
  const runningTests = cards.flatMap((item) => item.tests.filter((test) => test.status === "running").map((test) => ({ ...test, node: item.node })));
  const playtests = allNodes.filter((node) => Object.values(normalizePlaytestSession(node.design?.playtestSession, allNodes)).some((value) => Array.isArray(value) ? value.length : value));
  const analytics = allNodes.reduce((count, node) => count + normalizeAnalyticsEvents(node.design?.analyticsEvents).length, 0);
  const needsIteration = cards.filter((item) => item.postLaunch.status === "needs-iteration");
  const open = (node) => onOpenCard(node.id);

  return <aside className="gd-panel gd-insights-panel" ref={outsideRef} aria-label="Game design insights">
    <div className="gd-panel-head"><div><span className="gd-kicker">Board health</span><h2>Insights</h2></div><button className="btn ghost icon" type="button" onClick={onClose} aria-label="Đóng Insights">×</button></div>
    <div className="gd-insight-grid">
      <div><strong>{blocked.length}</strong><span>Blocked</span></div><div><strong>{overdue.length}</strong><span>Quá hạn</span></div>
      <div><strong>{runningTests.length}</strong><span>A/B đang chạy</span></div><div><strong>{playtests.length}</strong><span>Playtest</span></div>
      <div><strong>{analytics}</strong><span>Analytics events</span></div><div><strong>{needsIteration.length}</strong><span>Cần lặp lại</span></div>
    </div>
    <InsightList title="Cần xử lý trước" empty="Không có blocker, quá hạn hay follow-up mở." items={[
      ...blocked.map((item) => ({ node: item.node, text: item.delivery.blocker || "Blocked" })),
      ...overdue.map((item) => ({ node: item.node, text: `Quá hạn ${item.delivery.deadline}` })),
      ...pendingTasks.slice(0, 8).map((item) => ({ node: item.node, text: item.text + (item.deadline ? ` · ${item.deadline}` : "") }))
    ]} onOpen={open} />
    <InsightList title="Thử nghiệm đang chạy" empty="Chưa có A/B test ở trạng thái Running." items={runningTests.map((item) => ({ node: item.node, text: item.hypothesis }))} onOpen={open} />
    <InsightList title="Post-launch cần iteration" empty="Chưa có review cần lặp lại." items={needsIteration.map((item) => ({ node: item.node, text: item.postLaunch.nextDecision || item.postLaunch.outcome || "Needs iteration" }))} onOpen={open} />
  </aside>;
}

function InsightList({ title: label, empty, items, onOpen }) {
  return <section className="gd-insight-list"><h3>{label}</h3>{items.length === 0 ? <p className="gd-help">{empty}</p> : items.map((item, index) => <button className="gd-insight-item" key={`${item.node.id}-${index}`} type="button" onClick={() => onOpen(item.node)}><strong>{title(item.node)}</strong><span>{item.text}</span></button>)}</section>;
}
