export const TEAM_HANDOFF_TEAMS = [
  { id: "dev", label: "Dev", fields: ["notes"] },
  { id: "art", label: "Art", fields: ["brief", "requirements", "references", "format", "naming"] },
  { id: "audio", label: "Audio", fields: ["brief", "requirements", "references", "format", "naming"] }
];
const TEAM_HANDOFF_STATUSES = new Set(["draft", "ready", "handed-off"]);

export function emptyTeamHandoff() {
  return {
    dev: { status: "draft", owner: "", handedOffAt: "", notes: "" },
    art: { status: "draft", owner: "", handedOffAt: "", brief: "", requirements: "", references: "", format: "", naming: "" },
    audio: { status: "draft", owner: "", handedOffAt: "", brief: "", requirements: "", references: "", format: "", naming: "" }
  };
}

export function normalizeTeamHandoff(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const empty = emptyTeamHandoff();
  return Object.fromEntries(TEAM_HANDOFF_TEAMS.map(({ id, fields }) => {
    const item = input[id] && typeof input[id] === "object" && !Array.isArray(input[id]) ? input[id] : {};
    return [id, {
      status: TEAM_HANDOFF_STATUSES.has(item.status) ? item.status : "draft",
      owner: typeof item.owner === "string" ? item.owner.trim() : "",
      handedOffAt: typeof item.handedOffAt === "string" ? item.handedOffAt.trim() : "",
      ...Object.fromEntries(fields.map((field) => [field, typeof item[field] === "string" ? item[field].trim() : empty[id][field]]))
    }];
  }));
}
