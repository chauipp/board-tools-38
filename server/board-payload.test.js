import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBoardPayload, normalizeGameDesignFlow, resolveGameDesignFields, BOARD_LIMITS } from "./board-payload.js";

// Hình dạng gần đúng một cú autosave thật.
const good = () => ({
  nodes: [
    { id: 1, x: 10, y: 20, w: 260, title: "Ý tưởng", desc: "vài dòng" },
    { id: 2, x: 400, y: 20, w: 420, pdfH: 500, pdf: { fileId: "a.pdf", name: "a", size: 10 } }
  ],
  edges: [{ id: 1, from: 1, to: 2 }],
  groups: [{ id: 1, x: 0, y: 0, w: 900, h: 600 }],
  drawings: [{ id: 1, kind: "pen", pts: [0, 0, 10, 10, 20, 25] }],
  statuses: [{ id: 1, name: "Ý tưởng mới", color: "st-idea" }],
  tags: [],
  palette: [],
  nextNodeId: 3, nextEdgeId: 2, nextGroupId: 2,
  nextStatusId: 2, nextTagId: 1, nextPaletteId: 1, nextDrawingId: 2
});

test("payload autosave bình thường đi qua", () => {
  assert.equal(validateBoardPayload(good()), null);
});

test("brief Game Design hợp lệ đi qua, payload không có brief vẫn tương thích", () => {
  const body = {
    ...good(),
    kind: "game-design",
    gameDesignBrief: {
      genre: "Roguelite",
      targetAudience: "Người chơi thích mastery",
      playerFantasy: "Thợ săn linh hoạt",
      playerJourney: [{ id: "journey-1", title: "Khám phá", experience: "Thử build", emotion: "Tò mò" }]
    }
  };
  assert.equal(validateBoardPayload(body), null);
  assert.equal(validateBoardPayload({ ...good(), kind: "game-design", gameDesignBrief: null }), null);
  assert.equal(validateBoardPayload({ ...good(), kind: "game-design" }), null);
});

test("brief Game Design sai hình dạng hoặc vượt giới hạn bị chặn", () => {
  const body = { ...good(), gameDesignBrief: [] };
  assert.match(validateBoardPayload(body), /gameDesignBrief/);

  body.gameDesignBrief = {
    genre: "", targetAudience: "", playerFantasy: "",
    playerJourney: [{ id: 1, title: "Khám phá", experience: "", emotion: "" }]
  };
  assert.match(validateBoardPayload(body), /playerJourney\.id/);
  body.gameDesignBrief.playerJourney[0].id = "journey-1";
  body.gameDesignBrief.playerJourney[0].title = 2;
  assert.match(validateBoardPayload(body), /playerJourney\.title/);
  body.gameDesignBrief.playerJourney = Array.from({ length: 51 }, (_, index) => ({
    id: `journey-${index}`, title: "Stage", experience: "", emotion: ""
  }));
  assert.match(validateBoardPayload(body), /playerJourney/);
});

test("Game Flow hợp lệ đi qua, board GD cũ thiếu flow vẫn tương thích", () => {
  const body = {
    ...good(),
    kind: "game-design",
    gameDesignFlow: {
      playerLoop: [{
        id: "loop-1", title: "Khám phá", action: "Chọn khu vực",
        outcome: "Nhận tài nguyên", note: "Mở build", cardIds: ["1"]
      }],
      progressionMap: [{
        id: "progression-1", title: "Early game", objective: "Học loop",
        unlocks: "Kỹ năng né", description: "Run đầu", emotion: "Tò mò", cardIds: ["2"]
      }]
    }
  };
  assert.equal(validateBoardPayload(body), null);
  assert.equal(validateBoardPayload({ ...good(), kind: "game-design" }), null);
  assert.equal(validateBoardPayload({ ...good(), kind: "game-design", gameDesignFlow: null }), null);
});

test("Game Flow không được lọt vào board idea khi PUT thiếu kind", () => {
  const flow = {
    playerLoop: [{ id: "loop-1", title: "Khám phá", action: "Chọn", outcome: "Nhận", note: "", cardIds: ["1"] }],
    progressionMap: []
  };
  assert.match(validateBoardPayload({ ...good(), gameDesignFlow: flow }, "idea"), /chỉ dùng cho board game-design/);
});

