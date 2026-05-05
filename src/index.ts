import type {
  MomentConfig} from "./moment_fixed";
import {
  Moment,
  momentProperties,
  setUpdateOffsetCallback,
  getUpdateOffsetCallback,
  setRelTimeRounding,
  setRelTimeThreshold,
  checkOverflow,
} from "./moment_fixed";
import { Duration, isDuration as checkIsDuration } from "./duration_fixed";
import {
  isMoment,
  isDate,
  isString,
  isArray,
  isObject,
  isNumber,
  isObjectEmpty,
  createDate,
  createDateSafe,
  createUTCDate,
} from "./utils";
import { normalizeUnits as normUnits, isLeapYear } from "./units";
import {
  getLocale,
  setLocale,
  setLocaleFromArray,
  getCurrentLocale,
  defineLocale,
  updateLocale,
  getMonths,
  getWeekdays,
  Locale,
  listLocales,
  localeHasMissingParent,
} from "./locale";
import type { LocaleSpec } from "./locale/en";
import {
  parseString,
  parseArray,
  parseObject,
  parseTwoDigitYear as parseTwoDigitYearInternal,
  setParseTwoDigitYear,
} from "./parse";
import { configure, report as reportFn } from "./migration";

export type { MomentConfig } from "./moment_fixed";
export type { DurationInput } from "./duration_fixed";
export type { LocaleSpec } from "./locale/en";

let momentNowFn: (() => number) | undefined;

function nowFn(): number {
  if (momentNowFn) {return momentNowFn();}
  return Date.now();
}

