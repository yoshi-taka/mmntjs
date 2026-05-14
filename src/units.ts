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

export function normalizeUnitCode(unit: string): UnitCode | undefined {
  if (!unit) {
    return INVALID_UNIT;
  }
  return _codeAliases[unit];
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

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(year: number, month: number): number {
  if (isNaN(year) || isNaN(month)) {
    return NaN;
  }
  if (month < 0 || month > 11) {
    const adj = month % 12;
    year += Math.floor(month / 12);
    month = adj < 0 ? adj + 12 : adj;
  }
  if (month === 1) {
    return isLeapYear(year) ? 29 : 28;
  }
  return DAYS_IN_MONTH[month];
}
