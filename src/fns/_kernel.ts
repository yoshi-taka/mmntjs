import type {
  MonthIndex,
  DayOfMonth,
  Date28,
  Hour,
  MinuteSecond,
  Minute,
  Millisecond,
  IntegerAmount,
  YearNumber,
  FastISOResult,
} from "./_types";

// ── Leap year / days-in-month helpers ───────────────────────────────────────

const DAYS = new Int8Array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
const _nonLeapLadder = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const _leapLadder = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function _isLeapYear(y: number): boolean {
  if (!isFinite(y)) {
    return false;
  }
  if ((y & 3) !== 0) {
    return false;
  }
  if (y % 100 !== 0) {
    return true;
  }
  return (y & 15) === 0;
}

function _daysInMonth(y: number, m: number): number {
  if (!isFinite(y) || !isFinite(m)) {
    return NaN;
  }
  if (m === 1) {
    return _isLeapYear(y) ? 29 : 28;
  }
  return DAYS[m];
}

// ── Setters ─────────────────────────────────────────────────────────────────

export function _setYear(d: Date, year: YearNumber): Date {
  return new Date(
    year,
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

export function _setMonth(d: Date, month: MonthIndex): Date {
  const out = new Date(d.getTime());
  const maxDay = _daysInMonth(out.getFullYear(), month);
  out.setMonth(month, Math.min(out.getDate(), maxDay));
  return out;
}

export function _setDate(d: Date, day: DayOfMonth): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    day,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

/** _setHours — epoch delta with DST fallback */
export function _setHours(d: Date, h: Hour): Date {
  const delta = (h - d.getHours()) * 3600000;
  const newT = d.getTime() + delta;
  const temp = new Date(newT);
  if (d.getTimezoneOffset() === temp.getTimezoneOffset()) {
    return temp;
  }
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    h,
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

export function _setMinutes(d: Date, m: MinuteSecond): Date {
  return new Date(d.getTime() + (m - d.getMinutes()) * 60000);
}

export function _setSeconds(d: Date, s: MinuteSecond): Date {
  return new Date(d.getTime() + (s - d.getSeconds()) * 1000);
}

export function _setMilliseconds(d: Date, ms: Millisecond): Date {
  return new Date(d.getTime() + (ms - d.getMilliseconds()));
}

// ── Fast kernels: one allocation + one setter, no overflow ──────────────────

/** _setDate28 — day ∈ [1,28], no month overflow possible.
 *  Uses epoch delta with DST fallback (same strategy as _addDays). */
export function _setDate28Fast(d: Date, day: Date28): Date {
  const delta = (day - d.getDate()) * 86400000;
  const newT = d.getTime() + delta;
  const temp = new Date(newT);
  if (d.getTimezoneOffset() === temp.getTimezoneOffset()) {
    return temp;
  }
  const out = new Date(d.getTime());
  out.setDate(day);
  return out;
}

/** _setMinutesFast — minute ∈ [0,59], no overflow, no DST concern */
export function _setMinutesFast(d: Date, minute: Minute): Date {
  return new Date(d.getTime() + (minute - d.getMinutes()) * 60000);
}

/** _setMillisecondsFast — ms ∈ [0,999], no overflow */
export function _setMillisecondsFast(d: Date, ms: Millisecond): Date {
  return new Date(d.getTime() + (ms - d.getMilliseconds()));
}

// ── Add / Sub ───────────────────────────────────────────────────────────────

export function _addDays(d: Date, n: IntegerAmount): Date {
  if (!n) {
    return new Date(d.getTime());
  }
  const newT = d.getTime() + n * 86400000;
  const temp = new Date(newT);
  if (d.getTimezoneOffset() === temp.getTimezoneOffset()) {
    return temp;
  }
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}

export function _addMonths(d: Date, n: IntegerAmount): Date {
  const out = new Date(d.getTime());
  const total = out.getFullYear() * 12 + out.getMonth() + n;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  let dd = out.getDate();
  if (dd > 28) {
    const md = _daysInMonth(ny, nm);
    if (dd > md) {
      dd = md;
    }
  }
  out.setFullYear(ny, nm, dd);
  return out;
}

export function _addYears(d: Date, n: IntegerAmount): Date {
  return _addMonths(d, (n * 12) as IntegerAmount);
}

// ── Boundary ────────────────────────────────────────────────────────────────

export function _startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function _startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function _endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

// ── Diff ────────────────────────────────────────────────────────────────────

export function _differenceInDays(a: Date, b: Date): number {
  const diffMs = a.getTime() - b.getTime();
  if (isNaN(diffMs)) {
    return NaN;
  }
  const z = (a.getTimezoneOffset() - b.getTimezoneOffset()) * 60000;
  const r = (diffMs - z) / 86400000;
  return r < 0 ? -Math.floor(-r) : Math.floor(r) || 0;
}

export function _differenceInMonths(a: Date, b: Date): number {
  const aDay = a.getDate(),
    bDay = b.getDate();
  const swap = aDay < bDay;
  const later = swap ? b : a,
    earlier = swap ? a : b;
  const wholeMonths =
    (earlier.getFullYear() - later.getFullYear()) * 12 + (earlier.getMonth() - later.getMonth());
  const total = later.getFullYear() * 12 + later.getMonth() + wholeMonths;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  let dd = later.getDate();
  if (dd > 28) {
    const md = _daysInMonth(ny, nm);
    if (dd > md) {
      dd = md;
    }
  }
  const anchor = new Date(
    ny,
    nm,
    dd,
    later.getHours(),
    later.getMinutes(),
    later.getSeconds(),
    later.getMilliseconds(),
  );
  const earlierTime = earlier.getTime();
  const anchorTime = anchor.getTime();
  let whole = wholeMonths;
  if (whole > 0) {
    whole = earlierTime < anchorTime ? whole - 1 : whole;
  }
  if (whole < 0) {
    whole = earlierTime > anchorTime ? whole + 1 : whole;
  }
  const result = swap ? whole : -whole;
  return result || 0;
}

// ── Calendar helpers ────────────────────────────────────────────────────────

export function _daysInMonthDate(d: Date): number {
  const y = d.getFullYear(),
    m = d.getMonth();
  if (!isFinite(y) || !isFinite(m)) {
    return NaN;
  }
  if (m === 1) {
    return _isLeapYear(y) ? 29 : 28;
  }
  return DAYS[m];
}

export function _isLeapYearDate(d: Date): boolean {
  return _isLeapYear(d.getFullYear());
}

export function _dayOfYear(d: Date): number {
  const y = d.getFullYear();
  return (_isLeapYear(y) ? _leapLadder : _nonLeapLadder)[d.getMonth()] + d.getDate();
}

export function _quarter(d: Date): number {
  return ((d.getMonth() / 3) | 0) + 1;
}

// ── Getters ──

export function _year(d: Date): number {
  return d.getFullYear();
}

export function _month(d: Date): number {
  return d.getMonth();
}

export function _date(d: Date): number {
  return d.getDate();
}

export function _day(d: Date): number {
  return d.getDay();
}

export function _hour(d: Date): number {
  return d.getHours();
}

export function _minute(d: Date): number {
  return d.getMinutes();
}

export function _second(d: Date): number {
  return d.getSeconds();
}

export function _millisecond(d: Date): number {
  return d.getMilliseconds();
}

export function _valueOf(d: Date): number {
  return d.getTime();
}

export function _unix(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

// ── Comparison ──

export function _isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

export function _isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

export function _isSame(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

export function _isSameOrBefore(a: Date, b: Date): boolean {
  return a.getTime() <= b.getTime();
}

export function _isSameOrAfter(a: Date, b: Date): boolean {
  return a.getTime() >= b.getTime();
}

export function _isBetween(d: Date, from: Date, to: Date): boolean {
  const t = d.getTime();
  return t > from.getTime() && t < to.getTime();
}

// ── Diff (convenience aliases + new) ──

export function _diffMilliseconds(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

export function _diffSeconds(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 1000;
}

export function _diffMinutes(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 60000;
}

export function _diffHours(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 3600000;
}

export function _diffDays(a: Date, b: Date): number {
  return _differenceInDays(a, b);
}

export function _diffMonths(a: Date, b: Date): number {
  return _differenceInMonths(a, b);
}

export function _diffYears(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 31557600000;
}

// ── Add time helpers ──

export function _addHours(d: Date, n: IntegerAmount): Date {
  return new Date(d.getTime() + n * 3600000);
}

export function _addMinutes(d: Date, n: IntegerAmount): Date {
  return new Date(d.getTime() + n * 60000);
}

export function _addSeconds(d: Date, n: IntegerAmount): Date {
  return new Date(d.getTime() + n * 1000);
}

export function _addMilliseconds(d: Date, n: IntegerAmount): Date {
  return new Date(d.getTime() + n);
}

// ── More boundaries ──

export function _startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function _endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function _endOfWeek(d: Date): Date {
  const day = d.getDay();
  const end = new Date(d.getTime());
  end.setDate(end.getDate() + (6 - day));
  return _endOfDay(end);
}

export function _endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

// ── Calendar helpers ──

function _weekdayFromEpochDays(rd: number): number {
  // Ben Joffe's full signed 32-bit RD weekday transform.
  const a = (Math.imul(rd, 613566756) + 0x95000000) >>> 0;
  const b = (rd >> 1) + (rd >> 4);
  return (a + b) >>> 29;
}

function _firstWeekOffset(year: number, dow: number, doy: number): number {
  const fwd = 7 + dow - doy;
  const ya = year - 1;
  const era = Math.floor(ya / 400);
  const yoe = ya - era * 400;
  const dayOfYear = 306 + fwd - 1;
  const dayOfEra = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + dayOfYear;
  const epochDays = era * 146097 + dayOfEra - 719468;
  const weekday = _weekdayFromEpochDays(epochDays);
  const fwdlw = (7 + weekday - dow) % 7;
  return -fwdlw + fwd - 1;
}

function _weeksInYear(year: number): number {
  return (
    ((_isLeapYear(year) ? 366 : 365) -
      _firstWeekOffset(year, 0, 6) +
      _firstWeekOffset(year + 1, 0, 6)) /
    7
  );
}

export function _week(d: Date): number {
  const doy = _dayOfYear(d);
  const weekOffset = _firstWeekOffset(d.getFullYear(), 0, 6);
  let week = Math.floor((doy - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    week += _weeksInYear(d.getFullYear() - 1);
  } else if (week > _weeksInYear(d.getFullYear())) {
    week -= _weeksInYear(d.getFullYear());
  }
  return week;
}

export function _isoWeek(d: Date): number {
  const dow = d.getDay() || 7;
  const doy = _dayOfYear(d);
  const w = Math.floor((doy - dow + 10) / 7);
  if (w < 1) {
    const prev = new Date(d.getFullYear() - 1, 11, 31);
    return _isoWeek(prev);
  }
  if (w >= 53) {
    const nextJan1 = new Date(d.getFullYear() + 1, 0, 1);
    const nd = nextJan1.getDay() || 7;
    if (nd <= 3 && doy >= 359) {
      return 1;
    }
  }
  return Math.min(w, 53);
}

export function _weekday(d: Date): number {
  return d.getDay();
}

export function _isoWeekday(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

// ── Conversion ──

export function _toDate(d: Date): Date {
  return new Date(d.getTime());
}

export function _toISOString(d: Date): string {
  try {
    return d.toISOString();
  } catch {
    return "Invalid Date";
  }
}

// ── Parse ISO ───────────────────────────────────────────────────────────────

export function _parseISO(s: string): FastISOResult {
  const len = s.length;
  if (len < 4) {
    return { kind: "fail" };
  }

  const sep = s.charCodeAt(4);
  let y = 0,
    m = 1,
    d = 1;
  let h = 0,
    min = 0,
    sec = 0,
    ms = 0;
  let offset: number | null = null;
  let idx = 0;

  if (sep === 45) {
    y = _digits(s, 0, 4);
    if (y < 0 || len < 10) {
      return { kind: "fail" };
    }
    if (s.charCodeAt(4) !== 45) {
      return { kind: "fail" };
    }
    m = _digits(s, 5, 2);
    if (m < 1 || m > 12 || s.charCodeAt(7) !== 45) {
      return { kind: "fail" };
    }
    d = _digits(s, 8, 2);
    if (d < 1 || d > 31) {
      return { kind: "fail" };
    }
    idx = 10;
  } else {
    y = _digits(s, 0, 4);
    if (y < 0) {
      return { kind: "fail" };
    }
    if (len >= 8) {
      m = _digits(s, 4, 2);
      if (m < 1 || m > 12) {
        return { kind: "fail" };
      }
      d = _digits(s, 6, 2);
      if (d < 1 || d > 31) {
        return { kind: "fail" };
      }
      idx = 8;
    } else {
      idx = 4;
    }
  }

  if (idx < len) {
    const tSep = s.charCodeAt(idx);
    if (tSep === 84 || tSep === 32) {
      idx++;
      if (idx + 2 <= len) {
        h = _digits(s, idx, 2);
        if (h < 0 || h > 23) {
          return { kind: "fail" };
        }
        idx += 2;
        if (idx < len) {
          const col1 = s.charCodeAt(idx);
          if (col1 === 58) {
            idx++;
            if (idx + 2 <= len) {
              min = _digits(s, idx, 2);
              if (min < 0 || min > 59) {
                return { kind: "fail" };
              }
              idx += 2;
              if (idx < len && s.charCodeAt(idx) === 58) {
                idx++;
                if (idx + 2 <= len) {
                  sec = _digits(s, idx, 2);
                  if (sec < 0 || sec > 59) {
                    return { kind: "fail" };
                  }
                  idx += 2;
                }
              }
            }
          } else if (idx + 2 <= len) {
            min = _digits(s, idx, 2);
            if (min < 0 || min > 59) {
              return { kind: "fail" };
            }
            idx += 2;
            if (idx + 2 <= len) {
              sec = _digits(s, idx, 2);
              if (sec < 0 || sec > 59) {
                return { kind: "fail" };
              }
              idx += 2;
            }
          }
        }
      }
    }

    if (idx < len && s.charCodeAt(idx) === 46) {
      idx++;
      const fs = idx;
      while (idx < len) {
        const c = s.charCodeAt(idx);
        if (c < 48 || c > 57) {
          break;
        }
        idx++;
      }
      const fl = idx - fs;
      if (fl > 0) {
        let frac = _digits(s, fs, Math.min(fl, 3));
        if (fl > 3) {
          const extra = _digits(s, fs + 3, Math.min(fl - 3, 3));
          if (extra >= 500) {
            frac++;
          }
        }
        ms = frac;
      }
    }

    if (idx < len) {
      const z = s.charCodeAt(idx);
      if (z === 90 || z === 122) {
        offset = 0;
        idx++;
      } else if (z === 43 || z === 45) {
        const neg = z === 45;
        idx++;
        if (idx + 2 <= len) {
          const oh = _digits(s, idx, 2);
          idx += 2;
          let om = 0;
          if (idx < len) {
            if (s.charCodeAt(idx) === 58) {
              idx++;
            }
            if (idx + 2 <= len) {
              om = _digits(s, idx, 2);
              idx += 2;
            }
          }
          offset = (oh * 60 + om) * (neg ? -1 : 1);
        }
      }
    }
  }

  if (offset !== null) {
    return { kind: "zoned", year: y, month: m, day: d, hour: h, min, sec, ms, offset };
  }
  return { kind: "local", year: y, month: m, day: d, hour: h, min, sec, ms };
}

function _digits(s: string, start: number, len: number): number {
  let n = 0;
  const end = start + len;
  for (let i = start; i < end; i++) {
    const c = s.charCodeAt(i) - 48;
    if (c < 0 || c > 9) {
      return NaN;
    }
    n = n * 10 + c;
  }
  return n;
}

// ── Helpers for formatMoment ───────────────────────────────────────────────

const MONTH_NAMES = [
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

const MONTH_SHORT = [
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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_MIN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const LOCALE_FORMATS: Record<string, string> = {
  LT: "h:mm A",
  LTS: "h:mm:ss A",
  L: "MM/DD/YYYY",
  l: "M/D/YYYY",
  LL: "MMMM D, YYYY",
  ll: "MMM D, YYYY",
  LLL: "MMMM D, YYYY LT",
  lll: "MMM D, YYYY LT",
  LLLL: "dddd, MMMM D, YYYY LT",
  llll: "ddd, MMM D, YYYY LT",
};

const LOCALE_KEYS = ["LLLL", "llll", "LLL", "lll", "LL", "ll", "LTS", "LT", "l"];

function _h12(d: Date): number {
  const h = d.getHours();
  return h === 0 ? 12 : h > 12 ? h - 12 : h;
}

function _tzOffset(d: Date): string {
  const o = -d.getTimezoneOffset();
  const oh = Math.floor(Math.abs(o) / 60);
  const om = Math.abs(o) % 60;
  const sign = o >= 0 ? "+" : "-";
  return `${sign}${_pad2(oh)}${_pad2(om)}`;
}

function _tzOffsetColon(d: Date): string {
  const o = -d.getTimezoneOffset();
  const oh = Math.floor(Math.abs(o) / 60);
  const om = Math.abs(o) % 60;
  const sign = o >= 0 ? "+" : "-";
  return `${sign}${_pad2(oh)}:${_pad2(om)}`;
}

function _ordinal(n: number): string {
  if (n > 10 && n < 20) {
    return `${n}th`;
  }
  const r = n % 10;
  return `${n}${r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th"}`;
}

// ── formatMoment ───────────────────────────────────────────────────────────

export function _formatMoment(d: Date, fmt: string): string {
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }

  // First pass: expand locale tokens
  let expanded = "";
  for (let i = 0; i < fmt.length; ) {
    let matched = false;
    for (const key of LOCALE_KEYS) {
      if (fmt.startsWith(key, i)) {
        expanded += LOCALE_FORMATS[key];
        i += key.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      expanded += fmt[i];
      i++;
    }
  }

  // Second pass: format
  let out = "";
  for (let i = 0; i < expanded.length; ) {
    const ch = expanded[i];
    if (ch === "\\" && i + 1 < expanded.length) {
      out += expanded[i + 1];
      i += 2;
      continue;
    }
    let tokenLen = 0;
    switch (ch) {
      case "Y":
        if (expanded.startsWith("YYYY", i)) {
          out += _padYear(d.getFullYear());
          tokenLen = 4;
        } else if (expanded.startsWith("YY", i)) {
          out += _pad2(d.getFullYear() % 100);
          tokenLen = 2;
        }
        break;
      case "M":
        if (expanded.startsWith("MMMM", i)) {
          out += MONTH_NAMES[d.getMonth()];
          tokenLen = 4;
        } else if (expanded.startsWith("MMM", i)) {
          out += MONTH_SHORT[d.getMonth()];
          tokenLen = 3;
        } else if (expanded.startsWith("MM", i)) {
          out += _pad2(d.getMonth() + 1);
          tokenLen = 2;
        } else if (expanded.startsWith("M", i)) {
          out += String(d.getMonth() + 1);
          tokenLen = 1;
        }
        break;
      case "D":
        if (expanded.startsWith("Do", i)) {
          out += _ordinal(d.getDate());
          tokenLen = 2;
        } else if (expanded.startsWith("DD", i)) {
          out += _pad2(d.getDate());
          tokenLen = 2;
        } else if (expanded.startsWith("D", i)) {
          out += String(d.getDate());
          tokenLen = 1;
        }
        break;
      case "d":
        if (expanded.startsWith("dddd", i)) {
          out += DAY_NAMES[d.getDay()];
          tokenLen = 4;
        } else if (expanded.startsWith("ddd", i)) {
          out += DAY_SHORT[d.getDay()];
          tokenLen = 3;
        } else if (expanded.startsWith("dd", i)) {
          out += DAY_MIN[d.getDay()];
          tokenLen = 2;
        } else if (expanded.startsWith("d", i)) {
          out += String(d.getDay());
          tokenLen = 1;
        }
        break;
      case "H":
        if (expanded.startsWith("HH", i)) {
          out += _pad2(d.getHours());
          tokenLen = 2;
        } else if (expanded.startsWith("H", i)) {
          out += String(d.getHours());
          tokenLen = 1;
        }
        break;
      case "h":
        if (expanded.startsWith("hh", i)) {
          out += _pad2(_h12(d));
          tokenLen = 2;
        } else if (expanded.startsWith("h", i)) {
          out += String(_h12(d));
          tokenLen = 1;
        }
        break;
      case "m":
        if (expanded.startsWith("mm", i)) {
          out += _pad2(d.getMinutes());
          tokenLen = 2;
        } else if (expanded.startsWith("m", i)) {
          out += String(d.getMinutes());
          tokenLen = 1;
        }
        break;
      case "s":
        if (expanded.startsWith("ss", i)) {
          out += _pad2(d.getSeconds());
          tokenLen = 2;
        } else if (expanded.startsWith("s", i)) {
          out += String(d.getSeconds());
          tokenLen = 1;
        }
        break;
      case "S":
        if (expanded.startsWith("SSS", i)) {
          out += _pad3(d.getMilliseconds());
          tokenLen = 3;
        } else if (expanded.startsWith("SS", i)) {
          out += String(Math.floor(d.getMilliseconds() / 10));
          tokenLen = 2;
        } else if (expanded.startsWith("S", i)) {
          out += String(Math.floor(d.getMilliseconds() / 100));
          tokenLen = 1;
        }
        break;
      case "A":
        out += d.getHours() < 12 ? "AM" : "PM";
        tokenLen = 1;
        break;
      case "a":
        out += d.getHours() < 12 ? "am" : "pm";
        tokenLen = 1;
        break;
      case "Z":
        if (expanded.startsWith("ZZ", i)) {
          out += _tzOffset(d);
          tokenLen = 2;
        } else if (expanded.startsWith("Z", i)) {
          out += _tzOffsetColon(d);
          tokenLen = 1;
        }
        break;
    }
    if (tokenLen > 0) {
      i += tokenLen;
    } else {
      out += expanded[i];
      i++;
    }
  }
  return out;
}

// ── parseMoment ────────────────────────────────────────────────────────────

interface _ParsedParts {
  year: number | null;
  month: number | null;
  day: number | null;
  hour: number;
  minute: number;
  second: number;
  ms: number;
  isPM: boolean | null;
  offset: number | null;
}

function _parseToken(s: string, pos: number, len: number): string {
  return s.slice(pos, pos + len);
}

function _tryParseNum(s: string, pos: number, len: number): number | null {
  if (pos + len > s.length) {
    return null;
  }
  const val = Number.parseInt(s.slice(pos, pos + len), 10);
  if (isNaN(val)) {
    return null;
  }
  return val;
}

function _readDigits(s: string, pos: number): { val: number; len: number } | null {
  let end = pos;
  while (end < s.length && s[end] >= "0" && s[end] <= "9") {
    end++;
  }
  if (end === pos) {
    return null;
  }
  return { val: Number.parseInt(s.slice(pos, end), 10), len: end - pos };
}

function _matchString(s: string, pos: number, candidates: string[]): [string, number] | null {
  for (const c of candidates) {
    if (s.slice(pos, pos + c.length).toLowerCase() === c.toLowerCase()) {
      return [c, pos + c.length];
    }
  }
  return null;
}

export function _parseMoment(s: string, fmt: string, strict?: boolean): Date {
  // First pass: expand locale tokens in format
  let expandedFmt = "";
  for (let i = 0; i < fmt.length; ) {
    let matched = false;
    for (const key of LOCALE_KEYS) {
      if (fmt.startsWith(key, i)) {
        expandedFmt += LOCALE_FORMATS[key];
        i += key.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      expandedFmt += fmt[i];
      i++;
    }
  }

  const parts: _ParsedParts = {
    year: null,
    month: null,
    day: null,
    hour: 0,
    minute: 0,
    second: 0,
    ms: 0,
    isPM: null,
    offset: null,
  };

  let fp = 0; // format position
  let sp = 0; // string position

  while (fp < expandedFmt.length && sp < s.length) {
    const ch = expandedFmt[fp];

    // Skip whitespace in both
    if (ch === " ") {
      // Skip spaces in format and any whitespace in input
      fp++;
      while (sp < s.length && s[sp] === " ") {
        sp++;
      }
      continue;
    }

    // Skip non-token characters (they must match literally unless it's a token start)
    let isToken = false;
    const tokenChars = "YMDdHhmsSAaZX";
    if (tokenChars.includes(ch)) {
      isToken = true;
    }

    if (!isToken) {
      // Literal character match
      if (s[sp] === ch) {
        fp++;
        sp++;
      } else {
        if (strict) {
          return new Date(NaN);
        }
        // Skip non-matching in input (fuzzy)
        fp++;
        continue;
      }
      continue;
    }

    // Token matching
    switch (ch) {
      case "Y": {
        if (expandedFmt.startsWith("YYYY", fp)) {
          const val = _tryParseNum(s, sp, 4);
          if (val !== null) {
            parts.year = val;
            fp += 4;
            sp += 4;
            break;
          }
          fp += 4;
          break;
        }
        if (expandedFmt.startsWith("YY", fp)) {
          const val = _tryParseNum(s, sp, 2);
          if (val !== null) {
            parts.year = val + (val > 50 ? 1900 : 2000);
            fp += 2;
            sp += 2;
            break;
          }
          fp += 2;
          break;
        }
        fp++;
        break;
      }
      case "M": {
        if (expandedFmt.startsWith("MMMM", fp)) {
          const m = _matchString(s, sp, MONTH_NAMES);
          if (m) {
            parts.month = MONTH_NAMES.indexOf(m[0]);
            fp += 4;
            sp = m[1];
            break;
          }
          fp += 4;
          break;
        }
        if (expandedFmt.startsWith("MMM", fp)) {
          const m = _matchString(s, sp, MONTH_SHORT);
          if (m) {
            parts.month = MONTH_SHORT.indexOf(m[0]);
            fp += 3;
            sp = m[1];
            break;
          }
          fp += 3;
          break;
        }
        if (expandedFmt.startsWith("MM", fp)) {
          const val = _tryParseNum(s, sp, 2);
          if (val !== null && val >= 1 && val <= 12) {
            parts.month = val - 1;
            fp += 2;
            sp += 2;
            break;
          }
          fp += 2;
          break;
        }
        if (expandedFmt.startsWith("M", fp)) {
          const r = _readDigits(s, sp);
          if (r && r.val >= 1 && r.val <= 12) {
            parts.month = r.val - 1;
            fp += 1;
            sp += r.len;
            break;
          }
          fp += 1;
          break;
        }
        fp++;
        break;
      }
      case "D": {
        if (expandedFmt.startsWith("Do", fp)) {
          const r = _readDigits(s, sp);
          if (r) {
            parts.day = r.val;
            fp += 2;
            sp = r.len + 2;
            break;
          }
          fp += 2;
          break;
        }
        if (expandedFmt.startsWith("DD", fp)) {
          const val = _tryParseNum(s, sp, 2);
          if (val !== null && val >= 1 && val <= 31) {
            parts.day = val;
            fp += 2;
            sp += 2;
            break;
          }
          fp += 2;
          break;
        }
        if (expandedFmt.startsWith("D", fp)) {
          const r = _readDigits(s, sp);
          if (r && r.val >= 1 && r.val <= 31) {
            parts.day = r.val;
            fp += 1;
            sp += r.len;
            break;
          }
          fp += 1;
          break;
        }
        fp++;
        break;
      }
      case "H":
      case "h": {
        const isH = ch === "H";
        if (expandedFmt.startsWith(isH ? "HH" : "hh", fp)) {
          const val = _tryParseNum(s, sp, 2);
          if (val !== null) {
            parts.hour = val;
            fp += 2;
            sp += 2;
            break;
          }
          fp += 2;
          break;
        }
        if (expandedFmt.startsWith(isH ? "H" : "h", fp)) {
          const r = _readDigits(s, sp);
          if (r) {
            parts.hour = r.val;
            fp += 1;
            sp += r.len;
            break;
          }
          fp += 1;
          break;
        }
        fp++;
        break;
      }
      case "m": {
        if (expandedFmt.startsWith("mm", fp)) {
          const val = _tryParseNum(s, sp, 2);
          if (val !== null) {
            parts.minute = val;
            fp += 2;
            sp += 2;
            break;
          }
          fp += 2;
          break;
        }
        if (expandedFmt.startsWith("m", fp)) {
          const r = _readDigits(s, sp);
          if (r) {
            parts.minute = r.val;
            fp += 1;
            sp += r.len;
            break;
          }
          fp += 1;
          break;
        }
        fp++;
        break;
      }
      case "s": {
        if (expandedFmt.startsWith("ss", fp)) {
          const val = _tryParseNum(s, sp, 2);
          if (val !== null) {
            parts.second = val;
            fp += 2;
            sp += 2;
            break;
          }
          fp += 2;
          break;
        }
        if (expandedFmt.startsWith("s", fp)) {
          const r = _readDigits(s, sp);
          if (r) {
            parts.second = r.val;
            fp += 1;
            sp += r.len;
            break;
          }
          fp += 1;
          break;
        }
        fp++;
        break;
      }
      case "S": {
        if (expandedFmt.startsWith("SSS", fp)) {
          const val = _tryParseNum(s, sp, 3);
          if (val !== null) {
            parts.ms = val;
            fp += 3;
            sp += 3;
            break;
          }
          fp += 3;
          break;
        }
        if (expandedFmt.startsWith("SS", fp)) {
          const val = _tryParseNum(s, sp, 2);
          if (val !== null) {
            parts.ms = val * 10;
            fp += 2;
            sp += 2;
            break;
          }
          fp += 2;
          break;
        }
        if (expandedFmt.startsWith("S", fp)) {
          const r = _readDigits(s, sp);
          if (r) {
            parts.ms = r.val * 100;
            fp += 1;
            sp += r.len;
            break;
          }
          fp += 1;
          break;
        }
        fp++;
        break;
      }
      case "A":
      case "a": {
        const upper = s.slice(sp, sp + 2).toUpperCase();
        if (upper === "AM") {
          parts.isPM = false;
          fp++;
          sp += 2;
          break;
        }
        if (upper === "PM") {
          parts.isPM = true;
          fp++;
          sp += 2;
          break;
        }
        fp++;
        break;
      }
      case "Z": {
        if (expandedFmt.startsWith("ZZ", fp)) {
          const sign = s[sp] === "+" ? 1 : s[sp] === "-" ? -1 : null;
          if (sign !== null) {
            const oh = _tryParseNum(s, sp + 1, 2);
            const om = _tryParseNum(s, sp + 3, 2);
            if (oh !== null && om !== null) {
              parts.offset = -(oh * 60 + om) * sign;
              fp += 2;
              sp += 5;
              break;
            }
          }
          fp += 2;
          break;
        }
        if (expandedFmt.startsWith("Z", fp)) {
          const sign = s[sp] === "+" ? 1 : s[sp] === "-" ? -1 : null;
          if (sign !== null) {
            if (s[sp + 3] === ":") {
              const oh = _tryParseNum(s, sp + 1, 2);
              const om = _tryParseNum(s, sp + 4, 2);
              if (oh !== null && om !== null) {
                parts.offset = -(oh * 60 + om) * sign;
                fp += 1;
                sp += 6;
                break;
              }
            } else {
              const oh = _tryParseNum(s, sp + 1, 2);
              const om = _tryParseNum(s, sp + 3, 2);
              if (oh !== null && om !== null) {
                parts.offset = -(oh * 60 + om) * sign;
                fp += 1;
                sp += 5;
                break;
              }
            }
          }
          fp += 1;
          break;
        }
        fp++;
        break;
      }
      default:
        fp++;
        break;
    }
  }

  // Adjust 12-hour clock
  if (parts.isPM !== null) {
    if (parts.isPM && parts.hour !== 12) {
      parts.hour += 12;
    }
    if (!parts.isPM && parts.hour === 12) {
      parts.hour = 0;
    }
  }

  // Build date
  const now = new Date();
  const y = parts.year ?? now.getFullYear();
  const m = parts.month ?? now.getMonth();
  const d = parts.day ?? 1;

  if (parts.offset !== null) {
    const utcMs = Date.UTC(y, m, d, parts.hour, parts.minute, parts.second, parts.ms);
    return new Date(utcMs - parts.offset * 60000);
  }

  return new Date(y, m, d, parts.hour, parts.minute, parts.second, parts.ms);
}

// ── Format ──────────────────────────────────────────────────────────────────

function _pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function _pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

function _padYear(y: number): string {
  const abs = Math.abs(y);
  const s = abs < 10 ? `000${abs}` : abs < 100 ? `00${abs}` : abs < 1000 ? `0${abs}` : String(abs);
  return y < 0 ? `-${s}` : y > 9999 ? `+${s}` : s;
}

export function _format(d: Date, fmt: string): string {
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }
  let out = "";
  for (let i = 0; i < fmt.length; ) {
    const ch = fmt[i];
    if (ch === "\\" && i + 1 < fmt.length) {
      out += fmt[i + 1];
      i += 2;
      continue;
    }
    let tokenLen = 0;
    switch (ch) {
      case "Y":
        if (fmt.startsWith("YYYY", i)) {
          out += _padYear(d.getFullYear());
          tokenLen = 4;
        }
        break;
      case "M":
        if (fmt.startsWith("MM", i)) {
          out += _pad2(d.getMonth() + 1);
          tokenLen = 2;
        }
        break;
      case "D":
        if (fmt.startsWith("DD", i)) {
          out += _pad2(d.getDate());
          tokenLen = 2;
        }
        break;
      case "H":
        if (fmt.startsWith("HH", i)) {
          out += _pad2(d.getHours());
          tokenLen = 2;
        }
        break;
      case "m":
        if (fmt.startsWith("mm", i)) {
          out += _pad2(d.getMinutes());
          tokenLen = 2;
        }
        break;
      case "s":
        if (fmt.startsWith("ss", i)) {
          out += _pad2(d.getSeconds());
          tokenLen = 2;
        }
        break;
      case "S":
        if (fmt.startsWith("SSS", i)) {
          out += _pad3(d.getMilliseconds());
          tokenLen = 3;
        }
        break;
    }
    if (tokenLen > 0) {
      i += tokenLen;
    } else {
      out += fmt[i];
      i++;
    }
  }
  return out;
}
