// Kiểm payload của PUT /boards/:id trước khi ghi.
//
// Nguyên tắc quan trọng nhất ở file này: CHẶN NHẦM LÀ MẤT BÀI. Client autosave
// mỗi 500ms, nên một cú 400 sai chỗ nghĩa là người ta đang vẽ mà không có gì
// được lưu lại. Vì vậy chỗ này chỉ chặn những thứ KHÔNG THỂ là dữ liệu thật:
//
//   - sai kiểu (đáng lẽ là mảng mà lại là chuỗi)
//   - NaN / Infinity trong toạ độ — Mongo nhận tuốt, nhưng board đọc lên sau đó
//     không vẽ được và không có gì trên màn hình nói vì sao
//   - số lượng phi lý
//
// Ngưỡng đặt cao hơn board lớn nhất đang có hàng chục lần (lúc viết: 55 node,
// 64 nét vẽ, 702 điểm), nên việc dùng bình thường không bao giờ chạm tới. Đây là
// cửa chặn payload độc hại, không phải luật về việc bảng được to đến đâu.
//
// Field nào KHÔNG có trong payload thì bỏ qua, không coi là lỗi: findByIdAndUpdate
// bỏ qua field undefined, nên thiếu field nghĩa là "không đổi phần này".

import { RELATION_IDS } from "../../shared/game-design-limits.js";
import { BOARD_LIST_FIELDS as LIST_FIELDS, BOARD_COUNTER_FIELDS as COUNTER_FIELDS } from "../board-fields.js";
import {
  GAME_DESIGN_DETAIL_LIMITS,
  GAME_DESIGN_TECHNICAL_NOTES_LIMIT,
  validateGameDesignBrief,
  validateGameDesignFlow,
  validateGameDesignBalance,
  validateDesignDetailCollection,
  validatePlaytestSession,
  validateDecisionLog,
  validateTeamHandoff,
  validateReview,
  validateDelivery,
  validateAnalyticsEvents,
  validateABTests,
  validateLiveOps,
  validatePostLaunchReview,
  validateFollowUpTasks
} from "./game-design.js";

export const BOARD_LIMITS = {
  nodes: 5000,
  edges: 10000,
  groups: 1000,
  drawings: 20000,
  statuses: 500,
  tags: 500,
  palette: 500,
  totalDrawingPoints: 300_000,
  titleLen: 1000,
  descLen: 100_000
};

const BOARD_KINDS = new Set(["idea", "game-design"]);

// Số "dùng được": phải là number thật, không NaN, không Infinity. Chuỗi số cũng
// bị loại — client luôn gửi number, nên chuỗi ở đây là dấu hiệu dữ liệu đã méo
// từ đâu đó chứ không phải người dùng làm gì lạ.
function badNumber(v) {
  return v !== undefined && v !== null && (typeof v !== "number" || !Number.isFinite(v));
}

function checkGeometry(item, where) {
  for (const key of ["id", "x", "y", "w", "h", "pdfH"]) {
    if (badNumber(item[key])) return `${where}.${key} không phải số dùng được`;
  }
  return null;
}

