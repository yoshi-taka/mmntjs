import { isArray } from "./utils";
import type { ParseLocale } from "./parse-locale";
import type { InternalParsedData } from "./types";
import { liteLocalePreparse } from "./locale-lite";
import type { ParsedData } from "./parse";
export type { ParsedData };

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

let registeredFormatParser: FormatParser | undefined;
let registeredFormatsParser: FormatsParser | undefined;

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
  registeredFormatParser = single;
  registeredFormatsParser = multi;
}

const EXTENDED_ISO_REGEX =
  /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
const BASIC_ISO_REGEX =
  /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d|))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
const TZ_REGEX = /Z|[+-]\d\d(?::?\d\d)?/;

const isoDates: [string, RegExp, boolean?][] = [
  ["YYYYYY-MM-DD", /[+-]\d{6}-\d\d-\d\d/],
  ["YYYY-MM-DD", /\d{4}-\d\d-\d\d/],
  ["GGGG-[W]WW-E", /\d{4}-W\d\d-\d/],
  ["GGGG-[W]WW", /\d{4}-W\d\d/, false],
  ["YYYY-DDD", /\d{4}-\d{3}/],
  ["YYYY-MM", /\d{4}-\d\d/, false],
  ["YYYYYYMMDD", /[+-]\d{10}/],
  ["YYYYMMDD", /\d{8}/],
  ["GGGG[W]WWE", /\d{4}W\d{3}/],
  ["GGGG[W]WW", /\d{4}W\d{2}/, false],
  ["YYYYDDD", /\d{7}/],
  ["YYYYMM", /\d{6}/, false],
  ["YYYY", /\d{4}/, false],
];
const isoTimes: [string, RegExp][] = [
  ["HH:mm:ss.SSSS", /\d\d:\d\d:\d\d\.\d+/],
  ["HH:mm:ss,SSSS", /\d\d:\d\d:\d\d,\d+/],
  ["HH:mm:ss", /\d\d:\d\d:\d\d/],
  ["HH:mm", /\d\d:\d\d/],
  ["HHmmss.SSSS", /\d\d\d\d\d\d\.\d+/],
  ["HHmmss,SSSS", /\d\d\d\d\d\d,\d+/],
  ["HHmmss", /\d\d\d\d\d\d/],
  ["HHmm", /\d\d\d\d/],
  ["HH", /\d\d/],
];

export function parseString(
  str: string,
  format?: string | string[],
  locale?: ParseLocale,
  strict?: boolean,
): ParsedData | null {
  if (typeof str !== "string") {
    return null;
  }
  if (!locale) {
    return null;
  }

  if (format) {
    if (!customFormatParsingEnabled) {
      return null;
    }
    const preparsed = liteLocalePreparse(locale as never, str);
    if (isArray(format)) {
      return registeredFormatsParser?.(preparsed, format, locale, strict) ?? null;
    }
    return registeredFormatParser?.(preparsed, format, locale, strict) ?? null;
  }

  str = liteLocalePreparse(locale as never, str);
  if (str.trim() === "") {
    return null;
  }

  const fast = parseCommonISOExtended(str);
  if (fast) {
    return fast;
  }

  const iso = parseISOWithTable(str);
  if (iso) {
    return iso._claimed ? ({ _claimed: true } as ParsedData) : (iso as ParsedData);
  }

  return null;
}

function emptyParsed(): ParsedData {
  return {
    _unusedTokens: [],
    _unusedInput: [],
    _charsLeftOver: 0,
    _empty: false,
    _invalidMonth: null,
    _parsedDateParts: [],
  };
}

function digitsAt(str: string, idx: number, count: number): boolean {
  for (let i = 0; i < count; i++) {
    const c = str.charCodeAt(idx + i);
    if (c < 48 || c > 57) {
      return false;
    }
  }
  return true;
}
function numAt(str: string, idx: number, count: number): number {
  let v = 0;
  for (let i = 0; i < count; i++) {
    v = v * 10 + (str.charCodeAt(idx + i) - 48);
  }
  return v;
}

