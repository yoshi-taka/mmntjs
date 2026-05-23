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

export function _setHours(d: Date, h: Hour): Date {
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
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    m,
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

export function _setSeconds(d: Date, s: MinuteSecond): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    s,
    d.getMilliseconds(),
  );
}

export function _setMilliseconds(d: Date, ms: Millisecond): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    ms,
  );
}

// ── Fast kernels: one allocation + one setter, no overflow ──────────────────

/** _setDate28 — day ∈ [1,28], no month overflow possible */
export function _setDate28Fast(d: Date, day: Date28): Date {
  const out = new Date(d.getTime());
  out.setDate(day);
  return out;
}

/** _setMinutesFast — minute ∈ [0,59], no overflow */
export function _setMinutesFast(d: Date, minute: Minute): Date {
  const out = new Date(d.getTime());
  out.setMinutes(minute);
  return out;
}

/** _setMillisecondsFast — ms ∈ [0,999], no overflow */
export function _setMillisecondsFast(d: Date, ms: Millisecond): Date {
  const out = new Date(d.getTime());
  out.setMilliseconds(ms);
  return out;
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
  const leap = _isLeapYear(y);
  const ladder = leap
    ? [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
    : [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return ladder[d.getMonth()] + d.getDate();
}

export function _quarter(d: Date): number {
  return ((d.getMonth() / 3) | 0) + 1;
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