function moment(input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment {
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
      !(isArray(format) && (format as unknown[]).length === 0)
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
    // Fast path: bypass Moment constructor to avoid ~30 property assignments + getCurrentLocale() call
    const m = Object.create(Moment.prototype) as Moment;
    m._isAMomentObject = true;
    m._isUTC = false;
    m._offset = 0;
    m._t = momentNowFn ? momentNowFn() : Date.now();
    m._isValid = true;
    m._dirty = true;
    return m;
  }
  if (isMoment(input)) {return (input as Moment).clone();}
  if (isObject(input) && (input as Record<string, unknown>)._isAMomentObject) {
    const obj = input as Record<string, unknown>;
    const cfg: MomentConfig = {
      _d: obj._d ? new Date(obj._d.getTime()) : new Date(NaN),
      _i: obj._i !== undefined ? obj._i : input,
      _f: obj._f,
      _l: obj._l,
      _isValid: obj._isValid !== undefined ? obj._isValid : true,
      _isUTC: obj._isUTC || false,
      _offset: obj._offset !== undefined ? obj._offset : 0,
      _strict: obj._strict || false,
      _overflow: obj._overflow !== undefined ? obj._overflow : -1,
      _parsedDateParts: obj._parsedDateParts || [],
    };
    if (obj._unusedTokens) {cfg._unusedTokens = obj._unusedTokens;}
    if (obj._unusedInput) {cfg._unusedInput = obj._unusedInput;}
    if (obj._charsLeftOver !== undefined) {cfg._charsLeftOver = obj._charsLeftOver;}
    if (obj._empty !== undefined) {cfg._empty = obj._empty;}
    if (obj._nullInput !== undefined) {cfg._nullInput = obj._nullInput;}
    if (obj._invalidMonth !== undefined) {cfg._invalidMonth = obj._invalidMonth;}
    if (obj._meridiem !== undefined) {cfg._meridiem = obj._meridiem;}
    if (obj._iso !== undefined) {cfg._iso = obj._iso;}
    if (obj._rfc2822 !== undefined) {cfg._rfc2822 = obj._rfc2822;}
    if (obj._weekdayMismatch !== undefined) {cfg._weekdayMismatch = obj._weekdayMismatch;}
    return new Moment(cfg);
  }
  if (isDate(input)) {return new Moment({ _dClone: false, _d: new Date((input as Date).getTime()), _i: input });}
  if (isNumber(input)) {
    const n = input as number;
    if (isNaN(n) || !isFinite(n))
      {return new Moment({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });}
    if (format === "X") {return new Moment({ _dClone: false, _d: new Date(n * 1000), _i: input, _f: "X" });}
    if (format === "x") {return new Moment({ _dClone: false, _d: new Date(n), _i: input, _f: "x" });}
    if (format !== undefined)
      {return new Moment({
        _dClone: false,
        _d: new Date(NaN),
        _isValid: false,
        _overflow: -1,
        _i: input,
        _f: format as string,
      });}
    return new Moment({ _dClone: false, _d: new Date(n), _i: input });
  }
  if (isString(input)) {return createFromString(input as string, format, localeOrStrict, fourthArg);}
  if (isArray(input)) {
    const arr = input as unknown[];
    if (arr.length === 0 && (format === "X" || format === "x")) {
      return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false, _f: format as string });
    }
    return createFromArray(arr);
  }
  if (isObject(input)) {return createFromObject(input as Record<string, unknown>);}
  return new Moment({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
}

function hasAnyValue(parsed: Record<string, unknown>): boolean {
  return (
    parsed.year !== undefined ||
    parsed.month !== undefined ||
    parsed.day !== undefined ||
    parsed.hour !== undefined ||
    parsed.minute !== undefined ||
    parsed.second !== undefined ||
    parsed.millisecond !== undefined ||
    parsed.isoWeek !== undefined ||
    parsed.isoWeekYear !== undefined ||
    parsed.dayOfYear !== undefined ||
    parsed.quarter !== undefined ||
    parsed._week !== undefined ||
    parsed._weekYear !== undefined ||
    parsed._weekdayNum !== undefined
  );
}

function scoreParsedResult(parsed: Record<string, unknown>): number {
  let score = 0;
  if (parsed.year !== undefined) {score += 10;}
  if (parsed.month !== undefined) {score += 10;}
  if (parsed.day !== undefined) {score += 10;}
  if (parsed.hour !== undefined) {score += 3;}
  if (parsed.minute !== undefined) {score += 2;}
  if (parsed.second !== undefined) {score += 1;}
  if (parsed.millisecond !== undefined) {score += 1;}
  return score;
}

function createFromString(
  str: string,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
): Moment {
  let strict = false;
  let locale: string | undefined;
  let fmt: string | string[] | undefined;

  if (typeof format === "boolean") {
    strict = format;
    fmt = undefined;
  } else if (typeof localeOrStrict === "boolean") {
    fmt = format;
    strict = localeOrStrict;
  } else {
    fmt = format;
    if (typeof localeOrStrict === "string") {
      locale = localeOrStrict;
      if (locale && localeHasMissingParent(locale)) {
        locale = "en";
      }
    }
    if (typeof fourthArg === "boolean") {strict = fourthArg;}
  }

  if (isArray(fmt)) {
    const formats = fmt as string[];
    let bestParsed: Record<string, unknown> | null = null;
    let bestScore = -99999;
    let bestFormat: string | undefined;

    for (const singleFmt of formats) {
      if (singleFmt === "ISO_8601" || singleFmt === "RFC_2822") {
        const parsed = parseString(str);
        if (parsed && hasAnyValue(parsed)) {
          const overflow = checkOverflow(parsed);
          let score = scoreParsedResult(parsed);
          score += 30;
          if (parsed._empty === true) {score -= 50;}
          if (overflow >= 0) {score -= 100;}
          if (score > bestScore) {
            bestParsed = parsed;
            bestScore = score;
            bestFormat = singleFmt;
          }
        }
        continue;
      }
      const parsed = parseString(str, singleFmt, locale, strict);
      if (parsed) {
        const hasValue = hasAnyValue(parsed);
        const overflow = checkOverflow(parsed);
        let score = scoreParsedResult(parsed);
        score += 30;
        if (overflow >= 0) {score -= 100;}
        if (parsed._empty === true) {score -= 50;}
        if (parsed._unusedTokens && parsed._unusedTokens.length > 0)
          {score -= 10 * parsed._unusedTokens.length;}
        if (parsed._charsLeftOver > 0) {score -= parsed._charsLeftOver * 3;}
        if (parsed._unusedInput)
          {score -= parsed._unusedInput.reduce((a: number, s: string) => a + s.length, 0) * 2;}
        if (
          hasValue &&
          (score > bestScore ||
            (score === bestScore && bestFormat && singleFmt.length < bestFormat.length))
        ) {
          bestParsed = parsed;
          bestScore = score;
          bestFormat = singleFmt;
        }
      }
    }

    if (bestParsed && hasAnyValue(bestParsed)) {
      const overflow = checkOverflow(bestParsed);
      if (overflow < 0) {
        if (strict && bestParsed._unusedTokens && bestParsed._unusedTokens.length > 0) {
          return new Moment({
            _d: new Date(NaN),
            _i: str,
            _f: bestFormat,
            _l: locale,
            _strict: strict,
            _isValid: false,
            _unusedTokens: bestParsed._unusedTokens,
            _unusedInput: bestParsed._unusedInput,
            _charsLeftOver: bestParsed._charsLeftOver,
            _empty: bestParsed._empty,
            _invalidMonth: bestParsed._invalidMonth,
            _weekdayMismatch: bestParsed._weekdayMismatch,
            _parsedDateParts: bestParsed._parsedDateParts,
            _meridiem: bestParsed._meridiem,
          });
        }
        if (strict && bestParsed._charsLeftOver > 0) {
          return new Moment({
            _d: new Date(NaN),
            _i: str,
            _f: bestFormat,
            _l: locale,
            _strict: strict,
            _isValid: false,
            _unusedTokens: bestParsed._unusedTokens,
            _unusedInput: bestParsed._unusedInput,
            _charsLeftOver: bestParsed._charsLeftOver,
            _empty: bestParsed._empty,
            _invalidMonth: bestParsed._invalidMonth,
            _weekdayMismatch: bestParsed._weekdayMismatch,
            _parsedDateParts: bestParsed._parsedDateParts,
            _meridiem: bestParsed._meridiem,
          });
        }
        const m = createMomentFromParsed(bestParsed, str, bestFormat as string, locale, strict);
        m._f = bestFormat;
        m._parsedDateParts = bestParsed._parsedDateParts || [];
        m._unusedTokens = bestParsed._unusedTokens || [];
        m._unusedInput = bestParsed._unusedInput || [];
        m._charsLeftOver = bestParsed._charsLeftOver || 0;
        m._empty = bestParsed._empty !== false;
        m._invalidMonth = bestParsed._invalidMonth || null;
        if (bestFormat === "ISO_8601") {m._iso = true;}
        return m;
      }
      const config: MomentConfig = {
        _d: new Date(NaN),
        _i: str,
        _f: bestFormat,
        _l: locale,
        _strict: strict,
        _isValid: false,
        _overflow: overflow,
      };
      if (bestParsed) {
        config._unusedTokens = bestParsed._unusedTokens;
        config._unusedInput = bestParsed._unusedInput;
        config._charsLeftOver = bestParsed._charsLeftOver;
        config._empty = bestParsed._empty;
        config._invalidMonth = bestParsed._invalidMonth;
        config._weekdayMismatch = bestParsed._weekdayMismatch;
        config._parsedDateParts = bestParsed._parsedDateParts;
        config._meridiem = bestParsed._meridiem;
      }
      return new Moment(config);
    }

    const emptyFormats = formats.length === 0;
    const config: MomentConfig = {
      _d: new Date(NaN),
      _i: str,
      _f: fmt,
      _l: locale,
      _strict: strict,
      _isValid: false,
      _invalidFormat: emptyFormats,
    };
    if (bestParsed) {
      config._unusedTokens = bestParsed._unusedTokens;
      config._unusedInput = bestParsed._unusedInput;
      config._charsLeftOver = bestParsed._charsLeftOver;
      config._empty = bestParsed._empty;
      config._invalidMonth = bestParsed._invalidMonth;
      config._weekdayMismatch = bestParsed._weekdayMismatch;
      config._parsedDateParts = bestParsed._parsedDateParts;
      config._meridiem = bestParsed._meridiem;
    }
    return new Moment(config);
  }

  const fmtStr = fmt as string | undefined;

  if (fmtStr === "ISO_8601") {
    if (strict) {
      const hasExtendedDash = /^\d{4}-/.test(str.trim());
      const hasExtendedTime = /T\d{2}:\d{2}/.test(str);
      const hasBasicTimeMinutes = /T\d{4}/.test(str);
      if (hasExtendedDash && hasBasicTimeMinutes && !hasExtendedTime) {
        return new Moment({
        _dClone: false,
          _d: new Date(NaN),
          _i: str,
          _f: fmt as string,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _iso: true,
        });
      }
      if (!hasExtendedDash && hasExtendedTime) {
        return new Moment({
        _dClone: false,
          _d: new Date(NaN),
          _i: str,
          _f: fmt as string,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _iso: true,
        });
      }
      if (/W\d{2}[T ]\d/.test(str.trim()) && !/W\d{2}-?\d[T ]/.test(str.trim())) {
        return new Moment({
        _dClone: false,
          _d: new Date(NaN),
          _i: str,
          _f: fmt as string,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _iso: true,
        });
      }
    }
    const parsed = parseString(str);
    if (parsed && hasAnyValue(parsed)) {
      const overflow = checkOverflow(parsed);
      if (overflow >= 0) {
        return new Moment({
        _dClone: false,
          _d: new Date(NaN),
          _i: str,
          _f: fmt as string,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _overflow: overflow,
          _iso: true,
        });
      }
      if (strict) {
        if (parsed._hasDate && !parsed._hasTime && str.indexOf("T") >= 0) {
          return new Moment({
        _dClone: false,
            _d: new Date(NaN),
            _i: str,
            _f: fmt as string,
            _l: locale,
            _strict: strict,
            _isValid: false,
            _iso: true,
          });
        }
        if (
          parsed._weekdayNum !== undefined &&
          (parsed._weekdayNum === 0 || parsed._weekdayNum > 7)
        ) {
          return new Moment({
        _dClone: false,
            _d: new Date(NaN),
            _i: str,
            _f: fmt as string,
            _l: locale,
            _strict: strict,
            _isValid: false,
            _overflow: 8,
            _iso: true,
          });
        }
      }
      const m = createMomentFromParsed(parsed, str, fmt as string, locale, strict);
      m._iso = true;
      return m;
    }
    return new Moment({
        _dClone: false,
      _d: new Date(NaN),
      _i: str,
      _f: fmt as string,
      _l: locale,
      _strict: strict,
      _isValid: false,
      _iso: true,
    });
  }

  if (fmtStr === "RFC_2822") {
    const rfcParsed = parseString(str);
    if (rfcParsed && hasAnyValue(rfcParsed)) {
      let weekdayMismatch = false;
      if (rfcParsed._weekdayName !== undefined && rfcParsed.day !== undefined) {
        const d = new Date(rfcParsed.year, rfcParsed.month, rfcParsed.day);
        const actualDay = d.getDay();
        if (rfcParsed._weekdayName !== actualDay) {
          weekdayMismatch = true;
        }
      }
      const overflow = checkOverflow(rfcParsed);
      if (overflow >= 0) {
        const config: MomentConfig = {
          _d: new Date(NaN),
          _i: str,
          _f: fmt as string,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _overflow: overflow,
          _rfc2822: false,
          _weekdayMismatch: weekdayMismatch,
        };
        return new Moment(config);
      }
      if (weekdayMismatch) {
        return new Moment({
        _dClone: false,
          _d: new Date(NaN),
          _i: str,
          _f: fmt as string,
          _l: locale,
          _strict: strict,
          _isValid: false,
          _rfc2822: false,
          _weekdayMismatch: true,
        });
      }
      const m = createMomentFromParsed(rfcParsed, str, fmt as string, locale, strict);
      m._rfc2822 = true;
      return m;
    }
    return new Moment({
        _dClone: false,
      _d: new Date(NaN),
      _i: str,
      _f: fmt as string,
      _l: locale,
      _strict: strict,
      _isValid: false,
      _rfc2822: false,
    });
  }

  if (fmtStr) {
    const parsed = parseString(str, fmtStr, locale, strict);
    const config: MomentConfig = {
      _d: undefined,
      _i: str,
      _f: fmtStr,
      _l: locale,
      _strict: strict,
      _overflow: -1,
    };
    if (parsed) {
      if (parsed.bigHour) {config._bigHour = true;}
      const hasValue = hasAnyValue(parsed);
      const hasIsoWeek = parsed.isoWeekYear !== undefined && parsed.isoWeek !== undefined;
      const overflow = checkOverflow(parsed);
      const adjustedOverflow = hasIsoWeek && overflow === 8 ? -1 : overflow;
      config._overflow = adjustedOverflow;
      config._unusedTokens = parsed._unusedTokens;
      config._unusedInput = parsed._unusedInput;
      config._charsLeftOver = parsed._charsLeftOver;
      config._empty = parsed._empty;
      config._invalidMonth = parsed._invalidMonth;
      config._parsedDateParts = parsed._parsedDateParts;
      config._meridiem = parsed._meridiem;
      if (parsed.bigHour) {config._bigHour = true;}
      let weekdayMismatch = false;
      if (
        parsed._weekdayName !== undefined &&
        parsed.year !== undefined &&
        parsed.month !== undefined &&
        parsed.day !== undefined
      ) {
        const d = new Date(parsed.year, parsed.month, parsed.day);
        if (parsed._weekdayNum !== d.getDay()) {
          weekdayMismatch = true;
        }
      }
      config._weekdayMismatch = weekdayMismatch;
      if (adjustedOverflow >= 0) {
        config._isValid = false;
        config._d = new Date(NaN);
        return new Moment(config);
      }
      if (strict && parsed._unusedTokens && parsed._unusedTokens.length > 0) {
        config._isValid = false;
        config._d = new Date(NaN);
        return new Moment(config);
      }
      if (strict && parsed._charsLeftOver > 0) {
        config._isValid = false;
        config._d = new Date(NaN);
        return new Moment(config);
      }
      if (hasValue) {
        const m = createMomentFromParsed(parsed, str, fmtStr, locale, strict);
        if (weekdayMismatch) {
          m._isValid = false;
          m._weekdayMismatch = true;
        }
        return m;
      }
    }
    config._isValid = false;
    config._d = new Date(NaN);
    if (parsed) {
      config._unusedTokens = parsed._unusedTokens;
      config._unusedInput = parsed._unusedInput;
      config._charsLeftOver = parsed._charsLeftOver;
      config._empty = parsed._empty;
      config._invalidMonth = parsed._invalidMonth;
      config._meridiem = parsed._meridiem;
    }
    return new Moment(config);
  }

  const trimmed = str.trim();
  if (trimmed === "") {
    return new Moment({ _dClone: false, _d: new Date(NaN), _i: str, _isValid: false, _empty: true });
  }

  const parsed = parseString(str);
  if (parsed && !parsed._claimed) {
    if (parsed._hasDate !== undefined) {
      const { year, month, day, hour, minute, second, millisecond, offset } = parsed;
      const y = year!;
      const mo = month!;
      const d = day!;
      const h = hour ?? 0;
      const min = minute ?? 0;
      const s = second ?? 0;
      const ms = millisecond ?? 0;
      if (offset !== undefined) {
        return new Moment({
          _d: createDateSafe(y, mo, d, h, min, s, ms, true),
          _offset: offset, _isUTC: true, _i: str,
          _f: parsed._hasTime ? "YYYY-MM-DDTHH:mm:ss.SSSSZ" : "YYYY-MM-DD",
        });
      }
      return new Moment({
        _d: createDateSafe(y, mo, d, h, min, s, ms, false), _i: str,
        _f: parsed._hasTime ? "YYYY-MM-DDTHH:mm:ss.SSSS" : "YYYY-MM-DD",
      });
    }
    if (((parsed.isoWeekYear !== undefined || parsed.isoWeek !== undefined) ||
         (parsed._weekYear !== undefined || parsed._week !== undefined)) &&
        parsed.year === undefined && parsed.month === undefined && parsed.day === undefined) {
      const weekOverflow = checkOverflow(parsed);
      if (weekOverflow >= 0) {
        return new Moment({ _dClone: false, _d: new Date(NaN), _i: str, _isValid: false, _overflow: weekOverflow });
      }
      return createMomentFromParsed(parsed, str);
    }
    const { year, month, day, hour, minute, second, millisecond, offset, dayOfYear } = parsed;
    let y = year;
    let mo = month;
    let d = day;
    if (dayOfYear !== undefined && mo === undefined && d === undefined) {
      const maxDay = (y !== undefined && ((y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365)) || 366;
      if (dayOfYear === 0 || dayOfYear > maxDay) {
        return new Moment({ _dClone: false, _d: new Date(NaN), _i: str, _isValid: false, _overflow: 2 });
      }
      const date = createUTCDate(y !== undefined ? y : new Date(nowFn()).getFullYear(), 0, dayOfYear);
      y = date.getUTCFullYear();
      mo = date.getUTCMonth();
      d = date.getUTCDate();
    } else if (y === undefined && mo === undefined && d === undefined) {
      const now = new Date(nowFn());
      y = now.getFullYear();
      mo = now.getMonth();
      d = now.getDate();
    } else {
      if (y === undefined) {y = new Date(nowFn()).getFullYear();}
      if (mo === undefined && y !== undefined) {mo = 0;}
      if (d === undefined) {d = 1;}
    }
    const h = hour !== undefined ? hour : 0;
    const min = minute !== undefined ? minute : 0;
    const s = second !== undefined ? second : 0;
    const ms = millisecond !== undefined ? millisecond : 0;
    const parsedCheck = {
      year,
      month: mo,
      day: d,
      hour: h,
      minute: min,
      second: s,
      millisecond: ms,
    };
    const overflow = checkOverflow(parsedCheck);
    let detectedFmt: string | undefined;
    const trimmedStr = str;
    const timeMatch = trimmedStr.match(/[T ](\d{2})(?::(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?/);
    const hasT = trimmedStr.indexOf("T") >= 0 || trimmedStr.indexOf("t") >= 0;
    if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(trimmedStr)) {
      detectedFmt = "YYYY-MM-DD";
      if (timeMatch) {
        detectedFmt += `${hasT ? "T" : " "  }HH`;
        if (timeMatch[2] !== undefined) {detectedFmt += ":mm";}
        if (timeMatch[3] !== undefined) {detectedFmt += ":ss";}
        if (timeMatch[4] !== undefined) {detectedFmt += ".SSSS";}
      }
    } else if (/^\d{4}-\d{2}/.test(trimmedStr)) {
      detectedFmt = "YYYY-MM";
    } else if (/^\d{4}/.test(trimmedStr)) {
      detectedFmt = "YYYY";
    }
    let date: Date;
    let config: MomentConfig = { _d: undefined, _i: str };
    if (detectedFmt) {config._f = detectedFmt;}
    if (offset !== undefined) {
      date = createUTCDate(y, mo, d, h, min, s, ms);
      config._d = date;
      config._offset = offset;
      config._isUTC = true;
      if (parsed._rfc2822) {config._rfc2822 = true;}
      if (overflow >= 0) {
        config._isValid = false;
        config._overflow = overflow;
      }
      return new Moment(config);
    }
    date = createDate(y, mo, d, h, min, s, ms);
    config._d = date;
    if (parsed._rfc2822) {config._rfc2822 = true;}
    if (overflow >= 0) {
      config._isValid = false;
      config._overflow = overflow;
    }
    return new Moment(config);
  }

  const fallbackDate = new Date(str);
  if (!isNaN(fallbackDate.getTime())) {
    return new Moment({ _dClone: false, _d: fallbackDate, _i: str });
  }

  return new Moment({ _dClone: false, _d: new Date(NaN), _i: str, _isValid: false });
}

function weekYearToDate(isoWeekYear: number, isoWeek: number, isoWeekday: number): Date {
  const jan4 = new Date(0);
  jan4.setUTCFullYear(isoWeekYear, 0, 4);
  const dayOfJan4 = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(0);
  mondayOfWeek1.setUTCFullYear(isoWeekYear, 0, 4 - (dayOfJan4 - 1));
  return new Date(mondayOfWeek1.getTime() + ((isoWeek - 1) * 7 + (isoWeekday - 1)) * 86400000);
}

function localeWeekToDate(
  weekYear: number,
  week: number,
  weekday: number,
  dow: number,
  doy: number,
): Date {
  const jan1 = new Date(Date.UTC(weekYear, 0, 1));
  const fwd = 7 + dow - doy;
  const fwdDate = new Date(Date.UTC(weekYear, 0, fwd));
  const fwdDay = fwdDate.getUTCDay();
  const fwdlw = (7 + fwdDay - dow) % 7;
  const offset = -fwdlw + fwd - 1;
  const week1Start = new Date(jan1.getTime() + offset * 86400000);
  const targetDate = new Date(week1Start.getTime() + ((week - 1) * 7 + weekday) * 86400000);
  return targetDate;
}

function buildMomentConfig(
  d: Date,
  str: string,
  format: string | string[] | undefined,
  locale: string | undefined,
  parsed: Record<string, unknown>,
  extra?: MomentConfig,
): MomentConfig {
  const config: MomentConfig = {
    _d: d,
    _i: str,
    _f: format,
    _l: locale,
    _parsedDateParts: parsed._parsedDateParts as number[] | undefined,
    ...extra,
  };
  const c = config as Record<string, unknown>;
  if (parsed._unusedTokens) {c._unusedTokens = parsed._unusedTokens;}
  if (parsed._unusedInput) {c._unusedInput = parsed._unusedInput;}
  if (parsed._charsLeftOver !== undefined) {c._charsLeftOver = parsed._charsLeftOver;}
  if (parsed._empty !== undefined) {c._empty = parsed._empty;}
  if (parsed._invalidMonth !== undefined) {c._invalidMonth = parsed._invalidMonth;}
  return config;
}

function createMomentFromParsed(
  parsed: Record<string, unknown>,
  str: string,
  format?: string | string[],
  locale?: string,
  strict?: boolean,
): Moment {
  const baseConfig: Record<string, unknown> = strict !== undefined ? { _strict: strict } : {};
  if (parsed.bigHour) {baseConfig._bigHour = true;}

  const noDate = parsed.year === undefined && parsed.month === undefined && parsed.day === undefined;
  let tag = 0;
  if (noDate) {
    if (parsed._weekYear !== undefined && parsed._week !== undefined) {
      tag = 1;
    } else if (parsed.isoWeekYear !== undefined && parsed.isoWeek !== undefined) {
      tag = 2;
    } else if (parsed._weekYear !== undefined) {
      tag = 3;
    } else if (parsed._week !== undefined) {
      tag = 4;
    } else if (parsed.isoWeekYear !== undefined) {
      tag = 5;
    } else if (parsed.isoWeek !== undefined) {
      tag = 6;
    } else if (parsed.dayOfYear !== undefined) {
      tag = 7;
    } else if (parsed._weekdayNum !== undefined &&
               parsed.hour === undefined && parsed.minute === undefined &&
               parsed.second === undefined && parsed.millisecond === undefined &&
               parsed.offset === undefined) {
      tag = 8;
    } else if (parsed.hour !== undefined && parsed.offset === undefined) {
      tag = 9;
    }
  }

  switch (tag) {
    case 1: {
      const loc = getLocale(locale);
      const weekCfg = (loc._config as Record<string, unknown>).week || { dow: 0, doy: 6 };
      let weekdayOffset: number;
      if (parsed._localeWeekday !== undefined) {
        weekdayOffset = parsed._localeWeekday;
      } else if (parsed._weekdayNum !== undefined) {
        weekdayOffset = (parsed._weekdayNum - weekCfg.dow + 7) % 7;
      } else {
        weekdayOffset = 0;
      }
      const d = localeWeekToDate(parsed._weekYear, parsed._week, weekdayOffset, weekCfg.dow, weekCfg.doy);
      if (parsed.hour !== undefined)
        {d.setUTCHours(parsed.hour, parsed.minute || 0, parsed.second || 0, parsed.millisecond || 0);
        return new Moment(buildMomentConfig(d, str, format, locale, parsed, baseConfig));}
      const ld = new Date(0);
      ld.setFullYear(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      ld.setHours(0, 0, 0, 0);
      return new Moment(buildMomentConfig(ld, str, format, locale, parsed, baseConfig));
    }
    case 2: {
      const isoWeekday = parsed._weekdayNum !== undefined ? parsed._weekdayNum : 1;
      const d = weekYearToDate(parsed.isoWeekYear, parsed.isoWeek, isoWeekday);
      if (parsed.hour !== undefined)
        {d.setUTCHours(parsed.hour, parsed.minute || 0, parsed.second || 0, parsed.millisecond || 0);
        return new Moment(buildMomentConfig(d, str, format, locale, parsed, baseConfig));}
      const ld = new Date(0);
      ld.setFullYear(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      ld.setHours(0, 0, 0, 0);
      return new Moment(buildMomentConfig(ld, str, format, locale, parsed, baseConfig));
    }
    case 3: {
      const year = parsed._weekYear;
      const nowTs = momentNowFn ? momentNowFn() : Date.now();
      const nowDate = new Date(nowTs);
      const nowYearStart = new Date(nowDate.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((nowTs - nowYearStart.getTime()) / 86400000);
      const currentWeekOfYear = Math.ceil((dayOfYear + nowYearStart.getDay() + 1) / 7);
      const loc = getLocale(locale);
      const weekCfg = (loc._config as Record<string, unknown>).week || { dow: 0, doy: 6 };
      const d = localeWeekToDate(year, Math.max(currentWeekOfYear, 1), 0, weekCfg.dow, weekCfg.doy);
      return new Moment(buildMomentConfig(d, str, format, locale, parsed, { _strict: strict }));
    }
    case 4: {
      const nowTs = momentNowFn ? momentNowFn() : Date.now();
      const year = new Date(nowTs).getFullYear();
      const loc = getLocale(locale);
      const weekCfg = (loc._config as Record<string, unknown>).week || { dow: 0, doy: 6 };
      const d = localeWeekToDate(year, parsed._week, 0, weekCfg.dow, weekCfg.doy);
      return new Moment(buildMomentConfig(d, str, format, locale, parsed, { _strict: strict }));
    }
    case 5: {
      const nowTs = momentNowFn ? momentNowFn() : Date.now();
      const nowYear = new Date(nowTs).getUTCFullYear();
      const jan4 = new Date(Date.UTC(nowYear, 0, 4));
      const dayOfJan4 = jan4.getUTCDay() || 7;
      const offset = dayOfJan4 - 1;
      const week1Start = new Date(Date.UTC(nowYear, 0, 4 - offset));
      const d = new Date(week1Start.getTime() + (parsed.isoWeek - 1) * 7 * 86400000);
      return new Moment(buildMomentConfig(d, str, format, locale, parsed, { _strict: strict }));
    }
    case 6: {
      const year = parsed.isoWeekYear;
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const dayOfJan4 = jan4.getUTCDay() || 7;
      const offset = dayOfJan4 - 1;
      const d = new Date(Date.UTC(year, 0, 4 - offset));
      return new Moment(buildMomentConfig(d, str, format, locale, parsed, baseConfig));
    }
    case 7: {
      const year = parsed.year !== undefined ? parsed.year : new Date().getFullYear();
      const maxDayOfYear = isLeapYear(year) ? 366 : 365;
      if (parsed.dayOfYear > maxDayOfYear) {
        return new Moment({
          _dClone: false, _d: new Date(NaN), _i: str, _f: format, _l: locale,
          _isValid: false, _overflow: 2,
        });
      }
      const d = new Date(Date.UTC(year, 0, parsed.dayOfYear));
      return new Moment(buildMomentConfig(d, str, format, locale, parsed, baseConfig));
    }
    case 8: {
      const d = new Date();
      const currentDay = d.getDay();
      const diff = parsed._weekdayNum - currentDay;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return new Moment(buildMomentConfig(d, str, format, locale, parsed, baseConfig));
    }
    case 9: {
      const d = new Date();
      if (parsed._weekdayNum !== undefined) {
        const currentDay = d.getDay();
        const diff = parsed._weekdayNum - currentDay;
        d.setDate(d.getDate() + diff);
      }
      d.setHours(parsed.hour || 0, parsed.minute || 0, parsed.second || 0, parsed.millisecond || 0);
      return new Moment(buildMomentConfig(d, str, format, locale, parsed, {
        ...baseConfig, _meridiem: parsed._meridiem as string | undefined,
      }));
    }
    default: {
      const hasYear = parsed.year !== undefined;
      const hasMonth = parsed.month !== undefined;
      let year = parsed.year !== undefined ? parsed.year : new Date().getFullYear();
      let month = parsed.month !== undefined ? parsed.month : hasYear ? 0 : new Date().getMonth();
      const day = parsed.day !== undefined ? parsed.day : hasYear || hasMonth ? 1 : new Date().getDate();
      let hour = parsed.hour !== undefined ? parsed.hour : 0;
      const minute = parsed.minute !== undefined ? parsed.minute : 0;
      const second = parsed.second !== undefined ? parsed.second : 0;
      const ms = parsed.millisecond !== undefined ? parsed.millisecond : 0;
      if (parsed.quarter !== undefined && month === 0 && !parsed.month) {
        month = (parsed.quarter - 1) * 3;
      }
      if (parsed.offset !== undefined) {
        let dd = createDateSafe(year, month, day, hour, minute, second, ms, true);
        dd = new Date(dd.getTime() - parsed.offset * 60000);
        return new Moment(buildMomentConfig(dd, str, format, locale, parsed, {
          ...baseConfig, _meridiem: parsed._meridiem as string | undefined,
        }));
      }
      const dd = createDateSafe(year, month, day, hour, minute, second, ms, false);
      return new Moment(buildMomentConfig(dd, str, format, locale, parsed, {
        ...baseConfig, _meridiem: parsed._meridiem as string | undefined,
      }));
    }
  }
}

function createFromArray(arr: unknown[], isUTC?: boolean): Moment {
  if (arr.length === 0) {return new Moment({ _dClone: false, _t: nowFn(), _i: arr });}
  let hasNull = false;
  for (const v of arr) {
    if (v === null) {hasNull = true;}
  }
  if (hasNull) {return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });}
  const parsed = parseArray(arr);
  if (!parsed) {
    if (arr.some((v) => v === null || v === undefined || (typeof v === "number" && isNaN(v)))) {
      return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });
    }
    return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });
  }
  const overflow = checkOverflow(parsed);
  const d = createDateSafe(
    parsed.year,
    parsed.month,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
    parsed.millisecond,
    isUTC,
  );
  if (overflow >= 0) {
    return new Moment({
        _dClone: false,
      _d: d,
      _i: arr,
      _isValid: false,
      _overflow: overflow,
      _parsedDateParts: [
        parsed.year,
        parsed.month,
        parsed.day,
        parsed.hour,
        parsed.minute,
        parsed.second,
        parsed.millisecond,
      ],
    });
  }
  if (isNaN(d.getTime())) {return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });}
  return new Moment({ _dClone: false, _d: d, _i: arr });
}

