export function differenceInDays(a: Date, b: Date): number {
  const diffMs = a.getTime() - b.getTime();
  if (isNaN(diffMs)) {
    return NaN;
  }
  const z = (a.getTimezoneOffset() - b.getTimezoneOffset()) * 60000;
  const r = (diffMs - z) / 86400000;
  return r < 0 ? -Math.floor(-r) : Math.floor(r) || 0;
}
