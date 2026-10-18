import { test } from "node:test";
import assert from "node:assert/strict";
import { BALANCE_TEMPLATES, acceptanceProgress, abTestProgress, appendBalanceTemplate, balanceCurveTable, balanceMetricsForCard, balanceWarnings, createGameDesignNode, createRelatedGameDesignCard, decisionTimeline, dependencyAnalysis, dependencyImpact, duplicateGameDesignCard, emptyDecisionLog, emptyDelivery, emptyGameDesignBalance, emptyGameDesignBrief, emptyGameDesignDetails, emptyGameDesignFlow, emptyLiveOps, emptyPlaytestSession, emptyPostLaunchReview, emptyReview, emptyTeamHandoff, exportPackage, exportVersion, evaluateBalanceFormula, followUpProgress, gameDesignMarkdown, gameDesignPreview, gameDesignReport, gameDesignReportNodeIds, gameDesignType, hasDelivery, hasGameDesignBrief, hasGameDesignFlow, hasLiveOps, hasPlaytestSession, hasPostLaunchReview, normalizeABTests, normalizeAcceptanceCriteria, normalizeAnalyticsEvents, normalizeDecisionLog, normalizeDelivery, normalizeFollowUpTasks, normalizeGameDesignBalance, normalizeGameDesignBrief, normalizeGameDesignDetails, normalizeGameDesignFlow, normalizeLiveOps, normalizePlaytestSession, normalizePostLaunchReview, normalizeReview, normalizeTeamHandoff, normalizeTechnicalNotes, playtestComparison, relationDefinition } from "./game-design.js";

test("chuẩn hóa brief rỗng, cắt khoảng trắng và bỏ stage thiếu title", () => {
  assert.deepEqual(emptyGameDesignBrief(), { genre: "", targetAudience: "", playerFantasy: "", playerJourney: [] });
  assert.deepEqual(normalizeGameDesignBrief(null), emptyGameDesignBrief());
  assert.deepEqual(normalizeGameDesignBrief({
    genre: " Roguelite ", targetAudience: " Mastery ", playerFantasy: " Hunter ",
    playerJourney: [{ title: "  ", experience: "x", emotion: "y" }, { title: " Khám phá ", experience: " Thử build ", emotion: " Tò mò " }]
  }), {
    genre: "Roguelite", targetAudience: "Mastery", playerFantasy: "Hunter",
    playerJourney: [{ id: "journey-2", title: "Khám phá", experience: "Thử build", emotion: "Tò mò" }]
  });
  assert.equal(hasGameDesignBrief(null), false);
});

