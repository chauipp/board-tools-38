import { RELATION_IDS } from "../../../../shared/game-design-limits.js";
export const GAME_DESIGN_TYPES = [
  { id: "pillar", label: "Game Pillar", fields: ["goal", "rules", "owner", "priority", "acceptanceCriteria"] },
  { id: "core-loop", label: "Core Loop", fields: ["goal", "inputs", "outputs", "rules", "acceptanceCriteria"] },
  { id: "mechanic", label: "Mechanic / System", fields: ["goal", "inputs", "rules", "outputs", "edgeCases", "dependencies", "owner", "priority", "acceptanceCriteria"] },
  { id: "character", label: "Character / Unit", fields: ["goal", "rules", "outputs", "dependencies", "owner", "acceptanceCriteria"] },
  { id: "skill-item", label: "Skill / Item", fields: ["goal", "inputs", "rules", "outputs", "edgeCases", "dependencies", "priority", "acceptanceCriteria"] },
  { id: "quest-level", label: "Quest / Level", fields: ["goal", "inputs", "rules", "outputs", "edgeCases", "dependencies", "owner", "priority", "acceptanceCriteria"] },
  { id: "ui-ux", label: "UI / UX", fields: ["goal", "inputs", "outputs", "edgeCases", "dependencies", "owner", "acceptanceCriteria"] },
  { id: "playtest", label: "Playtest", fields: ["goal", "inputs", "outputs", "edgeCases", "owner", "priority", "acceptanceCriteria"] }
];

export const DESIGN_FIELD_LABELS = {
  goal: "Mục tiêu người chơi",
  rules: "Luật hoạt động",
  inputs: "Input / điều khiển",
  outputs: "Kết quả / phần thưởng",
  edgeCases: "Trường hợp đặc biệt",
  dependencies: "Phụ thuộc / liên kết",
  owner: "Người phụ trách",
  priority: "Ưu tiên",
  acceptanceCriteria: "Acceptance criteria",
  playerExperience: "Trải nghiệm người chơi"
};

export const RELATION_OPTIONS = [
  { id: "depends-on", label: "Phụ thuộc", description: "Nguồn cần đích hoàn tất hoặc tồn tại trước." },
  { id: "unlocks", label: "Mở khóa", description: "Nguồn mở ra hoặc cho phép sử dụng đích." },
  { id: "replaces", label: "Thay thế", description: "Nguồn thay cho phiên bản hoặc giải pháp ở đích." },
  { id: "conflicts-with", label: "Xung đột", description: "Hai thẻ không nên cùng được áp dụng." }
];

// Tập id hợp lệ dùng chung với server (shared/game-design-limits.js);
// RELATION_OPTIONS ở trên phải liệt kê đúng các id đó (có test).
export { RELATION_IDS };

export function relationDefinition(relation) {
  return RELATION_OPTIONS.find((item) => item.id === relation) || RELATION_OPTIONS[0];
}

export function isGameDesignRelation(relation) {
  return RELATION_IDS.has(relation);
}

export function gameDesignType(type) {
  return GAME_DESIGN_TYPES.find((item) => item.id === type) || GAME_DESIGN_TYPES[2];
}
