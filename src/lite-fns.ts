// lite/fns — standalone date functions
// Same logic as MomentLite (mmntjs/lite), adapted for plain Date objects.
// No MomentLite instance created — zero object overhead.

import { pad2, pad3, padYear } from "./utils";

// copied from format-basic.ts — same token handling as MomentLite.format()
export function format(d: Date, fmt: string): string {
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
          out += padYear(d.getFullYear());
          tokenLen = 4;
        }
        break;
      case "M":
        if (fmt.startsWith("MM", i)) {
          out += pad2(d.getMonth() + 1);
          tokenLen = 2;
        }
        break;
      case "D":
        if (fmt.startsWith("DD", i)) {
          out += pad2(d.getDate());
          tokenLen = 2;
        }
        break;
      case "H":
        if (fmt.startsWith("HH", i)) {
          out += pad2(d.getHours());
          tokenLen = 2;
        }
        break;
      case "m":
        if (fmt.startsWith("mm", i)) {
          out += pad2(d.getMinutes());
          tokenLen = 2;
        }
        break;
      case "s":
        if (fmt.startsWith("ss", i)) {
          out += pad2(d.getSeconds());
          tokenLen = 2;
        }
        break;
      case "S":
        if (fmt.startsWith("SSS", i)) {
          out += pad3(d.getMilliseconds());
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

// copied from moment-lite.ts startOf() LOCAL path
export function startOf(d: Date, unit: string): Date {
  const r = new Date(d);
  const u = unit === "date" ? "day" : unit;
  switch (u) {
    case "year":
      r.setMonth(0, 1);
      r.setHours(0, 0, 0, 0);
      break;
    case "month":
      r.setDate(1);
      r.setHours(0, 0, 0, 0);
      break;
    case "day":
      r.setHours(0, 0, 0, 0);
      break;
    case "hour":
      r.setMinutes(0, 0, 0);
      break;
    case "minute":
      r.setSeconds(0, 0);
      break;
    case "second":
      r.setMilliseconds(0);
      break;
  }
  return r;
}

function daysInMonth(y: number, m: number): number {
  if (m === 1) {
    return (y & 3) === 0 && (y % 100 !== 0 || (y & 15) === 0) ? 29 : 28;
  }
  if (m === 3 || m === 5 || m === 8 || m === 10) {
    return 30;
  }
  return 31;
}

// copied from moment-lite.ts endOf() LOCAL path
export function endOf(d: Date, unit: string): Date {
  const r = new Date(d);
  const u = unit === "date" ? "day" : unit;
  switch (u) {
    case "year":
      r.setFullYear(r.getFullYear(), 11, 31);
      r.setHours(23, 59, 59, 999);
      break;
    case "month": {
      const maxDay = daysInMonth(r.getFullYear(), r.getMonth());
      r.setFullYear(r.getFullYear(), r.getMonth(), maxDay);
      r.setHours(23, 59, 59, 999);
      break;
    }
    case "day":
      r.setHours(0, 0, 0, 0);
      r.setDate(r.getDate() + 1);
      r.setMilliseconds(-1);
      break;
    case "hour":
      r.setMinutes(0, 0, 0);
      r.setHours(r.getHours() + 1, 0, 0, -1);
      break;
    case "minute":
      r.setSeconds(0, 0);
      r.setMinutes(r.getMinutes() + 1, 0, -1);
      break;
    case "second":
      r.setSeconds(r.getSeconds() + 1, -1);
      break;
  }
  return r;
}

function addMonthsToDate(r: Date, amount: number): Date {
  const raw = Number.isInteger(amount)
    ? amount
    : amount < 0
      ? Math.round(-amount) * -1
      : Math.round(amount);
  const total = r.getFullYear() * 12 + r.getMonth() + raw;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  let d_ = r.getDate();
  if (d_ > 28) {
    const md =
      nm === 1
        ? ny % 4 === 0 && (ny % 100 !== 0 || ny % 400 === 0)
          ? 29
          : 28
        : nm === 3 || nm === 5 || nm === 8 || nm === 10
          ? 30
          : 31;
    if (d_ > md) {
      d_ = md;
    }
  }
  r.setFullYear(ny, nm, d_);
  return r;
}

// copied from moment-lite.ts _addSimple() LOCAL path + add() MONTH path
export function add(d: Date, amount: number, unit: string): Date {
  const r = new Date(d);
  switch (unit) {
    case "year":
      return add(r, Math.round(amount * 12), "month");
    case "month":
      return addMonthsToDate(r, amount);
    case "quarter":
      return add(r, Math.round(amount * 3), "month");
    case "week":
      r.setDate(r.getDate() + (Number.isInteger(amount * 7) ? amount * 7 : Math.round(amount * 7)));
      break;
    case "day":
    case "date":
      if (Number.isInteger(amount)) {
        r.setTime(r.getTime() + amount * 86400000);
      } else {
        r.setDate(r.getDate() + Math.round(amount));
      }
      break;
    case "hour":
      r.setTime(r.getTime() + Math.round(amount * 3600000));
      break;
    case "minute":
      r.setTime(r.getTime() + Math.round(amount * 60000));
      break;
    case "second":
      r.setTime(r.getTime() + Math.round(amount * 1000));
      break;
    case "millisecond":
      r.setTime(r.getTime() + Math.round(amount));
      break;
  }
  return r;
}

// copied from moment-lite.ts subtract()
export function subtract(d: Date, amount: number, unit: string): Date {
  return add(d, -amount, unit);
}

function monthDiff(later: Date, earlier: Date): number {
  const wholeMonths =
    (earlier.getFullYear() - later.getFullYear()) * 12 + (earlier.getMonth() - later.getMonth());
  const anchor = add(later, wholeMonths, "month");
  const earlierTime = earlier.getTime();
  const anchorTime = anchor.getTime();
  if (wholeMonths > 0) {
    return earlierTime < anchorTime ? wholeMonths - 1 : wholeMonths;
  }
  if (wholeMonths < 0) {
    return earlierTime > anchorTime ? wholeMonths + 1 : wholeMonths;
  }
  return wholeMonths;
}

// copied from moment-lite.ts diff() (non-float, LOCAL path)
export function diff(a: Date, b: Date, unit: string): number {
  const diffMs = a.getTime() - b.getTime();
  if (isNaN(diffMs)) {
    return NaN;
  }
  const u = (unit === "date" ? "day" : unit).replace(/s$/, "");
  switch (u) {
    case "millisecond": {
      const t = diffMs < 0 ? -Math.floor(-diffMs) : Math.floor(diffMs);
      return t || 0;
    }
    case "second": {
      const r = diffMs / 1000;
      const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
      return t || 0;
    }
    case "minute": {
      const r = diffMs / 60000;
      const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
      return t || 0;
    }
    case "hour": {
      const r = diffMs / 3600000;
      const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
      return t || 0;
    }
    case "day": {
      const zoneDelta = (a.getTimezoneOffset() - b.getTimezoneOffset()) * 60000;
      const r = (diffMs - zoneDelta) / 86400000;
      const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
      return t || 0;
    }
    case "week": {
      const zoneDelta = (a.getTimezoneOffset() - b.getTimezoneOffset()) * 60000;
      const r = (diffMs - zoneDelta) / 604800000;
      const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
      return t || 0;
    }
    case "month": {
      const aDay = a.getDate();
      const bDay = b.getDate();
      const swap = aDay < bDay;
      const later = swap ? b : a;
      const earlier = swap ? a : b;
      const whole = monthDiff(later, earlier);
      const result = swap ? whole : -whole;
      return result || 0;
    }
    case "year": {
      const m = diff(a, b, "month");
      return Math.trunc(m / 12) || 0;
    }
    case "quarter": {
      const m = diff(a, b, "month");
      return Math.trunc(m / 3) || 0;
    }
  }
  return NaN;
}

// copied from moment-lite.ts isBefore/isAfter/isSame LOCAL path + _compareCalendarValues
function compareCalendarValues(a: Date, b: Date, unit: string): number {
  const u = unit.replace(/s$/, "");
  switch (u) {
    case "millisecond":
      return a.getTime() - b.getTime();
    case "second":
      return Math.floor(a.getTime() / 1000) - Math.floor(b.getTime() / 1000);
    case "minute":
      return Math.floor(a.getTime() / 60000) - Math.floor(b.getTime() / 60000);
    case "hour":
      return Math.floor(a.getTime() / 3600000) - Math.floor(b.getTime() / 3600000);
    case "year":
      return a.getFullYear() - b.getFullYear();
    case "month": {
      const yd = a.getFullYear() - b.getFullYear();
      if (yd !== 0) {
        return yd;
      }
      return a.getMonth() - b.getMonth();
    }
    case "day":
    case "date":
    default: {
      const yd = a.getFullYear() - b.getFullYear();
      if (yd !== 0) {
        return yd;
      }
      const md = a.getMonth() - b.getMonth();
      if (md !== 0) {
        return md;
      }
      return a.getDate() - b.getDate();
    }
  }
}

// copied from moment-lite.ts isBefore/isAfter/isSame/isSameOrBefore/isSameOrAfter
export function isBefore(a: Date, b: Date, unit?: string): boolean {
  if (!unit) {
    return a.getTime() < b.getTime();
  }
  return compareCalendarValues(a, b, unit) < 0;
}

export function isAfter(a: Date, b: Date, unit?: string): boolean {
  if (!unit) {
    return a.getTime() > b.getTime();
  }
  return compareCalendarValues(a, b, unit) > 0;
}

export function isSame(a: Date, b: Date, unit?: string): boolean {
  if (!unit) {
    return a.getTime() === b.getTime();
  }
  return compareCalendarValues(a, b, unit) === 0;
}

export function isSameOrBefore(a: Date, b: Date, unit?: string): boolean {
  if (!unit) {
    return a.getTime() <= b.getTime();
  }
  return compareCalendarValues(a, b, unit) <= 0;
}

export function isSameOrAfter(a: Date, b: Date, unit?: string): boolean {
  if (!unit) {
    return a.getTime() >= b.getTime();
  }
  return compareCalendarValues(a, b, unit) >= 0;
}

// copied from moment-lite.ts isBetween()
export function isBetween(a: Date, b: Date, c: Date, inclusivity?: string, unit?: string): boolean {
  const fromStr = inclusivity ?? "()";
  const startOpen = fromStr[0] === "(";
  const endOpen = fromStr.at(-1) === ")";
  const startCheck = startOpen ? isAfter(a, b, unit) : isSameOrAfter(a, b, unit);
  const endCheck = endOpen ? isBefore(a, c, unit) : isSameOrBefore(a, c, unit);
  return startCheck && endCheck;
}
