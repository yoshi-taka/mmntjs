import type { FormattableMoment } from "./types";
import { LruMap } from "../utils";
import {
  setCurrentLocale,
  currentFormat,
  setCurrentFormat,
  buildRenderFns,
  type RenderFn,
} from "../format-tokens";
import { localeInvalidDate, localeLongDateFormat, localePostformat } from "../locale-runtime";

export { setCurrentFormat };

const expandLocaleCache = new LruMap<string, string>(500);

const hasLocaleToken = /[Ll]/;

function expandLocaleTokens(m: FormattableMoment, format: string): string {
  if (!hasLocaleToken.test(format)) {
    return format;
  }

  const loc = m.localeData();
  const cacheKey = `${m._l}:${format}`;
  const cached = expandLocaleCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const parts: string[] = [];
  let i = 0;
  const len = format.length;

  while (i < len) {
    if (format[i] === "[") {
      const close = format.indexOf("]", i);
      if (close !== -1) {
        parts.push(format.slice(i, close + 1));
        i = close + 1;
        continue;
      }
    }

    const remaining = format.substring(i);
    const localMatch = remaining.match(/^(LTS|LT|llll|LLLL|lll|LLL|ll|LL|l|L)(?![a-zA-Z])/);
    if (localMatch) {
      const key = localMatch[1];
      const longFmt = localeLongDateFormat(loc, key);
      if (longFmt && longFmt !== key) {
        parts.push(longFmt);
        i += key.length;
        continue;
      }
    }

    parts.push(format[i]);
    i++;
  }

  const result = parts.join("");
  expandLocaleCache.set(cacheKey, result);
  return result;
}

const PAD2 = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
];

function padYear(y: number): string {
  return y < 10 ? `000${y}` : y < 100 ? `00${y}` : y < 1000 ? `0${y}` : String(y);
}

function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

