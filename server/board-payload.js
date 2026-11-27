// Giữ để các import cũ (và board-payload.test.js) không phải sửa. Code thật
// nằm ở validation/board.js và validation/game-design.js.
export { BOARD_LIMITS, validateBoardPayload } from "./validation/board.js";
export {
  GAME_DESIGN_BRIEF_LIMITS,
  GAME_DESIGN_FLOW_LIMITS,
  GAME_DESIGN_DETAIL_LIMITS,
  GAME_DESIGN_TECHNICAL_NOTES_LIMIT,
  GAME_DESIGN_PLAYTEST_LIMITS,
  GAME_DESIGN_DECISION_LIMITS,
  GAME_DESIGN_BALANCE_LIMITS,
  GAME_DESIGN_HANDOFF_LIMITS,
  GAME_DESIGN_REVIEW_LIMITS,
  GAME_DESIGN_DELIVERY_LIMITS,
  GAME_DESIGN_ANALYTICS_LIMITS,
  GAME_DESIGN_AB_TEST_LIMITS,
  GAME_DESIGN_LIVE_OPS_LIMITS,
  GAME_DESIGN_POST_LAUNCH_LIMITS,
  normalizeGameDesignFlow,
  resolveGameDesignFields
} from "./validation/game-design.js";