test("Game Flow sai item, vượt giới hạn và reference sai bị chặn", () => {
  const body = {
    ...good(),
    kind: "game-design",
    gameDesignFlow: {
      playerLoop: [{ id: "loop-1", title: "", action: "", outcome: "", note: "", cardIds: [] }],
      progressionMap: []
    }
  };
  assert.match(validateBoardPayload(body), /playerLoop\.title/);

  body.gameDesignFlow.playerLoop[0].title = "Hợp lệ";
  body.gameDesignFlow.playerLoop[0].cardIds = ["not-a-node"];
  assert.match(validateBoardPayload(body), /cardIds/);

  body.gameDesignFlow.playerLoop = Array.from({ length: 21 }, (_, index) => ({
    id: `loop-${index}`, title: "Loop", action: "", outcome: "", note: "", cardIds: []
  }));
  assert.match(validateBoardPayload(body), /playerLoop/);

  body.gameDesignFlow.playerLoop = [];
  body.gameDesignFlow.progressionMap = [{
    id: "progression-1", title: "Mốc", objective: "", unlocks: "", description: "", emotion: 1, cardIds: []
  }];
  assert.match(validateBoardPayload(body), /progressionMap\.emotion/);
});

test("Game Flow được trim trước khi ghi", () => {
  assert.deepEqual(normalizeGameDesignFlow({
    playerLoop: [{ id: " loop-1 ", title: " Khám phá ", action: " Chọn khu vực ", outcome: " Reward ", note: " Note ", cardIds: [" 1 "] }],
    progressionMap: [{ id: " progress-1 ", title: " Early ", objective: " Học ", unlocks: " Né ", description: " Run ", emotion: " Tò mò ", cardIds: [" 2 "] }]
  }), {
    playerLoop: [{ id: "loop-1", title: "Khám phá", action: "Chọn khu vực", outcome: "Reward", note: "Note", cardIds: ["1"] }],
    progressionMap: [{ id: "progress-1", title: "Early", objective: "Học", unlocks: "Né", description: "Run", emotion: "Tò mò", cardIds: ["2"] }]
  });
  assert.equal(normalizeGameDesignFlow(null), null);
});

test("Game Flow hỏng không làm normalize nổ trước khi validator trả 400", () => {
  const malformed = { playerLoop: [{ id: 1 }], progressionMap: [] };
  assert.doesNotThrow(() => normalizeGameDesignFlow(malformed));
  assert.match(validateBoardPayload({ ...good(), kind: "game-design", gameDesignFlow: normalizeGameDesignFlow(malformed) }), /gameDesignFlow/);
});

test("field GD bị bỏ qua trong PUT giữ nguyên dữ liệu cũ, null mới là xóa", () => {
  const current = {
    kind: "game-design",
    gameDesignBrief: { genre: "Roguelite" },
    gameDesignFlow: { playerLoop: [], progressionMap: [] },
    gameDesignBalance: null
  };
  assert.deepEqual(resolveGameDesignFields({}, current), current);
  assert.deepEqual(resolveGameDesignFields({ gameDesignFlow: null }, current), {
    ...current,
    gameDesignFlow: null
  });
});

test("payload Game Design có loại thẻ và phần spec đi qua", () => {
  const body = { ...good(), kind: "game-design", nodes: [{
    id: 1, x: 0, y: 0, title: "Combat", type: "mechanic",
    design: { goal: "Tạo quyết định", rules: "Đánh rồi né", acceptanceCriteria: "Có cooldown" }
  }] };
  assert.equal(validateBoardPayload(body), null);
});

test("player experience hợp lệ đi qua, sai kiểu hoặc quá dài bị chặn", () => {
  const body = { ...good(), kind: "game-design", nodes: [{ id: 1, x: 0, y: 0, title: "Combat", design: { playerExperience: "Căng thẳng công bằng" } }] };
  assert.equal(validateBoardPayload(body), null);
  body.nodes[0].design.playerExperience = 2; assert.match(validateBoardPayload(body), /playerExperience/);
  body.nodes[0].design.playerExperience = "x".repeat(2001); assert.match(validateBoardPayload(body), /playerExperience/);
});

test("delivery hợp lệ đi qua, ngày hoặc mức blocker hỏng bị chặn", () => {
  const body = { ...good(), kind: "game-design", nodes: [{ id: 1, x: 0, y: 0, title: "Combat", design: { delivery: { milestone: "Vertical slice", assignee: "Linh", deadline: "2026-09-15", blocker: "Chờ animation", blockerLevel: "blocked" } } }] };
  assert.equal(validateBoardPayload(body), null);
  body.nodes[0].design.delivery.deadline = "15/09/2026";
  assert.match(validateBoardPayload(body), /delivery\.deadline/);
  body.nodes[0].design.delivery.deadline = "2026-09-15"; body.nodes[0].design.delivery.blockerLevel = "urgent";
  assert.match(validateBoardPayload(body), /delivery\.blockerLevel/);
});

