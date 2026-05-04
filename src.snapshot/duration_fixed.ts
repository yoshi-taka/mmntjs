import { getLocale, Locale, getCurrentLocale } from "./locale";
import { absFloor, hasOwnProp, isObject } from "./utils";
import { getRelTimeThreshold, getRelTimeRounding } from "./moment_fixed";

export interface DurationInput {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
  y?: number;
  M?: number;
  w?: number;
  d?: number;
  h?: number;
  m?: number;
  s?: number;
  ms?: number;
  quarter?: number;
  Q?: number;
  year?: number;
  month?: number;
  week?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  from?: any;
  to?: any;
}

type DurationLike = number | DurationInput | string | Duration;

function absCeil(number: number): number {
  if (number < 0) {
    return Math.floor(number);
  }
  return Math.ceil(number);
}

function daysToMonths(days: number): number {
  return (days * 4800) / 146097;
}

function monthsToDays(months: number): number {
  return (months * 146097) / 4800;
}

const unitAliasToKey: Record<string, string> = {
  years: "years",
  year: "years",
  y: "years",
  months: "months",
  month: "months",
  M: "months",
  weeks: "weeks",
  week: "weeks",
  w: "weeks",
  days: "days",
  day: "days",
  d: "days",
  date: "days",
  hours: "hours",
  hour: "hours",
  h: "hours",
  minutes: "minutes",
  minute: "minutes",
  m: "minutes",
  seconds: "seconds",
  second: "seconds",
  s: "seconds",
  milliseconds: "milliseconds",
  millisecond: "milliseconds",
  ms: "milliseconds",
  quarter: "quarter",
  quarters: "quarter",
  Q: "quarter",
  isoweek: "weeks",
  isoweeks: "weeks",
  isoWeek: "weeks",
  W: "weeks",
};

function unitToMs(unit: string): number {
  const key = unitAliasToKey[unit];
  if (!key) return 0;
  switch (key) {
    case "years":
      return 31536000000;
    case "months":
      return 2592000000;
    case "weeks":
      return 604800000;
    case "days":
      return 86400000;
    case "hours":
      return 3600000;
    case "minutes":
      return 60000;
    case "seconds":
      return 1000;
    case "milliseconds":
      return 1;
    default:
      return 0;
  }
}

export class Duration {
  _milliseconds: number = 0;
  _days: number = 0;
  _months: number = 0;
  _bdYears: number = 0;
  _bdMonths: number = 0;
  _bdDays: number = 0;
  _bdHours: number = 0;
  _bdMinutes: number = 0;
  _bdSeconds: number = 0;
  _bdMilliseconds: number = 0;
  _locale: string = "en";
  _isValid: boolean = true;