test("Markdown thêm Game Context trước Game Design khi brief có nội dung", () => {
  const md = gameDesignMarkdown({ name: "Combat", nodes: [], gameDesignBrief: {
    genre: "Roguelite", targetAudience: "Mastery", playerFantasy: "Hunter",
    playerJourney: [{ id: "journey-1", title: "Khám phá", experience: "Thử build", emotion: "Tò mò" }]
  } });
  assert.match(md, /## Game Context/);
  assert.match(md, /\*\*Genre\*\*[\s\S]*Roguelite/);
  assert.match(md, /\*\*Target audience\*\*[\s\S]*Mastery/);
  assert.match(md, /\*\*Player fantasy\*\*[\s\S]*Hunter/);
  assert.match(md, /1\. \*\*Khám phá\*\* — Thử build · Tò mò/);
  assert.ok(md.indexOf("## Game Context") < md.indexOf("## Game Design"));
  assert.doesNotMatch(gameDesignMarkdown({ name: "Empty", nodes: [] }), /## Game Context/);
});

test("chuẩn hóa Game Flow, bỏ item rỗng và giữ reference card hợp lệ", () => {
  assert.deepEqual(emptyGameDesignFlow(), { playerLoop: [], progressionMap: [] });
  assert.deepEqual(normalizeGameDesignFlow(null), emptyGameDesignFlow());
  assert.deepEqual(normalizeGameDesignFlow({
    playerLoop: [{ title: "  ", action: "x" }, { title: " Khám phá ", action: " Chọn ", outcome: " Nhận ", note: " Ghi chú ", cardIds: [1, " 2 ", 1, "missing"] }],
    progressionMap: [{ title: " Early ", objective: " Học ", unlocks: " Né ", description: " Run ", emotion: " Tò mò ", cardIds: ["2", "3"] }]
  }, [{ id: 1 }, { id: 2 }]), {
    playerLoop: [{ id: "loop-2", title: "Khám phá", action: "Chọn", outcome: "Nhận", note: "Ghi chú", cardIds: ["1", "2"] }],
    progressionMap: [{ id: "progression-1", title: "Early", objective: "Học", unlocks: "Né", description: "Run", emotion: "Tò mò", cardIds: ["2"] }]
  });
  assert.equal(hasGameDesignFlow(null), false);
});

test("Markdown thêm Game Flow sau context và trước card", () => {
  const md = gameDesignMarkdown({ name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: {} }], gameDesignBrief: { genre: "Action", playerJourney: [] }, gameDesignFlow: {
    playerLoop: [{ id: "loop-1", title: "Khám phá", action: "Chọn route", outcome: "Nhận tài nguyên", note: "Mở build", cardIds: ["1"] }],
    progressionMap: [{ id: "progress-1", title: "Early", objective: "Học loop", unlocks: "Dash", description: "Run đầu", emotion: "Tò mò", cardIds: ["1"] }]
  } });
  assert.match(md, /## Game Flow/);
  assert.match(md, /\*\*Player Loop\*\*/);
  assert.match(md, /1\. \*\*Khám phá\*\* — Chọn route → Nhận tài nguyên · Mở build · Thẻ: Dash/);
  assert.match(md, /\*\*Progression Map\*\*/);
  assert.ok(md.indexOf("## Game Context") < md.indexOf("## Game Flow"));
  assert.ok(md.indexOf("## Game Flow") < md.indexOf("## Game Design"));
  assert.doesNotMatch(gameDesignMarkdown({ name: "Empty", nodes: [] }), /## Game Flow/);
});

test("chuẩn hóa Examples, Failure States và Tuning Parameters", () => {
  assert.deepEqual(emptyGameDesignDetails(), { examples: [], failureStates: [], tuningParameters: [] });
  assert.deepEqual(normalizeGameDesignDetails({
    examples: [{ title: " ", scenario: "x" }, { title: " Đánh trúng ", scenario: " Bấm đánh ", expectedResult: " Gây damage " }],
    failureStates: [{ condition: " Hết stamina ", playerFeedback: " Nút mờ ", recovery: " Chờ hồi " }],
    tuningParameters: [{ name: " Cooldown ", defaultValue: " 0.5 ", min: " 0.1 ", max: " 2 ", unit: " s ", note: " Theo vũ khí " }]
  }), {
    examples: [{ id: "example-2", title: "Đánh trúng", scenario: "Bấm đánh", expectedResult: "Gây damage" }],
    failureStates: [{ id: "failure-1", condition: "Hết stamina", playerFeedback: "Nút mờ", recovery: "Chờ hồi" }],
    tuningParameters: [{ id: "tuning-1", name: "Cooldown", defaultValue: "0.5", min: "0.1", max: "2", unit: "s", note: "Theo vũ khí" }]
  });
});

test("technical notes được trim và card mới có field rỗng", () => {
  assert.equal(normalizeTechnicalNotes("  Gửi event dash_used  "), "Gửi event dash_used");
  assert.equal(normalizeTechnicalNotes(null), "");
  assert.equal(createGameDesignNode(1, 0, 0).design.technicalNotes, "");
});

test("player experience được trim, preview và export", () => {
  const node = createGameDesignNode(1, 0, 0);
  assert.equal(node.design.playerExperience, "");
  const withExperience = { ...node, design: { ...node.design, playerExperience: " Căng thẳng nhưng công bằng " } };
  assert.equal(gameDesignPreview(withExperience).some((item) => item.label === "Trải nghiệm người chơi"), true);
  assert.match(gameDesignMarkdown({ name: "Combat", nodes: [withExperience] }), /\*\*Trải nghiệm người chơi\*\*[\s\S]*Căng thẳng nhưng công bằng/);
});

test("delivery chuẩn hóa dữ liệu card, giữ deadline hợp lệ và xuất Markdown", () => {
  assert.deepEqual(emptyDelivery(), { milestone: "", assignee: "", deadline: "", blocker: "", blockerLevel: "none" });
  assert.deepEqual(normalizeDelivery({ milestone: " Vertical slice ", assignee: " Linh ", deadline: "2026-09-15", blocker: " Chờ animation ", blockerLevel: "blocked" }), { milestone: "Vertical slice", assignee: "Linh", deadline: "2026-09-15", blocker: "Chờ animation", blockerLevel: "blocked" });
  assert.equal(normalizeDelivery({ deadline: "15/09/2026", blockerLevel: "bad" }).deadline, "");
  assert.equal(normalizeDelivery({ deadline: "15/09/2026", blockerLevel: "bad" }).blockerLevel, "none");
  assert.equal(hasDelivery({ milestone: "Vertical slice" }), true); assert.equal(hasDelivery(null), false);
  assert.deepEqual(createGameDesignNode(1, 0, 0).design.delivery, emptyDelivery());
  const md = gameDesignMarkdown({ name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: { delivery: { milestone: "Vertical slice", assignee: "Linh", deadline: "2026-09-15", blocker: "Chờ animation", blockerLevel: "blocked" } } }] });
  assert.match(md, /\*\*Delivery\*\*/); assert.match(md, /\*\*Milestone:\*\* Vertical slice/); assert.match(md, /\*\*Blocker:\*\* Chờ animation/);
});

