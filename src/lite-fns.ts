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

function daysInMonth(y: number, m: number): number {
  if (m === 1) {
    return (y & 3) === 0 && (y % 100 !== 0 || (y & 15) === 0) ? 29 : 28;
  }
  if (m === 3 || m === 5 || m === 8 || m === 10) {
    return 30;
  }
  return 31;
}

// Same token handling as formatMomentBasic (used by MomentLite.format())
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

export function endOf(d: Date, unit: string): Date {
  const r = new Date(d);
  const u = unit === "date" ? "day" : unit;
  switch (u) {
    case "year":
      r.setMonth(11, 31);
      r.setHours(23, 59, 59, 999);
      break;
    case "month":
      r.setMonth(r.getMonth() + 1, 0);
      r.setHours(23, 59, 59, 999);
      break;
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

export function add(d: Date, amount: number, unit: string): Date {
  const r = new Date(d);
  switch (unit) {
    case "year": {
      const raw = Number.isInteger(amount) ? amount : Math.round(amount);
      const ny = r.getFullYear() + raw;
      const m = r.getMonth();
      const md = daysInMonth(ny, m);
      r.setFullYear(ny, m, r.getDate() > md ? md : r.getDate());
      break;
    }
    case "month": {
      const raw = Number.isInteger(amount) ? amount : Math.round(amount);
      const total = r.getFullYear() * 12 + r.getMonth() + raw;
      const ny = Math.floor(total / 12);
      const nm = ((total % 12) + 12) % 12;
      const md = daysInMonth(ny, nm);
      r.setFullYear(ny, nm, r.getDate() > md ? md : r.getDate());
      break;
    }
    case "quarter":
      return add(r, Math.round(amount * 3), "month");
    case "week":
      r.setDate(r.getDate() + Math.round(amount * 7));
      break;
    case "day":
    case "date":
      r.setDate(r.getDate() + Math.round(amount));
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

export function subtract(d: Date, amount: number, unit: string): Date {
  return add(d, -amount, unit);
}

export function diff(a: Date, b: Date, unitRaw: string): number {
  const diffMs = a.getTime() - b.getTime();
  if (isNaN(diffMs)) {
    return NaN;
  }
  const unit = unitRaw === "date" ? "day" : unitRaw;
  switch (unit) {
    case "millisecond":
      return diffMs || 0;
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
      const r = diffMs / 86400000;
      const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
      return t || 0;
    }
    case "week": {
      const r = diffMs / 604800000;
      const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
      return t || 0;
    }
    case "quarter":
    case "month":
    case "year": {
      const aDay = a.getDate();
      const bDay = b.getDate();
      const swap = aDay < bDay;
      const later = swap ? b : a;
      const earlier = swap ? a : b;
      const whole = monthDiff(later, earlier);
      let result = swap ? whole : -whole;
      if (unit === "year") {
        result = Math.trunc(result / 12);
      } else if (unit === "quarter") {
        result = Math.trunc(result / 3);
      }
      return Object.is(result, -0) ? 0 : result;
    }
  }
  return NaN;
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

function compareCalendarValues(a: Date, b: Date, unit: string): number {
  switch (unit) {
    case "millisecond":
      return a.getTime() - b.getTime();
    case "second":
      return Math.floor(a.getTime() / 1000) - Math.floor(b.getTime() / 1000);
    case "minute":
      return Math.floor(a.getTime() / 60000) - Math.floor(b.getTime() / 60000);
    case "hour":
      return Math.floor(a.getTime() / 3600000) - Math.floor(b.getTime() / 3600000);
    case "day":
    case "date": {
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
    case "month":
      return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
    case "year":
      return a.getFullYear() - b.getFullYear();
  }
  return NaN;
}

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

export function isBetween(a: Date, b: Date, c: Date, inclusivity?: string, unit?: string): boolean {
  const fromStr = inclusivity ?? "()";
  const startOpen = fromStr[0] === "(";
  const endOpen = fromStr.at(-1) === ")";
  const startCheck = startOpen ? isAfter(a, b, unit) : isSameOrAfter(a, b, unit);
  const endCheck = endOpen ? isBefore(a, c, unit) : isSameOrBefore(a, c, unit);
  return startCheck && endCheck;
}