function createFromObject(obj: Record<string, unknown>): Moment {
  const parsed = parseObject(obj);
  if (isObjectEmpty(parsed)) {return new Moment({ _dClone: false, _t: nowFn(), _i: obj });}
  const now = new Date(nowFn());
  const year = parsed.year !== undefined ? parsed.year : now.getFullYear();
  const month =
    parsed.month !== undefined ? parsed.month : parsed.year !== undefined ? 0 : now.getMonth();
  const day =
    parsed.day !== undefined
      ? parsed.day
      : parsed.year !== undefined || parsed.month !== undefined
        ? 1
        : now.getDate();
  const hour = parsed.hour !== undefined ? parsed.hour : 0;
  const minute = parsed.minute !== undefined ? parsed.minute : 0;
  const second = parsed.second !== undefined ? parsed.second : 0;
  const ms = parsed.millisecond !== undefined ? parsed.millisecond : 0;
  const overflow = checkOverflow({ year, month, day, hour, minute, second, millisecond: ms });
  const d = createDate(year, month, day, hour, minute, second, ms);
  if (overflow >= 0) {
    return new Moment({ _dClone: false, _d: d, _i: obj, _isValid: false, _overflow: overflow });
  }
  return new Moment({ _dClone: false, _d: d, _i: obj });
}

