import { zeroFill } from "./utils";
import type { Locale } from "./locale-runtime";
import type { Moment } from "./moment-class";

type DebugMoment = Moment & {
  _i?: unknown;
  _f?: unknown;
  _isUTC: boolean;
  _offset: number;
  _strict?: boolean;
  _overflow?: number;
  _unusedTokens?: string[];
  _unusedInput?: string[];
  _charsLeftOver?: number;
  _empty?: boolean;
  _nullInput?: boolean;
  _invalidMonth?: string | null;
  _invalidFormat?: boolean;
  _userInvalidated?: boolean;
  _iso?: boolean;
  _parsedDateParts?: number[];
  _meridiem?: string;
  _rfc2822?: boolean;
  _weekdayMismatch?: boolean;
  _bigHour?: boolean;
  _isParseZone?: boolean;
  _invalidEra?: number;
  _tooBusyWith?: string;
  _isValid: boolean;
  _t: number;
  _getD: () => Date;
  _getLocale: () => Locale;
  year: () => number;
  month: () => number;
  date: () => number;
  hour: () => number;
  minute: () => number;
  second: () => number;
  millisecond: () => number;
  isLocal: () => boolean;
  utcOffset: () => number;
  format: (format: string) => string;
  valueOf: () => number;
};

export function toArrayMoment(m: DebugMoment): number[] {
  return [
    m.year(),
    m.month(),
    m.date(),
    m.hour(),
    m.minute(),
    m.second(),
    m.millisecond(),
  ];
}

export function inspectMoment(m: DebugMoment): string {
  if (!m._isValid) {
    const inputStr = m._i !== undefined ? String(m._i as string | number) : "";
    return `moment.invalid(/* ${inputStr} */)`;
  }
  if (!m.isLocal()) {
    const func = m.utcOffset() === 0 ? "moment.utc" : "moment.parseZone";
    const yearStr = m.year() >= 0 && m.year() <= 9999 ? "YYYY" : "YYYYYY";
    return m.format(`[${func}("]${yearStr}-MM-DD[T]HH:mm:ss.SSSZ[")]`);
  }
  const yearStr = m.year() >= 0 && m.year() <= 9999 ? "YYYY" : "YYYYYY";
  return m.format(`[moment("]${yearStr}-MM-DD[T]HH:mm:ss.SSS[")]`);
}

export function toStringMoment(m: DebugMoment): string {
  if (!m._isValid) {return "Invalid date";}
  return m.format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
}

export function creationDataMoment(m: DebugMoment): Record<string, unknown> {
  return {
    input: m._i,
    format: m._f,
    locale: m._getLocale(),
    isUTC: m._isUTC,
    strict: m._strict,
  };
}

export function parsingFlagsMoment(m: DebugMoment): Record<string, unknown> {
  const result: Record<string, unknown> = {
    overflow: m._overflow ?? -1,
    unusedTokens: m._unusedTokens ?? [],
    unusedInput: m._unusedInput ?? [],
    charsLeftOver: m._charsLeftOver ?? 0,
    empty: m._empty ?? false,
    nullInput: m._nullInput ?? false,
    invalidMonth: m._invalidMonth ?? null,
    invalidFormat: m._invalidFormat ?? false,
    userInvalidated: m._userInvalidated ?? false,
    iso: m._iso ?? false,
    parsedDateParts: m._parsedDateParts ?? [],
    meridiem: m._meridiem ?? "",
    rfc2822: m._rfc2822 ?? false,
    weekdayMismatch: m._weekdayMismatch ?? false,
    isAmPm: m._bigHour ?? false,
    isParseZone: m._isParseZone ?? false,
    bigHour: m._bigHour ?? false,
  };
  if (m._invalidEra !== undefined) {result.invalidEra = m._invalidEra;}
  if (m._tooBusyWith !== undefined) {result.tooBusyWith = m._tooBusyWith;}
  return result;
}

export function invalidAtMoment(m: DebugMoment): number {
  const overflow = m._overflow;
  if (overflow === undefined || overflow < 0) {return -1;}
  return overflow;
}

export function toObjectMoment(m: DebugMoment): Record<string, number> {
  return {
    years: m.year(),
    months: m.month(),
    date: m.date(),
    hours: m.hour(),
    minutes: m.minute(),
    seconds: m.second(),
    milliseconds: m.millisecond(),
  };
}

export function toISOStringKeepOffsetMoment(m: DebugMoment): string {
  const d = m._getD();
  const year = m._isUTC ? d.getUTCFullYear() : d.getFullYear();
  const month = zeroFill((m._isUTC ? d.getUTCMonth() : d.getMonth()) + 1, 2);
  const day = zeroFill(m._isUTC ? d.getUTCDate() : d.getDate(), 2);
  const hour = zeroFill(m._isUTC ? d.getUTCHours() : d.getHours(), 2);
  const min = zeroFill(m._isUTC ? d.getUTCMinutes() : d.getMinutes(), 2);
  const sec = zeroFill(m._isUTC ? d.getUTCSeconds() : d.getSeconds(), 2);
  const ms = zeroFill(m._isUTC ? d.getUTCMilliseconds() : d.getMilliseconds(), 3);
  const offset = m._isUTC ? m._offset : -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const offsetStr = `${sign}${zeroFill(Math.floor(absOffset / 60), 2)}:${zeroFill(absOffset % 60, 2)}`;
  const yearStr = year >= 0
    ? (year >= 10000 ? `+${zeroFill(year, 6)}` : zeroFill(year, 4))
    : `-${zeroFill(-year, 6)}`;
  return `${yearStr}-${month}-${day}T${hour}:${min}:${sec}.${ms}${offsetStr}`;
}

export function toISOStringUtcMoment(m: DebugMoment): string {
  const utcMs = m._isUTC ? m._t - m._offset * 60000 : m._t;
  const utcDate = new Date(utcMs);
  const year = utcDate.getUTCFullYear();
  const month = zeroFill(utcDate.getUTCMonth() + 1, 2);
  const day = zeroFill(utcDate.getUTCDate(), 2);
  const hour = zeroFill(utcDate.getUTCHours(), 2);
  const min = zeroFill(utcDate.getUTCMinutes(), 2);
  const sec = zeroFill(utcDate.getUTCSeconds(), 2);
  const ms = zeroFill(utcDate.getUTCMilliseconds(), 3);
  const yearStr = year >= 0
    ? (year >= 10000 ? `+${zeroFill(year, 6)}` : zeroFill(year, 4))
    : `-${zeroFill(-year, 6)}`;
  return `${yearStr}-${month}-${day}T${hour}:${min}:${sec}.${ms}Z`;
}
