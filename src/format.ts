import type { Moment } from "./moment_fixed";
import type { Locale } from "./locale";
import { zeroFill, LruMap } from "./utils";

let currentFormat: string | undefined;
let currentLocale: Locale | undefined;

export function setCurrentFormat(fmt: string | undefined) {
  currentFormat = fmt;
}

function year(m: Moment): number {
  return m.year() as number;
}

function getEraInfo(m: Moment, loc: Locale): { era: unknown; eraYear: number } | null {
  const eras = (loc._config as Record<string, unknown>).eras as Array<Record<string, unknown>> | undefined;
  if (!eras || !Array.isArray(eras) || eras.length === 0) {return null;}
  const y = year(m);
  const month1 = (m.month() as number) + 1;
  const d = m.date() as number;

  function dateToNum(dateStr: string): number {
    const m2 = dateStr.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
    if (!m2) {return -Infinity;}
    const yr = parseInt(m2[1], 10);
    return (yr + 100000) * 10000 + parseInt(m2[2], 10) * 100 + parseInt(m2[3], 10);
  }

  const current = (y + 100000) * 10000 + month1 * 100 + d;

  for (const era of eras) {
    const sinceStr = era.since != null ? String(era.since) : null;
    let untilVal = Infinity;
    if (era.until != null) {
      if (typeof era.until === "number") {
        untilVal = era.until;
      } else {
        const uStr = String(era.until);
        const uMatch = uStr.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
        if (uMatch) {
          const uy = parseInt(uMatch[1], 10);
          untilVal = (uy + 100000) * 10000 + parseInt(uMatch[2], 10) * 100 + parseInt(uMatch[3], 10);
        }
      }
    }
    const sinceVal = sinceStr ? dateToNum(sinceStr) : -Infinity;

    const lower = Math.min(sinceVal, untilVal);
    const upper = Math.max(sinceVal, untilVal);
    if (current >= lower && current <= upper) {
      const sinceMatch = sinceStr ? sinceStr.match(/^(-?\d+)-/) : null;
      const sy = sinceMatch ? parseInt(sinceMatch[1], 10) : 0;
      let eraYear: number;
      if (y <= 0 && sy === 0) {
        eraYear = 1 - y;
      } else {
        eraYear = y - sy + (era.offset as number || 1);
      }
      return { era, eraYear };
    }
  }
  return null;
}
function month(m: Moment): number {
  return m.month() as number;
}
function date(m: Moment): number {
  return m.date() as number;
}
function day(m: Moment): number {
  return m.day() as number;
}
function hour(m: Moment): number {
  return m.hour() as number;
}
function minute(m: Moment): number {
  return m.minute() as number;
}
function second(m: Moment): number {
  return m.second() as number;
}
function millisecond(m: Moment): number {
  return m.millisecond() as number;
}
function isoWeekday(m: Moment): number {
  return m.isoWeekday() as number;
}
function dayOfYear(m: Moment): number {
  return m.dayOfYear() as number;
}
function utcOffset(m: Moment): number {
  return m.utcOffset() as number;
}
function isoWeekYear(m: Moment): number {
  return m.isoWeekYear() as number;
}
function isoWeek(m: Moment): number {
  return m.isoWeek() as number;
}
function localeWeekday(m: Moment): number {
  return m.weekday() as number;
}
function localeWeek(m: Moment): number {
  return m.week() as number;
}