test("analytics events hợp lệ đi qua, event thiếu tên hoặc quá nhiều bị chặn", () => {
  const body = { ...good(), kind: "game-design", nodes: [{ id: 1, x: 0, y: 0, title: "Combat", design: { analyticsEvents: [{ id: "event-1", eventName: "dash_used", trigger: "Khi dash", properties: "distance", kpi: "Usage", owner: "Linh" }] } }] };
  assert.equal(validateBoardPayload(body), null);
  body.nodes[0].design.analyticsEvents[0].eventName = "";
  assert.match(validateBoardPayload(body), /analyticsEvents\.eventName/);
  body.nodes[0].design.analyticsEvents = Array.from({ length: 21 }, (_, index) => ({ id: `e-${index}`, eventName: "event", trigger: "", properties: "", kpi: "", owner: "" }));
  assert.match(validateBoardPayload(body), /analyticsEvents/);
});

test("A/B test hypothesis hợp lệ đi qua, hypothesis/status sai bị chặn", () => {
  const item = { id: "ab-1", hypothesis: "Variant tăng usage", control: "1.0s", variant: "0.7s", primaryMetric: "usage", successCriteria: "+5%", segment: "new", status: "running" };
  const body = { ...good(), kind: "game-design", nodes: [{ id: 1, x: 0, y: 0, title: "Combat", design: { abTests: [item] } }] };
  assert.equal(validateBoardPayload(body), null);
  item.hypothesis = ""; assert.match(validateBoardPayload(body), /abTests\.hypothesis/);
  item.hypothesis = "Variant tăng usage"; item.status = "live"; assert.match(validateBoardPayload(body), /abTests\.status/);
});

test("live ops hợp lệ đi qua, percent/status sai bị chặn", () => {
  const liveOps = { tuningNotes: "Giảm cooldown", version: "1.4.0", featureFlag: "dash_v2", rolloutPercent: "25", audience: "new", status: "running", rollbackPlan: "Tắt flag" };
  const body = { ...good(), kind: "game-design", nodes: [{ id: 1, x: 0, y: 0, title: "Dash", design: { liveOps } }] };
  assert.equal(validateBoardPayload(body), null);
  liveOps.rolloutPercent = "101"; assert.match(validateBoardPayload(body), /liveOps\.rolloutPercent/);
  liveOps.rolloutPercent = "25"; liveOps.status = "live"; assert.match(validateBoardPayload(body), /liveOps\.status/);
});

test("post-launch review hợp lệ đi qua, date/status/reference sai bị chặn", () => {
  const review = { outcome: "Tốt", actualMetrics: "D1 +4%", learnings: "Onboarding", nextDecision: "Giữ", owner: "Linh", reviewDate: "2026-08-13", status: "healthy", cardIds: ["2"] };
  const body = { ...good(), kind: "game-design", nodes: [{ id: 1, x: 0, y: 0, title: "Dash", design: { postLaunchReview: review } }, { id: 2, x: 1, y: 1, title: "Quest" }] };
  assert.equal(validateBoardPayload(body), null);
  review.reviewDate = "13/08/2026"; assert.match(validateBoardPayload(body), /postLaunchReview\.reviewDate/);
  review.reviewDate = "2026-08-13"; review.status = "good"; assert.match(validateBoardPayload(body), /postLaunchReview\.status/);
});

test("follow-up tasks hợp lệ đi qua, deadline/reference sai bị chặn", () => {
  const task = { id: "f-1", text: "Sửa cooldown", owner: "Linh", deadline: "2026-09-15", done: false, cardIds: ["2"] };
  const body = { ...good(), kind: "game-design", nodes: [{ id: 1, x: 0, y: 0, title: "Combat", design: { followUpTasks: [task] } }, { id: 2, x: 1, y: 1, title: "Playtest" }] };
  assert.equal(validateBoardPayload(body), null);
  task.deadline = "15/09/2026"; assert.match(validateBoardPayload(body), /followUpTasks\.deadline/);
  task.deadline = "2026-09-15"; task.cardIds = ["gone"]; assert.match(validateBoardPayload(body), /followUpTasks\.cardIds/);
});

