import { isArray, hasOwnProp } from "./utils";
import type { ParseLocale } from "./parse-locale";
import type { InternalParsedData } from "./types";
import { localePreparse } from "./locale-runtime";
import type { ParsedData } from "./parse";

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
const RFC_2822_REGEX =
  /^\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d{2}):(\d{2})(?::(\d{2}))?\s(?:([+-]\d{4})|(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[A-IK-Za-ik-z]))?/;
const JSON_DATE_REGEX = /^\/?Date\((-?\d+)(?:[+-]\d{4})?\)\/?$/;
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

const WEEKDAY_NAMES_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
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
  if (!locale) {
    return null;
  }

  if (format) {
    if (!customFormatParsingEnabled) {
      return null;
    }
    const preparsed = localePreparse(locale as never, str);
    if (isArray(format)) {
      return registeredFormatsParser?.(preparsed, format, locale, strict) ?? null;
    }
    return registeredFormatParser?.(preparsed, format, locale, strict) ?? null;
  }

  str = localePreparse(locale as never, str);
  if (str.trim() === "") {
    return null;
  }

  const jsonMatch = str.match(JSON_DATE_REGEX);
  if (jsonMatch) {
    const d = new Date(parseInt(jsonMatch[1], 10));
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
    };
  }

  const fast = parseCommonISOExtended(str);
  if (fast) {
    return fast;
  }

  const iso = parseISOWithTable(str);
  if (iso) {
    return iso._claimed ? ({ _claimed: true } as ParsedData) : (iso as ParsedData);
  }

  const rfc = parseRFC2822(str);
  if (rfc) {
    return rfc;
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
    if (c < 48 || c > 57) return false;
  }
  return true;
}
function numAt(str: string, idx: number, count: number): number {
  let v = 0;
  for (let i = 0; i < count; i++) v = v * 10 + (str.charCodeAt(idx + i) - 48);
  return v;
}

/** hot path: charCodeAt scan — zero regex/slice/parseInt allocation */
function parseCommonISOExtended(str: string): ParsedData | null {
  const len = str.length;
  const c0 = str.charCodeAt(0);
  if (c0 < 48 || c0 > 57) return null;
  if (len === 10 && str.charCodeAt(4) === 45 && str.charCodeAt(7) === 45 &&
      digitsAt(str, 1, 3) && digitsAt(str, 5, 2) && digitsAt(str, 8, 2)) {
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
    "SSSSSSSSS", "SSSSSSSS", "SSSSSSS", "SSSSSS", "SSSSS", "SSSS",
    "YYYYYY", "GGGG", "YYYY", "DDD", "HH", "mm", "ss", "WW", "MM", "DD",
    "SSS", "SS", "S", "E", "Z",
  ];
  // build longest-first per first char
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

function parseRFC2822(str: string): ParsedData | null {
  const match = str.match(RFC_2822_REGEX);
  if (!match) {
    return null;
  }
  const months: Record<string, number> = {
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
  const out = emptyParsed();
  let year = parseInt(match[4], 10);
  if (year < 100) {
    year += year > 68 ? 1900 : 2000;
  }
  out.year = year;
  out.month = months[match[3]];
  out.day = parseInt(match[2], 10);
  out.hour = parseInt(match[5], 10);
  out.minute = parseInt(match[6], 10);
  out.second = match[7] ? parseInt(match[7], 10) : 0;
  out.millisecond = 0;
  const tzStr = match[8] || match[9];
  if (tzStr) {
    const tzMap: Record<string, number | undefined> = {
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
    if (tzMap[tzStr] !== undefined) {
      out.offset = tzMap[tzStr];
    } else if (/^[+-]\d{4}$/.test(tzStr)) {
      const sign = tzStr[0] === "+" ? 1 : -1;
      out.offset = sign * (parseInt(tzStr.slice(1, 3), 10) * 60 + parseInt(tzStr.slice(3, 5), 10));
    }
  }
  if (match[1]) {
    out._weekdayName = String(WEEKDAY_NAMES_MAP[match[1].slice(0, 3).toLowerCase()]);
  }
  return out;
}

export function parseArray(arr: unknown[]): ParsedData | null {
  if (arr.length === 0) {
    return null;
  }
  for (const val of arr) {
    if (val === null || val === undefined || isNaN(Number(val))) {
      return null;
    }
  }
  return {
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
