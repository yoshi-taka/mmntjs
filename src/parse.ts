import { isArray, hasOwnProp } from "./utils";
import type { ParseLocale } from "./parse-locale";
import type { InternalParsedData } from "./types";
import { localeIsPM, localeLongDateFormat } from "./locale-runtime";
import type { ParsedData, ParseCtx, Op } from "./parse-shared";
import { compileFormatToOpcodes, expandedFormatCache, WEEKDAY_NAMES_MAP } from "./parse-shared";

export { parseTwoDigitYear } from "./utils";
export type { ParsedData } from "./parse-shared";

// PGO: path counters — enabled only when PGO=1 env var is set
const _PCOUNT: Record<string, number> = {};
const _PGOActive = !!process.env.PGO;
function _pc(name: string): void {
  if (_PGOActive) {
    _PCOUNT[name] = (_PCOUNT[name] ?? 0) + 1;
  }
}
export { parseTwoDigitYearFn, setParseTwoDigitYear } from "./parse-shared";
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

export function parseString(
  str: string,
  format?: string | string[],
  locale?: ParseLocale,
  strict?: boolean,
): ParsedData | null {
  _pc("parseString:entry");
  if (typeof str !== "string") {
    return null;
  }

  if (!format && (locale?._abbr ?? "en") === "en") {
    _pc("parseString:en-fast");
    const len = str.length;
    if (
      (len === 10 || (len >= 19 && len <= 29)) &&
      str.charCodeAt(4) === 45 &&
      str.charCodeAt(7) === 45
    ) {
      const fast = parseCommonISO(str);
      if (fast) {
        _pc("parseString:common-iso-hit");
        return fast as unknown as ParsedData;
      }
    }
  }

  if (!locale) {
    return null;
  }
  if (format) {
    return _parseWithFormat(str, format, locale, strict);
  }
  return _parseFreeform(str, locale);
}

function _parseWithFormat(
  str: string,
  format: string | string[],
  locale: ParseLocale,
  strict?: boolean,
): ParsedData | null {
  _pc("parseString:with-format");
  const preparseFn = (locale as never as { _config?: { preparse?: (s: string) => string } })._config
    ?.preparse;

  if (typeof format === "string" && !strict) {
    const fast = tryIsoFormatFastPath(str, format);
    if (fast) {
      _pc("parseString:format-fast-hit");
      return fast as unknown as ParsedData;
    }
  }

  const preparsed = preparseFn ? preparseFn(str) : str;
  if (isArray(format)) {
    _pc("parseString:format-array");
    return parseWithFormats(preparsed, format, locale, strict) as unknown as ParsedData;
  }
  _pc("parseString:format-single");
  return parseWithFormat(preparsed, format, locale, strict) as unknown as ParsedData;
}

function _parseFreeform(str: string, locale: ParseLocale): ParsedData | null {
  _pc("parseString:freeform");
  const preparseFn = (locale as never as { _config?: { preparse?: (s: string) => string } })._config
    ?.preparse;
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
    _pc("parseString:blank");
    return null;
  }

  const c0 = trimmed.charCodeAt(0);
  const isDigit = c0 >= 48 && c0 <= 57;
  const isSlash = c0 === 47;
  const isSign = c0 === 43 || c0 === 45;

  if (isDigit) {
    _pc("parseString:digit-start");
    const fastResult = parseCommonISOExtended(trimmed);
    if (fastResult) {
      _pc("parseString:iso-extended-hit");
      return fastResult as unknown as ParsedData;
    }
  } else if (isSlash) {
    _pc("parseString:slash-start");
    const jsonMatch = trimmed.match(JSON_DATE_REGEX);
    if (jsonMatch) {
      _pc("parseString:json-date-hit");
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
    _pc("parseString:iso-table");
    const isoResult = parseISOWithTable(trimmed, locale);
    if (isoResult) {
      if (isoResult._claimed) {
        _pc("parseString:iso-table-claimed");
        return { _claimed: true } as unknown as ParsedData;
      }
      _pc("parseString:iso-table-hit");
      return isoResult as unknown as ParsedData;
    }
  }

  _pc("parseString:rfc2822");
  let rfcStr = stripRFC2822Comments(trimmed);
  let rfcMatch = rfcStr.match(RFC_2822_REGEX);
  if (!rfcMatch && trimmed !== rfcStr) {
    rfcMatch = trimmed.match(RFC_2822_REGEX);
  }
  if (rfcMatch) {
    _pc("parseString:rfc2822-hit");
    return parseRFC2822(rfcMatch) as unknown as ParsedData;
  }

  _pc("parseString:fallthrough-null");
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
        if (dayOfYear >= 1 && dayOfYear <= 366) {
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
      if (dayOfYear >= 1 && dayOfYear <= 366) {
        return { year, dayOfYear };
      }
    }
    return null;
  }

  return null;
}