test("Examples, Failure States và Tuning Parameters hợp lệ đi qua", () => {
  const body = { ...good(), kind: "game-design" };
  body.nodes[0].design = {
    examples: [{ id: "example-1", title: "Đánh trúng", scenario: "Bấm đánh gần địch", expectedResult: "Gây damage" }],
    failureStates: [{ id: "failure-1", condition: "Hết stamina", playerFeedback: "Nút mờ", recovery: "Chờ hồi" }],
    tuningParameters: [{ id: "tuning-1", name: "Cooldown", defaultValue: "0.5", min: "0.1", max: "2", unit: "s", note: "Theo vũ khí" }]
  };
  assert.equal(validateBoardPayload(body), null);
});

test("technicalNotes hợp lệ đi qua, sai kiểu hoặc quá dài bị chặn", () => {
  const valid = { ...good(), kind: "game-design" };
  valid.nodes[0].design = { technicalNotes: "Gửi event dash_used" };
  assert.equal(validateBoardPayload(valid), null);
  valid.nodes[0].design.technicalNotes = 3;
  assert.match(validateBoardPayload(valid), /technicalNotes/);
  valid.nodes[0].design.technicalNotes = "x".repeat(2001);
  assert.match(validateBoardPayload(valid), /technicalNotes/);
});

test("Team handoff hợp lệ đi qua, sai status hoặc field bị chặn", () => {
  const body = { ...good(), kind: "game-design" };
  body.nodes[0].design = { teamHandoff: {
    dev: { status: "ready", owner: "Nam", handedOffAt: "", notes: "Làm state" },
    art: { status: "handed-off", owner: "Hoa", handedOffAt: "2026-08-12", brief: "Icon", requirements: "PNG", references: "ref", format: "PNG", naming: "ui_dash" },
    audio: { status: "draft", owner: "", handedOffAt: "", brief: "Whoosh", requirements: "WAV", references: "", format: "WAV", naming: "sfx_dash" }
  } };
  assert.equal(validateBoardPayload(body), null);
  body.nodes[0].design.teamHandoff.dev.status = "sent";
  assert.match(validateBoardPayload(body), /teamHandoff\.dev\.status/);
  body.nodes[0].design.teamHandoff.dev.status = "draft";
  body.nodes[0].design.teamHandoff.art.format = 1;
  assert.match(validateBoardPayload(body), /teamHandoff\.art\.format/);
});

test("Review hợp lệ đi qua, outcome/comment sai bị chặn", () => {
  const body = { ...good(), kind: "game-design", nodes: [{ id: 1, design: { review: { reviewer: "Linh", date: "2026-08-12", outcome: "changes-requested", comments: [{ id: "c-1", text: "Sửa", author: "GD", resolved: false }] } } }] };
  assert.equal(validateBoardPayload(body), null); body.nodes[0].design.review.outcome = "approved-now"; assert.match(validateBoardPayload(body), /review metadata/);
  body.nodes[0].design.review.outcome = "approved"; body.nodes[0].design.review.comments[0].resolved = "yes"; assert.match(validateBoardPayload(body), /review.comment/);
});

test("Playtest session và Decision log hợp lệ đi qua", () => {
  const body = { ...good(), kind: "game-design" };
  body.nodes[0].design = {
    playtestSession: { objective: "Kiểm combat", hypothesis: "Dash tốt", buildVersion: "0.3", playerGroup: "5 tester", testDate: "2026-08-12", observations: "Chậm", metrics: "60%", playerFeedback: "Muốn nhanh", problemsFound: "Cooldown", cardIds: ["2"] },
    decisionLog: [{ id: "decision-1", decision: "Giảm cooldown", rationale: "Test", evidence: "PT-01", alternatives: "Giữ", owner: "GD", date: "2026-08-12", status: "active", cardIds: ["2"] }]
  };
  assert.equal(validateBoardPayload(body), null);
});

