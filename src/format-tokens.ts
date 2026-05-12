import type { Moment } from "./moment2";
import type { Locale } from "./locale-runtime";
import { localeMeridiem, localeMonths, localeMonthsShort, localeOrdinal, localeWeekdays, localeWeekdaysMin, localeWeekdaysShort } from "./locale-runtime";
import { zeroFill } from "./utils";

export let currentFormat: string | undefined;
export let currentLocale: Locale | undefined;

export function setCurrentFormat(fmt: string | undefined) { currentFormat = fmt; }
export function setCurrentLocale(loc: Locale | undefined) { currentLocale = loc; }

function y(m: Moment): number { return m.year(); }
function M(m: Moment): number { return m.month(); }
function D(m: Moment): number { return m.date(); }
function d(m: Moment): number { return m.day(); }
function H(m: Moment): number { return m.hour(); }
function Mi(m: Moment): number { return m.minute(); }
function S(m: Moment): number { return m.second(); }
function Ms(m: Moment): number { return m.millisecond(); }
function isoWD(m: Moment): number { return m.isoWeekday(); }
function doy(m: Moment): number { return m.dayOfYear(); }
function uOff(m: Moment): number { return m.utcOffset(); }
function isoWY(m: Moment): number { return m.isoWeekYear(); }
function isoW(m: Moment): number { return m.isoWeek(); }
function locWD(m: Moment): number { return m.weekday(); }
function locW(m: Moment): number { return m.week(); }

