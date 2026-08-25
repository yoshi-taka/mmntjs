import type { MomentConstructionConfig } from "../moment-class";
import { Moment, checkOverflow, createMomentFromDate, createSimpleMoment } from "../moment-class";
import type { InternalParsedData, FastZonedISO, FastLocalISO, ParseFailed } from "../types";
import {
  isMoment,
  isDate,
  isString,
  isArray,
  isObject,
  isNumber,
  createDateSafe,
  createUTCDate,
} from "../utils";
import { daysInMonthFast } from "../units";
import {
  getLocale,
  getCurrentLocale,
  localeConfigs,
  localeHasMissingParent,
} from "../locale-runtime";
import { enLocale } from "../locale/en";
import type { ParseLocale } from "../parse-locale";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedDataLike = Record<string, any>;

type FormattedStringInputHandler = (args: {
  str: string;
  format?: unknown;
  localeOrStrict?: unknown;
  fourthArg?: unknown;
  deps: {
    parseString: (
      str: string,
      format?: string | string[],
      locale?: ParseLocale,
      strict?: boolean,
    ) => ParsedDataLike | null;
    isCustomFormatParsingEnabled: () => boolean;
  };
  createMomentFromParsed: (
    parsed: ParsedDataLike,
    str?: string,
    format?: string,
    locale?: string,
    strict?: boolean,
  ) => Moment;
}) => Moment;
type ArrayInputHandler = (
  arr: unknown[],
  parseArray: (arr: unknown[]) => ParsedDataLike | null,
  nowFn: () => number,
  isUTC?: boolean,
) => Moment;
type ObjectInputHandler = (
  obj: Record<string, unknown>,
  parseObject: (obj: Record<string, unknown>) => InternalParsedData,
  nowFn: () => number,
) => Moment;

export type FactoryDeps = {
  parseString: (
    str: string,
    format?: string | string[],
    locale?: ParseLocale,
    strict?: boolean,
  ) => ParsedDataLike | null;
  parseArray?: (arr: unknown[]) => ParsedDataLike | null;
  parseObject?: (obj: Record<string, unknown>) => InternalParsedData;
  isCustomFormatParsingEnabled: () => boolean;
  supportsFormattedInput?: boolean | (() => boolean);
  createFromFormattedStringInput?: FormattedStringInputHandler;
  createFromArrayInput?: ArrayInputHandler;
  createFromObjectInput?: ObjectInputHandler;
  nowFn: () => number;
};