/** hot path: charCodeAt scan — zero regex/slice/parseInt allocation */
function parseCommonISOExtended(str: string): ParsedData | null {
  const len = str.length;
  const c0 = str.charCodeAt(0);
  if (c0 < 48 || c0 > 57) {
    return null;
  }
  if (
    len === 10 &&
    str.charCodeAt(4) === 45 &&
    str.charCodeAt(7) === 45 &&
    digitsAt(str, 1, 3) &&
    digitsAt(str, 5, 2) &&
    digitsAt(str, 8, 2)
  ) {
    const out = emptyParsed();
    out.year = numAt(str, 0, 4);
    out.month = numAt(str, 5, 2) - 1;
    out.day = numAt(str, 8, 2);
    out._parsedDateParts = [out.year, out.month, out.day];
    return out;
  }
  if (len === 8 && digitsAt(str, 0, 8)) {
    const out = emptyParsed();
    out.year = numAt(str, 0, 4);
    out.month = numAt(str, 4, 2) - 1;
    out.day = numAt(str, 6, 2);
    out._parsedDateParts = [out.year, out.month, out.day];
    return out;
  }
  if (len === 8 && str.charCodeAt(4) === 45 && digitsAt(str, 0, 4) && digitsAt(str, 5, 3)) {
    const out = emptyParsed();
    out.year = numAt(str, 0, 4);
    out.dayOfYear = numAt(str, 5, 3);
    return out;
  }
  if (len === 7 && digitsAt(str, 0, 7)) {
    const out = emptyParsed();
    out.year = numAt(str, 0, 4);
    out.dayOfYear = numAt(str, 4, 3);
    return out;
  }
  return null;
}

function parseISOWithTable(str: string): InternalParsedData | null {
  const match = EXTENDED_ISO_REGEX.exec(str) ?? BASIC_ISO_REGEX.exec(str);
  if (!match) {
    return null;
  }
  const datePart = match[1];
  const dateHasDash = datePart.includes("-", datePart.charCodeAt(0) === 45 ? 1 : 0);
  let dateFormat: string | undefined;
  let allowTime = true;
  for (const [fmt, regex, allowT] of isoDates) {
    if (dateHasDash !== fmt.includes("-")) {
      continue;
    }
    if (regex.exec(datePart)) {
      dateFormat = fmt;
      allowTime = allowT !== false;
      break;
    }
  }
  if (!dateFormat) {
    return null;
  }
  if (match[3]) {
    if (!allowTime) {
      return { _claimed: true } as { _claimed: true };
    }
    let timeFormat: string | undefined;
    for (const [fmt, regex] of isoTimes) {
      if (regex.exec(match[3])) {
        timeFormat = fmt;
        break;
      }
    }
    if (!timeFormat) {
      return { _claimed: true } as { _claimed: true };
    }
    if (timeFormat.includes("SSSS")) {
      const fracPos = match[3].search(/[.,]/);
      if (fracPos >= 0) {
        timeFormat = timeFormat.replace("SSSS", "S".repeat(match[3].length - fracPos - 1));
      }
    }
    dateFormat += `${match[2] || " "}${timeFormat}`;
  }
  if (match[4] && !match[3]) {
    return { _claimed: true } as { _claimed: true };
  }
  if (match[4] && !TZ_REGEX.exec(match[4])) {
    return { _claimed: true } as { _claimed: true };
  }
  if (match[4]) {
    dateFormat += "Z";
  }
  return parseIsoTokenFormat(str, dateFormat) ?? ({ _claimed: true } as { _claimed: true });
}

