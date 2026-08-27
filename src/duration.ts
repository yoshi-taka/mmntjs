import type { Locale } from "./locale-runtime";
import {
  getLocale,
  getCurrentLocale,
  localeInvalidDate,
  localePostformat,
  localeRelativeTime,
} from "./locale-runtime";
import { absFloor, hasOwnProp, isObject } from "./utils";
import { getRelTimeThreshold, getRelTimeRounding } from "./reltime";
import { diffMomentsForDuration, type DurationMomentLike } from "./duration-between";

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
  from?: unknown;
  to?: unknown;
}

export type DurationLike = number | DurationInput | string | Duration;

type DurationMomentResolver = (input: unknown) => DurationMomentLike;

let durationMomentResolver: DurationMomentResolver | undefined;

export function setDurationMomentResolver(resolver: DurationMomentResolver): void {
  durationMomentResolver = resolver;
}

function absCeil(number: number): number {
  if (number < 0) {
    return Math.floor(number);
  }
  return Math.ceil(number);
}

function roundSym(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
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
  quarter: "quarters",
  quarters: "quarters",
  Q: "quarters",
  isoweek: "weeks",
  isoweeks: "weeks",
  isoWeek: "weeks",
  W: "weeks",
};

const _unitMs: Record<string, number> = {
  years: 31536000000,
  months: 2592000000,
  weeks: 604800000,
  days: 86400000,
  hours: 3600000,
  minutes: 60000,
  seconds: 1000,
  milliseconds: 1,
};

function unitToMs(unit: string): number {
  return _unitMs[unitAliasToKey[unit] ?? ""] ?? 0;
}

function bubbleMillisecondsOnly(d: Duration, milliseconds: number): Duration {
  d._milliseconds = milliseconds;
  d._days = 0;
  d._months = 0;
  d._bdMilliseconds = milliseconds % 1000;
  const seconds = absFloor(milliseconds / 1000);
  d._bdSeconds = seconds % 60;
  const minutes = absFloor(seconds / 60);
  d._bdMinutes = minutes % 60;
  const hours = absFloor(minutes / 60);
  d._bdHours = hours % 24;
  d._bdDays = absFloor(hours / 24);
  d._bdMonths = 0;
  d._bdYears = 0;
  return d;
}

function createDurationShell(locale = "en", isValid = true): Duration {
  const d = Object.create(Duration.prototype) as Duration;
  d._milliseconds = 0;
  d._days = 0;
  d._months = 0;
  d._bdYears = 0;
  d._bdMonths = 0;
  d._bdDays = 0;
  d._bdHours = 0;
  d._bdMinutes = 0;
  d._bdSeconds = 0;
  d._bdMilliseconds = 0;
  d._locale = locale;
  d._isValid = isValid;
  return d;
}

export class Duration {
  _milliseconds = 0;
  _days = 0;
  _months = 0;
  _bdYears = 0;
  _bdMonths = 0;
  _bdDays = 0;
  _bdHours = 0;
  _bdMinutes = 0;
  _bdSeconds = 0;
  _bdMilliseconds = 0;
  _locale = "en";
  _isValid = true;

  constructor(input?: DurationLike, unit?: string) {
    if (input == null) {
      return;
    }
    if (typeof input === "number") {
      if (!unit || isNaN(input)) {
        this._locale = getCurrentLocale();
        if (isNaN(input)) {
          this._isValid = false;
          this._milliseconds = NaN;
        } else {
          this._milliseconds = input;
        }
        this._bubble();
        return;
      }
      // Fast paths for common numeric+unit
      if (unit === "d" || unit === "day" || unit === "days") {
        this._locale = getCurrentLocale();
        this._days = input;
        this._bubble();
        return;
      }
      if (unit === "ms") {
        this._locale = getCurrentLocale();
        this._milliseconds = Math.round(input);
        this._bubble();
        return;
      }
      this._initNumberWithUnit(input, unit);
      return;
    }
    if (typeof input === "string") {
      this._initString(input, unit);
      return;
    }
    if (input instanceof Duration) {
      this._locale = input._locale;
      this._milliseconds = input._milliseconds;
      this._days = input._days;
      this._months = input._months;
      this._isValid = input._isValid;
      this._bubble();
      return;
    }
    this._locale = getCurrentLocale();
    if ((input as { _isAMomentObject?: boolean })._isAMomentObject) {
      this._locale = (input as { _l?: string })._l ?? this._locale;
    }
    this._parseObject(input);
    this._bubble();
  }

