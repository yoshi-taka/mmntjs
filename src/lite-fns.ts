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

const TOKENS = ["YYYY", "MM", "DD", "HH", "mm", "ss", "SSS"] as const;

function padYear(y: number): string {
  const abs = Math.abs(y);
  const s = abs < 10 ? `000${abs}` : abs < 100 ? `00${abs}` : abs < 1000 ? `0${abs}` : String(abs);
  return y < 0 ? `-${s}` : y > 9999 ? `+${s}` : s;
}
function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

// Same token handling as formatMomentBasic (used by MomentLite.format())
export function format(d: Date, fmt: string): string {
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }
  let out = "";
  for (let i = 0; i < fmt.length; ) {
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
      r.setHours(23, 59, 59, 999);
      break;
    case "hour":
      r.setMinutes(59, 59, 999);
      break;
    case "minute":
      r.setSeconds(59, 999);
      break;
    case "second":
      r.setMilliseconds(999);
      break;
  }
  return r;
}

function daysInMonth(y: number, m: number): number {
  if (m === 1) {
    return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28;
  }
  if (m === 3 || m === 5 || m === 8 || m === 10) {
    return 30;
  }
  return 31;
}

export function add(d: Date, amount: number, unit: string): Date {
  const r = new Date(d);
  switch (unit) {
    case "year": {
      const ny = r.getFullYear() + amount;
      const m = r.getMonth();
      const md = daysInMonth(ny, m);
      r.setFullYear(ny, m, r.getDate() > md ? md : r.getDate());
      break;
    }
    case "month": {
      const total = r.getFullYear() * 12 + r.getMonth() + amount;
      const ny = Math.floor(total / 12);
      const nm = ((total % 12) + 12) % 12;
      const md = daysInMonth(ny, nm);
      r.setFullYear(ny, nm, r.getDate() > md ? md : r.getDate());
      break;
    }
    case "quarter":
      return add(r, amount * 3, "month");
    case "week":
      r.setDate(r.getDate() + amount * 7);
      break;
    case "day":
    case "date":
      r.setDate(r.getDate() + amount);
      break;
    case "hour":
      r.setTime(r.getTime() + amount * 3600000);
      break;
    case "minute":
      r.setTime(r.getTime() + amount * 60000);
      break;
    case "second":
      r.setTime(r.getTime() + amount * 1000);
      break;
    case "millisecond":
      r.setTime(r.getTime() + amount);
      break;
  }
  return r;
}

export function subtract(d: Date, amount: number, unit: string): Date {
  return add(d, -amount, unit);
}

export function diff(a: Date, b: Date, unit: string): number {
  const ms = a.getTime() - b.getTime();
  if (isNaN(ms)) {
    return NaN;
  }
  switch (unit) {
    case "millisecond":
      return ms || 0;
    case "second":
      return Math.trunc(ms / 1000) || 0;
    case "minute":
      return Math.trunc(ms / 60000) || 0;
    case "hour":
      return Math.trunc(ms / 3600000) || 0;
    case "day":
      return Math.trunc(ms / 86400000) || 0;
    case "week":
      return Math.trunc(ms / 604800000) || 0;
    case "month": {
      const m = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
      const r = a.getDate() < b.getDate() ? m - 1 : m;
      return r || 0;
    }
    case "year":
      return Math.trunc(diff(a, b, "month") / 12) || 0;
    case "quarter":
      return Math.trunc(diff(a, b, "month") / 3) || 0;
  }
  return NaN;
}

function startOfMs(d: Date, unit?: string): number {
  return unit ? startOf(d, unit).getTime() : d.getTime();
}

export function isBefore(a: Date, b: Date, unit?: string): boolean {
  return startOfMs(a, unit) < startOfMs(b, unit);
}

export function isAfter(a: Date, b: Date, unit?: string): boolean {
  return startOfMs(a, unit) > startOfMs(b, unit);
}

export function isSame(a: Date, b: Date, unit?: string): boolean {
  return startOfMs(a, unit) === startOfMs(b, unit);
}

export function isSameOrBefore(a: Date, b: Date, unit?: string): boolean {
  return startOfMs(a, unit) <= startOfMs(b, unit);
}

export function isSameOrAfter(a: Date, b: Date, unit?: string): boolean {
  return startOfMs(a, unit) >= startOfMs(b, unit);
}

export function isBetween(a: Date, b: Date, c: Date, inclusivity?: string, unit?: string): boolean {
  const sa = startOfMs(a, unit);
  const sb = startOfMs(b, unit);
  const sc = startOfMs(c, unit);
  const startOk = inclusivity?.includes("[") ? sa >= sb : sa > sb;
  const endOk = inclusivity?.includes("]") ? sa <= sc : sa < sc;
  return startOk && endOk;
}
