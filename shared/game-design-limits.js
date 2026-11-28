// Trần và danh sách giá trị hợp lệ của phần game-design — dùng chung client
// (lib/game-design/*: chuẩn hoá) và server (validation/game-design.js: kiểm
// payload). Trước đây client cắt bằng số viết tay (slice(0, 20)…) và chép tay
// từng danh sách trạng thái; lệch một chỗ là client lưu ra thứ server từ chối.

export const GAME_DESIGN_BRIEF_LIMITS = { text: 4000, stageText: 1000, stages: 50, id: 120 };
export const GAME_DESIGN_FLOW_LIMITS = { text: 1000, playerLoop: 20, progressionMap: 30, id: 120 };
export const GAME_DESIGN_DETAIL_LIMITS = { text: 1000, id: 120, examples: 20, failureStates: 20, tuningParameters: 30 };
export const GAME_DESIGN_TECHNICAL_NOTES_LIMIT = 2000;
export const GAME_DESIGN_PLAYTEST_LIMITS = { text: 4000, references: 100 };
export const GAME_DESIGN_DECISION_LIMITS = { entries: 30, text: 4000, id: 120, references: 100 };
export const GAME_DESIGN_BALANCE_LIMITS = { metrics: 100, curves: 30, curveSteps: 200, text: 4000, id: 120, references: 100 };
export const GAME_DESIGN_HANDOFF_LIMITS = { text: 4000 };
export const GAME_DESIGN_REVIEW_LIMITS = { comments: 20, text: 4000, id: 120 };
export const GAME_DESIGN_DELIVERY_LIMITS = { text: 4000 };
export const GAME_DESIGN_ANALYTICS_LIMITS = { events: 20, text: 4000 };
export const GAME_DESIGN_AB_TEST_LIMITS = { tests: 20, text: 4000, id: 120 };
export const GAME_DESIGN_LIVE_OPS_LIMITS = { text: 4000 };
export const GAME_DESIGN_POST_LAUNCH_LIMITS = { text: 4000, references: 100 };

// Loại quan hệ giữa hai thẻ GD (edge.relation). Nhãn hiển thị nằm ở
// client/src/lib/game-design/types.js (RELATION_OPTIONS).
export const RELATION_IDS = new Set(["depends-on", "unlocks", "replaces", "conflicts-with"]);

// Danh sách trạng thái hợp lệ. Phần tử ĐẦU là giá trị mặc định phía client.
export const REVIEW_OUTCOMES = ["pending", "approved", "changes-requested", "rejected"];
export const POST_LAUNCH_STATUSES = ["pending", "healthy", "needs-iteration", "sunset"];
export const AB_TEST_STATUSES = ["draft", "running", "concluded", "rejected"];
export const LIVE_OPS_STATUSES = ["planned", "running", "paused", "full", "rolled-back"];
export const TEAM_HANDOFF_STATUSES = ["draft", "ready", "handed-off"];
