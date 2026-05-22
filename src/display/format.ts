import type { FormattableMoment } from "./types";
import { LruMap, pad2, pad3, zeroFill } from "../utils";
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

function formatOffset(offset: number): string {
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${sign + pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
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

function localeMeridiem(loc: Record<string, unknown>, h: number): string {
  const cfg = loc._config as Record<string, unknown> | undefined;
  const fn = cfg?.meridiem as ((h: number, m: number, isLower: boolean) => string) | undefined;
  return fn ? fn(h, 0, false) : h < 12 ? "AM" : "PM";
}

interface P2 {
  y: number;
  M: number;
  D: number;
  H: number;
  m: number;
  s: number;
  ms: number;
}
type PureFn = (p: P2, loc?: Record<string, unknown>) => string;

const pure: Record<string, PureFn | undefined> = {
  "HH:mm": (p) => `${pad2(p.H)}:${pad2(p.m)}`,
  "HH:mm:ss": (p) => `${pad2(p.H)}:${pad2(p.m)}:${pad2(p.s)}`,
  "HH:mm:ss.SSS": (p) => `${pad2(p.H)}:${pad2(p.m)}:${pad2(p.s)}.${pad3(p.ms)}`,
  "h:mm A": (p, loc) => `${fmt12H(p.H)}:${pad2(p.m)} ${localeMeridiem(loc!, p.H)}`,
  "h:mm:ss A": (p, loc) => `${fmt12H(p.H)}:${pad2(p.m)}:${pad2(p.s)} ${localeMeridiem(loc!, p.H)}`,
  "DD/MM/YYYY": (p) => `${pad2(p.D)}/${pad2(p.M + 1)}/${zeroFill(p.y, 4)}`,
  "MM/DD/YYYY": (p) => `${pad2(p.M + 1)}/${pad2(p.D)}/${zeroFill(p.y, 4)}`,
  "YYYY-MM-DD": (p) => `${zeroFill(p.y, 4)}-${pad2(p.M + 1)}-${pad2(p.D)}`,
  "YYYY-MM-DD HH:mm": (p) =>
    `${zeroFill(p.y, 4)}-${pad2(p.M + 1)}-${pad2(p.D)} ${pad2(p.H)}:${pad2(p.m)}`,
  "YYYY-MM-DD HH:mm:ss": (p) =>
    `${zeroFill(p.y, 4)}-${pad2(p.M + 1)}-${pad2(p.D)} ${pad2(p.H)}:${pad2(p.m)}:${pad2(p.s)}`,
  "YYYY-MM-DD HH:mm:ss.SSS": (p) =>
    `${zeroFill(p.y, 4)}-${pad2(p.M + 1)}-${pad2(p.D)} ${pad2(p.H)}:${pad2(p.m)}:${pad2(p.s)}.${pad3(p.ms)}`,
};

function formatPureToken(
  m: FormattableMoment,
  format: string,
  loc: Record<string, unknown>,
): string | undefined {
  const raw = m as unknown as {
    _isValid: boolean;
    _p: P2 & { dirty: boolean };
  };
  if (!raw._isValid || raw._p.y < 0 || raw._p.y > 9999) {
    return undefined;
  }
  if (raw._p.dirty) {
    (m as unknown as { _ensureFields: () => void })._ensureFields();
  }
  return pure[format]?.(raw._p, loc);
}

interface P3 {
  y: number;
  M: number;
  D: number;
  W: number;
  H: number;
  m: number;
  s: number;
  ms: number;
}

const enTmts = {
  "YYYY-MM-DD": (_r: P3, datePart: string) => datePart,
  "HH:mm:ss": (r: P3) => `${pad2(r.H)}:${pad2(r.m)}:${pad2(r.s)}`,
  "HH:mm:ss.SSS": (r: P3) => `${pad2(r.H)}:${pad2(r.m)}:${pad2(r.s)}.${pad3(r.ms)}`,
  "YYYY-MM-DD HH:mm:ss": (r: P3, datePart: string) =>
    `${datePart} ${pad2(r.H)}:${pad2(r.m)}:${pad2(r.s)}`,
  "YYYY-MM-DD HH:mm:ss.SSS": (r: P3, datePart: string) =>
    `${datePart} ${pad2(r.H)}:${pad2(r.m)}:${pad2(r.s)}.${pad3(r.ms)}`,
  LT: (r: P3) => `${fmt12H(r.H)}:${pad2(r.m)} ${fmtAmPm(r.H)}`,
  LTS: (r: P3) => `${fmt12H(r.H)}:${pad2(r.m)}:${pad2(r.s)} ${fmtAmPm(r.H)}`,
  L: (r: P3) => `${pad2(r.M + 1)}/${pad2(r.D)}/${zeroFill(r.y, 4)}`,
  l: (r: P3) => `${r.M + 1}/${r.D}/${zeroFill(r.y, 4)}`,
  LL: (r: P3) => `${enMonths[r.M]} ${r.D}, ${zeroFill(r.y, 4)}`,
  ll: (r: P3) => `${enMonthsShort[r.M]} ${r.D}, ${zeroFill(r.y, 4)}`,
  LLL: (r: P3) =>
    `${enMonths[r.M]} ${r.D}, ${zeroFill(r.y, 4)} ${fmt12H(r.H)}:${pad2(r.m)} ${fmtAmPm(r.H)}`,
  lll: (r: P3) =>
    `${enMonthsShort[r.M]} ${r.D}, ${zeroFill(r.y, 4)} ${fmt12H(r.H)}:${pad2(r.m)} ${fmtAmPm(r.H)}`,
  LLLL: (r: P3) =>
    `${enWeekdays[r.W]}, ${enMonths[r.M]} ${r.D}, ${zeroFill(r.y, 4)} ${fmt12H(r.H)}:${pad2(r.m)} ${fmtAmPm(r.H)}`,
  llll: (r: P3) =>
    `${enWeekdaysShort[r.W]}, ${enMonthsShort[r.M]} ${r.D}, ${zeroFill(r.y, 4)} ${fmt12H(r.H)}:${pad2(r.m)} ${fmtAmPm(r.H)}`,
  dddd: (r: P3) => enWeekdays[r.W],
  ddd: (r: P3) => enWeekdaysShort[r.W],
  dd: (r: P3) => enWeekdaysMin[r.W],
  Do: (r: P3) => `${r.D}${ordinalSuffix(r.D)}`,
  MMMM: (r: P3) => enMonths[r.M],
  MMM: (r: P3) => enMonthsShort[r.M],
  A: (r: P3) => fmtAmPm(r.H),
  a: (r: P3) => fmtAmPm(r.H).toLowerCase(),
  h: (r: P3) => String(fmt12H(r.H)),
  "h:mm:ss a": (r: P3) => `${fmt12H(r.H)}:${pad2(r.m)}:${pad2(r.s)} ${fmtAmPm(r.H).toLowerCase()}`,
  "dddd, MMMM Do YYYY, h:mm:ss a": (r: P3) =>
    `${enWeekdays[r.W]}, ${enMonths[r.M]} ${r.D}${ordinalSuffix(r.D)} ${zeroFill(r.y, 4)}, ${fmt12H(r.H)}:${pad2(r.m)}:${pad2(r.s)} ${fmtAmPm(r.H).toLowerCase()}`,
};

function formatCommonEn(m: FormattableMoment, format: string): string | undefined {
  const raw = m as unknown as {
    _l: string;
    _isValid: boolean;
    _p: P3 & { dirty: boolean };
  };
  if (raw._l !== "en" || !raw._isValid) {
    return undefined;
  }
  if (raw._p.dirty) {
    (m as unknown as { _ensureFields: () => void })._ensureFields();
  }
  const p = raw._p;
  if (p.y < 0 || p.y > 9999) {
    return undefined;
  }
  const datePart = `${zeroFill(p.y, 4)}-${pad2(p.M + 1)}-${pad2(p.D)}`;
  if (format === "YYYY-MM-DDTHH:mm:ss.SSSZ") {
    return `${datePart}T${pad2(p.H)}:${pad2(p.m)}:${pad2(p.s)}.${pad3(p.ms)}${formatOffset(m.utcOffset())}`;
  }
  return (enTmts as Record<string, (r: P3, datePart?: string) => string | undefined>)[format]?.(
    p,
    datePart,
  );
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

  const fast = formatPureToken(m, format, loc as unknown as Record<string, unknown>);
  if (fast !== undefined) {
    setCurrentLocale(undefined);
    return localePostformat(loc, fast);
  }

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
