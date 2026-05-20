// lite/fns — standalone date functions
// Same logic as MomentLite (mmntjs/lite), adapted for plain Date objects.
// No MomentLite instance created — zero object overhead.

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

const TOKENS = ["YYYY", "SSS", "MM", "DD", "HH", "mm", "ss"] as const;

function padYear(y: number): string {
  const abs = Math.abs(y);
  const s = abs < 10 ? `000${abs}` : abs < 100 ? `00${abs}` : abs < 1000 ? `0${abs}` : String(abs);
  return y < 0 ? `-${s}` : y > 9999 ? `+${s}` : s;
}

function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

// copied from format-basic.ts — same token handling as MomentLite.format()
export function format(d: Date, fmt: string): string {
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }
  let out = "";
  for (let i = 0; i < fmt.length; ) {
    if (fmt[i] === "\\" && i + 1 < fmt.length) {
      out += fmt[i + 1];
      i += 2;
      continue;
    }
    let matched = false;
    for (const token of TOKENS) {
      if (fmt.startsWith(token, i)) {
        switch (token) {
          case "YYYY":
            out += padYear(d.getFullYear());
            break;
          case "MM":
            out += PAD2[d.getMonth() + 1];
            break;
          case "DD":
            out += PAD2[d.getDate()];
            break;
          case "HH":
            out += PAD2[d.getHours()];
            break;
          case "mm":
            out += PAD2[d.getMinutes()];
            break;
          case "ss":
            out += PAD2[d.getSeconds()];
            break;
          case "SSS":
            out += pad3(d.getMilliseconds());
            break;
        }
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
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

// copied from moment-lite.ts _addSimple() LOCAL path + add() MONTH path
export function add(d: Date, amount: number, unit: string): Date {
  const r = new Date(d);
  switch (unit) {
    case "year":
      return add(r, Math.round(amount * 12), "month");
    case "month": {
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
      break;
    }
    case "quarter":
      return add(r, Math.round(amount * 3), "month");
    case "week": {
      const raw = amount * 7;
      const rounded = Number.isInteger(raw)
        ? raw
        : raw < 0
          ? Math.round(-raw) * -1
          : Math.round(raw);
      r.setDate(r.getDate() + rounded);
      break;
    }
    case "day":
    case "date": {
      const raw = Number.isInteger(amount)
        ? amount
        : amount < 0
          ? Math.round(-amount) * -1
          : Math.round(amount);
      r.setDate(r.getDate() + raw);
      break;
    }
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