test("analytics events chuẩn hóa, preview badge và xuất Markdown", () => {
  const value = [{ id: " event-1 ", eventName: " dash_used ", trigger: "Khi dash thành công", properties: "distance, stamina", kpi: "Dùng dash / session", owner: "Linh" }, { id: "bad", eventName: " " }];
  assert.deepEqual(normalizeAnalyticsEvents(value), [{ id: "event-1", eventName: "dash_used", trigger: "Khi dash thành công", properties: "distance, stamina", kpi: "Dùng dash / session", owner: "Linh" }]);
  const node = { id: 1, title: "Dash", type: "mechanic", design: { analyticsEvents: value } };
  assert.equal(gameDesignPreview(node).some((item) => item.label === "Analytics"), true);
  assert.match(gameDesignMarkdown({ name: "Combat", nodes: [node] }), /\*\*Analytics events\*\*[\s\S]*dash_used[\s\S]*Trigger: Khi dash thành công/);
});

test("A/B test hypothesis chuẩn hóa, báo running và xuất Markdown", () => {
  const tests = normalizeABTests([{ id: " ab-1 ", hypothesis: " Giảm cooldown tăng dùng dash ", control: "1.0s", variant: "0.7s", primaryMetric: "dash_used/session", successCriteria: "+5% không giảm retention", segment: "Người chơi mới", status: "running" }, { id: "bad", hypothesis: " " }]);
  assert.deepEqual(tests, [{ id: "ab-1", hypothesis: "Giảm cooldown tăng dùng dash", control: "1.0s", variant: "0.7s", primaryMetric: "dash_used/session", successCriteria: "+5% không giảm retention", segment: "Người chơi mới", status: "running" }]);
  assert.deepEqual(abTestProgress({ design: { abTests: tests } }), { total: 1, running: 1 });
  const node = { id: 1, title: "Dash", type: "mechanic", design: { abTests: tests } };
  assert.equal(gameDesignPreview(node).some((item) => item.label === "A/B test"), true);
  assert.match(gameDesignMarkdown({ name: "Combat", nodes: [node] }), /\*\*A\/B test hypotheses\*\*[\s\S]*Giảm cooldown tăng dùng dash[\s\S]*Control: 1.0s[\s\S]*Status: Running/);
});

test("live ops chuẩn hóa rollout, preview badge và xuất Markdown", () => {
  const liveOps = normalizeLiveOps({ tuningNotes: " Giảm cooldown Dash từ 1.0s xuống 0.7s ", version: " 1.4.0 ", featureFlag: " dash_cooldown_v2 ", rolloutPercent: " 25 ", audience: " Người chơi mới ", status: "running", rollbackPlan: " Tắt flag và trả 1.0s " });
  assert.deepEqual(liveOps, { tuningNotes: "Giảm cooldown Dash từ 1.0s xuống 0.7s", version: "1.4.0", featureFlag: "dash_cooldown_v2", rolloutPercent: "25", audience: "Người chơi mới", status: "running", rollbackPlan: "Tắt flag và trả 1.0s" });
  assert.equal(hasLiveOps(liveOps), true); assert.deepEqual(emptyLiveOps(), { tuningNotes: "", version: "", featureFlag: "", rolloutPercent: "", audience: "", status: "planned", rollbackPlan: "" });
  assert.equal(normalizeLiveOps({ rolloutPercent: "101", status: "unknown" }).rolloutPercent, "");
  const node = { id: 1, title: "Dash", type: "mechanic", design: { liveOps } };
  assert.equal(gameDesignPreview(node).some((item) => item.label === "Live ops"), true);
  assert.match(gameDesignMarkdown({ name: "Combat", nodes: [node] }), /\*\*Live tuning & rollout\*\*[\s\S]*\*\*Feature flag:\*\* dash_cooldown_v2[\s\S]*\*\*Rollout:\*\* 25%[\s\S]*\*\*Status:\*\* Running/);
});

test("post-launch review chuẩn hóa reference, preview badge và xuất Markdown", () => {
  const review = normalizePostLaunchReview({ outcome: " Tăng retention D1 ", actualMetrics: " D1 +4%, crash ổn định ", learnings: " Onboarding mới hiệu quả ", nextDecision: " Giữ rollout và tune quest 2 ", owner: " Linh ", reviewDate: "2026-08-13", status: "needs-iteration", cardIds: [2, "gone"] }, [{ id: 2 }]);
  assert.deepEqual(review, { outcome: "Tăng retention D1", actualMetrics: "D1 +4%, crash ổn định", learnings: "Onboarding mới hiệu quả", nextDecision: "Giữ rollout và tune quest 2", owner: "Linh", reviewDate: "2026-08-13", status: "needs-iteration", cardIds: ["2"] });
  assert.deepEqual(emptyPostLaunchReview(), { outcome: "", actualMetrics: "", learnings: "", nextDecision: "", owner: "", reviewDate: "", status: "pending", cardIds: [] });
  assert.equal(hasPostLaunchReview(review), true);
  const node = { id: 1, title: "Dash", type: "mechanic", design: { postLaunchReview: review } };
  assert.equal(gameDesignPreview(node).some((item) => item.label === "Post-launch"), true);
  assert.match(gameDesignMarkdown({ name: "Combat", nodes: [node, { id: 2, title: "Quest 2", type: "quest-level", design: {} }] }), /\*\*Post-launch review\*\*[\s\S]*\*\*Status:\*\* Needs iteration[\s\S]*\*\*Related cards:\*\* Quest 2/);
});

