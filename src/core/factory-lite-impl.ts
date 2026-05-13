import { MomentLite } from "../moment-lite";
import {
  isMoment,
  isDate,
  isString,
  isArray,
  isNumber,
  createDateSafe,
  createUTCDate,
} from "../utils";
import { getLiteLocale, getLiteCurrentLocale } from "../locale-lite";
import type { ParseLocale } from "../parse-locale";
import {
  parseString,
  isCustomFormatParsingEnabled,
} from "../parse-lite-strict";
import type { FactoryDeps } from "./factory-shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedDataLike = Record<string, any>;

let momentNowFn: (() => number) | undefined;
let formattedInputEnabled = false;
let formattedStringInputHandler: FactoryDeps["createFromFormattedStringInput"] | undefined;

export function setMomentNowFunction(fn: (() => number) | undefined): void {
  momentNowFn = fn;
}

export function getMomentNowFunction(): (() => number) | undefined {
  return momentNowFn;
}

export function nowFn(): number {
  return momentNowFn ? momentNowFn() : Date.now();
}

export function enableFormattedInput(): void {
  formattedInputEnabled = true;
}

export function isFormattedInputEnabled(): boolean {
  return formattedInputEnabled;
}

export function setFormattedStringInputHandler(handler: FactoryDeps["createFromFormattedStringInput"] | undefined): void {
  formattedStringInputHandler = handler;
}

export function getFormattedStringInputHandler(): FactoryDeps["createFromFormattedStringInput"] | undefined {
  return formattedStringInputHandler;
}

function createMomentFromParsed(parsed: ParsedDataLike, str?: string, format?: string, locale?: string, strict?: boolean): MomentLite {
  if (parsed.isoWeekYear !== undefined && parsed.isoWeek !== undefined && parsed.year === undefined) {
    const jan4 = new Date(Date.UTC(parsed.isoWeekYear, 0, 4));
    const dayOfJan4 = jan4.getUTCDay() || 7;
    const week1Start = new Date(Date.UTC(parsed.isoWeekYear, 0, 4 - (dayOfJan4 - 1)));
    const weekday = parsed._weekdayNum ?? 1;
    const d = new Date(week1Start.getTime() + ((parsed.isoWeek - 1) * 7 + (weekday - 1)) * 86400000);
    return new MomentLite({ _d: d, _i: str, _f: format, _l: locale, _strict: strict });
  }

  let y = parsed.year;
  let mo = parsed.month;
  let d = parsed.day;
  if (parsed.dayOfYear !== undefined && mo === undefined && d === undefined) {
    const date = createUTCDate(y !== undefined ? y : new Date(nowFn()).getFullYear(), 0, parsed.dayOfYear);
    y = date.getUTCFullYear();
    mo = date.getUTCMonth();
    d = date.getUTCDate();
  } else {
    if (y === undefined) {y = new Date(nowFn()).getFullYear();}
    if (mo === undefined && y !== undefined) {mo = 0;}
    if (d === undefined) {d = 1;}
  }

  const h = parsed.hour ?? 0;
  const min = parsed.minute ?? 0;
  const sec = parsed.second ?? 0;
  const ms = parsed.millisecond ?? 0;
  const date = parsed.offset !== undefined
    ? createUTCDate(y, mo, d, h, min, sec, ms)
    : createDateSafe(y, mo, d, h, min, sec, ms, false);
  return new MomentLite({ _d: date, _i: str, _f: format, _l: locale, _strict: strict, _offset: parsed.offset, _isUTC: parsed.offset !== undefined });
}

