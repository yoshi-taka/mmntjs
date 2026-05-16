import { isArray, hasOwnProp, escapeRegex, LruMap } from "./utils";
import type { ParseLocale } from "./parse-locale";
import type { InternalParsedData, CachedParseLocale } from "./types";
import {
  localeIsPM,
  localeLongDateFormat,
  localeMonths,
  localeMonthsShort,
} from "./locale-runtime";

export let parseTwoDigitYearFn: ((input: string) => number) | undefined;
let customFormatParsingEnabled = false;
type FormatParser = (
  str: string,
  format: string,
  locale?: ParseLocale,
  strict?: boolean,
) => ParsedData | null;
type FormatsParser = (
  str: string,
  formats: string[],
  locale?: ParseLocale,
  strict?: boolean,
) => ParsedData | null;

let _registeredFormatParser: FormatParser | undefined;
let _registeredFormatsParser: FormatsParser | undefined;

export function setParseTwoDigitYear(fn: ((input: string) => number) | undefined): void {
  parseTwoDigitYearFn = fn;
}

export function enableCustomFormatParsing(): void {
  customFormatParsingEnabled = true;
}

export function isCustomFormatParsingEnabled(): boolean {
  return customFormatParsingEnabled;
}

export function registerCustomFormatParser(single: FormatParser, multi: FormatsParser): void {
  _registeredFormatParser = single;
  _registeredFormatsParser = multi;
}

const ISO_8601_REGEX =
  /^\s*([+-]\d{6}|\d{4})(?!\d{2}\b)(-?(\d{2})(-?(\d{2})([T ](\d{2})(:?(\d{2})(:?(\d{2})([.,](\d+))?)?)?\s*(Z|([+-])(\d{2})(:?(\d{2}))?)?)?)?)?$/;

const EXTENDED_ISO_REGEX =
  /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
const BASIC_ISO_REGEX =
  /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d|))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

const RFC_2822_REGEX =
  /^\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d{2}):(\d{2})(?::(\d{2}))?\s(?:([+-]\d{4})|(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[A-IK-Za-ik-z]))?/;

const JSON_DATE_REGEX = /^\/?Date\((-?\d+)(?:[+-]\d{4})?\)\/?$/;

const WEEKDAY_NAMES_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function parseString(
  str: string,
  format?: string | string[],
  locale?: ParseLocale,
  strict?: boolean,
): ParsedData | null {
  if (typeof str !== "string") {
    return null;
  }

  if (!format && (locale?._abbr ?? "en") === "en") {
    const fast = parseCommonISO(str);
    if (fast) {
      return fast as unknown as ParsedData;
    }
  }

  const locObj = locale;
  if (!locObj) {
    return null;
  }

  const preparseFn = (locale as never as { _config?: { preparse?: (s: string) => string } })._config
    ?.preparse;

  if (format) {
    // Fast path: known ISO format strings bypass localePreparse + parseWithFormat.
    if (typeof format === "string" && !strict) {
      const fast = tryIsoFormatFastPath(str, format);
      if (fast) {
        return fast as unknown as ParsedData;
      }
    }
    const preparsed = preparseFn ? preparseFn(str) : str;
    if (isArray(format)) {
      return parseWithFormats(preparsed, format, locale, strict) as unknown as ParsedData;
    }
    return parseWithFormat(preparsed, format, locale, strict) as unknown as ParsedData;
  }

  str = preparseFn ? preparseFn(str) : str;
  const trimmed = str;

  let blank = true;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed.charCodeAt(i);
    if (c !== 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d && c !== 0x0c) {
      blank = false;
      break;
    }
  }
  if (blank) {
    return null;
  }

  // ── input classifier: cheap charCodeAt routing before heavy parse attempts ──
  // Digit/sign → ISO fast paths (parseCommonISO/Extended, ISO table).
  // Slash → JSON /Date()/ format first.
  // After ISO attempts, all paths fall through to RFC 2822 (handles
  // both alpha-weekday and digit-day forms like "15 Jan 2024...").

  const c0 = trimmed.charCodeAt(0);
  const isDigit = c0 >= 48 && c0 <= 57;
  const isSlash = c0 === 47;
  const isSign = c0 === 43 || c0 === 45;

  if (isDigit) {
    const fastResult = parseCommonISOExtended(trimmed);
    if (fastResult) {
      return fastResult as unknown as ParsedData;
    }
  } else if (isSlash) {
    const jsonMatch = trimmed.match(JSON_DATE_REGEX);
    if (jsonMatch) {
      const ts = parseInt(jsonMatch[1], 10);
      const d = new Date(ts);
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(),
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        second: d.getUTCSeconds(),
        millisecond: d.getUTCMilliseconds(),
        offset: 0,
        _unusedTokens: [],
        _unusedInput: [],
        _charsLeftOver: 0,
        _empty: false,
        _invalidMonth: null,
        _parsedDateParts: [],
      } as unknown as ParsedData;
    }
  }

  if (isDigit || isSign) {
    const isoResult = parseISOWithTable(trimmed, locale);
    if (isoResult) {
      if (isoResult._claimed) {
        return { _claimed: true } as unknown as ParsedData;
      }
      return isoResult as unknown as ParsedData;
    }
  }

  // RFC 2822 accepts both alpha-starting (weekday prefix) and
  // digit-starting (bare "15 Jan 2024..." without weekday) strings.
  let rfcStr = stripRFC2822Comments(trimmed);
  let rfcMatch = rfcStr.match(RFC_2822_REGEX);
  if (!rfcMatch && trimmed !== rfcStr) {
    rfcMatch = trimmed.match(RFC_2822_REGEX);
  }
  if (rfcMatch) {
    return parseRFC2822(rfcMatch) as unknown as ParsedData;
  }

  return null;
}

function parseCommonISOExtended(str: string): InternalParsedData | null {
  const len = str.length;
  const ch0 = str.charCodeAt(0);

  // Quick reject for non-digit start (handles sign-prefixed and non-numeric)
  if (ch0 < 48 || ch0 > 57) {
    return null;
  }

  // Check all chars are digits (quick reject for strings with separators)
  let allDigits = true;
  for (let i = 1; i < len && allDigits; i++) {
    const c = str.charCodeAt(i);
    if (c < 48 || c > 57) {
      allDigits = false;
    }
  }

  if (allDigits) {
    // Compact ordinal: YYYYDDD (7 digits)
    if (len === 7) {
      const y0 = str.charCodeAt(0) - 48,
        y1 = str.charCodeAt(1) - 48;
      const y2 = str.charCodeAt(2) - 48,
        y3 = str.charCodeAt(3) - 48;
      if (y0 < 0 || y0 > 9 || y1 < 0 || y1 > 9 || y2 < 0 || y2 > 9 || y3 < 0 || y3 > 9) {
        return null;
      }
      const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
      const doy3 = str.charCodeAt(4) - 48,
        doy2 = str.charCodeAt(5) - 48,
        doy1 = str.charCodeAt(6) - 48;
      if (doy3 >= 0 && doy3 <= 9 && doy2 >= 0 && doy2 <= 9 && doy1 >= 0 && doy1 <= 9) {
        const dayOfYear = doy3 * 100 + doy2 * 10 + doy1;
        if (dayOfYear >= 0 && dayOfYear <= 366) {
          return { year, dayOfYear };
        }
      }
      return null;
    }

    // Compact date: YYYYMMDD (8 digits)
    if (len === 8) {
      const y0 = str.charCodeAt(0) - 48,
        y1 = str.charCodeAt(1) - 48;
      const y2 = str.charCodeAt(2) - 48,
        y3 = str.charCodeAt(3) - 48;
      if (y0 < 0 || y0 > 9 || y1 < 0 || y1 > 9 || y2 < 0 || y2 > 9 || y3 < 0 || y3 > 9) {
        return null;
      }
      const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
      const m0 = str.charCodeAt(4) - 48,
        m1 = str.charCodeAt(5) - 48;
      if (m0 < 0 || m0 > 9 || m1 < 0 || m1 > 9) {
        return null;
      }
      const month1 = m0 * 10 + m1;
      const d0 = str.charCodeAt(6) - 48,
        d1 = str.charCodeAt(7) - 48;
      if (d0 < 0 || d0 > 9 || d1 < 0 || d1 > 9) {
        return null;
      }
      const day = d0 * 10 + d1;
      if (month1 >= 1 && month1 <= 12 && day >= 1 && day <= 31) {
        return { year, month: month1 - 1, day };
      }
      return null;
    }
  }

  // Compact week: GGGG[W]WW (7 chars) / GGGG[W]WWE (8 chars), W at position 4
  if ((len === 7 || len === 8) && str.charCodeAt(4) === 87) {
    const y0 = str.charCodeAt(0) - 48,
      y1 = str.charCodeAt(1) - 48;
    const y2 = str.charCodeAt(2) - 48,
      y3 = str.charCodeAt(3) - 48;
    if (y0 < 0 || y0 > 9 || y1 < 0 || y1 > 9 || y2 < 0 || y2 > 9 || y3 < 0 || y3 > 9) {
      return null;
    }
    const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
    const w0 = str.charCodeAt(5) - 48,
      w1 = str.charCodeAt(6) - 48;
    if (w0 >= 0 && w0 <= 9 && w1 >= 0 && w1 <= 9) {
      const weekNum = w0 * 10 + w1;
      if (weekNum >= 1 && weekNum <= 53) {
        if (len === 7) {
          return { isoWeekYear: year, isoWeek: weekNum, _weekdayNum: 1 };
        }
        const wd = str.charCodeAt(7) - 48;
        if (wd >= 1 && wd <= 7) {
          return { isoWeekYear: year, isoWeek: weekNum, _weekdayNum: wd };
        }
        return null;
      }
    }
    return null;
  }

  // Extended week: GGGG-[W]WW (8 or 10 chars) — check before ordinal (YYYY-DDD)
  // since both have dash at position 4, but week has 'W' at position 5
  if ((len === 8 || len === 10) && str.charCodeAt(4) === 45 && str.charCodeAt(5) === 87) {
    const y0 = str.charCodeAt(0) - 48,
      y1 = str.charCodeAt(1) - 48;
    const y2 = str.charCodeAt(2) - 48,
      y3 = str.charCodeAt(3) - 48;
    if (y0 < 0 || y0 > 9 || y1 < 0 || y1 > 9 || y2 < 0 || y2 > 9 || y3 < 0 || y3 > 9) {
      return null;
    }
    const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
    const w1 = str.charCodeAt(6) - 48,
      w2 = str.charCodeAt(7) - 48;
    if (w1 >= 0 && w1 <= 9 && w2 >= 0 && w2 <= 9) {
      const weekNum = w1 * 10 + w2;
      if (weekNum >= 1 && weekNum <= 53) {
        if (len === 8) {
          return { isoWeekYear: year, isoWeek: weekNum, _weekdayNum: 1 };
        }
        // len === 10: expect dash separator at position 8 before weekday
        if (str.charCodeAt(8) === 45) {
          const wd = str.charCodeAt(9) - 48;
          if (wd >= 1 && wd <= 7) {
            return { isoWeekYear: year, isoWeek: weekNum, _weekdayNum: wd };
          }
        }
      }
    }
    return null;
  }

  // Extended ordinal: YYYY-DDD (8 chars, dash at position 4)
  if (len === 8 && str.charCodeAt(4) === 45) {
    const y0 = str.charCodeAt(0) - 48,
      y1 = str.charCodeAt(1) - 48;
    const y2 = str.charCodeAt(2) - 48,
      y3 = str.charCodeAt(3) - 48;
    if (y0 < 0 || y0 > 9 || y1 < 0 || y1 > 9 || y2 < 0 || y2 > 9 || y3 < 0 || y3 > 9) {
      return null;
    }
    const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
    const d1 = str.charCodeAt(5) - 48,
      d2 = str.charCodeAt(6) - 48,
      d3 = str.charCodeAt(7) - 48;
    if (d1 >= 0 && d1 <= 9 && d2 >= 0 && d2 <= 9 && d3 >= 0 && d3 <= 9) {
      const dayOfYear = d1 * 100 + d2 * 10 + d3;
      if (dayOfYear >= 0 && dayOfYear <= 366) {
        return { year, dayOfYear };
      }
    }
    return null;
  }

  return null;
}