function getEraInfo(m: Moment, loc: Locale): { era: unknown; eraYear: number } | null {
  const eras = loc._config.eras as Record<string, unknown>[] | undefined;
  if (!eras || !Array.isArray(eras) || eras.length === 0) {return null;}
  const yv = y(m);
  const month1 = m.month() + 1;
  const dv = D(m);
  function dateToNum(dateStr: string): number {
    const m2 = dateStr.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
    if (!m2) {return -Infinity;}
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

export function lit(s: string): RenderFn { return () => s; }

// Year
export function fnYYYY(m: Moment): string { const v = y(m); return v < 0 ? `-${zeroFill(-v, 4)}` : zeroFill(v, 4); }
export function fnYY(m: Moment): string { const v = y(m) % 100; return v < 0 ? `-${zeroFill(-v, 2)}` : zeroFill(v, 2); }
export function fnY(m: Moment): string { const v = y(m); if (v < 0) {return `-${zeroFill(-v, 4)}`;} if (v > 9999) {return `+${zeroFill(v, 5)}`;} return zeroFill(v, 4); }
export function fnYYYYY(m: Moment): string { const v = y(m); return v < 0 ? `-${zeroFill(-v, 5)}` : zeroFill(v, 5); }
export function fnYYYYYY(m: Moment): string { const v = y(m); return (v >= 0 ? "+" : "-") + zeroFill(Math.abs(v), 6); }
export function fnGGGGG(m: Moment): string { return zeroFill(isoWY(m), 5); }
export function fnGGGG(m: Moment): string { return zeroFill(isoWY(m), 4); }
export function fnGGG(m: Moment): string { return zeroFill(isoWY(m), 3); }
export function fnGG(m: Moment): string { return zeroFill(isoWY(m) % 100, 2); }
export function fnG(m: Moment): string { return String(isoWY(m)); }
export function fnggggg(m: Moment): string { return zeroFill(m.weekYear(), 5); }
export function fngggg(m: Moment): string { return zeroFill(m.weekYear(), 4); }
export function fnggg(m: Moment): string { return zeroFill(m.weekYear(), 3); }
export function fngg(m: Moment): string { return zeroFill(m.weekYear() % 100, 2); }
export function fng(m: Moment): string { return String(m.weekYear()); }

// Quarter
export function fnQ(m: Moment): string { return String(Math.ceil((M(m) + 1) / 3)); }
export function fnQo(m: Moment): string { return localeOrdinal(currentLocale!, Math.ceil((M(m) + 1) / 3), "Q"); }

// Month
export function fnM(m: Moment): string { return String(M(m) + 1); }
export function fnMM(m: Moment): string { return zeroFill(M(m) + 1, 2); }
export function fnMMM(m: Moment): string { return localeMonthsShort(currentLocale!, m, currentFormat) as string; }
export function fnMMMM(m: Moment): string { return localeMonths(currentLocale!, m, currentFormat) as string; }
export function fnMo(m: Moment): string { return localeOrdinal(currentLocale!, M(m) + 1, "M"); }

// Day of month
export function fnD(m: Moment): string { return String(D(m)); }
export function fnDD(m: Moment): string { return zeroFill(D(m), 2); }
export function fnDo(m: Moment): string { return localeOrdinal(currentLocale!, D(m), "D"); }
export function fndo(m: Moment): string { return localeOrdinal(currentLocale!, d(m), "d"); }

// Weekday
export function fnd(m: Moment): string { return String(d(m)); }
export function fndd(m: Moment): string { return localeWeekdaysMin(currentLocale!, m, currentFormat) as string; }
export function fnddd(m: Moment): string { return localeWeekdaysShort(currentLocale!, m, currentFormat) as string; }
export function fndddd(m: Moment): string { return localeWeekdays(currentLocale!, m, currentFormat) as string; }
export function fne(m: Moment): string { return String(locWD(m)); }
export function fnE(m: Moment): string { return String(isoWD(m)); }

// Week
export function fnw(m: Moment): string { return String(locW(m)); }
export function fnww(m: Moment): string { return zeroFill(locW(m), 2); }
export function fnwo(m: Moment): string { return localeOrdinal(currentLocale!, locW(m), "w"); }
export function fnW(m: Moment): string { return String(isoW(m)); }
export function fnWW(m: Moment): string { return zeroFill(isoW(m), 2); }
export function fnWo(m: Moment): string { return localeOrdinal(currentLocale!, isoW(m), "W"); }

// Day of year
export function fnDDDo(m: Moment): string { return localeOrdinal(currentLocale!, doy(m), "DDD"); }
export function fnDDD(m: Moment): string { return String(doy(m)); }
export function fnDDDD(m: Moment): string { return zeroFill(doy(m), 3); }

// Hour
export function fnH(m: Moment): string { return String(H(m)); }
export function fnHH(m: Moment): string { return zeroFill(H(m), 2); }
export function fnh(m: Moment): string { const v = H(m) % 12 || 12; return String(v); }
export function fnhh(m: Moment): string { const v = H(m) % 12 || 12; return zeroFill(v, 2); }
export function fnk(m: Moment): string { const v = H(m); return String(v === 0 ? 24 : v); }
export function fnkk(m: Moment): string { const v = H(m); return zeroFill(v === 0 ? 24 : v, 2); }

// Minute
export function fnm(m: Moment): string { return String(Mi(m)); }
export function fnmm(m: Moment): string { return zeroFill(Mi(m), 2); }

// Second
export function fns(m: Moment): string { return String(S(m)); }
export function fnss(m: Moment): string { return zeroFill(S(m), 2); }

// Combined hour+minute / hour+minute+second
export function fnhmm(m: Moment): string { const h = H(m) % 12 || 12; return String(h) + zeroFill(Mi(m), 2); }
export function fnhmmss(m: Moment): string { const h = H(m) % 12 || 12; return String(h) + zeroFill(Mi(m), 2) + zeroFill(S(m), 2); }
export function fnHmm(m: Moment): string { return String(H(m)) + zeroFill(Mi(m), 2); }
export function fnHmmss(m: Moment): string { return String(H(m)) + zeroFill(Mi(m), 2) + zeroFill(S(m), 2); }

// Meridiem
export function fnt(m: Moment): string { return localeMeridiem(currentLocale!, H(m), Mi(m), true).charAt(0); }
export function fntt(m: Moment): string { return localeMeridiem(currentLocale!, H(m), Mi(m), true); }
export function fnA(m: Moment): string { return localeMeridiem(currentLocale!, H(m), Mi(m), false); }
export function fna(m: Moment): string { return localeMeridiem(currentLocale!, H(m), Mi(m), true); }

// Millisecond
export function fnS(m: Moment): string { return String(Math.floor(Ms(m) / 100)); }
export function fnSS(m: Moment): string { return zeroFill(Math.floor(Ms(m) / 10), 2); }
export function fnSSS(m: Moment): string { return zeroFill(Ms(m), 3); }

// Timezone
export function fnZ(m: Moment): string {
  const offset = uOff(m);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${sign + zeroFill(Math.floor(abs / 60), 2)}:${zeroFill(abs % 60, 2)}`;
}
export function fnZZ(m: Moment): string {
  const offset = uOff(m);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return sign + zeroFill(Math.floor(abs / 60), 2) + zeroFill(abs % 60, 2);
}
export function fnz(m: Moment): string {
  if (m._isUTC) {
    if (m._offset === 0) {return "UTC";}
    const offset = m._offset;
    const sign = offset >= 0 ? "+" : "-";
    return `GMT${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}${String(Math.abs(offset) % 60).padStart(2, "0")}`;
  }
  return "";
}
export function fnzz(m: Moment): string {
  if (m._isUTC && m._offset === 0) {return "Coordinated Universal Time";}
  return "";
}

// Era
export function fnN(m: Moment): string { const info = getEraInfo(m, currentLocale!); return info ? (info.era as Record<string, unknown>).abbr as string : ""; }
export function fnNN(m: Moment): string { const info = getEraInfo(m, currentLocale!); return info ? (info.era as Record<string, unknown>).abbr as string : ""; }
export function fnNNN(m: Moment): string { const info = getEraInfo(m, currentLocale!); return info ? (info.era as Record<string, unknown>).abbr as string : ""; }
export function fnNNNN(m: Moment): string { const info = getEraInfo(m, currentLocale!); return info ? (info.era as Record<string, unknown>).name as string : ""; }
export function fnNNNNN(m: Moment): string { const info = getEraInfo(m, currentLocale!); return info ? (info.era as Record<string, unknown>).narrow as string : ""; }
export function fny(m: Moment): string {
  const info = getEraInfo(m, currentLocale!);
  const v = info ? info.eraYear : y(m);
  if (v < 0) {return `-${zeroFill(-v, 4)}`;}
  return String(v);
}
export function fnyy(m: Moment): string {
  const info = getEraInfo(m, currentLocale!);
  const v = info ? info.eraYear : y(m);
  return zeroFill(Math.abs(v), 2);
}
export function fnyyy(m: Moment): string {
  const info = getEraInfo(m, currentLocale!);
  const v = info ? info.eraYear : y(m);
  if (v < 0) {return `-${zeroFill(-v, 3)}`;}
  return zeroFill(v, 3);
}
export function fnyyyy(m: Moment): string {
  const info = getEraInfo(m, currentLocale!);
  const v = info ? info.eraYear : y(m);
  if (v < 0) {return `-${zeroFill(-v, 4)}`;}
  return zeroFill(v, 4);
}
export function fnyo(m: Moment): string {
  const info = getEraInfo(m, currentLocale!);
  const loc = currentLocale!;
  if (info) {return localeOrdinal(loc, info.eraYear, "y");}
  return localeOrdinal(loc, y(m), "y");
}

// Unix timestamp
export function fnX(m: Moment): string { return String(Math.floor(m.valueOf() / 1000)); }
export function fnx(m: Moment): string { return String(m.valueOf()); }

// S... (sub-second, 4-9 digits)
export function fnS4(m: Moment): string { return `${String(Ms(m))  }0`; }
export function fnS5(m: Moment): string { return `${String(Ms(m))  }00`; }
export function fnS6(m: Moment): string { return `${String(Ms(m))  }000`; }
export function fnS7(m: Moment): string { return `${String(Ms(m))  }0000`; }
export function fnS8(m: Moment): string { return `${String(Ms(m))  }00000`; }
export function fnS9(m: Moment): string { return `${String(Ms(m))  }000000`; }

// Lookup from token name to RenderFn
const tokenFnMap: Record<string, RenderFn> = {
  YYYY: fnYYYY, YY: fnYY, Y: fnY, YYYYY: fnYYYYY, YYYYYY: fnYYYYYY,
  GGGGG: fnGGGGG, GGGG: fnGGGG, GGG: fnGGG, GG: fnGG, G: fnG,
  ggggg: fnggggg, gggg: fngggg, ggg: fnggg, gg: fngg, g: fng,
  Q: fnQ, Qo: fnQo,
  M: fnM, MM: fnMM, MMM: fnMMM, MMMM: fnMMMM, Mo: fnMo,
  D: fnD, DD: fnDD, Do: fnDo, do: fndo,
  d: fnd, dd: fndd, ddd: fnddd, dddd: fndddd, e: fne, E: fnE,
  w: fnw, ww: fnww, wo: fnwo, W: fnW, WW: fnWW, Wo: fnWo,
  DDDo: fnDDDo, DDD: fnDDD, DDDD: fnDDDD,
  H: fnH, HH: fnHH, h: fnh, hh: fnhh, k: fnk, kk: fnkk,
  m: fnm, mm: fnmm,
  s: fns, ss: fnss,
  hmm: fnhmm, hmmss: fnhmmss, Hmm: fnHmm, Hmmss: fnHmmss,
  t: fnt, tt: fntt, A: fnA, a: fna,
  S: fnS, SS: fnSS, SSS: fnSSS, SSSS: fnS4, SSSSS: fnS5, SSSSSS: fnS6,
  SSSSSSS: fnS7, SSSSSSSS: fnS8, SSSSSSSSS: fnS9,
  Z: fnZ, ZZ: fnZZ, z: fnz, zz: fnzz,
  N: fnN, NN: fnNN, NNN: fnNNN, NNNN: fnNNNN, NNNNN: fnNNNNN,
  y: fny, yy: fnyy, yyy: fnyyy, yyyy: fnyyyy, yo: fnyo,
  X: fnX, x: fnx,
};

export const tokenByChar: Record<string, { tokens: TokenEntry[]; maxLen: number } | undefined> = {};
for (const key of Object.keys(tokenFnMap)) {
  const c = key[0];
  let entry = tokenByChar[c];
  if (entry === undefined) { entry = { tokens: [], maxLen: 0 }; tokenByChar[c] = entry; }
  entry.tokens.push({ token: key, fn: tokenFnMap[key] });
  if (key.length > entry.maxLen) {entry.maxLen = key.length;}
}
for (const c in tokenByChar) {
  tokenByChar[c]!.tokens.sort((a, b) => b.token.length - a.token.length);
}

export function buildRenderFns(format: string): RenderFn[] {
  const result: RenderFn[] = [];
  let i = 0;
  const len = format.length;

  while (i < len) {
    const ch = format[i];

    if (ch === "[") {
      const close = format.indexOf("]", i);
      if (close !== -1) {
        const literal = format.slice(i + 1, close);
        result.push(() => literal);
        i = close + 1;
        continue;
      }
    }

    const entry = tokenByChar[ch];
    if (entry) {
      let matched = false;
      for (const t of entry.tokens) {
        if (format.startsWith(t.token, i)) {
          result.push(t.fn);
          i += t.token.length;
          matched = true;
          break;
        }
      }
      if (matched) {continue;}
    }

    if (i + 1 < len) {
      const next = format[i + 1];
      if (next !== "[" && tokenByChar[next] === undefined) {
        let j = i + 2;
        while (j < len) {
          const c = format[j];
          if (c === "[" || tokenByChar[c] !== undefined) {break;}
          j++;
        }
        const literal = format.slice(i, j);
        result.push(() => literal);
        i = j;
        continue;
      }
    }
    const literal = ch;
    result.push(() => literal);
    i++;
  }

  return result;
}

export const formatToken = tokenFnMap;

export function lowerVariant(fmt: string): string {
  return fmt.replaceAll("MMMM", "MMM").replaceAll("dddd", "ddd")
    .replaceAll('MM', "M").replaceAll('DD', "D")
    .replaceAll('mm', "m").replaceAll('ss', "s").replaceAll('hh', "h");
}