/** Typed fast parser: YYYY-MM-DDTHH:mm:ss.SSSZ (fixed 24-char). */
function parseFixedISOZ(str: string): FastZonedISO | ParseFailed {
  if (str.length !== 24) {
    return { kind: "fail" };
  }
  if (
    str.charCodeAt(4) !== 45 ||
    str.charCodeAt(7) !== 45 ||
    str.charCodeAt(10) !== 84 ||
    str.charCodeAt(13) !== 58 ||
    str.charCodeAt(16) !== 58 ||
    str.charCodeAt(19) !== 46 ||
    str.charCodeAt(23) !== 90
  ) {
    return { kind: "fail" };
  }
  const y0 = str.charCodeAt(0) - 48;
  if (y0 < 0 || y0 > 9) {
    return { kind: "fail" };
  }
  const y1 = str.charCodeAt(1) - 48;
  if (y1 < 0 || y1 > 9) {
    return { kind: "fail" };
  }
  const y2 = str.charCodeAt(2) - 48;
  if (y2 < 0 || y2 > 9) {
    return { kind: "fail" };
  }
  const y3 = str.charCodeAt(3) - 48;
  if (y3 < 0 || y3 > 9) {
    return { kind: "fail" };
  }
  const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
  const m0 = str.charCodeAt(5) - 48;
  if (m0 < 0 || m0 > 9) {
    return { kind: "fail" };
  }
  const m1 = str.charCodeAt(6) - 48;
  if (m1 < 0 || m1 > 9) {
    return { kind: "fail" };
  }
  const month = m0 * 10 + m1;
  if (month < 1 || month > 12) {
    return { kind: "fail" };
  }
  const d0 = str.charCodeAt(8) - 48;
  if (d0 < 0 || d0 > 9) {
    return { kind: "fail" };
  }
  const d1 = str.charCodeAt(9) - 48;
  if (d1 < 0 || d1 > 9) {
    return { kind: "fail" };
  }
  const day = d0 * 10 + d1;
  const monthIdx = month - 1;
  if (day < 1 || day > daysInMonthFast(year, monthIdx)) {
    return { kind: "fail" };
  }
  const h0 = str.charCodeAt(11) - 48;
  if (h0 < 0 || h0 > 9) {
    return { kind: "fail" };
  }
  const h1 = str.charCodeAt(12) - 48;
  if (h1 < 0 || h1 > 9) {
    return { kind: "fail" };
  }
  const hour = h0 * 10 + h1;
  if (hour < 0 || hour > 23) {
    return { kind: "fail" };
  }
  const mi0 = str.charCodeAt(14) - 48;
  if (mi0 < 0 || mi0 > 9) {
    return { kind: "fail" };
  }
  const mi1 = str.charCodeAt(15) - 48;
  if (mi1 < 0 || mi1 > 9) {
    return { kind: "fail" };
  }
  const minute = mi0 * 10 + mi1;
  if (minute < 0 || minute > 59) {
    return { kind: "fail" };
  }
  const s0 = str.charCodeAt(17) - 48;
  if (s0 < 0 || s0 > 9) {
    return { kind: "fail" };
  }
  const s1 = str.charCodeAt(18) - 48;
  if (s1 < 0 || s1 > 9) {
    return { kind: "fail" };
  }
  const second = s0 * 10 + s1;
  if (second < 0 || second > 59) {
    return { kind: "fail" };
  }
  const ms0 = str.charCodeAt(20) - 48;
  if (ms0 < 0 || ms0 > 9) {
    return { kind: "fail" };
  }
  const ms1 = str.charCodeAt(21) - 48;
  if (ms1 < 0 || ms1 > 9) {
    return { kind: "fail" };
  }
  const ms2 = str.charCodeAt(22) - 48;
  if (ms2 < 0 || ms2 > 9) {
    return { kind: "fail" };
  }
  const ms = ms0 * 100 + ms1 * 10 + ms2;
  return {
    kind: "zoned",
    y: year,
    M: monthIdx,
    D: day,
    H: hour,
    m: minute,
    s: second,
    ms,
    offset: 0,
  };
}

/** Typed fast parser: YYYY-MM-DD (fixed 10-char, local interpretation). */
function parseFixedLocalDate(str: string, separator = 45): FastLocalISO | ParseFailed {
  if (str.length !== 10) {
    return { kind: "fail" };
  }
  if (str.charCodeAt(4) !== separator || str.charCodeAt(7) !== separator) {
    return { kind: "fail" };
  }
  const y0 = str.charCodeAt(0) - 48;
  if (y0 < 0 || y0 > 9) {
    return { kind: "fail" };
  }
  const y1 = str.charCodeAt(1) - 48;
  if (y1 < 0 || y1 > 9) {
    return { kind: "fail" };
  }
  const y2 = str.charCodeAt(2) - 48;
  if (y2 < 0 || y2 > 9) {
    return { kind: "fail" };
  }
  const y3 = str.charCodeAt(3) - 48;
  if (y3 < 0 || y3 > 9) {
    return { kind: "fail" };
  }
  const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
  const m0 = str.charCodeAt(5) - 48;
  if (m0 < 0 || m0 > 9) {
    return { kind: "fail" };
  }
  const m1 = str.charCodeAt(6) - 48;
  if (m1 < 0 || m1 > 9) {
    return { kind: "fail" };
  }
  const month01 = m0 * 10 + m1;
  if (month01 < 1 || month01 > 12) {
    return { kind: "fail" };
  }
  const d0 = str.charCodeAt(8) - 48;
  if (d0 < 0 || d0 > 9) {
    return { kind: "fail" };
  }
  const d1 = str.charCodeAt(9) - 48;
  if (d1 < 0 || d1 > 9) {
    return { kind: "fail" };
  }
  const day = d0 * 10 + d1;
  const monthIdx = month01 - 1;
  if (day < 1 || day > daysInMonthFast(year, monthIdx)) {
    return { kind: "fail" };
  }
  return { kind: "local", y: year, M: monthIdx, D: day };
}