export const formatToken: Record<string, (m: Moment) => string> = {
  YYYY(m: Moment): string {
    const y = year(m);
    if (y < 0) {return `-${  zeroFill(-y, 4)}`;}
    return zeroFill(y, 4);
  },
  YY(m: Moment): string {
    const y = year(m) % 100;
    if (y < 0) {return `-${  zeroFill(-y, 2)}`;}
    return zeroFill(y, 2);
  },
  Y(m: Moment): string {
    const y = year(m);
    if (y < 0) {return `-${  zeroFill(-y, 4)}`;}
    if (y > 9999) {return `+${  zeroFill(y, 5)}`;}
    return zeroFill(y, 4);
  },
  YYYYY(m: Moment): string {
    const y = year(m);
    if (y < 0) {return `-${  zeroFill(-y, 5)}`;}
    return zeroFill(y, 5);
  },
  YYYYYY(m: Moment): string {
    const y = year(m);
    const sign = y >= 0 ? "+" : "-";
    return sign + zeroFill(Math.abs(y), 6);
  },
  GGGGG(m: Moment): string {
    return zeroFill(isoWeekYear(m), 5);
  },
  GGGG(m: Moment): string {
    return zeroFill(isoWeekYear(m), 4);
  },
  GGG(m: Moment): string {
    return zeroFill(isoWeekYear(m), 3);
  },
  GG(m: Moment): string {
    return zeroFill(isoWeekYear(m) % 100, 2);
  },
  G(m: Moment): string {
    return String(isoWeekYear(m));
  },
  ggggg(m: Moment): string {
    return zeroFill(m.weekYear() as number, 5);
  },
  gggg(m: Moment): string {
    return zeroFill(m.weekYear() as number, 4);
  },
  ggg(m: Moment): string {
    return zeroFill(m.weekYear() as number, 3);
  },
  gg(m: Moment): string {
    return zeroFill((m.weekYear() as number) % 100, 2);
  },
  g(m: Moment): string {
    return String(m.weekYear());
  },
  Q(m: Moment): string {
    return String(Math.ceil((month(m) + 1) / 3));
  },
  Qo(m: Moment): string {
    return currentLocale!.ordinal(Math.ceil((month(m) + 1) / 3), "Q");
  },
  M(m: Moment): string {
    return String(month(m) + 1);
  },
  MM(m: Moment): string {
    return zeroFill(month(m) + 1, 2);
  },
  MMM(m: Moment): string {
    return currentLocale!.monthsShort(m, currentFormat) as string;
  },
  MMMM(m: Moment): string {
    return currentLocale!.months(m, currentFormat) as string;
  },
  Mo(m: Moment): string {
    return currentLocale!.ordinal(month(m) + 1, "M");
  },
  D(m: Moment): string {
    return String(date(m));
  },
  DD(m: Moment): string {
    return zeroFill(date(m), 2);
  },
  Do(m: Moment): string {
    return currentLocale!.ordinal(date(m), "D");
  },
  do(m: Moment): string {
    return currentLocale!.ordinal(day(m), "d");
  },
  d(m: Moment): string {
    return String(day(m));
  },
  dd(m: Moment): string {
    return currentLocale!.weekdaysMin(m, currentFormat) as string;
  },
  ddd(m: Moment): string {
    return currentLocale!.weekdaysShort(m, currentFormat) as string;
  },
  dddd(m: Moment): string {
    return currentLocale!.weekdays(m, currentFormat) as string;
  },
  e(m: Moment): string {
    return String(localeWeekday(m));
  },
  E(m: Moment): string {
    return String(isoWeekday(m));
  },
  w(m: Moment): string {
    return String(localeWeek(m));
  },
  ww(m: Moment): string {
    return zeroFill(localeWeek(m), 2);
  },
  wo(m: Moment): string {
    return currentLocale!.ordinal(localeWeek(m), "w");
  },
  W(m: Moment): string {
    return String(isoWeek(m));
  },
  WW(m: Moment): string {
    return zeroFill(isoWeek(m), 2);
  },
  Wo(m: Moment): string {
    return currentLocale!.ordinal(isoWeek(m), "W");
  },
  DDDo(m: Moment): string {
    return currentLocale!.ordinal(dayOfYear(m), "DDD");
  },
  DDD(m: Moment): string {
    return String(dayOfYear(m));
  },
  DDDD(m: Moment): string {
    return zeroFill(dayOfYear(m), 3);
  },
  H(m: Moment): string {
    return String(hour(m));
  },
  HH(m: Moment): string {
    return zeroFill(hour(m), 2);
  },
  h(m: Moment): string {
    const h = hour(m) % 12 || 12;
    return String(h);
  },
  hh(m: Moment): string {
    const h = hour(m) % 12 || 12;
    return zeroFill(h, 2);
  },
  k(m: Moment): string {
    const h = hour(m);
    return String(h === 0 ? 24 : h);
  },
  kk(m: Moment): string {
    const h = hour(m);
    return zeroFill(h === 0 ? 24 : h, 2);
  },
  m(m: Moment): string {
    return String(minute(m));
  },
  mm(m: Moment): string {
    return zeroFill(minute(m), 2);
  },
  s(m: Moment): string {
    return String(second(m));
  },
  ss(m: Moment): string {
    return zeroFill(second(m), 2);
  },
  hmm(m: Moment): string {
    const h = hour(m) % 12 || 12;
    return String(h) + zeroFill(minute(m), 2);
  },
  hmmss(m: Moment): string {
    const h = hour(m) % 12 || 12;
    return String(h) + zeroFill(minute(m), 2) + zeroFill(second(m), 2);
  },
  Hmm(m: Moment): string {
    return String(hour(m)) + zeroFill(minute(m), 2);
  },
  Hmmss(m: Moment): string {
    return String(hour(m)) + zeroFill(minute(m), 2) + zeroFill(second(m), 2);
  },
  t(m: Moment): string {
    return currentLocale!.meridiem(hour(m), minute(m), true).charAt(0);
  },
  tt(m: Moment): string {
    return currentLocale!.meridiem(hour(m), minute(m), true);
  },
  S(m: Moment): string {
    return String(Math.floor(millisecond(m) / 100));
  },
  SS(m: Moment): string {
    return zeroFill(Math.floor(millisecond(m) / 10), 2);
  },
  SSS(m: Moment): string {
    return zeroFill(millisecond(m), 3);
  },
  Z(m: Moment): string {
    const offset = utcOffset(m);
    const sign = offset >= 0 ? "+" : "-";
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset / 60);
    const minutes = absOffset % 60;
    return `${sign + zeroFill(hours, 2)  }:${  zeroFill(minutes, 2)}`;
  },
  ZZ(m: Moment): string {
    const offset = utcOffset(m);
    const sign = offset >= 0 ? "+" : "-";
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset / 60);
    const minutes = absOffset % 60;
    return sign + zeroFill(hours, 2) + zeroFill(minutes, 2);
  },
  z(m: Moment): string {
    if (m._isUTC) {
      if (m._offset === 0) {return "UTC";}
      const offset = m._offset;
      const sign = offset >= 0 ? "+" : "-";
      const hours = Math.floor(Math.abs(offset) / 60);
      const minutes = Math.abs(offset) % 60;
      return `GMT${  sign  }${String(hours).padStart(2, "0")  }${String(minutes).padStart(2, "0")}`;
    }
    return "";
  },
  zz(m: Moment): string {
    if (m._isUTC && m._offset === 0) {return "Coordinated Universal Time";}
    return "";
  },
  A(m: Moment): string {
    return currentLocale!.meridiem(hour(m), minute(m), false) as string;
  },
  a(m: Moment): string {
    return currentLocale!.meridiem(hour(m), minute(m), true) as string;
  },
  N(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    return info ? info.era.abbr : "";
  },
  NN(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    return info ? info.era.abbr : "";
  },
  NNN(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    return info ? info.era.abbr : "";
  },
  NNNN(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    return info ? info.era.name : "";
  },
  NNNNN(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    return info ? info.era.narrow : "";
  },
  y(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    const y = info ? info.eraYear : year(m);
    if (y < 0) {return `-${  zeroFill(-y, 4)}`;}
    return String(y);
  },
  yy(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    const y = info ? info.eraYear : year(m);
    const abs = Math.abs(y);
    return zeroFill(abs, 2);
  },
  yyy(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    const y = info ? info.eraYear : year(m);
    if (y < 0) {return `-${  zeroFill(-y, 3)}`;}
    return zeroFill(y, 3);
  },
  yyyy(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    const y = info ? info.eraYear : year(m);
    if (y < 0) {return `-${  zeroFill(-y, 4)}`;}
    return zeroFill(y, 4);
  },
  yo(m: Moment): string {
    const info = getEraInfo(m, currentLocale!);
    const loc = currentLocale!;
    if (info) {
      return loc.ordinal(info.eraYear, "y");
    }
    return loc.ordinal(year(m), "y");
  },
  X(m: Moment): string {
    return String(Math.floor(m.valueOf() / 1000));
  },
  x(m: Moment): string {
    return String(m.valueOf());
  },
};