// Static methods
(moment as Record<string, unknown>).duration = function (input?: unknown, unit?: string): Duration {
  return new Duration(input as unknown, unit);
};
(moment as Record<string, unknown>).duration.invalid = function (): Duration {
  return Duration.invalid();
};
(moment as Record<string, unknown>).duration.fn = Duration.prototype;
(moment as Record<string, unknown>).fn = Moment.prototype;
(moment as Record<string, unknown>).prototype = Moment.prototype;

(moment as Record<string, unknown>).version = "2.30.1";
Object.defineProperty(moment, "updateOffset", {
  get(): ((m: Moment, keepTime?: boolean) => void) | undefined {
    return getUpdateOffsetCallback();
  },
  set(v: ((m: Moment, keepTime?: boolean) => void) | undefined) {
    setUpdateOffsetCallback(v || undefined);
  },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(moment, "now", {
  get(): () => number {
    return momentNowFn ? momentNowFn : () => Date.now();
  },
  set(v: (() => number) | undefined) {
    momentNowFn = v || undefined;
  },
  enumerable: true,
  configurable: true,
});
(moment as Record<string, unknown>).isMoment = isMoment;
(moment as Record<string, unknown>).isDate = isDate;
(moment as Record<string, unknown>).isDuration = function (obj: unknown): boolean {
  return checkIsDuration(obj);
};
(moment as Record<string, unknown>).normalizeUnits = normUnits;
Object.defineProperty(moment, "parseTwoDigitYear", {
  get() {
    return (str: string) => {
      const fn = parseTwoDigitYearInternal;
      if (fn) {return fn(str);}
      const num = parseInt(str, 10);
      return num > 68 ? 1900 + num : 2000 + num;
    };
  },
  set(v: ((str: string) => number) | undefined) {
    setParseTwoDigitYear(v || undefined);
  },
  enumerable: true,
  configurable: true,
});
(moment as Record<string, unknown>).momentProperties = momentProperties;
(moment as Record<string, unknown>).ISO_8601 = "ISO_8601";
(moment as Record<string, unknown>).RFC_2822 = "RFC_2822";
(moment as Record<string, unknown>).HTML5_FMT = {
  DATETIME_LOCAL: "YYYY-MM-DDTHH:mm",
  DATETIME_LOCAL_SECONDS: "YYYY-MM-DDTHH:mm:ss",
  DATETIME_LOCAL_MS: "YYYY-MM-DDTHH:mm:ss.SSS",
  DATE: "YYYY-MM-DD",
  TIME: "HH:mm",
  TIME_SECONDS: "HH:mm:ss",
  TIME_MS: "HH:mm:ss.SSS",
  WEEK: "GGGG-[W]WW",
  MONTH: "YYYY-MM",
};
(moment as Record<string, unknown>).utc = function (input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment {
  if (input === null) {
    return new Moment({
        _dClone: false,
      _d: new Date(NaN),
      _isValid: false,
      _isUTC: true,
      _offset: 0,
      _i: input,
      _nullInput: true,
    });
  }
  if (input === undefined) {
    return new Moment({ _dClone: false, _d: new Date(nowFn()), _isUTC: true, _offset: 0, _i: input });
  }
  const m = moment(input, format, localeOrStrict, fourthArg);
  const absTime = m.valueOf();
  if (isNaN(absTime)) {
    m._isUTC = true;
    m._offset = 0;
    return m;
  }
  if (!m._isUTC && isString(input)) {
    const utcDate = new Date(`${input as string} UTC`);
    if (!isNaN(utcDate.getTime())) {
      m._d = utcDate;
    } else {
      m._d = new Date(absTime - m._d!.getTimezoneOffset() * 60000);
    }
  } else {
    m._d = new Date(absTime);
  }
  m._t = m._d.getTime();
  m._isUTC = true;
  m._offset = 0;
  (m as Record<string, unknown>)._refreshFields();
  return m;
};
(moment as Record<string, unknown>).parseZone = function (input?: unknown, format?: unknown, strict?: boolean): Moment {
  const m = moment(input, format, strict);
  return m.parseZone();
};
(moment as Record<string, unknown>).unix = function (ts: number): Moment {
  return moment(ts * 1000);
};
(moment as Record<string, unknown>).invalid = function (input?: unknown): Moment {
  const config: Record<string, unknown> = { _d: new Date(NaN), _isValid: false, _userInvalidated: true };
  if (
    typeof input === "object" &&
    input !== null &&
    !isArray(input) &&
    !isMoment(input) &&
    !isDate(input)
  ) {
    for (const key of Object.keys(input)) {
      config[`_${  key}`] = (input as Record<string, unknown>)[key];
    }
    delete config._userInvalidated;
    config._i = input;
  } else {
    config._i = input;
  }
  return new Moment(config as MomentConfig);
};
(moment as Record<string, unknown>).locale = function (locale?: string | string[], ...args: unknown[]): string | Locale {
  if (locale === undefined) {return getCurrentLocale();}
  if (Array.isArray(locale)) {
    return setLocaleFromArray(locale);
  }
  if (args.length > 0 && typeof args[0] === "object") {
    defineLocale(locale as string, args[0] as LocaleSpec);
    return locale as string;
  }
  setLocale(locale as string);
  return getCurrentLocale();
};
(moment as Record<string, unknown>).localeData = function (locale?: string): Locale {
  return getLocale(locale);
};
(moment as Record<string, unknown>).lang = function (locale?: string, ...args: unknown[]): string | Locale {
  if (locale === undefined) {return (moment as Record<string, unknown>).locale();}
  if (args.length > 0 && typeof args[0] === "object") {
    return (moment as Record<string, unknown>).locale(locale, args[0]);
  }
  return (moment as Record<string, unknown>).locale(locale);
};
(moment as Record<string, unknown>).langData = function (locale?: string): Locale {
  return (moment as Record<string, unknown>).localeData(locale);
};
(moment as Record<string, unknown>).defineLocale = function (locale: string, config: Record<string, unknown>): Locale | void {
  return defineLocale(locale, config);
};
(moment as Record<string, unknown>).updateLocale = function (locale: string, config: Record<string, unknown>): Locale | void {
  return updateLocale(locale, config);
};
(moment as Record<string, unknown>).locales = listLocales;
(moment as Record<string, unknown>).months = function (format?: string, index?: number): string | string[] {
  return getMonths(format, index);
};
(moment as Record<string, unknown>).monthsShort = function (
  format?: string | number,
  index?: number,
): string | string[] {
  if (typeof format === "number") {
    const loc = getLocale();
    const ms = loc._monthsShort;
    return ms[format];
  }
  return getMonths(format || "short", index);
};
(moment as Record<string, unknown>).weekdays = function (
  format?: string | boolean | number,
  index?: number,
): string | string[] {
  if (typeof format === "number") {
    const loc = getLocale();
    return loc._weekdays[format];
  }
  return getWeekdays(format as string | boolean, index);
};
(moment as Record<string, unknown>).weekdaysShort = function (
  format?: string | boolean | number,
  index?: number,
): string | string[] {
  if (typeof format === "number") {
    const loc = getLocale();
    return loc.weekdaysShortArray()[format];
  }
  if (typeof format === "boolean") {
    return getWeekdays(format ? "shortFormat" : "short", index);
  }
  return getWeekdays(format || "short", index);
};
(moment as Record<string, unknown>).weekdaysMin = function (
  format?: string | boolean | number,
  index?: number,
): string | string[] {
  if (typeof format === "number") {
    const loc = getLocale();
    return loc.weekdaysMinArray()[format];
  }
  if (typeof format === "boolean") {
    return getWeekdays(format ? "minFormat" : "min", index);
  }
  return getWeekdays(format || "min", index);
};
(moment as Record<string, unknown>).min = function (...args: unknown[]): Moment {
  if (args.length === 0) {return moment();}
  let inputList = args;
  if (args.length === 1 && isArray(args[0]) && !isMoment(args[0])) {
    inputList = args[0] as unknown[];
  }
  let best: Moment | null = null;
  let bestVal = Infinity;
  let bestInvalid: Moment | null = null;
  for (const item of inputList) {
    const m = isMoment(item) ? (item as Moment) : moment(item as unknown);
    const val = m.valueOf();
    if (isNaN(val) || !m.isValid()) {
      if (!bestInvalid) {bestInvalid = m;}
    } else if (val < bestVal) {
      bestVal = val;
      best = m;
    }
  }
  return bestInvalid || best!;
};
(moment as Record<string, unknown>).max = function (...args: unknown[]): Moment {
  if (args.length === 0) {return moment();}
  let inputList = args;
  if (args.length === 1 && isArray(args[0]) && !isMoment(args[0])) {
    inputList = args[0] as unknown[];
  }
  let best: Moment | null = null;
  let bestVal = -Infinity;
  let bestInvalid: Moment | null = null;
  for (const item of inputList) {
    const m = isMoment(item) ? (item as Moment) : moment(item as unknown);
    const val = m.valueOf();
    if (isNaN(val) || !m.isValid()) {
      if (!bestInvalid) {bestInvalid = m;}
    } else if (val > bestVal) {
      bestVal = val;
      best = m;
    }
  }
  return bestInvalid || best!;
};
(moment as Record<string, unknown>).relativeTimeRounding = function (fn?: Function | boolean): Function | boolean {
  return setRelTimeRounding(fn as Function | boolean);
};
(moment as Record<string, unknown>).relativeTimeThreshold = function (
  threshold: string,
  limit?: number,
): number | boolean {
  return setRelTimeThreshold(threshold, limit as number | undefined) as number | boolean;
};
Object.defineProperty(moment, "calendarFormat", {
  get(): ((m: Moment, now: Moment) => string) | undefined {
    return Moment.calendarFormat;
  },
  set(v: ((m: Moment, now: Moment) => string) | undefined) {
    Moment.calendarFormat = v || undefined;
  },
  enumerable: true,
  configurable: true,
});
(moment as Record<string, unknown>).suppressDeprecationWarnings = false;
(moment as Record<string, unknown>).deprecationHandler = null as ((name: string, msg: string) => void) | null;

// Register test locale data
import { registerTestLocales } from "./locale/test-locales";
registerTestLocales();

// Temporal bridge — lazily loaded to avoid bundling @js-temporal/polyfill for non-users
let _toTemporalFn: ((t: unknown) => unknown) | null = null;
let _fromTemporalFn: ((t: unknown) => unknown) | null = null;
function _ensureTemporal() {
  if (!_toTemporalFn) {
    const mod = require("./temporal");
    _toTemporalFn = mod.toTemporal;
    _fromTemporalFn = mod.fromTemporal;
  }
}
(moment as Record<string, unknown>).config = configure;
(moment as Record<string, unknown>).report = reportFn;
(moment as Record<string, unknown>).fn.toTemporal = function (this: Moment): unknown {
  _ensureTemporal();
  return _toTemporalFn!(this as Moment);
};
(moment as Record<string, unknown>).fromTemporal = function (t: unknown): unknown {
  _ensureTemporal();
  return _fromTemporalFn!(t);
};

interface MomentStatic {
  (input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment;
  duration(input?: unknown, unit?: string): Duration;
  locale(locale?: string | string[], ...args: unknown[]): string | Locale;
  localeData(locale?: string): Locale;
  defineLocale(locale: string, config: Record<string, unknown>): Locale | void;
  updateLocale(locale: string, config: Record<string, unknown>): Locale | void;
  utc(input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment;
  isMoment(obj: unknown): boolean;
  isDate(obj: unknown): boolean;
  isDuration(obj: unknown): boolean;
  normalizeUnits(unit: string): string;
  unix(ts: number): Moment;
  invalid(input?: unknown): Moment;
  parseZone(input?: unknown, format?: unknown, strict?: boolean): Moment;
  months(format?: string, index?: number): string | string[];
  monthsShort(format?: string | number, index?: number): string | string[];
  weekdays(format?: string | boolean | number, index?: number): string | string[];
  weekdaysShort(format?: string | boolean | number, index?: number): string | string[];
  weekdaysMin(format?: string | boolean | number, index?: number): string | string[];
  min(...args: unknown[]): Moment;
  max(...args: unknown[]): Moment;
  relativeTimeRounding(fn?: Function | boolean): Function | boolean;
  relativeTimeThreshold(threshold: string, limit?: number): number | boolean;
  now: () => number;
  updateOffset: ((m: Moment, keepTime?: boolean) => void) | undefined;
  calendarFormat: ((m: Moment, now: Moment) => string) | undefined;
  fn: Moment;
  prototype: Moment;
  version: string;
  ISO_8601: string;
  RFC_2822: string;
  HTML5_FMT: {
    DATETIME_LOCAL: string;
    DATETIME_LOCAL_SECONDS: string;
    DATETIME_LOCAL_MS: string;
    DATE: string;
    TIME: string;
    TIME_SECONDS: string;
    TIME_MS: string;
    WEEK: string;
    MONTH: string;
  };
  parseTwoDigitYear: (str: string) => number;
  config(key: string, value?: unknown): void;
  report(type?: string): void;
  fromTemporal(t: unknown): unknown;
  suppressDeprecationWarnings: boolean;
  deprecationHandler: ((name: string, msg: string) => void) | null;
}

export default moment as unknown as MomentStatic;
export { moment, isMoment, isDate, Duration, Locale };