function parseBasicLocalDateTime(
  str: string,
):
  | { kind: "local"; y: number; M: number; D: number; H: number; m: number; s: number }
  | ParseFailed {
  if (str.length !== 15 || str.charCodeAt(8) !== 84) {
    return { kind: "fail" };
  }
  const digit = (index: number): number => {
    const value = str.charCodeAt(index) - 48;
    return value >= 0 && value <= 9 ? value : -1;
  };
  const y0 = digit(0);
  const y1 = digit(1);
  const y2 = digit(2);
  const y3 = digit(3);
  const mo0 = digit(4);
  const mo1 = digit(5);
  const d0 = digit(6);
  const d1 = digit(7);
  const h0 = digit(9);
  const h1 = digit(10);
  const mi0 = digit(11);
  const mi1 = digit(12);
  const s0 = digit(13);
  const s1 = digit(14);
  if (
    y0 < 0 ||
    y1 < 0 ||
    y2 < 0 ||
    y3 < 0 ||
    mo0 < 0 ||
    mo1 < 0 ||
    d0 < 0 ||
    d1 < 0 ||
    h0 < 0 ||
    h1 < 0 ||
    mi0 < 0 ||
    mi1 < 0 ||
    s0 < 0 ||
    s1 < 0
  ) {
    return { kind: "fail" };
  }
  const y = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
  const M = mo0 * 10 + mo1 - 1;
  const D = d0 * 10 + d1;
  const H = h0 * 10 + h1;
  const m = mi0 * 10 + mi1;
  const s = s0 * 10 + s1;
  if (
    M < 0 ||
    M > 11 ||
    D < 1 ||
    D > daysInMonthFast(y, M) ||
    H > 24 ||
    (H === 24 && (m !== 0 || s !== 0)) ||
    m > 59 ||
    s > 59
  ) {
    return { kind: "fail" };
  }
  return { kind: "local", y, M, D, H, m, s };
}

function parseEnglishLongMonthDate(str: string): FastLocalISO | ParseFailed {
  if (str.length < 11 || str.charCodeAt(2) !== 32 || str.charCodeAt(str.length - 5) !== 32) {
    return { kind: "fail" };
  }
  const d0 = str.charCodeAt(0) - 48;
  const d1 = str.charCodeAt(1) - 48;
  const y0 = str.charCodeAt(str.length - 4) - 48;
  const y1 = str.charCodeAt(str.length - 3) - 48;
  const y2 = str.charCodeAt(str.length - 2) - 48;
  const y3 = str.charCodeAt(str.length - 1) - 48;
  if (
    d0 < 0 ||
    d0 > 9 ||
    d1 < 0 ||
    d1 > 9 ||
    y0 < 0 ||
    y0 > 9 ||
    y1 < 0 ||
    y1 > 9 ||
    y2 < 0 ||
    y2 > 9 ||
    y3 < 0 ||
    y3 > 9
  ) {
    return { kind: "fail" };
  }
  const M =
    str.startsWith("January", 3) && str.length === 15
      ? 0
      : str.startsWith("February", 3) && str.length === 16
        ? 1
        : str.startsWith("March", 3) && str.length === 13
          ? 2
          : str.startsWith("April", 3) && str.length === 13
            ? 3
            : str.startsWith("May", 3) && str.length === 11
              ? 4
              : str.startsWith("June", 3) && str.length === 12
                ? 5
                : str.startsWith("July", 3) && str.length === 12
                  ? 6
                  : str.startsWith("August", 3) && str.length === 14
                    ? 7
                    : str.startsWith("September", 3) && str.length === 17
                      ? 8
                      : str.startsWith("October", 3) && str.length === 15
                        ? 9
                        : str.startsWith("November", 3) && str.length === 16
                          ? 10
                          : str.startsWith("December", 3) && str.length === 16
                            ? 11
                            : -1;
  const y = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
  const D = d0 * 10 + d1;
  if (M < 0 || D < 1 || D > daysInMonthFast(y, M)) {
    return { kind: "fail" };
  }
  return { kind: "local", y, M, D };
}