function formatOffset(offset: number): string {
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${sign + PAD2[Math.floor(abs / 60)]}:${PAD2[abs % 60]}`;
}

const enMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const enMonthsShort = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const enWeekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const enWeekdaysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const enWeekdaysMin = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function fmt12H(h: number): number {
  return h % 12 || 12;
}

function fmtAmPm(h: number): string {
  return h < 12 ? "AM" : "PM";
}

function ordinalSuffix(d: number): string {
  if (d > 10 && d < 14) {
    return "th";
  }
  const r = d % 10;
  return r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th";
}

function formatCommonEn(m: FormattableMoment, format: string): string | undefined {
  const raw = m as unknown as {
    _l: string;
    _isValid: boolean;
    _p: {
      y: number;
      M: number;
      D: number;
      W: number;
      H: number;
      m: number;
      s: number;
      ms: number;
      dirty: boolean;
    };
  };
  if (raw._l !== "en" || !raw._isValid) {
    return undefined;
  }
  if (raw._p.dirty) {
    (m as unknown as { _ensureFields: () => void })._ensureFields();
  }
  const y = raw._p.y;
  if (y < 0 || y > 9999) {
    return undefined;
  }
  const datePart = `${padYear(y)}-${PAD2[raw._p.M + 1]}-${PAD2[raw._p.D]}`;
  switch (format) {
    case "YYYY-MM-DD":
      return datePart;
    case "HH:mm:ss":
      return `${PAD2[raw._p.H]}:${PAD2[raw._p.m]}:${PAD2[raw._p.s]}`;
    case "HH:mm:ss.SSS":
      return `${PAD2[raw._p.H]}:${PAD2[raw._p.m]}:${PAD2[raw._p.s]}.${pad3(raw._p.ms)}`;
    case "YYYY-MM-DD HH:mm:ss":
      return `${datePart} ${PAD2[raw._p.H]}:${PAD2[raw._p.m]}:${PAD2[raw._p.s]}`;
    case "YYYY-MM-DD HH:mm:ss.SSS":
      return `${datePart} ${PAD2[raw._p.H]}:${PAD2[raw._p.m]}:${PAD2[raw._p.s]}.${pad3(raw._p.ms)}`;
    case "YYYY-MM-DDTHH:mm:ss.SSSZ":
      return `${datePart}T${PAD2[raw._p.H]}:${PAD2[raw._p.m]}:${PAD2[raw._p.s]}.${pad3(raw._p.ms)}${formatOffset(m.utcOffset())}`;
    case "LT":
      return `${fmt12H(raw._p.H)}:${PAD2[raw._p.m]} ${fmtAmPm(raw._p.H)}`;
    case "LTS":
      return `${fmt12H(raw._p.H)}:${PAD2[raw._p.m]}:${PAD2[raw._p.s]} ${fmtAmPm(raw._p.H)}`;
    case "L":
      return `${PAD2[raw._p.M + 1]}/${PAD2[raw._p.D]}/${padYear(y)}`;
    case "l":
      return `${raw._p.M + 1}/${raw._p.D}/${padYear(y)}`;
    case "LL":
      return `${enMonths[raw._p.M]} ${raw._p.D}, ${padYear(y)}`;
    case "ll":
      return `${enMonthsShort[raw._p.M]} ${raw._p.D}, ${padYear(y)}`;
    case "LLL":
      return `${enMonths[raw._p.M]} ${raw._p.D}, ${padYear(y)} ${fmt12H(raw._p.H)}:${PAD2[raw._p.m]} ${fmtAmPm(raw._p.H)}`;
    case "lll":
      return `${enMonthsShort[raw._p.M]} ${raw._p.D}, ${padYear(y)} ${fmt12H(raw._p.H)}:${PAD2[raw._p.m]} ${fmtAmPm(raw._p.H)}`;
    case "LLLL":
      return `${enWeekdays[raw._p.W]}, ${enMonths[raw._p.M]} ${raw._p.D}, ${padYear(y)} ${fmt12H(raw._p.H)}:${PAD2[raw._p.m]} ${fmtAmPm(raw._p.H)}`;
    case "llll":
      return `${enWeekdaysShort[raw._p.W]}, ${enMonthsShort[raw._p.M]} ${raw._p.D}, ${padYear(y)} ${fmt12H(raw._p.H)}:${PAD2[raw._p.m]} ${fmtAmPm(raw._p.H)}`;
    case "dddd":
      return enWeekdays[raw._p.W];
    case "ddd":
      return enWeekdaysShort[raw._p.W];
    case "dd":
      return enWeekdaysMin[raw._p.W];
    case "Do":
      return `${raw._p.D}${ordinalSuffix(raw._p.D)}`;
    case "MMMM":
      return enMonths[raw._p.M];
    case "MMM":
      return enMonthsShort[raw._p.M];
    case "A":
      return fmtAmPm(raw._p.H);
    case "a":
      return fmtAmPm(raw._p.H).toLowerCase();
    case "h":
      return String(fmt12H(raw._p.H));
    case "h:mm:ss a":
      return `${fmt12H(raw._p.H)}:${PAD2[raw._p.m]}:${PAD2[raw._p.s]} ${fmtAmPm(raw._p.H).toLowerCase()}`;
    case "dddd, MMMM Do YYYY, h:mm:ss a":
      return `${enWeekdays[raw._p.W]}, ${enMonths[raw._p.M]} ${raw._p.D}${ordinalSuffix(raw._p.D)} ${padYear(y)}, ${fmt12H(raw._p.H)}:${PAD2[raw._p.m]}:${PAD2[raw._p.s]} ${fmtAmPm(raw._p.H).toLowerCase()}`;
  }
  return undefined;
}

const formatRenderCache = new LruMap<string, RenderFn[]>(500);

export function formatMoment(m: FormattableMoment, format: string): string {
  const common = formatCommonEn(m, format);
  if (common !== undefined) {
    return common;
  }

  const loc = m.localeData();
  setCurrentLocale(loc);

  if (!m._isValid) {
    setCurrentLocale(undefined);
    return localeInvalidDate(loc);
  }

  format = expandLocaleTokens(m, format);

  const localeRenderCache = (loc._config as Record<string, unknown>)._localeRenderFns as
    | Record<string, RenderFn[]>
    | undefined;
  let fns = localeRenderCache?.[format];
  if (!fns) {
    fns = formatRenderCache.get(format) ?? buildRenderFns(format);
    if (!formatRenderCache.get(format)) {
      formatRenderCache.set(format, fns);
    }
  }

  const savedFormat = currentFormat;
  setCurrentFormat(format);
  const parts: string[] = [];
  for (const fn of fns) {
    parts.push((fn as unknown as (m: FormattableMoment) => string)(m));
  }
  setCurrentFormat(savedFormat);
  setCurrentLocale(undefined);
  return localePostformat(loc, parts.join(""));
}
