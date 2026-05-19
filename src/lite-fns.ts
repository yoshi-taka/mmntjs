// lite/fns — standalone date functions with zero side effects, fully tree-shakeable

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

function padYear(y: number): string {
  return y < 10 ? `000${y}` : y < 100 ? `00${y}` : y < 1000 ? `0${y}` : String(y);
}

function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

const TOKENS = ["YYYY", "MM", "DD", "HH", "mm", "ss", "SSS"] as const;

export function format(d: Date, fmt: string): string {
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }
  let out = "";
  for (let i = 0; i < fmt.length; ) {
    let matched = false;
    for (const token of TOKENS) {
      if (fmt.startsWith(token, i)) {
        const v = d as unknown as {
          getFullYear: () => number;
          getMonth: () => number;
          getDate: () => number;
          getHours: () => number;
          getMinutes: () => number;
          getSeconds: () => number;
          getMilliseconds: () => number;
        };
        switch (token) {
          case "YYYY":
            out += padYear(v.getFullYear());
            break;
          case "MM":
            out += PAD2[v.getMonth() + 1];
            break;
          case "DD":
            out += PAD2[v.getDate()];
            break;
          case "HH":
            out += PAD2[v.getHours()];
            break;
          case "mm":
            out += PAD2[v.getMinutes()];
            break;
          case "ss":
            out += PAD2[v.getSeconds()];
            break;
          case "SSS":
            out += pad3(v.getMilliseconds());
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
  switch (unit) {
    case "year":
      r.setMonth(0, 1);
      r.setHours(0, 0, 0, 0);
      break;
    case "month":
      r.setDate(1);
      r.setHours(0, 0, 0, 0);
      break;
    case "week":
    case "isoWeek":
      r.setDate(r.getDate() - r.getDay());
      r.setHours(0, 0, 0, 0);
      break;
    case "day":
    case "date":
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
    case "quarter":
      r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1);
      r.setHours(0, 0, 0, 0);
      break;
  }
  return r;
}

export function endOf(d: Date, unit: string): Date {
  const r = new Date(d);
  switch (unit) {
    case "year":
      r.setMonth(11, 31);
      r.setHours(23, 59, 59, 999);
      break;
    case "month":
      r.setMonth(r.getMonth() + 1, 0);
      r.setHours(23, 59, 59, 999);
      break;
    case "week":
    case "isoWeek":
      r.setDate(r.getDate() + (6 - r.getDay()));
      r.setHours(23, 59, 59, 999);
      break;
    case "day":
    case "date":
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
    case "quarter":
      r.setMonth(Math.floor(r.getMonth() / 3) * 3 + 2, 1);
      r.setMonth(r.getMonth() + 1, 0);
      r.setHours(23, 59, 59, 999);
      break;
  }
  return r;
}

export function add(d: Date, amount: number, unit: string): Date {
  const r = new Date(d);
  switch (unit) {
    case "year":
      r.setFullYear(r.getFullYear() + amount);
      break;
    case "month":
      r.setMonth(r.getMonth() + amount);
      break;
    case "quarter":
      r.setMonth(r.getMonth() + amount * 3);
      break;
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
  switch (unit) {
    case "millisecond":
      return ms;
    case "second":
      return Math.trunc(ms / 1000);
    case "minute":
      return Math.trunc(ms / 60000);
    case "hour":
      return Math.trunc(ms / 3600000);
    case "day":
      return Math.trunc(ms / 86400000);
    case "week":
      return Math.trunc(ms / 604800000);
    case "month": {
      const months = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
      if (a.getDate() < b.getDate()) {
        return months - 1;
      }
      return months;
    }
    case "year":
      return Math.trunc(diff(a, b, "month") / 12);
  }
  return NaN;
}

export function isBefore(a: Date, b: Date, unit?: string): boolean {
  if (!unit) {
    return a.getTime() < b.getTime();
  }
  return startOf(a, unit).getTime() < startOf(b, unit).getTime();
}

export function isAfter(a: Date, b: Date, unit?: string): boolean {
  if (!unit) {
    return a.getTime() > b.getTime();
  }
  return startOf(a, unit).getTime() > startOf(b, unit).getTime();
}

export function isSame(a: Date, b: Date, unit?: string): boolean {
  if (!unit) {
    return a.getTime() === b.getTime();
  }
  return startOf(a, unit).getTime() === startOf(b, unit).getTime();
}

export function isSameOrBefore(a: Date, b: Date, unit?: string): boolean {
  return isBefore(a, b, unit) || isSame(a, b, unit);
}

export function isSameOrAfter(a: Date, b: Date, unit?: string): boolean {
  return isAfter(a, b, unit) || isSame(a, b, unit);
}

export function isBetween(a: Date, b: Date, c: Date, inclusivity?: string): boolean {
  const left = inclusivity?.includes("[") ? isSameOrAfter : isAfter;
  const right = inclusivity?.includes("]") ? isSameOrBefore : isBefore;
  return left(a, b) && right(a, c);
}