test("export package có version ổn định và Markdown ghi version", () => {
  const board = { name: "Combat", kind: "game-design", updatedAt: "2026-08-13T10:20:30.000Z", nodes: [] };
  assert.equal(exportVersion(board), "2026-08-13T10:20:30.000Z");
  assert.deepEqual(exportPackage(board, "2026-08-13T12:00:00.000Z"), { format: "game-design-board-export/v1", exportedAt: "2026-08-13T12:00:00.000Z", boardName: "Combat", boardKind: "game-design", version: "2026-08-13T10:20:30.000Z", board });
  assert.match(gameDesignMarkdown(board), /\*\*Export version:\*\* 2026-08-13T10:20:30.000Z/);
});

test("report scope chỉ lấy đúng card theo mục đích và report có marker", () => {
  const board = {
    name: "Combat", updatedAt: "2026-08-15T10:00:00.000Z", nodes: [
      { id: 1, title: "Dash", type: "mechanic", design: { decisionLog: [{ decision: "Giữ i-frame" }], delivery: { milestone: "Slice" } } },
      { id: 2, title: "Arena", type: "quest-level", design: {} },
      { id: 3, title: "PT 01", type: "playtest", design: { playtestSession: { objective: "Dash" } } },
      { id: 4, title: "Potion", type: "skill-item", design: {} }
    ], edges: [], gameDesignBalance: { metrics: [{ key: "damage", name: "Damage", value: "10", cardIds: ["1"] }] }
  };
  assert.deepEqual(gameDesignReportNodeIds(board, "mechanics"), [1, 4]);
  assert.deepEqual(gameDesignReportNodeIds(board, "level-economy"), [1, 2]);
  assert.deepEqual(gameDesignReportNodeIds(board, "playtest-decisions"), [1, 3]);
  assert.match(gameDesignReport(board, "playtest-decisions"), /<!-- Report: playtest-decisions -->[\s\S]*Dash[\s\S]*PT 01/);
});

test("tạo nhanh card GD liên quan đặt cạnh nguồn và có dây relation", () => {
  const board = { nextNodeId: 8, nextEdgeId: 4, nodes: [{ id: 7, x: 100, y: 200 }], edges: [] };
  const next = createRelatedGameDesignCard(board, 7, "ui-ux", "unlocks");
  assert.equal(next.nodes.at(-1).id, 8); assert.equal(next.nodes.at(-1).type, "ui-ux");
  assert.deepEqual(next.edges.at(-1), { id: 4, from: 7, fromKind: "node", to: 8, toKind: "node", relation: "unlocks" });
  assert.equal(next.nextNodeId, 9); assert.equal(next.nextEdgeId, 5);
});

test("nhân bản card GD giữ spec độc lập nhưng bỏ workflow và dây nối", () => {
  const board = { nextNodeId: 8, nextEdgeId: 4, nodes: [{ id: 7, title: "Dash", desc: "Lướt né", type: "mechanic", tagId: 3, statusId: 5, x: 100, y: 200, design: { goal: "Né đòn", acceptanceCriteria: [{ id: "ac-1", text: "Có i-frame", done: false }], delivery: { milestone: "Slice" } } }], edges: [{ id: 3, from: 7, to: 2 }] };
  const next = duplicateGameDesignCard(board, 7);
  const copy = next.nodes.at(-1);
  assert.equal(copy.id, 8); assert.equal(copy.title, "Dash — bản sao"); assert.equal(copy.x, 400); assert.equal(copy.y, 200);
  assert.equal(copy.statusId, null); assert.equal(copy.tagId, null); assert.equal(next.edges.length, 1); assert.equal(next.nextNodeId, 9);
  assert.deepEqual(copy.design, board.nodes[0].design);
  copy.design.acceptanceCriteria[0].text = "Đã sửa";
  assert.equal(board.nodes[0].design.acceptanceCriteria[0].text, "Có i-frame");
  assert.equal(duplicateGameDesignCard(board, 99), board);
});

test("decision timeline gom toàn board, sắp ngày giảm dần và giữ item chưa có ngày", () => {
  const items = decisionTimeline([
    { id: 1, title: "Dash", design: { decisionLog: [{ id: "d1", decision: "Giữ cooldown", owner: "Linh", date: "2026-08-10", status: "active" }, { id: "d2", decision: "Thử lại", date: "không rõ" }] } },
    { id: 2, title: "Quest", design: { decisionLog: [{ id: "d3", decision: "Tăng reward", evidence: "Playtest 04", date: "2026-08-12", status: "replaced" }] } }
  ]);
  assert.deepEqual(items.map((item) => [item.cardId, item.decisionId, item.date]), [["2", "d3", "2026-08-12"], ["1", "d1", "2026-08-10"], ["1", "d2", "không rõ"]]);
  assert.equal(items[0].cardTitle, "Quest"); assert.equal(items[0].status, "replaced"); assert.equal(items[0].evidence, "Playtest 04");
});