  private _initNumber(input: number): void {
    if (isNaN(input)) {
      this._isValid = false;
      this._milliseconds = NaN;
    } else {
      this._milliseconds = input;
    }
    this._bubble();
  }

  private _initNumberWithUnit(input: number, unit: string): void {
    this._locale = getCurrentLocale();
    const aliasKey = unitAliasToKey[unit];
    if (aliasKey === "years" || aliasKey === "months") {
      this._months = aliasKey === "years" ? input * 12 : input;
    } else if (aliasKey === "quarters") {
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
    this._bubble();
  }

  private _initString(input: string, unit?: string): void {
    this._locale = getCurrentLocale();
    if (unit) {
      const aliasKey = unitAliasToKey[unit];
      if (aliasKey) {
        const val = Number(input) || 0;
        if (aliasKey === "years") {
          this._months = val * 12;
        } else if (aliasKey === "months") {
          this._months = val;
        } else if (aliasKey === "quarters") {
          this._months = val * 3;
        } else if (aliasKey === "weeks") {
          this._days = val * 7;
        } else if (aliasKey === "days") {
          this._days = val;
        } else {
          this._milliseconds = Math.round(val * unitToMs(unit));
        }
        this._bubble();
        return;
      }
    }
    const aliasKey = unitAliasToKey[input];
    if (aliasKey) {
      if (aliasKey === "years") {
        this._months = 12;
      } else if (aliasKey === "months") {
        this._months = 1;
      } else if (aliasKey === "quarters") {
        this._months = 3;
      } else if (aliasKey === "weeks") {
        this._days = 7;
      } else if (aliasKey === "days") {
        this._days = 1;
      } else {
        this._milliseconds = unitToMs(input);
      }
      this._bubble();
    } else {
      this._parseString(input);
      this._bubble();
    }
  }

  private _parseISONum(s: string | undefined): number {
    if (!s) {
      return 0;
    }
    const parts = s.replaceAll(",", ".").split(".");
    if (parts.length === 1) {
      return parseFloat(parts[0]) || 0;
    }
    return parseFloat(`${parts[0]}.${parts[1]}`) || 0;
  }

  private _parseString(str: string): void {
    let cleanStr = str.replaceAll(",", ".");
    cleanStr = cleanStr.replaceAll(/([PpTt])\.(\d)/g, "$10.$2");
    cleanStr = cleanStr.replaceAll(/\.(\D)/g, ".0$1");
    cleanStr = cleanStr.replaceAll(/(\d)\.($|[^\d.])/g, "$1$2");

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
      const seconds = parseFloat(hhmmMatch[3] || "0");
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
    d._milliseconds = NaN;
    return d;
  }

  private _parseObject(obj: DurationInput): void {
    if (hasOwnProp(obj, "from") || hasOwnProp(obj, "to")) {
      const fromVal = (obj as Record<string, unknown>).from;
      const toVal = (obj as Record<string, unknown>).to;
      if (!durationMomentResolver) {
        this._milliseconds = 0;
        this._days = 0;
        this._months = 0;
        this._isValid = false;
        return;
      }
      const from =
        fromVal != null ? durationMomentResolver(fromVal) : durationMomentResolver(new Date(0));
      const to =
        toVal != null ? durationMomentResolver(toVal) : durationMomentResolver(new Date(0));
      const diff = diffMomentsForDuration(from, to);
      this._months = diff.months;
      this._milliseconds = diff.milliseconds;
      this._days = diff.days;
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
        if (aliased in unitIndexMap) {
          const idx = unitIndexMap[aliased];
          if (smallestSeen < 0 || idx > smallestSeen) {
            smallestSeen = idx;
          }
        }
      }
    }
    for (const key in obj) {
      if (hasOwnProp(obj, key)) {
        const aliased = unitAliasToKey[key];
        if (!aliased) {
          continue;
        }
        const rawVal = (obj as Record<string, unknown>)[key];
        const val = Number(rawVal) || 0;
        const idx = unitIndexMap[aliased];
        if (
          smallestSeen >= 0 &&
          idx < smallestSeen &&
          typeof rawVal === "number" &&
          rawVal % 1 !== 0
        ) {
          this._isValid = false;
          this._milliseconds = NaN;
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
        } else if (aliased === "quarters") {
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

  _bubble(): void {
    if (!this._isValid) {
      return;
    }

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
    if (!this._isValid) {
      return NaN;
    }
    const days = this._days + roundSym(monthsToDays(this._months));
    return Math.floor(days * 86400000) + this._milliseconds;
  }

  get(unit: string): number {
    if (!this._isValid) {
      return NaN;
    }
    const key = unitAliasToKey[unit];
    if (!key) {
      return NaN;
    }
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
    const key = unitAliasToKey[unit] ?? unit;
    const baseDays = this._days + Math.round(monthsToDays(this._months));
    switch (key) {
      case "milliseconds":
        return baseDays * 86400000 + this._milliseconds;
      case "seconds":
        return baseDays * 86400 + this._milliseconds / 1000;
      case "minutes":
        return baseDays * 1440 + this._milliseconds / 60000;
      case "hours":
        return baseDays * 24 + this._milliseconds / 3600000;
      case "days":
        return baseDays + this._milliseconds / 86400000;
      case "weeks":
        return baseDays / 7 + this._milliseconds / 604800000;
      case "months":
        return this._months + daysToMonths(this._days + this._milliseconds / 86400000);
      case "quarters":
        return (this._months + daysToMonths(this._days + this._milliseconds / 86400000)) / 3;
      case "years":
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

  milliseconds(n?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    if (n !== undefined) {
      this._milliseconds = n;
      this._bubble();
      return this;
    }
    return this._bdMilliseconds;
  }

  seconds(n?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    if (n !== undefined) {
      const diff = n - this._bdSeconds;
      this._milliseconds += diff * 1000;
      this._bubble();
      return this;
    }
    return this._bdSeconds;
  }

  minutes(n?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    if (n !== undefined) {
      const diff = n - this._bdMinutes;
      this._milliseconds += diff * 60000;
      this._bubble();
      return this;
    }
    return this._bdMinutes;
  }

  hours(n?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    if (n !== undefined) {
      const diff = n - this._bdHours;
      this._milliseconds += diff * 3600000;
      this._bubble();
      return this;
    }
    return this._bdHours;
  }

  days(n?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    if (n !== undefined) {
      const diff = n - this._bdDays;
      this._days += diff;
      this._bubble();
      return this;
    }
    return this._bdDays;
  }

  months(n?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    if (n !== undefined) {
      const diff = n - this._bdMonths;
      this._months += diff;
      this._bubble();
      return this;
    }
    return this._bdMonths;
  }

  years(n?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    if (n !== undefined) {
      const diff = n - this._bdYears;
      this._months += diff * 12;
      this._bubble();
      return this;
    }
    return this._bdYears;
  }

  weeks(n?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    if (n !== undefined) {
      const diff = n - absFloor(this._bdDays / 7);
      this._days += diff * 7;
      this._bubble();
      return this;
    }
    return absFloor(this._bdDays / 7);
  }

  add(duration: Duration | number | string | DurationInput, unit?: string): this {
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
      other = new Duration(duration);
    } else {
      return this;
    }

    this._milliseconds += other._milliseconds;
    this._days += other._days;
    this._months += other._months;
    this._bubble();
    return this;
  }

  subtract(duration: Duration | number | string | DurationInput, unit?: string): this {
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
      other = new Duration(duration);
    } else {
      return this;
    }

    this._milliseconds -= other._milliseconds;
    this._days -= other._days;
    this._months -= other._months;
    this._bubble();
    return this;
  }

  abs(): this {
    this._milliseconds = Math.abs(this._milliseconds);
    this._days = Math.abs(this._days);
    this._months = Math.abs(this._months);
    this._bubble();
    return this;
  }

  clone(): this {
    const d = createDurationShell(this._locale, this._isValid);
    d._milliseconds = this._milliseconds;
    d._days = this._days;
    d._months = this._months;
    d._bdYears = this._bdYears;
    d._bdMonths = this._bdMonths;
    d._bdDays = this._bdDays;
    d._bdHours = this._bdHours;
    d._bdMinutes = this._bdMinutes;
    d._bdSeconds = this._bdSeconds;
    d._bdMilliseconds = this._bdMilliseconds;
    return d as this;
  }

  round(options?: {
    smallestUnit?: string;
    roundingMode?: "ceil" | "floor" | "trunc" | "halfExpand";
    roundingIncrement?: number;
  }): this {
    if (!this._isValid) {
      return this;
    }
    const smallestUnit = options?.smallestUnit ?? "milliseconds";
    const roundingMode = options?.roundingMode ?? "halfExpand";
    const increment = options?.roundingIncrement ?? 1;

    const unitKey =
      unitAliasToKey[smallestUnit] ??
      (smallestUnit.endsWith("s") ? smallestUnit : `${smallestUnit}s`);
    const total = this.as(unitKey);
    const divided = total / increment;
    let rounded: number;
    switch (roundingMode) {
      case "ceil":
        rounded = Math.ceil(divided);
        break;
      case "floor":
        rounded = Math.floor(divided);
        break;
      case "trunc":
        rounded = Math.trunc(divided);
        break;
      default:
        rounded = Math.round(divided);
        break;
    }

    this._months = 0;
    this._days = 0;
    this._milliseconds = 0;

    const unit = unitKey.replace(/s$/, "");
    switch (unit) {
      case "millisecond":
      case "ms":
        this._milliseconds = rounded * increment;
        break;
      case "second":
      case "s":
        this._milliseconds = rounded * increment * 1000;
        break;
      case "minute":
      case "m":
        this._milliseconds = rounded * increment * 60000;
        break;
      case "hour":
      case "h":
        this._milliseconds = rounded * increment * 3600000;
        break;
      case "day":
      case "d":
        this._days = rounded * increment;
        break;
      case "week":
      case "w":
        this._days = rounded * increment * 7;
        break;
      case "month":
      case "M":
        this._months = rounded * increment;
        break;
      case "year":
      case "y":
        this._months = rounded * increment * 12;
        break;
      case "quarter":
      case "Q":
        this._months = rounded * increment * 3;
        break;
    }

    this._bubble();
    return this;
  }

  humanize(
    withSuffix?: boolean | Partial<Record<string, number>>,
    thresholdsArg?: Partial<Record<string, number>>,
  ): string {
    if (!this._isValid) {
      const locale = getLocale(this._locale);
      return localeInvalidDate(locale);
    }

    let thresholds: Partial<Record<string, number>> | undefined;

    if (typeof withSuffix === "object") {
      thresholds = withSuffix;
      withSuffix = undefined;
    } else {
      thresholds = thresholdsArg;
    }

    const withSuffixBool = withSuffix === true;

    const locale = getLocale(this._locale);
    const ms = this.valueOf();

    const thresh = thresholds ?? {};
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

    const rrf = getRelTimeRounding();
    const roundFn = rrf === true || !rrf ? Math.round : rrf;
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

    const baseStr = localeRelativeTime(locale, n, key, ms > 0, !withSuffixBool);
    return localePostformat(locale, baseStr);
  }

  toISOString(): string {
    if (!this._isValid) {
      return localeInvalidDate(this.localeData());
    }

    let ms = this._milliseconds;
    let days = this._days;
    let months = this._months;

    if (ms === 0 && days === 0 && months === 0) {
      return "P0D";
    }

    const totalMs = this.valueOf();
    const overallSign = totalMs < 0;

    const yearsFromMonths = absFloor(months / 12);
    const remMonths = months % 12;

    const msAbs = Math.abs(ms);
    const hours = Math.floor(msAbs / 3600000);
    const minutes = Math.floor((msAbs % 3600000) / 60000);
    const seconds = (msAbs % 60000) / 1000;

    const units: { key: string; val: number; source: "months" | "days" | "ms" }[] = [];
    if (yearsFromMonths !== 0) {
      units.push({ key: "Y", val: Math.abs(yearsFromMonths), source: "months" });
    }
    if (remMonths !== 0) {
      units.push({ key: "M", val: Math.abs(remMonths), source: "months" });
    }
    if (days !== 0) {
      units.push({ key: "D", val: Math.abs(days), source: "days" });
    }

    const timeUnits: { key: string; val: number; source: "ms" }[] = [];
    if (hours !== 0) {
      timeUnits.push({ key: "H", val: hours, source: "ms" });
    }
    if (minutes !== 0) {
      timeUnits.push({ key: "M", val: minutes, source: "ms" });
    }
    if (seconds !== 0) {
      timeUnits.push({ key: "S", val: seconds, source: "ms" });
    }

    const monthsNegative = months < 0;
    const daysNegative = days < 0;
    const msNegative = ms < 0;

    let dateStr = "";
    for (const u of units) {
      const rawNegative = u.source === "months" ? monthsNegative : daysNegative;
      if (rawNegative !== overallSign) {
        dateStr += `-${u.val}${u.key}`;
      } else {
        dateStr += u.val + u.key;
      }
    }

    let timeStr = "";
    for (const u of timeUnits) {
      const secStr =
        u.key === "S"
          ? u.val === Math.floor(u.val)
            ? `${u.val}S`
            : `${u.val.toFixed(3).replace(/0+$/, "")}S`
          : u.val + u.key;
      if (msNegative !== overallSign) {
        timeStr += `-${secStr}`;
      } else {
        timeStr += secStr;
      }
    }

    let result = `${overallSign ? "-" : ""}P${dateStr}`;
    if (timeStr) {
      result += `T${timeStr}`;
    }
    if (result === `${overallSign ? "-" : ""}P` || result === "-P" || result === "P") {
      result += "0D";
    }

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

  locale(locale?: string): string | this {
    if (locale) {
      this._locale = locale;
      return this;
    }
    return this._locale;
  }

  lang(locale?: string): string | Locale | this {
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

/** Fastest Duration from raw milliseconds — no getCurrentLocale, no full _bubble.
 *  Skips locale lookup and uses default locale "en".
 *  Creates a shell Duration and computes breakdown directly without sign-check loop.
 *  @public */
export function createDurationFromMsFast(ms: number, locale = "en"): Duration {
  const d = Object.create(Duration.prototype) as Duration;
  d._milliseconds = ms;
  d._days = 0;
  d._months = 0;
  d._bdMilliseconds = ms % 1000;
  const seconds = absFloor(ms / 1000);
  d._bdSeconds = seconds % 60;
  const minutes = absFloor(seconds / 60);
  d._bdMinutes = minutes % 60;
  const hours = absFloor(minutes / 60);
  d._bdHours = hours % 24;
  d._bdDays = absFloor(hours / 24);
  d._bdMonths = 0;
  d._bdYears = 0;
  d._locale = locale;
  d._isValid = !isNaN(ms);
  return d;
}

export function createDurationFast(input?: DurationLike, unit?: string): Duration {
  if (input == null || input instanceof Duration || typeof input === "string" || isObject(input)) {
    return new Duration(input, unit);
  }
  if (typeof input !== "number") {
    return new Duration(input, unit);
  }
  if (!unit) {
    return createDurationFromMsFast(input, getCurrentLocale());
  }
  const d = createDurationShell(getCurrentLocale(), !isNaN(input));
  if (!d._isValid) {
    d._milliseconds = NaN;
    return d;
  }
  const aliasKey = unitAliasToKey[unit];
  if (aliasKey === "years") {
    d._months = input * 12;
  } else if (aliasKey === "months") {
    d._months = input;
  } else if (aliasKey === "quarters") {
    d._months = input * 3;
  } else if (aliasKey === "weeks") {
    d._days = input * 7;
  } else if (aliasKey === "days") {
    d._days = input;
  } else {
    return bubbleMillisecondsOnly(d, Math.round(input * unitToMs(unit)));
  }
  d._bubble();
  return d;
}

export function isDuration(input: unknown): input is Duration {
  return input instanceof Duration;
}
