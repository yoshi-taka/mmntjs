import { escapeRegex, LruMap } from "./utils";
import type { ParseLocale } from "./parse-locale";
import type { CachedParseLocale } from "./types";
import { localeMonths, localeMonthsShort } from "./locale-runtime";

/** @public */
export let parseTwoDigitYearFn: ((input: string) => number) | undefined;

export function setParseTwoDigitYear(fn: ((input: string) => number) | undefined): void {
  parseTwoDigitYearFn = fn;
}

export const WEEKDAY_NAMES_MAP: Record<string, number> = {
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

export interface ParseCtx {
  str: string;
  strIdx: number;
  strict: boolean;
  loc: ParseLocale;
  result: ParsedData;
  _seenUnusedTokens?: Set<string>;
  failed: boolean;
  tokenIndex: number;
  ops: Op[];
}

type TokenHandler = (ctx: ParseCtx) => void;
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
  const op = ctx.ops[ctx.tokenIndex];
  if (op.kind !== "token") {
    return;
  }
  const maxDigits = op.name.length;
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
    c1 = s.charCodeAt(i + 1),
    c2 = s.charCodeAt(i + 2);
  if (c0 < 48 || c0 > 57 || c1 < 48 || c1 > 57 || c2 < 48 || c2 > 57) {
    ctx.failed = true;
    return;
  }
  const hVal = (c0 - 48) * 10 + (c1 - 48);
  if (hVal > 12) {
    ctx.result._bigHour = true;
  }
  ctx.result.hour = hVal;
  ctx.result._parsedDateParts[3] = hVal;
  if (i + 3 < s.length) {
    const c3 = s.charCodeAt(i + 3);
    if (c3 >= 48 && c3 <= 57) {
      ctx.result.minute = (c2 - 48) * 10 + (c3 - 48);
      ctx.strIdx += 4;
      ctx.result._parsedDateParts[4] = ctx.result.minute;
      return;
    }
  }
  ctx.result.minute = c2 - 48;
  ctx.result._parsedDateParts[4] = ctx.result.minute;
  ctx.strIdx += 3;
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
    digits === 3 ? s.charCodeAt(i) - 48 : (s.charCodeAt(i) - 48) * 10 + (s.charCodeAt(i + 1) - 48);
  ctx.result._parsedDateParts[3] = ctx.result.hour;
  ctx.result.minute =
    (s.charCodeAt(i + digits - 2) - 48) * 10 + (s.charCodeAt(i + digits - 1) - 48);
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
const S_DIGIT_RE: RegExp[] = [];
for (let d = 1; d <= 9; d++) {
  S_DIGIT_RE.push(new RegExp(`^(\\d{1,${d}})`));
}
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
const _handlerTable: Record<string, TokenHandler> = {
  SSSSSSSSS: hS,
  SSSSSSSS: hS,
  SSSSSSS: hS,
  SSSSSS: hS,
  SSSSS: hS,
  SSSS: hS,
  SSS: hS,
  SS: hS,
  S: hS,
  Hmmss: hHmmss,
  Hmm: hHmm,
  hmmss: hhmmss,
  hmm: hhmm,
  YYYYYY: hYYYYYY,
  YYYYY: hYYYYY,
  YYYY: hYYYY,
  YY: hYY,
  Y: hY,
  yyyy: hYYYY,
  y: hEraYear,
  yo: hYo,
  GGGG: hGGGG,
  GG: hGG,
  gggg: hgggg,
  gg: hgg,
  NNNNN: hNNNNN,
  NNNN: hNNNN,
  NNN: hN,
  NN: hN,
  N: hN,
  MMMM: hMMMM,
  MMM: hMMM,
  MM: hMM,
  M: hM,
  DDDD: hDDD,
  DDD: hDDD,
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
  ZZ: hZ,
  Z: hZ,
  A: hA,
  a: hA,
  X: hX,
  x: hx,
  WW: hWW,
  W: hW,
  ww: hww,
  w: hw,
};

function getTokenHandler(name: string): TokenHandler {
  return _handlerTable[name] ?? ((): void => {});
}

export type Op =
  | { kind: "token"; handler: TokenHandler; name: string }
  | { kind: "literal"; value: string };

const BYTECODE_CACHE = new LruMap<string, Op[]>(1000);

export function compileFormatToOpcodes(format: string): Op[] {
  const cached = BYTECODE_CACHE.get(format);
  if (cached) {
    return cached;
  }

  const tokens = tokenizeFormat(format);
  const ops = tokens.map((t) => {
    if (t.type === "literal") {
      return { kind: "literal" as const, value: t.value ?? "" };
    }
    const handler = getTokenHandler(t.name!);
    return { kind: "token" as const, handler, name: t.name! };
  });
  BYTECODE_CACHE.set(format, ops);
  return ops;
}

interface FormatToken {
  type: "token" | "literal";
  name?: string;
  value?: string;
}

const tokenizeCache = new LruMap<string, FormatToken[]>(1000);

const CANDIDATES_TABLE: (string[] | undefined)[] = [];
for (const token of Object.keys(_handlerTable)) {
  const cc = token.charCodeAt(0);
  if (cc < 128) {
    CANDIDATES_TABLE[cc] ??= [];
    CANDIDATES_TABLE[cc].push(token);
  }
}
for (let i = 0; i < 128; i++) {
  if (CANDIDATES_TABLE[i]) {
    CANDIDATES_TABLE[i]!.sort((a, b) => b.length - a.length);
  }
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
    const cc = format.charCodeAt(i);
    const candidates = cc < 128 ? CANDIDATES_TABLE[cc] : undefined;
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
  const parseExact = !!(loc as CachedParseLocale)._config.monthsParseExact;
  // When monthsParseExact is true, non-strict regex only matches full month names (no short fallback)
  if (parseExact) {
    (loc as CachedParseLocale)._monthsRegex = new RegExp(
      `^(${sortByLengthDesc(allFull).map(escapeRegex).join("|")})`,
      "i",
    );
  } else {
    const monthsShort = localeMonthsShort(loc as never);
    const shortArr = Array.isArray(monthsShort) ? monthsShort : [];
    const shortLower = shortArr.map((m: string) => m.toLowerCase());
    const shortNoPeriod = shortLower
      .map((m: string) => m.replace(/\.$/, ""))
      .filter((m) => m.length > 0);
    const all = [...new Set([...allFull, ...shortLower, ...shortNoPeriod])];
    (loc as CachedParseLocale)._monthsRegex = new RegExp(
      `^(${sortByLengthDesc(all).map(escapeRegex).join("|")})`,
      "i",
    );
  }
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
    return [];
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
    return [];
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

export const expandedFormatCache = new LruMap<string, string>(500);