test("follow-up task chuẩn hóa, tính tiến độ và xuất checkbox Markdown", () => {
  const tasks = normalizeFollowUpTasks([{ id: " f-1 ", text: " Sửa cooldown ", owner: " Linh ", deadline: "2026-09-15", done: true, cardIds: [2, "gone"] }, { id: "f-2", text: " " }], [{ id: 2 }]);
  assert.deepEqual(tasks, [{ id: "f-1", text: "Sửa cooldown", owner: "Linh", deadline: "2026-09-15", done: true, cardIds: ["2"] }]);
  assert.deepEqual(followUpProgress({ design: { followUpTasks: [{ id: "a", text: "A", done: true }, { id: "b", text: "B", done: false }] } }), { done: 1, total: 2 });
  assert.match(gameDesignMarkdown({ name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: { followUpTasks: tasks } }, { id: 2, title: "Playtest", type: "playtest", design: {} }] }), /\*\*Follow-up tasks\*\*[\s\S]*- \[x\] Sửa cooldown — Owner: Linh · Deadline: 2026-09-15 · Cards: Playtest/);
});

test("team handoff luôn đủ ba team, trim text và fallback status", () => {
  assert.deepEqual(normalizeTeamHandoff(null), emptyTeamHandoff());
  assert.deepEqual(normalizeTeamHandoff({ dev: { status: "ready", owner: " Linh ", handedOffAt: " 2026-08-12 ", notes: " Làm event ", ignored: "x" }, art: { status: "bad", brief: " Icon dash " } }), {
    dev: { status: "ready", owner: "Linh", handedOffAt: "2026-08-12", notes: "Làm event" },
    art: { status: "draft", owner: "", handedOffAt: "", brief: "Icon dash", requirements: "", references: "", format: "", naming: "" },
    audio: { status: "draft", owner: "", handedOffAt: "", brief: "", requirements: "", references: "", format: "", naming: "" }
  });
  assert.deepEqual(createGameDesignNode(1, 0, 0).design.teamHandoff, emptyTeamHandoff());
});

test("Markdown handoff chỉ xuất thông tin của team đích", () => {
  const board = { name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: { technicalNotes: "Gửi dash_used", teamHandoff: { dev: { status: "ready", owner: "Nam", handedOffAt: "", notes: "Làm state machine" }, art: { status: "handed-off", owner: "Hoa", handedOffAt: "2026-08-12", brief: "Icon dash", requirements: "3 frame", references: "ref.png", format: "PNG", naming: "ui_dash" }, audio: { status: "draft", owner: "", handedOffAt: "", brief: "Whoosh", requirements: "0.3s", references: "", format: "WAV", naming: "sfx_dash" } } } }] };
  const dev = gameDesignMarkdown(board, { team: "dev" });
  const art = gameDesignMarkdown(board, { team: "art" });
  const audio = gameDesignMarkdown(board, { team: "audio" });
  assert.match(dev, /Technical notes[\s\S]*Gửi dash_used/); assert.match(dev, /Dev handoff[\s\S]*Làm state machine/); assert.doesNotMatch(dev, /Icon dash|Whoosh/);
  assert.match(art, /Art handoff[\s\S]*Icon dash/); assert.match(art, /Đã bàn giao/); assert.doesNotMatch(art, /Technical notes|Whoosh/);
  assert.match(audio, /Audio handoff[\s\S]*Whoosh/); assert.doesNotMatch(audio, /Icon dash|Technical notes/);
});

test("chuẩn hóa Playtest session và Decision log, chỉ giữ card còn tồn tại", () => {
  assert.deepEqual(emptyPlaytestSession(), { objective: "", hypothesis: "", buildVersion: "", playerGroup: "", testDate: "", observations: "", metrics: "", playerFeedback: "", problemsFound: "", cardIds: [] });
  assert.deepEqual(normalizePlaytestSession({ objective: " Kiểm dash ", cardIds: [1, "2", 1, "gone"] }, [{ id: 1 }, { id: 2 }]), { objective: "Kiểm dash", hypothesis: "", buildVersion: "", playerGroup: "", testDate: "", observations: "", metrics: "", playerFeedback: "", problemsFound: "", cardIds: ["1", "2"] });
  assert.equal(hasPlaytestSession(null), false);
  assert.deepEqual(emptyDecisionLog(), []);
  assert.deepEqual(normalizeDecisionLog([{ decision: " ", cardIds: ["1"] }, { id: "d-2", decision: " Giảm cooldown ", status: "replaced", owner: " GD ", cardIds: ["2", "gone", "2"] }], [{ id: 2 }]), [{ id: "d-2", decision: "Giảm cooldown", rationale: "", evidence: "", alternatives: "", owner: "GD", date: "", status: "replaced", cardIds: ["2"] }]);
});