// Trả về null nếu payload dùng được, hoặc một câu mô tả chỗ hỏng.
export function validateBoardPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "payload không phải object";
  if (body.kind !== undefined && !BOARD_KINDS.has(body.kind)) return "kind không hợp lệ";
  const briefInvalid = validateGameDesignBrief(body.gameDesignBrief);
  if (briefInvalid) return briefInvalid;
  if (body.gameDesignFlow !== undefined && body.gameDesignFlow !== null && body.kind !== "game-design") {
    return "gameDesignFlow chỉ dùng cho board game-design";
  }
  const flowInvalid = validateGameDesignFlow(body.gameDesignFlow, body.nodes);
  if (flowInvalid) return flowInvalid;
  if (body.gameDesignBalance !== undefined && body.gameDesignBalance !== null && body.kind !== "game-design") return "gameDesignBalance chỉ dùng cho board game-design";
  const balanceInvalid = validateGameDesignBalance(body.gameDesignBalance, body.nodes);
  if (balanceInvalid) return balanceInvalid;

  for (const field of LIST_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) return `${field} phải là mảng`;
    if (value.length > BOARD_LIMITS[field]) {
      return `${field} có ${value.length} phần tử, vượt trần ${BOARD_LIMITS[field]}`;
    }
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return `${field} chứa phần tử không phải object`;
    }
  }

  for (const field of COUNTER_FIELDS) {
    if (badNumber(body[field])) return `${field} không phải số dùng được`;
  }

  for (const node of body.nodes || []) {
    const nodeIds = new Set((body.nodes || []).map((item) => String(item?.id)));
    const geo = checkGeometry(node, "node");
    if (geo) return geo;
    if (typeof node.title === "string" && node.title.length > BOARD_LIMITS.titleLen) {
      return `tiêu đề thẻ dài ${node.title.length} ký tự, vượt trần ${BOARD_LIMITS.titleLen}`;
    }
    if (typeof node.desc === "string" && node.desc.length > BOARD_LIMITS.descLen) {
      return `mô tả thẻ dài ${node.desc.length} ký tự, vượt trần ${BOARD_LIMITS.descLen}`;
    }
    if (node.type !== undefined && (typeof node.type !== "string" || node.type.length > 80)) {
      return "node.type không hợp lệ";
    }
    if (node.design !== undefined && (!node.design || typeof node.design !== "object" || Array.isArray(node.design))) {
      return "node.design phải là object";
    }
    if (node.design?.technicalNotes !== undefined && (typeof node.design.technicalNotes !== "string" || node.design.technicalNotes.length > GAME_DESIGN_TECHNICAL_NOTES_LIMIT)) {
      return "technicalNotes không hợp lệ";
    }
    if (node.design?.playerExperience !== undefined && (
      typeof node.design.playerExperience !== "string" ||
      node.design.playerExperience.length > GAME_DESIGN_TECHNICAL_NOTES_LIMIT
    )) return "playerExperience không hợp lệ";
    const invalidTeamHandoff = validateTeamHandoff(node.design?.teamHandoff);
    if (invalidTeamHandoff) return invalidTeamHandoff;
    const invalidReview = validateReview(node.design?.review);
    if (invalidReview) return invalidReview;
    const invalidDelivery = validateDelivery(node.design?.delivery);
    if (invalidDelivery) return invalidDelivery;
    const invalidAnalytics = validateAnalyticsEvents(node.design?.analyticsEvents);
    if (invalidAnalytics) return invalidAnalytics;
    const invalidABTests = validateABTests(node.design?.abTests);
    if (invalidABTests) return invalidABTests;
    const invalidLiveOps = validateLiveOps(node.design?.liveOps);
    if (invalidLiveOps) return invalidLiveOps;
    const invalidPostLaunch = validatePostLaunchReview(node.design?.postLaunchReview, nodeIds);
    if (invalidPostLaunch) return invalidPostLaunch;
    const invalidFollowUps = validateFollowUpTasks(node.design?.followUpTasks, nodeIds);
    if (invalidFollowUps) return invalidFollowUps;
    const invalidPlaytest = validatePlaytestSession(node.design?.playtestSession, nodeIds);
    if (invalidPlaytest) return invalidPlaytest;
    const invalidDecisionLog = validateDecisionLog(node.design?.decisionLog, nodeIds);
    if (invalidDecisionLog) return invalidDecisionLog;
    const criteria = node.design?.acceptanceCriteria;
    if (criteria !== undefined) {
      if (typeof criteria !== "string" && !Array.isArray(criteria)) return "acceptanceCriteria phải là chuỗi hoặc mảng";
      if (Array.isArray(criteria)) {
        for (const item of criteria) {
          if (!item || typeof item !== "object" || Array.isArray(item)) return "acceptanceCriteria chứa phần tử không phải object";
          if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 120) return "acceptanceCriteria.id không hợp lệ";
          if (typeof item.text !== "string" || !item.text.trim() || item.text.length > BOARD_LIMITS.descLen) return "acceptanceCriteria.text không hợp lệ";
          if (typeof item.done !== "boolean") return "acceptanceCriteria.done không hợp lệ";
        }
      }
    }
    for (const spec of [
      { key: "examples", fields: ["title", "scenario", "expectedResult"], limit: GAME_DESIGN_DETAIL_LIMITS.examples },
      { key: "failureStates", fields: ["condition", "playerFeedback", "recovery"], limit: GAME_DESIGN_DETAIL_LIMITS.failureStates },
      { key: "tuningParameters", fields: ["name", "defaultValue", "min", "max", "unit", "note"], limit: GAME_DESIGN_DETAIL_LIMITS.tuningParameters }
    ]) {
      const invalidDetail = validateDesignDetailCollection(node.design?.[spec.key], spec);
      if (invalidDetail) return invalidDetail;
    }
  }

  for (const edge of body.edges || []) {
    if (badNumber(edge.id) || badNumber(edge.from) || badNumber(edge.to)) {
      return "dây nối có id/from/to không phải số dùng được";
    }
    if (edge.relation !== undefined && !RELATION_IDS.has(edge.relation)) return "relation không hợp lệ";
  }

  for (const group of body.groups || []) {
    const geo = checkGeometry(group, "khung");
    if (geo) return geo;
  }

  // Nét vẽ là chỗ dễ phình nhất: một nét là một mảng toạ độ, và số nét thì không
  // giới hạn. Đếm tổng số điểm chứ không chỉ đếm số nét — 10 nét mỗi nét một
  // triệu điểm vẫn lọt qua nếu chỉ đếm nét.
  let totalPoints = 0;
  for (const drawing of body.drawings || []) {
    if (badNumber(drawing.id)) return "nét vẽ có id không phải số dùng được";
    const pts = drawing.pts;
    if (pts === undefined) continue;
    if (!Array.isArray(pts)) return "nét vẽ có pts không phải mảng";
    totalPoints += pts.length;
    if (totalPoints > BOARD_LIMITS.totalDrawingPoints) {
      return `tổng số điểm của nét vẽ vượt trần ${BOARD_LIMITS.totalDrawingPoints}`;
    }
    for (const n of pts) {
      if (typeof n !== "number" || !Number.isFinite(n)) return "nét vẽ chứa toạ độ không phải số dùng được";
    }
  }

  return null;
}