function parseCommonISO(str: string): InternalParsedData | null {
  const len = str.length;
  // Length 10 = date only (YYYY-MM-DD). Lengths 19-29 = date + time + optional
  // fractional seconds + optional timezone. The charCode parsing below validates
  // the actual structure — any length 19-29 follows the same deterministic path.
  if (len !== 10 && (len < 19 || len > 29)) {
    return null;
  }
  if (str.charCodeAt(4) !== 45 || str.charCodeAt(7) !== 45) {
    return null;
  }
  const y0 = str.charCodeAt(0) - 48,
    y1 = str.charCodeAt(1) - 48;
  const y2 = str.charCodeAt(2) - 48,
    y3 = str.charCodeAt(3) - 48;
  if (y0 < 0 || y0 > 9 || y1 < 0 || y1 > 9 || y2 < 0 || y2 > 9 || y3 < 0 || y3 > 9) {
    return null;
  }
  const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
  const m0 = str.charCodeAt(5) - 48,
    m1 = str.charCodeAt(6) - 48;
  if (m0 < 0 || m0 > 9 || m1 < 0 || m1 > 9) {
    return null;
  }
  const month1 = m0 * 10 + m1;
  const d0 = str.charCodeAt(8) - 48,
    d1 = str.charCodeAt(9) - 48;
  if (d0 < 0 || d0 > 9 || d1 < 0 || d1 > 9) {
    return null;
  }
  const day = d0 * 10 + d1;
  if (len === 10) {
    if (month1 < 1 || month1 > 12 || day < 1 || day > 31) {
      return null;
    }
    return { year, month: month1 - 1, day, _hasDate: true, _hasTime: false };
  }
  const sep = str.charCodeAt(10);
  if (sep !== 84 && sep !== 32) {
    return null;
  }
  if (str.charCodeAt(13) !== 58 || str.charCodeAt(16) !== 58) {
    return null;
  }
  const h0 = str.charCodeAt(11) - 48,
    h1 = str.charCodeAt(12) - 48;
  if (h0 < 0 || h0 > 9 || h1 < 0 || h1 > 9) {
    return null;
  }
  const hour = h0 * 10 + h1;
  const min0 = str.charCodeAt(14) - 48,
    min1 = str.charCodeAt(15) - 48;
  if (min0 < 0 || min0 > 9 || min1 < 0 || min1 > 9) {
    return null;
  }
  const minute = min0 * 10 + min1;
  const s0 = str.charCodeAt(17) - 48,
    s1 = str.charCodeAt(18) - 48;
  if (s0 < 0 || s0 > 9 || s1 < 0 || s1 > 9) {
    return null;
  }
  const second = s0 * 10 + s1;

  let millisecond: number | undefined;
  let pos = 19;
  if (pos < len && str.charCodeAt(pos) === 46) {
    millisecond = 0;
    let scale = 100;
    pos++;
    const fracStart = pos;
    while (pos < len) {
      const code = str.charCodeAt(pos);
      if (code < 48 || code > 57) {
        break;
      }
      if (scale > 0) {
        millisecond += (code - 48) * scale;
        scale = Math.floor(scale / 10);
      }
      pos++;
    }
    if (pos === fracStart) {
      return null;
    }
  }

  let offset: number | undefined;
  if (pos < len) {
    const tz = str.charCodeAt(pos);
    if (tz === 90) {
      offset = 0;
      pos++;
    } else if (tz === 43 || tz === 45) {
      const offLen = len - pos;
      if (offLen === 6) {
        if (str.charCodeAt(pos + 3) !== 58) {
          return null;
        }
        const offH0 = str.charCodeAt(pos + 1) - 48,
          offH1 = str.charCodeAt(pos + 2) - 48;
        const offM0 = str.charCodeAt(pos + 4) - 48,
          offM1 = str.charCodeAt(pos + 5) - 48;
        if (
          offH0 < 0 ||
          offH0 > 9 ||
          offH1 < 0 ||
          offH1 > 9 ||
          offM0 < 0 ||
          offM0 > 9 ||
          offM1 < 0 ||
          offM1 > 9
        ) {
          return null;
        }
        offset = (tz === 43 ? 1 : -1) * ((offH0 * 10 + offH1) * 60 + (offM0 * 10 + offM1));
        pos += 6;
      } else if (offLen === 5) {
        const offH0 = str.charCodeAt(pos + 1) - 48,
          offH1 = str.charCodeAt(pos + 2) - 48;
        const offM0 = str.charCodeAt(pos + 3) - 48,
          offM1 = str.charCodeAt(pos + 4) - 48;
        if (
          offH0 < 0 ||
          offH0 > 9 ||
          offH1 < 0 ||
          offH1 > 9 ||
          offM0 < 0 ||
          offM0 > 9 ||
          offM1 < 0 ||
          offM1 > 9
        ) {
          return null;
        }
        offset = (tz === 43 ? 1 : -1) * ((offH0 * 10 + offH1) * 60 + (offM0 * 10 + offM1));
        pos += 5;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  if (pos !== len) {
    return null;
  }

  return {
    year,
    month: month1 - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
    offset,
    _hasDate: true,
    _hasTime: true,
  };
}

function parseTwo(str: string, idx: number): { v: number; len: number } | null {
  if (idx >= str.length) {
    return null;
  }
  const c1 = str.charCodeAt(idx);
  if (c1 < 48 || c1 > 57) {
    return null;
  }
  const c2 = str.charCodeAt(idx + 1);
  if (c2 >= 48 && c2 <= 57) {
    return { v: (c1 - 48) * 10 + (c2 - 48), len: 2 };
  }
  return { v: c1 - 48, len: 1 };
}

function p1(str: string, idx: number): number | null {
  if (idx >= str.length) {
    return null;
  }
  const c = str.charCodeAt(idx);
  return c >= 48 && c <= 57 ? c - 48 : null;
}
function p2(str: string, idx: number): number | null {
  if (idx + 1 >= str.length) {
    return null;
  }
  const a = str.charCodeAt(idx),
    b = str.charCodeAt(idx + 1);
  if (a < 48 || a > 57 || b < 48 || b > 57) {
    return null;
  }
  return (a - 48) * 10 + (b - 48);
}
function p3(str: string, idx: number): number | null {
  if (idx + 2 >= str.length) {
    return null;
  }
  const a = str.charCodeAt(idx),
    b = str.charCodeAt(idx + 1),
    c = str.charCodeAt(idx + 2);
  if (a < 48 || a > 57 || b < 48 || b > 57 || c < 48 || c > 57) {
    return null;
  }
  return (a - 48) * 100 + (b - 48) * 10 + (c - 48);
}
function p4(str: string, idx: number): number | null {
  if (idx + 3 >= str.length) {
    return null;
  }
  const a = str.charCodeAt(idx),
    b = str.charCodeAt(idx + 1),
    c = str.charCodeAt(idx + 2),
    d = str.charCodeAt(idx + 3);
  if (a < 48 || a > 57 || b < 48 || b > 57 || c < 48 || c > 57 || d < 48 || d > 57) {
    return null;
  }
  return (a - 48) * 1000 + (b - 48) * 100 + (c - 48) * 10 + (d - 48);
}

export interface ParsedData {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  offset?: number;
  amp?: string;
  _weekdayName?: string;
  _weekdayNum?: number;
  _unusedTokens: string[];
  _unusedInput: string[];
  _charsLeftOver: number;
  _empty: boolean;
  _invalidMonth: string | null;
  _parsedDateParts: number[];
  _meridiem?: string | undefined;
  _eraYear?: number;
  _iso?: boolean;
  _nullInput?: boolean;
  _invalidFormat?: boolean;
  _userInvalidated?: boolean;
  _rfc2822?: boolean;
  _weekdayMismatch?: boolean;
  _isParseZone?: boolean;
  _bigHour?: boolean;
  _week?: number;
  _weekYear?: number;
  _weekday?: number;
  dayOfYear?: number;
  isoWeek?: number;
  isoWeekYear?: number;
  _localeWeekday?: number;
  overflow?: number;
  quarter?: number;
  _era?: unknown;
  _hasDate?: boolean;
  _hasTime?: boolean;
  _f?: string;
  _useConstructor?: boolean;
  _claimed?: boolean;
}

interface ParseCtx {
  str: string;
  strIdx: number;
  strict: boolean;
  loc: ParseLocale;
  result: ParsedData;
  _seenUnusedTokens?: Set<string>;
  failed: boolean;
  tokenIndex: number;
  tokens: FormatToken[];
}

function getSeenUnusedTokens(ctx: ParseCtx): Set<string> {
  let seen = ctx._seenUnusedTokens;
  if (!seen) {
    seen = new Set<string>();
    ctx._seenUnusedTokens = seen;
  }
  return seen;
}

type TokenHandler = (ctx: ParseCtx) => void;

// -- Year tokens --

function hYYYYYY(ctx: ParseCtx): void {
  const s = ctx.str,
    i = ctx.strIdx,
    len = s.length;
  let pos = i;
  let sign = 1;
  if (pos < len && (s.charCodeAt(pos) === 43 || s.charCodeAt(pos) === 45)) {
    sign = s.charCodeAt(pos) === 43 ? 1 : -1;
    pos++;
  }
  const start = pos;
  while (pos < len && pos - start < 6) {
    const c = s.charCodeAt(pos);
    if (c < 48 || c > 57) {
      break;
    }
    pos++;
  }
  if (pos === start || (ctx.strict && pos - start !== 6)) {
    ctx.failed = true;
    return;
  }
  if (pos - start > 6) {
    pos = start + 6;
  }
  let y: number;
  if (pos - start === 6) {
    y = p6(s, start);
  } else if (pos - start === 5) {
    y = p5(s, start);
  } else if (pos - start === 4) {
    y = p4(s, start)!;
  } else if (pos - start === 3) {
    y = p3(s, start)!;
  } else if (pos - start === 2) {
    y = p2(s, start)!;
  } else {
    y = p1(s, start)!;
  }
  ctx.result.year = sign === -1 ? -y : y;
  ctx.result._parsedDateParts[0] = ctx.result.year;
  ctx.strIdx = pos;
}

function hYYYYY(ctx: ParseCtx): void {
  const s = ctx.str,
    i = ctx.strIdx,
    len = s.length;
  let pos = i;
  let sign = 1;
  if (pos < len && (s.charCodeAt(pos) === 43 || s.charCodeAt(pos) === 45)) {
    sign = s.charCodeAt(pos) === 43 ? 1 : -1;
    pos++;
  }
  const start = pos;
  while (pos < len && pos - start < 6) {
    const c = s.charCodeAt(pos);
    if (c < 48 || c > 57) {
      break;
    }
    pos++;
  }
  if (pos === start || (ctx.strict && (pos - start < 5 || pos - start > 6))) {
    ctx.failed = true;
    return;
  }
  if (pos - start > 6) {
    pos = start + 6;
  }
  let y: number;
  if (pos - start === 6) {
    y = p6(s, start);
  } else if (pos - start === 5) {
    y = p5(s, start);
  } else {
    y = p4(s, start)!;
  }
  ctx.result.year = sign === -1 ? -y : y;
  ctx.result._parsedDateParts[0] = ctx.result.year;
  ctx.strIdx = pos;
}

function hYYYY(ctx: ParseCtx): void {
  const s = ctx.str,
    i = ctx.strIdx,
    len = s.length;
  if (i >= len) {
    ctx.failed = true;
    return;
  }
  let sign = "";
  let pos = i;
  const c0 = s.charCodeAt(pos);
  if ((c0 === 43 || c0 === 45) && !ctx.strict) {
    sign = s[pos];
    pos++;
  }
  const start = pos;
  const maxEnd = Math.min(pos + 4, len);
  while (pos < maxEnd) {
    const c = s.charCodeAt(pos);
    if (c < 48 || c > 57) {
      break;
    }
    pos++;
  }
  if (pos === start || (ctx.strict && pos - start !== 4)) {
    ctx.failed = true;
    return;
  }
  let y: number;
  if (pos - start === 4) {
    y = p4(s, start)!;
  } else if (pos - start === 3) {
    y = p3(s, start)!;
  } else if (pos - start === 2 && !sign) {
    y = (s.charCodeAt(start) - 48) * 10 + (s.charCodeAt(start + 1) - 48);
    y = y > 68 ? 1900 + y : 2000 + y;
  } else if (pos - start === 1 && !sign) {
    y = s.charCodeAt(start) - 48;
  } else {
    y = pos - start === 2 ? p2(s, start)! : p1(s, start)!;
  }
  ctx.result.year = sign ? parseInt(sign + s.slice(start, pos), 10) : y;
  ctx.result._parsedDateParts[0] = ctx.result.year;
  ctx.strIdx = pos;
}

function hYY(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p || (ctx.strict && p.len !== 2)) {
    ctx.failed = true;
    return;
  }
  if (parseTwoDigitYearFn) {
    ctx.result.year = parseTwoDigitYearFn(ctx.str.slice(ctx.strIdx, ctx.strIdx + p.len));
  } else {
    const y = p.v;
    ctx.result.year = y > 68 ? 1900 + y : 2000 + y;
  }
  ctx.result._parsedDateParts[0] = ctx.result.year;
  ctx.strIdx += p.len;
}

function hY(ctx: ParseCtx): void {
  const s = ctx.str,
    i = ctx.strIdx,
    len = s.length;
  if (i >= len) {
    ctx.failed = true;
    return;
  }
  let pos = i;
  let sign = 1;
  if (s.charCodeAt(pos) === 43 || s.charCodeAt(pos) === 45) {
    sign = s.charCodeAt(pos) === 43 ? 1 : -1;
    pos++;
  }
  const start = pos;
  while (pos < len) {
    const c = s.charCodeAt(pos);
    if (c < 48 || c > 57) {
      break;
    }
    pos++;
  }
  if (pos === start) {
    ctx.failed = true;
    return;
  }
  const digits = pos - start;
  let y: number;
  if (digits === 6) {
    y = p6(s, start);
  } else if (digits === 5) {
    y = p5(s, start);
  } else if (digits === 4) {
    y = p4(s, start)!;
  } else if (digits === 3) {
    y = p3(s, start)!;
  } else if (digits === 2) {
    y = p2(s, start)!;
  } else {
    y = p1(s, start)!;
  }
  ctx.result.year = sign === -1 ? -y : y;
  ctx.result._parsedDateParts[0] = ctx.result.year;
  ctx.strIdx = pos;
}

function p5(str: string, idx: number): number {
  return (
    (str.charCodeAt(idx) - 48) * 10000 +
    (str.charCodeAt(idx + 1) - 48) * 1000 +
    (str.charCodeAt(idx + 2) - 48) * 100 +
    (str.charCodeAt(idx + 3) - 48) * 10 +
    (str.charCodeAt(idx + 4) - 48)
  );
}

function p6(str: string, idx: number): number {
  return (
    (str.charCodeAt(idx) - 48) * 100000 +
    (str.charCodeAt(idx + 1) - 48) * 10000 +
    (str.charCodeAt(idx + 2) - 48) * 1000 +
    (str.charCodeAt(idx + 3) - 48) * 100 +
    (str.charCodeAt(idx + 4) - 48) * 10 +
    (str.charCodeAt(idx + 5) - 48)
  );
}

// -- Month tokens --

function hMM(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p || (ctx.strict && p.len !== 2)) {
    ctx.failed = true;
    return;
  }
  ctx.result.month = p.v - 1;
  ctx.result._parsedDateParts[1] = ctx.result.month;
  ctx.strIdx += p.len;
}

function hM(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && p.len === 2 && ctx.str.charCodeAt(ctx.strIdx) === 48) {
    ctx.failed = true;
    return;
  }
  ctx.result.month = p.v - 1;
  ctx.result._parsedDateParts[1] = ctx.result.month;
  ctx.strIdx += p.len;
}

