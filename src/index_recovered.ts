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
import { toTemporal as toTemporalFn, fromTemporal as fromTemporalFn } from "./temporal";
import { configure, report as reportFn } from "./migration";

export type { MomentConfig } from "./moment_fixed";
export type { DurationInput } from "./duration_fixed";
export type { LocaleSpec } from "./locale/en";

let momentNowFn: (() => number) | undefined;

function nowFn(): number {
  if (momentNowFn) {return momentNowFn();}
  return Date.now();
}

function moment(input?: any, format?: any, localeOrStrict?: any, fourthArg?: any): Moment {
  if (input === null) {
    return new Moment({
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
      !(isArray(format) && (format as any[]).length === 0)
    ) {
      return new Moment({
        _d: new Date(NaN),
        _i: input,
        _f: format as string | string[],
        _isValid: false,
        _nullInput: true,
      });
    }
    return new Moment({ _d: new Date(nowFn()), _i: input });
  }
  if (isMoment(input)) {return (input as Moment).clone();}
  if (isObject(input) && (input as any)._isAMomentObject) {
    const obj = input as any;
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
  if (isDate(input)) {return new Moment({ _d: new Date((input as Date).getTime()), _i: input });}
  if (isNumber(input)) {
    const n = input as number;
    if (isNaN(n) || !isFinite(n))
      {return new Moment({ _d: new Date(NaN), _isValid: false, _i: input });}
    if (format === "X") {return new Moment({ _d: new Date(n * 1000), _i: input, _f: "X" });}
    if (format === "x") {return new Moment({ _d: new Date(n), _i: input, _f: "x" });}
    if (format !== undefined)
      {return new Moment({
        _d: new Date(NaN),
        _isValid: false,
        _overflow: -1,
        _i: input,
        _f: format as string,
      });}
    return new Moment({ _d: new Date(n), _i: input });
  }
  if (isString(input)) {return createFromString(input as string, format, localeOrStrict, fourthArg);}
  if (isArray(input)) {
    const arr = input as any[];
    if (arr.length === 0 && (format === "X" || format === "x")) {
      return new Moment({ _d: new Date(NaN), _i: arr, _isValid: false, _f: format as string });
    }
    return createFromArray(arr);
  }
  if (isObject(input)) {return createFromObject(input as Record<string, any>);}
  return new Moment({ _d: new Date(NaN), _isValid: false, _i: input });
}

function hasAnyValue(parsed: any): boolean {
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

function scoreParsedResult(parsed: any): number {
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
  format?: any,
  localeOrStrict?: any,
  fourthArg?: any,
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
    let bestParsed: any = null;
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
        _f: formats,
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
      _d: undefined as any,
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
    return new Moment({ _d: new Date(NaN), _i: str, _isValid: false, _empty: true });
  }

  const parsed = parseString(str);
  if (parsed) {
    const { year, month, day, hour, minute, second, millisecond, offset } = parsed;
    const now = new Date(nowFn());
    const y = year !== undefined ? year : now.getFullYear();
    const mo = month !== undefined ? month : now.getMonth();
    const d = day !== undefined ? day : now.getDate();
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
    const trimmedStr = str.trim();
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
    let config: MomentConfig = { _d: undefined as any, _i: str };
    if (detectedFmt) {config._f = detectedFmt;}
    if (offset !== undefined) {
      date = createUTCDate(y, mo, d, h, min, s, ms);
      config._d = date;
      config._offset = offset;
      config._isUTC = true;
      if (overflow >= 0) {
        config._isValid = false;
        config._overflow = overflow;
      }
      return new Moment(config);
    }
    date = createUTCDate(y, mo, d, h, min, s, ms);
    config._d = date;
    if (overflow >= 0) {
      config._isValid = false;
      config._overflow = overflow;
    }
    return new Moment(config);
  }

  const num = Number(str);
  if (!isNaN(num) && str.trim() !== "") {
    return new Moment({ _d: new Date(num), _i: str });
  }

  return new Moment({ _d: new Date(NaN), _i: str, _isValid: false });
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

function createMomentFromParsed(
  parsed: any,
  str: string,
  format?: string | string[],
  locale?: string,
  strict?: boolean,
): Moment {
  const baseConfig: Record<string, any> = strict !== undefined ? { _strict: strict } : {};
  if (parsed.bigHour) {baseConfig._bigHour = true;}

  if (
    parsed._weekYear !== undefined &&
    parsed._week !== undefined &&
    parsed.year === undefined &&
    parsed.month === undefined &&
    parsed.day === undefined
  ) {
    const loc = getLocale(locale);
    const weekCfg = (loc._config as any).week || { dow: 0, doy: 6 };
    let weekdayOffset: number;
    if (parsed._localeWeekday !== undefined) {
      weekdayOffset = parsed._localeWeekday;
    } else if (parsed._weekdayNum !== undefined) {
      weekdayOffset = (parsed._weekdayNum - weekCfg.dow + 7) % 7;
    } else {
      weekdayOffset = 0;
    }
    const d = localeWeekToDate(
      parsed._weekYear,
      parsed._week,
      weekdayOffset,
      weekCfg.dow,
      weekCfg.doy,
    );
    if (parsed.hour !== undefined)
      {d.setUTCHours(parsed.hour, parsed.minute || 0, parsed.second || 0, parsed.millisecond || 0);}
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      ...baseConfig,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    if (parsed._empty !== undefined) {config._empty = parsed._empty;}
    if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
    return new Moment(config);
  }

  if (
    parsed.isoWeekYear !== undefined &&
    parsed.isoWeek !== undefined &&
    parsed.year === undefined &&
    parsed.month === undefined &&
    parsed.day === undefined
  ) {
    const isoWeekday = parsed._weekdayNum !== undefined ? parsed._weekdayNum : 1;
    const d = weekYearToDate(parsed.isoWeekYear, parsed.isoWeek, isoWeekday);
    if (parsed.hour !== undefined)
      {d.setUTCHours(parsed.hour, parsed.minute || 0, parsed.second || 0, parsed.millisecond || 0);}
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      ...baseConfig,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    if (parsed._empty !== undefined) {config._empty = parsed._empty;}
    if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
    return new Moment(config);
  }

  if (
    parsed._weekYear !== undefined &&
    parsed._week === undefined &&
    parsed.year === undefined &&
    parsed.month === undefined &&
    parsed.day === undefined
  ) {
    const year = parsed._weekYear;
    const nowTs = momentNowFn ? momentNowFn() : Date.now();
    const nowDate = new Date(nowTs);
    const nowYearStart = new Date(nowDate.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((nowTs - nowYearStart.getTime()) / 86400000);
    const currentWeekOfYear = Math.ceil((dayOfYear + nowYearStart.getDay() + 1) / 7);
    const loc = getLocale(locale);
    const weekCfg = (loc._config as any).week || { dow: 0, doy: 6 };
    const d = localeWeekToDate(year, Math.max(currentWeekOfYear, 1), 0, weekCfg.dow, weekCfg.doy);
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      _strict: strict,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    if (parsed._empty !== undefined) {config._empty = parsed._empty;}
    if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
    return new Moment(config);
  }

  if (
    parsed._week !== undefined &&
    parsed._weekYear === undefined &&
    parsed.year === undefined &&
    parsed.month === undefined &&
    parsed.day === undefined
  ) {
    const nowTs = momentNowFn ? momentNowFn() : Date.now();
    const year = new Date(nowTs).getFullYear();
    const loc = getLocale(locale);
    const weekCfg = (loc._config as any).week || { dow: 0, doy: 6 };
    const d = localeWeekToDate(year, parsed._week, 0, weekCfg.dow, weekCfg.doy);
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      _strict: strict,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    if (parsed._empty !== undefined) {config._empty = parsed._empty;}
    if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
    return new Moment(config);
  }

  if (
    parsed.isoWeek !== undefined &&
    parsed.isoWeekYear === undefined &&
    parsed.year === undefined &&
    parsed.month === undefined &&
    parsed.day === undefined
  ) {
    const nowTs = momentNowFn ? momentNowFn() : Date.now();
    const nowYear = new Date(nowTs).getUTCFullYear();
    const jan4 = new Date(Date.UTC(nowYear, 0, 4));
    const dayOfJan4 = jan4.getUTCDay() || 7;
    const offset = dayOfJan4 - 1;
    const week1Start = new Date(Date.UTC(nowYear, 0, 4 - offset));
    const d = new Date(week1Start.getTime() + (parsed.isoWeek - 1) * 7 * 86400000);
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      _strict: strict,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    if (parsed._empty !== undefined) {config._empty = parsed._empty;}
    if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
    return new Moment(config);
  }

  if (
    parsed.isoWeekYear !== undefined &&
    parsed.isoWeek === undefined &&
    parsed.year === undefined &&
    parsed.month === undefined &&
    parsed.day === undefined
  ) {
    const year = parsed.isoWeekYear;
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfJan4 = jan4.getUTCDay() || 7;
    const offset = dayOfJan4 - 1;
    const d = new Date(Date.UTC(year, 0, 4 - offset));
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      ...baseConfig,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    if (parsed._empty !== undefined) {config._empty = parsed._empty;}
    if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
    return new Moment(config);
  }

  if (parsed.dayOfYear !== undefined && parsed.day === undefined && parsed.month === undefined) {
    const year = parsed.year !== undefined ? parsed.year : new Date().getFullYear();
    const maxDayOfYear = isLeapYear(year) ? 366 : 365;
    if (parsed.dayOfYear > maxDayOfYear) {
      return new Moment({
        _d: new Date(NaN),
        _i: str,
        _f: format,
        _l: locale,
        _isValid: false,
        _overflow: 2,
      });
    }
    const d = new Date(Date.UTC(year, 0, parsed.dayOfYear));
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      ...baseConfig,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    return new Moment(config);
  }

  const isWeekdayOnly =
    parsed._weekdayNum !== undefined &&
    parsed.year === undefined &&
    parsed.month === undefined &&
    parsed.day === undefined &&
    parsed.hour === undefined &&
    parsed.minute === undefined &&
    parsed.second === undefined &&
    parsed.millisecond === undefined &&
    parsed.offset === undefined;

  if (isWeekdayOnly) {
    const d = new Date();
    const currentDay = d.getDay();
    const diff = parsed._weekdayNum - currentDay;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      ...baseConfig,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    if (parsed._empty !== undefined) {config._empty = parsed._empty;}
    if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
    return new Moment(config);
  }

  const isTimeOnly =
    parsed.hour !== undefined &&
    parsed.year === undefined &&
    parsed.month === undefined &&
    parsed.day === undefined &&
    parsed.offset === undefined;

  if (isTimeOnly) {
    const d = new Date();
    if (parsed._weekdayNum !== undefined) {
      const currentDay = d.getDay();
      const diff = parsed._weekdayNum - currentDay;
      d.setDate(d.getDate() + diff);
    }
    d.setHours(parsed.hour || 0, parsed.minute || 0, parsed.second || 0, parsed.millisecond || 0);
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      _meridiem: parsed._meridiem,
      ...baseConfig,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    if (parsed._empty !== undefined) {config._empty = parsed._empty;}
    if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
    return new Moment(config);
  }

  const hasYear = parsed.year !== undefined;
  const hasMonth = parsed.month !== undefined;

  let year = parsed.year !== undefined ? parsed.year : new Date().getFullYear();
  let month = parsed.month !== undefined ? parsed.month : hasYear ? 0 : new Date().getMonth();
  const day =
    parsed.day !== undefined ? parsed.day : hasYear || hasMonth ? 1 : new Date().getDate();
  let hour = parsed.hour !== undefined ? parsed.hour : 0;
  const minute = parsed.minute !== undefined ? parsed.minute : 0;
  const second = parsed.second !== undefined ? parsed.second : 0;
  const ms = parsed.millisecond !== undefined ? parsed.millisecond : 0;

  if (parsed.quarter !== undefined && month === 0 && !parsed.month) {
    month = (parsed.quarter - 1) * 3;
  }

  let d: Date;
  if (parsed.offset !== undefined) {
    d = createDateSafe(year, month, day, hour, minute, second, ms, true);
    d = new Date(d.getTime() - parsed.offset * 60000);
    const config: MomentConfig = {
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _parsedDateParts: parsed._parsedDateParts,
      _meridiem: parsed._meridiem,
      ...baseConfig,
    };
    if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
    if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
    if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
    return new Moment(config);
  }
  d = createDateSafe(year, month, day, hour, minute, second, ms, false);
  const config: MomentConfig = {
    _d: d,
    _i: str,
    _f: format,
    _l: locale,
    _parsedDateParts: parsed._parsedDateParts,
    _meridiem: parsed._meridiem,
    ...baseConfig,
  };
  if (parsed._unusedTokens) {config._unusedTokens = parsed._unusedTokens;}
  if (parsed._unusedInput) {config._unusedInput = parsed._unusedInput;}
  if (parsed._charsLeftOver !== undefined) {config._charsLeftOver = parsed._charsLeftOver;}
  if (parsed._empty !== undefined) {config._empty = parsed._empty;}
  if (parsed._invalidMonth !== undefined) {config._invalidMonth = parsed._invalidMonth;}
  return new Moment(config);
}

function createFromArray(arr: any[], isUTC?: boolean): Moment {
  if (arr.length === 0) {return new Moment({ _d: new Date(nowFn()), _i: arr });}
  let hasNull = false;
  for (const v of arr) {
    if (v === null) {hasNull = true;}
  }
  if (hasNull) {return new Moment({ _d: new Date(NaN), _i: arr, _isValid: false });}
  const parsed = parseArray(arr);
  if (!parsed) {
    if (arr.some((v) => v === null || v === undefined || (typeof v === "number" && isNaN(v)))) {
      return new Moment({ _d: new Date(NaN), _i: arr, _isValid: false });
    }
    return new Moment({ _d: new Date(NaN), _i: arr, _isValid: false });
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
  if (isNaN(d.getTime())) {return new Moment({ _d: new Date(NaN), _i: arr, _isValid: false });}
  return new Moment({ _d: d, _i: arr });
}

function createFromObject(obj: Record<string, any>): Moment {
  const parsed = parseObject(obj);
  if (isObjectEmpty(parsed)) {return new Moment({ _d: new Date(nowFn()), _i: obj });}
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
  const d = new Date(year, month, day, hour, minute, second, ms);
  if (overflow >= 0) {
    return new Moment({ _d: d, _i: obj, _isValid: false, _overflow: overflow });
  }
  return new Moment({ _d: d, _i: obj });
}

// Static methods
(moment as any).duration = function (input?: any, unit?: string): Duration {
  return new Duration(input as any, unit);
};
(moment as any).duration.invalid = function (): Duration {
  return Duration.invalid();
};
(moment as any).duration.fn = Duration.prototype;
(moment as any).fn = Moment.prototype;
(moment as any).prototype = Moment.prototype;

(moment as any).version = "2.30.1";
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
(moment as any).isMoment = isMoment;
(moment as any).isDate = isDate;
(moment as any).isDuration = function (obj: any): boolean {
  return checkIsDuration(obj);
};
(moment as any).normalizeUnits = normUnits;
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
(moment as any).momentProperties = momentProperties;
(moment as any).ISO_8601 = "ISO_8601";
(moment as any).RFC_2822 = "RFC_2822";
(moment as any).HTML5_FMT = {
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
(moment as any).utc = function (input?: any, format?: any, strict?: boolean): Moment {
  if (input === null) {
    return new Moment({
      _d: new Date(NaN),
      _isValid: false,
      _isUTC: true,
      _offset: 0,
      _i: input,
      _nullInput: true,
    });
  }
  if (input === undefined) {
    return new Moment({ _d: new Date(nowFn()), _isUTC: true, _offset: 0, _i: input });
  }
  const m = moment(input, format, strict);
  const absTime = m.valueOf();
  if (isNaN(absTime)) {
    m._isUTC = true;
    m._offset = 0;
    return m;
  }
  m._d = new Date(absTime);
  m._isUTC = true;
  m._offset = 0;
  return m;
};
(moment as any).parseZone = function (input?: any, format?: any, strict?: boolean): Moment {
  const m = moment(input, format, strict);
  return m.parseZone();
};
(moment as any).unix = function (ts: number): Moment {
  return moment(ts * 1000);
};
(moment as any).invalid = function (input?: any): Moment {
  const config: any = { _d: new Date(NaN), _isValid: false, _userInvalidated: true };
  if (
    typeof input === "object" &&
    input !== null &&
    !isArray(input) &&
    !isMoment(input) &&
    !isDate(input)
  ) {
    for (const key of Object.keys(input)) {
      config[`_${  key}`] = (input as any)[key];
    }
    delete config._userInvalidated;
    config._i = input;
  } else {
    config._i = input;
  }
  return new Moment(config as MomentConfig);
};
(moment as any).locale = function (locale?: string | string[], ...args: any[]): string | Locale {
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
(moment as any).localeData = function (locale?: string): Locale {
  return getLocale(locale);
};
(moment as any).lang = function (locale?: string, ...args: any[]): any {
  if (locale === undefined) {return (moment as any).locale();}
  if (args.length > 0 && typeof args[0] === "object") {
    return (moment as any).locale(locale, args[0]);
  }
  return (moment as any).locale(locale);
};
(moment as any).langData = function (locale?: string): Locale {
  return (moment as any).localeData(locale);
};
(moment as any).defineLocale = function (locale: string, config: any): Locale | void {
  return defineLocale(locale, config);
};
(moment as any).updateLocale = function (locale: string, config: any): Locale | void {
  return updateLocale(locale, config);
};
(moment as any).locales = listLocales;
(moment as any).months = function (format?: string, index?: number): string | string[] {
  return getMonths(format, index);
};
(moment as any).monthsShort = function (
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
(moment as any).weekdays = function (
  format?: string | boolean | number,
  index?: number,
): string | string[] {
  if (typeof format === "number") {
    const loc = getLocale();
    return loc._weekdays[format];
  }
  return getWeekdays(format as any, index);
};
(moment as any).weekdaysShort = function (
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
(moment as any).weekdaysMin = function (
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
(moment as any).min = function (...args: any[]): Moment {
  if (args.length === 0) {return moment();}
  let inputList = args;
  if (args.length === 1 && isArray(args[0]) && !isMoment(args[0])) {
    inputList = args[0] as any;
  }
  let best: Moment | null = null;
  let bestVal = Infinity;
  let bestInvalid: Moment | null = null;
  for (const item of inputList) {
    const m = isMoment(item) ? (item as Moment) : moment(item as any);
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
(moment as any).max = function (...args: any[]): Moment {
  if (args.length === 0) {return moment();}
  let inputList = args;
  if (args.length === 1 && isArray(args[0]) && !isMoment(args[0])) {
    inputList = args[0] as any;
  }
  let best: Moment | null = null;
  let bestVal = -Infinity;
  let bestInvalid: Moment | null = null;
  for (const item of inputList) {
    const m = isMoment(item) ? (item as Moment) : moment(item as any);
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
(moment as any).relativeTimeRounding = function (fn?: Function | boolean): Function | boolean {
  return setRelTimeRounding(fn as any);
};
(moment as any).relativeTimeThreshold = function (
  threshold: string,
  limit?: number,
): number | boolean {
  return setRelTimeThreshold(threshold, limit as any) as any;
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
(moment as any).suppressDeprecationWarnings = false;
(moment as any).deprecationHandler = null as ((name: string, msg: string) => void) | null;

// Register test locale data
import { registerTestLocales } from "./locale/test-locales";
registerTestLocales();

// Temporal bridge
(moment as any).config = configure;
(moment as any).report = reportFn;
(moment as any).fn.toTemporal = function (this: Moment): any {
  return toTemporalFn(this as any);
};
(moment as any).fromTemporal = fromTemporalFn;

export default moment;
export { moment, isMoment, isDate, Duration, Locale };