test("Markdown xuất evidence Playtest và Decision log", () => {
  const md = gameDesignMarkdown({ name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: { decisionLog: [{ id: "d-1", decision: "Giảm cooldown", rationale: "Test cho thấy chậm", evidence: "PT-01", alternatives: "Giữ nguyên", owner: "Linh", date: "2026-08-12", status: "active", cardIds: ["2"] }] } }, { id: 2, title: "Playtest 01", type: "playtest", design: { playtestSession: { objective: "Kiểm combat", hypothesis: "Dash nhanh hơn", buildVersion: "0.3.1", playerGroup: "5 tester", testDate: "2026-08-12", observations: "Người chơi chờ", metrics: "Completion 60%", playerFeedback: "Muốn dash nhanh", problemsFound: "Cooldown dài", cardIds: ["1"] } } }] });
  assert.match(md, /\*\*Playtest session\*\*/);
  assert.match(md, /\*\*Objective:\*\* Kiểm combat/);
  assert.match(md, /\*\*Related cards:\*\* Dash/);
  assert.match(md, /\*\*Decision log\*\*/);
  assert.match(md, /\*\*Giảm cooldown\*\* — Status: Active/);
  assert.match(md, /Related cards: Playtest 01/);
});

test("Balance sheet chuẩn hóa, tính công thức không dùng eval và xuất Markdown", () => {
  assert.deepEqual(emptyGameDesignBalance(), { metrics: [], curves: [] });
  assert.deepEqual(normalizeGameDesignBalance({ metrics: [{ key: " Damage! ", name: " Sát thương ", value: "10", cardIds: [1, "gone"] }, { key: "damage", name: "Trùng", value: "2", cardIds: [] }] }, [{ id: 1 }]), { metrics: [{ id: "metric-1", key: "damage", name: "Sát thương", value: "10", min: "", max: "", unit: "", formula: "", cardIds: ["1"] }], curves: [] });
  assert.deepEqual(evaluateBalanceFormula("damage * 1.2 + 2", { damage: 10 }), { value: 14, error: "" });
  assert.match(evaluateBalanceFormula("damage; alert(1)", { damage: 10 }).error, /chỉ nhận/);
  const md = gameDesignMarkdown({ name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: {} }], gameDesignBalance: { metrics: [{ id: "m-1", key: "damage", name: "Sát thương", value: "10", min: "1", max: "20", unit: "HP", formula: "damage * 1.2", cardIds: ["1"] }] } });
  assert.match(md, /## Balance Sheet/); assert.match(md, /\*\*Sát thương\*\* \(damage\): 12/); assert.match(md, /Cards: Dash/);
});

test("Progression curve chuẩn hóa, tạo bảng linear/exponential và được xuất", () => {
  const balance = normalizeGameDesignBalance({ metrics: [{ id: "m-1", key: "xp", name: "XP", value: "", min: "", max: "", unit: "XP", formula: "", cardIds: [] }], curves: [{ id: "c-1", name: " Level XP ", metricKey: "XP!", start: "100", end: "500", steps: "3", mode: "linear" }] });
  assert.deepEqual(balance.curves, [{ id: "c-1", name: "Level XP", metricKey: "xp", start: "100", end: "500", steps: 3, mode: "linear" }]);
  assert.deepEqual(balanceCurveTable(balance.curves[0]), { rows: [{ step: 1, value: 100 }, { step: 2, value: 300 }, { step: 3, value: 500 }], error: "" });
  assert.deepEqual(balanceCurveTable({ start: "10", end: "90", steps: 3, mode: "exponential" }).rows.map((row) => row.value), [10, 30, 90]);
  assert.match(balanceCurveTable({ start: "0", end: "90", steps: 3, mode: "exponential" }).error, /lớn hơn 0/);
  assert.match(gameDesignMarkdown({ name: "Progression", nodes: [], gameDesignBalance: balance }), /Progression Curves/);
});

test("balanceMetricsForCard chỉ trả metric gắn với card đích", () => {
  const balance = { metrics: [{ id: "m-1", key: "damage", name: "Damage", value: "10", min: "", max: "", unit: "HP", formula: "", cardIds: ["1"] }, { id: "m-2", key: "cooldown", name: "Cooldown", value: "1", min: "", max: "", unit: "s", formula: "", cardIds: ["2", "1"] }] };
  assert.deepEqual(balanceMetricsForCard(balance, 1).map((item) => item.key), ["damage", "cooldown"]);
  assert.deepEqual(balanceMetricsForCard(balance, 3).map((item) => item.key), []);
});

test("template Balance thêm metric còn thiếu và warning chỉ báo tuning bất thường", () => {
  assert.deepEqual(BALANCE_TEMPLATES.map((item) => item.id), ["combat", "xp-level", "drop-rate", "currency-flow"]);
  const next = appendBalanceTemplate({ metrics: [{ id: "old", key: "level", name: "Level cũ", value: "2", min: "", max: "", unit: "", formula: "", cardIds: [] }] }, "xp-level", []);
  assert.equal(next.metrics.filter((item) => item.key === "level").length, 1);
  assert.deepEqual(next.metrics.map((item) => item.key), ["level", "xp_to_next", "xp_reward"]);
  assert.deepEqual(balanceWarnings({ key: "rare_rate", value: "120", min: "0", max: "100", unit: "%", formula: "" }), ["Kết quả vượt tối đa (100).", "Drop rate nên nằm trong khoảng 0–100%."]);
  assert.deepEqual(balanceWarnings({ key: "damage", value: "10", min: "20", max: "5", unit: "HP", formula: "" }), ["Tối thiểu đang lớn hơn tối đa.", "Kết quả thấp hơn tối thiểu (20).", "Kết quả vượt tối đa (5)."]);
  assert.deepEqual(balanceWarnings({ key: "dps", value: "", min: "0", max: "10", unit: "HP/s", formula: "damage / cooldown" }, { damage: 100, cooldown: 2 }), ["Kết quả vượt tối đa (10)."]);
});

