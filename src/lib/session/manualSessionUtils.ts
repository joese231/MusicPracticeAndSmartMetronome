export function parseDurationToSeconds(input: string): number {
  if (!input || !input.trim()) {
    throw new Error("Duration cannot be empty");
  }

  const trimmed = input.trim();

  // Try parsing as "25m 30s" format
  const mAndSRegex = /^(\d+)m\s*(\d+)s?$/;
  const mAndSMatch = trimmed.match(mAndSRegex);
  if (mAndSMatch) {
    const minutes = parseInt(mAndSMatch[1], 10);
    const seconds = parseInt(mAndSMatch[2], 10);
    return minutes * 60 + seconds;
  }

  // Try parsing as "25m" format
  const mOnlyRegex = /^(\d+)m?$/;
  const mOnlyMatch = trimmed.match(mOnlyRegex);
  if (mOnlyMatch) {
    // If it has 'm', treat as minutes. Otherwise, if it's a number < 360 (6 hours), treat as minutes; else seconds.
    if (trimmed.includes("m")) {
      return parseInt(mOnlyMatch[1], 10) * 60;
    }
    // Ambiguous: a bare number. Assume minutes if < 360, else seconds.
    const num = parseInt(mOnlyMatch[1], 10);
    return num < 360 ? num * 60 : num;
  }

  // Try parsing as "90s" format
  const sOnlyRegex = /^(\d+)s$/;
  const sOnlyMatch = trimmed.match(sOnlyRegex);
  if (sOnlyMatch) {
    return parseInt(sOnlyMatch[1], 10);
  }

  throw new Error(`Invalid duration format: "${input}". Use formats like "25", "25m", "25m 30s", or "90s"`);
}
