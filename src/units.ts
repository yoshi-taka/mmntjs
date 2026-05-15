import type { NormalizedUnit, UnitAlias, UnitCode } from "./types";

// -------------------------------------------------------------------------
// HOT PATH — numeric unit codes (used in add/subtract/startOf/endOf loops)
// -------------------------------------------------------------------------
export const YEAR: UnitCode = 0 as const;
export const MONTH: UnitCode = 1 as const;
export const DATE: UnitCode = 2 as const;
export const HOUR: UnitCode = 3 as const;
export const MINUTE: UnitCode = 4 as const;
export const SECOND: UnitCode = 5 as const;
export const MILLISECOND: UnitCode = 6 as const;
export const WEEK: UnitCode = 7 as const;
export const WEEKDAY: UnitCode = 8 as const;
export const DAY_OF_YEAR: UnitCode = 9 as const;
export const QUARTER: UnitCode = 10 as const;
export const ISO_WEEK: UnitCode = 11 as const;
export const ISO_WEEKDAY: UnitCode = 12 as const;
export const WEEK_YEAR: UnitCode = 13 as const;
export const ISO_WEEK_YEAR: UnitCode = 14 as const;
export const DAY: UnitCode = 15 as const;
export const INVALID_UNIT: UnitCode = -1 as const;

// -------------------------------------------------------------------------
// TYPED INTERNAL API — alias→normalized-unit lookup (allocation-free)
// -------------------------------------------------------------------------
const _aliases: Record<UnitAlias, NormalizedUnit> = {
  Y: "year",
  y: "year",
  years: "year",
  year: "year",
  M: "month",
  months: "month",
  month: "month",
  Mo: "month",
  D: "date",
  d: "day",
  days: "day",
  day: "day",
  date: "date",
  dates: "date",
  h: "hour",
  hours: "hour",
  hour: "hour",
  m: "minute",
  minutes: "minute",
  minute: "minute",
  s: "second",
  seconds: "second",
  second: "second",
  ms: "millisecond",
  milliseconds: "millisecond",
  millisecond: "millisecond",
  w: "week",
  W: "isoWeek",
  weeks: "week",
  week: "week",
  weekday: "weekday",
  weekdays: "weekday",
  e: "weekday",
  isoWeek: "isoWeek",
  isoWeeks: "isoWeek",
  isoWeekday: "isoWeekday",
  isoWeekdays: "isoWeekday",
  E: "isoWeekday",
  quarter: "quarter",
  quarters: "quarter",
  Q: "quarter",
  dayOfYear: "dayOfYear",
  dayOfYears: "dayOfYear",
  doy: "dayOfYear",
  DDD: "dayOfYear",
  gg: "weekYear",
  weekYear: "weekYear",
  weekYears: "weekYear",
  GG: "isoWeekYear",
  isoWeekYear: "isoWeekYear",
  isoWeekYears: "isoWeekYear",
};

const _nmap: Record<string, NormalizedUnit | undefined> = {};
for (const key of Object.keys(_aliases)) {
  _nmap[key.toLowerCase()] = _aliases[key as UnitAlias];
}

export const units: Record<string, string> = _aliases as unknown as Record<string, string>;

// Idempotence: normalizeUnits(normalizeUnits(x)) ≡ normalizeUnits(x)
//   because every NormalizedUnit is a key in _aliases mapping to itself.
// Retraction: normalizeUnits maps UnitAlias → NormalizedUnit (the canonical representative).
export function normalizeUnits(unit: string): NormalizedUnit | undefined {
  return unit
    ? ((_aliases as Record<string, NormalizedUnit | undefined>)[unit] ?? _nmap[unit.toLowerCase()])
    : undefined;
}

const _unitCodes: Record<NormalizedUnit, UnitCode> = {
  year: YEAR,
  month: MONTH,
  date: DATE,
  hour: HOUR,
  minute: MINUTE,
  second: SECOND,
  millisecond: MILLISECOND,
  week: WEEK,
  weekday: WEEKDAY,
  dayOfYear: DAY_OF_YEAR,
  quarter: QUARTER,
  isoWeek: ISO_WEEK,
  isoWeekday: ISO_WEEKDAY,
  weekYear: WEEK_YEAR,
  isoWeekYear: ISO_WEEK_YEAR,
  day: DAY,
};

const _codeAliases: Record<string, UnitCode | undefined> = {};
const _codeNmap: Record<string, UnitCode | undefined> = {}; // hot path fallback
for (const key of Object.keys(_aliases)) {
  const code = _unitCodes[_aliases[key as UnitAlias]];
  _codeAliases[key] = code;
  _codeNmap[key.toLowerCase()] = code;
}

// Composition: normalizeUnitCode ∘ normalizeUnits ≡ normalizeUnitCode on UnitAlias domain.
//   normalizeUnitCode returns a numeric code — further calls with the same string are idempotent.
export function normalizeUnitCode(unit: string): UnitCode | undefined {
  if (!unit) {
    return INVALID_UNIT;
  }
  return _codeAliases[unit] ?? _codeNmap[unit.toLowerCase()];
}

export function euclideanModulo(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

export function normalizeMonth(m: number): number {
  return euclideanModulo(m, 12);
}

export function floorUnitEpoch(value: number, unitMs: number): number {
  return value - euclideanModulo(value, unitMs);
}

export function floorUnitIndex(value: number, unitMs: number): number {
  return floorUnitEpoch(value, unitMs) / unitMs;
}

export function endOfUnitEpoch(value: number, unitMs: number): number {
  return value + (unitMs - 1) - euclideanModulo(value, unitMs);
}

/** Inverse of _epochDaysToYMD: year-month-day (0-indexed month) → epoch days.
 *
 *  Howard Hinnant algorithm (days_from_civil). Supports all epochs
 *  including negative years. Replaces Date.UTC in UTC calendar paths
 *  with pure integer arithmetic — no Date allocation, no DST risk.
 */
export function ymdToEpochDays(y: number, m: number, d: number): number {
  const ya = y - (m <= 1 ? 1 : 0);
  const era = Math.floor(ya / 400);
  const yoe = ya - era * 400;
  const mp = m >= 2 ? m - 2 : m + 10;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function isLeapYear(y: number): boolean {
  if (!isFinite(y)) {
    return false;
  }
  if ((y & 3) !== 0) {
    return false;
  }
  if (y % 100 !== 0) {
    return true;
  }
  return (y & 15) === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonthFast(year: number, month0to11: number): number {
  if (month0to11 === 1) {
    return isLeapYear(year) ? 29 : 28;
  }
  return DAYS_IN_MONTH[month0to11];
}

export function daysInMonth(year: number, month: number): number {
  if (isNaN(year) || isNaN(month)) {
    return NaN;
  }
  if (month < 0 || month > 11) {
    year += Math.floor(month / 12);
    month = normalizeMonth(month);
  }
  return daysInMonthFast(year, month);
}