test("review chuẩn hóa, preview và Markdown chỉ giữ comment chưa resolve", () => {
  assert.deepEqual(normalizeReview(null), emptyReview());
  const review = normalizeReview({ reviewer: " Linh ", date: " 2026-08-12 ", outcome: "changes-requested", comments: [{ text: " Sửa cooldown ", author: " GD ", resolved: false }, { text: "Đã xong", resolved: true }] });
  assert.equal(review.comments[0].text, "Sửa cooldown"); assert.equal(review.comments[1].resolved, true);
  const md = gameDesignMarkdown({ name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: { review } }] });
  assert.match(md, /\*\*Outcome:\*\* changes-requested/); assert.match(md, /Sửa cooldown/); assert.doesNotMatch(md, /Đã xong/);
  assert.equal(gameDesignPreview({ type: "mechanic", design: { review: { outcome: "approved" } } })[0].value, "Approved");
});

test("dependency analysis chỉ theo depends-on, báo blocker và vòng lặp", () => {
  const board = { nodes: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], statuses: [{ id: 9, name: "Done" }], edges: [{ id: 1, from: 1, to: 2, relation: "depends-on" }, { id: 2, from: 2, to: 3, relation: "depends-on" }, { id: 3, from: 3, to: 1, relation: "depends-on" }, { id: 4, from: 4, to: 1, relation: "unlocks" }] };
  const analysis = dependencyAnalysis(board);
  assert.deepEqual(analysis.chainFrom(1), ["1", "2", "3"]);
  assert.equal(analysis.blockedNodeIds.has("1"), true); assert.equal(analysis.blockedNodeIds.has("4"), false);
  assert.deepEqual([...analysis.cycleEdgeIds], [1, 2, 3]); assert.equal(analysis.cycleNodeIds.has("2"), true);
  const done = dependencyAnalysis({ ...board, nodes: [{ id: 1, statusId: 9 }, { id: 2, statusId: 9 }], edges: [{ id: 1, from: 1, to: 2, relation: "depends-on" }] });
  assert.equal(done.blockedNodeIds.size, 0);
});

test("dependency impact đi hết hai chiều và chỉ báo milestone/delivery risk downstream", () => {
  const board = { statuses: [{ id: 1, name: "Done" }], nodes: [
    { id: 1, design: {} }, { id: 2, design: {} },
    { id: 3, design: { delivery: { milestone: "Vertical slice", blocker: "Waiting art", blockerLevel: "blocked", deadline: "2020-01-01" } } },
    { id: 4, statusId: 1, design: { delivery: { milestone: "Launch", blocker: "", blockerLevel: "none", deadline: "" } } }
  ], edges: [{ from: 2, to: 1, relation: "depends-on" }, { from: 3, to: 2, relation: "depends-on" }, { from: 4, to: 3, relation: "depends-on" }] };
  const impact = dependencyImpact(board, 2);
  assert.deepEqual(impact.upstreamIds, ["1"]);
  assert.deepEqual(impact.downstreamIds, ["3", "4"]);
  assert.deepEqual(impact.milestoneIds, ["3", "4"]);
  assert.deepEqual(impact.riskIds, ["3", "4"]);
  assert.deepEqual(dependencyImpact(board, "missing"), { rootId: "missing", upstreamIds: [], downstreamIds: [], milestoneIds: [], riskIds: [], hasCycle: false });
});

test("playtest comparison chỉ lấy session có dữ liệu và xếp ngày mới trước", () => {
  const rows = playtestComparison([{ id: 1, title: "Old", type: "playtest", design: { playtestSession: { objective: "A", testDate: "2026-01-01" } } }, { id: 2, title: "New", type: "playtest", design: { playtestSession: { objective: "B", testDate: "2026-02-01" } } }, { id: 3, type: "playtest", design: {} }]);
  assert.deepEqual(rows.map((row) => row.title), ["New", "Old"]);
});

test("Markdown chỉ xuất section details có dữ liệu", () => {
  const md = gameDesignMarkdown({ name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: {
    examples: [{ id: "example-1", title: "Đánh trúng", scenario: "Bấm đánh", expectedResult: "Gây damage" }],
    failureStates: [{ id: "failure-1", condition: "Hết stamina", playerFeedback: "Nút mờ", recovery: "Chờ hồi" }],
    tuningParameters: [{ id: "tuning-1", name: "Cooldown", defaultValue: "0.5", min: "0.1", max: "2", unit: "s", note: "Theo vũ khí" }]
  } }] });
  assert.match(md, /\*\*Examples\*\*/);
  assert.match(md, /\*\*Failure states\*\*/);
  assert.match(md, /\*\*Tuning parameters\*\*/);
  assert.match(md, /\*\*Cooldown\*\* — Default: 0.5 · Min: 0.1 · Max: 2 · Unit: s · Theo vũ khí/);
});