// -- Day tokens --

function hDD(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p || (ctx.strict && p.len !== 2)) {
    ctx.failed = true;
    return;
  }
  ctx.result.day = p.v;
  ctx.result._parsedDateParts[2] = ctx.result.day;
  ctx.strIdx += p.len;
}

function hD(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && p.len === 2 && ctx.str.charCodeAt(ctx.strIdx) === 48) {
    ctx.failed = true;
    return;
  }
  ctx.result.day = p.v;
  ctx.result._parsedDateParts[2] = ctx.result.day;
  ctx.strIdx += p.len;
}

function hDo(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const ordinalRe = getOrdinalRegex(ctx.loc);
  let match = remaining.match(ordinalRe);
  if (!match) {
    ctx.failed = true;
    return;
  }
  const digitStr = (match[0].match(/\d{1,2}/) ?? [])[0];
  if (!digitStr) {
    ctx.failed = true;
    return;
  }
  ctx.result.day = parseInt(digitStr, 10);
  ctx.result._parsedDateParts[2] = ctx.result.day;
  ctx.strIdx += match[0].length;
}

// -- Hour tokens --

function hHH(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p || (ctx.strict && p.len !== 2)) {
    ctx.failed = true;
    return;
  }
  ctx.result.hour = p.v;
  ctx.result._parsedDateParts[3] = ctx.result.hour;
  ctx.strIdx += p.len;
}

function hH(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && p.len === 2 && ctx.str.charCodeAt(ctx.strIdx) === 48) {
    ctx.failed = true;
    return;
  }
  ctx.result.hour = p.v;
  ctx.result._parsedDateParts[3] = ctx.result.hour;
  ctx.strIdx += p.len;
}

function hkk(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p || (ctx.strict && p.len !== 2)) {
    ctx.failed = true;
    return;
  }
  if (p.v === 24) {
    ctx.result.hour = 0;
    ctx.result._parsedDateParts[3] = 24;
  } else {
    ctx.result.hour = p.v;
    ctx.result._parsedDateParts[3] = p.v;
  }
  ctx.strIdx += p.len;
}

function hk(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && p.len === 2 && ctx.str.charCodeAt(ctx.strIdx) === 48) {
    ctx.failed = true;
    return;
  }
  if (p.v === 24) {
    ctx.result.hour = 0;
    ctx.result._parsedDateParts[3] = 24;
  } else {
    ctx.result.hour = p.v;
    ctx.result._parsedDateParts[3] = p.v;
  }
  ctx.strIdx += p.len;
}

function hhh(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p || (ctx.strict && p.len !== 2)) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && p.v === 0) {
    ctx.failed = true;
    return;
  }
  ctx.result.hour = p.v;
  ctx.result._parsedDateParts[3] = p.v;
  if (p.v > 12) {
    ctx.result._bigHour = true;
    if (ctx.strict) {
      ctx.failed = true;
      return;
    }
  }
  ctx.strIdx += p.len;
}

function hh(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict) {
    if (p.len === 2 && ctx.str.charCodeAt(ctx.strIdx) === 48) {
      ctx.failed = true;
      return;
    }
    if (p.v === 0) {
      ctx.failed = true;
      return;
    }
  }
  ctx.result.hour = p.v;
  ctx.result._parsedDateParts[3] = p.v;
  if (p.v > 12) {
    ctx.result._bigHour = true;
    if (ctx.strict) {
      ctx.failed = true;
      return;
    }
  }
  ctx.strIdx += p.len;
}

// -- Minute tokens --

function hmm(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p || (ctx.strict && p.len !== 2)) {
    ctx.failed = true;
    return;
  }
  ctx.result.minute = p.v;
  ctx.result._parsedDateParts[4] = ctx.result.minute;
  ctx.strIdx += p.len;
}

function hm(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && p.len === 2 && ctx.str.charCodeAt(ctx.strIdx) === 48) {
    ctx.failed = true;
    return;
  }
  ctx.result.minute = p.v;
  ctx.result._parsedDateParts[4] = ctx.result.minute;
  ctx.strIdx += p.len;
}

// -- Second tokens --

function hss(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p || (ctx.strict && p.len !== 2)) {
    ctx.failed = true;
    return;
  }
  ctx.result.second = p.v;
  ctx.result._parsedDateParts[5] = ctx.result.second;
  ctx.strIdx += p.len;
}

function hs(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && p.len === 2 && ctx.str.charCodeAt(ctx.strIdx) === 48) {
    ctx.failed = true;
    return;
  }
  ctx.result.second = p.v;
  ctx.result._parsedDateParts[5] = ctx.result.second;
  ctx.strIdx += p.len;
}

// -- Millisecond tokens --

function hS(ctx: ParseCtx): void {
  const t = ctx.tokens[ctx.tokenIndex];
  const maxDigits = t.name!.length;
  const remaining = ctx.str.slice(ctx.strIdx);
  const match = timedMatch(
    remaining,
    S_DIGIT_RE[maxDigits - 1] ?? /^(\d{1,9})/,
    ctx.strict ? maxDigits : undefined,
    ctx.strict,
  );
  if (!match) {
    ctx.failed = true;
    return;
  }
  ctx.result.millisecond = parseInt(match[1].slice(0, 3).padEnd(3, "0"), 10);
  ctx.result._parsedDateParts[6] = ctx.result.millisecond;
  ctx.strIdx += match[1].length;
}

// -- AM/PM tokens --

function hA(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const ampmReg = ctx.loc.meridiemParse() ?? /[ap]\.?m?\.?/i;
  const match = remaining.match(ampmReg);
  if (!match) {
    ctx.failed = true;
    return;
  }
  ctx.result.amp = match[0].toLowerCase();
  ctx.result._meridiem = match[0];
  ctx.strIdx += match[0].length;
}

// -- Timezone tokens --

function hZ(ctx: ParseCtx): void {
  let remaining = ctx.str.slice(ctx.strIdx);
  if (!ctx.strict) {
    const zTrimMatch = remaining.match(/^\s+/);
    if (zTrimMatch) {
      ctx.result._unusedInput.push(zTrimMatch[0]);
      ctx.strIdx += zTrimMatch[0].length;
      remaining = ctx.str.slice(ctx.strIdx);
    }
  }
  const match = remaining.match(/^([+-]\d{2}:?\d{2}|Z)/);
  if (!match) {
    ctx.failed = true;
    return;
  }
  if (match[1] === "Z") {
    ctx.result.offset = 0;
  } else {
    const cleaned = match[1].replace(":", "");
    const sign = cleaned[0] === "+" ? 1 : -1;
    const tzHour = parseInt(cleaned.substring(1, 3), 10);
    const tzMin = parseInt(cleaned.substring(3, 5), 10);
    ctx.result.offset = sign * (tzHour * 60 + tzMin);
  }
  ctx.strIdx += match[1].length;
}

// -- Unix timestamp tokens --

function hX(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const match = remaining.match(/^(-?\d+(?:\.\d+)?)/);
  if (!match) {
    ctx.failed = true;
    return;
  }
  const ts = parseFloat(match[1]) * 1000;
  const d = new Date(ts);
  ctx.result.year = d.getUTCFullYear();
  ctx.result.month = d.getUTCMonth();
  ctx.result.day = d.getUTCDate();
  ctx.result.hour = d.getUTCHours();
  ctx.result.minute = d.getUTCMinutes();
  ctx.result.second = d.getUTCSeconds();
  ctx.result.millisecond = d.getUTCMilliseconds();
  ctx.strIdx += match[1].length;
}

function hx(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const match = remaining.match(/^(-?\d+)/);
  if (!match) {
    ctx.failed = true;
    return;
  }
  const ts = parseInt(match[1], 10);
  const d = new Date(ts);
  ctx.result.year = d.getUTCFullYear();
  ctx.result.month = d.getUTCMonth();
  ctx.result.day = d.getUTCDate();
  ctx.result.hour = d.getUTCHours();
  ctx.result.minute = d.getUTCMinutes();
  ctx.result.second = d.getUTCSeconds();
  ctx.result.millisecond = d.getUTCMilliseconds();
  ctx.strIdx += match[1].length;
}

// -- Week tokens --

function hWW(ctx: ParseCtx): void {
  const p = p2(ctx.str, ctx.strIdx);
  if (p === null) {
    ctx.failed = true;
    return;
  }
  ctx.result.isoWeek = p;
  ctx.strIdx += 2;
}

function hW(ctx: ParseCtx): void {
  const s = ctx.str;
  const i = ctx.strIdx;
  if (i >= s.length) {
    ctx.failed = true;
    return;
  }
  const c0 = s.charCodeAt(i);
  if (c0 < 48 || c0 > 57) {
    ctx.failed = true;
    return;
  }
  const c1 = s.charCodeAt(i + 1);
  if (c1 >= 48 && c1 <= 57) {
    if (ctx.strict && c0 === 48) {
      ctx.failed = true;
      return;
    }
    ctx.result.isoWeek = (c0 - 48) * 10 + (c1 - 48);
    ctx.strIdx += 2;
  } else {
    ctx.result.isoWeek = c0 - 48;
    ctx.strIdx += 1;
  }
}

function hww(ctx: ParseCtx): void {
  const p = p2(ctx.str, ctx.strIdx);
  if (p === null) {
    ctx.failed = true;
    return;
  }
  ctx.result._week = p;
  ctx.strIdx += 2;
}

function hw(ctx: ParseCtx): void {
  const s = ctx.str;
  const i = ctx.strIdx;
  if (i >= s.length) {
    ctx.failed = true;
    return;
  }
  const c0 = s.charCodeAt(i);
  if (c0 < 48 || c0 > 57) {
    ctx.failed = true;
    return;
  }
  const c1 = s.charCodeAt(i + 1);
  if (c1 >= 48 && c1 <= 57) {
    if (ctx.strict && c0 === 48) {
      ctx.failed = true;
      return;
    }
    ctx.result._week = (c0 - 48) * 10 + (c1 - 48);
    ctx.strIdx += 2;
  } else {
    ctx.result._week = c0 - 48;
    ctx.strIdx += 1;
  }
}

// -- Week year tokens --

function hGGGG(ctx: ParseCtx): void {
  const p = p4(ctx.str, ctx.strIdx);
  if (p === null) {
    ctx.failed = true;
    return;
  }
  ctx.result._weekYear = p;
  ctx.strIdx += 4;
}

function hgggg(ctx: ParseCtx): void {
  const p = p4(ctx.str, ctx.strIdx);
  if (p === null) {
    ctx.failed = true;
    return;
  }
  ctx.result._weekYear = p;
  ctx.strIdx += 4;
}

function hGG(ctx: ParseCtx): void {
  const p = p2(ctx.str, ctx.strIdx);
  if (p === null) {
    ctx.failed = true;
    return;
  }
  ctx.result._weekYear = p > 68 ? 1900 + p : 2000 + p;
  ctx.strIdx += 2;
}