function createFromString(str: string, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): MomentLite {
  let strict = false;
  let locale: string | undefined;
  let fmt: string | string[] | undefined;

  if (typeof format === "boolean") { strict = format; }
  else if (typeof localeOrStrict === "boolean") { fmt = format as string | string[] | undefined; strict = localeOrStrict; }
  else {
    fmt = format as string | string[] | undefined;
    if (typeof localeOrStrict === "string") { locale = localeOrStrict; }
    if (typeof fourthArg === "boolean") {strict = fourthArg;}
  }

  if (fmt) {
    if (!formattedInputEnabled || !formattedStringInputHandler) {
      return new MomentLite({ _dClone: false, _d: new Date(NaN), _i: str, _f: fmt, _l: locale, _strict: strict, _isValid: false });
    }
    return formattedStringInputHandler({
      str,
      format,
      localeOrStrict,
      fourthArg,
      deps: {
        parseString,
        isCustomFormatParsingEnabled,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createMomentFromParsed: createMomentFromParsed as any,
    }) as unknown as MomentLite;
  }

  const parsed = parseString(str, undefined, getLiteLocale(getLiteCurrentLocale()) as unknown as ParseLocale);
  if (parsed && !parsed._claimed) {
    if (parsed._hasDate !== undefined) {
      return new MomentLite({ _d: createDateSafe(parsed.year!, parsed.month!, parsed.day!, parsed.hour ?? 0, parsed.minute ?? 0, parsed.second ?? 0, parsed.millisecond ?? 0, parsed.offset !== undefined), _offset: parsed.offset, _isUTC: parsed.offset !== undefined, _i: str });
    }
    return createMomentFromParsed(parsed, str);
  }
  return new MomentLite({ _dClone: false, _d: new Date(NaN), _i: str, _isValid: false });
}

export function moment(input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): MomentLite {
  if (input === null) {return new MomentLite({ _dClone: false, _d: new Date(NaN), _i: input, _isValid: false, _nullInput: true, _overflow: -1 });}
  if (input === undefined) {
    if (format !== undefined && typeof format !== "boolean" && !(isArray(format) && format.length === 0)) {
      return new MomentLite({ _dClone: false, _d: new Date(NaN), _i: input, _f: format as string | string[], _isValid: false, _nullInput: true });
    }
    const m = Object.create(MomentLite.prototype) as MomentLite;
    m._isAMomentObject = true;
    m._isUTC = false;
    m._offset = 0;
    m._t = nowFn();
    m._isValid = true;
    m._dirty = true;
    return m;
  }
  if (isMoment(input)) {return (input as MomentLite).clone();}
  if (isDate(input)) {return new MomentLite({ _dClone: false, _d: new Date(input.getTime()), _i: input });}
  if (isNumber(input)) {
    const n = input;
    if (isNaN(n) || !isFinite(n)) {return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });}
    if (format === "X") {return new MomentLite({ _dClone: false, _d: new Date(n * 1000), _i: input, _f: "X" });}
    if (format === "x") {return new MomentLite({ _dClone: false, _d: new Date(n), _i: input, _f: "x" });}
    if (format !== undefined) {return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _overflow: -1, _i: input, _f: format as string });}
    return new MomentLite({ _dClone: false, _d: new Date(n), _i: input });
  }
  if (isString(input)) {return createFromString(input, format, localeOrStrict, fourthArg);}
  return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
}

export function momentUTC(input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): MomentLite {
  if (input === null) {
    return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _isUTC: true, _offset: 0, _i: input, _nullInput: true });
  }
  if (input === undefined) {
    const m = Object.create(MomentLite.prototype) as MomentLite;
    m._isAMomentObject = true;
    m._isUTC = true;
    m._offset = 0;
    m._t = nowFn();
    m._isValid = true;
    m._dirty = true;
    return m;
  }
  const m = moment(input, format, localeOrStrict, fourthArg);
  if (!m._isValid) {
    m._isUTC = true;
    m._offset = 0;
    return m;
  }
  const absTime = m.valueOf();
  if (isNaN(absTime)) {
    m._isUTC = true;
    m._offset = 0;
    return m;
  }
  if (!m._isUTC && isString(input)) {
    const utcDate = new Date(`${input} UTC`);
    if (!isNaN(utcDate.getTime())) {
      m._d = utcDate;
    } else {
      m._d = new Date(absTime - (m._d ?? new Date(absTime)).getTimezoneOffset() * 60000);
    }
  } else {
    m._d = new Date(absTime);
  }
  m._t = m._d.getTime();
  m._isUTC = true;
  m._offset = 0;
  return m;
}
