export function emptyGameDesignBrief() {
  return { genre: "", targetAudience: "", playerFantasy: "", playerJourney: [] };
}

export function normalizeGameDesignBrief(value) {
  const brief = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const text = (key) => typeof brief[key] === "string" ? brief[key].trim() : "";
  return {
    genre: text("genre"),
    targetAudience: text("targetAudience"),
    playerFantasy: text("playerFantasy"),
    playerJourney: Array.isArray(brief.playerJourney) ? brief.playerJourney
      .filter((stage) => stage && typeof stage === "object" && !Array.isArray(stage))
      .map((stage, index) => ({
        id: typeof stage.id === "string" && stage.id.trim() ? stage.id.trim() : `journey-${index + 1}`,
        title: typeof stage.title === "string" ? stage.title.trim() : "",
        experience: typeof stage.experience === "string" ? stage.experience.trim() : "",
        emotion: typeof stage.emotion === "string" ? stage.emotion.trim() : ""
      }))
      .filter((stage) => stage.title)
      : []
  };
}

export function hasGameDesignBrief(brief) {
  const normalized = normalizeGameDesignBrief(brief);
  return Boolean(normalized.genre || normalized.targetAudience || normalized.playerFantasy || normalized.playerJourney.length);
}