function hgg(ctx: ParseCtx): void {
  const p = p2(ctx.str, ctx.strIdx);
  if (p === null) {
    ctx.failed = true;
    return;
  }
  ctx.result._weekYear = p > 68 ? 1900 + p : 2000 + p;
  ctx.strIdx += 2;
}

// -- Day of year tokens --

function hDDD(ctx: ParseCtx): void {
  const p = p3(ctx.str, ctx.strIdx);
  if (p === null) {
    ctx.failed = true;
    return;
  }
  ctx.result.dayOfYear = p;
  ctx.strIdx += 3;
}

// -- Weekday tokens --

function hE(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && p.v === 0) {
    ctx.failed = true;
    return;
  }
  ctx.result._weekdayNum = p.v;
  ctx.result._parsedDateParts[7] = p.v;
  ctx.strIdx += p.len;
}

function he(ctx: ParseCtx): void {
  const p = parseTwo(ctx.str, ctx.strIdx);
  if (!p) {
    ctx.failed = true;
    return;
  }
  ctx.result._parsedDateParts[7] = p.v;
  ctx.result._localeWeekday = p.v;
  ctx.result._weekdayNum = p.v;
  ctx.strIdx += p.len;
  if (ctx.strict && p.len === 2 && ctx.str.charCodeAt(ctx.strIdx - p.len) === 48) {
    ctx.failed = true;
    return;
  }
  if (ctx.strict && (p.v < 0 || p.v > 6)) {
    ctx.result.overflow = 8;
    ctx.failed = true;
    return;
  }
}

// -- Quarter token --

function hQ(ctx: ParseCtx): void {
  const p = p1(ctx.str, ctx.strIdx);
  if (p === null) {
    ctx.failed = true;
    return;
  }
  ctx.result.quarter = p;
  ctx.strIdx += 1;
}

// -- Compact time tokens --

function hhmm(ctx: ParseCtx): void {
  const s = ctx.str;
  const i = ctx.strIdx;
  if (i + 2 >= s.length) {
    ctx.failed = true;
    return;
  }
  const c0 = s.charCodeAt(i),
    c1 = s.charCodeAt(i + 1);
  const c2 = s.charCodeAt(i + 2),
    c3 = s.charCodeAt(i + 3);
  if (c0 < 48 || c0 > 57 || c1 < 48 || c1 > 57 || c2 < 48 || c2 > 57 || c3 < 48 || c3 > 57) {
    ctx.failed = true;
    return;
  }
  const hVal = (c0 - 48) * 10 + (c1 - 48);
  if (hVal > 12) {
    ctx.result._bigHour = true;
  }
  ctx.result.hour = hVal;
  ctx.result._parsedDateParts[3] = hVal;
  ctx.result.minute = (c2 - 48) * 10 + (c3 - 48);
  ctx.result._parsedDateParts[4] = ctx.result.minute;
  ctx.strIdx += 4;
}

function hhmmss(ctx: ParseCtx): void {
  const s = ctx.str;
  const i = ctx.strIdx;
  if (i + 5 >= s.length) {
    ctx.failed = true;
    return;
  }
  for (let k = 0; k < 6; k++) {
    const c = s.charCodeAt(i + k);
    if (c < 48 || c > 57) {
      ctx.failed = true;
      return;
    }
  }
  const hVal = (s.charCodeAt(i) - 48) * 10 + (s.charCodeAt(i + 1) - 48);
  if (hVal > 12) {
    ctx.result._bigHour = true;
  }
  ctx.result.hour = hVal;
  ctx.result._parsedDateParts[3] = hVal;
  ctx.result.minute = (s.charCodeAt(i + 2) - 48) * 10 + (s.charCodeAt(i + 3) - 48);
  ctx.result._parsedDateParts[4] = ctx.result.minute;
  ctx.result.second = (s.charCodeAt(i + 4) - 48) * 10 + (s.charCodeAt(i + 5) - 48);
  ctx.result._parsedDateParts[5] = ctx.result.second;
  ctx.strIdx += 6;
}

function hHmm(ctx: ParseCtx): void {
  const s = ctx.str;
  const i = ctx.strIdx;
  if (i + 2 >= s.length) {
    ctx.failed = true;
    return;
  }
  let pos = i,
    end = Math.min(i + 4, s.length);
  while (pos < end) {
    const c = s.charCodeAt(pos);
    if (c < 48 || c > 57) {
      break;
    }
    pos++;
  }
  const digits = pos - i;
  if (digits < 3) {
    ctx.failed = true;
    return;
  }
  ctx.result.hour =
    digits === 3
      ? (s.charCodeAt(i) - 48) * 100 + (s.charCodeAt(i + 1) - 48) * 10 + (s.charCodeAt(i + 2) - 48)
      : (s.charCodeAt(i) - 48) * 1000 +
        (s.charCodeAt(i + 1) - 48) * 100 +
        (s.charCodeAt(i + 2) - 48) * 10 +
        (s.charCodeAt(i + 3) - 48);
  ctx.result._parsedDateParts[3] = ctx.result.hour;
  ctx.result.minute = (s.charCodeAt(digits - 2) - 48) * 10 + (s.charCodeAt(digits - 1) - 48);
  ctx.result._parsedDateParts[4] = ctx.result.minute;
  ctx.strIdx = pos;
}

function hHmmss(ctx: ParseCtx): void {
  const s = ctx.str;
  const i = ctx.strIdx;
  if (i + 5 >= s.length) {
    ctx.failed = true;
    return;
  }
  for (let k = 0; k < 6; k++) {
    const c = s.charCodeAt(i + k);
    if (c < 48 || c > 57) {
      ctx.failed = true;
      return;
    }
  }
  ctx.result.hour = (s.charCodeAt(i) - 48) * 10 + (s.charCodeAt(i + 1) - 48);
  ctx.result._parsedDateParts[3] = ctx.result.hour;
  ctx.result.minute = (s.charCodeAt(i + 2) - 48) * 10 + (s.charCodeAt(i + 3) - 48);
  ctx.result._parsedDateParts[4] = ctx.result.minute;
  ctx.result.second = (s.charCodeAt(i + 4) - 48) * 10 + (s.charCodeAt(i + 5) - 48);
  ctx.result._parsedDateParts[5] = ctx.result.second;
  ctx.strIdx += 6;
}

// -- Era year tokens --

function hEraYear(ctx: ParseCtx): void {
  const s = ctx.str;
  const i = ctx.strIdx;
  let pos = i;
  while (pos < s.length) {
    const c = s.charCodeAt(pos);
    if (c < 48 || c > 57) {
      break;
    }
    pos++;
  }
  if (pos === i) {
    ctx.failed = true;
    return;
  }
  const digits = pos - i;
  let y: number;
  if (digits === 4) {
    y = p4(s, i)!;
  } else if (digits === 3) {
    y = p3(s, i)!;
  } else {
    y = digits === 2 ? p2(s, i)! : p1(s, i)!;
  }
  ctx.result._eraYear = y;
  ctx.result._parsedDateParts[0] = y;
  ctx.strIdx = pos;
}

function hYo(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const eras = ctx.loc._config.eras;
  const eraOrdinalRegex =
    eras && ctx.loc._config.eraYearOrdinalParse
      ? (ctx.loc._config.eraYearOrdinalRegex ?? /(\d+)/)
      : /(\d+)/;
  const yoMatch = remaining.match(eraOrdinalRegex);
  if (!yoMatch) {
    ctx.failed = true;
    return;
  }
  const eraParseFn = ctx.loc._config.eraYearOrdinalParse;
  if (eraParseFn) {
    ctx.result._eraYear = (eraParseFn as (input: string, match: RegExpExecArray) => number)(
      remaining,
      yoMatch as unknown as RegExpExecArray,
    );
  } else {
    ctx.result._eraYear = parseInt(yoMatch[1] || yoMatch[0], 10);
  }
  ctx.result._parsedDateParts[0] = ctx.result._eraYear;
  ctx.strIdx += yoMatch[0].length;
}

// -- Era name tokens --

function hN(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const erasList = ctx.loc._config.eras;
  if (erasList && Array.isArray(erasList)) {
    const eras = erasList as Record<string, unknown>[];
    const names = (
      ctx.strict
        ? eras.map((e) => e.abbr).filter(Boolean)
        : [...new Set(eras.flatMap((e) => [e.abbr, e.name, e.narrow].filter(Boolean)))]
    ) as string[];
    const regex = new RegExp(`^(${names.map(escapeRegex).join("|")})`);
    const nMatch = remaining.match(regex);
    if (nMatch) {
      const matchedName = nMatch[1];
      const era = eras.find(
        (e) => e.abbr === matchedName || e.name === matchedName || e.narrow === matchedName,
      );
      if (era) {
        ctx.result._era = era;
      }
      ctx.strIdx += nMatch[1].length;
      return;
    }
  }
  ctx.failed = true;
}

function hNNNN(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const erasWide = ctx.loc._config.eras;
  if (erasWide && Array.isArray(erasWide)) {
    const eras = erasWide as Record<string, unknown>[];
    const names = eras.map((e) => e.name).filter(Boolean) as string[];
    const regex = new RegExp(`^(${names.map(escapeRegex).join("|")})`);
    const nMatch = remaining.match(regex);
    if (nMatch) {
      const matched = nMatch[1];
      const era = eras.find((e) => e.name === matched);
      if (era) {
        ctx.result._era = era;
      }
      ctx.strIdx += nMatch[1].length;
      return;
    }
  }
  ctx.failed = true;
}

function hNNNNN(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const erasNarrow = ctx.loc._config.eras;
  if (erasNarrow && Array.isArray(erasNarrow)) {
    const eras = erasNarrow as Record<string, unknown>[];
    const names = eras.map((e) => e.narrow).filter(Boolean) as string[];
    const regex = new RegExp(`^(${names.map(escapeRegex).join("|")})`);
    const nMatch = remaining.match(regex);
    if (nMatch) {
      const matched = nMatch[1];
      const era = eras.find((e) => e.narrow === matched);
      if (era) {
        ctx.result._era = era;
      }
      ctx.strIdx += nMatch[1].length;
      return;
    }
  }
  ctx.failed = true;
}

function hdddd(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const wdList = getLocaleWeekdaysFull(ctx.loc);
  let _matched = false;
  if (wdList.length > 0) {
    const match = remaining.match(getLocaleWeekdaysFullRegex(ctx.loc));
    if (match) {
      if (ctx.strict && hasWordContinuation(remaining, match[0].length)) {
        ctx.failed = true;
        return;
      }
      const matchedName = match[1].toLowerCase();
      const idx = wdList.indexOf(matchedName);
      if (idx >= 0) {
        _matched = true;
        ctx.result._weekdayName = match[1];
        ctx.result._weekdayNum = idx;
      }
      ctx.strIdx += match[0].length;
      return;
    }
  }
  const enMatch = allowsEnglishNameFallback(ctx.loc)
    ? remaining.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i)
    : null;
  if (enMatch) {
    _matched = true;
    ctx.result._weekdayName = enMatch[1];
    const num = WEEKDAY_NAMES_MAP[enMatch[1].toLowerCase().substring(0, 3)];
    ctx.result._weekdayNum = num;
    ctx.strIdx += enMatch[0].length;
    return;
  }
  if (!ctx.strict) {
    const looseMatch = remaining.match(/^\w+/);
    if (looseMatch) {
      ctx.strIdx += looseMatch[0].length;
      return;
    }
  }
  ctx.failed = true;
}

function hddd(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const wdList = getLocaleWeekdaysShort(ctx.loc);
  let _matched = false;
  if (wdList.length > 0) {
    const regex = getLocaleWeekdaysShortRegex(ctx.loc);
    const match = remaining.match(regex);
    if (match) {
      if (ctx.strict && hasWordContinuation(remaining, match[0].length)) {
        ctx.failed = true;
        return;
      }
      const matchedName = match[1].toLowerCase();
      const idx = wdList.indexOf(matchedName);
      if (idx >= 0) {
        _matched = true;
        ctx.result._weekdayName = match[1];
        ctx.result._weekdayNum = idx;
      }
      ctx.strIdx += match[0].length;
      return;
    }
  }
  const enMatch = allowsEnglishNameFallback(ctx.loc)
    ? remaining.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i)
    : null;
  if (enMatch) {
    _matched = true;
    ctx.result._weekdayName = enMatch[1];
    const num = WEEKDAY_NAMES_MAP[enMatch[1].toLowerCase().substring(0, 3)];
    ctx.result._weekdayNum = num;
    ctx.strIdx += enMatch[0].length;
    return;
  }
  if (!ctx.strict) {
    const looseMatch = remaining.match(/^\w+/);
    if (looseMatch) {
      ctx.strIdx += looseMatch[0].length;
      return;
    }
  }
  ctx.failed = true;
}

