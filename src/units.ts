import type { NormalizedUnit, UnitCode } from "./types";

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
/** @public */
export const WEEKDAY: UnitCode = 8 as const;
/** @public */
export const DAY_OF_YEAR: UnitCode = 9 as const;
export const QUARTER: UnitCode = 10 as const;
export const ISO_WEEK: UnitCode = 11 as const;
/** @public */
export const ISO_WEEKDAY: UnitCode = 12 as const;
/** @public */
export const WEEK_YEAR: UnitCode = 13 as const;
/** @public */
export const ISO_WEEK_YEAR: UnitCode = 14 as const;
export const DAY: UnitCode = 15 as const;
export const INVALID_UNIT: UnitCode = -1 as const;

/** @public */
export const units: Record<string, string> = {
  year: "year",
  month: "month",
  date: "date",
  day: "day",
  hour: "hour",
  minute: "minute",
  second: "second",
  millisecond: "millisecond",
  week: "week",
  weekday: "weekday",
  dayOfYear: "dayOfYear",
  quarter: "quarter",
  isoWeek: "isoWeek",
  isoWeekday: "isoWeekday",
  weekYear: "weekYear",
  isoWeekYear: "isoWeekYear",
};

export function normalizeUnits(unit: string): NormalizedUnit | undefined {
  if (!unit) {
    return undefined;
  }
  const code = normalizeUnitCode(unit);
  return code >= 0 ? (_codeToUnit[code] as NormalizedUnit | undefined) : undefined;
}

const _codeToUnit: string[] = [];
{
  const map: Record<string, UnitCode> = {
    year: YEAR,
    month: MONTH,
    date: DATE,
    day: DAY,
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
  };
  for (const [name, code] of Object.entries(map)) {
    _codeToUnit[code] = name;
  }
}

export function normalizeUnitCode(unit: string): UnitCode {
  if (!unit) {
    return INVALID_UNIT;
  }
  if (unit.length === 1) {
    switch (unit.charCodeAt(0)) {
      case 89:
      case 121:
        return YEAR;
      case 77:
        return MONTH;
      case 68:
        return DATE;
      case 100:
        return DAY;
      case 72:
      case 104:
        return HOUR;
      case 109:
        return MINUTE;
      case 115:
      case 83:
        return SECOND;
      case 119:
        return WEEK;
      case 87:
        return ISO_WEEK;
      case 69:
        return ISO_WEEKDAY;
      case 101:
        return WEEKDAY;
      case 81:
        return QUARTER;
    }
    return INVALID_UNIT;
  }
  if (unit.length === 2) {
    if (unit === "ms") {
      return MILLISECOND;
    }
    if (unit === "gg") {
      return WEEK_YEAR;
    }
    if (unit === "GG") {
      return ISO_WEEK_YEAR;
    }
    if (unit === "Mo" || unit === "mo") {
      return MONTH;
    }
    return INVALID_UNIT;
  }
  switch (unit.toLowerCase()) {
    case "day":
    case "days":
      return DAY;
    case "date":
    case "dates":
      return DATE;
    case "month":
    case "months":
      return MONTH;
    case "year":
    case "years":
      return YEAR;
    case "hour":
    case "hours":
      return HOUR;
    case "minute":
    case "minutes":
      return MINUTE;
    case "second":
    case "seconds":
      return SECOND;
    case "millisecond":
    case "milliseconds":
      return MILLISECOND;
    case "week":
    case "weeks":
      return WEEK;
    case "quarter":
    case "quarters":
      return QUARTER;
    case "weekday":
    case "weekdays":
      return WEEKDAY;
    case "isoweek":
    case "isoweeks":
      return ISO_WEEK;
    case "isoweekday":
    case "isoweekdays":
      return ISO_WEEKDAY;
    case "doy":
    case "ddd":
      return DAY_OF_YEAR;
    case "dayofyear":
    case "dayofyears":
      return DAY_OF_YEAR;
    case "weekyear":
    case "weekyears":
      return WEEK_YEAR;
    case "isoweekyear":
    case "isoweekyears":
      return ISO_WEEK_YEAR;
  }
  return INVALID_UNIT;
}