test("Playtest session và Decision log sai hình dạng bị chặn", () => {
  const body = { ...good(), kind: "game-design" };
  body.nodes[0].design = { playtestSession: { objective: "x", hypothesis: "", buildVersion: "", playerGroup: "", testDate: "", observations: "", metrics: "", playerFeedback: "", problemsFound: "", cardIds: ["gone"] } };
  assert.match(validateBoardPayload(body), /playtestSession\.cardIds/);
  body.nodes[0].design = { decisionLog: [{ id: "d-1", decision: "x", rationale: "", evidence: "", alternatives: "", owner: "", date: "", status: "obsolete", cardIds: [] }] };
  assert.match(validateBoardPayload(body), /decisionLog\.status/);
  body.nodes[0].design = { decisionLog: Array.from({ length: 31 }, (_, index) => ({ id: `d-${index}`, decision: "x", rationale: "", evidence: "", alternatives: "", owner: "", date: "", status: "active", cardIds: [] })) };
  assert.match(validateBoardPayload(body), /decisionLog/);
});

test("Balance sheet hợp lệ đi qua, sai key/reference bị chặn", () => {
  const body = { ...good(), kind: "game-design", gameDesignBalance: { metrics: [{ id: "metric-1", key: "damage", name: "Damage", value: "10", min: "1", max: "20", unit: "HP", formula: "damage * 1.2", cardIds: ["2"] }] } };
  assert.equal(validateBoardPayload(body), null);
  body.gameDesignBalance.metrics[0].key = "Damage!";
  assert.match(validateBoardPayload(body), /gameDesignBalance\.metric/);
  body.gameDesignBalance.metrics[0].key = "damage"; body.gameDesignBalance.metrics[0].cardIds = ["gone"];
  assert.match(validateBoardPayload(body), /gameDesignBalance\.cardIds/);
});

test("Balance progression curve hợp lệ đi qua, sai metric hoặc số mốc bị chặn", () => {
  const body = { ...good(), kind: "game-design", gameDesignBalance: { metrics: [{ id: "metric-1", key: "xp", name: "XP", value: "", min: "", max: "", unit: "XP", formula: "", cardIds: [] }], curves: [{ id: "curve-1", name: "XP level", metricKey: "xp", start: "100", end: "1000", steps: 10, mode: "exponential" }] } };
  assert.equal(validateBoardPayload(body), null);
  body.gameDesignBalance.curves[0].metricKey = "gone";
  assert.match(validateBoardPayload(body), /gameDesignBalance\.curve/);
  body.gameDesignBalance.curves[0].metricKey = "xp"; body.gameDesignBalance.curves[0].steps = 1;
  assert.match(validateBoardPayload(body), /gameDesignBalance\.curve/);
});

test("detail collections sai hình dạng hoặc vượt giới hạn bị chặn", () => {
  const body = { ...good(), kind: "game-design" };
  body.nodes[0].design = { examples: [{ id: "example-1", title: "", scenario: "", expectedResult: "" }] };
  assert.match(validateBoardPayload(body), /examples\.title/);
  body.nodes[0].design = { failureStates: [{ id: 1, condition: "Hết stamina", playerFeedback: "", recovery: "" }] };
  assert.match(validateBoardPayload(body), /failureStates\.id/);
  body.nodes[0].design = { tuningParameters: Array.from({ length: 31 }, (_, index) => ({ id: `t-${index}`, name: "Cooldown", defaultValue: "", min: "", max: "", unit: "", note: "" })) };
  assert.match(validateBoardPayload(body), /tuningParameters/);
});

test("checklist mới và relation hợp lệ đi qua, legacy string vẫn tương thích", () => {
  const body = good();
  body.kind = "game-design";
  body.nodes[0].design = { acceptanceCriteria: [{ id: "ac-1", text: "Có cooldown", done: false }] };
  body.edges[0].relation = "depends-on";
  assert.equal(validateBoardPayload(body), null);
  body.nodes[0].design.acceptanceCriteria = "Có cooldown";
  assert.equal(validateBoardPayload(body), null);
});

test("checklist sai hình dạng và relation lạ bị chặn", () => {
  const body = good();
  body.nodes[0].design = { acceptanceCriteria: [{ id: 3, text: "x", done: false }] };
  assert.match(validateBoardPayload(body), /acceptanceCriteria\.id/);
  body.nodes[0].design = { acceptanceCriteria: [{ id: "ac-1", text: "x", done: "yes" }] };
  assert.match(validateBoardPayload(body), /acceptanceCriteria\.done/);
  body.nodes[0].design = { acceptanceCriteria: [{ id: "ac-1", text: "x", done: false }] };
  body.edges[0].relation = "blocks";
  assert.match(validateBoardPayload(body), /relation/);
});

test("kind và design sai kiểu bị chặn", () => {
  assert.match(validateBoardPayload({ kind: "not-a-board" }), /kind/);
  assert.match(validateBoardPayload({ nodes: [{ id: 1, design: [] }] }), /design/);
});

