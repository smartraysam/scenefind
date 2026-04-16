export function extractJsonObject<T extends Record<string, unknown>>(text: string): T {
  if (!text || typeof text !== "string") {
    throw new Error("Empty model response");
  }

  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model response did not contain valid JSON");
    }
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}
