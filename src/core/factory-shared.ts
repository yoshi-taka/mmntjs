import type { MomentConfig } from "../moment2";
import { Moment, checkOverflow } from "../moment2";
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
} from "../utils";
import { getLocale, getCurrentLocale, localeHasMissingParent } from "../locale-runtime";
import type { ParseLocale } from "../parse-locale";

type ParsedDataLike = Record<string, any>;
type FormattedStringInputHandler = (args: {
  str: string;
  format?: unknown;
  localeOrStrict?: unknown;
  fourthArg?: unknown;
  deps: {
    parseString: (str: string, format?: string | string[], locale?: ParseLocale, strict?: boolean) => ParsedDataLike | null;
    isCustomFormatParsingEnabled: () => boolean;
  };
  createMomentFromParsed: (parsed: ParsedDataLike, str?: string, format?: string, locale?: string, strict?: boolean) => Moment;
}) => Moment;
type ArrayInputHandler = (
  arr: unknown[],
  parseArray: (arr: unknown[]) => ParsedDataLike | null,
  nowFn: () => number,
  isUTC?: boolean,
) => Moment;
type ObjectInputHandler = (
  obj: Record<string, unknown>,
  parseObject: (obj: Record<string, unknown>) => Record<string, unknown>,
  nowFn: () => number,
) => Moment;

export type FactoryDeps = {
  parseString: (str: string, format?: string | string[], locale?: ParseLocale, strict?: boolean) => ParsedDataLike | null;
  parseArray?: (arr: unknown[]) => ParsedDataLike | null;
  parseObject?: (obj: Record<string, unknown>) => Record<string, unknown>;
  isCustomFormatParsingEnabled: () => boolean;
  supportsFormattedInput?: boolean | (() => boolean);
  createFromFormattedStringInput?: FormattedStringInputHandler;
  createFromArrayInput?: ArrayInputHandler;
  createFromObjectInput?: ObjectInputHandler;
  nowFn: () => number;
};

