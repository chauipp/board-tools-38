// Status mặc định và mẫu board game-design cho board mới. Di chuyển nguyên văn từ boards.js.

export const DEFAULT_STATUSES = [
  { id: 1, name: "Ý tưởng mới", color: "st-idea" },
  { id: 2, name: "Đang cân nhắc", color: "st-considering" },
  { id: 3, name: "Đã chọn", color: "st-chosen" },
  { id: 4, name: "Gác lại", color: "st-parked" },
  { id: 5, name: "Đã loại", color: "st-rejected" }
];

export const GAME_DESIGN_STATUSES = [
  { id: 1, name: "Draft", color: "st-idea" },
  { id: 2, name: "Review", color: "st-considering" },
  { id: 3, name: "Ready for dev", color: "st-chosen" },
  { id: 4, name: "In dev", color: "st-parked" },
  { id: 5, name: "Testing", color: "st-rejected" },
  { id: 6, name: "Done", color: "st-done" }
  , { id: 7, name: "Approved", color: "st-done" }, { id: 8, name: "Rejected", color: "st-rejected" }, { id: 9, name: "Archived", color: "st-parked" }
];

export const GAME_DESIGN_TEMPLATES = {
  combat: {
    gameDesignBrief: { genre: "Action", targetAudience: "", playerFantasy: "Làm chủ combat", playerJourney: [] },
    gameDesignFlow: { playerLoop: [{ id: "loop-1", title: "Engage", action: "Đọc tình huống", outcome: "Chọn hành động", note: "", cardIds: ["1"] }, { id: "loop-2", title: "Execute", action: "Dùng skill", outcome: "Tạo lợi thế", note: "", cardIds: ["2"] }], progressionMap: [] },
    gameDesignBalance: { metrics: [{ id: "metric-1", key: "damage", name: "Damage", value: "10", min: "1", max: "999", unit: "HP", formula: "", cardIds: ["2"] }, { id: "metric-2", key: "cooldown", name: "Cooldown", value: "1", min: "0", max: "60", unit: "s", formula: "", cardIds: ["2"] }] },
    nodes: [{ id: 1, x: 80, y: 150, title: "Combat loop", desc: "Vòng lặp chiến đấu cốt lõi", type: "core-loop", design: {} }, { id: 2, x: 380, y: 150, title: "Primary action", desc: "Đòn đánh hoặc skill chính", type: "mechanic", design: {} }, { id: 3, x: 680, y: 150, title: "Combat playtest", desc: "Kiểm nghiệm nhịp độ và độ rõ ràng", type: "playtest", design: {} }],
    edges: [{ id: 1, from: 1, to: 2, relation: "unlocks" }, { id: 2, from: 2, to: 3, relation: "depends-on" }]
  },
  level: {
    gameDesignBrief: { genre: "", targetAudience: "", playerFantasy: "Khám phá và chinh phục", playerJourney: [] },
    gameDesignFlow: { playerLoop: [], progressionMap: [{ id: "progress-1", title: "Tutorial", objective: "Học hành động cơ bản", unlocks: "Level 1", description: "", emotion: "", cardIds: ["1"] }, { id: "progress-2", title: "Challenge", objective: "Kết hợp kỹ năng", unlocks: "Level 2", description: "", emotion: "", cardIds: ["2"] }] },
    gameDesignBalance: { metrics: [{ id: "metric-1", key: "completion_rate", name: "Completion rate", value: "", min: "0", max: "100", unit: "%", formula: "", cardIds: ["2"] }] },
    nodes: [{ id: 1, x: 80, y: 150, title: "Tutorial level", desc: "Dạy một hành động mới", type: "quest-level", design: {} }, { id: 2, x: 380, y: 150, title: "Challenge level", desc: "Kết hợp kỹ năng trong áp lực", type: "quest-level", design: {} }, { id: 3, x: 680, y: 150, title: "Level playtest", desc: "Kiểm completion, nhịp độ và điểm kẹt", type: "playtest", design: {} }],
    edges: [{ id: 1, from: 1, to: 2, relation: "unlocks" }, { id: 2, from: 2, to: 3, relation: "depends-on" }]
  },
  economy: {
    gameDesignBrief: { genre: "", targetAudience: "", playerFantasy: "Lựa chọn và phát triển", playerJourney: [] },
    gameDesignFlow: { playerLoop: [{ id: "loop-1", title: "Earn", action: "Hoàn thành hoạt động", outcome: "Nhận tài nguyên", note: "", cardIds: ["1"] }, { id: "loop-2", title: "Spend", action: "Nâng cấp", outcome: "Mở sức mạnh mới", note: "", cardIds: ["2"] }], progressionMap: [] },
    gameDesignBalance: { metrics: [{ id: "metric-1", key: "currency_reward", name: "Currency reward", value: "100", min: "0", max: "", unit: "gold", formula: "", cardIds: ["1"] }, { id: "metric-2", key: "upgrade_cost", name: "Upgrade cost", value: "100", min: "0", max: "", unit: "gold", formula: "", cardIds: ["2"] }] },
    nodes: [{ id: 1, x: 80, y: 150, title: "Resource source", desc: "Nguồn nhận tài nguyên", type: "mechanic", design: {} }, { id: 2, x: 380, y: 150, title: "Upgrade sink", desc: "Nơi người chơi chi tiêu", type: "skill-item", design: {} }, { id: 3, x: 680, y: 150, title: "Economy playtest", desc: "Kiểm lựa chọn, nhịp kiếm và chi", type: "playtest", design: {} }],
    edges: [{ id: 1, from: 1, to: 2, relation: "unlocks" }, { id: 2, from: 2, to: 3, relation: "depends-on" }]
  }
};

export function gameDesignTemplate(templateId) {
  const template = GAME_DESIGN_TEMPLATES[templateId];
  if (!template) return {};
  return {
    ...structuredClone(template),
    nextNodeId: template.nodes.length + 1,
    nextEdgeId: template.edges.length + 1
  };
}