  constructor(input?: DurationLike, unit?: string) {
    this._locale = getCurrentLocale();

    // If called from moment(), override with the moment's locale
    if (input && typeof input === "object" && (input as any)._isAMomentObject) {
      this._locale = (input as any)._l || this._locale;
    }

    if (input === undefined || input === null) {
      this._milliseconds = 0;
      this._days = 0;
      this._months = 0;
    } else if (typeof input === "number") {
      if (isNaN(input)) {
        this._isValid = false;
        this._milliseconds = NaN as any;
      } else if (unit) {
        const aliasKey = unitAliasToKey[unit];
        if (aliasKey === "years" || aliasKey === "months") {
          if (aliasKey === "years") {
            this._months = input * 12;
          } else {
            this._months = input;
          }
        } else if (aliasKey === "quarter") {
          this._months = input * 3;
        } else {
          const ms = unitToMs(unit);
          if (aliasKey === "weeks") {
            this._days = input * 7;
          } else if (aliasKey === "days") {
            this._days = input;
          } else {
            this._milliseconds = Math.round(input * ms);
          }
        }
      } else {
        this._milliseconds = input;
      }
    } else if (typeof input === "string") {
      if (unit) {
        const aliasKey = unitAliasToKey[unit];
        if (aliasKey) {
          const val = Number(input) || 0;
          if (aliasKey === "years") {
            this._months = val * 12;
          } else if (aliasKey === "months") {
            this._months = val;
          } else if (aliasKey === "quarter") {
            this._months = val * 3;
          } else if (aliasKey === "weeks") {
            this._days = val * 7;
          } else if (aliasKey === "days") {
            this._days = val;
          } else {
            this._milliseconds = Math.round(val * unitToMs(unit));
          }
        }
      } else {
        const aliasKey = unitAliasToKey[input];
        if (aliasKey) {
          if (aliasKey === "years") {
            this._months = 1 * 12;
          } else if (aliasKey === "months") {
            this._months = 1;
          } else if (aliasKey === "quarter") {
            this._months = 3;
          } else if (aliasKey === "weeks") {
            this._days = 1 * 7;
          } else if (aliasKey === "days") {
            this._days = 1;
          } else {
            this._milliseconds = unitToMs(input);
          }
        } else {
          this._parseString(input);
        }
      }
    } else if (input instanceof Duration) {
      this._milliseconds = input._milliseconds;
      this._days = input._days;
      this._months = input._months;
      this._locale = input._locale;
      this._isValid = input._isValid;
    } else if (isObject(input)) {
      this._parseObject(input as DurationInput);
    }

    this._bubble();
  }

  private _parseISONum(s: string | undefined): number {
    if (!s) return 0;
    const parts = s.replace(/,/g, ".").split(".");
    if (parts.length === 1) return parseFloat(parts[0]) || 0;
    return parseFloat(parts[0] + "." + parts[1]) || 0;
  }