// Đây là điều quan trọng nhất của cả file: chặn nhầm nghĩa là autosave hỏng và
// người ta mất bài đang vẽ. Payload thiếu field phải được coi là "không đổi
// phần này", không phải là lỗi.
test("thiếu field KHÔNG bị coi là lỗi", () => {
  assert.equal(validateBoardPayload({}), null);
  assert.equal(validateBoardPayload({ nodes: [] }), null);
  const partial = { nodes: [{ id: 1 }], nextNodeId: 2 };
  assert.equal(validateBoardPayload(partial), null);
});

test("thẻ không có toạ độ vẫn qua — không phải thẻ nào cũng có đủ field", () => {
  assert.equal(validateBoardPayload({ nodes: [{ id: 9, title: "chỉ có tiêu đề" }] }), null);
});

test("NaN và Infinity trong toạ độ bị chặn", () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const body = good();
    body.nodes[0].x = bad;
    assert.match(validateBoardPayload(body), /node\.x/, String(bad));
  }
});

// Mongo lưu NaN không kêu ca gì; hậu quả chỉ lộ ra lúc board được đọc lên và
// không vẽ được, lúc đó chẳng còn dấu vết nào chỉ ra cú ghi nào gây ra.
test("NaN trong toạ độ nét vẽ bị chặn", () => {
  const body = good();
  body.drawings[0].pts = [0, 0, NaN, 10];
  assert.match(validateBoardPayload(body), /nét vẽ/);
});

test("sai kiểu ở danh sách bị chặn", () => {
  for (const field of ["nodes", "edges", "groups", "drawings", "statuses", "tags", "palette"]) {
    const body = good();
    body[field] = "không phải mảng";
    assert.match(validateBoardPayload(body), new RegExp(field), field);
  }
});

test("phần tử không phải object bị chặn", () => {
  const body = good();
  body.nodes = [{ id: 1 }, "thẻ", null];
  assert.match(validateBoardPayload(body), /không phải object/);
});

test("vượt trần số lượng bị chặn, và đúng ngay tại trần thì vẫn qua", () => {
  const atLimit = { nodes: Array.from({ length: BOARD_LIMITS.nodes }, (_, i) => ({ id: i })) };
  assert.equal(validateBoardPayload(atLimit), null);
  const over = { nodes: Array.from({ length: BOARD_LIMITS.nodes + 1 }, (_, i) => ({ id: i })) };
  assert.match(validateBoardPayload(over), /vượt trần/);
});

// Đếm nét vẽ thôi thì không đủ: 10 nét, mỗi nét một triệu điểm, vẫn lọt.
test("tổng số điểm được cộng dồn qua mọi nét, không chỉ đếm số nét", () => {
  const per = 40_000;
  const count = Math.ceil(BOARD_LIMITS.totalDrawingPoints / per) + 1;
  const body = {
    drawings: Array.from({ length: count }, (_, i) => ({ id: i, pts: new Array(per).fill(1) }))
  };
  assert.match(validateBoardPayload(body), /tổng số điểm/);
});

test("tiêu đề và mô tả quá dài bị chặn", () => {
  const long = good();
  long.nodes[0].title = "x".repeat(BOARD_LIMITS.titleLen + 1);
  assert.match(validateBoardPayload(long), /tiêu đề/);

  const longDesc = good();
  longDesc.nodes[0].desc = "x".repeat(BOARD_LIMITS.descLen + 1);
  assert.match(validateBoardPayload(longDesc), /mô tả/);
});

test("mô tả dài nhưng trong hạn vẫn qua — người ta có quyền ghi chú dài", () => {
  const body = good();
  body.nodes[0].desc = "x".repeat(BOARD_LIMITS.descLen);
  assert.equal(validateBoardPayload(body), null);
});

test("bộ đếm id hỏng bị chặn", () => {
  const body = good();
  body.nextNodeId = NaN;
  assert.match(validateBoardPayload(body), /nextNodeId/);
});

test("dây nối trỏ tới đâu bằng số hỏng thì bị chặn", () => {
  const body = good();
  body.edges[0].to = "hai";
  assert.match(validateBoardPayload(body), /dây nối/);
});

test("payload rác không làm nổ", () => {
  for (const bad of [null, undefined, 42, "chuỗi", []]) {
    assert.equal(typeof validateBoardPayload(bad), "string", JSON.stringify(bad));
  }
});