/**
 * narrowCommonUnit — fast-path narrowing for the most common unit aliases.
 * Returns a UnitCode only for d/Day/date/month/millisecond families.
 * Returns INVALID_UNIT for anything else, letting the caller fall back
 * to normalizeUnitCode or the existing slow path.
 *
 * This is intentionally a separate function from normalizeUnitCode so that
 * callers can thread narrowed units directly to typed fast kernels without
 * paying the full normalization cost for unusual unit tokens.
 */
export function narrowCommonUnit(unit: string): UnitCode {
  if (!unit) {
    return INVALID_UNIT;
  }
  // Single-char fast path for the hottest aliases
  if (unit.length === 1) {
    switch (unit.charCodeAt(0)) {
      case 100:
        return DAY; // "d"
      case 68:
        return DATE; // "D"
      case 77:
        return MONTH; // "M"
      case 109:
        return MINUTE; // "m"
      case 104:
      case 72:
        return HOUR; // "h"/"H"
      case 115:
      case 83:
        return SECOND; // "s"/"S"
      case 81:
        return QUARTER; // "Q"
    }
    return INVALID_UNIT;
  }
  // Two chars: only "ms"
  if (unit.length === 2) {
    if (unit === "ms") {
      return MILLISECOND;
    }
    if (unit === "Mo" || unit === "mo") {
      return MONTH;
    }
    return INVALID_UNIT;
  }
  // Three+ chars: case-insensitive match on common families
  switch (unit.toLowerCase()) {
    case "day":
    case "days":
      return DAY;
    case "date":
    case "dates":
      return DATE;
    case "month":
    case "months":
      return MONTH;
    case "year":
    case "years":
      return YEAR;
    case "hour":
    case "hours":
      return HOUR;
    case "minute":
    case "minutes":
      return MINUTE;
    case "second":
    case "seconds":
      return SECOND;
    case "millisecond":
    case "milliseconds":
      return MILLISECOND;
    case "week":
    case "weeks":
      return WEEK;
    case "quarter":
    case "quarters":
      return QUARTER;
    // Unusual units (isoWeek, dayOfYear, etc.) → let caller fall back
    default:
      return INVALID_UNIT;
  }
}

export function euclideanModulo(value: number, mod: number): number {
  if (!Number.isInteger(value) || !Number.isInteger(mod)) {
    return ((value % mod) + mod) % mod;
  }
  const remainder = value % mod;
  if (remainder < 0) {
    return remainder + mod;
  }
  return remainder === 0 ? 0 : remainder;
}

export function normalizeMonth(m: number): number {
  return euclideanModulo(m, 12);
}

