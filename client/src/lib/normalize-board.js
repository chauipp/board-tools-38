import {
  normalizeABTests,
  normalizeAcceptanceCriteria,
  normalizeAnalyticsEvents,
  normalizeDecisionLog,
  normalizeDelivery,
  normalizeFollowUpTasks,
  normalizeGameDesignBalance,
  normalizeGameDesignBrief,
  normalizeGameDesignDetails,
  normalizeGameDesignFlow,
  normalizeLiveOps,
  normalizePlaytestSession,
  normalizePostLaunchReview,
  normalizeReview,
  normalizeTeamHandoff,
  normalizeTechnicalNotes
} from "./game-design.js";

export function normalizeGameDesignBoard(board) {
  if (!board || board.kind !== "game-design") return board;
  return {
    ...board,
    gameDesignBrief: normalizeGameDesignBrief(board.gameDesignBrief),
    gameDesignFlow: normalizeGameDesignFlow(board.gameDesignFlow, board.nodes),
    gameDesignBalance: normalizeGameDesignBalance(board.gameDesignBalance, board.nodes),
    nodes: (board.nodes || []).map((node) => node?.design ? {
      ...node,
      design: {
        ...node.design,
        technicalNotes: normalizeTechnicalNotes(node.design.technicalNotes),
        acceptanceCriteria: normalizeAcceptanceCriteria(node.design.acceptanceCriteria),
        ...normalizeGameDesignDetails(node.design),
        playtestSession: normalizePlaytestSession(node.design.playtestSession, board.nodes),
        decisionLog: normalizeDecisionLog(node.design.decisionLog, board.nodes),
        teamHandoff: normalizeTeamHandoff(node.design.teamHandoff),
        review: normalizeReview(node.design.review),
        delivery: normalizeDelivery(node.design.delivery),
        analyticsEvents: normalizeAnalyticsEvents(node.design.analyticsEvents),
        followUpTasks: normalizeFollowUpTasks(node.design.followUpTasks, board.nodes),
        abTests: normalizeABTests(node.design.abTests),
        liveOps: normalizeLiveOps(node.design.liveOps),
        postLaunchReview: normalizePostLaunchReview(node.design.postLaunchReview, board.nodes)
      }
    } : node)
  };
}