export function createMomentFactory(deps: FactoryDeps) {
  function createMomentFromParsed(
    parsed: ParsedDataLike,
    str?: string,
    format?: string,
    locale?: string,
    strict?: boolean,
  ): Moment {
    if (
      (parsed.isoWeekYear ?? parsed._weekYear) !== undefined &&
      (parsed.isoWeek ?? parsed._week) !== undefined &&
      parsed.year === undefined
    ) {
      const isoWeekYear = parsed.isoWeekYear ?? parsed._weekYear;
      const isoWeek = parsed.isoWeek ?? parsed._week;
      const useUtc = parsed.offset !== undefined;
      const makeDate = useUtc
        ? createUTCDate
        : (y: number, m: number, d = 1) => {
            if (y >= 0 && y <= 99) {
              const date = new Date(0);
              date.setFullYear(y, m, d);
              date.setHours(0, 0, 0, 0);
              return date;
            }
            return new Date(y, m, d);
          };
      const jan4 = makeDate(isoWeekYear, 0, 4);
      const dayOfJan4 = useUtc ? jan4.getUTCDay() || 7 : jan4.getDay() || 7;
      // ISO week overflow check (moment.js compat)
      const jan1 = makeDate(isoWeekYear, 0, 1);
      const dayOfJan1 = useUtc ? jan1.getUTCDay() || 7 : jan1.getDay() || 7;
      const isLeap = (isoWeekYear % 4 === 0 && isoWeekYear % 100 !== 0) || isoWeekYear % 400 === 0;
      const maxWeeks = dayOfJan1 === 4 || (dayOfJan1 === 3 && isLeap) ? 53 : 52;
      if (isoWeek < 1 || isoWeek > maxWeeks) {
        return new Moment({
          _d: new Date(NaN),
          _dClone: false,
          _i: str,
          _f: format,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _parsedDateParts: parsed._parsedDateParts,
          _unusedTokens: parsed._unusedTokens,
          _unusedInput: parsed._unusedInput,
          _charsLeftOver: parsed._charsLeftOver,
          _nullInput: false,
        });
      }
      const week1Start = makeDate(isoWeekYear, 0, 4 - (dayOfJan4 - 1));
      const weekday = parsed._weekdayNum ?? 1;
      const d = new Date(week1Start.getTime() + ((isoWeek - 1) * 7 + (weekday - 1)) * 86400000);
      if (!useUtc) {
        const offsetShift = d.getTimezoneOffset() - week1Start.getTimezoneOffset();
        if (offsetShift !== 0) {
          d.setTime(d.getTime() + offsetShift * 60000);
        }
      }
      if (parsed.hour !== undefined) {
        if (useUtc) {
          d.setUTCHours(
            parsed.hour,
            parsed.minute ?? 0,
            parsed.second ?? 0,
            parsed.millisecond ?? 0,
          );
        } else {
          d.setHours(parsed.hour, parsed.minute ?? 0, parsed.second ?? 0, parsed.millisecond ?? 0);
        }
      }
      return new Moment({
        _d: d,
        _i: str,
        _f: format,
        _l: locale,
        _strict: strict,
        _offset: parsed.offset,
        _isUTC: parsed.offset !== undefined,
        _unusedTokens: parsed._unusedTokens,
        _unusedInput: parsed._unusedInput,
        _charsLeftOver: parsed._charsLeftOver,
        _empty: parsed._empty,
        _invalidMonth: parsed._invalidMonth,
        _weekdayMismatch: parsed._weekdayMismatch,
        _parsedDateParts: parsed._parsedDateParts,
        _meridiem: parsed._meridiem,
        _iso: parsed._iso,
        _rfc2822: parsed._rfc2822,
      });
    }
    let y = parsed.year;
    let mo = parsed.month;
    let d = parsed.day;
    if (parsed.dayOfYear !== undefined && mo === undefined && d === undefined) {
      const year0 = y !== undefined ? y : new Date(deps.nowFn()).getFullYear();
      // dayOfYear overflow check (moment.js compat)
      const daysMax = (year0 % 4 === 0 && year0 % 100 !== 0) || year0 % 400 === 0 ? 366 : 365;
      if (parsed.dayOfYear < 1 || parsed.dayOfYear > daysMax) {
        return new Moment({
          _d: new Date(NaN),
          _dClone: false,
          _i: str,
          _f: format,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _parsedDateParts: parsed._parsedDateParts,
          _unusedTokens: parsed._unusedTokens,
          _unusedInput: parsed._unusedInput,
          _charsLeftOver: parsed._charsLeftOver,
          _nullInput: false,
        });
      }
      const date = createUTCDate(year0, 0, parsed.dayOfYear);
      y = date.getUTCFullYear();
      mo = date.getUTCMonth();
      d = date.getUTCDate();
    } else {
      const now = new Date(deps.nowFn());
      const currentYear = parsed.offset !== undefined ? now.getUTCFullYear() : now.getFullYear();
      const currentMonth = parsed.offset !== undefined ? now.getUTCMonth() : now.getMonth();
      const currentDay = parsed.offset !== undefined ? now.getUTCDate() : now.getDate();
      if (y === undefined) {
        y = currentYear;
        if (mo === undefined) {
          mo = currentMonth;
          if (d === undefined) {
            d = currentDay;
          }
        }
      }
      if (mo === undefined) {
        mo = 0;
      }
      if (d === undefined) {
        d = 1;
      }
    }
    const overflow = checkOverflow({
      year: y,
      month: mo,
      day: d,
      hour: parsed.hour,
      minute: parsed.minute,
      second: parsed.second,
      millisecond: parsed.millisecond,
    });
    const date =
      parsed.offset !== undefined
        ? createUTCDate(
            y,
            mo,
            d,
            parsed.hour ?? 0,
            parsed.minute ?? 0,
            parsed.second ?? 0,
            parsed.millisecond ?? 0,
          )
        : createDateSafe(
            y,
            mo,
            d,
            parsed.hour ?? 0,
            parsed.minute ?? 0,
            parsed.second ?? 0,
            parsed.millisecond ?? 0,
            false,
          );
    return new Moment({
      _d: date,
      _i: str,
      _f: format,
      _l: locale,
      _strict: strict,
      _offset: parsed.offset,
      _isUTC: parsed.offset !== undefined,
      _overflow: overflow >= 0 ? overflow : undefined,
      _isValid: overflow < 0 && isFinite(date.getTime()),
      _unusedTokens: parsed._unusedTokens,
      _unusedInput: parsed._unusedInput,
      _charsLeftOver: parsed._charsLeftOver,
      _empty: parsed._empty,
      _invalidMonth: parsed._invalidMonth,
      _weekdayMismatch: parsed._weekdayMismatch,
      _parsedDateParts: parsed._parsedDateParts,
      _meridiem: parsed._meridiem,
      _iso: parsed._iso,
      _rfc2822: parsed._rfc2822,
    });
  }

  function createFromString(
    str: string,
    format?: unknown,
    localeOrStrict?: unknown,
    fourthArg?: unknown,
  ): Moment {
    const directFormat = typeof format === "string" ? format : undefined;
    if (directFormat === "YYYY-MM-DDTHH:mm:ss.SSSZ" || directFormat === "YYYY-MM-DDTHH:mm:ssZ") {
      const z = parseFixedISOZ(str);
      if (z.kind === "zoned") {
        const d = createUTCDate(z.y, z.M, z.D, z.H, z.m, z.s, z.ms);
        return new Moment({
          _d: d,
          _dClone: false,
          _isUTC: true,
          _offset: 0,
          _i: str,
          _f: directFormat,
          _presetFields: { y: z.y, M: z.M, D: z.D, H: z.H, m: z.m, s: z.s, ms: z.ms },
        });
      }
    }
    if (directFormat === "YYYY-MM-DD") {
      const p = parseFixedLocalDate(str);
      if (p.kind === "local") {
        const d = createDateSafe(p.y, p.M, p.D, 0, 0, 0, 0, false);
        return new Moment({
          _d: d,
          _dClone: false,
          _i: str,
          _f: directFormat,
          _presetFields: { y: p.y, M: p.M, D: p.D, H: 0, m: 0, s: 0, ms: 0 },
        });
      }
    }
    if (directFormat === "YYYY/MM/DD" && deps.isCustomFormatParsingEnabled()) {
      const p = parseFixedLocalDate(str, 47);
      if (p.kind === "local") {
        const d = createDateSafe(p.y, p.M, p.D, 0, 0, 0, 0, false);
        return new Moment({
          _d: d,
          _dClone: false,
          _i: str,
          _f: directFormat,
          _presetFields: { y: p.y, M: p.M, D: p.D, H: 0, m: 0, s: 0, ms: 0 },
        });
      }
    }
    if (directFormat === "YYYYMMDD[T]HHmmss" && deps.isCustomFormatParsingEnabled()) {
      const p = parseBasicLocalDateTime(str);
      if (p.kind === "local") {
        const d = createDateSafe(p.y, p.M, p.D, p.H, p.m, p.s, 0, false);
        return new Moment({
          _d: d,
          _dClone: false,
          _i: str,
          _f: directFormat,
          _presetFields:
            p.H === 24 ? undefined : { y: p.y, M: p.M, D: p.D, H: p.H, m: p.m, s: p.s, ms: 0 },
        });
      }
    }
    if (
      directFormat === "DD MMMM YYYY" &&
      deps.isCustomFormatParsingEnabled() &&
      (typeof localeOrStrict === "string" ? localeOrStrict === "en" : getCurrentLocale() === "en")
    ) {
      const p = parseEnglishLongMonthDate(str);
      if (p.kind === "local" && localeConfigs.en?.months === enLocale.months) {
        const d = createDateSafe(p.y, p.M, p.D, 0, 0, 0, 0, false);
        return new Moment({
          _d: d,
          _dClone: false,
          _i: str,
          _f: directFormat,
          _presetFields: { y: p.y, M: p.M, D: p.D, H: 0, m: 0, s: 0, ms: 0 },
        });
      }
    }
    const z = format === undefined ? parseFixedISOZ(str) : { kind: "fail" as const };
    if (z.kind === "zoned") {
      const d = createUTCDate(z.y, z.M, z.D, z.H, z.m, z.s, z.ms);
      return new Moment({
        _d: d,
        _dClone: false,
        _isUTC: true,
        _offset: 0,
        _i: str,
        _presetFields: { y: z.y, M: z.M, D: z.D, H: z.H, m: z.m, s: z.s, ms: z.ms },
      });
    }
    const p = format === undefined ? parseFixedLocalDate(str) : { kind: "fail" as const };
    if (p.kind === "local") {
      const d = createDateSafe(p.y, p.M, p.D, 0, 0, 0, 0, false);
      return new Moment({
        _d: d,
        _dClone: false,
        _i: str,
        _presetFields: { y: p.y, M: p.M, D: p.D, H: 0, m: 0, s: 0, ms: 0 },
      });
    }
    const supportsFormattedInput =
      typeof deps.supportsFormattedInput === "function"
        ? deps.supportsFormattedInput()
        : (deps.supportsFormattedInput ?? true);
    let strict = false;
    let locale: string | undefined;
    let fmt: string | string[] | undefined;
    if (typeof format === "boolean") {
      strict = format;
    } else if (typeof localeOrStrict === "boolean") {
      fmt = format as string | string[] | undefined;
      strict = localeOrStrict;
    } else {
      fmt = format as string | string[] | undefined;
      if (typeof localeOrStrict === "string") {
        locale = localeOrStrict;
        if (locale && localeHasMissingParent(locale)) {
          locale = "en";
        }
      }
      if (typeof fourthArg === "boolean") {
        strict = fourthArg;
      }
    }
    if (fmt) {
      if (!supportsFormattedInput || !deps.createFromFormattedStringInput) {
        return new Moment({
          _dClone: false,
          _d: new Date(NaN),
          _i: str,
          _f: fmt,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _invalidFormat: isArray(fmt) ? fmt.length === 0 : undefined,
        });
      }
      return deps.createFromFormattedStringInput({
        str,
        format,
        localeOrStrict,
        fourthArg,
        deps: {
          parseString: deps.parseString,
          isCustomFormatParsingEnabled: deps.isCustomFormatParsingEnabled,
        },
        createMomentFromParsed,
      });
    }
    const parsed = deps.parseString(
      str,
      undefined,
      getLocale(getCurrentLocale()) as unknown as ParseLocale,
    );
    if (parsed && !parsed._claimed) {
      if (parsed._hasDate !== undefined) {
        return createMomentFromDate({
          _d: createDateSafe(
            parsed.year,
            parsed.month,
            parsed.day,
            parsed.hour ?? 0,
            parsed.minute ?? 0,
            parsed.second ?? 0,
            parsed.millisecond ?? 0,
            parsed.offset !== undefined,
          ),
          _offset: parsed.offset,
          _isUTC: parsed.offset !== undefined,
          _i: str,
          _dClone: false,
        });
      }
      return createMomentFromParsed(parsed, str);
    }
    return new Moment({ _dClone: false, _d: new Date(str), _i: str });
  }

  function createFromArray(arr: unknown[], isUTC?: boolean): Moment {
    if (!deps.parseArray || !deps.createFromArrayInput) {
      return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });
    }
    return deps.createFromArrayInput(arr, deps.parseArray, deps.nowFn, isUTC);
  }

  function createFromObject(obj: Record<string, unknown>): Moment {
    if (!deps.parseObject || !deps.createFromObjectInput) {
      return new Moment({ _dClone: false, _d: new Date(NaN), _i: obj, _isValid: false });
    }
    return deps.createFromObjectInput(obj, deps.parseObject, deps.nowFn);
  }

  return function moment(
    input?: unknown,
    format?: unknown,
    localeOrStrict?: unknown,
    fourthArg?: unknown,
  ): Moment {
    if (input === null) {
      return new Moment({
        _dClone: false,
        _d: new Date(NaN),
        _i: input,
        _isValid: false,
        _nullInput: true,
        _overflow: -1,
      });
    }
    if (input === undefined) {
      if (
        format !== undefined &&
        typeof format !== "boolean" &&
        !(isArray(format) && format.length === 0)
      ) {
        return new Moment({
          _dClone: false,
          _d: new Date(NaN),
          _i: input,
          _f: format as string | string[],
          _isValid: false,
          _nullInput: true,
        });
      }
      return new Moment({
        _t: deps.nowFn(),
        _isUTC: false,
        _offset: 0,
        _isValid: true,
      });
    }
    if (isMoment(input)) {
      return (input as unknown as Moment).clone();
    }
    if (isObject(input) && input._isAMomentObject) {
      const obj = input as unknown as MomentConstructionConfig;
      const cfg: MomentConstructionConfig = {
        _d: obj._d ? new Date(obj._d.getTime()) : new Date(NaN),
        _i: obj._i ?? input,
        _f: obj._f,
        _l: obj._l,
        _isValid: obj._isValid ?? true,
        _isUTC: obj._isUTC ?? false,
        _offset: obj._offset ?? 0,
        _strict: obj._strict ?? false,
        _overflow: obj._overflow ?? -1,
        _parsedDateParts: obj._parsedDateParts ?? [],
      };
      if (obj._unusedTokens) {
        cfg._unusedTokens = obj._unusedTokens;
      }
      if (obj._unusedInput) {
        cfg._unusedInput = obj._unusedInput;
      }
      if (obj._charsLeftOver !== undefined) {
        cfg._charsLeftOver = obj._charsLeftOver;
      }
      if (obj._empty !== undefined) {
        cfg._empty = obj._empty;
      }
      if (obj._nullInput !== undefined) {
        cfg._nullInput = obj._nullInput;
      }
      if (obj._invalidMonth !== undefined) {
        cfg._invalidMonth = obj._invalidMonth;
      }
      if (obj._meridiem !== undefined) {
        cfg._meridiem = obj._meridiem;
      }
      if (obj._iso !== undefined) {
        cfg._iso = obj._iso;
      }
      if (obj._rfc2822 !== undefined) {
        cfg._rfc2822 = obj._rfc2822;
      }
      if (obj._weekdayMismatch !== undefined) {
        cfg._weekdayMismatch = obj._weekdayMismatch;
      }
      return new Moment(cfg);
    }
    if (isDate(input)) {
      return createMomentFromDate({ _d: input, _i: input });
    }
    if (isNumber(input)) {
      const n = input;
      if (isNaN(n) || !isFinite(n)) {
        return new Moment({ _dClone: false, _t: NaN, _isValid: false, _i: input });
      }
      if (format === "X") {
        return createSimpleMoment({ _t: n * 1000, _i: input, _f: "X" });
      }
      if (format === "x") {
        return createSimpleMoment({ _t: n, _i: input, _f: "x" });
      }
      if (format !== undefined) {
        return new Moment({
          _dClone: false,
          _t: NaN,
          _isValid: false,
          _overflow: -1,
          _i: input,
          _f: format as string,
        });
      }
      return createSimpleMoment({ _t: n, _i: input });
    }
    if (isString(input)) {
      return createFromString(input, format, localeOrStrict, fourthArg);
    }
    if (isArray(input)) {
      const arr = input;
      if (arr.length === 0 && (format === "X" || format === "x")) {
        return new Moment({
          _dClone: false,
          _d: new Date(NaN),
          _i: arr,
          _isValid: false,
          _f: format as string,
        });
      }
      return createFromArray(arr);
    }
    if (isObject(input)) {
      return createFromObject(input);
    }
    return new Moment({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
  };
}
