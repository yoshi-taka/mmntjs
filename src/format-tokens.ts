import type { Moment } from "./moment-class";
import type { Locale } from "./locale-runtime";
import {
  localeMeridiem,
  localeMonths,
  localeMonthsShort,
  localeOrdinal,
  localeWeekdays,
  localeWeekdaysMin,
  localeWeekdaysShort,
  setBuildRenderFns,
} from "./locale-runtime";
import { zeroFill } from "./utils";

export let currentFormat: string | undefined;
export let currentLocale: Locale | undefined;

export function setCurrentFormat(fmt: string | undefined) {
  currentFormat = fmt;
}
export function setCurrentLocale(loc: Locale | undefined) {
  currentLocale = loc;
}

function y(m: Moment): number {
  return m.year();
}
function D(m: Moment): number {
  return m.date();
}

function getEraInfo(m: Moment, loc: Locale): { era: unknown; eraYear: number } | null {
  const eras = loc._config.eras as Record<string, unknown>[] | undefined;
  if (!eras || !Array.isArray(eras) || eras.length === 0) {
    return null;
  }
  const yv = y(m);
  const month1 = m.month() + 1;
  const dv = D(m);
  function dateToNum(dateStr: string): number {
    const m2 = dateStr.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
    if (!m2) {
      return -Infinity;
    }
    const yr = parseInt(m2[1], 10);
    return (yr + 100000) * 10000 + parseInt(m2[2], 10) * 100 + parseInt(m2[3], 10);
  }
  const current = (yv + 100000) * 10000 + month1 * 100 + dv;
  for (const era of eras) {
    const sinceStr = era.since != null ? String(era.since as string | number) : null;
    let untilVal = Infinity;
    if (era.until != null) {
      if (typeof era.until === "number") {
        untilVal = era.until;
      } else {
        const uStr = String(era.until as string);
        const uMatch = uStr.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
        if (uMatch) {
          const uy = parseInt(uMatch[1], 10);
          untilVal =
            (uy + 100000) * 10000 + parseInt(uMatch[2], 10) * 100 + parseInt(uMatch[3], 10);
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
      if (yv <= 0 && sy === 0) {
        eraYear = 1 - yv;
      } else {
        eraYear = yv - sy + ((era.offset as number) || 1);
      }
      return { era, eraYear };
    }
  }
  return null;
}

export type RenderFn = (m: Moment) => string;
export type TokenEntry = { token: string; fn: RenderFn };

const tokenFnMap: Record<string, RenderFn> = {
  YYYY: (m) => {
    const v = m.year();
    return v < 0 ? `-${zeroFill(-v, 4)}` : zeroFill(v, 4);
  },
  YY: (m) => {
    const v = m.year() % 100;
    return v < 0 ? `-${zeroFill(-v, 2)}` : zeroFill(v, 2);
  },
  Y: (m) => {
    const v = m.year();
    return v < 0 ? `-${zeroFill(-v, 4)}` : v > 9999 ? `+${zeroFill(v, 5)}` : zeroFill(v, 4);
  },
  YYYYY: (m) => {
    const v = m.year();
    return v < 0 ? `-${zeroFill(-v, 5)}` : zeroFill(v, 5);
  },
  YYYYYY: (m) => (m.year() >= 0 ? "+" : "-") + zeroFill(Math.abs(m.year()), 6),
  GGGGG: (m) => zeroFill(m.isoWeekYear(), 5),
  GGGG: (m) => zeroFill(m.isoWeekYear(), 4),
  GGG: (m) => zeroFill(m.isoWeekYear(), 3),
  GG: (m) => zeroFill(m.isoWeekYear() % 100, 2),
  G: (m) => String(m.isoWeekYear()),
  ggggg: (m) => zeroFill(m.weekYear(), 5),
  gggg: (m) => zeroFill(m.weekYear(), 4),
  ggg: (m) => zeroFill(m.weekYear(), 3),
  gg: (m) => zeroFill(m.weekYear() % 100, 2),
  g: (m) => String(m.weekYear()),
  Q: (m) => String(Math.ceil((m.month() + 1) / 3)),
  Qo: (m) => localeOrdinal(currentLocale!, Math.ceil((m.month() + 1) / 3), "Q"),
  M: (m) => String(m.month() + 1),
  MM: (m) => zeroFill(m.month() + 1, 2),
  MMM: (m) => localeMonthsShort(currentLocale!, m, currentFormat) as string,
  MMMM: (m) => localeMonths(currentLocale!, m, currentFormat) as string,
  Mo: (m) => localeOrdinal(currentLocale!, m.month() + 1, "M"),
  D: (m) => String(m.date()),
  DD: (m) => zeroFill(m.date(), 2),
  Do: (m) => localeOrdinal(currentLocale!, m.date(), "D"),
  do: (m) => localeOrdinal(currentLocale!, m.day(), "d"),
  d: (m) => String(m.day()),
  dd: (m) => localeWeekdaysMin(currentLocale!, m, currentFormat) as string,
  ddd: (m) => localeWeekdaysShort(currentLocale!, m, currentFormat) as string,
  dddd: (m) => localeWeekdays(currentLocale!, m, currentFormat) as string,
  e: (m) => String(m.weekday()),
  E: (m) => String(m.isoWeekday()),
  w: (m) => String(m.week()),
  ww: (m) => zeroFill(m.week(), 2),
  wo: (m) => localeOrdinal(currentLocale!, m.week(), "w"),
  W: (m) => String(m.isoWeek()),
  WW: (m) => zeroFill(m.isoWeek(), 2),
  Wo: (m) => localeOrdinal(currentLocale!, m.isoWeek(), "W"),
  DDDo: (m) => localeOrdinal(currentLocale!, m.dayOfYear(), "DDD"),
  DDD: (m) => String(m.dayOfYear()),
  DDDD: (m) => zeroFill(m.dayOfYear(), 3),
  H: (m) => String(m.hour()),
  HH: (m) => zeroFill(m.hour(), 2),
  h: (m) => {
    const v = m.hour() % 12 || 12;
    return String(v);
  },
  hh: (m) => {
    const v = m.hour() % 12 || 12;
    return zeroFill(v, 2);
  },
  k: (m) => {
    const v = m.hour();
    return String(v === 0 ? 24 : v);
  },
  kk: (m) => {
    const v = m.hour();
    return zeroFill(v === 0 ? 24 : v, 2);
  },
  m: (m) => String(m.minute()),
  mm: (m) => zeroFill(m.minute(), 2),
  s: (m) => String(m.second()),
  ss: (m) => zeroFill(m.second(), 2),
  hmm: (m) => {
    const h = m.hour() % 12 || 12;
    return String(h) + zeroFill(m.minute(), 2);
  },
  hmmss: (m) => {
    const h = m.hour() % 12 || 12;
    return String(h) + zeroFill(m.minute(), 2) + zeroFill(m.second(), 2);
  },
  Hmm: (m) => String(m.hour()) + zeroFill(m.minute(), 2),
  Hmmss: (m) => String(m.hour()) + zeroFill(m.minute(), 2) + zeroFill(m.second(), 2),
  t: (m) => localeMeridiem(currentLocale!, m.hour(), m.minute(), true).charAt(0),
  tt: (m) => localeMeridiem(currentLocale!, m.hour(), m.minute(), true),
  A: (m) => localeMeridiem(currentLocale!, m.hour(), m.minute(), false),
  a: (m) => localeMeridiem(currentLocale!, m.hour(), m.minute(), true),
  S: (m) => String(Math.floor(m.millisecond() / 100)),
  SS: (m) => zeroFill(Math.floor(m.millisecond() / 10), 2),
  SSS: (m) => zeroFill(m.millisecond(), 3),
  SSSS: (m) => `${zeroFill(m.millisecond(), 3)}0`,
  SSSSS: (m) => `${zeroFill(m.millisecond(), 3)}00`,
  SSSSSS: (m) => `${zeroFill(m.millisecond(), 3)}000`,
  SSSSSSS: (m) => `${zeroFill(m.millisecond(), 3)}0000`,
  SSSSSSSS: (m) => `${zeroFill(m.millisecond(), 3)}00000`,
  SSSSSSSSS: (m) => `${zeroFill(m.millisecond(), 3)}000000`,
  Z: (m) => {
    const o = m.utcOffset();
    const s = o >= 0 ? "+" : "-";
    const a = Math.abs(o);
    return `${s + zeroFill(Math.floor(a / 60), 2)}:${zeroFill(a % 60, 2)}`;
  },
  ZZ: (m) => {
    const o = m.utcOffset();
    const s = o >= 0 ? "+" : "-";
    const a = Math.abs(o);
    return `${s + zeroFill(Math.floor(a / 60), 2)}${zeroFill(a % 60, 2)}`;
  },
  z: (m) => {
    const z = (m as unknown as Record<string, unknown>)._z as
      | { abbr: (ts: number) => string }
      | undefined;
    if (z) {
      return z.abbr(m.valueOf());
    }
    if (m._p.isUTC) {
      return "UTC";
    }
    return "";
  },
  zz: (m) => {
    const z = (m as unknown as Record<string, unknown>)._z as
      | { abbr: (ts: number) => string }
      | undefined;
    if (z) {
      return z.abbr(m.valueOf());
    }
    if (m._p.isUTC) {
      return "Coordinated Universal Time";
    }
    return "";
  },
  N: (m) => {
    const info = getEraInfo(m, currentLocale!);
    return info ? ((info.era as Record<string, unknown>).abbr as string) : "";
  },
  NN: (m) => {
    const info = getEraInfo(m, currentLocale!);
    return info ? ((info.era as Record<string, unknown>).abbr as string) : "";
  },
  NNN: (m) => {
    const info = getEraInfo(m, currentLocale!);
    return info ? ((info.era as Record<string, unknown>).abbr as string) : "";
  },
  NNNN: (m) => {
    const info = getEraInfo(m, currentLocale!);
    return info ? ((info.era as Record<string, unknown>).name as string) : "";
  },
  NNNNN: (m) => {
    const info = getEraInfo(m, currentLocale!);
    return info ? ((info.era as Record<string, unknown>).narrow as string) : "";
  },
  y: (m) => {
    const info = getEraInfo(m, currentLocale!);
    const v = info ? info.eraYear : m.year();
    if (v < 0) {
      return `-${zeroFill(-v, 4)}`;
    }
    return String(v);
  },
  yy: (m) => {
    const info = getEraInfo(m, currentLocale!);
    const v = info ? info.eraYear : m.year();
    return zeroFill(Math.abs(v), 2);
  },
  yyy: (m) => {
    const info = getEraInfo(m, currentLocale!);
    const v = info ? info.eraYear : m.year();
    if (v < 0) {
      return `-${zeroFill(-v, 3)}`;
    }
    return zeroFill(v, 3);
  },
  yyyy: (m) => {
    const info = getEraInfo(m, currentLocale!);
    const v = info ? info.eraYear : m.year();
    if (v < 0) {
      return `-${zeroFill(-v, 4)}`;
    }
    return zeroFill(v, 4);
  },
  yo: (m) => {
    const info = getEraInfo(m, currentLocale!);
    const loc = currentLocale!;
    if (info) {
      return localeOrdinal(loc, info.eraYear, "y");
    }
    return localeOrdinal(loc, m.year(), "y");
  },
  X: (m) => String(Math.floor(m.valueOf() / 1000)),
  x: (m) => String(m.valueOf()),
};

const TOKEN_BY_CHAR_TABLE: (TokenEntry[] | undefined)[] = Array.from({ length: 128 });
for (const key of Object.keys(tokenFnMap)) {
  const cc = key.charCodeAt(0);
  if (cc >= 128) {
    continue;
  }
  let tokens = TOKEN_BY_CHAR_TABLE[cc];
  if (tokens === undefined) {
    tokens = [];
    TOKEN_BY_CHAR_TABLE[cc] = tokens;
  }
  tokens.push({ token: key, fn: tokenFnMap[key] });
}
for (let ci = 0; ci < 128; ci++) {
  const tokens = TOKEN_BY_CHAR_TABLE[ci];
  if (tokens) {
    tokens.sort((a, b) => b.token.length - a.token.length);
  }
}
export function buildRenderFns(format: string): RenderFn[] {
  const result: RenderFn[] = [];
  let i = 0;
  const len = format.length;

  while (i < len) {
    const ch = format[i];

    if (ch === "\\" && i + 1 < len) {
      const literal = format[i + 1];
      result.push(() => literal);
      i += 2;
      continue;
    }

    if (ch === "[") {
      const close = format.indexOf("]", i);
      if (close !== -1) {
        const literal = format.slice(i + 1, close);
        result.push(() => literal);
        i = close + 1;
        continue;
      }
    }

    const cc = ch.charCodeAt(0);
    const tokens = cc < 128 ? TOKEN_BY_CHAR_TABLE[cc] : undefined;
    if (tokens) {
      let matched = false;
      for (const t of tokens) {
        if (format.startsWith(t.token, i)) {
          result.push(t.fn);
          i += t.token.length;
          matched = true;
          break;
        }
      }
      if (matched) {
        continue;
      }
    }

    if (i + 1 < len) {
      const nextCC = format.charCodeAt(i + 1);
      if (nextCC !== 91 && (nextCC >= 128 || TOKEN_BY_CHAR_TABLE[nextCC] === undefined)) {
        let j = i + 2;
        while (j < len) {
          const cj = format.charCodeAt(j);
          if (cj === 91 || (cj < 128 && TOKEN_BY_CHAR_TABLE[cj] !== undefined)) {
            break;
          }
          j++;
        }
        const literal = format.slice(i, j);
        result.push(() => literal);
        i = j;
        continue;
      }
    }
    result.push(() => ch);
    i++;
  }

  return result;
}

setBuildRenderFns(buildRenderFns);
