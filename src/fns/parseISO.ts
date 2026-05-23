import { _parseISO } from "./_kernel";

export function parseISO(s: string): Date {
  const r = _parseISO(s);
  if (r.kind === "local") {
    return new Date(r.year, r.month - 1, r.day, r.hour, r.min, r.sec, r.ms);
  }
  if (r.kind === "zoned") {
    return new Date(
      Date.UTC(r.year, r.month - 1, r.day, r.hour, r.min, r.sec, r.ms) - r.offset * 60000,
    );
  }
  return new Date(NaN);
}