export function roundMomentDays(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function floorUnitEpoch(value: number, unitMs: number): number {
  return value - euclideanModulo(value, unitMs);
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
const EPOCH_DOY_TABLE = new Int32Array([306, 337, 0, 31, 61, 92, 122, 153, 184, 214, 245, 275]);

export function ymdToEpochDays(y: number, m: number, d: number): number {
  if (y >= 1 && y <= 9999 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
    const ya = y - (m <= 1 ? 1 : 0);
    const product = Math.imul(ya, 5243);
    const era = product >>> 21;
    const yoe = ya - era * 400;
    const doe = yoe * 365 + (ya >>> 2) - (product >>> 19) - era * 96 + EPOCH_DOY_TABLE[m] + d - 1;
    return era * 146097 + doe - 719468;
  }

  const ya = y - (m <= 1 ? 1 : 0);
  const era = Math.floor(ya / 400);
  const yoe = ya - era * 400;
  const mp = m >= 2 ? m - 2 : m + 10;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export const SECOND_MS = 1000;
export const MINUTE_MS = 60000;
export const HOUR_MS = 3600000;
export const DAY_MS = 86400000;
const MAX_TIME_MS = 8640000000000000;

/** Pure-arithmetic equivalent of Date.UTC, including normalization and TimeClip. */
// eslint-disable-next-line max-params
export function utcTimestamp(
  year: number,
  month: number,
  day = 1,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): number {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second) ||
    !Number.isFinite(millisecond)
  ) {
    return NaN;
  }

  let y = Math.trunc(year);
  let m = Math.trunc(month);
  const d = Math.trunc(day);
  const h = Math.trunc(hour);
  const min = Math.trunc(minute);
  const s = Math.trunc(second);
  const ms = Math.trunc(millisecond);
  if (y >= 0 && y <= 99) {
    y += 1900;
  }
  if (m < 0 || m > 11) {
    y += Math.floor(m / 12);
    m = normalizeMonth(m);
  }

  const value =
    ymdToEpochDays(y, m, d) * DAY_MS + h * HOUR_MS + min * MINUTE_MS + s * SECOND_MS + ms;
  return Math.abs(value) <= MAX_TIME_MS ? Math.trunc(value) : NaN;
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

const DAYS_IN_MONTH = new Int8Array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);

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

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function firstWeekOffset(year: number, dow: number, doy: number): number {
  const fwd = 7 + dow - doy;
  const epochDays = ymdToEpochDays(Math.trunc(year), 0, fwd);
  if (!Number.isFinite(year) || Math.abs(epochDays * DAY_MS) > MAX_TIME_MS) {
    return NaN;
  }
  const janFwdDay = euclideanModulo(epochDays + 4, 7);
  const fwdlw = (7 + janFwdDay - dow) % 7;
  return -fwdlw + fwd - 1;
}

export function weeksInYear(year: number, dow: number, doy: number): number {
  const weekOffset = firstWeekOffset(year, dow, doy);
  const weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
  return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
}

export function weekDateToDayOfYear(
  year: number,
  week: number,
  weekday: number,
  dow: number,
  doy: number,
): number {
  return 1 + firstWeekOffset(year, dow, doy) + (week - 1) * 7 + weekday;
}

export function weekDateToYearMonthDay(
  year: number,
  week: number,
  weekday: number,
  dow: number,
  doy: number,
): [number, number, number] {
  let targetYear = Math.trunc(year);
  let dayOfYear = weekDateToDayOfYear(targetYear, week, weekday, dow, doy);
  if (dayOfYear <= 0) {
    targetYear--;
    dayOfYear += daysInYear(targetYear);
  } else {
    const yearDays = daysInYear(targetYear);
    if (dayOfYear > yearDays) {
      targetYear++;
      dayOfYear -= yearDays;
    }
  }

  const ladder = isLeapYear(targetYear) ? _leapLadder : _nonLeapLadder;
  let month = 11;
  while (month > 0 && dayOfYear <= ladder[month]) {
    month--;
  }
  return [targetYear, month, dayOfYear - ladder[month]];
}

const _nonLeapLadder = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const _leapLadder = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

export function getDayOfYear(year: number, month: number, day: number): number {
  if (Math.abs(ymdToEpochDays(year, 0, 1) * DAY_MS) > MAX_TIME_MS) {
    return NaN;
  }
  return day + (isLeapYear(year) ? _leapLadder : _nonLeapLadder)[month];
}

export function getISOWeekNumber(year: number, month: number, day: number): number {
  const weekOffset = firstWeekOffset(year, 1, 4);
  const dayOfYear = getDayOfYear(year, month, day);
  let week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    week += weeksInYear(year - 1, 1, 4);
  } else {
    const yearWeeks = weeksInYear(year, 1, 4);
    if (week > yearWeeks) {
      return 1;
    }
  }
  return week;
}

export function getISOWeekYear(year: number, month: number, day: number): number {
  const weekOffset = firstWeekOffset(year, 1, 4);
  const dayOfYear = getDayOfYear(year, month, day);
  const week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    return year - 1;
  }
  if (week > weeksInYear(year, 1, 4)) {
    return year + 1;
  }
  return year;
}

export function getLocaleWeek(
  year: number,
  month: number,
  day: number,
  dow: number,
  doy: number,
): number {
  const weekOffset = firstWeekOffset(year, dow, doy);
  const dayOfYear = getDayOfYear(year, month, day);
  let week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    week += weeksInYear(year - 1, dow, doy);
  } else {
    const yearWeeks = weeksInYear(year, dow, doy);
    if (week > yearWeeks) {
      week = 1;
    }
  }
  return week;
}

export function getLocaleWeekYear(
  year: number,
  month: number,
  day: number,
  dow: number,
  doy: number,
): number {
  const weekOffset = firstWeekOffset(year, dow, doy);
  const dayOfYear = getDayOfYear(year, month, day);
  const week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    return year - 1;
  }
  if (week > weeksInYear(year, dow, doy)) {
    return year + 1;
  }
  return year;
}
