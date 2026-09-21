// Hundredths use 0, 2, 4, 5, 6, 8. Exact ties go towards +Infinity.
// Apply to preset settings, never to generated animation samples.
export function preferredNumber(value: number): number {
  if (!Number.isFinite(value)) return value;
  const base = Math.floor(value * 10) * 10;
  const candidates = [0, 2, 4, 5, 6, 8, 10].map(offset => (base + offset) / 100);
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - value) <= Math.abs(best - value) + 1e-12 ? candidate : best);
}

export function preferredSettings<T>(value: T): T {
  if (typeof value === "number") return preferredNumber(value) as T;
  if (Array.isArray(value)) return value.map(preferredSettings) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, preferredSettings(item)])) as T;
  }
  return value;
}
