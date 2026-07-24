export function getUserName(storage, promptFn) {
  const existing = storage.getItem("idea-map-user");
  if (existing) return existing;
  const name = (promptFn() || "").trim();
  if (!name) return null;
  storage.setItem("idea-map-user", name);
  return name;
}
