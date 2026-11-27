// Tách theo miền trong lib/game-design/. File này chỉ re-export để mọi import cũ giữ nguyên.

export { GAME_DESIGN_TYPES, DESIGN_FIELD_LABELS, RELATION_OPTIONS, relationDefinition, isGameDesignRelation, gameDesignType } from "./game-design/types.js";
export { emptyGameDesignBrief, normalizeGameDesignBrief, hasGameDesignBrief } from "./game-design/brief.js";
export { emptyGameDesignFlow, normalizeGameDesignFlow, hasGameDesignFlow } from "./game-design/flow.js";
export {
  emptyGameDesignBalance, BALANCE_TEMPLATES, appendBalanceTemplate, normalizeGameDesignBalance,
  balanceCurveTable, balanceMetricsForCard, evaluateBalanceFormula, balanceWarnings, balanceHealth
} from "./game-design/balance.js";
export { emptyGameDesignDetails, normalizeTechnicalNotes, normalizeGameDesignDetails, normalizeAcceptanceCriteria, acceptanceProgress } from "./game-design/details.js";
export { emptyPlaytestSession, normalizePlaytestSession, hasPlaytestSession, playtestComparison } from "./game-design/playtest.js";
export { emptyDecisionLog, normalizeDecisionLog, decisionTimeline } from "./game-design/decisions.js";
export { TEAM_HANDOFF_TEAMS, emptyTeamHandoff, normalizeTeamHandoff } from "./game-design/handoff.js";
export { emptyReview, normalizeReview } from "./game-design/review.js";
export { emptyDelivery, normalizeDelivery, hasDelivery } from "./game-design/delivery.js";
export { normalizeAnalyticsEvents } from "./game-design/analytics.js";
export { normalizeABTests, abTestProgress } from "./game-design/ab-tests.js";
export { emptyLiveOps, normalizeLiveOps, hasLiveOps } from "./game-design/live-ops.js";
export { emptyPostLaunchReview, normalizePostLaunchReview, hasPostLaunchReview } from "./game-design/post-launch.js";
export { normalizeFollowUpTasks, followUpProgress } from "./game-design/follow-ups.js";
export { dependencyAnalysis, dependencyImpact } from "./game-design/dependencies.js";
export { GAME_DESIGN_REPORTS, gameDesignReportNodeIds, gameDesignReport } from "./game-design/reports.js";
export { exportVersion, exportPackage, gameDesignMarkdown } from "./game-design/export.js";
export { emptyDesign, createGameDesignNode, createRelatedGameDesignCard, duplicateGameDesignCard, gameDesignPreview } from "./game-design/cards.js";
