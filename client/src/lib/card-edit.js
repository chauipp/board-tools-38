export function cardEditConflicts(base, current, patch) {
  if (!base) return [];
  const conflicts = [];
  function compare(original, latest, changes, prefix = "") {
    for (const [field, draft] of Object.entries(changes)) {
      const server = latest?.[field];
      if (prefix === "" && field === "design") {
        compare(original?.design, server, draft, "design.");
      } else if (JSON.stringify(original?.[field]) !== JSON.stringify(server)
        && JSON.stringify(draft) !== JSON.stringify(server)) {
        conflicts.push({ field: prefix + field, server, draft });
      }
    }
  }
  compare(base, current, patch);
  return conflicts;
}

export function formatConflictValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text == null || text === "") return "—";
  return text.length > 160 ? text.slice(0, 157) + "…" : text;
}
