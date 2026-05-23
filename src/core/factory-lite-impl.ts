import { MomentLite } from "../moment-lite";
import {
  isMoment,
  isDate,
  isString,
  isNumber,
  isArray,
  createDateSafe,
  createUTCDate,
} from "../utils";
import { daysInMonthFast } from "../units";
import { getLiteLocale, getLiteCurrentLocale } from "../locale-lite";
import type { ParseLocale } from "../parse-locale";
import { parseString, isCustomFormatParsingEnabled } from "../parse-lite";
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

export function disableFormattedInput(): void {
  formattedInputEnabled = false;
  formattedStringInputHandler = undefined;
}

/** @public */
export function isFormattedInputEnabled(): boolean {
  return formattedInputEnabled;
}

export function setFormattedStringInputHandler(
  handler: FactoryDeps["createFromFormattedStringInput"] | undefined,
): void {
  formattedStringInputHandler = handler;
}

/** @public */
export function getFormattedStringInputHandler():
  | FactoryDeps["createFromFormattedStringInput"]
  | undefined {
  return formattedStringInputHandler;
}

function createMomentFromParsed(
  parsed: ParsedDataLike,
  str?: string,
  format?: string,
  locale?: string,
  strict?: boolean,
): MomentLite {
  if (
    parsed.isoWeekYear !== undefined &&
    parsed.isoWeek !== undefined &&
    parsed.year === undefined
  ) {
    const jan4 = new Date(Date.UTC(parsed.isoWeekYear, 0, 4));
    const dayOfJan4 = jan4.getUTCDay() || 7;
    const week1Start = new Date(Date.UTC(parsed.isoWeekYear, 0, 4 - (dayOfJan4 - 1)));
    const weekday = parsed._weekdayNum ?? 1;
    const d = new Date(
      week1Start.getTime() + ((parsed.isoWeek - 1) * 7 + (weekday - 1)) * 86400000,
    );
    return new MomentLite({
      _d: d,
      _i: str,
      _f: format,
      _l: locale,
      _strict: strict,
      _unusedTokens: parsed._unusedTokens,
      _unusedInput: parsed._unusedInput,
      _charsLeftOver: parsed._charsLeftOver,
      _empty: parsed._empty,
      _invalidMonth: parsed._invalidMonth,
      _parsedDateParts: parsed._parsedDateParts,
      _meridiem: parsed._meridiem,
    });
  }

  let y = parsed.year;
  let mo = parsed.month;
  let d = parsed.day;
  if (parsed.dayOfYear !== undefined && mo === undefined && d === undefined) {
    const date = createUTCDate(
      y !== undefined ? y : new Date(nowFn()).getFullYear(),
      0,
      parsed.dayOfYear,
    );
    y = date.getUTCFullYear();
    mo = date.getUTCMonth();
    d = date.getUTCDate();
  } else {
    if (y === undefined) {
      y = new Date(nowFn()).getFullYear();
    }
    if (mo === undefined && y !== undefined) {
      mo = 0;
    }
    if (d === undefined) {
      d = 1;
    }
  }

  const h = parsed.hour ?? 0;
  const min = parsed.minute ?? 0;
  const sec = parsed.second ?? 0;
  const ms = parsed.millisecond ?? 0;
  const date =
    parsed.offset !== undefined
      ? createUTCDate(y, mo, d, h, min, sec, ms)
      : createDateSafe(y, mo, d, h, min, sec, ms, false);
  return new MomentLite({
    _d: date,
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
    _parsedDateParts: parsed._parsedDateParts,
    _meridiem: parsed._meridiem,
  });
}

