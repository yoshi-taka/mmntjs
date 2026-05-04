import {
  isArray,
  hasOwnProp,
  escapeRegex,
  LruMap,
} from "./utils";
import type { Locale } from "./locale";
import { getCurrentLocale, getLocale } from "./locale";

export let parseTwoDigitYearFn: ((input: string) => number) | undefined;

export function setParseTwoDigitYear(fn: ((input: string) => number) | undefined): void {
  parseTwoDigitYearFn = fn;
}

const ISO_8601_REGEX =
  /^\s*([+-]?\d{4,})(-?(\d{2})(-?(\d{2})([T ](\d{2})(:?(\d{2})(:?(\d{2})([.,](\d+))?)?)?\s*(Z|([+-])(\d{2})(:?(\d{2}))?)?)?)?)?\s*$/;

const TIME_REGEX = /^\s*(\d{2})(:?(\d{2})(:?(\d{2})(\.(\d+))?)?)?\s*$/;

const RFC_2822_REGEX =
  /^\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d{2}):(\d{2})(?::(\d{2}))?\s(?:([+-]\d{4})|(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[A-IK-Za-ik-z]))?/;

const ISO_WEEK_REGEX =
  /^\s*(\d{4})-?W(\d{2})(?:-?(\d))?([T ](\d{2})(:?(\d{2})(:?(\d{2})([.,](\d+))?)?)?\s*(Z|([+-])(\d{2})(:?(\d{2}))?)?)?\s*$/;

const ISO_WEEK_SIMPLE_REGEX = /^\s*(\d{4})-?W(\d{2})(?:-?(\d))?\s*$/;

const ISO_ORDINAL_REGEX =
  /^\s*(\d{4})-(\d{3})([T ](\d{2})(:?(\d{2})(:?(\d{2})([.,](\d+))?)?)?\s*(Z|([+-])(\d{2})(:?(\d{2}))?)?)?\s*$/;
const ISO_ORDINAL_COMPACT_REGEX =
  /^\s*(\d{4})(\d{3})([T ](\d{2})(:?(\d{2})(:?(\d{2})([.,](\d+))?)?)?\s*(Z|([+-])(\d{2})(:?(\d{2}))?)?)?\s*$/;

const JSON_DATE_REGEX = /^\/?Date\((-?\d+)(?:[+-]\d{4})?\)\/?\s*$/;

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
  locale?: string,
  strict?: boolean,
): any {
  if (typeof str !== "string") return null;

  if (!format && (locale === "en" || (locale === undefined && getCurrentLocale() === "en"))) {
    const fast = parseCommonISO(str);
    if (fast) return fast;
  }

  const locObj = getLocale(locale);

  if (format) {
    const preparsed = locObj.preparse(str);
    if (isArray(format)) {
      return parseWithFormats(preparsed, format as string[], locale, strict);
    }
    return parseWithFormat(preparsed, format as string, locale, strict);
  }

  str = locObj.preparse(str);
  const trimmed = str.trim();

  if (trimmed === "") return null;

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
    };
  }

  let weekMatch = trimmed.match(ISO_WEEK_REGEX);
  if (!weekMatch) {
    weekMatch = trimmed.match(ISO_WEEK_SIMPLE_REGEX);
  }
  if (weekMatch && weekMatch[1] && weekMatch[2]) {
    return parseISOWeek(weekMatch);
  }

  const ordinalMatch = trimmed.match(ISO_ORDINAL_REGEX) || trimmed.match(ISO_ORDINAL_COMPACT_REGEX);
  if (ordinalMatch && ordinalMatch[1] && ordinalMatch[2]) {
    const ordinalResult = parseISOOrdinal(ordinalMatch);
    if (ordinalResult) return ordinalResult;
  }

  const isoMatch = trimmed.match(ISO_8601_REGEX);
  if (isoMatch && isoMatch[1]) {
    return parseISO8601(isoMatch);
  }

  let rfcStr = stripRFC2822Comments(trimmed);
  let rfcMatch = rfcStr.match(RFC_2822_REGEX);
  if (!rfcMatch) {
    rfcMatch = trimmed.match(RFC_2822_REGEX);
  }
  if (rfcMatch) {
    return parseRFC2822(rfcMatch);
  }

  const timeMatch = trimmed.match(TIME_REGEX);
  if (timeMatch && timeMatch[1]) {
    return parseTime(timeMatch);
  }

  return null;
}

function two(str: string, i: number): number {
  const a = str.charCodeAt(i) - 48;
  const b = str.charCodeAt(i + 1) - 48;
  if (a < 0 || a > 9 || b < 0 || b > 9) return NaN;
  return a * 10 + b;
}

function four(str: string, i: number): number {
  const a = two(str, i);
  const b = two(str, i + 2);
  if (isNaN(a) || isNaN(b)) return NaN;
  return a * 100 + b;
}

function parseCommonISO(str: string): any {
  const len = str.length;
  if (len !== 10 && len !== 19 && len !== 20 && len !== 23 && len !== 24 && len !== 25 && len !== 29) {
    return null;
  }
  if (str.charCodeAt(4) !== 45 || str.charCodeAt(7) !== 45) return null;
  const year = four(str, 0);
  const month1 = two(str, 5);
  const day = two(str, 8);
  if (isNaN(year) || isNaN(month1) || isNaN(day)) return null;
  if (len === 10) {
    return { year, month: month1 - 1, day, _hasDate: true, _hasTime: false };
  }
  const sep = str.charCodeAt(10);
  if (sep !== 84 && sep !== 32) return null;
  if (str.charCodeAt(13) !== 58 || str.charCodeAt(16) !== 58) return null;
  const hour = two(str, 11);
  const minute = two(str, 14);
  const second = two(str, 17);
  if (isNaN(hour) || isNaN(minute) || isNaN(second)) return null;

  let millisecond: number | undefined;
  let pos = 19;
  if (pos < len && str.charCodeAt(pos) === 46) {
    millisecond = 0;
    let scale = 100;
    pos++;
    const fracStart = pos;
    while (pos < len) {
      const code = str.charCodeAt(pos);
      if (code < 48 || code > 57) break;
      if (scale > 0) {
        millisecond += (code - 48) * scale;
        scale = Math.floor(scale / 10);
      }
      pos++;
    }
    if (pos === fracStart) return null;
  }

  let offset: number | undefined;
  if (pos < len) {
    const tz = str.charCodeAt(pos);
    if (tz === 90) {
      offset = 0;
      pos++;
    } else if (tz === 43 || tz === 45) {
      if (pos + 6 !== len || str.charCodeAt(pos + 3) !== 58) return null;
      const offHour = two(str, pos + 1);
      const offMin = two(str, pos + 4);
      if (isNaN(offHour) || isNaN(offMin)) return null;
      offset = (tz === 43 ? 1 : -1) * (offHour * 60 + offMin);
      pos += 6;
    } else {
      return null;
    }
  }
  if (pos !== len) return null;

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

function stripRFC2822Comments(str: string): string {
  let result = "";
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "(") {
      depth++;
    } else if (str[i] === ")") {
      depth--;
      if (depth < 0) depth = 0;
    } else if (depth === 0) {
      result += str[i];
    }
  }
  return result.replaceAll(/\s+/g, " ").trim();
}