function hdd(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const wdList = getLocaleWeekdaysMin(ctx.loc);
  let _matched = false;
  if (wdList.length > 0) {
    const match = remaining.match(getLocaleWeekdaysMinRegex(ctx.loc));
    if (match) {
      if (ctx.strict && hasWordContinuation(remaining, match[0].length)) {
        ctx.failed = true;
        return;
      }
      const matchedName = match[1].toLowerCase();
      const idx = wdList.indexOf(matchedName);
      if (idx >= 0) {
        _matched = true;
        ctx.result._weekdayName = match[1];
        ctx.result._weekdayNum = idx;
      }
      ctx.strIdx += match[0].length;
      return;
    }
  }
  if (!ctx.strict) {
    const looseMatch = remaining.match(/^\w+/);
    if (looseMatch) {
      ctx.strIdx += looseMatch[0].length;
      return;
    }
  }
  ctx.failed = true;
}

function hMMMM(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const monthList = getLocaleMonthsFull(ctx.loc);
  const monthListShort = getLocaleMonthsShort(ctx.loc);
  if (monthList.length > 0) {
    const match = remaining.match(getLocaleMonthsFullRegex(ctx.loc, ctx.strict));
    if (match) {
      if (ctx.strict && hasWordContinuation(remaining, match[0].length)) {
        ctx.failed = true;
        return;
      }
      const matched = match[1].toLowerCase();
      let idx = monthList.indexOf(matched);
      if (!ctx.strict && idx < 0) {
        idx = monthListShort.indexOf(matched);
      }
      if (idx < 0) {
        const noPeriod = matched.replace(/\.$/, "");
        for (let vi = 0; vi < monthList.length; vi++) {
          const base = monthList[vi];
          if (base === matched || base.replace(/\.$/, "") === noPeriod) {
            idx = vi;
            break;
          }
        }
      }
      if (idx < 0 && !ctx.strict) {
        const noPeriod = matched.replace(/\.$/, "");
        for (let vi = 0; vi < monthListShort.length; vi++) {
          const base = monthListShort[vi];
          if (base === matched || base.replace(/\.$/, "") === noPeriod) {
            idx = vi;
            break;
          }
        }
      }
      if (idx >= 0) {
        ctx.result.month = idx;
        ctx.result._parsedDateParts[1] = idx;
        ctx.strIdx += match[1].length;
        return;
      }
    }
  }
  const enMatch = allowsEnglishNameFallback(ctx.loc)
    ? remaining.match(
        /^(January|February|March|April|May|June|July|August|September|October|November|December)/i,
      )
    : null;
  if (enMatch) {
    const monthVal = monthNames[enMatch[1].toLowerCase()];
    {
      ctx.result.month = monthVal;
      ctx.result._parsedDateParts[1] = monthVal;
      ctx.strIdx += enMatch[1].length;
      return;
    }
  }
  if (!ctx.strict) {
    const wordMatch = remaining.match(/^\w+/);
    if (wordMatch) {
      const monthVal = monthNames[wordMatch[0].toLowerCase()];
      ctx.result.month = monthVal;
      ctx.result._parsedDateParts[1] = monthVal;
      ctx.strIdx += wordMatch[0].length;
      return;
    }
  }
  ctx.failed = true;
}

function hMMM(ctx: ParseCtx): void {
  const remaining = ctx.str.slice(ctx.strIdx);
  const monthListShort = getLocaleMonthsShort(ctx.loc);
  const monthListFull = getLocaleMonthsFull(ctx.loc);
  if (monthListShort.length > 0 || monthListFull.length > 0) {
    const match = remaining.match(getLocaleMonthsShortRegex(ctx.loc, ctx.strict));
    if (match) {
      if (ctx.strict && hasWordContinuation(remaining, match[0].length)) {
        ctx.failed = true;
        return;
      }
      const matched = match[1].toLowerCase();
      let idx = monthListShort.indexOf(matched);
      if (!ctx.strict && idx < 0) {
        idx = monthListFull.indexOf(matched);
      }
      if (idx < 0) {
        const noPeriod = matched.replace(/\.$/, "");
        for (let vi = 0; vi < monthListShort.length; vi++) {
          const base = monthListShort[vi];
          if (base === matched || base.replace(/\.$/, "") === noPeriod) {
            idx = vi;
            break;
          }
        }
      }
      if (idx < 0) {
        const noPeriod = matched.replace(/\.$/, "");
        for (let vi = 0; vi < monthListFull.length; vi++) {
          const base = monthListFull[vi];
          if (base === matched || base.replace(/\.$/, "") === noPeriod) {
            idx = vi;
            break;
          }
        }
      }
      if (idx >= 0) {
        ctx.result.month = idx;
        ctx.result._parsedDateParts[1] = idx;
        ctx.strIdx += match[1].length;
        return;
      }
    }
  }
  const enMatch = allowsEnglishNameFallback(ctx.loc)
    ? remaining.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)
    : null;
  if (enMatch) {
    const monthVal = monthNames[enMatch[1].toLowerCase()];
    ctx.result.month = monthVal;
    ctx.result._parsedDateParts[1] = monthVal;
    ctx.strIdx += enMatch[1].length;
    return;
  }
  if (!ctx.strict) {
    const wordMatch = remaining.match(/^\w+/);
    if (wordMatch) {
      const monthVal = monthNames[wordMatch[0].toLowerCase()];
      ctx.result.month = monthVal;
      ctx.result._parsedDateParts[1] = monthVal;
      ctx.strIdx += wordMatch[0].length;
      return;
    }
  }
  ctx.failed = true;
}

function hd(ctx: ParseCtx): void {
  const p = p1(ctx.str, ctx.strIdx);
  if (p !== null) {
    ctx.result._weekdayNum = p;
    ctx.strIdx += 1;
    if (ctx.strict && (p < 0 || p > 6)) {
      ctx.failed = true;
      return;
    }
    return;
  }
  if (!ctx.strict) {
    const remaining = ctx.str.slice(ctx.strIdx);
    const looseMatch = remaining.match(/^\w+/);
    if (looseMatch) {
      ctx.strIdx += looseMatch[0].length;
      return;
    }
  }
  ctx.failed = true;
}

// -------------------------------------------------------------------------
// HOT PATH — cached regex for S (sub-second) token
// Avoids `new RegExp` per token parse.
// -------------------------------------------------------------------------
const S_DIGIT_RE: RegExp[] = [];
for (let d = 1; d <= 9; d++) {
  S_DIGIT_RE.push(new RegExp(`^(\\d{1,${d}})`));
}

// -------------------------------------------------------------------------
// HOT PATH — ordinal regex cache per locale _abbr
// Avoids `new RegExp` per Do token parse.
// -------------------------------------------------------------------------
const _ordinalRegexCache = new Map<string, RegExp>();

function getOrdinalRegex(loc: ParseLocale): RegExp {
  const key = loc._abbr ?? "en";
  let cached = _ordinalRegexCache.get(key);
  if (!cached) {
    const ordinalParse = loc._config.dayOfMonthOrdinalParse;
    cached =
      ordinalParse instanceof RegExp
        ? new RegExp(`^(?:${ordinalParse.source})`)
        : /^(\d{1,2})(?:st|nd|rd|th)?/i;
    _ordinalRegexCache.set(key, cached);
  }
  return cached;
}

// ===== Dispatch Table =====

const PARSE_DISPATCH: Record<string, TokenHandler> = {
  YYYYYY: hYYYYYY,
  YYYYY: hYYYYY,
  YYYY: hYYYY,
  yyyy: hYYYY,
  YY: hYY,
  Y: hY,
  y: hEraYear,
  yy: hEraYear,
  yyy: hEraYear,
  yo: hYo,
  N: hN,
  NN: hN,
  NNN: hN,
  NNNN: hNNNN,
  NNNNN: hNNNNN,
  MMMM: hMMMM,
  MMM: hMMM,
  MM: hMM,
  M: hM,
  DD: hDD,
  D: hD,
  Do: hDo,
  dddd: hdddd,
  ddd: hddd,
  dd: hdd,
  d: hd,
  E: hE,
  e: he,
  Q: hQ,
  HH: hHH,
  H: hH,
  hh: hhh,
  h: hh,
  kk: hkk,
  k: hk,
  mm: hmm,
  m: hm,
  ss: hss,
  s: hs,
  SSSSSSSSS: hS,
  SSSSSSSS: hS,
  SSSSSSS: hS,
  SSSSSS: hS,
  SSSSS: hS,
  SSSS: hS,
  SSS: hS,
  SS: hS,
  S: hS,
  A: hA,
  a: hA,
  Z: hZ,
  ZZ: hZ,
  X: hX,
  x: hx,
  DDD: hDDD,
  DDDD: hDDD,
  GGGG: hGGGG,
  gggg: hgggg,
  GG: hGG,
  gg: hgg,
  WW: hWW,
  ww: hww,
  W: hW,
  w: hw,
  hmm: hhmm,
  hmmss: hhmmss,
  Hmm: hHmm,
  Hmmss: hHmmss,
};

interface FormatToken {
  type: "token" | "literal";
  name?: string;
  value?: string;
}

const FORMAT_TOKENS = [
  "SSSSSSSSS",
  "SSSSSSSS",
  "SSSSSSS",
  "SSSSSS",
  "SSSSS",
  "SSSS",
  "Hmmss",
  "Hmm",
  "hmmss",
  "hmm",
  "YYYYYY",
  "YYYYY",
  "YYYY",
  "yyyy",
  "MMMM",
  "NNNNN",
  "NNNN",
  "DDDD",
  "dddd",
  "MMM",
  "NNN",
  "DDD",
  "SSS",
  "NN",
  "HH",
  "hh",
  "mm",
  "ss",
  "SS",
  "ZZ",
  "YY",
  "DD",
  "MM",
  "ddd",
  "dd",
  "Do",
  "yo",
  "GGGG",
  "gggg",
  "GG",
  "gg",
  "WW",
  "ww",
  "W",
  "w",
  "M",
  "D",
  "H",
  "h",
  "m",
  "s",
  "S",
  "Z",
  "A",
  "a",
  "Y",
  "y",
  "N",
  "d",
  "E",
  "e",
  "Q",
  "kk",
  "k",
  "X",
  "x",
];

const tokenizeCache = new LruMap<string, FormatToken[]>(1000);

const tokenizeByChar: Record<string, string[]> = {};
for (const token of FORMAT_TOKENS) {
  const c = token[0];
  tokenizeByChar[c] ??= [];
  tokenizeByChar[c].push(token);
}
for (const c in tokenizeByChar) {
  tokenizeByChar[c].sort((a, b) => b.length - a.length);
}