for (let i = 4; i <= 9; i++) {
  const key = "S".repeat(i);
  const fn = function (m: Moment): string {
    return String(millisecond(m)) + "0".repeat(i - 3);
  };
  formatToken[key] = fn;
}

const expandLocaleCache = new LruMap<string, string>(500);

const hasLocaleToken = /[Ll]/;

function expandLocaleTokens(m: Moment, format: string): string {
  if (!hasLocaleToken.test(format)) {return format;}

  const cacheKey = `${m._l  }:${  format}`;
  const cached = expandLocaleCache.get(cacheKey);
  if (cached !== undefined) {return cached;}

  const loc = currentLocale!;
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
      let longFmt = loc.longDateFormat(key);
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

type TokenEntry = { token: string; fn: (m: Moment) => string };
const tokenByChar: Record<string, { tokens: TokenEntry[]; maxLen: number }> = {};
for (const key of Object.keys(formatToken)) {
  const c = key[0];
  let entry = tokenByChar[c];
  if (!entry) { entry = { tokens: [], maxLen: 0 }; tokenByChar[c] = entry; }
  entry.tokens.push({ token: key, fn: formatToken[key] });
  if (key.length > entry.maxLen) {entry.maxLen = key.length;}
}
for (const c in tokenByChar) {
  tokenByChar[c].tokens.sort((a, b) => b.token.length - a.token.length);
}

const PAD2 = [
  "00", "01", "02", "03", "04", "05", "06", "07", "08", "09",
  "10", "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
  "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "50", "51", "52", "53", "54", "55", "56", "57", "58", "59",
];

function padYear(y: number): string {
  return y < 10 ? `000${  y}` : y < 100 ? `00${  y}` : y < 1000 ? `0${  y}` : String(y);
}

function pad3(n: number): string {
  return n < 10 ? `00${  n}` : n < 100 ? `0${  n}` : String(n);
}

function formatOffset(offset: number): string {
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${sign + PAD2[Math.floor(abs / 60)]  }:${  PAD2[abs % 60]}`;
}

function formatCommonEn(m: Moment, format: string): string | undefined {
  const raw = m as unknown as { _l: string; $y: number; $M: number; $D: number; _isValid: boolean };
  if (raw._l !== "en" || !raw._isValid) {return undefined;}
  const y = raw.$y;
  if (y < 0 || y > 9999) {return undefined;}
  const datePart = `${padYear(y)  }-${  PAD2[raw.$M + 1]  }-${  PAD2[raw.$D]}`;
  switch (format) {
    case "YYYY-MM-DD":
      return datePart;
    case "HH:mm:ss":
      return `${PAD2[raw.$H]  }:${  PAD2[raw.$m]  }:${  PAD2[raw.$s]}`;
    case "HH:mm:ss.SSS":
      return `${PAD2[raw.$H]  }:${  PAD2[raw.$m]  }:${  PAD2[raw.$s]  }.${  pad3(raw.$ms)}`;
    case "YYYY-MM-DD HH:mm:ss":
      return `${datePart  } ${  PAD2[raw.$H]  }:${  PAD2[raw.$m]  }:${  PAD2[raw.$s]}`;
    case "YYYY-MM-DD HH:mm:ss.SSS":
      return `${datePart  } ${  PAD2[raw.$H]  }:${  PAD2[raw.$m]  }:${  PAD2[raw.$s]  }.${  pad3(raw.$ms)}`;
    case "YYYY-MM-DDTHH:mm:ss.SSSZ":
      return `${datePart  }T${  PAD2[raw.$H]  }:${  PAD2[raw.$m]  }:${  PAD2[raw.$s]  }.${  pad3(raw.$ms)  }${formatOffset(m.utcOffset() as number)}`;
  }
  return undefined;
}

export function formatMoment(m: Moment, format: string): string {
  const common = formatCommonEn(m, format);
  if (common !== undefined) {return common;}

  const loc = m.localeData();
  currentLocale = loc;

  if (!m._isValid) {
    currentLocale = undefined;
    return loc.invalidDate();
  }

  format = expandLocaleTokens(m, format);

  const fastPath = (loc._config as Record<string, unknown>)._formatFastPath as ((m: Moment, format: string) => string | undefined) | undefined;
  if (fastPath) {
    const result = fastPath(m, format);
    if (result !== undefined) {
      currentLocale = undefined;
      return loc.postformat(result);
    }
  }

  const savedFormat = currentFormat;
  currentFormat = format;
  const parts: string[] = [];
  let i = 0;
  const len = format.length;

  while (i < len) {
    const ch = format[i];

    if (ch === "[") {
      const close = format.indexOf("]", i);
      if (close !== -1) {
        parts.push(format.slice(i + 1, close));
        i = close + 1;
        continue;
      }
    }

    const entry = tokenByChar[ch];
    if (entry) {
      let matched = false;
      for (const t of entry.tokens) {
        if (format.startsWith(t.token, i)) {
          parts.push(t.fn(m));
          i += t.token.length;
          matched = true;
          break;
        }
      }
      if (matched) {continue;}
    }

    // Group consecutive non-token chars
    if (i + 1 < len) {
      const next = format[i + 1];
      if (next !== "[" && !tokenByChar[next]) {
        let j = i + 2;
        while (j < len) {
          const c = format[j];
          if (c === "[" || tokenByChar[c]) {break;}
          j++;
        }
        parts.push(format.slice(i, j));
        i = j;
        continue;
      }
    }
    parts.push(ch);
    i++;
  }

  currentFormat = savedFormat;
  currentLocale = undefined;
  return loc.postformat(parts.join(""));
}