function parse4Digits(str: string, i: number): number | null {
  const c0 = str.charCodeAt(i) - 48,
    c1 = str.charCodeAt(i + 1) - 48;
  const c2 = str.charCodeAt(i + 2) - 48,
    c3 = str.charCodeAt(i + 3) - 48;
  if ((c0 | c1 | c2 | c3) & ~9) {
    return null;
  }
  return (c0 * 10 + c1) * 100 + (c2 * 10 + c3);
}

function parse2Digits(str: string, i: number): number | null {
  const c0 = str.charCodeAt(i) - 48,
    c1 = str.charCodeAt(i + 1) - 48;
  if ((c0 | c1) & ~9) {
    return null;
  }
  return c0 * 10 + c1;
}

function _parseCommonISODate(str: string, len: number, year: number): InternalParsedData | null {
  const month1 = parse2Digits(str, 5);
  if (month1 === null) {
    return null;
  }
  const day = parse2Digits(str, 8);
  if (day === null) {
    return null;
  }
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
  const hour = parse2Digits(str, 11);
  if (hour === null) {
    return null;
  }
  const minute = parse2Digits(str, 14);
  if (minute === null) {
    return null;
  }
  const second = parse2Digits(str, 17);
  if (second === null) {
    return null;
  }
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

function parseCommonISO(str: string): InternalParsedData | null {
  const len = str.length;
  if (len !== 10 && (len < 19 || len > 29)) {
    return null;
  }
  if (str.charCodeAt(4) !== 45 || str.charCodeAt(7) !== 45) {
    return null;
  }
  const year = parse4Digits(str, 0);
  if (year === null) {
    return null;
  }
  return _parseCommonISODate(str, len, year);
}

function getSeenUnusedTokens(ctx: ParseCtx): Set<string> {
  let seen = ctx._seenUnusedTokens;
  if (!seen) {
    seen = new Set<string>();
    ctx._seenUnusedTokens = seen;
  }
  return seen;
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

  const ops = compileFormatToOpcodes(format);

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
    ops,
  };

  for (const op of ops) {
    tokenIndex++;
    ctx.tokenIndex = tokenIndex;
    ctx.strIdx = strIdx;
    ctx.failed = false;

    if (strIdx > str.length) {
      break;
    }

    if (op.kind === "literal") {
      const val = op.value;
      if (!val) {
        continue;
      }

      if (strIdx >= str.length) {
        for (let j = tokenIndex; j < ops.length; j++) {
          const o = ops[j];
          if (o.kind === "token") {
            result._unusedTokens.push(o.name);
          } else if (o.value.trim()) {
            result._unusedTokens.push(o.value.trim());
          } else if (!strict && o.value && /[A-Za-z]/.test(o.value.trim())) {
            result._unusedTokens.push(o.value.trim());
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
      for (let j = tokenIndex; j < ops.length; j++) {
        const o = ops[j];
        if (o.kind === "token") {
          result._unusedTokens.push(o.name);
        } else if (o.value.trim()) {
          result._unusedTokens.push(o.value.trim());
        } else if (!strict && o.value && /[A-Za-z]/.test(o.value.trim())) {
          result._unusedTokens.push(o.value.trim());
        }
      }
      break;
    }

    // Pre-scan: skip non-matching chars for lenient parsing
    if (!strict) {
      const nameToken =
        op.name === "MMMM" ||
        op.name === "MMM" ||
        op.name === "dddd" ||
        op.name === "ddd" ||
        op.name === "dd" ||
        op.name === "Do";
      const digitLike = /^[YMDWHhmsSXxk]/.test(op.name) && !nameToken;
      if (digitLike) {
        const canHandleSign =
          (op.name === "YYYYYY" ||
            op.name === "YYYYY" ||
            op.name === "YYYY" ||
            op.name === "yyyy" ||
            op.name === "Y") &&
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
        op.name === "MMMM" ||
        op.name === "MMM" ||
        op.name === "dddd" ||
        op.name === "ddd" ||
        op.name === "dd"
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
      } else if (op.name === "A" || op.name === "a") {
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
    ctx.strIdx = strIdx;
    (op as Op & { kind: "token" }).handler(ctx);
    strIdx = ctx.strIdx;
    failed = ctx.failed;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (failed) {
      if (strict) {
        for (let j = tokenIndex; j < ops.length; j++) {
          const o = ops[j];
          if (o.kind === "token") {
            const seenUnusedTokens = getSeenUnusedTokens(ctx);
            if (!seenUnusedTokens.has(o.name)) {
              seenUnusedTokens.add(o.name);
              result._unusedTokens.push(o.name);
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
          } else if (o.value.trim()) {
            const trimmed = o.value.trim();
            const seenUnusedTokens = getSeenUnusedTokens(ctx);
            if (!seenUnusedTokens.has(trimmed)) {
              seenUnusedTokens.add(trimmed);
              result._unusedTokens.push(trimmed);
            }
          } else if (
            o.value &&
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
      result._unusedTokens.push(op.name);
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
      for (let j = tokenIndex; j < ops.length; j++) {
        const o = ops[j];
        if (o.kind === "token") {
          const seenUnusedTokens = getSeenUnusedTokens(ctx);
          if (!seenUnusedTokens.has(o.name)) {
            seenUnusedTokens.add(o.name);
            result._unusedTokens.push(o.name);
          }
        } else if (o.value.trim()) {
          const trimmed = o.value.trim();
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
  if (len === 11 && (ch0 === 43 || ch0 === 45)) {
    return ["YYYYYYMMDD", true];
  }
  if (len === 10 && (ch0 === 43 || ch0 === 45)) {
    return ["YYYYMMDD", true];
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

function matchFixedDigitsAnywhere(
  str: string,
  start: number,
  count: number,
): { value: number; next: number } | null {
  for (let i = start; i + count <= str.length; i++) {
    let value = 0;
    let ok = true;
    for (let j = 0; j < count; j++) {
      const c = str.charCodeAt(i + j) - 48;
      if (c < 0 || c > 9) {
        ok = false;
        break;
      }
      value = value * 10 + c;
    }
    if (ok) {
      return { value, next: i + count };
    }
  }
  return null;
}

function trySignPrefixedDateFallback(datePart: string): InternalParsedData | null {
  const sign = datePart.charCodeAt(0);
  if ((sign !== 43 && sign !== 45) || datePart.length < 2) {
    return null;
  }
  const body = datePart.slice(1);
  const hasDash = body.includes("-");
  const candidates = hasDash
    ? ["YYYY-MM-DD", "YYYY-MM", "YYYY-DDD"]
    : ["YYYYMMDD", "YYYYMM", "YYYYDDD"];

  for (const fmt of candidates) {
    let pos = 0;
    let year: number | undefined;
    let month: number | undefined;
    let day: number | undefined;
    let dayOfYear: number | undefined;
    let ok = true;

    for (let i = 0; i < fmt.length; ) {
      if (fmt.startsWith("YYYY", i)) {
        const found = matchFixedDigitsAnywhere(body, pos, 4);
        if (!found) {
          ok = false;
          break;
        }
        year = found.value;
        pos = found.next;
        i += 4;
        continue;
      }
      if (fmt.startsWith("DDD", i)) {
        const found = matchFixedDigitsAnywhere(body, pos, 3);
        if (!found) {
          ok = false;
          break;
        }
        dayOfYear = found.value;
        pos = found.next;
        i += 3;
        continue;
      }
      if (fmt.startsWith("MM", i)) {
        const found = matchFixedDigitsAnywhere(body, pos, 2);
        if (!found) {
          ok = false;
          break;
        }
        month = found.value - 1;
        pos = found.next;
        i += 2;
        continue;
      }
      if (fmt.startsWith("DD", i)) {
        const found = matchFixedDigitsAnywhere(body, pos, 2);
        if (!found) {
          ok = false;
          break;
        }
        day = found.value;
        pos = found.next;
        i += 2;
        continue;
      }
      const literalPos = body.indexOf(fmt[i], pos);
      if (literalPos < 0) {
        ok = false;
        break;
      }
      pos = literalPos + 1;
      i++;
    }

    if (!ok || year === undefined) {
      continue;
    }
    if (month !== undefined && (month < 0 || month > 11)) {
      continue;
    }
    if (day !== undefined && (day < 1 || day > 31)) {
      continue;
    }
    if (dayOfYear !== undefined && (dayOfYear < 1 || dayOfYear > 366)) {
      continue;
    }
    // Reject if dayOfYear but no dash in format leaves unmatched content
    // (prevents +085501-757 being parsed as year=855, dayOfYear=1 which
    //  moment.js rejects because its non-anchored DDD regex matches `01`
    //  differently from our anchored fallback)
    if (dayOfYear !== undefined && dayOfYear < 1) {
      continue;
    }

    const parsedDateParts = [year];
    if (month !== undefined) {
      parsedDateParts.push(month);
    }
    if (day !== undefined) {
      parsedDateParts.push(day);
    }
    return {
      year,
      month,
      day,
      dayOfYear,
      _unusedTokens: [],
      _unusedInput: [],
      _charsLeftOver: 0,
      _empty: false,
      _invalidMonth: null,
      _parsedDateParts: parsedDateParts,
    };
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
    if (!match[3] && !match[4]) {
      const signFallback = trySignPrefixedDateFallback(datePart);
      if (signFallback) {
        return signFallback;
      }
    }
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

/** @public */
export { ISO_8601_REGEX };