function tokenizeFormat(format: string): FormatToken[] {
  const cached = tokenizeCache.get(format);
  if (cached) {
    return cached;
  }

  const tokens: FormatToken[] = [];
  let i = 0;

  while (i < format.length) {
    if (format[i] === "[") {
      const close = format.indexOf("]", i);
      if (close !== -1) {
        tokens.push({ type: "literal", value: format.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    if (format[i] === "S") {
      let j = i;
      while (j < format.length && format[j] === "S") {
        j++;
      }
      const name = "S".repeat(j - i);
      tokens.push({ type: "token", name });
      i = j;
      continue;
    }

    let matched = false;
    const candidates = tokenizeByChar[format[i]] as string[] | undefined;
    if (candidates) {
      for (const token of candidates) {
        if (format.startsWith(token, i)) {
          tokens.push({ type: "token", name: token });
          i += token.length;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      tokens.push({ type: "literal", value: format[i] });
      i++;
    }
  }

  tokenizeCache.set(format, tokens);
  return tokens;
}

function wrapFastParseResult(data: InternalParsedData): ParsedData {
  return {
    ...data,
    _unusedTokens: [],
    _unusedInput: [],
    _charsLeftOver: 0,
    _empty: false,
    _invalidMonth: null,
    _parsedDateParts: [],
  } as unknown as ParsedData;
}

function tryIsoFormatFastPath(str: string, format: string): ParsedData | null {
  switch (format) {
    case "YYYY-MM-DD":
    case "YYYY-MM-DDTHH:mm:ss":
    case "YYYY-MM-DDTHH:mm:ss.SSSZ":
    case "YYYY-MM-DDTHH:mm:ssZ":
    case "YYYY-MM-DD HH:mm:ss":
    case "YYYY-MM-DD HH:mm:ss.SSSZ":
    case "YYYY-MM-DDTHH:mm:ss.SSS":
    case "YYYY-MM-DD HH:mm:ss.SSS": {
      const fast = parseCommonISO(str);
      if (fast) {
        return wrapFastParseResult(fast);
      }
      break;
    }
    case "YYYYMMDD":
    case "YYYYDDD":
    case "YYYY-DDD": {
      const fast = parseCommonISOExtended(str);
      if (fast) {
        return wrapFastParseResult(fast);
      }
      break;
    }
  }
  return null;
}

function parseWithFormat(
  str: string,
  format: string,
  locale?: ParseLocale,
  strict?: boolean,
): ParsedData | null {
  if (!locale) {
    return null;
  }

  // Fast path: known ISO format strings bypass token dispatch.
  // Call charCode-based handlers directly so that only true ISO-format
  // inputs match — not RFC 2822 strings that happen to be in the format array.
  if (!strict) {
    const fast = tryIsoFormatFastPath(str, format);
    if (fast) {
      return fast;
    }
  }

  const loc = locale;
  const expandedCacheKey = `${loc._abbr ?? "en"}:${format}`;
  let expandedFormat = expandedFormatCache.get(expandedCacheKey);
  if (!expandedFormat) {
    expandedFormat = format.replaceAll(/LTS|LT|llll|LLLL|lll|LLL|ll|LL|l|L/g, (match) => {
      return localeLongDateFormat(loc as never, match);
    });
    expandedFormatCache.set(expandedCacheKey, expandedFormat);
  }
  format = expandedFormat;

  const tokens = tokenizeFormat(format);

  const result: ParsedData = {
    year: undefined,
    month: undefined,
    day: undefined,
    hour: undefined,
    minute: undefined,
    second: undefined,
    millisecond: undefined,
    offset: undefined,
    amp: undefined,
    _weekdayName: undefined,
    _weekdayNum: undefined,
    _unusedTokens: [] as string[],
    _unusedInput: [] as string[],
    _charsLeftOver: 0,
    _empty: true,
    _invalidMonth: null as string | null,
    _parsedDateParts: [] as number[],
    _meridiem: undefined as string | undefined,
  };
  let deferredWhitespaceLiterals: string[] | undefined;
  let charsLeftOver = 0;

  let strIdx = 0;
  let failed = false;
  let tokenIndex = -1;

  const ctx: ParseCtx = {
    str,
    strIdx,
    strict: strict ?? false,
    loc,
    result,
    _seenUnusedTokens: undefined,
    failed: false,
    tokenIndex,
    tokens,
  };

  for (const token of tokens) {
    tokenIndex++;
    ctx.tokenIndex = tokenIndex;
    ctx.strIdx = strIdx;
    ctx.failed = false;

    if (strIdx > str.length) {
      break;
    }

    if (token.type === "literal") {
      const val = token.value ?? "";
      if (!val) {
        continue;
      }

      if (strIdx >= str.length) {
        for (let j = tokenIndex; j < tokens.length; j++) {
          const t = tokens[j];
          if (t.type === "token") {
            result._unusedTokens.push(t.name!);
          } else if (t.value?.trim()) {
            result._unusedTokens.push(t.value.trim());
          } else if (!strict && t.value && /[A-Za-z]/.test(t.value.trim())) {
            result._unusedTokens.push(t.value.trim());
          }
        }
        break;
      }

      const trimmedVal = val.trim();
      if (!trimmedVal) {
        if (strict) {
          if (str.startsWith(val, strIdx)) {
            strIdx += val.length;
          } else {
            const ch = str.charCodeAt(strIdx);
            const isAlphaNum =
              (ch >= 48 && ch <= 57) || (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122);
            if (isAlphaNum) {
              result._unusedTokens.push(val);
            } else {
              let skipIdx = 0;
              while (strIdx + skipIdx < str.length) {
                const c = str.charCodeAt(strIdx + skipIdx);
                const isSpace = c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0c;
                const isWord =
                  (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
                if (isSpace || isWord) {
                  break;
                }
                skipIdx++;
              }
              if (skipIdx > 0) {
                result._unusedInput.push(str.substring(strIdx, strIdx + skipIdx));
                charsLeftOver += skipIdx;
                strIdx += skipIdx;
                (deferredWhitespaceLiterals ??= []).push(val);
              } else {
                result._unusedTokens.push(val);
              }
            }
          }
        } else {
          while (strIdx < str.length) {
            const c = str.charCodeAt(strIdx);
            if (c !== 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d && c !== 0x0c) {
              break;
            }
            strIdx++;
          }
        }
        continue;
      }

      if (strict) {
        if (str.startsWith(trimmedVal, strIdx)) {
          strIdx += trimmedVal.length;
        } else {
          result._unusedTokens.push(val);
        }
      } else {
        let isSep = trimmedVal.length > 0;
        for (let ci = 0; ci < trimmedVal.length; ci++) {
          const cc = trimmedVal.charCodeAt(ci);
          if ((cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122)) {
            isSep = false;
            break;
          }
        }
        if (str.startsWith(trimmedVal, strIdx)) {
          strIdx += trimmedVal.length;
        } else if (isSep) {
          const sepIdx = str.indexOf(trimmedVal, strIdx);
          if (sepIdx !== -1) {
            if (sepIdx > strIdx) {
              let hasAlphaNum = false;
              for (let ci = strIdx; ci < sepIdx; ci++) {
                const cc = str.charCodeAt(ci);
                if ((cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122)) {
                  hasAlphaNum = true;
                  break;
                }
              }
              if (hasAlphaNum) {
                result._unusedInput.push(str.substring(strIdx, sepIdx));
                charsLeftOver += sepIdx - strIdx;
              }
            }
            strIdx = sepIdx + trimmedVal.length;
          }
        } else {
          const matchIdx = str.indexOf(trimmedVal, strIdx);
          if (matchIdx !== -1) {
            let hasAlphaBefore = false;
            for (let check = strIdx; check < matchIdx; check++) {
              const cc = str.charCodeAt(check);
              if ((cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122)) {
                hasAlphaBefore = true;
                break;
              }
            }
            if (!hasAlphaBefore) {
              if (matchIdx > strIdx) {
                result._unusedInput.push(str.substring(strIdx, matchIdx));
                charsLeftOver += matchIdx - strIdx;
              }
              strIdx = matchIdx + trimmedVal.length;
            }
          }
        }
      }
      continue;
    }

    if (strIdx >= str.length) {
      for (let j = tokenIndex; j < tokens.length; j++) {
        const t = tokens[j];
        if (t.type === "token") {
          result._unusedTokens.push(t.name!);
        } else if (t.value?.trim()) {
          result._unusedTokens.push(t.value.trim());
        } else if (!strict && t.value && /[A-Za-z]/.test(t.value.trim())) {
          result._unusedTokens.push(t.value.trim());
        }
      }
      break;
    }

    // Pre-scan: skip non-matching chars for lenient parsing
    if (!strict) {
      const nameToken =
        token.name === "MMMM" ||
        token.name === "MMM" ||
        token.name === "dddd" ||
        token.name === "ddd" ||
        token.name === "dd" ||
        token.name === "Do";
      const digitLike = /^[YMDWHhmsSXxk]/.test(token.name ?? "") && !nameToken;
      if (digitLike) {
        const canHandleSign =
          (token.name === "YYYYYY" ||
            token.name === "YYYYY" ||
            token.name === "YYYY" ||
            token.name === "yyyy" ||
            token.name === "Y") &&
          strIdx === 0;
        const ch0 = str.charCodeAt(strIdx);
        if ((ch0 < 48 || ch0 > 57) && !canHandleSign) {
          let skipIdx = 0;
          while (strIdx + skipIdx < str.length) {
            const c = str.charCodeAt(strIdx + skipIdx);
            if (c >= 48 && c <= 57) {
              break;
            }
            skipIdx++;
          }
          if (skipIdx > 0) {
            result._unusedInput.push(str.substring(strIdx, strIdx + skipIdx));
            charsLeftOver += skipIdx;
            strIdx += skipIdx;
          }
        } else if ((ch0 < 48 || ch0 > 57) && canHandleSign) {
          if (ch0 !== 43 && ch0 !== 45) {
            let skipIdx = 0;
            while (strIdx + skipIdx < str.length) {
              const c = str.charCodeAt(strIdx + skipIdx);
              if (c >= 48 && c <= 57) {
                break;
              }
              skipIdx++;
            }
            if (skipIdx > 0) {
              result._unusedInput.push(str.substring(strIdx, strIdx + skipIdx));
              charsLeftOver += skipIdx;
              strIdx += skipIdx;
            }
          }
        }
      } else if (
        token.name === "MMMM" ||
        token.name === "MMM" ||
        token.name === "dddd" ||
        token.name === "ddd" ||
        token.name === "dd"
      ) {
        const ch0 = str.charCodeAt(strIdx);
        const isLetterOrDigit =
          (ch0 >= 65 && ch0 <= 90) ||
          (ch0 >= 97 && ch0 <= 122) ||
          (ch0 >= 48 && ch0 <= 57) ||
          ch0 === 126 ||
          ch0 === 700 ||
          ch0 === 39;
        if (!isLetterOrDigit) {
          let skipIdx = 1;
          while (strIdx + skipIdx < str.length) {
            const c = str.charCodeAt(strIdx + skipIdx);
            if (
              (c >= 65 && c <= 90) ||
              (c >= 97 && c <= 122) ||
              (c >= 48 && c <= 57) ||
              c === 126 ||
              c === 700 ||
              c === 39
            ) {
              break;
            }
            skipIdx++;
          }
          if (skipIdx > 0) {
            result._unusedInput.push(str.substring(strIdx, strIdx + skipIdx));
            charsLeftOver += skipIdx;
            strIdx += skipIdx;
          }
        }
      } else if (token.name === "A" || token.name === "a") {
        const ch0 = str.charCodeAt(strIdx);
        if (ch0 !== 65 && ch0 !== 97 && ch0 !== 80 && ch0 !== 112) {
          let skipIdx = 1;
          while (strIdx + skipIdx < str.length) {
            const c = str.charCodeAt(strIdx + skipIdx);
            if (c === 65 || c === 97 || c === 80 || c === 112) {
              break;
            }
            skipIdx++;
          }
          if (skipIdx > 0) {
            result._unusedInput.push(str.substring(strIdx, strIdx + skipIdx));
            charsLeftOver += skipIdx;
            strIdx += skipIdx;
          }
        }
      }
    }

    // Dispatch to token handler
    const handler = token.name ? PARSE_DISPATCH[token.name] : undefined;
    if (handler) {
      ctx.strIdx = strIdx;
      handler(ctx);
      strIdx = ctx.strIdx;
      failed = ctx.failed;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (failed) {
      if (strict) {
        for (let j = tokenIndex; j < tokens.length; j++) {
          const t = tokens[j];
          if (t.type === "token") {
            const seenUnusedTokens = getSeenUnusedTokens(ctx);
            if (!seenUnusedTokens.has(t.name!)) {
              seenUnusedTokens.add(t.name!);
              result._unusedTokens.push(t.name!);
            }
            if (
              j === tokenIndex &&
              deferredWhitespaceLiterals &&
              deferredWhitespaceLiterals.length > 0
            ) {
              for (const literal of deferredWhitespaceLiterals) {
                if (!seenUnusedTokens.has(literal)) {
                  seenUnusedTokens.add(literal);
                  result._unusedTokens.push(literal);
                }
              }
              deferredWhitespaceLiterals.length = 0;
            }
          } else if (t.value?.trim()) {
            const trimmed = t.value.trim();
            const seenUnusedTokens = getSeenUnusedTokens(ctx);
            if (!seenUnusedTokens.has(trimmed)) {
              seenUnusedTokens.add(trimmed);
              result._unusedTokens.push(trimmed);
            }
          } else if (
            t.value &&
            deferredWhitespaceLiterals &&
            deferredWhitespaceLiterals.length > 0
          ) {
            const seenUnusedTokens = getSeenUnusedTokens(ctx);
            for (const literal of deferredWhitespaceLiterals) {
              if (!seenUnusedTokens.has(literal)) {
                seenUnusedTokens.add(literal);
                result._unusedTokens.push(literal);
              }
            }
            deferredWhitespaceLiterals.length = 0;
          }
        }
        break;
      }
      failed = false;
      // compatibility boundary: token is FormatToken but oxlint's
      // no-unnecessary-condition can't see the discriminant narrowing
      const tok = token as { type: string; name?: string; value?: string };
      if (tok.type === "token") {
        result._unusedTokens.push(tok.name!);
      } else if (tok.type === "literal" && tok.value) {
        result._unusedTokens.push(tok.value.trim());
      }
      const skipMatch = str.slice(strIdx).match(/^[^\p{L}\d]+/u);
      if (skipMatch) {
        result._unusedInput.push(skipMatch[0]);
        charsLeftOver += skipMatch[0].length;
        strIdx += skipMatch[0].length;
      }
    }
  }

  if (result.amp !== undefined && result.hour !== undefined) {
    const mHourFn = loc._config.meridiemHour;
    if (typeof mHourFn === "function") {
      result.hour = mHourFn(result.hour, result._meridiem as string);
    } else {
      const isPM = localeIsPM(loc as never, result._meridiem ?? "");
      if (!isPM && result.hour === 12) {
        result.hour = 0;
      } else if (isPM && result.hour < 12) {
        result.hour = result.hour + 12;
      }
    }
  }

  if (result._era && result._eraYear !== undefined) {
    const era = result._era as Record<string, unknown>;
    const sinceStr =
      typeof era.since === "string" || typeof era.since === "number" ? String(era.since) : null;
    const sinceMatch = sinceStr ? sinceStr.match(/^(-?\d+)/) : null;
    if (sinceMatch) {
      const sinceYear = parseInt(sinceMatch[1], 10);
      const eUntil = era.until;
      if (sinceYear === 0 && eUntil != null && typeof eUntil === "number" && eUntil < 0) {
        result.year = 1 - result._eraYear;
      } else {
        result.year =
          sinceYear + result._eraYear - (era.offset != null ? (era.offset as number) : 1);
      }
      result._parsedDateParts[0] = result.year;
    }
    delete result._era;
    delete result._eraYear;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (strIdx < str.length && !failed) {
    const rest = str.substring(strIdx);
    if (rest) {
      result._unusedInput.push(rest);
      charsLeftOver += rest.length;
    }
  }
  result._charsLeftOver = charsLeftOver;
  result._empty =
    result.year === undefined &&
    result.month === undefined &&
    result.day === undefined &&
    result.hour === undefined &&
    result.minute === undefined &&
    result.second === undefined &&
    result.millisecond === undefined &&
    result.isoWeek === undefined &&
    result.isoWeekYear === undefined &&
    result._week === undefined &&
    result._weekYear === undefined &&
    result._weekdayNum === undefined;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (failed) {
    if (strict) {
      if (result._bigHour) {
        return result;
      }
      for (let j = tokenIndex; j < tokens.length; j++) {
        const t = tokens[j];
        if (t.type === "token") {
          const seenUnusedTokens = getSeenUnusedTokens(ctx);
          if (!seenUnusedTokens.has(t.name!)) {
            seenUnusedTokens.add(t.name!);
            result._unusedTokens.push(t.name!);
          }
        } else if (t.value?.trim()) {
          const trimmed = t.value.trim();
          const seenUnusedTokens = getSeenUnusedTokens(ctx);
          if (!seenUnusedTokens.has(trimmed)) {
            seenUnusedTokens.add(trimmed);
            result._unusedTokens.push(trimmed);
          }
        }
      }
      return result;
    }
  }

  return result;
}

function parseWithFormats(
  str: string,
  formats: string[],
  locale?: ParseLocale,
  strict?: boolean,
): ParsedData | null {
  let best: ParsedData | null = null;
  let bestScore = -99999;
  let bestFmt = "";
  for (const fmt of formats) {
    const result = parseWithFormat(str, fmt, locale, strict);
    if (!result) {
      continue;
    }
    const hasVal =
      result.year !== undefined ||
      result.month !== undefined ||
      result.day !== undefined ||
      result.hour !== undefined ||
      result.minute !== undefined ||
      result.second !== undefined ||
      result.millisecond !== undefined ||
      result.isoWeek !== undefined;
    if (!hasVal) {
      continue;
    }

    let score = 0;
    if (result.year !== undefined) {
      score += 40;
    }
    if (result.month !== undefined) {
      score += 20;
    }
    if (result.day !== undefined) {
      score += 20;
    }
    if (result.hour !== undefined) {
      score += 10;
    }
    if (result.minute !== undefined) {
      score += 8;
    }
    if (result.second !== undefined) {
      score += 5;
    }
    if (result.millisecond !== undefined) {
      score += 3;
    }
    if (result.isoWeek !== undefined) {
      score += 16;
    }
    if (result.isoWeekYear !== undefined) {
      score += 10;
    }
    score -= result._unusedTokens.length * 10;
    score -= result._unusedInput.reduce((a: number, s: string) => a + s.length, 0) * 2;
    if (result._charsLeftOver) {
      score -= result._charsLeftOver * 3;
    }

    if (result.month !== undefined && (result.month < 0 || result.month > 11)) {
      score -= 100;
    }
    if (result.day !== undefined && result.day < 1) {
      score -= 100;
    }
    if (result.hour !== undefined && (result.hour < 0 || result.hour > 23)) {
      score -= 100;
    }

    if (score > bestScore) {
      bestScore = score;
      best = result;
      bestFmt = fmt;
    }
  }
  if (best) {
    best._f = bestFmt;
  }
  return best;
}

function stripRFC2822Comments(str: string): string {
  // Fast path: no comments, just normalize whitespace
  if (!str.includes("(")) {
    return str.replaceAll(/\s+/g, " ").trim();
  }
  const parts: string[] = [];
  let depth = 0;
  for (const ch of str) {
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth < 0) {
        depth = 0;
      }
    } else if (depth === 0) {
      parts.push(ch);
    }
  }
  return parts.join("").replaceAll(/\s+/g, " ").trim();
}

const RFC_MONTH_MAP: Record<string, number | undefined> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const RFC_TZ_MAP: Record<string, number | undefined> = {
  UTC: 0,
  GMT: 0,
  EST: -300,
  EDT: -240,
  CST: -360,
  CDT: -300,
  MST: -420,
  MDT: -360,
  PST: -480,
  PDT: -420,
};

function parseRFC2822(match: RegExpMatchArray): InternalParsedData | null {
  const day = parseInt(match[2], 10);
  const monthStr = match[3];
  const yearStr = match[4];
  const hour = parseInt(match[5], 10);
  const minute = parseInt(match[6], 10);
  const second = match[7] ? parseInt(match[7], 10) : 0;
  const tzStr = match[8] || match[9];

  const month = RFC_MONTH_MAP[monthStr];
  if (month === undefined) {
    return null;
  }

  let year = parseInt(yearStr, 10);
  if (yearStr.length === 2) {
    year = year > 68 ? 1900 + year : 2000 + year;
  }

  let offset = 0;
  if (tzStr) {
    if (RFC_TZ_MAP[tzStr] !== undefined) {
      offset = RFC_TZ_MAP[tzStr];
    } else if (tzStr.length === 5) {
      const sign = tzStr[0] === "+" ? 1 : -1;
      const tzHour = parseInt(tzStr.substring(1, 3), 10);
      const tzMin = parseInt(tzStr.substring(3, 5), 10);
      offset = sign * (tzHour * 60 + tzMin);
    }
  }

  const weekday = match[1]
    ? WEEKDAY_NAMES_MAP[match[1].replaceAll(/[,\s]/g, "").toLowerCase().substring(0, 3)]
    : undefined;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond: 0,
    offset,
    _weekdayName: weekday as unknown as string,
    _rfc2822: true,
  };
}

function classifyISODatePart(datePart: string): [fmt: string, allowTime: boolean] | null {
  const len = datePart.length;
  const ch0 = datePart.charCodeAt(0);
  const hasDash = datePart.includes("-", ch0 === 45 ? 1 : 0);

  if (hasDash) {
    if (len === 13) {
      if (datePart.charCodeAt(8) === 87) {
        return ["GGGG-[W]WW-E", true];
      }
      return ["YYYYYY-MM-DD", true];
    }
    if (len === 12 && (ch0 === 43 || ch0 === 45) && datePart.charCodeAt(7) === 87) {
      return ["GGGG-[W]WW", false];
    }
    if (len === 11 && (ch0 === 43 || ch0 === 45)) {
      if (datePart.charCodeAt(8) === 87) {
        return ["GGGG-[W]WW", false];
      }
      return ["YYYY-DDD", true];
    }
    if (len === 10) {
      if (datePart.charCodeAt(5) === 87) {
        return ["GGGG-[W]WW-E", true];
      }
      return ["YYYY-MM-DD", true];
    }
    if (len === 8) {
      if (datePart.charCodeAt(5) === 87) {
        return ["GGGG-[W]WW", false];
      }
      return ["YYYY-DDD", true];
    }
    if (len === 7) {
      return ["YYYY-MM", false];
    }
    return null;
  }

  if (len === 12 && (ch0 === 43 || ch0 === 45)) {
    return ["YYYYYYMMDD", true];
  }
  if (len === 8) {
    if (datePart.charCodeAt(4) === 87) {
      return ["GGGG[W]WWE", true];
    }
    return ["YYYYMMDD", true];
  }
  if (len === 7) {
    if (datePart.charCodeAt(4) === 87) {
      return ["GGGG[W]WW", false];
    }
    return ["YYYYDDD", true];
  }
  if (len === 6) {
    return ["YYYYMM", false];
  }
  if (len === 4) {
    return ["YYYY", false];
  }
  return null;
}

function classifyISOTimePart(timePart: string): string | null {
  const len = timePart.length;
  const hasColon = len > 2 && timePart.charCodeAt(2) === 58;

  if (hasColon) {
    if (timePart.includes(".")) {
      return "HH:mm:ss.SSSS";
    }
    if (timePart.includes(",")) {
      return "HH:mm:ss,SSSS";
    }
    if (len === 8) {
      return "HH:mm:ss";
    }
    if (len === 5) {
      return "HH:mm";
    }
    return null;
  }

  if (timePart.includes(".")) {
    return "HHmmss.SSSS";
  }
  if (timePart.includes(",")) {
    return "HHmmss,SSSS";
  }
  if (len === 6) {
    return "HHmmss";
  }
  if (len === 4) {
    return "HHmm";
  }
  if (len === 2) {
    return "HH";
  }
  return null;
}

function parseISOWithTable(str: string, locale?: ParseLocale): InternalParsedData | null {
  const match = EXTENDED_ISO_REGEX.exec(str) ?? BASIC_ISO_REGEX.exec(str);
  if (!match) {
    return null;
  }

  const datePart = match[1];
  const classified = classifyISODatePart(datePart);
  if (!classified) {
    return null;
  }
  let [dateFormat, allowTime] = classified;

  if (match[3]) {
    if (!allowTime) {
      return { _claimed: true };
    }
    let timeFormat = classifyISOTimePart(match[3]);
    if (!timeFormat) {
      return { _claimed: true };
    }
    if (timeFormat.includes("SSSS")) {
      const fracPos = match[3].search(/[.,]/);
      if (fracPos >= 0) {
        timeFormat = timeFormat.replace("SSSS", "S".repeat(match[3].length - fracPos - 1));
      }
    }
    dateFormat = dateFormat + (match[2] || " ") + timeFormat;
  }

  if (match[4]) {
    if (!match[3]) {
      return { _claimed: true };
    }
    const tzStr = match[4].trim();
    if (
      tzStr === "Z" ||
      tzStr === "z" ||
      tzStr.charCodeAt(0) === 43 ||
      tzStr.charCodeAt(0) === 45
    ) {
      dateFormat += "Z";
    } else {
      return { _claimed: true };
    }
  }

  let parseStr = str;
  const ch0 = parseStr.charCodeAt(0);
  if (
    (ch0 === 43 || ch0 === 45) &&
    datePart.charCodeAt(0) === ch0 &&
    !dateFormat.startsWith("YYYYYY")
  ) {
    parseStr = parseStr.slice(1);
  }

  // Try parseCommonISO fast path before falling through to token dispatch.
  // This avoids parseWithFormat overhead for common YYYY-MM-DD[ HH:mm:ss[...]] patterns.
  if (
    dateFormat === "YYYY-MM-DD" ||
    dateFormat.startsWith("YYYY-MM-DDTHH:mm:ss") ||
    dateFormat.startsWith("YYYY-MM-DD HH:mm:ss")
  ) {
    const parsed = parseCommonISO(parseStr);
    if (parsed) {
      return parsed;
    }
  }

  const result = parseWithFormat(parseStr, dateFormat, locale);
  if (!result) {
    return { _claimed: true };
  }
  if (result._weekdayNum !== undefined && (result._weekdayNum < 1 || result._weekdayNum > 7)) {
    return { _claimed: true };
  }
  if (dateFormat.includes("DDD") && result.year !== undefined && result.dayOfYear === undefined) {
    return { _claimed: true };
  }
  if (
    result._unusedInput.some((s: string) => s.length > 0) &&
    result._unusedTokens.some((s: string) => s.length > 0)
  ) {
    return null;
  }
  return result as InternalParsedData;
}

const monthNames: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function getLocaleMonthsFull(loc: ParseLocale): string[] {
  if ((loc as CachedParseLocale)._monthsCache !== undefined) {
    return (loc as CachedParseLocale)._monthsCache as string[];
  }
  const months = localeMonths(loc as never);
  const monthsArr = Array.isArray(months) ? months : [];
  const lower = monthsArr.map((m: string) => m.toLowerCase());
  const allFull = [...new Set(lower)];
  (loc as CachedParseLocale)._monthsCache = lower;
  (loc as CachedParseLocale)._monthsStrictRegex = new RegExp(
    `^(${sortByLengthDesc(allFull).map(escapeRegex).join("|")})`,
    "i",
  );
  const monthsShort = localeMonthsShort(loc as never);
  const shortArr = Array.isArray(monthsShort) ? monthsShort : [];
  const shortLower = shortArr.map((m: string) => m.toLowerCase());
  // Strip trailing periods from short months for matching
  const shortNoPeriod = shortLower
    .map((m: string) => m.replace(/\.$/, ""))
    .filter((m) => m.length > 0);
  const all = [...new Set([...allFull, ...shortLower, ...shortNoPeriod])];
  (loc as CachedParseLocale)._monthsRegex = new RegExp(
    `^(${sortByLengthDesc(all).map(escapeRegex).join("|")})`,
    "i",
  );
  return lower;
}

function getLocaleMonthsFullRegex(loc: ParseLocale, strict?: boolean): RegExp {
  if (strict) {
    if ((loc as CachedParseLocale)._monthsStrictRegex !== undefined) {
      return (loc as CachedParseLocale)._monthsStrictRegex as RegExp;
    }
    getLocaleMonthsFull(loc);
    return (loc as CachedParseLocale)._monthsStrictRegex as RegExp;
  }
  if ((loc as CachedParseLocale)._monthsRegex !== undefined) {
    return (loc as CachedParseLocale)._monthsRegex as RegExp;
  }
  getLocaleMonthsFull(loc);
  return (loc as CachedParseLocale)._monthsRegex as RegExp;
}

function getLocaleMonthsShort(loc: ParseLocale): string[] {
  if ((loc as CachedParseLocale)._monthsShortCache !== undefined) {
    return (loc as CachedParseLocale)._monthsShortCache as string[];
  }
  const monthsShort = localeMonthsShort(loc as never);
  let shortArr = Array.isArray(monthsShort) ? monthsShort : [];
  const lower = shortArr.map((m: string) => m.toLowerCase());
  (loc as CachedParseLocale)._monthsShortCache = lower;
  const noPeriod = lower.map((m) => m.replace(/\.$/, "")).filter((m) => m.length > 0);
  const allStrict = [...new Set([...lower, ...noPeriod])];
  (loc as CachedParseLocale)._monthsShortStrictRegex = new RegExp(
    `^(${sortByLengthDesc(allStrict).map(escapeRegex).join("|")})`,
    "i",
  );
  if (lower.length === 0) {
    return getLocaleMonthsFull(loc);
  }
  return lower;
}

function getLocaleMonthsShortRegex(loc: ParseLocale, strict?: boolean): RegExp {
  if (strict) {
    if ((loc as CachedParseLocale)._monthsShortStrictRegex !== undefined) {
      return (loc as CachedParseLocale)._monthsShortStrictRegex as RegExp;
    }
    getLocaleMonthsShort(loc);
    return (loc as CachedParseLocale)._monthsShortStrictRegex as RegExp;
  }
  if ((loc as CachedParseLocale)._monthsShortRegex !== undefined) {
    return (loc as CachedParseLocale)._monthsShortRegex as RegExp;
  }
  const shortList = getLocaleMonthsShort(loc);
  const fullList = getLocaleMonthsFull(loc);
  const noPeriod = shortList.map((m) => m.replace(/\.$/, "")).filter((m) => m.length > 0);
  const all = [...new Set([...shortList, ...fullList, ...noPeriod])];
  (loc as CachedParseLocale)._monthsShortRegex = new RegExp(
    `^(${sortByLengthDesc(all).map(escapeRegex).join("|")})`,
    "i",
  );
  return (loc as CachedParseLocale)._monthsShortRegex as RegExp;
}

function sortByLengthDesc(arr: string[]): string[] {
  return [...arr].sort((a, b) => b.length - a.length);
}

function allowsEnglishNameFallback(loc: ParseLocale): boolean {
  const abbr = (loc as CachedParseLocale)._abbr;
  return typeof abbr === "string" && abbr.startsWith("en");
}

function hasWordContinuation(remaining: string, matchedLength: number): boolean {
  return /^[\p{L}\p{N}'\u02BC]/u.test(remaining.slice(matchedLength));
}

function getLocaleWeekdaysFull(loc: ParseLocale): string[] {
  if ((loc as CachedParseLocale)._weekdaysCache !== undefined) {
    return (loc as CachedParseLocale)._weekdaysCache as string[];
  }
  const cfg = (loc as CachedParseLocale)._config;
  let names: string[] = [];
  if (Array.isArray(cfg.weekdays)) {
    names = cfg.weekdays;
  } else if (typeof cfg.weekdays === "object" && cfg.weekdays !== null) {
    const standalone =
      ((cfg.weekdays as Record<string, unknown>).standalone as string[] | undefined) ?? [];
    const format = ((cfg.weekdays as Record<string, unknown>).format as string[] | undefined) ?? [];
    names = [...new Set([...standalone, ...format])];
  } else if (typeof cfg.weekdays === "function") {
    for (let i = 0; i < 7; i++) {
      try {
        const r = cfg.weekdays({ day: () => i } as { day: () => number }, "dddd");
        if (typeof r === "string") {
          names.push(r);
        }
      } catch {}
    }
  }
  const lower = names.map((m: string) => m.toLowerCase());
  (loc as CachedParseLocale)._weekdaysCache = lower;
  const all = [...new Set(lower)];
  (loc as CachedParseLocale)._weekdaysRegex = new RegExp(
    `^(${sortByLengthDesc(all).map(escapeRegex).join("|")})`,
    "i",
  );
  return lower;
}

function getLocaleWeekdaysFullRegex(loc: ParseLocale): RegExp {
  if ((loc as CachedParseLocale)._weekdaysRegex !== undefined) {
    return (loc as CachedParseLocale)._weekdaysRegex as RegExp;
  }
  getLocaleWeekdaysFull(loc);
  return (loc as CachedParseLocale)._weekdaysRegex as RegExp;
}

function getLocaleWeekdaysShort(loc: ParseLocale): string[] {
  if ((loc as CachedParseLocale)._weekdaysShortCache !== undefined) {
    return (loc as CachedParseLocale)._weekdaysShortCache as string[];
  }
  const cfg = (loc as CachedParseLocale)._config;
  let names: string[] = [];
  if (Array.isArray(cfg.weekdaysShort)) {
    names = cfg.weekdaysShort;
  } else if (typeof cfg.weekdaysShort === "object" && cfg.weekdaysShort !== null) {
    const standalone =
      ((cfg.weekdaysShort as Record<string, unknown>).standalone as string[] | undefined) ?? [];
    const format =
      ((cfg.weekdaysShort as Record<string, unknown>).format as string[] | undefined) ?? [];
    names = [...new Set([...standalone, ...format])];
  } else {
    return getLocaleWeekdaysShort(loc);
  }
  const lower = names.map((m: string) => m.toLowerCase());
  (loc as CachedParseLocale)._weekdaysShortCache = lower;
  const all = [...new Set(lower)];
  (loc as CachedParseLocale)._weekdaysShortRegex = new RegExp(
    `^(${sortByLengthDesc(all).map(escapeRegex).join("|")})`,
    "i",
  );
  return lower;
}

function getLocaleWeekdaysShortRegex(loc: ParseLocale): RegExp {
  if ((loc as CachedParseLocale)._weekdaysShortRegex !== undefined) {
    return (loc as CachedParseLocale)._weekdaysShortRegex as RegExp;
  }
  getLocaleWeekdaysShort(loc);
  return (loc as CachedParseLocale)._weekdaysShortRegex as RegExp;
}

function getLocaleWeekdaysMin(loc: ParseLocale): string[] {
  if ((loc as CachedParseLocale)._weekdaysMinCache !== undefined) {
    return (loc as CachedParseLocale)._weekdaysMinCache as string[];
  }
  const cfg = (loc as CachedParseLocale)._config;
  let names: string[] = [];
  if (Array.isArray(cfg.weekdaysMin)) {
    names = cfg.weekdaysMin;
  } else if (typeof cfg.weekdaysMin === "object" && cfg.weekdaysMin !== null) {
    const standalone =
      ((cfg.weekdaysMin as Record<string, unknown>).standalone as string[] | undefined) ?? [];
    const format =
      ((cfg.weekdaysMin as Record<string, unknown>).format as string[] | undefined) ?? [];
    names = [...new Set([...standalone, ...format])];
  } else {
    return getLocaleWeekdaysShort(loc);
  }
  const lower = names.map((m: string) => m.toLowerCase());
  (loc as CachedParseLocale)._weekdaysMinCache = lower;
  const all = [...new Set(lower)];
  (loc as CachedParseLocale)._weekdaysMinRegex = new RegExp(
    `^(${sortByLengthDesc(all).map(escapeRegex).join("|")})`,
    "i",
  );
  return lower;
}

function getLocaleWeekdaysMinRegex(loc: ParseLocale): RegExp {
  if ((loc as CachedParseLocale)._weekdaysMinRegex !== undefined) {
    return (loc as CachedParseLocale)._weekdaysMinRegex as RegExp;
  }
  getLocaleWeekdaysMin(loc);
  return (loc as CachedParseLocale)._weekdaysMinRegex as RegExp;
}

function timedMatch(
  remaining: string,
  pattern: RegExp,
  exactLen?: number,
  strict?: boolean,
): RegExpMatchArray | null {
  const match = remaining.match(pattern);
  if (!match) {
    return null;
  }
  if (strict && exactLen !== undefined && match[1].length !== exactLen) {
    return null;
  }
  if (strict && exactLen === undefined && match[1].length > 2) {
    return null;
  }
  return match;
}

const expandedFormatCache = new LruMap<string, string>(500);
export function parseArray(arr: unknown[]): ParsedData | null {
  if (arr.length === 0) {
    return null;
  }

  for (const val of arr) {
    if (val === null || val === undefined) {
      return null;
    }
    const n = Number(val);
    if (isNaN(n)) {
      return null;
    }
  }

  const result: ParsedData = {
    _unusedTokens: [],
    _unusedInput: [],
    _charsLeftOver: 0,
    _empty: false,
    _invalidMonth: null,
    _parsedDateParts: [],
    year: Number(arr[0]),
    month: arr[1] !== undefined ? Number(arr[1]) : 0,
    day: arr[2] !== undefined ? Number(arr[2]) : 1,
    hour: arr[3] !== undefined ? Number(arr[3]) : 0,
    minute: arr[4] !== undefined ? Number(arr[4]) : 0,
    second: arr[5] !== undefined ? Number(arr[5]) : 0,
    millisecond: arr[6] !== undefined ? Number(arr[6]) : 0,
  };

  if (isNaN(result.year!)) {
    return null;
  }

  if ((result.year ?? 0) < 0 || (result.year ?? 0) > 9999) {
    const d = new Date(0);
    d.setFullYear(result.year ?? 0, result.month ?? 0, result.day ?? 1);
    d.setHours(result.hour ?? 0, result.minute ?? 0, result.second ?? 0, result.millisecond ?? 0);
    if (isNaN(d.getTime())) {
      return null;
    }
    return { ...result, _useConstructor: true };
  }

  return result;
}

export function parseObject(obj: Record<string, unknown>): InternalParsedData {
  const result: InternalParsedData = {};

  if (hasOwnProp(obj, "year") || hasOwnProp(obj, "years") || hasOwnProp(obj, "y")) {
    const v = obj.year !== undefined ? obj.year : obj.years !== undefined ? obj.years : obj.y;
    if (v != null) {
      result.year = Number(v);
    }
  }
  if (hasOwnProp(obj, "month") || hasOwnProp(obj, "months") || hasOwnProp(obj, "M")) {
    const v = obj.month !== undefined ? obj.month : obj.months !== undefined ? obj.months : obj.M;
    if (v != null) {
      result.month = Number(v);
    }
  }
  if (hasOwnProp(obj, "day") || hasOwnProp(obj, "days") || hasOwnProp(obj, "d")) {
    const v = obj.day !== undefined ? obj.day : obj.days !== undefined ? obj.days : obj.d;
    if (v != null) {
      result.day = Number(v);
    }
  } else if (hasOwnProp(obj, "date") || hasOwnProp(obj, "dates")) {
    const v = obj.date !== undefined ? obj.date : obj.dates;
    if (v != null) {
      result.day = Number(v);
    }
  }
  if (hasOwnProp(obj, "hour") || hasOwnProp(obj, "hours") || hasOwnProp(obj, "h")) {
    const v = obj.hour !== undefined ? obj.hour : obj.hours !== undefined ? obj.hours : obj.h;
    if (v != null) {
      result.hour = Number(v);
    }
  }
  if (hasOwnProp(obj, "minute") || hasOwnProp(obj, "minutes") || hasOwnProp(obj, "m")) {
    const v =
      obj.minute !== undefined ? obj.minute : obj.minutes !== undefined ? obj.minutes : obj.m;
    if (v != null) {
      result.minute = Number(v);
    }
  }
  if (hasOwnProp(obj, "second") || hasOwnProp(obj, "seconds") || hasOwnProp(obj, "s")) {
    const v =
      obj.second !== undefined ? obj.second : obj.seconds !== undefined ? obj.seconds : obj.s;
    if (v != null) {
      result.second = Number(v);
    }
  }
  if (hasOwnProp(obj, "millisecond") || hasOwnProp(obj, "milliseconds") || hasOwnProp(obj, "ms")) {
    const v =
      obj.millisecond !== undefined
        ? obj.millisecond
        : obj.milliseconds !== undefined
          ? obj.milliseconds
          : obj.ms;
    if (v != null) {
      result.millisecond = Number(v);
    }
  }

  return result;
}

export function parseTwoDigitYear(str: string): number {
  const num = parseInt(str, 10);
  return num > 68 ? 1900 + num : 2000 + num;
}

export { ISO_8601_REGEX };
