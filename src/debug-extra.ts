import type { Locale } from "./locale-runtime";
import type { Moment } from "./moment-class";

type DebugMoment = Moment & {
  _cold?: Record<string, unknown>;
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

function toArrayDebugMoment(m: DebugMoment): number[] {
  return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
}

function asDebugMoment(m: Moment): DebugMoment {
  return m as DebugMoment;
}

export function toArrayMoment(m: Moment): number[] {
  return toArrayDebugMoment(asDebugMoment(m));
}

export function inspectMoment(m: Moment): string {
  return inspectDebugMoment(asDebugMoment(m));
}

export function toStringMoment(m: Moment): string {
  return toStringDebugMoment(asDebugMoment(m));
}

export function creationDataMoment(m: Moment): Record<string, unknown> {
  return creationDataDebugMoment(asDebugMoment(m));
}

export function parsingFlagsMoment(m: Moment): Record<string, unknown> {
  return parsingFlagsDebugMoment(asDebugMoment(m));
}

export function invalidAtMoment(m: Moment): number {
  return invalidAtDebugMoment(asDebugMoment(m));
}

export function toObjectMoment(m: Moment): Record<string, number> {
  return toObjectDebugMoment(asDebugMoment(m));
}

function inspectDebugMoment(m: DebugMoment): string {
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

function toStringDebugMoment(m: DebugMoment): string {
  if (!m._isValid) {
    return "Invalid date";
  }
  return m.format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
}

function creationDataDebugMoment(m: DebugMoment): Record<string, unknown> {
  return {
    input: m._i,
    format: m._f,
    locale: m._getLocale(),
    isUTC: m._isUTC,
    strict: m._strict,
  };
}

function parsingFlagsDebugMoment(m: DebugMoment): Record<string, unknown> {
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
  const known = new Set(Object.keys(result));
  const cold = m._cold ?? {};
  for (const [key, value] of Object.entries(cold)) {
    const publicKey = key.startsWith("_") ? key.slice(1) : key;
    if (!known.has(publicKey) && value !== undefined) {
      result[publicKey] = value;
    }
  }
  if (m._invalidEra !== undefined) {
    result.invalidEra = m._invalidEra;
  }
  if (m._tooBusyWith !== undefined) {
    result.tooBusyWith = m._tooBusyWith;
  }
  return result;
}

function invalidAtDebugMoment(m: DebugMoment): number {
  const overflow = m._overflow;
  if (overflow === undefined || overflow < 0) {
    return -1;
  }
  return overflow;
}

function toObjectDebugMoment(m: DebugMoment): Record<string, number> {
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