test("Markdown handoff lọc card và chỉ giữ dependency nội bộ", () => {
  const board = { name: "Combat", nodes: [
    { id: 1, title: "Dash", type: "mechanic", design: { technicalNotes: " Gửi event dash_used " } },
    { id: 2, title: "Stamina", type: "mechanic", design: {} },
    { id: 3, title: "Boss", type: "mechanic", design: {} }
  ], edges: [{ id: 1, from: 1, to: 2, relation: "depends-on" }, { id: 2, from: 1, to: 3, relation: "unlocks" }] };
  const md = gameDesignMarkdown(board, { nodeIds: [1, 2] });
  assert.match(md, /### Dash/);
  assert.match(md, /### Stamina/);
  assert.doesNotMatch(md, /### Boss/);
  assert.match(md, /\*\*Technical notes\*\*[\s\S]*Gửi event dash_used/);
  assert.match(md, /Dash — Phụ thuộc → Stamina/);
  assert.doesNotMatch(md, /Boss/);
});

test("Markdown handoff theo loại card chỉ giữ relation nội bộ", () => {
  const board = { name: "Combat", nodes: [{ id: 1, title: "Dash", type: "mechanic", design: {} }, { id: 2, title: "HUD", type: "ui-ux", design: {} }, { id: 3, title: "Stamina", type: "mechanic", design: {} }], edges: [{ id: 1, from: 1, to: 3, relation: "depends-on" }, { id: 2, from: 1, to: 2, relation: "unlocks" }] };
  const md = gameDesignMarkdown(board, { nodeIds: [1, 3] });
  assert.match(md, /### Dash/); assert.match(md, /### Stamina/); assert.doesNotMatch(md, /### HUD/);
  assert.match(md, /Dash — Phụ thuộc → Stamina/); assert.doesNotMatch(md, /HUD/);
});

test("tạo node Game Design có type và các field spec", () => {
  const node = createGameDesignNode(4, 10, 20, "mechanic");
  assert.equal(node.id, 4);
  assert.equal(node.type, "mechanic");
  assert.equal(node.design.priority, "medium");
  assert.deepEqual(node.design.acceptanceCriteria, []);
});

test("chuẩn hóa acceptance criteria legacy thành một checklist chưa tick", () => {
  assert.deepEqual(normalizeAcceptanceCriteria("Có cooldown"), [
    { id: "ac-legacy-1", text: "Có cooldown", done: false }
  ]);
  assert.deepEqual(normalizeAcceptanceCriteria([
    { id: "ac-1", text: " A ", done: 1 },
    { id: "ac-2", text: "", done: true }
  ]), [{ id: "ac-1", text: "A", done: false }]);
});

test("tính tiến độ checklist và fallback relation", () => {
  assert.deepEqual(acceptanceProgress({ design: { acceptanceCriteria: [
    { id: "ac-1", text: "A", done: true }, { id: "ac-2", text: "B", done: false }
  ] } }), { done: 1, total: 2 });
  assert.equal(relationDefinition("unknown").id, "depends-on");
});

test("type lạ rơi về template mechanic", () => {
  assert.equal(gameDesignType("unknown").id, "mechanic");
});

test("xuất Markdown Game Design theo template", () => {
  const md = gameDesignMarkdown({ name: "Combat", nodes: [{ id: 1, title: "Đánh", type: "mechanic", desc: "Mô tả", design: { goal: "Tạo quyết định", rules: "Cooldown", acceptanceCriteria: [{ id: "ac-1", text: "Có cooldown", done: true }] } }, { id: 2, title: "Stamina", type: "mechanic", design: {} }], edges: [{ id: 1, from: 1, to: 2, relation: "depends-on" }] });
  assert.match(md, /# Combat/);
  assert.match(md, /Mechanic \/ System/);
  assert.match(md, /Mục tiêu người chơi/);
  assert.match(md, /Cooldown/);
  assert.match(md, /- \[x\] Có cooldown/);
  assert.match(md, /Phụ thuộc/);
});

test("preview chỉ hiện các field đã điền, có giới hạn để canvas không phình", () => {
  const preview = gameDesignPreview({ type: "mechanic", design: { goal: "Mục tiêu", inputs: "Bấm A", rules: "Cooldown", outputs: "Thưởng" } });
  assert.deepEqual(preview.map((item) => item.field), ["goal", "inputs", "rules"]);
});

test("preview không biến checklist thành object text", () => {
  const preview = gameDesignPreview({ type: "mechanic", design: { goal: "Mục tiêu", acceptanceCriteria: [{ id: "a", text: "x", done: false }] } });
  assert.equal(preview.some((item) => item.value.includes("[object Object]")), false);
});
