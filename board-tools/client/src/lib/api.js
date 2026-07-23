export async function getIdeas() {
  const res = await fetch("/api/ideas");
  if (!res.ok) throw new Error("Không tải được dữ liệu ý tưởng");
  return res.json();
}

export async function saveIdeas(state) {
  const res = await fetch("/api/ideas", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  if (!res.ok) throw new Error("Không lưu được dữ liệu ý tưởng");
  return res.json();
}

export async function getCalculator() {
  const res = await fetch("/api/calculator");
  if (!res.ok) throw new Error("Không tải được dữ liệu bàn tính");
  return res.json();
}

export async function saveCalculator(state) {
  const res = await fetch("/api/calculator", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  if (!res.ok) throw new Error("Không lưu được dữ liệu bàn tính");
  return res.json();
}