function parseIsoTokenFormat(str: string, format: string): ParsedData | null {
  const out = emptyParsed();
  let pos = 0;
  let i = 0;
  while (i < format.length) {
    const token = nextIsoToken(format, i);
    i += token.length;
    switch (token) {
      case "YYYYYY": {
        const parsed = parseSignedYear(str, pos, 6);
        if (!parsed) {
          return null;
        }
        out.year = parsed.year;
        out._parsedDateParts[0] = parsed.year;
        pos = parsed.next;
        break;
      }
      case "YYYY":
      case "GGGG": {
        const parsed = parseDigits(str, pos, 4);
        if (parsed === null) {
          return null;
        }
        if (token === "YYYY") {
          out.year = parsed;
          out._parsedDateParts[0] = parsed;
        } else {
          out.isoWeekYear = parsed;
        }
        pos += 4;
        break;
      }
      case "MM":
      case "DD":
      case "HH":
      case "mm":
      case "ss":
      case "WW": {
        const parsed = parseDigits(str, pos, 2);
        if (parsed === null) {
          return null;
        }
        if (token === "MM") {
          out.month = parsed - 1;
          out._parsedDateParts[1] = out.month;
        } else if (token === "DD") {
          out.day = parsed;
          out._parsedDateParts[2] = parsed;
        } else if (token === "HH") {
          out.hour = parsed;
          out._parsedDateParts[3] = parsed;
        } else if (token === "mm") {
          out.minute = parsed;
          out._parsedDateParts[4] = parsed;
        } else if (token === "ss") {
          out.second = parsed;
          out._parsedDateParts[5] = parsed;
        } else {
          out.isoWeek = parsed;
        }
        pos += 2;
        break;
      }
      case "DDD": {
        const parsed = parseDigits(str, pos, 3);
        if (parsed === null) {
          return null;
        }
        out.dayOfYear = parsed;
        pos += 3;
        break;
      }
      case "E": {
        const parsed = parseDigits(str, pos, 1);
        if (parsed === null) {
          return null;
        }
        out._weekdayNum = parsed;
        pos += 1;
        break;
      }
      case "S":
      case "SS":
      case "SSS":
      case "SSSS":
      case "SSSSS":
      case "SSSSSS":
      case "SSSSSSS":
      case "SSSSSSSS":
      case "SSSSSSSSS": {
        const digits = token.length;
        const value = str.slice(pos, pos + digits);
        if (!/^\d+$/.test(value)) {
          return null;
        }
        out.millisecond = parseInt(value.slice(0, 3).padEnd(3, "0"), 10);
        out._parsedDateParts[6] = out.millisecond;
        pos += digits;
        break;
      }
      case "Z": {
        const offset = parseOffset(str, pos);
        if (!offset) {
          return null;
        }
        out.offset = offset.offset;
        pos = offset.next;
        break;
      }
      default:
        if (!str.startsWith(token, pos)) {
          return null;
        }
        pos += token.length;
        break;
    }
  }
  return pos === str.length ? out : null;
}

/** hot path: pre-built first-char lookup — avoids linear scan per token */
const _isoTokenByChar: Record<string, string[] | undefined> = {};
{
  const tokens = [
    "SSSSSSSSS",
    "SSSSSSSS",
    "SSSSSSS",
    "SSSSSS",
    "SSSSS",
    "SSSS",
    "YYYYYY",
    "GGGG",
    "YYYY",
    "DDD",
    "HH",
    "mm",
    "ss",
    "WW",
    "MM",
    "DD",
    "SSS",
    "SS",
    "S",
    "E",
    "Z",
  ];
  for (const t of tokens) {
    const c = t[0];
    let list = _isoTokenByChar[c];
    if (!list) {
      list = [];
      _isoTokenByChar[c] = list;
    }
    list.push(t);
  }
  for (const c of Object.keys(_isoTokenByChar)) {
    _isoTokenByChar[c]!.sort((a, b) => b.length - a.length);
  }
}

function nextIsoToken(format: string, idx: number): string {
  const candidates = _isoTokenByChar[format[idx]];
  if (candidates) {
    for (const token of candidates) {
      if (format.startsWith(token, idx)) {
        return token;
      }
    }
  }
  return format[idx] ?? "";
}

/** hot path: charCodeAt scan — zero RegExp or slice allocation */
function parseDigits(str: string, idx: number, count: number): number | null {
  if (idx + count > str.length) {
    return null;
  }
  let value = 0;
  for (let i = 0; i < count; i++) {
    const c = str.charCodeAt(idx + i);
    if (c < 48 || c > 57) {
      return null;
    }
    value = value * 10 + (c - 48);
  }
  return value;
}

function parseSignedYear(
  str: string,
  idx: number,
  digits: number,
): { year: number; next: number } | null {
  let pos = idx;
  let sign = 1;
  if (str[pos] === "+" || str[pos] === "-") {
    sign = str[pos] === "-" ? -1 : 1;
    pos++;
  }
  const value = parseDigits(str, pos, digits);
  return value === null ? null : { year: sign * value, next: pos + digits };
}

function parseOffset(str: string, idx: number): { offset: number; next: number } | null {
  if (str[idx] === "Z") {
    return { offset: 0, next: idx + 1 };
  }
  const signCh = str[idx];
  if (signCh !== "+" && signCh !== "-") {
    return null;
  }
  const sign = signCh === "+" ? 1 : -1;
  const hh = parseDigits(str, idx + 1, 2);
  if (hh === null) {
    return null;
  }
  if (str[idx + 3] === ":") {
    const mm = parseDigits(str, idx + 4, 2);
    return mm === null ? null : { offset: sign * (hh * 60 + mm), next: idx + 6 };
  }
  const mm = parseDigits(str, idx + 3, 2);
  return mm === null ? null : { offset: sign * (hh * 60 + mm), next: idx + 5 };
}

export function parseTwoDigitYear(str: string): number {
  const num = parseInt(str, 10);
  return num > 68 ? 1900 + num : 2000 + num;
}