function parseRFC2822(match: RegExpMatchArray): any {
  const day = parseInt(match[2], 10);
  const monthStr = match[3];
  const yearStr = match[4];
  const hour = parseInt(match[5], 10);
  const minute = parseInt(match[6], 10);
  const second = match[7] ? parseInt(match[7], 10) : 0;
  const tzStr = match[8] || match[9];

  const monthMap: Record<string, number> = {
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

  const month = monthMap[monthStr];
  if (month === undefined) return null;

  let year = parseInt(yearStr, 10);
  if (yearStr.length === 2) {
    year = year > 68 ? 1900 + year : 2000 + year;
  }

  let offset = 0;
  if (tzStr) {
    const tzMap: Record<string, number> = {
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
      offset = tzMap[tzStr];
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

  return { year, month, day, hour, minute, second, millisecond: 0, offset, _weekdayName: weekday };
}

function parseISO8601(match: RegExpMatchArray): any {
  let yearStr = match[1];
  let year = parseInt(yearStr, 10);
  let month = match[3] ? parseInt(match[3], 10) - 1 : 0;
  let day = match[5] ? parseInt(match[5], 10) : 1;
  let _hasDate = match[3] !== undefined;
  if (!_hasDate && yearStr.length >= 8 && !yearStr.startsWith("+") && !yearStr.startsWith("-")) {
    year = parseInt(yearStr.substring(0, 4), 10);
    month = parseInt(yearStr.substring(4, 6), 10) - 1;
    day = parseInt(yearStr.substring(6, 8), 10);
    _hasDate = true;
  }
  const _hasTime = match[7] !== undefined;
  const hour = _hasTime ? parseInt(match[7], 10) : undefined;
  const minute = match[9] !== undefined ? parseInt(match[9], 10) : undefined;
  const second = match[11] !== undefined ? parseInt(match[11], 10) : undefined;
  let millisecond = match[13] !== undefined ? parseInt(match[13].padEnd(3, "0"), 10) : undefined;
  const tz = match[14];
  const tzSign = match[15];
  const tzHour = match[16] ? parseInt(match[16], 10) : 0;
  const tzMinute = match[18] ? parseInt(match[18], 10) : 0;

  let offset: number | undefined = undefined;
  if (tz === "Z") {
    offset = 0;
  } else if (tzSign) {
    offset = (tzSign === "+" ? 1 : -1) * (tzHour * 60 + tzMinute);
  }

  return { year, month, day, hour, minute, second, millisecond, offset, _hasDate, _hasTime };
}

function parseISOWeek(match: RegExpMatchArray): any {
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const day = match[3] ? parseInt(match[3], 10) : 1;
  const parsedWeekdayNum = match[3] ? parseInt(match[3], 10) : 1;
  const hour = match[5] ? parseInt(match[5], 10) : 0;
  const minute = match[7] ? parseInt(match[7], 10) : 0;
  const second = match[9] ? parseInt(match[9], 10) : 0;
  let millisecond = match[11] ? parseInt(match[11].padEnd(3, "0"), 10) : 0;
  const tz = match[12];
  const tzSign = match[13];
  const tzHour = match[14] ? parseInt(match[14], 10) : 0;
  const tzMinute = match[16] ? parseInt(match[16], 10) : 0;

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(Date.UTC(year, 0, 4 - (dow - 1)));
  const date = new Date(mondayOfWeek1.getTime() + ((week - 1) * 7 + (day - 1)) * 86400000);

  let offset: number | undefined = undefined;
  if (tz === "Z") {
    offset = 0;
  } else if (tzSign) {
    offset = (tzSign === "+" ? 1 : -1) * (tzHour * 60 + tzMinute);
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    hour,
    minute,
    second,
    millisecond,
    offset,
    isoWeekYear: year,
    isoWeek: week,
    _isoWeekNum: week,
    _weekdayNum: parsedWeekdayNum,
  };
}

function parseISOOrdinal(match: RegExpMatchArray): any {
  const year = parseInt(match[1], 10);
  const dayOfYear = parseInt(match[2], 10);
  if (dayOfYear === 0) return null;
  const hour = match[4] ? parseInt(match[4], 10) : 0;
  const minute = match[6] ? parseInt(match[6], 10) : 0;
  const second = match[8] ? parseInt(match[8], 10) : 0;
  let millisecond = match[10] ? parseInt(match[10].padEnd(3, "0"), 10) : 0;
  const tz = match[11];
  const tzSign = match[12];
  const tzHour = match[13] ? parseInt(match[13], 10) : 0;
  const tzMinute = match[15] ? parseInt(match[15], 10) : 0;

  const date = new Date(Date.UTC(year, 0, dayOfYear));

  let offset: number | undefined = undefined;
  if (tz === "Z") {
    offset = 0;
  } else if (tzSign) {
    offset = (tzSign === "+" ? 1 : -1) * (tzHour * 60 + tzMinute);
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    hour,
    minute,
    second,
    millisecond,
    offset,
  };
}

function parseTime(match: RegExpMatchArray): any {
  const hour = parseInt(match[1], 10);
  const minute = match[3] ? parseInt(match[3], 10) : 0;
  const second = match[5] ? parseInt(match[5], 10) : 0;
  const millisecond = match[7] ? parseInt(match[7].padEnd(3, "0"), 10) : 0;

  if (hour > 23 || minute > 59 || second > 59) return null;

  return { hour, minute, second, millisecond };
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

function addCharVariants(names: string[]): string[] {
  const result: string[] = [...names];
  for (const name of names) {
    if (name.includes('\u02BC')) {
      result.push(name.replaceAll('ʼ', "'"));
    }
    if (name.includes("'")) {
      result.push(name.replaceAll('\'', '\u02BC'));
    }
  }
  return result;
}

function getMonthExtraNames(loc: Locale): string[] {
  const cfg = (loc as any)._config;
  const monthsConfig = cfg.months;
  const extra: string[] = [];
  if (typeof monthsConfig === 'object' && monthsConfig !== null && !Array.isArray(monthsConfig)) {
    const fmt = monthsConfig.format;
    if (Array.isArray(fmt)) {
      const formatLower = fmt.map((m: string) => m.toLowerCase());
      extra.push(...formatLower);
    }
  } else if (typeof monthsConfig === 'function') {
    for (let i = 0; i < 12; i++) {
      const fakeM = { month: () => i } as any;
      try {
        const name = monthsConfig.call(loc._config, fakeM, 'DD MMMM YYYY');
        if (typeof name === 'string') {
          extra.push(name.toLowerCase());
        }
      } catch {}
    }
  }
  return extra;
}

function getLocaleMonthsFull(loc: Locale): string[] {
  if ((loc as any)._monthsCache) return (loc as any)._monthsCache;
  const months = loc.months();
  const monthsArr = Array.isArray(months) ? months : [];
  const lower = monthsArr.map((m: string) => m.toLowerCase());
  const extraNames = getMonthExtraNames(loc);
  const allFull = [...new Set(addCharVariants([...lower, ...extraNames]))];
  (loc as any)._monthsCache = lower;
  (loc as any)._monthsStrictRegex = new RegExp(`^(${  sortByLengthDesc(allFull).map(escapeRegex).join("|")  })`, "i");
  const monthsShort = loc.monthsShort && loc.monthsShort();
  const shortArr = Array.isArray(monthsShort) ? monthsShort : [];
  const shortLower = shortArr.map((m: string) => m.toLowerCase());
  // Strip trailing periods from short months for matching
  const shortNoPeriod = shortLower.map((m: string) => m.replace(/\.$/, '')).filter((m) => m.length > 0);
  const all = [...new Set(addCharVariants([...allFull, ...shortLower, ...shortNoPeriod]))];
  (loc as any)._monthsRegex = new RegExp(`^(${  sortByLengthDesc(all).map(escapeRegex).join("|")  })`, "i");
  return lower;
}

function getLocaleMonthsFullRegex(loc: Locale, strict?: boolean): RegExp {
  if (strict) {
    if ((loc as any)._monthsStrictRegex) return (loc as any)._monthsStrictRegex;
    getLocaleMonthsFull(loc);
    return (loc as any)._monthsStrictRegex;
  }
  if ((loc as any)._monthsRegex) return (loc as any)._monthsRegex;
  getLocaleMonthsFull(loc);
  return (loc as any)._monthsRegex;
}

function getLocaleMonthsShort(loc: Locale): string[] {
  if ((loc as any)._monthsShortCache) return (loc as any)._monthsShortCache;
  const monthsShort = loc.monthsShort && loc.monthsShort();
  let shortArr = Array.isArray(monthsShort) ? monthsShort : [];
  const lower = shortArr.map((m: string) => m.toLowerCase());
  (loc as any)._monthsShortCache = lower;
  const noPeriod = lower.map(m => m.replace(/\.$/, '')).filter(m => m.length > 0);
  const allStrict = [...new Set(addCharVariants([...lower, ...noPeriod]))];
  (loc as any)._monthsShortStrictRegex = new RegExp(`^(${  sortByLengthDesc(allStrict).map(escapeRegex).join("|")  })`, "i");
  if (lower.length === 0) return getLocaleMonthsFull(loc);
  return lower;
}

function getLocaleMonthsShortRegex(loc: Locale, strict?: boolean): RegExp {
  if (strict) {
    if ((loc as any)._monthsShortStrictRegex) return (loc as any)._monthsShortStrictRegex;
    getLocaleMonthsShort(loc);
    return (loc as any)._monthsShortStrictRegex;
  }
  if ((loc as any)._monthsShortRegex) return (loc as any)._monthsShortRegex;
  const shortList = getLocaleMonthsShort(loc);
  const fullList = getLocaleMonthsFull(loc);
  const extraNames = getMonthExtraNames(loc);
  const noPeriod = shortList.map(m => m.replace(/\.$/, '')).filter(m => m.length > 0);
  const all = [...new Set(addCharVariants([...shortList, ...fullList, ...extraNames, ...noPeriod]))];
  (loc as any)._monthsShortRegex = new RegExp(`^(${  sortByLengthDesc(all).map(escapeRegex).join("|")  })`, "i");
  return (loc as any)._monthsShortRegex;
}

function sortByLengthDesc(arr: string[]): string[] {
  return [...arr].sort((a, b) => b.length - a.length);
}

function getLocaleWeekdaysFull(loc: Locale): string[] {
  if ((loc as any)._weekdaysCache) return (loc as any)._weekdaysCache;
  const cfg = (loc as any)._config;
  let names: string[] = [];
  if (Array.isArray(cfg.weekdays)) {
    names = cfg.weekdays;
  } else if (typeof cfg.weekdays === "object" && cfg.weekdays !== null) {
    const standalone = (cfg.weekdays as any).standalone || [];
    const format = (cfg.weekdays as any).format || [];
    names = [...new Set([...standalone, ...format])];
  } else if (typeof cfg.weekdays === "function") {
    for (let i = 0; i < 7; i++) {
      try {
        const r = cfg.weekdays({ day: () => i } as any, "dddd");
        if (typeof r === "string") names.push(r);
      } catch {}
    }
  }
  const lower = names.map((m: string) => m.toLowerCase());
  (loc as any)._weekdaysCache = lower;
  const all = [...new Set(addCharVariants(lower))];
  (loc as any)._weekdaysRegex = new RegExp(`^(${  sortByLengthDesc(all).map(escapeRegex).join("|")  })`, "i");
  return lower;
}

function getLocaleWeekdaysFullRegex(loc: Locale): RegExp {
  if ((loc as any)._weekdaysRegex) return (loc as any)._weekdaysRegex;
  getLocaleWeekdaysFull(loc);
  return (loc as any)._weekdaysRegex;
}

function getLocaleWeekdaysShort(loc: Locale): string[] {
  if ((loc as any)._weekdaysShortCache) return (loc as any)._weekdaysShortCache;
  const cfg = (loc as any)._config;
  let names: string[] = [];
  if (Array.isArray(cfg.weekdaysShort)) {
    names = cfg.weekdaysShort;
  } else if (typeof cfg.weekdaysShort === "object" && cfg.weekdaysShort !== null) {
    const standalone = (cfg.weekdaysShort as any).standalone || [];
    const format = (cfg.weekdaysShort as any).format || [];
    names = [...new Set([...standalone, ...format])];
  } else {
    return getLocaleWeekdaysFull(loc);
  }
  const lower = names.map((m: string) => m.toLowerCase());
  (loc as any)._weekdaysShortCache = lower;
  const all = [...new Set(addCharVariants(lower))];
  (loc as any)._weekdaysShortRegex = new RegExp(`^(${  sortByLengthDesc(all).map(escapeRegex).join("|")  })`, "i");
  return lower;
}

function getLocaleWeekdaysShortRegex(loc: Locale): RegExp {
  if ((loc as any)._weekdaysShortRegex) return (loc as any)._weekdaysShortRegex;
  getLocaleWeekdaysShort(loc);
  return (loc as any)._weekdaysShortRegex;
}

function getLocaleWeekdaysMin(loc: Locale): string[] {
  if ((loc as any)._weekdaysMinCache) return (loc as any)._weekdaysMinCache;
  const cfg = (loc as any)._config;
  let names: string[] = [];
  if (Array.isArray(cfg.weekdaysMin)) {
    names = cfg.weekdaysMin;
  } else if (typeof cfg.weekdaysMin === "object" && cfg.weekdaysMin !== null) {
    const standalone = (cfg.weekdaysMin as any).standalone || [];
    const format = (cfg.weekdaysMin as any).format || [];
    names = [...new Set([...standalone, ...format])];
  } else {
    return getLocaleWeekdaysShort(loc);
  }
  const lower = names.map((m: string) => m.toLowerCase());
  (loc as any)._weekdaysMinCache = lower;
  const all = [...new Set(addCharVariants(lower))];
  (loc as any)._weekdaysMinRegex = new RegExp(`^(${  sortByLengthDesc(all).map(escapeRegex).join("|")  })`, "i");
  return lower;
}

function getLocaleWeekdaysMinRegex(loc: Locale): RegExp {
  if ((loc as any)._weekdaysMinRegex) return (loc as any)._weekdaysMinRegex;
  getLocaleWeekdaysMin(loc);
  return (loc as any)._weekdaysMinRegex;
}

function timedMatch(
  remaining: string,
  pattern: RegExp,
  exactLen?: number,
  strict?: boolean,
): RegExpMatchArray | null {
  const match = remaining.match(pattern);
  if (!match) return null;
  if (strict && exactLen !== undefined && match[1].length !== exactLen) return null;
  if (strict && exactLen === undefined && match[1].length > 2) return null;
  return match;
}

const expandedFormatCache = new LruMap<string, string>(500);

function skipToNext(
  str: string,
  test: (ch: string) => boolean,
): number {
  for (let i = 0; i < str.length; i++) {
    if (test(str[i])) return i;
  }
  return -1;
}

function parseWithFormat(
  str: string,
  format: string,
  locale?: string,
  strict?: boolean,
): any {

  const loc = getLocale(locale);
  const expandedCacheKey = `${locale || "en"  }:${  format}`;
  let expandedFormat = expandedFormatCache.get(expandedCacheKey);
  if (!expandedFormat) {
    expandedFormat = format.replaceAll(/LTS|LT|llll|LLLL|lll|LLL|ll|LL|l|L/g, (match) => {
      return loc.longDateFormat(match);
    });
    expandedFormatCache.set(expandedCacheKey, expandedFormat);
  }
  format = expandedFormat;

  const tokens = tokenizeFormat(format);

  const result: any = {
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
    _parsedDateParts: [] as any[],
    _meridiem: undefined as string | undefined,
  };
  const _seenUnusedTokens = new Set<string>();

  let strIdx = 0;
  let failed = false;
  let failedAt = -1;
  let tokenIndex = -1;

  for (const token of tokens) {
    tokenIndex++;
    if (strIdx > str.length) {
      break;
    }

    if (token.type === "literal") {
      const val = token.value || "";
      if (!val) continue;

      if (strIdx >= str.length) {
        for (let j = tokenIndex; j < tokens.length; j++) {
          const t = tokens[j];
          if (t.type === "token") result._unusedTokens.push(t.name!);
          else if (strict && t.value && t.value.trim()) result._unusedTokens.push(t.value.trim());
          else if (!strict && t.value && /[A-Za-z]/.test(t.value.trim()))
            result._unusedTokens.push(t.value.trim());
        }
        break;
      }

      const trimmedVal = val.trim();
      if (!trimmedVal) {
        while (strIdx < str.length && /\s/.test(str[strIdx])) {
          strIdx++;
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
        const isSep = !/[A-Za-z0-9]/.test(trimmedVal);
        if (str.startsWith(trimmedVal, strIdx)) {
          strIdx += trimmedVal.length;
        } else if (isSep) {
          // silently absorb non-matching separator chars
        } else {
          // trimmedVal is alphanumeric — use indexOf (native) to find it
          const matchIdx = str.indexOf(trimmedVal, strIdx);
          if (matchIdx !== -1) {
            let hasAlphaBefore = false;
            for (let check = strIdx; check < matchIdx; check++) {
              if (/[A-Za-z0-9]/.test(str[check])) {
                hasAlphaBefore = true;
                break;
              }
            }
            if (!hasAlphaBefore) {
              if (matchIdx > strIdx) {
                result._unusedInput.push(str.substring(strIdx, matchIdx));
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
        if (t.type === "token") result._unusedTokens.push(t.name!);
        else if (strict && t.value && t.value.trim()) result._unusedTokens.push(t.value.trim());
        else if (!strict && t.value && /[A-Za-z]/.test(t.value.trim()))
          result._unusedTokens.push(t.value.trim());
      }
      break;
    }

    let remaining = str.substring(strIdx);

    if (token.type === "token" && token.name) {
        const nameToken =
          token.name === "MMMM" ||
          token.name === "MMM" ||
          token.name === "dddd" ||
          token.name === "ddd" ||
          token.name === "dd" ||
          token.name === "Do";
      const digitLike = /^[YMDWHhmsSXxk]/.test(token.name) && !nameToken;
      if (digitLike) {
        const canHandleSign =
          (token.name === "YYYYYY" ||
            token.name === "YYYYY" ||
            token.name === "YYYY" ||
            token.name === "yyyy" ||
            token.name === "Y") &&
          strIdx === 0;
        if (!/^\d/.test(remaining) && !canHandleSign) {
          const skipIdx = skipToNext(remaining, (ch) => /\d/.test(ch));
          if (skipIdx > 0) {
            result._unusedInput.push(remaining.substring(0, skipIdx));
            strIdx += skipIdx;
            remaining = str.substring(strIdx);
          }
        } else if (!/^\d/.test(remaining) && canHandleSign) {
          if (!/^[+-]/.test(remaining)) {
            const skipIdx = skipToNext(remaining, (ch) => /\d/.test(ch));
            if (skipIdx > 0) {
              result._unusedInput.push(remaining.substring(0, skipIdx));
              strIdx += skipIdx;
              remaining = str.substring(strIdx);
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
        if (!/^[\p{L}\d~ʼ']/u.test(remaining)) {
          const skipIdx = skipToNext(remaining, (ch) => /^[\p{L}\d~ʼ']$/u.test(ch));
          if (skipIdx > 0) {
            result._unusedInput.push(remaining.substring(0, skipIdx));
            strIdx += skipIdx;
            remaining = str.substring(strIdx);
          }
        }
      } else if (token.name === "A" || token.name === "a") {
        if (!/[ap]/i.test(remaining)) {
          let skipIdx = -1;
          for (let si = 0; si < remaining.length; si++) {
            if (/[ap]/i.test(remaining[si])) {
              skipIdx = si;
              break;
            }
          }
          if (skipIdx > 0) {
            result._unusedInput.push(remaining.substring(0, skipIdx));
            strIdx += skipIdx;
            remaining = str.substring(strIdx);
          }
        }
      }
    }

    switch (token.name) {
      case "YYYYYY": {
        const yMatch = remaining.match(/^([+-]?\d{1,7})/);
        if (!yMatch) {
          failed = true;
          break;
        }
        if (strict) {
          const digitPart = yMatch[1].replace(/^[+-]/, "");
          if (digitPart.length !== 6) {
            failed = true;
            break;
          }
        }
        let y = parseInt(yMatch[1], 10);
        result.year = y;
        result._parsedDateParts[0] = y;
        strIdx += yMatch[1].length;
        break;
      }
      case "YYYYY": {
        const yMatch = remaining.match(/^([+-]?\d{1,6})/);
        if (!yMatch) {
          failed = true;
          break;
        }
        if (strict) {
          const digitPart = yMatch[1].replace(/^[+-]/, "");
          if (digitPart.length < 5 || digitPart.length > 6) {
            failed = true;
            break;
          }
        }
        let y = parseInt(yMatch[1], 10);
        result.year = y;
        result._parsedDateParts[0] = y;
        strIdx += yMatch[1].length;
        break;
      }
      case "YYYY":
      case "yyyy": {
        const yMatch = remaining.match(/^([+-]?\d{1,4})/);
        if (!yMatch) {
          failed = true;
          break;
        }
        if (strict && yMatch[1].length !== 4) {
          failed = true;
          break;
        }
        let y = parseInt(yMatch[1], 10);
        if (yMatch[1].length === 2 && !yMatch[1].startsWith("+") && !yMatch[1].startsWith("-")) {
          y = y > 68 ? 1900 + y : 2000 + y;
        }
        result.year = y;
        result._parsedDateParts[0] = y;
        strIdx += yMatch[1].length;
        break;
      }
      case "YY": {
        const match = timedMatch(remaining, /^(\d{1,2})/, 2, strict);
        if (!match) {
          failed = true;
          break;
        }
        const yStr = match[1];
        if (parseTwoDigitYearFn) {
          result.year = parseTwoDigitYearFn(yStr);
        } else {
          const y = parseInt(yStr, 10);
          result.year = y > 68 ? 1900 + y : 2000 + y;
        }
        result._parsedDateParts[0] = result.year;
        strIdx += match[1].length;
        break;
      }
      case "Y": {
        const match = remaining.match(/^([+-]?\d+)/);
        if (!match) {
          failed = true;
          break;
        }
        result.year = parseInt(match[1], 10);
        result._parsedDateParts[0] = result.year;
        strIdx += match[1].length;
        break;
      }
      case "y":
      case "yy":
      case "yyy": {
        const yMatch = remaining.match(/^(\d+)/);
        if (!yMatch) {
          failed = true;
          break;
        }
        result._eraYear = parseInt(yMatch[1], 10);
        result._parsedDateParts[0] = result._eraYear;
        strIdx += yMatch[1].length;
        break;
      }
      case "yo": {
        const eras = (loc._config as any).eras;
        const eraOrdinalRegex =
          eras && (loc._config as any).eraYearOrdinalParse
            ? (loc._config as any).eraYearOrdinalRegex || /(\d+)/
            : /(\d+)/;
        const yoMatch = remaining.match(eraOrdinalRegex);
        if (!yoMatch) {
          failed = true;
          break;
        }
        const eraParseFn = (loc._config as any).eraYearOrdinalParse;
        if (eraParseFn) {
          result._eraYear = eraParseFn(remaining, yoMatch);
        } else {
          result._eraYear = parseInt(yoMatch[1] || yoMatch[0], 10);
        }
        result._parsedDateParts[0] = result._eraYear;
        strIdx += yoMatch[0].length;
        break;
      }
      case "N":
      case "NN":
      case "NNN": {
        const erasList = (loc._config as any).eras;
        if (erasList && Array.isArray(erasList)) {
          const names = strict
            ? erasList.map((e: any) => e.abbr).filter(Boolean)
            : [...new Set(erasList.flatMap((e: any) => [e.abbr, e.name, e.narrow].filter(Boolean)))];
          const regex = new RegExp(`^(${  names.map(escapeRegex).join("|")  })`);
          const nMatch = remaining.match(regex);
          if (nMatch) {
            const matchedName = nMatch[1];
            const era = erasList.find(
              (e: any) => e.abbr === matchedName || e.name === matchedName || e.narrow === matchedName
            );
            if (era) result._era = era;
            strIdx += nMatch[1].length;
            break;
          }
        }
        failed = true;
        break;
      }
      case "NNNN": {
        const erasWide = (loc._config as any).eras;
        if (erasWide && Array.isArray(erasWide)) {
          const names = erasWide.map((e: any) => e.name).filter(Boolean);
          const regex = new RegExp(`^(${  names.map(escapeRegex).join("|")  })`);
          const nMatch = remaining.match(regex);
          if (nMatch) {
            const matched = nMatch[1];
            const era = erasWide.find((e: any) => e.name === matched);
            if (era) result._era = era;
            strIdx += nMatch[1].length;
            break;
          }
        }
        failed = true;
        break;
      }
      case "NNNNN": {
        const erasNarrow = (loc._config as any).eras;
        if (erasNarrow && Array.isArray(erasNarrow)) {
          const names = erasNarrow.map((e: any) => e.narrow).filter(Boolean);
          const regex = new RegExp(`^(${  names.map(escapeRegex).join("|")  })`);
          const nMatch = remaining.match(regex);
          if (nMatch) {
            const matched = nMatch[1];
            const era = erasNarrow.find((e: any) => e.narrow === matched);
            if (era) result._era = era;
            strIdx += nMatch[1].length;
            break;
          }
        }
        failed = true;
        break;
      }
      case "MMMM": {
        const monthList = getLocaleMonthsFull(loc);
        const monthListShort = getLocaleMonthsShort(loc);
        if (monthList.length > 0) {
          const match = remaining.match(getLocaleMonthsFullRegex(loc, strict));
          if (match) {
            const matched = match[1].toLowerCase();
            let idx = monthList.indexOf(matched);
            if (!strict && idx < 0) {
              idx = monthListShort.indexOf(matched);
            }
            if (idx < 0) {
              const cfgMonths = (loc._config as any).months;
              if (typeof cfgMonths === 'object' && !Array.isArray(cfgMonths)) {
                const fmt = (cfgMonths as any).format;
                if (Array.isArray(fmt)) idx = fmt.map((m: string) => m.toLowerCase()).indexOf(matched);
              } else if (typeof cfgMonths === 'function') {
                for (let mi = 0; mi < 12; mi++) {
                  const fm = { month: () => mi } as any;
                  try {
                    const name = cfgMonths.call((loc as any)._config, fm, 'DD MMMM YYYY');
                    if (typeof name === 'string' && name.toLowerCase() === matched) { idx = mi; break; }
                  } catch {}
                }
              }
            }
            if (idx < 0) {
              const noPeriod = matched.replace(/\.$/, '');
              for (let vi = 0; vi < monthList.length; vi++) {
                const variants = addCharVariants([monthList[vi]]);
                if (variants.includes(matched) || variants.map((m: string) => m.replace(/\.$/, '')).includes(noPeriod)) { idx = vi; break; }
              }
            }
            if (idx < 0 && !strict) {
              const noPeriod = matched.replace(/\.$/, '');
              for (let vi = 0; vi < monthListShort.length; vi++) {
                const variants = addCharVariants([monthListShort[vi]]);
                if (variants.includes(matched) || variants.map((m: string) => m.replace(/\.$/, '')).includes(noPeriod)) { idx = vi; break; }
              }
            }
            if (idx >= 0) {
              result.month = idx;
              result._parsedDateParts[1] = idx;
              strIdx += match[1].length;
              break;
            }
          }
        }
        const enMatch = remaining.match(
          /^(January|February|March|April|May|June|July|August|September|October|November|December)/i,
        );
        if (enMatch) {
          const monthVal = monthNames[enMatch[1].toLowerCase()];
          if (monthVal !== undefined) {
            result.month = monthVal;
            result._parsedDateParts[1] = monthVal;
            strIdx += enMatch[1].length;
            break;
          }
        }
        if (!strict) {
          const wordMatch = remaining.match(/^\w+/);
          if (wordMatch) {
            const monthVal = monthNames[wordMatch[0].toLowerCase()];
            if (monthVal !== undefined) {
              result.month = monthVal;
              result._parsedDateParts[1] = monthVal;
              strIdx += wordMatch[0].length;
              break;
            }
            result._invalidMonth = wordMatch[0];
          }
        }
        failed = true;
        break;
      }
      case "MMM": {
        const monthListShort = getLocaleMonthsShort(loc);
        const monthListFull = getLocaleMonthsFull(loc);
        if (monthListShort.length > 0 || monthListFull.length > 0) {
          const match = remaining.match(getLocaleMonthsShortRegex(loc, strict));
          if (match) {
            const matched = match[1].toLowerCase();
            let idx = monthListShort.indexOf(matched);
            if (!strict && idx < 0) {
              idx = monthListFull.indexOf(matched);
            }
            if (idx < 0) {
              const cfgMonths = (loc._config as any).months;
              if (typeof cfgMonths === 'object' && !Array.isArray(cfgMonths)) {
                const fmt = (cfgMonths as any).format;
                if (Array.isArray(fmt)) idx = fmt.map((m: string) => m.toLowerCase()).indexOf(matched);
              } else if (typeof cfgMonths === 'function') {
                for (let mi = 0; mi < 12; mi++) {
                  const fm = { month: () => mi } as any;
                  try {
                    const name = cfgMonths.call((loc as any)._config, fm, 'DD MMMM YYYY');
                    if (typeof name === 'string' && name.toLowerCase() === matched) { idx = mi; break; }
                  } catch {}
                }
              }
            }
            if (idx < 0) {
              const noPeriod = matched.replace(/\.$/, '');
              for (let vi = 0; vi < monthListShort.length; vi++) {
                const variants = addCharVariants([monthListShort[vi]]);
                if (variants.includes(matched) || variants.map((m: string) => m.replace(/\.$/, '')).includes(noPeriod)) { idx = vi; break; }
              }
            }
            if (idx < 0) {
              const noPeriod = matched.replace(/\.$/, '');
              for (let vi = 0; vi < monthListFull.length; vi++) {
                const variants = addCharVariants([monthListFull[vi]]);
                if (variants.includes(matched) || variants.map((m: string) => m.replace(/\.$/, '')).includes(noPeriod)) { idx = vi; break; }
              }
            }
            if (idx >= 0) {
              result.month = idx;
              result._parsedDateParts[1] = idx;
              strIdx += match[1].length;
              break;
            }
          }
        }
        const enMatch = remaining.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
        if (enMatch) {
          const monthVal = monthNames[enMatch[1].toLowerCase()];
          if (monthVal !== undefined) {
            result.month = monthVal;
            result._parsedDateParts[1] = monthVal;
            strIdx += enMatch[1].length;
            break;
          }
        }
        if (!strict) {
          const wordMatch = remaining.match(/^\w+/);
          if (wordMatch) {
            const monthVal = monthNames[wordMatch[0].toLowerCase()];
            if (monthVal !== undefined) {
              result.month = monthVal;
              result._parsedDateParts[1] = monthVal;
              strIdx += wordMatch[0].length;
              break;
            }
            result._invalidMonth = wordMatch[0];
          }
        }
        failed = true;
        break;
      }
      case "MM": {
        const match = timedMatch(remaining, /^(\d{1,2})/, 2, strict);
        if (!match) {
          failed = true;
          break;
        }
        result.month = parseInt(match[1], 10) - 1;
        result._parsedDateParts[1] = result.month;
        strIdx += match[1].length;
        break;
      }
      case "M": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        const mVal = parseInt(match[1], 10) - 1;
        if (strict && match[1].length === 2 && match[1][0] === "0") {
          failed = true;
          break;
        }
        result.month = mVal;
        result._parsedDateParts[1] = mVal;
        strIdx += match[1].length;
        break;
      }
      case "DD": {
        const match = timedMatch(remaining, /^(\d{1,2})/, 2, strict);
        if (!match) {
          failed = true;
          break;
        }
        result.day = parseInt(match[1], 10);
        result._parsedDateParts[2] = result.day;
        strIdx += match[1].length;
        break;
      }
      case "D": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        const dVal = parseInt(match[1], 10);
        if (strict && match[1].length === 2 && match[1][0] === "0") {
          failed = true;
          break;
        }
        result.day = dVal;
        result._parsedDateParts[2] = dVal;
        strIdx += match[1].length;
        break;
      }
      case "Do": {
        const ordinalParse = (loc._config as any).dayOfMonthOrdinalParse;
        let match: RegExpMatchArray | null = null;

        if (ordinalParse instanceof RegExp) {
          match = remaining.match(new RegExp(`^(?:${  ordinalParse.source  })`));
        }
        if (!match) {
          match = remaining.match(/^(\d{1,2})(?:st|nd|rd|th)?/i);
        }
        if (!match) {
          failed = true;
          break;
        }
        const digitStr = (match[0].match(/\d{1,2}/) || [])[0];
        if (!digitStr) {
          failed = true;
          break;
        }
        result.day = parseInt(digitStr, 10);
        result._parsedDateParts[2] = result.day;
        strIdx += match[0].length;
        break;
      }
      case "dddd": {
        const wdList = getLocaleWeekdaysFull(loc);
        let matched = false;
        if (wdList.length > 0) {
          const match = remaining.match(getLocaleWeekdaysFullRegex(loc));
          if (match) {
            const matchedName = match[1].toLowerCase();
            let idx = wdList.indexOf(matchedName);
            if (idx < 0) {
              for (let vi = 0; vi < wdList.length; vi++) {
                const v = addCharVariants([wdList[vi]]);
                if (v.includes(matchedName)) { idx = vi; break; }
              }
            }
            if (idx >= 0) {
              matched = true;
              result._weekdayName = match[1];
              result._weekdayNum = idx;
            }
            strIdx += match[0].length;
            break;
          }
        }
        const enMatch = remaining.match(
          /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i,
        );
        if (enMatch) {
          matched = true;
          result._weekdayName = enMatch[1];
          const num = WEEKDAY_NAMES_MAP[enMatch[1].toLowerCase().substring(0, 3)];
          if (num !== undefined) result._weekdayNum = num;
          strIdx += enMatch[0].length;
          break;
        }
        if (!strict) {
          const looseMatch = remaining.match(/^\w+/);
          if (looseMatch) {
            strIdx += looseMatch[0].length;
            break;
          }
        }
        if (!matched) failed = true;
        break;
      }
      case "ddd": {
        const wdList = getLocaleWeekdaysShort(loc);
        let matched = false;
        if (wdList.length > 0) {
          const regex = getLocaleWeekdaysShortRegex(loc);
          const match = remaining.match(regex);
          if (match) {
            const matchedName = match[1].toLowerCase();
            let idx = wdList.indexOf(matchedName);
            if (idx < 0) {
              for (let vi = 0; vi < wdList.length; vi++) {
                const v = addCharVariants([wdList[vi]]);
                if (v.includes(matchedName)) { idx = vi; break; }
              }
            }
            if (idx >= 0) {
              matched = true;
              result._weekdayName = match[1];
              result._weekdayNum = idx;
            }
            strIdx += match[0].length;
            break;
          }
        }
        const enMatch = remaining.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i);
        if (enMatch) {
          matched = true;
          result._weekdayName = enMatch[1];
          const num = WEEKDAY_NAMES_MAP[enMatch[1].toLowerCase().substring(0, 3)];
          if (num !== undefined) result._weekdayNum = num;
          strIdx += enMatch[0].length;
          break;
        }
        if (!strict) {
          const looseMatch = remaining.match(/^\w+/);
          if (looseMatch) {
            strIdx += looseMatch[0].length;
            break;
          }
        }
        if (!matched) failed = true;
        break;
      }
      case "dd": {
        const wdList = getLocaleWeekdaysMin(loc);
        let matched = false;
        if (wdList.length > 0) {
          const match = remaining.match(getLocaleWeekdaysMinRegex(loc));
          if (match) {
            const matchedName = match[1].toLowerCase();
            let idx = wdList.indexOf(matchedName);
            if (idx < 0) {
              for (let vi = 0; vi < wdList.length; vi++) {
                const v = addCharVariants([wdList[vi]]);
                if (v.includes(matchedName)) { idx = vi; break; }
              }
            }
            if (idx >= 0) {
              matched = true;
              result._weekdayName = match[1];
              result._weekdayNum = idx;
            }
            strIdx += match[0].length;
            break;
          }
        }
        const enLoose = remaining.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
        if (enLoose || !strict) {
          const looseMatch = enLoose || remaining.match(/^\w+/);
          if (looseMatch) {
            strIdx += looseMatch[0].length;
            break;
          }
        }
        if (!matched) failed = true;
        break;
      }
      case "d": {
        const match = remaining.match(/^(\d)/);
        if (match) {
          const dv = parseInt(match[1], 10);
          result._weekdayNum = dv;
          strIdx += match[1].length;
          if (strict && (dv < 0 || dv > 6)) {
            failed = true;
          }
          break;
        }
        if (!strict) {
          const looseMatch = remaining.match(/^\w+/);
          if (looseMatch) {
            strIdx += looseMatch[0].length;
            break;
          }
        }
        failed = true;
        break;
      }
      case "HH": {
        const match = timedMatch(remaining, /^(\d{1,2})/, 2, strict);
        if (!match) {
          failed = true;
          break;
        }
        result.hour = parseInt(match[1], 10);
        result._parsedDateParts[3] = result.hour;
        strIdx += match[1].length;
        break;
      }
      case "H": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        const hVal = parseInt(match[1], 10);
        if (strict && match[1].length === 2 && match[1][0] === "0") {
          failed = true;
          break;
        }
        result.hour = hVal;
        result._parsedDateParts[3] = hVal;
        strIdx += match[1].length;
        break;
      }
      case "kk": {
        const match = timedMatch(remaining, /^(\d{1,2})/, strict ? 2 : undefined, strict);
        if (!match) {
          failed = true;
          break;
        }
        const k = parseInt(match[1], 10);
        if (k === 24) {
          result.hour = 0;
          result._parsedDateParts[3] = 24;
        } else {
          result.hour = k;
          result._parsedDateParts[3] = k;
        }
        strIdx += match[1].length;
        break;
      }
      case "k": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        const kVal = parseInt(match[1], 10);
        if (strict && match[1].length === 2 && match[1][0] === "0") {
          failed = true;
          break;
        }
        if (kVal === 24) {
          result.hour = 0;
          result._parsedDateParts[3] = 24;
        } else {
          result.hour = kVal;
          result._parsedDateParts[3] = kVal;
        }
        strIdx += match[1].length;
        break;
      }
      case "hh": {
        const match = timedMatch(remaining, /^(\d{1,2})/, 2, strict);
        if (!match) {
          failed = true;
          break;
        }
        const hhVal = parseInt(match[1], 10);
        if (strict && hhVal === 0) {
          failed = true;
          break;
        }
        result.hour = hhVal;
        result._parsedDateParts[3] = hhVal;
        if (hhVal > 12) {
          result.bigHour = true;
          if (strict) {
            failed = true;
            break;
          }
        }
        strIdx += match[1].length;
        break;
      }
      case "h": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        const hVal = parseInt(match[1], 10);
        if (strict) {
          if (match[1].length === 2 && match[1][0] === "0") {
            failed = true;
            break;
          }
          if (hVal === 0) {
            failed = true;
            break;
          }
        }
        result.hour = hVal;
        result._parsedDateParts[3] = hVal;
        if (hVal > 12) {
          result.bigHour = true;
          if (strict) {
            failed = true;
            break;
          }
        }
        strIdx += match[1].length;
        break;
      }
      case "mm": {
        const match = timedMatch(remaining, /^(\d{1,2})/, 2, strict);
        if (!match) {
          failed = true;
          break;
        }
        result.minute = parseInt(match[1], 10);
        result._parsedDateParts[4] = result.minute;
        strIdx += match[1].length;
        break;
      }
      case "m": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        const mVal = parseInt(match[1], 10);
        if (strict && match[1].length === 2 && match[1][0] === "0") {
          failed = true;
          break;
        }
        result.minute = mVal;
        result._parsedDateParts[4] = mVal;
        strIdx += match[1].length;
        break;
      }
      case "ss": {
        const match = timedMatch(remaining, /^(\d{1,2})/, 2, strict);
        if (!match) {
          failed = true;
          break;
        }
        result.second = parseInt(match[1], 10);
        result._parsedDateParts[5] = result.second;
        strIdx += match[1].length;
        break;
      }
      case "s": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        const sVal = parseInt(match[1], 10);
        if (strict && match[1].length === 2 && match[1][0] === "0") {
          failed = true;
          break;
        }
        result.second = sVal;
        result._parsedDateParts[5] = sVal;
        strIdx += match[1].length;
        break;
      }
      case "SSSSSSSSS":
      case "SSSSSSSS":
      case "SSSSSSS":
      case "SSSSSS":
      case "SSSSS":
      case "SSSS":
      case "SSS":
      case "SS":
      case "S": {
        const maxDigits = token.name.length;
        const match = timedMatch(
          remaining,
          new RegExp(`^(\\d{1,${  maxDigits  }})`),
          strict ? maxDigits : undefined,
          strict,
        );
        if (!match) {
          failed = true;
          break;
        }
        result.millisecond = parseInt(match[1].slice(0, 3).padEnd(3, "0"), 10);
        result._parsedDateParts[6] = result.millisecond;
        strIdx += match[1].length;
        break;
      }
      case "A":
      case "a": {
        const ampmReg = loc.meridiemParse() || /[ap]\.?m?\.?/i;
        const match = remaining.match(ampmReg);
        if (!match) {
          failed = true;
          break;
        }
      result.amp = match[0].toLowerCase();
      result._meridiem = match[0];
        strIdx += match[0].length;
        break;
      }
      case "Z":
      case "ZZ": {
        if (!strict) {
          const zTrimMatch = remaining.match(/^\s+/);
          if (zTrimMatch) {
            result._unusedInput.push(zTrimMatch[0]);
            strIdx += zTrimMatch[0].length;
            remaining = str.substring(strIdx);
          }
        }
        const match = remaining.match(/^([+-]\d{2}:?\d{2}|Z)/);
        if (!match) {
          failed = true;
          break;
        }
        if (match[1] === "Z") {
          result.offset = 0;
        } else {
          const cleaned = match[1].replace(":", "");
          const sign = cleaned[0] === "+" ? 1 : -1;
          const tzHour = parseInt(cleaned.substring(1, 3), 10);
          const tzMin = parseInt(cleaned.substring(3, 5), 10);
          result.offset = sign * (tzHour * 60 + tzMin);
        }
        strIdx += match[1].length;
        break;
      }
      case "X": {
        const match = remaining.match(/^(-?\d+(?:\.\d+)?)/);
        if (!match) {
          failed = true;
          break;
        }
        const ts = parseFloat(match[1]) * 1000;
        const d = new Date(ts);
        result.year = d.getUTCFullYear();
        result.month = d.getUTCMonth();
        result.day = d.getUTCDate();
        result.hour = d.getUTCHours();
        result.minute = d.getUTCMinutes();
        result.second = d.getUTCSeconds();
        result.millisecond = d.getUTCMilliseconds();
        strIdx += match[1].length;
        break;
      }
      case "x": {
        const match = remaining.match(/^(-?\d+)/);
        if (!match) {
          failed = true;
          break;
        }
        const ts = parseInt(match[1], 10);
        const d = new Date(ts);
        result.year = d.getUTCFullYear();
        result.month = d.getUTCMonth();
        result.day = d.getUTCDate();
        result.hour = d.getUTCHours();
        result.minute = d.getUTCMinutes();
        result.second = d.getUTCSeconds();
        result.millisecond = d.getUTCMilliseconds();
        strIdx += match[1].length;
        break;
      }
      case "E": {
        const match = remaining.match(/^(\d{1,2})/);
        if (match) {
          const eVal = parseInt(match[1], 10);
          if (strict && eVal === 0) {
            failed = true;
            break;
          }
          result._weekdayNum = eVal;
          result._parsedDateParts[7] = eVal;
          strIdx += match[1].length;
          break;
        }
        failed = true;
        break;
      }
        case "e": {
          const match = remaining.match(/^(\d{1,2})/);
          if (match) {
            const ev = parseInt(match[1], 10);
            result._parsedDateParts[7] = ev;
            result._localeWeekday = ev;
            result._weekdayNum = ev;
            strIdx += match[1].length;
            if (strict && match[1].length === 2 && match[1][0] === "0") {
              failed = true;
              break;
            }
            if (strict && (ev < 0 || ev > 6)) {
              result.overflow = 8;
              failed = true;
            }
            break;
          }
          failed = true;
          break;
        }
      case "Q": {
        const match = remaining.match(/^(\d)/);
        if (!match) {
          failed = true;
          break;
        }
        result.quarter = parseInt(match[1], 10);
        strIdx += match[1].length;
        break;
      }
      case "DDD":
      case "DDDD": {
        const digits = 3;
        const match = remaining.match(new RegExp(`^(\\d{1,${  digits  }})`));
        if (!match) {
          failed = true;
          break;
        }
        const dayOfYearNum = parseInt(match[1], 10);
        if (dayOfYearNum === 0) {
          failed = true;
          break;
        }
        result.dayOfYear = dayOfYearNum;
        strIdx += match[1].length;
        break;
      }
      case "GGGG": {
        const match = remaining.match(/^(\d{4})/);
        if (!match) {
          failed = true;
          break;
        }
        result.isoWeekYear = parseInt(match[1], 10);
        strIdx += match[1].length;
        break;
      }
      case "gggg": {
        const match = remaining.match(/^(\d{4})/);
        if (!match) {
          failed = true;
          break;
        }
        result._weekYear = parseInt(match[1], 10);
        strIdx += match[1].length;
        break;
      }
      case "GG": {
        const match = remaining.match(/^(\d{2})/);
        if (!match) {
          failed = true;
          break;
        }
        const y = parseInt(match[1], 10);
        result.isoWeekYear = y > 68 ? 1900 + y : 2000 + y;
        strIdx += match[1].length;
        break;
      }
      case "gg": {
        const match = remaining.match(/^(\d{2})/);
        if (!match) {
          failed = true;
          break;
        }
        const y = parseInt(match[1], 10);
        result._weekYear = y > 68 ? 1900 + y : 2000 + y;
        strIdx += match[1].length;
        break;
      }
      case "WW": {
        const match = remaining.match(/^(\d{2})/);
        if (!match) {
          failed = true;
          break;
        }
        result.isoWeek = parseInt(match[1], 10);
        strIdx += match[1].length;
        break;
      }
      case "ww": {
        const match = remaining.match(/^(\d{2})/);
        if (!match) {
          failed = true;
          break;
        }
        result._week = parseInt(match[1], 10);
        strIdx += match[1].length;
        break;
      }
      case "W": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        if (strict && match[1].length === 2 && match[1][0] === "0") {
          failed = true;
          break;
        }
        result.isoWeek = parseInt(match[1], 10);
        strIdx += match[1].length;
        break;
      }
      case "w": {
        const match = remaining.match(/^(\d{1,2})/);
        if (!match) {
          failed = true;
          break;
        }
        if (strict && match[1].length === 2 && match[1][0] === "0") {
          failed = true;
          break;
        }
        result._week = parseInt(match[1], 10);
        strIdx += match[1].length;
        break;
      }
      case "hmm": {
        const match = remaining.match(/^(\d{1,2})(\d{2})/);
        if (!match) {
          failed = true;
          break;
        }
        const hVal = parseInt(match[1], 10);
        if (hVal > 12) result.bigHour = true;
        result.hour = hVal;
        result._parsedDateParts[3] = hVal;
        result.minute = parseInt(match[2], 10);
        result._parsedDateParts[4] = result.minute;
        strIdx += match[0].length;
        break;
      }
      case "hmmss": {
        const match = remaining.match(/^(\d{1,2})(\d{2})(\d{2})/);
        if (!match) {
          failed = true;
          break;
        }
        const hVal = parseInt(match[1], 10);
        if (hVal > 12) result.bigHour = true;
        result.hour = hVal;
        result._parsedDateParts[3] = hVal;
        result.minute = parseInt(match[2], 10);
        result._parsedDateParts[4] = result.minute;
        result.second = parseInt(match[3], 10);
        result._parsedDateParts[5] = result.second;
        strIdx += match[0].length;
        break;
      }
      case "Hmm": {
        const match = remaining.match(/^(\d{1,2})(\d{2})/);
        if (!match) {
          failed = true;
          break;
        }
        result.hour = parseInt(match[1], 10);
        result._parsedDateParts[3] = result.hour;
        result.minute = parseInt(match[2], 10);
        result._parsedDateParts[4] = result.minute;
        strIdx += match[0].length;
        break;
      }
      case "Hmmss": {
        const match = remaining.match(/^(\d{1,2})(\d{2})(\d{2})/);
        if (!match) {
          failed = true;
          break;
        }
        result.hour = parseInt(match[1], 10);
        result._parsedDateParts[3] = result.hour;
        result.minute = parseInt(match[2], 10);
        result._parsedDateParts[4] = result.minute;
        result.second = parseInt(match[3], 10);
        result._parsedDateParts[5] = result.second;
        strIdx += match[0].length;
        break;
      }
      default:
        break;
    }

    if (failed) {
      if (strict) {
        for (let j = tokenIndex; j < tokens.length; j++) {
          const t = tokens[j];
          if (t.type === "token") {
            if (!_seenUnusedTokens.has(t.name!)) { _seenUnusedTokens.add(t.name!); result._unusedTokens.push(t.name!); }
          } else if (t.value && t.value.trim()) {
            const trimmed = t.value.trim();
            if (!_seenUnusedTokens.has(trimmed)) { _seenUnusedTokens.add(trimmed); result._unusedTokens.push(trimmed); }
          }
        }
        break;
      }
      failed = false;
      if (token.type === "token" && token.name) {
        result._unusedTokens.push(token.name);
      } else if ((token as any).type === "literal" && (token as any).value) {
        result._unusedTokens.push((token as any).value.trim());
      }
      const skipMatch = remaining.match(/^[^\p{L}\d]+/u);
      if (skipMatch) {
        result._unusedInput.push(skipMatch[0]);
        strIdx += skipMatch[0].length;
      }
    }
  }

  if (result.amp !== undefined && result.hour !== undefined) {
    const mHourFn = (loc._config as any).meridiemHour;
    if (typeof mHourFn === "function") {
      result.hour = mHourFn(result.hour, result._meridiem);
    } else {
      const isPM = loc.isPM(result._meridiem);
      if (!isPM && result.hour === 12) {
        result.hour = 0;
      } else if (isPM && result.hour < 12) {
        result.hour = result.hour + 12;
      }
    }
  }

  // Convert era + eraYear to absolute year
  if (result._era && result._eraYear !== undefined) {
    const era = result._era;
    const sinceStr = era.since ? String(era.since) : null;
    const sinceMatch = sinceStr ? sinceStr.match(/^(-?\d+)/) : null;
    if (sinceMatch) {
      const sinceYear = parseInt(sinceMatch[1], 10);
      if (sinceYear === 0 && era.until != null && typeof era.until === "number" && era.until < 0) {
        result.year = 1 - result._eraYear;
      } else {
        result.year = sinceYear + result._eraYear - (era.offset || 1);
      }
      result._parsedDateParts[0] = result.year;
    }
    delete result._era;
    delete result._eraYear;
  }

  if (strIdx < str.length && !failed) {
    const rest = str.substring(strIdx);
    if (rest) result._unusedInput.push(rest);
  }
  result._charsLeftOver = result._unusedInput.reduce((a: number, s: string) => a + s.length, 0);
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

  if (failed) {
    if (strict) {
      if (result.bigHour) return result;
      for (let j = tokenIndex; j < tokens.length; j++) {
        const t = tokens[j];
        if (t.type === "token") {
          if (!_seenUnusedTokens.has(t.name!)) { _seenUnusedTokens.add(t.name!); result._unusedTokens.push(t.name!); }
        } else if (t.value && t.value.trim()) {
          const trimmed = t.value.trim();
          if (!_seenUnusedTokens.has(trimmed)) { _seenUnusedTokens.add(trimmed); result._unusedTokens.push(trimmed); }
        }
      }
      return result;
    }
    if (failedAt >= 0) {
      for (let j = failedAt; j < tokens.length; j++) {
        const t = tokens[j];
        if (t.type === "token") {
          if (!_seenUnusedTokens.has(t.name!)) { _seenUnusedTokens.add(t.name!); result._unusedTokens.push(t.name!); }
        }
      }
    }
  }

  return result;
}

interface FormatToken {
  type: "token" | "literal";
  name?: string;
  value?: string;
}

const FORMAT_TOKENS = [
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

function tokenizeFormat(format: string): FormatToken[] {
  const cached = tokenizeCache.get(format);
  if (cached) return cached;

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
    for (const token of FORMAT_TOKENS) {
      if (format.startsWith(token, i)) {
        tokens.push({ type: "token", name: token });
        i += token.length;
        matched = true;
        break;
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

function parseWithFormats(
  str: string,
  formats: string[],
  locale?: string,
  strict?: boolean,
): any {
  let best: any = null;
  let bestScore = -99999;
  let bestFmt = "";
  for (const fmt of formats) {
    const result = parseWithFormat(str, fmt, locale, strict);
    if (!result) continue;
    const hasVal =
      result.year !== undefined ||
      result.month !== undefined ||
      result.day !== undefined ||
      result.hour !== undefined ||
      result.minute !== undefined ||
      result.second !== undefined ||
      result.millisecond !== undefined ||
      result.isoWeek !== undefined;
    if (!hasVal) continue;

    let score = 0;
    if (result.year !== undefined) score += 40;
    if (result.month !== undefined) score += 20;
    if (result.day !== undefined) score += 20;
    if (result.hour !== undefined) score += 10;
    if (result.minute !== undefined) score += 8;
    if (result.second !== undefined) score += 5;
    if (result.millisecond !== undefined) score += 3;
    if (result.isoWeek !== undefined) score += 16;
    if (result.isoWeekYear !== undefined) score += 10;
    if (result._unusedTokens) score -= result._unusedTokens.length * 10;
    if (result._unusedInput)
      score -= result._unusedInput.reduce((a: number, s: string) => a + s.length, 0) * 2;
    if (result._charsLeftOver) score -= result._charsLeftOver * 3;

    if (result.month !== undefined && (result.month < 0 || result.month > 11)) score -= 100;
    if (result.day !== undefined && result.day < 1) score -= 100;
    if (result.hour !== undefined && (result.hour < 0 || result.hour > 23)) score -= 100;

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

export function parseArray(arr: any[]): any {
  if (arr.length === 0) return null;

  for (const val of arr) {
    if (val === null || val === undefined) return null;
    const n = Number(val);
    if (isNaN(n)) return null;
  }

  const result: any = {
    year: Number(arr[0]),
    month: arr[1] !== undefined ? Number(arr[1]) : 0,
    day: arr[2] !== undefined ? Number(arr[2]) : 1,
    hour: arr[3] !== undefined ? Number(arr[3]) : 0,
    minute: arr[4] !== undefined ? Number(arr[4]) : 0,
    second: arr[5] !== undefined ? Number(arr[5]) : 0,
    millisecond: arr[6] !== undefined ? Number(arr[6]) : 0,
    offset: undefined,
  };

  if (isNaN(result.year)) return null;

  if (result.year < 0 || result.year > 9999) {
    const d = new Date(0);
    d.setFullYear(result.year, result.month, result.day);
    d.setHours(result.hour, result.minute, result.second, result.millisecond);
    if (isNaN(d.getTime())) return null;
    return { ...result, _useConstructor: true };
  }

  return result;
}

export function parseObject(obj: any): any {
  const result: any = {};

  if (hasOwnProp(obj, "year") || hasOwnProp(obj, "years") || hasOwnProp(obj, "y")) {
    const v = obj.year !== undefined ? obj.year : obj.years !== undefined ? obj.years : obj.y;
    if (v != null) result.year = Number(v);
  }
  if (hasOwnProp(obj, "month") || hasOwnProp(obj, "months") || hasOwnProp(obj, "M")) {
    const v = obj.month !== undefined ? obj.month : obj.months !== undefined ? obj.months : obj.M;
    if (v != null) result.month = Number(v);
  }
  if (hasOwnProp(obj, "day") || hasOwnProp(obj, "days") || hasOwnProp(obj, "d")) {
    const v = obj.day !== undefined ? obj.day : obj.days !== undefined ? obj.days : obj.d;
    if (v != null) result.day = Number(v);
  } else if (hasOwnProp(obj, "date") || hasOwnProp(obj, "dates")) {
    const v = obj.date !== undefined ? obj.date : obj.dates;
    if (v != null) result.day = Number(v);
  }
  if (hasOwnProp(obj, "hour") || hasOwnProp(obj, "hours") || hasOwnProp(obj, "h")) {
    const v = obj.hour !== undefined ? obj.hour : obj.hours !== undefined ? obj.hours : obj.h;
    if (v != null) result.hour = Number(v);
  }
  if (hasOwnProp(obj, "minute") || hasOwnProp(obj, "minutes") || hasOwnProp(obj, "m")) {
    const v =
      obj.minute !== undefined ? obj.minute : obj.minutes !== undefined ? obj.minutes : obj.m;
    if (v != null) result.minute = Number(v);
  }
  if (hasOwnProp(obj, "second") || hasOwnProp(obj, "seconds") || hasOwnProp(obj, "s")) {
    const v =
      obj.second !== undefined ? obj.second : obj.seconds !== undefined ? obj.seconds : obj.s;
    if (v != null) result.second = Number(v);
  }
  if (hasOwnProp(obj, "millisecond") || hasOwnProp(obj, "milliseconds") || hasOwnProp(obj, "ms")) {
    const v =
      obj.millisecond !== undefined
        ? obj.millisecond
        : obj.milliseconds !== undefined
          ? obj.milliseconds
          : obj.ms;
    if (v != null) result.millisecond = Number(v);
  }

  return result;
}

export function parseTwoDigitYear(str: string): number {
  const num = parseInt(str, 10);
  return num > 68 ? 1900 + num : 2000 + num;
}

export { ISO_8601_REGEX };