export function createMomentFactory(deps: FactoryDeps) {
  function hasAnyValue(parsed: ParsedDataLike): boolean {
    return parsed.year !== undefined || parsed.month !== undefined || parsed.day !== undefined || parsed.hour !== undefined || parsed.minute !== undefined || parsed.second !== undefined || parsed.millisecond !== undefined || parsed.isoWeek !== undefined || parsed.isoWeekYear !== undefined || parsed.dayOfYear !== undefined || parsed.quarter !== undefined || parsed._week !== undefined || parsed._weekYear !== undefined || parsed._weekdayNum !== undefined;
  }

  function createMomentFromParsed(parsed: ParsedDataLike, str?: string, format?: string, locale?: string, strict?: boolean): Moment {
    if (parsed.isoWeekYear !== undefined && parsed.isoWeek !== undefined && parsed.year === undefined) {
      const jan4 = new Date(Date.UTC(parsed.isoWeekYear, 0, 4));
      const dayOfJan4 = jan4.getUTCDay() || 7;
      const week1Start = new Date(Date.UTC(parsed.isoWeekYear, 0, 4 - (dayOfJan4 - 1)));
      const weekday = parsed._weekdayNum ?? 1;
      const d = new Date(week1Start.getTime() + ((parsed.isoWeek - 1) * 7 + (weekday - 1)) * 86400000);
      return new Moment({ _d: d, _i: str, _f: format, _l: locale, _strict: strict });
    }
    let y = parsed.year;
    let mo = parsed.month;
    let d = parsed.day;
    if (parsed.dayOfYear !== undefined && mo === undefined && d === undefined) {
      const date = createUTCDate(y !== undefined ? y : new Date(deps.nowFn()).getFullYear(), 0, parsed.dayOfYear);
      y = date.getUTCFullYear();
      mo = date.getUTCMonth();
      d = date.getUTCDate();
    } else {
      if (y === undefined) {y = new Date(deps.nowFn()).getFullYear();}
      if (mo === undefined && y !== undefined) {mo = 0;}
      if (d === undefined) {d = 1;}
    }
    const date = parsed.offset !== undefined
      ? createUTCDate(y, mo, d, parsed.hour ?? 0, parsed.minute ?? 0, parsed.second ?? 0, parsed.millisecond ?? 0)
      : createDateSafe(y, mo, d, parsed.hour ?? 0, parsed.minute ?? 0, parsed.second ?? 0, parsed.millisecond ?? 0, false);
    return new Moment({ _d: date, _i: str, _f: format, _l: locale, _strict: strict, _offset: parsed.offset, _isUTC: parsed.offset !== undefined });
  }

  function createFromString(str: string, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment {
    const supportsFormattedInput = typeof deps.supportsFormattedInput === "function"
      ? deps.supportsFormattedInput()
      : (deps.supportsFormattedInput ?? true);
    let strict = false;
    let locale: string | undefined;
    let fmt: string | string[] | undefined;
    if (typeof format === "boolean") { strict = format; }
    else if (typeof localeOrStrict === "boolean") { fmt = format as string | string[] | undefined; strict = localeOrStrict; }
    else {
      fmt = format as string | string[] | undefined;
      if (typeof localeOrStrict === "string") {
        locale = localeOrStrict;
        if (locale && localeHasMissingParent(locale)) {locale = "en";}
      }
      if (typeof fourthArg === "boolean") {strict = fourthArg;}
    }
    if (fmt) {
      if (!supportsFormattedInput || !deps.createFromFormattedStringInput) {
        return new Moment({ _dClone: false, _d: new Date(NaN), _i: str, _f: fmt, _l: locale, _strict: strict, _isValid: false, _invalidFormat: isArray(fmt) ? fmt.length === 0 : undefined });
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
    const parsed = deps.parseString(str, undefined, getLocale(getCurrentLocale()) as unknown as ParseLocale);
    if (parsed && !parsed._claimed) {
      if (parsed._hasDate !== undefined) {
        return new Moment({ _d: createDateSafe(parsed.year, parsed.month, parsed.day, parsed.hour ?? 0, parsed.minute ?? 0, parsed.second ?? 0, parsed.millisecond ?? 0, parsed.offset !== undefined), _offset: parsed.offset, _isUTC: parsed.offset !== undefined, _i: str });
      }
      return createMomentFromParsed(parsed, str);
    }
    return new Moment({ _dClone: false, _d: new Date(str), _i: str });
  }

  function createFromArray(arr: unknown[], isUTC?: boolean): Moment {
    if (!deps.parseArray || !deps.createFromArrayInput) {return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });}
    return deps.createFromArrayInput(arr, deps.parseArray, deps.nowFn, isUTC);
  }

  function createFromObject(obj: Record<string, unknown>): Moment {
    if (!deps.parseObject || !deps.createFromObjectInput) {return new Moment({ _dClone: false, _d: new Date(NaN), _i: obj, _isValid: false });}
    return deps.createFromObjectInput(obj, deps.parseObject, deps.nowFn);
  }

  return function moment(input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment {
    if (input === null) {return new Moment({ _dClone: false, _d: new Date(NaN), _i: input, _isValid: false, _nullInput: true, _overflow: -1 });}
    if (input === undefined) {
      if (format !== undefined && typeof format !== "boolean" && !(isArray(format) && format.length === 0)) {
        return new Moment({ _dClone: false, _d: new Date(NaN), _i: input, _f: format as string | string[], _isValid: false, _nullInput: true });
      }
      const m = Object.create(Moment.prototype) as Moment;
      m._isAMomentObject = true;
      m._isUTC = false;
      m._offset = 0;
      m._t = deps.nowFn();
      m._isValid = true;
      m._dirty = true;
      return m;
    }
    if (isMoment(input)) {return (input as Moment).clone();}
    if (isObject(input) && input._isAMomentObject) {
      const obj = input as Record<string, any>;
      const cfg: MomentConfig = { _d: obj._d ? new Date(obj._d.getTime()) : new Date(NaN), _i: obj._i ?? input, _f: obj._f, _l: obj._l, _isValid: obj._isValid ?? true, _isUTC: obj._isUTC ?? false, _offset: obj._offset ?? 0, _strict: obj._strict ?? false, _overflow: obj._overflow ?? -1, _parsedDateParts: obj._parsedDateParts ?? [] };
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
    if (isDate(input)) {return new Moment({ _dClone: false, _d: new Date(input.getTime()), _i: input });}
    if (isNumber(input)) {
      const n = input;
      if (isNaN(n) || !isFinite(n)) {return new Moment({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });}
      if (format === "X") {return new Moment({ _dClone: false, _d: new Date(n * 1000), _i: input, _f: "X" });}
      if (format === "x") {return new Moment({ _dClone: false, _d: new Date(n), _i: input, _f: "x" });}
      if (format !== undefined) {return new Moment({ _dClone: false, _d: new Date(NaN), _isValid: false, _overflow: -1, _i: input, _f: format as string });}
      return new Moment({ _dClone: false, _d: new Date(n), _i: input });
    }
    if (isString(input)) {return createFromString(input, format, localeOrStrict, fourthArg);}
    if (isArray(input)) {
      const arr = input;
      if (arr.length === 0 && (format === "X" || format === "x")) {return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false, _f: format as string });}
      return createFromArray(arr);
    }
    if (isObject(input)) {return createFromObject(input);}
    return new Moment({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
  };
}