function createFromString(
  str: string,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
): MomentLite {
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
    }
    if (typeof fourthArg === "boolean") {
      strict = fourthArg;
    }
  }

  if (fmt) {
    if (!formattedInputEnabled || !formattedStringInputHandler) {
      return new MomentLite({
        _dClone: false,
        _d: new Date(NaN),
        _i: str,
        _f: fmt,
        _l: locale,
        _strict: strict,
        _isValid: false,
      });
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

  // Fast path: charCode-based YYYY-MM-DD — no alloc, no parseString, no _refreshFields
  if (!fmt && str.length === 10 && str.charCodeAt(4) === 45 && str.charCodeAt(7) === 45) {
    const y0 = str.charCodeAt(0) - 48;
    if (y0 >= 0 && y0 <= 9) {
      const y1 = str.charCodeAt(1) - 48;
      if (y1 >= 0 && y1 <= 9) {
        const y2 = str.charCodeAt(2) - 48;
        if (y2 >= 0 && y2 <= 9) {
          const y3 = str.charCodeAt(3) - 48;
          if (y3 >= 0 && y3 <= 9) {
            const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
            const m0 = str.charCodeAt(5) - 48;
            if (m0 >= 0 && m0 <= 9) {
              const m1 = str.charCodeAt(6) - 48;
              if (m1 >= 0 && m1 <= 9) {
                const month01 = m0 * 10 + m1;
                if (month01 >= 1 && month01 <= 12) {
                  const d0 = str.charCodeAt(8) - 48;
                  if (d0 >= 0 && d0 <= 9) {
                    const d1 = str.charCodeAt(9) - 48;
                    if (d1 >= 0 && d1 <= 9) {
                      const day = d0 * 10 + d1;
                      const monthIdx = month01 - 1;
                      if (day >= 1 && day <= daysInMonthFast(year, monthIdx)) {
                        const d = createDateSafe(year, monthIdx, day, 0, 0, 0, 0, false);
                        if (!isNaN(d.getTime())) {
                          return new MomentLite({
                            _d: d,
                            _dClone: false,
                            _i: str,
                            _presetFields: {
                              y: year,
                              M: monthIdx,
                              D: day,
                              H: 0,
                              m: 0,
                              s: 0,
                              ms: 0,
                            },
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const parsed = parseString(
    str,
    undefined,
    getLiteLocale(getLiteCurrentLocale()) as unknown as ParseLocale,
  );
  if (parsed && !parsed._claimed) {
    if (parsed._hasDate !== undefined) {
      return new MomentLite({
        _d: createDateSafe(
          parsed.year!,
          parsed.month!,
          parsed.day!,
          parsed.hour ?? 0,
          parsed.minute ?? 0,
          parsed.second ?? 0,
          parsed.millisecond ?? 0,
          parsed.offset !== undefined,
        ),
        _offset: parsed.offset,
        _isUTC: parsed.offset !== undefined,
        _i: str,
      });
    }
    return createMomentFromParsed(parsed, str);
  }
  return new MomentLite({ _dClone: false, _d: new Date(NaN), _i: str, _isValid: false });
}

export function moment(
  input?: unknown,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
): MomentLite {
  if (input === null) {
    return new MomentLite({
      _dClone: false,
      _d: new Date(NaN),
      _i: input,
      _isValid: false,
      _nullInput: true,
      _overflow: -1,
    });
  }
  if (input === undefined) {
    if (format !== undefined && typeof format !== "boolean") {
      return new MomentLite({
        _dClone: false,
        _d: new Date(NaN),
        _i: input,
        _f: format as string | string[],
        _isValid: false,
        _nullInput: true,
      });
    }
    return new MomentLite({
      _t: nowFn(),
      _isUTC: false,
      _offset: 0,
      _isValid: true,
    });
  }
  if (isMoment(input)) {
    return (input as MomentLite).clone();
  }
  if (isDate(input)) {
    const d = new Date(input.getTime());
    return new MomentLite({
      _dClone: false,
      _d: d,
      _i: input,
      _presetFields: {
        y: d.getFullYear(),
        M: d.getMonth(),
        D: d.getDate(),
        H: d.getHours(),
        m: d.getMinutes(),
        s: d.getSeconds(),
        ms: d.getMilliseconds(),
      },
    });
  }
  if (isNumber(input)) {
    const n = input;
    if (isNaN(n) || !isFinite(n)) {
      return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
    }
    if (format === "X") {
      return new MomentLite({ _dClone: false, _d: new Date(n * 1000), _i: input, _f: "X" });
    }
    if (format === "x") {
      return new MomentLite({ _dClone: false, _d: new Date(n), _i: input, _f: "x" });
    }
    if (format !== undefined) {
      return new MomentLite({
        _dClone: false,
        _d: new Date(NaN),
        _isValid: false,
        _overflow: -1,
        _i: input,
        _f: format as string,
      });
    }
    return new MomentLite({ _dClone: false, _d: new Date(n), _i: input });
  }
  if (isArray(input)) {
    const arr = input;
    if (arr.length === 0) {
      return new MomentLite({ _t: nowFn(), _i: input });
    }
    for (const val of arr) {
      if (val === null || val === undefined) {
        return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
      }
      if (isNaN(Number(val))) {
        return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
      }
    }
    const y = Number(arr[0]);
    if (isNaN(y)) {
      return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
    }
    const M = arr[1] !== undefined ? Number(arr[1]) : 0;
    const D = arr[2] !== undefined ? Number(arr[2]) : 1;
    const H = arr[3] !== undefined ? Number(arr[3]) : 0;
    const min = arr[4] !== undefined ? Number(arr[4]) : 0;
    const s = arr[5] !== undefined ? Number(arr[5]) : 0;
    const ms = arr[6] !== undefined ? Number(arr[6]) : 0;
    const d = createDateSafe(y, M, D, H, min, s, ms, false);
    if (isNaN(d.getTime())) {
      return new MomentLite({ _dClone: false, _d: d, _isValid: false, _i: input });
    }
    return new MomentLite({
      _d: d,
      _dClone: false,
      _i: input,
      _presetFields: H === 24 ? undefined : { y, M, D, H: H, m: min, s, ms },
    });
  }
  if (isString(input)) {
    return createFromString(input, format, localeOrStrict, fourthArg);
  }
  return new MomentLite({ _dClone: false, _d: new Date(NaN), _isValid: false, _i: input });
}

export function momentUTC(
  input?: unknown,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
): MomentLite {
  if (input === null) {
    return new MomentLite({
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
    return new MomentLite({
      _t: nowFn(),
      _isUTC: true,
      _offset: 0,
      _isValid: true,
    });
  }
  const m = moment(input, format, localeOrStrict, fourthArg);
  if (!m._isValid) {
    m._p.isUTC = true;
    m._p.offset = 0;
    return m;
  }
  const absTime = m.valueOf();
  if (isNaN(absTime)) {
    m._p.isUTC = true;
    m._p.offset = 0;
    return m;
  }
  if (!m._p.isUTC && isString(input)) {
    const utcDate = new Date(`${input} UTC`);
    if (!isNaN(utcDate.getTime())) {
      m._p.d = utcDate;
    } else {
      m._p.d = new Date(absTime - (m._p.d ?? new Date(absTime)).getTimezoneOffset() * 60000);
    }
  } else {
    m._p.d = new Date(absTime);
  }
  m._p.t = m._p.d.getTime();
  m._p.isUTC = true;
  m._p.offset = 0;
  return m;
}