  private _parseString(str: string): void {
    let cleanStr = str.replace(/,/g, ".");
    cleanStr = cleanStr.replace(/([PpTt])\.(\d)/g, "$10.$2");
    cleanStr = cleanStr.replace(/\.(\D)/g, ".0$1");
    cleanStr = cleanStr.replace(/(\d)\.($|[^\d.])/g, "$1$2");

    const csharpMatch = cleanStr.match(/^([+-]?\d+)[. ](\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
    if (csharpMatch) {
      const sign = csharpMatch[1][0] === "-" ? -1 : 1;
      const days = Math.abs(parseInt(csharpMatch[1], 10));
      const hours = parseInt(csharpMatch[2], 10);
      const minutes = parseInt(csharpMatch[3], 10);
      const seconds = parseFloat(csharpMatch[4]);
      this._days = sign * days;
      this._milliseconds = sign * Math.round(hours * 3600000 + minutes * 60000 + seconds * 1000);
      return;
    }

    const timeSpanMatch = cleanStr.match(/^([+-]?\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
    if (timeSpanMatch) {
      const sign = timeSpanMatch[1][0] === "-" ? -1 : 1;
      const hours = Math.abs(parseInt(timeSpanMatch[1], 10));
      const minutes = parseInt(timeSpanMatch[2], 10);
      const seconds = parseFloat(timeSpanMatch[3]);
      this._milliseconds = sign * Math.round(hours * 3600000 + minutes * 60000 + seconds * 1000);
      return;
    }

    const isoMatch = str.match(
      /^([+-])?P(?:([+-]?[\d.,]+)Y)?(?:([+-]?[\d.,]+)M)?(?:([+-]?[\d.,]+)W)?(?:([+-]?[\d.,]+)D)?(?:T(?:([+-]?[\d.,]+)H)?(?:([+-]?[\d.,]+)M)?(?:([+-]?[\d.,]+)S)?)?$/i,
    );
    if (isoMatch) {
      const sign = isoMatch[1] === "-" ? -1 : 1;
      const years = this._parseISONum(isoMatch[2]);
      const months = this._parseISONum(isoMatch[3]);
      const weeks = this._parseISONum(isoMatch[4]);
      const days = this._parseISONum(isoMatch[5]);
      const hours = this._parseISONum(isoMatch[6]);
      const minutes = this._parseISONum(isoMatch[7]);
      const seconds = this._parseISONum(isoMatch[8]);
      const my = sign * (years * 12 + months);
      const md = sign * (days + weeks * 7);
      const mms = sign * Math.round(hours * 3600000 + minutes * 60000 + seconds * 1000);
      this._months = my;
      this._days = md;
      this._milliseconds = mms;
      return;
    }

    const hhmmMatch = cleanStr.match(/^(-?\d+):(\d+)(?::(\d+(?:\.\d+)?))?$/);
    if (hhmmMatch) {
      const hours = parseInt(hhmmMatch[1], 10);
      const minutes = parseInt(hhmmMatch[2], 10);
      const seconds = hhmmMatch[3] !== undefined ? parseFloat(hhmmMatch[3]) : 0;
      this._milliseconds = Math.round(hours * 3600000 + minutes * 60000 + seconds * 1000);
      return;
    }

    const numMatch = cleanStr.match(/^(-?\d+)$/);
    if (numMatch) {
      this._milliseconds = parseInt(numMatch[1], 10);
      return;
    }

    this._milliseconds = 0;
    this._days = 0;
    this._months = 0;
    this._isValid = false;
  }

  static invalid(): Duration {
    const d = new Duration(0);
    d._isValid = false;
    d._milliseconds = NaN as any;
    return d;
  }

  private _parseObject(obj: DurationInput): void {
    if (hasOwnProp(obj, "from") || hasOwnProp(obj, "to")) {
      const { momentFromAnything, Moment } = require("./moment_fixed");
      const fromVal = (obj as any).from;
      const toVal = (obj as any).to;
      const from = fromVal != null ? momentFromAnything(fromVal) : new Moment({ _d: new Date(0), _dClone: false });
      const to = toVal != null ? momentFromAnything(toVal) : new Moment({ _d: new Date(0), _dClone: false });
      if (!from.isValid() || !to.isValid()) {
        this._milliseconds = 0;
        this._days = 0;
        this._months = 0;
        return;
      }
      if (from.valueOf() <= to.valueOf()) {
        let months =
          (to.month() as number) -
          (from.month() as number) +
          ((to.year() as number) - (from.year() as number)) * 12;
        const adjusted = from.clone().add(months, "months");
        if (adjusted.valueOf() > to.valueOf()) months--;
        this._months = months;
        const base = from.clone().add(this._months, "months");
        this._milliseconds = to.valueOf() - base.valueOf();
      } else {
        let months =
          (from.month() as number) -
          (to.month() as number) +
          ((from.year() as number) - (to.year() as number)) * 12;
        const adjusted = to.clone().add(months, "months");
        if (adjusted.valueOf() > from.valueOf()) months--;
        this._months = -months;
        const base = to.clone().add(months, "months");
        this._milliseconds = -(from.valueOf() - base.valueOf());
      }
      this._days = 0;
      return;
    }
    let smallestSeen = -1;
    const unitIndexMap: Record<string, number> = {
      years: 0,
      months: 1,
      weeks: 2,
      days: 3,
      hours: 4,
      minutes: 5,
      seconds: 6,
      milliseconds: 7,
    };
    for (const key in obj) {
      if (hasOwnProp(obj, key)) {
        const aliased = unitAliasToKey[key];
        if (aliased && unitIndexMap[aliased] !== undefined) {
          const idx = unitIndexMap[aliased];
          if (smallestSeen < 0 || idx > smallestSeen) smallestSeen = idx;
        }
      }
    }
    for (const key in obj) {
      if (hasOwnProp(obj, key)) {
        const aliased = unitAliasToKey[key];
        if (!aliased) continue;
        const rawVal = (obj as any)[key];
        const val = Number(rawVal) || 0;
        const idx = unitIndexMap[aliased];
        if (
          idx !== undefined &&
          smallestSeen >= 0 &&
          idx < smallestSeen &&
          rawVal !== undefined &&
          rawVal !== null &&
          rawVal % 1 !== 0
        ) {
          this._isValid = false;
          this._milliseconds = NaN as any;
          this._days = 0;
          this._months = 0;
          return;
        }
        if (aliased === "milliseconds") {
          this._milliseconds += val;
        } else if (aliased === "days") {
          this._days += val;
        } else if (aliased === "weeks") {
          this._days += val * 7;
        } else if (aliased === "months") {
          this._months += val;
        } else if (aliased === "years") {
          this._months += val * 12;
        } else if (aliased === "quarter") {
          this._months += val * 3;
        } else if (aliased === "hours") {
          this._milliseconds += Math.round(val * 3600000);
        } else if (aliased === "minutes") {
          this._milliseconds += Math.round(val * 60000);
        } else if (aliased === "seconds") {
          this._milliseconds += Math.round(val * 1000);
        }
      }
    }
  }

  private _bubble(): void {
    if (!this._isValid) return;

    let milliseconds = this._milliseconds;
    let days = this._days;
    let months = this._months;

    if (
      !(
        (milliseconds >= 0 && days >= 0 && months >= 0) ||
        (milliseconds <= 0 && days <= 0 && months <= 0)
      )
    ) {
      const totalMonthsDays = monthsToDays(months) + days;
      milliseconds += absCeil(totalMonthsDays) * 86400000;
      days = 0;
      months = 0;
    }

    this._bdMilliseconds = milliseconds % 1000;

    let seconds = absFloor(milliseconds / 1000);
    this._bdSeconds = seconds % 60;

    let minutes = absFloor(seconds / 60);
    this._bdMinutes = minutes % 60;

    let hours = absFloor(minutes / 60);
    this._bdHours = hours % 24;

    days += absFloor(hours / 24);

    const monthsFromDays = absFloor(daysToMonths(days));
    months += monthsFromDays;
    days -= absCeil(monthsToDays(monthsFromDays));

    const years = absFloor(months / 12);
    months %= 12;

    this._bdDays = days;
    this._bdMonths = months;
    this._bdYears = years;
  }

  isValid(): boolean {
    return this._isValid;
  }

  valueOf(): number {
    if (!this._isValid) return NaN;
    const days = this._days + Math.round(monthsToDays(this._months));
    return Math.floor(days * 86400000) + this._milliseconds;
  }

  get(unit: string): number {
    if (!this._isValid) return NaN;
    const key = unitAliasToKey[unit];
    if (!key) return NaN;
    switch (key) {
      case "milliseconds":
        return this._bdMilliseconds;
      case "seconds":
        return this._bdSeconds;
      case "minutes":
        return this._bdMinutes;
      case "hours":
        return this._bdHours;
      case "days":
        return this._bdDays;
      case "weeks":
        return absFloor(this._bdDays / 7);
      case "months":
        return this._bdMonths;
      case "years":
        return this._bdYears;
      default:
        return NaN;
    }
  }

  as(unit: string): number {
    const ms = this.valueOf();
    const baseDays = this._days + Math.round(monthsToDays(this._months));
    switch (unit) {
      case "milliseconds":
      case "ms":
        return baseDays * 86400000 + this._milliseconds;
      case "seconds":
      case "s":
        return baseDays * 86400 + this._milliseconds / 1000;
      case "minutes":
      case "m":
        return baseDays * 1440 + this._milliseconds / 60000;
      case "hours":
      case "h":
        return baseDays * 24 + this._milliseconds / 3600000;
      case "days":
      case "d":
        return baseDays + this._milliseconds / 86400000;
      case "weeks":
      case "w":
        return baseDays / 7 + this._milliseconds / 604800000;
      case "months":
      case "M":
        return this._months + daysToMonths(this._days + this._milliseconds / 86400000);
      case "quarters":
      case "Q":
        return (this._months + daysToMonths(this._days + this._milliseconds / 86400000)) / 3;
      case "years":
      case "y":
        return (this._months + daysToMonths(this._days + this._milliseconds / 86400000)) / 12;
      default:
        return ms;
    }
  }

  asMilliseconds(): number {
    return this.as("milliseconds");
  }
  asSeconds(): number {
    return this.as("seconds");
  }
  asMinutes(): number {
    return this.as("minutes");
  }
  asHours(): number {
    return this.as("hours");
  }
  asDays(): number {
    return this.as("days");
  }
  asWeeks(): number {
    return this.as("weeks");
  }
  asMonths(): number {
    return this.as("months");
  }
  asYears(): number {
    return this.as("years");
  }

  milliseconds(n?: number): number | Duration {
    if (!this._isValid) return NaN as any;
    if (n !== undefined) {
      this._milliseconds = n;
      this._bubble();
      return this;
    }
    return this._bdMilliseconds;
  }

  seconds(n?: number): number | Duration {
    if (!this._isValid) return NaN as any;
    if (n !== undefined) {
      const diff = n - this._bdSeconds;
      this._milliseconds += diff * 1000;
      this._bubble();
      return this;
    }
    return this._bdSeconds;
  }

  minutes(n?: number): number | Duration {
    if (!this._isValid) return NaN as any;
    if (n !== undefined) {
      const diff = n - this._bdMinutes;
      this._milliseconds += diff * 60000;
      this._bubble();
      return this;
    }
    return this._bdMinutes;
  }

  hours(n?: number): number | Duration {
    if (!this._isValid) return NaN as any;
    if (n !== undefined) {
      const diff = n - this._bdHours;
      this._milliseconds += diff * 3600000;
      this._bubble();
      return this;
    }
    return this._bdHours;
  }

  days(n?: number): number | Duration {
    if (!this._isValid) return NaN as any;
    if (n !== undefined) {
      const diff = n - this._bdDays;
      this._days += diff;
      this._bubble();
      return this;
    }
    return this._bdDays;
  }

  months(n?: number): number | Duration {
    if (!this._isValid) return NaN as any;
    if (n !== undefined) {
      const diff = n - this._bdMonths;
      this._months += diff;
      this._bubble();
      return this;
    }
    return this._bdMonths;
  }

  years(n?: number): number | Duration {
    if (!this._isValid) return NaN as any;
    if (n !== undefined) {
      const diff = n - this._bdYears;
      this._months += diff * 12;
      this._bubble();
      return this;
    }
    return this._bdYears;
  }

  weeks(n?: number): number | Duration {
    if (!this._isValid) return NaN as any;
    if (n !== undefined) {
      const diff = n - absFloor(this._bdDays / 7);
      this._days += diff * 7;
      this._bubble();
      return this;
    }
    return absFloor(this._bdDays / 7);
  }

  add(duration: Duration | number | string | DurationInput, unit?: string): Duration {
    let other: Duration;
    if (duration instanceof Duration) {
      other = duration;
    } else if (typeof duration === "number" && unit) {
      other = new Duration({ [unit.replace(/s$/, "")]: duration });
    } else if (typeof duration === "number") {
      other = new Duration(duration);
    } else if (typeof duration === "string") {
      other = new Duration(duration);
    } else if (isObject(duration)) {
      other = new Duration(duration as DurationInput);
    } else {
      return this;
    }

    this._milliseconds += other._milliseconds;
    this._days += other._days;
    this._months += other._months;
    this._bubble();
    return this;
  }

  subtract(duration: Duration | number | string | DurationInput, unit?: string): Duration {
    let other: Duration;
    if (duration instanceof Duration) {
      other = duration;
    } else if (typeof duration === "number" && unit) {
      other = new Duration({ [unit.replace(/s$/, "")]: duration });
    } else if (typeof duration === "number") {
      other = new Duration(duration);
    } else if (typeof duration === "string") {
      other = new Duration(duration);
    } else if (isObject(duration)) {
      other = new Duration(duration as DurationInput);
    } else {
      return this;
    }

    this._milliseconds -= other._milliseconds;
    this._days -= other._days;
    this._months -= other._months;
    this._bubble();
    return this;
  }

  abs(): Duration {
    this._milliseconds = Math.abs(this._milliseconds);
    this._days = Math.abs(this._days);
    this._months = Math.abs(this._months);
    this._bubble();
    return this;
  }

  clone(): Duration {
    const d = new Duration();
    d._milliseconds = this._milliseconds;
    d._days = this._days;
    d._months = this._months;
    d._locale = this._locale;
    d._isValid = this._isValid;
    d._bubble();
    return d;
  }

  humanize(
    withSuffix?: boolean | Record<string, number>,
    thresholdsArg?: Record<string, number>,
  ): string {
    if (!this._isValid) {
      const locale = getLocale(this._locale);
      return locale.invalidDate();
    }

    let thresholds: Record<string, number> | undefined;

    if (typeof withSuffix === "object") {
      thresholds = withSuffix as Record<string, number>;
      withSuffix = undefined;
    } else {
      thresholds = thresholdsArg;
    }

    const withSuffixBool = withSuffix === true;

    const locale = getLocale(this._locale);
    const ms = this.valueOf();

    const thresh = thresholds || {};
    const sThresh = thresh.s ?? getRelTimeThreshold("s") ?? 45;
    const ssThresh = thresh.ss ?? getRelTimeThreshold("ss") ?? 44;
    const mThresh = thresh.m ?? getRelTimeThreshold("m") ?? 45;
    const hThresh = thresh.h ?? getRelTimeThreshold("h") ?? 22;
    const dThresh = thresh.d ?? getRelTimeThreshold("d") ?? 26;
    const wThresh = thresh.w ?? getRelTimeThreshold("w") ?? 0;
    const MThresh = thresh.M ?? getRelTimeThreshold("M") ?? 11;

    const baseDays = this._days + Math.round(monthsToDays(this._months));
    const totalMs = this._milliseconds;
    const secondsVal = baseDays * 86400 + totalMs / 1000;
    const minutesVal = baseDays * 1440 + totalMs / 60000;
    const hoursVal = baseDays * 24 + totalMs / 3600000;
    const daysVal = baseDays + totalMs / 86400000;
    const monthsVal = this._months + daysToMonths(this._days + totalMs / 86400000);
    const weeksVal = baseDays / 7 + totalMs / 604800000;
    const yearsVal = monthsVal / 12;

    const roundFn =
      getRelTimeRounding() === true || !getRelTimeRounding()
        ? Math.round
        : (getRelTimeRounding() as Function);
    const seconds = roundFn(Math.abs(secondsVal));
    const minutes = roundFn(Math.abs(minutesVal));
    const hours = roundFn(Math.abs(hoursVal));
    const days = roundFn(Math.abs(daysVal));
    const months = roundFn(Math.abs(monthsVal));
    const weeks = roundFn(Math.abs(weeksVal));
    const years = roundFn(Math.abs(yearsVal));

    let key: string;
    let n: number;

    if (seconds === 0) {
      key = "s";
      n = 0;
    } else if (seconds < sThresh && seconds > ssThresh) {
      key = "ss";
      n = seconds;
    } else if (seconds < sThresh) {
      key = "s";
      n = seconds;
    } else if (minutes <= 1) {
      n = 1;
      key = "m";
    } else if (minutes < mThresh) {
      n = minutes;
      key = "mm";
    } else if (hours <= 1) {
      key = "h";
      n = 1;
    } else if (hours < hThresh) {
      n = hours;
      key = "hh";
    } else if (days <= 1) {
      key = "d";
      n = 1;
    } else if (days < dThresh) {
      n = days;
      key = "dd";
    } else if (wThresh && weeks <= 1) {
      key = "w";
      n = 1;
    } else if (wThresh && weeks < wThresh) {
      n = weeks;
      key = "ww";
    } else if (months <= 1) {
      key = "M";
      n = 1;
    } else if (months < MThresh) {
      n = months;
      key = "MM";
    } else if (years <= 1) {
      key = "y";
      n = 1;
    } else {
      n = years;
      key = "yy";
    }

    const baseStr = locale.relativeTime(n, key, ms > 0, !withSuffixBool);
    return locale.postformat(baseStr);
  }

  toISOString(): string {
    if (!this._isValid) return this.localeData().invalidDate();

    let ms = this._milliseconds;
    let days = this._days;
    let months = this._months;

    if (ms === 0 && days === 0 && months === 0) return "P0D";

    const totalMs = this.valueOf();
    const overallSign = totalMs < 0;

    const yearsFromMonths = absFloor(months / 12);
    const remMonths = months % 12;

    const msAbs = Math.abs(ms);
    const hours = Math.floor(msAbs / 3600000);
    const minutes = Math.floor((msAbs % 3600000) / 60000);
    const seconds = (msAbs % 60000) / 1000;

    const units: Array<{ key: string; val: number; source: "months" | "days" | "ms" }> = [];
    if (yearsFromMonths !== 0)
      units.push({ key: "Y", val: Math.abs(yearsFromMonths), source: "months" });
    if (remMonths !== 0) units.push({ key: "M", val: Math.abs(remMonths), source: "months" });
    if (days !== 0) units.push({ key: "D", val: Math.abs(days), source: "days" });

    const timeUnits: Array<{ key: string; val: number; source: "ms" }> = [];
    if (hours !== 0) timeUnits.push({ key: "H", val: hours, source: "ms" });
    if (minutes !== 0) timeUnits.push({ key: "M", val: minutes, source: "ms" });
    if (seconds !== 0) timeUnits.push({ key: "S", val: seconds, source: "ms" });

    const monthsNegative = months < 0;
    const daysNegative = days < 0;
    const msNegative = ms < 0;

    let dateStr = "";
    for (const u of units) {
      const rawNegative = u.source === "months" ? monthsNegative : daysNegative;
      if (rawNegative !== overallSign) {
        dateStr += "-" + u.val + u.key;
      } else {
        dateStr += u.val + u.key;
      }
    }

    let timeStr = "";
    for (const u of timeUnits) {
      const secStr =
        u.key === "S"
          ? u.val === Math.floor(u.val)
            ? u.val + "S"
            : u.val.toFixed(3).replace(/0+$/, "") + "S"
          : u.val + u.key;
      if (msNegative !== overallSign) {
        timeStr += "-" + secStr;
      } else {
        timeStr += secStr;
      }
    }

    let result = (overallSign ? "-" : "") + "P" + dateStr;
    if (timeStr) result += "T" + timeStr;
    if (result === (overallSign ? "-" : "") + "P" || result === "-P" || result === "P")
      result += "0D";

    return result;
  }

  toJSON(): string {
    return this.toISOString();
  }

  toIsoString(): string {
    return this.toISOString();
  }

  toString(): string {
    return this.toISOString();
  }

  asQuarters(): number {
    return this.as("quarters");
  }

  locale(locale?: string): string | Duration {
    if (locale) {
      this._locale = locale;
      return this;
    }
    return this._locale;
  }

  lang(locale?: string): string | Locale | Duration {
    if (locale) {
      this._locale = locale;
      return this;
    }
    return this.localeData();
  }

  localeData(): Locale {
    return getLocale(this._locale);
  }
}

export function isDuration(input: any): boolean {
  return input instanceof Duration;
}
