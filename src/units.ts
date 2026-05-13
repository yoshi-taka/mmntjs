export const YEAR = 0;
export const MONTH = 1;
export const DATE = 2;
export const HOUR = 3;
export const MINUTE = 4;
export const SECOND = 5;
export const MILLISECOND = 6;
export const WEEK = 7;
export const WEEKDAY = 8;
export const DAY_OF_YEAR = 9;
export const QUARTER = 10;
export const ISO_WEEK = 11;
export const ISO_WEEKDAY = 12;
export const WEEK_YEAR = 13;
export const ISO_WEEK_YEAR = 14;
export const DAY = 15;
export const INVALID_UNIT = -1;

const _aliases: Record<string, string> = {
  Y: "year", y: "year", years: "year", year: "year",
  M: "month", months: "month", month: "month", Mo: "month",
  D: "date", d: "day", days: "day", day: "day", date: "date", dates: "date",
  h: "hour", hours: "hour", hour: "hour",
  m: "minute", minutes: "minute", minute: "minute",
  s: "second", seconds: "second", second: "second",
  ms: "millisecond", milliseconds: "millisecond", millisecond: "millisecond",
  w: "week", W: "isoWeek", weeks: "week", week: "week",
  weekday: "weekday", weekdays: "weekday", e: "weekday",
  isoWeek: "isoWeek", isoWeeks: "isoWeek",
  isoWeekday: "isoWeekday", isoWeekdays: "isoWeekday", E: "isoWeekday",
  quarter: "quarter", quarters: "quarter", Q: "quarter",
  dayOfYear: "dayOfYear", dayOfYears: "dayOfYear", doy: "dayOfYear", DDD: "dayOfYear",
  gg: "weekYear", weekYear: "weekYear", weekYears: "weekYear",
  GG: "isoWeekYear", isoWeekYear: "isoWeekYear", isoWeekYears: "isoWeekYear",
};

const _nmap: Record<string, string> = {};
for (const key of Object.keys(_aliases)) {
  _nmap[key.toLowerCase()] = _aliases[key];
}

export const units: Record<string, string> = _aliases;

export function normalizeUnits(unit: string): string | undefined {
  return unit ? (_aliases[unit] || _nmap[unit.toLowerCase()]) : undefined;
}

const _unitCodes: Record<string, number> = {
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

const _codeAliases: Record<string, number> = {};
const _codeNmap: Record<string, number> = {};
for (const key of Object.keys(_aliases)) {
  const code = _unitCodes[_aliases[key]];
  _codeAliases[key] = code;
  _codeNmap[key.toLowerCase()] = code;
}

export function normalizeUnitCode(unit: string): number {
  if (!unit) {return INVALID_UNIT;}
  const exact = _codeAliases[unit];
  return exact;
}

export function isLeapYear(y: number): boolean {
  if (!isFinite(y)) {return false;}
  if ((y & 3) !== 0) {return false;}
  if (y % 100 !== 0) {return true;}
  return (y & 15) === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(year: number, month: number): number {
  if (isNaN(year) || isNaN(month)) {return NaN;}
  if (month < 0 || month > 11) {
    const adj = month % 12;
    year += Math.floor(month / 12);
    month = adj < 0 ? adj + 12 : adj;
  }
  if (month === 1) {return isLeapYear(year) ? 29 : 28;}
  return DAYS_IN_MONTH[month];
}
