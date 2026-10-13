/**
 * Pull a JSON object out of raw model output. Handles markdown code fences,
 * leading/trailing chatter, and braces inside strings.
 */
export function stripCodeFences(raw: string): string {
  const fenced = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  // An opening fence with no closing one (output cut off or sloppy).
  return raw.replace(/^\s*```(?:json|JSON)?/, "").trim();
}

export function extractJsonObject(raw: string): unknown {
  const text = stripCodeFences(raw);
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model output");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error("JSON object in model output is not complete");
}
