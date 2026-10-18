const INLINE_RE = /(\*\*([^*]+)\*\*)|(https?:\/\/[^\s]+)/g;

export function parseInline(text) {
  const tokens = [];
  let last = 0, m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    if (m[2] != null) tokens.push({ type: "bold", value: m[2] });
    else tokens.push({ type: "link", value: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length || tokens.length === 0) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

export function parseDesc(desc) {
  return desc.split("\n").map((line) =>
    line.startsWith("- ")
      ? { type: "bullet", inline: parseInline(line.slice(2)) }
      : { type: "para", inline: parseInline(line) }
  );
}
