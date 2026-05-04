import type { Locale} from "./locale";
import { getLocale, getCurrentLocale, hasLocale } from "./locale";
import {
  isArray,
  isObject,
  isDate,
  isMoment,
  isString,
  hasOwnProp,
  zeroFill,
  absRound,
  createDateSafe,
} from "./utils";
import { normalizeUnits, daysInMonth, isLeapYear } from "./units";
import { parseString, parseArray } from "./parse";
import { formatMoment } from "./format";
import { Duration, isDuration } from "./duration";

export let momentProperties: string[] = [];

let updateOffsetCallback: ((m: Moment) => void) | undefined;

export function setUpdateOffsetCallback(cb: ((m: Moment) => void) | undefined): void {
  updateOffsetCallback = cb;
}

export function getUpdateOffsetCallback(): ((m: Moment) => void) | undefined {
  return updateOffsetCallback;
}

export { getRelTimeRounding, setRelTimeRounding, getRelTimeThreshold, setRelTimeThreshold } from "./reltime";

export type MomentInput =
  | Moment
  | Date
  | string
  | number
  | number[]
  | Record<string, any>
  | undefined
  | null;

export interface MomentConfig {
  _d?: Date;
  _dClone?: boolean;
  _i?: any;
  _f?: string | string[];
  _l?: string;
  _isValid?: boolean;
  _isUTC?: boolean;
  _offset?: number;
  _strict?: boolean;
  _overflow?: number;
  _nullInput?: boolean;
  _invalidMonth?: string | null;
  _empty?: boolean;
  _iso?: boolean;
  _unusedTokens?: string[];
  _unusedInput?: string[];
  _charsLeftOver?: number;
  _weekdayMismatch?: boolean;
  _parsedDateParts?: any[];
  _meridiem?: string;
  _rfc2822?: boolean;
  _invalidFormat?: boolean;
  _bigHour?: boolean;
  _isParseZone?: boolean;
  _userInvalidated?: boolean;
}

const enum DMethod { FullYear, Month, Date, Day, Hours, Minutes, Seconds, Milliseconds }
const DMethodStr = ["FullYear", "Month", "Date", "Day", "Hours", "Minutes", "Seconds", "Milliseconds"];

const calendarKeys = ["sameDay", "nextDay", "nextWeek", "lastDay", "lastWeek", "sameElse"];

function isCalendarFormatObject(obj: Record<string, any>): boolean {
  for (const key of calendarKeys) {
    if (hasOwnProp(obj, key)) return true;
  }
  return false;
}

function firstWeekOffset(year: number, dow: number, doy: number, utc: boolean): number {
  const fwd = 7 + dow - doy;
  const janFwd = utc ? new Date(Date.UTC(year, 0, fwd)) : new Date(year, 0, fwd);
  const janFwdDay = utc ? janFwd.getUTCDay() : janFwd.getDay();
  const fwdlw = (7 + janFwdDay - dow) % 7;
  return -fwdlw + fwd - 1;
}

function weeksInYear(year: number, dow: number, doy: number, utc: boolean): number {
  const weekOffset = firstWeekOffset(year, dow, doy, utc);
  const weekOffsetNext = firstWeekOffset(year + 1, dow, doy, utc);
  return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
}

function getISOWeekNumber(d: Date, utc: boolean): number {
  const getYear = utc ? (x: Date) => x.getUTCFullYear() : (x: Date) => x.getFullYear();
  const year = getYear(d);
  const weekOffset = firstWeekOffset(year, 1, 4, utc);
  const dayOfYear = getDayOfYear(d, utc);
  let week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    week += weeksInYear(year - 1, 1, 4, utc);
  } else {
    const yearWeeks = weeksInYear(year, 1, 4, utc);
    if (week > yearWeeks) return 1;
  }
  return week;
}

function getISOWeekYear(d: Date, utc: boolean): number {
  const getYear = utc ? (x: Date) => x.getUTCFullYear() : (x: Date) => x.getFullYear();
  const year = getYear(d);
  const weekOffset = firstWeekOffset(year, 1, 4, utc);
  const dayOfYear = getDayOfYear(d, utc);
  const week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) return year - 1;
  if (week > weeksInYear(year, 1, 4, utc)) return year + 1;
  return year;
}

function getDayOfYear(d: Date, utc: boolean): number {
  const year = utc ? d.getUTCFullYear() : d.getFullYear();
  const startOfYear = utc ? Date.UTC(year, 0, 0) : new Date(year, 0, 0).getTime();
  return Math.floor((d.getTime() - startOfYear) / 86400000);
}

function getLocaleWeekNumber(d: Date, utc: boolean, dow: number, doy: number): [number, number] {
  const getYear = utc ? (x: Date) => x.getUTCFullYear() : (x: Date) => x.getFullYear();
  const year = getYear(d);
  const weekOffset = firstWeekOffset(year, dow, doy, utc);
  const dayOfYear = getDayOfYear(d, utc);
  let week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    week += weeksInYear(year - 1, dow, doy, utc);
    return [year - 1, week];
  }
  const yearWeeks = weeksInYear(year, dow, doy, utc);
  if (week > yearWeeks) {
    return [year + 1, 1];
  }
  return [year, week];
}

function getLocaleWeekYear(d: Date, utc: boolean, dow: number, doy: number): number {
  return getLocaleWeekNumber(d, utc, dow, doy)[0];
}

function getLocaleWeek(d: Date, utc: boolean, dow: number, doy: number): number {
  return getLocaleWeekNumber(d, utc, dow, doy)[1];
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export class Moment {
  static calendarFormat: ((m: Moment, now: Moment) => string) | undefined;

  _d: Date;
  _i: any;
  _f: string | string[] | undefined;
  _l: string | undefined;
  _isValid: boolean;
  _isUTC: boolean;
  _offset: number;
  _strict: boolean;
  _isAMomentObject: boolean = true;
  _overflow: number = -1;
  _parsedDateParts: number[] = [];
  _unusedTokens: string[] = [];
  _unusedInput: string[] = [];
  _charsLeftOver: number = 0;
  _empty: boolean = false;
  _nullInput: boolean = false;
  _invalidMonth: string | null = null;
  _invalidFormat: boolean = false;
  _weekdayMismatch: boolean = false;
  _iso: boolean = false;
  _rfc2822: boolean = false;
  _invalidEra: number | undefined = undefined;
  _bigHour: boolean = false;
  _meridiem: string = "";
  _isParseZone: boolean = false;
  _userInvalidated: boolean = false;
  _tooBusyWith: string | undefined = undefined;
  _shared: boolean = false;

  private _locale: Locale | undefined;

  private _ensureOwnCopy(): void {
    if (this._shared) {
      this._d = new Date(this._d.getTime());
      this._shared = false;
    }
  }

  constructor(config: MomentConfig = {}) {
    const c = config as any;
    this._d = c._dClone === false && c._d ? c._d : (c._d ? new Date(c._d) : new Date(NaN));
    this._i = c._i;
    this._f = c._f;
    this._l = c._l || getCurrentLocale();
    this._strict = c._strict || false;
    this._isValid = c._isValid !== undefined ? c._isValid : !isNaN(this._d.getTime());
    this._isUTC = c._isUTC || false;
    this._offset = c._offset !== undefined ? c._offset : 0;
    if (c._overflow !== undefined) this._overflow = c._overflow;
    if (c._parsedDateParts) this._parsedDateParts = c._parsedDateParts;
    if (c._unusedTokens) this._unusedTokens = c._unusedTokens;
    if (c._unusedInput) this._unusedInput = c._unusedInput;
    if (c._charsLeftOver !== undefined) this._charsLeftOver = c._charsLeftOver;
    if (c._empty !== undefined) this._empty = c._empty;
    if (c._nullInput !== undefined) this._nullInput = c._nullInput;
    if (c._invalidMonth !== undefined) this._invalidMonth = c._invalidMonth;
    if (c._invalidFormat !== undefined) this._invalidFormat = c._invalidFormat;
    if (c._weekdayMismatch !== undefined) this._weekdayMismatch = c._weekdayMismatch;
    if (c._meridiem !== undefined) this._meridiem = c._meridiem;
    if (c._isParseZone !== undefined) this._isParseZone = c._isParseZone;
    if (c._rfc2822 !== undefined) this._rfc2822 = c._rfc2822;
    if (c._iso !== undefined) this._iso = c._iso;
    if (c._bigHour !== undefined) this._bigHour = c._bigHour;
    if (c._userInvalidated !== undefined) this._userInvalidated = c._userInvalidated;
    for (const key of Object.keys(c)) {
      if (key.startsWith("_") && c[key] !== undefined) {
        (this as any)[key] = c[key];
      }
    }
  }

  private _getLocale(): Locale {
    if (!this._locale) {
      this._locale = getLocale(this._l);
    }
    return this._locale;
  }

  private _gdt(method: DMethod): number {
    const prefix = this._isUTC ? "getUTC" : "get";
    return (this._d as any)[prefix + DMethodStr[method]]();
  }

  private _sdt(method: DMethod, value: number): void {
    this._ensureOwnCopy();
    const prefix = this._isUTC ? "setUTC" : "set";
    (this._d as any)[prefix + DMethodStr[method]](value);
  }

  isValid(): boolean {
    if (this._userInvalidated) return false;
    if (this._overflow >= 0) return false;
    if (this._invalidMonth) return false;
    if (this._empty) return false;
    if (this._nullInput) return false;
    if (this._invalidFormat) return false;
    if (this._weekdayMismatch) return false;
    if (this._bigHour && this._strict) return false;
    return this._isValid;
  }

  clone(): Moment {
    const config: MomentConfig = {
      _d: this._d,
      _i: this._i,
      _f: this._f,
      _l: this._l,
      _isValid: this._isValid,
      _isUTC: this._isUTC,
      _offset: this._offset,
      _strict: this._strict,
      _overflow: this._overflow,
      _parsedDateParts: [...this._parsedDateParts],
      _empty: this._empty,
      _nullInput: this._nullInput,
      _invalidMonth: this._invalidMonth,
      _invalidFormat: this._invalidFormat,
      _weekdayMismatch: this._weekdayMismatch,
      _meridiem: this._meridiem,
      _iso: this._iso,
      _rfc2822: this._rfc2822,
      _bigHour: this._bigHour,
      _charsLeftOver: this._charsLeftOver,
      _unusedTokens: [...this._unusedTokens],
      _unusedInput: [...this._unusedInput],
      _isParseZone: this._isParseZone,
    };
    const m = new Moment(config);
    for (const prop of momentProperties) {
      if (hasOwnProp(this, prop)) {
        (m as any)[prop] = (this as any)[prop];
      }
    }
    // CoW disabled
    return m;
  }

  year(y?: any): number | Moment {
    if (y !== undefined) {
      if (
        y === null ||
        y === undefined ||
        y === "" ||
        (typeof y === "object" && !(y instanceof Date))
      )
        return this;
      const num = Number(y);
      if (isNaN(num)) return this;
      const date = this._gdt(DMethod.Date);
      this._sdt(DMethod.FullYear, num);
      if (this._gdt(DMethod.Date) !== date) {
        this._sdt(DMethod.Date, 0);
      }
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this._gdt(DMethod.FullYear) : NaN;
  }

  month(m?: any): number | Moment {
    if (m !== undefined) {
      if (m === null || m === undefined) return this;
      if (typeof m === "string" && !/^-?\d+$/.test(m)) {
        const localeMonths = this._getLocale().monthsShortArray();
        const localeMonthsFull = this._getLocale().monthsArray();
        const allMonths = [
          ...localeMonthsFull.map((s) => s.toLowerCase()),
          ...localeMonths.map((s) => s.toLowerCase()),
        ];
        const idx = allMonths.indexOf(m.toLowerCase());
        if (idx >= 0) {
          m = idx % 12;
        } else {
          return this;
        }
      }
      const num = Number(m);
      if (isNaN(num)) return this;
      const date = this._gdt(DMethod.Date);
      this._sdt(DMethod.Month, num);
      if (this._gdt(DMethod.Date) !== date) {
        this._sdt(DMethod.Date, 0);
      }
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this._gdt(DMethod.Month) : NaN;
  }

  date(d?: any): number | Moment {
    if (d !== undefined) {
      if (
        d === null ||
        d === undefined ||
        d === "" ||
        (typeof d === "object" && !(d instanceof Date))
      )
        return this;
      const num = Number(d);
      if (isNaN(num)) return this;
      if (num <= 0) return this;
      this._sdt(DMethod.Date, num);
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this._gdt(DMethod.Date) : NaN;
  }

  day(d?: any): number | Moment {
    if (d !== undefined) {
      if (d === null || d === undefined) return this;
      let dayNum = Number(d);
      if (typeof d === "string") {
        const localeDays = this._getLocale().weekdaysShortArray();
        const localeDaysFull = this._getLocale().weekdaysArray();
        const localeDaysMin = this._getLocale().weekdaysMinArray();
        const allDays = [
          ...localeDaysFull.map((s) => s.toLowerCase()),
          ...localeDays.map((s) => s.toLowerCase()),
          ...localeDaysMin.map((s) => s.toLowerCase()),
        ];
        const idx = allDays.indexOf(d.toLowerCase());
        if (idx >= 0) {
          dayNum = idx % 7;
        } else {
          return this;
        }
      }
      if (isNaN(dayNum)) return this;
      const currentDay = this._gdt(DMethod.Day);
      const diff = dayNum - currentDay;
      const date = new Date(this._d);
      if (this._isUTC) {
        date.setUTCDate(date.getUTCDate() + diff);
      } else {
        date.setDate(date.getDate() + diff);
      }
      this._d = date;
      this._shared = false;
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this._gdt(DMethod.Day) : NaN;
  }

  weekday(d?: number): number | Moment {
    if (d !== undefined) {
      const current = this._gdt(DMethod.Day);
      const weekConfig = (this._getLocale()._config as any).week || { dow: 0 };
      const dow = weekConfig.dow;
      const weekday = (current - dow + 7) % 7;
      const diff = (d as number) - weekday;
      const date = new Date(this._d);
      if (this._isUTC) {
        date.setUTCDate(date.getUTCDate() + diff);
      } else {
        date.setDate(date.getDate() + diff);
      }
      this._d = date;
      this._shared = false;
      this._updateOffset(true);
      return this;
    }
    const day = this._gdt(DMethod.Day);
    const weekConfig = (this._getLocale()._config as any).week || { dow: 0 };
    const dow = weekConfig.dow;
    return (day - dow + 7) % 7;
  }

  isoWeekday(d?: any): number | Moment {
    if (d !== undefined) {
      if (typeof d === "string") {
        const map: Record<string, number> = {
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
          sunday: 7,
          mon: 1,
          tue: 2,
          wed: 3,
          thu: 4,
          fri: 5,
          sat: 6,
          sun: 7,
        };
        d = map[d.toLowerCase()];
        if (d === undefined) return this;
      }
      const target = d as number;
      const current = this._gdt(DMethod.Day);
      const currentIso = current === 0 ? 7 : current;
      const diff = target - currentIso;
      const date = new Date(this._d);
      if (this._isUTC) {
        date.setUTCDate(date.getUTCDate() + diff);
      } else {
        date.setDate(date.getDate() + diff);
      }
      this._d = date;
      this._shared = false;
      this._updateOffset(true);
      return this;
    }
    const day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
    return day === 0 ? 7 : day;
  }

  dayOfYear(d?: number): number | Moment {
    if (d !== undefined) {
      const year = this._gdt(DMethod.FullYear);
      const dayNum = Number(d);
      if (this._isUTC) {
        this._d = new Date(Date.UTC(year, 0, dayNum));
      } else {
        this._d = new Date(year, 0, dayNum);
      }
      this._shared = false;
      this._updateOffset(true);
      return this;
    }
    if (this._isUTC) {
      const startOfYear = Date.UTC(this._gdt(DMethod.FullYear), 0, 0);
      const diff = this._d.getTime() - startOfYear;
      return Math.floor(diff / 86400000);
    }
    const startOfYear = new Date(this._gdt(DMethod.FullYear), 0, 0);
    const diff = this._d.getTime() - startOfYear.getTime();
    return Math.floor(diff / 86400000);
  }

  hour(h?: any): number | Moment {
    if (h !== undefined) {
      if (h === null) return this;
      const num = Number(h);
      if (isNaN(num)) return this;
      this._sdt(DMethod.Hours, num);
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this._gdt(DMethod.Hours) : NaN;
  }

  minute(m?: any): number | Moment {
    if (m !== undefined) {
      if (m === null) return this;
      const num = Number(m);
      if (isNaN(num)) return this;
      this._sdt(DMethod.Minutes, num);
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this._gdt(DMethod.Minutes) : NaN;
  }

  second(s?: any): number | Moment {
    if (s !== undefined) {
      if (s === null) return this;
      const num = Number(s);
      if (isNaN(num)) return this;
      this._sdt(DMethod.Seconds, num);
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this._gdt(DMethod.Seconds) : NaN;
  }

  millisecond(ms?: any): number | Moment {
    if (ms !== undefined) {
      if (ms === null) return this;
      const num = Number(ms);
      if (isNaN(num)) return this;
      this._sdt(DMethod.Milliseconds, num);
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this._gdt(DMethod.Milliseconds) : NaN;
  }

  get(unit: string | object): number | Moment {
    if (isObject(unit)) return this;
    const u = normalizeUnits(unit as string);
    if (!u) return NaN;
    switch (u) {
      case "year":
        return this.year() as number;
      case "month":
        return this.month() as number;
      case "date":
        return this.date() as number;
      case "day":
        return this.day() as number;
      case "hour":
        return this.hour() as number;
      case "minute":
        return this.minute() as number;
      case "second":
        return this.second() as number;
      case "millisecond":
        return this.millisecond() as number;
      case "weekday":
        return this.weekday() as number;
      case "isoWeekday":
        return this.isoWeekday() as number;
      case "dayOfYear":
        return this.dayOfYear() as number;
      case "week":
        return this.week() as number;
      case "isoWeek":
        return this.isoWeek() as number;
      default:
        return NaN;
    }
  }

  set(unit: string | object, value?: number): Moment {
    if (isObject(unit)) {
      const obj = unit as Record<string, any>;

      const d = new Date(this._d);

      const yearVal =
        hasOwnProp(obj, "year") || hasOwnProp(obj, "years") || hasOwnProp(obj, "y")
          ? Number(obj.year !== undefined ? obj.year : obj.years !== undefined ? obj.years : obj.y)
          : undefined;
      const monthVal =
        hasOwnProp(obj, "month") || hasOwnProp(obj, "months") || hasOwnProp(obj, "M")
          ? Number(
              obj.month !== undefined ? obj.month : obj.months !== undefined ? obj.months : obj.M,
            )
          : undefined;
      const dateVal =
        hasOwnProp(obj, "date") ||
        hasOwnProp(obj, "dates") ||
        hasOwnProp(obj, "day") ||
        hasOwnProp(obj, "days") ||
        hasOwnProp(obj, "d")
          ? Number(
              obj.date !== undefined
                ? obj.date
                : obj.dates !== undefined
                  ? obj.dates
                  : obj.day !== undefined
                    ? obj.day
                    : obj.days !== undefined
                      ? obj.days
                      : obj.d,
            )
          : undefined;
      const hourVal =
        hasOwnProp(obj, "hour") || hasOwnProp(obj, "hours") || hasOwnProp(obj, "h")
          ? Number(obj.hour !== undefined ? obj.hour : obj.hours !== undefined ? obj.hours : obj.h)
          : undefined;
      const minuteVal =
        hasOwnProp(obj, "minute") || hasOwnProp(obj, "minutes") || hasOwnProp(obj, "m")
          ? Number(
              obj.minute !== undefined
                ? obj.minute
                : obj.minutes !== undefined
                  ? obj.minutes
                  : obj.m,
            )
          : undefined;
      const secondVal =
        hasOwnProp(obj, "second") || hasOwnProp(obj, "seconds") || hasOwnProp(obj, "s")
          ? Number(
              obj.second !== undefined
                ? obj.second
                : obj.seconds !== undefined
                  ? obj.seconds
                  : obj.s,
            )
          : undefined;
      const msVal =
        hasOwnProp(obj, "millisecond") || hasOwnProp(obj, "milliseconds") || hasOwnProp(obj, "ms")
          ? Number(
              obj.millisecond !== undefined
                ? obj.millisecond
                : obj.milliseconds !== undefined
                  ? obj.milliseconds
                  : obj.ms,
            )
          : undefined;

      const hasDate =
        yearVal !== undefined ||
        monthVal !== undefined ||
        dateVal !== undefined ||
        hourVal !== undefined ||
        minuteVal !== undefined ||
        secondVal !== undefined ||
        msVal !== undefined;

      if (hasDate) {
        const curYear = this._isUTC ? d.getUTCFullYear() : d.getFullYear();
        const curMonth = this._isUTC ? d.getUTCMonth() : d.getMonth();
        const curDate = this._isUTC ? d.getUTCDate() : d.getDate();
        const curHour = this._isUTC ? d.getUTCHours() : d.getHours();
        const curMinute = this._isUTC ? d.getUTCMinutes() : d.getMinutes();
        const curSecond = this._isUTC ? d.getUTCSeconds() : d.getSeconds();
        const curMs = this._isUTC ? d.getUTCMilliseconds() : d.getMilliseconds();

        const newYear = yearVal !== undefined ? yearVal : curYear;
        const newMonth = monthVal !== undefined ? monthVal : curMonth;
        const newDate = dateVal !== undefined ? dateVal : curDate;
        const newHour = hourVal !== undefined ? hourVal : curHour;
        const newMinute = minuteVal !== undefined ? minuteVal : curMinute;
        const newSecond = secondVal !== undefined ? secondVal : curSecond;
        const newMs = msVal !== undefined ? msVal : curMs;

        if (this._isUTC) {
          const tmp = new Date(
            Date.UTC(newYear, newMonth, 1, newHour, newMinute, newSecond, newMs),
          );
          const maxDays = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
          tmp.setUTCDate(Math.min(newDate, maxDays));
          this._d = tmp;
          this._shared = false;
        } else {
          const tmp = new Date(newYear, newMonth, 1, newHour, newMinute, newSecond, newMs);
          const maxDays = new Date(newYear, newMonth + 1, 0).getDate();
          tmp.setDate(Math.min(newDate, maxDays));
          this._d = tmp;
          this._shared = false;
        }
      }

      if (hasOwnProp(obj, "quarter") || hasOwnProp(obj, "Q")) {
        const q = obj.quarter !== undefined ? Number(obj.quarter) : Number(obj.Q);
        this.quarter(q);
      }
      if (hasOwnProp(obj, "weekYear")) {
        this.weekYear(obj.weekYear);
      }
      if (hasOwnProp(obj, "week")) {
        this.week(obj.week);
      }
      if (hasOwnProp(obj, "isoWeekYear")) {
        this.isoWeekYear(obj.isoWeekYear);
      }
      if (hasOwnProp(obj, "isoWeek")) {
        this.isoWeek(obj.isoWeek);
      }
      if (hasOwnProp(obj, "weekday")) {
        this.weekday(obj.weekday);
      }
      if (hasOwnProp(obj, "isoWeekday")) {
        this.isoWeekday(obj.isoWeekday);
      }
      if (hasOwnProp(obj, "dayOfYear")) {
        this.dayOfYear(obj.dayOfYear);
      }

      return this;
    }

    const u = normalizeUnits(unit as string);
    if (!u) return this;
    const v = value!;
    switch (u) {
      case "year":
        this.year(v);
        break;
      case "month":
        this.month(v);
        break;
      case "date":
        this.date(v);
        break;
      case "hour":
        this.hour(v);
        break;
      case "minute":
        this.minute(v);
        break;
      case "second":
        this.second(v);
        break;
      case "millisecond":
        this.millisecond(v);
        break;
      case "day":
        this.day(v);
        break;
      case "weekday":
        this.weekday(v);
        break;
      case "isoWeekday":
        this.isoWeekday(v);
        break;
      case "dayOfYear":
        this.dayOfYear(v);
        break;
      case "week":
        this.week(v);
        break;
      case "isoWeek":
        this.isoWeek(v);
        break;
      case "quarter":
        this.quarter(v);
        break;
      case "weekYear":
        this.weekYear(v);
        break;
      case "isoWeekYear":
        this.isoWeekYear(v);
        break;
    }
    return this;
  }

  add(amount: number | string | Duration | object, unit?: string): Moment {
    if (!this._isValid) return this;

    let dur: Duration;

    if (isDuration(amount)) {
      dur = amount as Duration;
    } else if (typeof amount === "number" && unit) {
      dur = new Duration({ [normalizeUnits(unit) || unit]: amount });
    } else if (typeof amount === "string" && unit !== undefined) {
      const normUnit = normalizeUnits(amount);
      if (normUnit) {
        const val = typeof unit === "string" ? Number(unit) : unit;
        dur = new Duration({ [normUnit]: val });
      } else if (normalizeUnits(unit)) {
        dur = new Duration(Number(amount), unit);
      } else {
        dur = new Duration(amount);
      }
    } else if (isString(amount)) {
      dur = new Duration(amount as string);
    } else if (isObject(amount)) {
      dur = new Duration(amount as object);
    } else if (typeof amount === "number") {
      dur = new Duration(amount);
    } else {
      return this;
    }

    const ms = dur._milliseconds;
    const days = absRound(dur._days);
    const months = absRound(dur._months);

    const d = new Date(this._d);

    if (months) {
      const curMonth = this._isUTC ? d.getUTCMonth() : d.getMonth();
      const newMonth = curMonth + months;
      const day = this._isUTC ? d.getUTCDate() : d.getDate();
      if (this._isUTC) {
        d.setUTCMonth(newMonth);
      } else {
        d.setMonth(curMonth + months);
      }
      if ((this._isUTC ? d.getUTCDate() : d.getDate()) !== day) {
        if (this._isUTC) {
          d.setUTCDate(0);
        } else {
          d.setDate(0);
        }
      }
    }

    if (days) {
      if (this._isUTC) {
        d.setUTCDate(d.getUTCDate() + days);
      } else {
        d.setDate(d.getDate() + days);
      }
    }
    if (ms) {
      d.setTime(d.getTime() + ms);
    }

    this._d = d;
    this._shared = false;
    this._updateOffset(!(!months && !days));
    if (isNaN(this._d.getTime())) this._isValid = false;
    return this;
  }

  subtract(amount: number | string | Duration | object, unit?: string): Moment {
    if (!this._isValid) return this;

    let dur: Duration;

    if (isDuration(amount)) {
      dur = amount as Duration;
    } else if (typeof amount === "number" && unit) {
      dur = new Duration({ [normalizeUnits(unit) || unit]: amount });
    } else if (typeof amount === "string" && unit !== undefined) {
      const normUnit = normalizeUnits(amount);
      if (normUnit) {
        const val = typeof unit === "string" ? Number(unit) : unit;
        dur = new Duration({ [normUnit]: val });
      } else if (normalizeUnits(unit)) {
        dur = new Duration(Number(amount), unit);
      } else {
        dur = new Duration(amount);
      }
    } else if (isString(amount)) {
      dur = new Duration(amount as string);
    } else if (isObject(amount)) {
      dur = new Duration(amount as object);
    } else if (typeof amount === "number") {
      dur = new Duration(amount);
    } else {
      return this;
    }

    const ms = dur._milliseconds;
    const days = absRound(dur._days);
    const months = absRound(dur._months);

    const d = new Date(this._d);

    if (months) {
      const curMonth = this._isUTC ? d.getUTCMonth() : d.getMonth();
      const day = this._isUTC ? d.getUTCDate() : d.getDate();
      if (this._isUTC) {
        d.setUTCMonth(curMonth - months);
      } else {
        d.setMonth(curMonth - months);
      }
      if ((this._isUTC ? d.getUTCDate() : d.getDate()) !== day) {
        if (this._isUTC) {
          d.setUTCDate(0);
        } else {
          d.setDate(0);
        }
      }
    }

    if (days) {
      if (this._isUTC) {
        d.setUTCDate(d.getUTCDate() - days);
      } else {
        d.setDate(d.getDate() - days);
      }
    }
    if (ms) {
      d.setTime(d.getTime() - ms);
    }

    this._d = d;
    this._shared = false;
    this._updateOffset(!(!months && !days));
    if (isNaN(this._d.getTime())) this._isValid = false;
    return this;
  }

  startOf(unit: string): Moment {
    const u = normalizeUnits(unit);
    if (!u) return this;
    const d = new Date(this._d);

    if (this._isUTC) {
      switch (u) {
        case "year":
          d.setUTCMonth(0);
          d.setUTCDate(1);
          d.setUTCHours(0, 0, 0, 0);
          break;
        case "quarter":
          d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3);
          d.setUTCDate(1);
          d.setUTCHours(0, 0, 0, 0);
          break;
        case "month":
          d.setUTCDate(1);
          d.setUTCHours(0, 0, 0, 0);
          break;
        case "week": {
          const _locWeek = this._getLocale();
          const _weekCfg = (_locWeek._config as any).week || { dow: 0 };
          const dow = _weekCfg.dow;
          const day = d.getUTCDay();
          const diff = (day - dow + 7) % 7;
          d.setUTCDate(d.getUTCDate() - diff);
          d.setUTCHours(0, 0, 0, 0);
          break;
        }
        case "isoWeek": {
          const day = d.getUTCDay();
          const diff = day === 0 ? -6 : 1 - day;
          d.setUTCDate(d.getUTCDate() + diff);
          d.setUTCHours(0, 0, 0, 0);
          break;
        }
        case "date":
        case "day":
          d.setUTCHours(0, 0, 0, 0);
          break;
        case "hour":
          d.setUTCMinutes(0, 0, 0);
          break;
        case "minute":
          d.setUTCSeconds(0, 0);
          break;
        case "second":
          d.setUTCMilliseconds(0);
          break;
      }
    } else {
      switch (u) {
        case "year":
          d.setMonth(0);
          d.setDate(1);
          d.setHours(12, 0, 0, 0);
          break;
        case "quarter":
          d.setMonth(Math.floor(d.getMonth() / 3) * 3);
          d.setDate(1);
          d.setHours(12, 0, 0, 0);
          break;
        case "month":
          d.setDate(1);
          d.setHours(12, 0, 0, 0);
          break;
        case "week": {
          const _locWeek = this._getLocale();
          const _weekCfg = (_locWeek._config as any).week || { dow: 0 };
          const dow = _weekCfg.dow;
          const day = d.getDay();
          const diff = (day - dow + 7) % 7;
          d.setDate(d.getDate() - diff);
          d.setHours(12, 0, 0, 0);
          break;
        }
        case "isoWeek": {
          const day = d.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          d.setDate(d.getDate() + diff);
          d.setHours(12, 0, 0, 0);
          break;
        }
        case "date":
        case "day":
          d.setHours(12, 0, 0, 0);
          break;
        case "hour":
          d.setMinutes(0, 0, 0);
          break;
        case "minute":
          d.setSeconds(0, 0);
          break;
        case "second":
          d.setMilliseconds(0);
          break;
      }
    }

    this._d = d;
    this._shared = false;
    this._updateOffset(true);
    return this;
  }

  endOf(unit: string): Moment {
    const u = normalizeUnits(unit);
    if (!u) return this;
    this.startOf(u);
    const d = new Date(this._d);

    if (this._isUTC) {
      switch (u) {
        case "year":
          d.setUTCFullYear(d.getUTCFullYear() + 1);
          d.setUTCMilliseconds(-1);
          break;
        case "quarter":
          d.setUTCMonth(d.getUTCMonth() + 3);
          d.setUTCMilliseconds(-1);
          break;
        case "month":
          d.setUTCMonth(d.getUTCMonth() + 1);
          d.setUTCMilliseconds(-1);
          break;
        case "week":
          d.setUTCDate(d.getUTCDate() + 6);
          d.setUTCHours(23, 59, 59, 999);
          break;
        case "isoWeek":
          d.setUTCDate(d.getUTCDate() + 6);
          d.setUTCHours(23, 59, 59, 999);
          break;
        case "date":
        case "day":
          d.setUTCDate(d.getUTCDate() + 1);
          d.setUTCMilliseconds(-1);
          break;
        case "hour":
          d.setUTCHours(d.getUTCHours() + 1);
          d.setUTCMilliseconds(-1);
          break;
        case "minute":
          d.setUTCMinutes(d.getUTCMinutes() + 1);
          d.setUTCMilliseconds(-1);
          break;
        case "second":
          d.setUTCSeconds(d.getUTCSeconds() + 1);
          d.setUTCMilliseconds(-1);
          break;
      }
    } else {
      switch (u) {
        case "year":
          d.setFullYear(d.getFullYear() + 1);
          d.setMilliseconds(0);
          break;
        case "quarter":
          d.setMonth(d.getMonth() + 3);
          d.setMilliseconds(0);
          break;
        case "month":
          d.setMonth(d.getMonth() + 1);
          d.setMilliseconds(0);
          break;
        case "week":
        case "isoWeek":
          d.setDate(d.getDate() + 6);
          d.setHours(23, 59, 59, 999);
          break;
        case "date":
        case "day":
          d.setDate(d.getDate() + 1);
          d.setMilliseconds(0);
          break;
        case "hour":
          d.setHours(d.getHours() + 1);
          d.setMilliseconds(0);
          break;
        case "minute":
          d.setMinutes(d.getMinutes() + 1);
          d.setMilliseconds(0);
          break;
        case "second":
          d.setSeconds(d.getSeconds() + 1);
          d.setMilliseconds(0);
          break;
      }
    }

    this._d = d;
    this._shared = false;
    this._updateOffset(true);
    return this;
  }

  local(keepLocalTime?: boolean): Moment {
    if (this._isUTC) {
      if (keepLocalTime) {
        const d = this._d;
        this._d = new Date(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds(),
          d.getUTCMilliseconds(),
        );
      } else {
        this._d = new Date(this.valueOf());
      }
      this._shared = false;
    }
    this._isUTC = false;
    this._offset = 0;
    return this;
  }

  utc(keepLocalTime?: boolean): Moment {
    if (this._isUTC && this._offset !== 0) {
      if (!keepLocalTime) {
        this._d = new Date(this.valueOf());
        this._shared = false;
      }
    } else if (!this._isUTC) {
      if (keepLocalTime) {
        const d = this._d;
        this._d = new Date(
          Date.UTC(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            d.getHours(),
            d.getMinutes(),
            d.getSeconds(),
            d.getMilliseconds(),
          ),
        );
      } else {
        this._d = new Date(this.valueOf());
      }
      this._shared = false;
    }
    this._isUTC = true;
    this._offset = 0;
    return this;
  }

  utcOffset(offset?: number | string, keepLocalTime?: boolean): number | Moment {
    if (offset === undefined) {
      return this._isUTC ? this._offset : -this._d.getTimezoneOffset();
    }

    let numOffset: number;
    if (typeof offset === "string") {
      numOffset = parseOffsetString(offset) as number;
      if (numOffset === null || isNaN(numOffset)) return this;
    } else {
      numOffset = Math.abs(offset) < 16 ? offset * 60 : offset;
    }
    if (keepLocalTime) {
      if (!this._isUTC) {
        const d = this._d;
        this._d = new Date(
          Date.UTC(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            d.getHours(),
            d.getMinutes(),
            d.getSeconds(),
            d.getMilliseconds(),
          ),
        );
        this._shared = false;
      }
      this._offset = numOffset;
      this._isUTC = true;
    } else {
      const oldAbsTime = this.valueOf();
      this._d = new Date(oldAbsTime + numOffset * 60000);
      this._shared = false;
      this._offset = numOffset;
      this._isUTC = true;
    }
    return this;
  }

  format(format?: string): string {
    if (!format) {
      if (this._isUTC && this._offset === 0) {
        format = "YYYY-MM-DDTHH:mm:ss[Z]";
      } else {
        format = "YYYY-MM-DDTHH:mm:ssZ";
      }
    }
    return formatMoment(this as any, format);
  }

  fromNow(pref?: boolean): string {
    if (!this._isValid) return this._getLocale().invalidDate();
    return this.from(new Date(), pref);
  }

  from(input: MomentInput, pref?: boolean): string {
    if (!this._isValid) return this._getLocale().invalidDate();
    let other: Moment;
    if (input === undefined || input === null) {
      other = new Moment({ _d: new Date(), _dClone: false });
    } else {
      other = momentFromAnything(input);
    }

    if (!other._isValid) return this._getLocale().invalidDate();

    const dur = new Duration({ to: this, from: other });
    if (this._l) dur.locale(this._l);
    return dur.humanize(!pref);
  }

  toNow(pref?: boolean): string {
    if (!this._isValid) return this._getLocale().invalidDate();
    return this.to(new Date(), pref);
  }

  to(input: MomentInput, pref?: boolean): string {
    if (!this._isValid) return this._getLocale().invalidDate();
    const other = momentFromAnything(input);
    if (!other._isValid) return this._getLocale().invalidDate();

    const dur = new Duration({ from: this, to: other });
    if (this._l) dur.locale(this._l);
    return dur.humanize(!pref);
  }

  calendar(ref?: MomentInput, opts?: object): string {
    let reference: Moment;
    let formatOpts: Record<string, any> | undefined;

    if (opts !== undefined) {
      if (!ref) {
        reference = new Moment({ _d: new Date(), _dClone: false });
      } else {
        reference = momentFromAnything(ref);
      }
      formatOpts = opts as Record<string, any>;
    } else if (ref !== undefined) {
      if (!ref) {
        reference = new Moment({ _d: new Date(), _dClone: false });
      } else if (isObject(ref)) {
        const obj = ref as Record<string, any>;
        if (isCalendarFormatObject(obj)) {
          formatOpts = obj;
          reference = new Moment({ _d: new Date(), _dClone: false });
        } else {
          reference = momentFromAnything(ref);
        }
      } else if (isArray(ref)) {
        reference = momentFromAnything(ref);
      } else {
        reference = momentFromAnything(ref);
      }
    } else {
      reference = new Moment({ _d: new Date(), _dClone: false });
    }

    const locale = this._getLocale();
    const cal = locale._config.calendar || ({} as Record<string, any>);

    let key: string;
    const calendarFormat = Moment.calendarFormat;
    if (calendarFormat) {
      key = calendarFormat(this, reference);
    } else {
      const thisOff = this.utcOffset() as number;
      const thatOff = reference.utcOffset() as number;
      const thisDay = Math.floor((this.valueOf() + thisOff * 60000) / 86400000);
      const thatDay = Math.floor((reference.valueOf() + thatOff * 60000) / 86400000);
      const sameOffset = thisOff === thatOff;
      const dayDiff = sameOffset
        ? thisDay - thatDay
        : thisDay - Math.floor((reference.valueOf() + thisOff * 60000) / 86400000);

      if (dayDiff < -6) {
        key = "sameElse";
      } else if (dayDiff < -1) {
        key = "lastWeek";
      } else if (dayDiff < 0) {
        key = "lastDay";
      } else if (dayDiff < 1) {
        key = "sameDay";
      } else if (dayDiff < 2) {
        key = "nextDay";
      } else if (dayDiff < 7) {
        key = "nextWeek";
      } else {
        key = "sameElse";
      }
    }

    let formatString: any;

    if (typeof cal === "function") {
      formatString = (cal as Function).call(locale._config, key, this);
    } else if (formatOpts && hasOwnProp(formatOpts, key)) {
      formatString = formatOpts[key];
    } else if (hasOwnProp(cal as any, key)) {
      formatString = (cal as any)[key];
    } else if (hasOwnProp(cal as any, "sameElse")) {
      formatString = (cal as any)["sameElse"];
    } else {
      formatString = "L";
    }

    if (typeof formatString === "function") {
      formatString = formatString(this, reference);
    }

    if (typeof formatString === "string") {
      return formatMoment(this as any, formatString);
    }

    return formatMoment(this as any, "L");
  }

  diff(input: MomentInput, unit?: string, float?: boolean): number {
    const other = momentFromAnything(input);
    const diff = other.valueOf() - this.valueOf();

    if (!unit) return diff;

    const u = normalizeUnits(unit);
    if (!u) return NaN;

    const trunc = (n: number): number => {
      if (n < 0) return -Math.floor(-n);
      return Math.floor(n);
    };

    let result: number;
    switch (u) {
      case "year":
      case "month":
      case "quarter": {
        const monthDiff = (a: Moment, b: Moment): number => {
          if ((a.date() as number) < (b.date() as number)) {
            return -monthDiff(b, a);
          }
          const wholeMonthDiff =
            ((b.year() as number) - (a.year() as number)) * 12 +
            ((b.month() as number) - (a.month() as number));
          const anchor = new Moment({ _d: new Date(a._d), _dClone: false });
          anchor.add(wholeMonthDiff, "months");
          const bVal = b.valueOf();
          const anchorVal = anchor.valueOf();
          const sub = bVal - anchorVal;
          let adjust: number;
          if (sub < 0) {
            const anchor2 = new Moment({ _d: new Date(a._d), _dClone: false });
            anchor2.add(wholeMonthDiff - 1, "months");
            adjust = sub / (anchorVal - anchor2.valueOf());
          } else {
            const anchor2 = new Moment({ _d: new Date(a._d), _dClone: false });
            anchor2.add(wholeMonthDiff + 1, "months");
            adjust = sub / (anchor2.valueOf() - anchorVal);
          }
          return -(wholeMonthDiff + adjust);
        };
        const resultMonths = monthDiff(this, other);
        if (u === "year") result = resultMonths / 12;
        else if (u === "quarter") result = resultMonths / 3;
        else result = resultMonths;
        break;
      }
      case "week": {
        const dayDiff = this.diff(other, "day", true);
        result = dayDiff / 7;
        break;
      }
      case "date":
      case "day": {
        result = diff / 86400000;
        break;
      }
      case "hour":
        result = diff / 3600000;
        break;
      case "minute":
        result = diff / 60000;
        break;
      case "second":
        result = diff / 1000;
        break;
      case "millisecond":
        result = diff;
        break;
      default:
        result = diff;
    }

    if (float) return result;
    const truncated = trunc(result);
    if (Object.is(truncated, -0)) return 0;
    return truncated;
  }

  valueOf(): number {
    if (!this._isValid) return NaN;
    if (this._isUTC) {
      return this._d.getTime() - this._offset * 60000;
    }
    return this._d.getTime();
  }

  unix(): number {
    return Math.floor(this.valueOf() / 1000);
  }

  daysInMonth(): number {
    return daysInMonth(this.year() as number, this.month() as number);
  }

  toDate(): Date {
    return new Date(this.valueOf());
  }

  toArray(): number[] {
    return [
      this.year() as number,
      this.month() as number,
      this.date() as number,
      this.hour() as number,
      this.minute() as number,
      this.second() as number,
      this.millisecond() as number,
    ];
  }

  toISOString(keepOffset?: boolean): string {
    if (!this._isValid) {
      return null as unknown as string;
    }
    if (keepOffset) {
      const d = this._d;
      const year = this._isUTC ? d.getUTCFullYear() : d.getFullYear();
      const month = zeroFill((this._isUTC ? d.getUTCMonth() : d.getMonth()) + 1, 2);
      const day = zeroFill(this._isUTC ? d.getUTCDate() : d.getDate(), 2);
      const hour = zeroFill(this._isUTC ? d.getUTCHours() : d.getHours(), 2);
      const min = zeroFill(this._isUTC ? d.getUTCMinutes() : d.getMinutes(), 2);
      const sec = zeroFill(this._isUTC ? d.getUTCSeconds() : d.getSeconds(), 2);
      const ms = zeroFill(this._isUTC ? d.getUTCMilliseconds() : d.getMilliseconds(), 3);
      let offset: number;
      if (this._isUTC) {
        offset = this._offset;
      } else {
        offset = -d.getTimezoneOffset();
      }
      const sign = offset >= 0 ? "+" : "-";
      const absOffset = Math.abs(offset);
      const offsetStr =
        `${sign + zeroFill(Math.floor(absOffset / 60), 2)  }:${  zeroFill(absOffset % 60, 2)}`;
      let yearStr: string;
      if (year >= 0) {
        yearStr = year >= 10000 ? `+${  zeroFill(year, 6)}` : zeroFill(year, 4);
      } else {
        yearStr = `-${  zeroFill(-year, 6)}`;
      }
      return `${yearStr}-${month}-${day}T${hour}:${min}:${sec}.${ms}${offsetStr}`;
    }
    const utcMs = this._isUTC ? this._d.getTime() - this._offset * 60000 : this._d.getTime();
    const utcDate = new Date(utcMs);
    const year = utcDate.getUTCFullYear();
    const month = zeroFill(utcDate.getUTCMonth() + 1, 2);
    const day = zeroFill(utcDate.getUTCDate(), 2);
    const hour = zeroFill(utcDate.getUTCHours(), 2);
    const min = zeroFill(utcDate.getUTCMinutes(), 2);
    const sec = zeroFill(utcDate.getUTCSeconds(), 2);
    const ms = zeroFill(utcDate.getUTCMilliseconds(), 3);
    const offsetStr = "Z";

    let yearStr: string;
    if (year >= 0) {
      if (year >= 10000) {
        yearStr = `+${  zeroFill(year, 6)}`;
      } else {
        yearStr = zeroFill(year, 4);
      }
    } else {
      yearStr = `-${  zeroFill(-year, 6)}`;
    }

    return `${yearStr}-${month}-${day}T${hour}:${min}:${sec}.${ms}${offsetStr}`;
  }

  toJSON(): string {
    return this.toISOString();
  }

  toString(): string {
    if (!this._isValid) return "Invalid date";
    return this.format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
  }

  inspect(): string {
    if (!this._isValid) {
      const inputStr = this._i !== undefined ? String(this._i) : "";
      return `moment.invalid(/* ${inputStr} */)`;
    }
    if (!this.isLocal()) {
      const func = (this.utcOffset() as number) === 0 ? "moment.utc" : "moment.parseZone";
      const yearStr =
        (this.year() as number) >= 0 && (this.year() as number) <= 9999 ? "YYYY" : "YYYYYY";
      return this.format(`[${func}("]${yearStr}-MM-DD[T]HH:mm:ss.SSSZ[")]`);
    }
    const yearStr =
      (this.year() as number) >= 0 && (this.year() as number) <= 9999 ? "YYYY" : "YYYYYY";
    return this.format(`[moment("]${yearStr}-MM-DD[T]HH:mm:ss.SSS[")]`);
  }

  private _compareCalendarValues(other: Moment, unit: string): number {
    const u = normalizeUnits(unit);
    if (!u) return NaN;
    if (u === "millisecond") return this.valueOf() - other.valueOf();
    if (u === "second")
      return this.clone().startOf("second").valueOf() - other.clone().startOf("second").valueOf();
    if (u === "minute")
      return this.clone().startOf("minute").valueOf() - other.clone().startOf("minute").valueOf();
    if (u === "hour")
      return this.clone().startOf("hour").valueOf() - other.clone().startOf("hour").valueOf();
    const thisFields: Record<string, number> = {};
    const otherFields: Record<string, number> = {};
    switch (u) {
      case "year":
        thisFields.year = this.year() as number;
        otherFields.year = other.year() as number;
        break;
      case "month":
        thisFields.year = this.year() as number;
        otherFields.year = other.year() as number;
        thisFields.month = this.month() as number;
        otherFields.month = other.month() as number;
        break;
      case "quarter":
        thisFields.year = this.year() as number;
        otherFields.year = other.year() as number;
        thisFields.quarter = this.quarter() as number;
        otherFields.quarter = other.quarter() as number;
        break;
      case "week":
      case "isoWeek":
        thisFields.weekYear =
          u === "isoWeek" ? (this.isoWeekYear() as number) : (this.weekYear() as number);
        otherFields.weekYear =
          u === "isoWeek" ? (other.isoWeekYear() as number) : (other.weekYear() as number);
        thisFields.week = u === "isoWeek" ? (this.isoWeek() as number) : (this.week() as number);
        otherFields.week = u === "isoWeek" ? (other.isoWeek() as number) : (other.week() as number);
        break;
      case "day":
      case "date":
      default:
        thisFields.year = this.year() as number;
        otherFields.year = other.year() as number;
        thisFields.month = this.month() as number;
        otherFields.month = other.month() as number;
        thisFields.date = this.date() as number;
        otherFields.date = other.date() as number;
        break;
    }
    for (const key of Object.keys(thisFields)) {
      const diff = thisFields[key] - otherFields[key];
      if (diff !== 0) return diff;
    }
    return 0;
  }

  isSame(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) return false;
    if (unit) {
      return this._compareCalendarValues(other, unit) === 0;
    }
    return this.valueOf() === other.valueOf();
  }

  isSameOrBefore(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) return false;
    return this._compareCalendarValues(other, unit || "millisecond") <= 0;
  }

  isSameOrAfter(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) return false;
    return this._compareCalendarValues(other, unit || "millisecond") >= 0;
  }

  isBetween(from: MomentInput, to: MomentInput, unit?: string, inclusivity?: string): boolean {
    const fromM = momentFromAnything(from);
    const toM = momentFromAnything(to);

    const fromStr = inclusivity || "()";
    const startOpen = fromStr[0] === "(";
    const endOpen = fromStr.at(-1) === ")";

    const startCheck = startOpen ? this.isAfter(fromM, unit) : this.isSameOrAfter(fromM, unit);
    const endCheck = endOpen ? this.isBefore(toM, unit) : this.isSameOrBefore(toM, unit);

    return startCheck && endCheck;
  }

  isLeapYear(): boolean {
    return isLeapYear(this.year() as number);
  }

  isDST(): boolean {
    if (this._isUTC) {
      return (this.utcOffset() as number) !== 0 && typeof updateOffsetCallback === "function";
    }
    const jan = new Date(this._d.getFullYear(), 0, 1);
    const jul = new Date(this._d.getFullYear(), 6, 1);
    const janOff = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    return this._d.getTimezoneOffset() < janOff;
  }

  isLocal(): boolean {
    if (!this._isValid) return false;
    return !this._isUTC;
  }

  isUtc(): boolean {
    return this._isUTC && this._offset === 0;
  }

  isUtcOffset(): boolean {
    return this._isUTC;
  }

  isUTC(): boolean {
    return this._isUTC && this._offset === 0;
  }

  years(y?: number): number | Moment {
    return this.year(y);
  }
  months(m?: number): number | Moment {
    return this.month(m);
  }
  dates(d?: number): number | Moment {
    return this.date(d);
  }
  days(d?: number): number | Moment {
    return this.day(d);
  }
  hours(h?: number): number | Moment {
    return this.hour(h);
  }
  minutes(m?: number): number | Moment {
    return this.minute(m);
  }
  seconds(s?: number): number | Moment {
    return this.second(s);
  }
  milliseconds(ms?: number): number | Moment {
    return this.millisecond(ms);
  }

  quarter(q?: number): number | Moment {
    if (q !== undefined) {
      this.month((q - 1) * 3 + ((this.month() as number) % 3));
      return this;
    }
    return Math.floor((this.month() as number) / 3) + 1;
  }

  quarters(q?: number): number | Moment {
    return this.quarter(q);
  }

  week(w?: number): number | Moment {
    const weekConfig = (this._getLocale()._config as any).week || { dow: 0, doy: 6 };
    const dow = weekConfig.dow;
    const doy = weekConfig.doy;

    if (w !== undefined) {
      const current = getLocaleWeek(this._d, this._isUTC, dow, doy);
      const diff = w - current;
      const d = new Date(this._d.getTime());
      if (this._isUTC) {
        d.setUTCDate(d.getUTCDate() + diff * 7);
      } else {
        d.setDate(d.getDate() + diff * 7);
      }
      this._d = d;
      this._shared = false;
      return this;
    }

    return getLocaleWeek(this._d, this._isUTC, dow, doy);
  }

  weeks(w?: number): number | Moment {
    return this.week(w);
  }

  max(other?: MomentInput): Moment {
    if (!this._isValid) return this;
    const otherM =
      other !== undefined ? momentFromAnything(other) : new Moment({ _d: new Date(NaN), _dClone: false });
    if (!otherM._isValid) return otherM;
    if (otherM.valueOf() > this.valueOf()) return otherM;
    return this;
  }

  min(other?: MomentInput): Moment {
    if (!this._isValid) return this;
    const otherM =
      other !== undefined ? momentFromAnything(other) : new Moment({ _d: new Date(NaN), _dClone: false });
    if (!otherM._isValid) return otherM;
    if (otherM.valueOf() < this.valueOf()) return otherM;
    return this;
  }

  weekYear(y?: number): number | Moment {
    const weekConfig = (this._getLocale()._config as any).week || { dow: 0, doy: 6 };
    const dow = weekConfig.dow;
    const doy = weekConfig.doy;

    if (y !== undefined) {
      let currentWeek = getLocaleWeek(this._d, this._isUTC, dow, doy);
      const currentDay = this.weekday() as number;
      const maxWeek = weeksInYear(y, dow, doy, this._isUTC);
      if (currentWeek > maxWeek) currentWeek = maxWeek;
      const jan1 = new Date(Date.UTC(y, 0, 1));
      const fwd = 7 + dow - doy;
      const fwdDate = new Date(Date.UTC(y, 0, fwd));
      const fwdDay = fwdDate.getUTCDay();
      const fwdlw = (7 + fwdDay - dow) % 7;
      const offset = -fwdlw + fwd - 1;
      const week1Start = new Date(jan1.getTime() + offset * 86400000);
      const target = new Date(
        week1Start.getTime() + ((currentWeek - 1) * 7 + currentDay) * 86400000,
      );
      this._d = target;
      this._shared = false;
      this._updateOffset(true);
      return this;
    }

    if (dow === 1 && doy === 4) {
      return getISOWeekYear(this._d, this._isUTC);
    }
    return getLocaleWeekYear(this._d, this._isUTC, dow, doy);
  }

  isoWeek(w?: number): number | Moment {
    if (w !== undefined) {
      const current = getISOWeekNumber(this._d, this._isUTC);
      const diff = w - current;
      const d = new Date(this._d.getTime());
      if (this._isUTC) {
        d.setUTCDate(d.getUTCDate() + diff * 7);
      } else {
        d.setDate(d.getDate() + diff * 7);
      }
      this._d = d;
      this._shared = false;
      return this;
    }
    return getISOWeekNumber(this._d, this._isUTC);
  }

  isoWeeks(w?: number): number | Moment {
    return this.isoWeek(w);
  }

  isoWeekYear(y?: number): number | Moment {
    if (y !== undefined) {
      let currentWeek = getISOWeekNumber(this._d, this._isUTC);
      const currentDay = this.isoWeekday() as number;
      const maxWeek = weeksInYear(y, 1, 4, this._isUTC);
      if (currentWeek > maxWeek) currentWeek = maxWeek;
      const jan4 = new Date(Date.UTC(y, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const mondayOfWeek1 = new Date(Date.UTC(y, 0, 4 - (jan4Day - 1)));
      const target = new Date(
        mondayOfWeek1.getTime() + ((currentWeek - 1) * 7 + (currentDay - 1)) * 86400000,
      );
      this._d = target;
      this._shared = false;
      return this;
    }
    return getISOWeekYear(this._d, this._isUTC);
  }

  isoWeeksInYear(): number {
    const year = this.year() as number;
    return weeksInYear(year, 1, 4, this._isUTC);
  }

  weeksInYear(): number {
    const weekConfig = (this._getLocale()._config as any).week || { dow: 0, doy: 6 };
    const dow = weekConfig.dow;
    const doy = weekConfig.doy;
    const year = this.year() as number;
    return weeksInYear(year, dow, doy, this._isUTC);
  }

  weeksInWeekYear(): number {
    const weekConfig = (this._getLocale()._config as any).week || { dow: 0, doy: 6 };
    const dow = weekConfig.dow;
    const doy = weekConfig.doy;
    const weekYear = getLocaleWeekYear(this._d, this._isUTC, dow, doy);
    return weeksInYear(weekYear, dow, doy, this._isUTC);
  }

  isoWeeksInISOWeekYear(): number {
    const year = this.isoWeekYear() as number;
    return weeksInYear(year, 1, 4, this._isUTC);
  }

  parseZone(input?: any, format?: any): Moment {
    if (!this._isValid) {
      const m = this.clone();
      m._isParseZone = true;
      return m;
    }
    if (input === undefined) {
      const m = this.clone();
      m._isParseZone = true;
      if (isString(this._i)) {
        const fmt = this._f as string | undefined;
        const p =
          fmt && fmt !== "RFC_2822" && fmt !== "ISO_8601"
            ? parseString(this._i as string, fmt)
            : parseString(this._i as string);
        if (p && p.offset !== undefined) {
          m._d = new Date(m.valueOf() + p.offset * 60000);
          m._shared = false;
          m._offset = p.offset;
          m._isUTC = true;
        } else {
          const allInput = `${this._i as string  } ${  ((this as any)._unusedInput || []).join("")}`;
          const tzMatch = allInput.match(/([+-]\d{2}):?(\d{2})\s*$/);
          if (tzMatch) {
            const sign = tzMatch[1][0] === "+" ? 1 : -1;
            const hours = parseInt(tzMatch[1].substring(1), 10);
            const minutes = parseInt(tzMatch[2], 10);
            m._offset = sign * (hours * 60 + minutes);
            m._isUTC = true;
          }
        }
      }
      return m;
    }
    const m = momentFromAnything(input);
    m._isParseZone = true;
    if (format && isString(input)) {
      const parsed = parseString(input as string, format);
      if (parsed && parsed.offset !== undefined) {
        const d = createDateSafe(
          parsed.year !== undefined ? parsed.year : 0,
          parsed.month !== undefined ? parsed.month : 0,
          parsed.day !== undefined ? parsed.day : 1,
          parsed.hour !== undefined ? parsed.hour : 0,
          parsed.minute !== undefined ? parsed.minute : 0,
          parsed.second !== undefined ? parsed.second : 0,
          parsed.millisecond !== undefined ? parsed.millisecond : 0,
          true,
        );
        m._d = d;
        m._shared = false;
        m._offset = parsed.offset;
        m._isUTC = true;
      } else if (isString(input)) {
        const allInput =
          `${input as string 
          } ${ 
          parsed && parsed._unusedInput ? parsed._unusedInput.join("") : ""}`;
        const tzMatch = allInput.match(/([+-]\d{2}):?(\d{2})\s*$/);
        if (tzMatch) {
          const sign = tzMatch[1][0] === "+" ? 1 : -1;
          const hours = parseInt(tzMatch[1].substring(1), 10);
          const minutes = parseInt(tzMatch[2], 10);
          m._offset = sign * (hours * 60 + minutes);
          m._isUTC = true;
        }
      }
    }
    return m;
  }

  zone(offset?: number | string, keepLocalTime?: boolean): number | Moment {
    if (offset === undefined) {
      const o = this.utcOffset() as number;
      return -o;
    }
    if (typeof offset === "string") {
      const tzMatch = offset.match(/([+-]\d{1,2}):?(\d{2})?$/);
      if (tzMatch) {
        const sign = tzMatch[1][0] === "+" ? 1 : -1;
        const hours = parseInt(tzMatch[1].substring(1), 10);
        const minutes = tzMatch[2] ? parseInt(tzMatch[2], 10) : 0;
        const parsedOffset = sign * (hours * 60 + minutes);
        this.utcOffset(parsedOffset, keepLocalTime);
      } else if (/^[+-]\d{1,2}$/.test(offset.trim())) {
        const num = parseInt(offset, 10);
        if (Math.abs(num) < 16) {
          this.utcOffset(-num * 60, keepLocalTime);
        } else {
          this.utcOffset(-num, keepLocalTime);
        }
      } else {
        const num = Number(offset);
        if (!isNaN(num)) {
          this.utcOffset(-num, keepLocalTime);
        }
      }
      return this;
    }
    const numOffset = offset as number;
    if (Math.abs(numOffset) < 16) {
      this.utcOffset(-numOffset * 60, keepLocalTime);
    } else {
      this.utcOffset(-numOffset, keepLocalTime);
    }
    return this;
  }

  zoneAbbr(): string {
    if (this._isUTC) {
      if (this._offset === 0) return "UTC";
      const offset = this._offset;
      const hours = Math.floor(Math.abs(offset) / 60);
      const minutes = Math.abs(offset) % 60;
      const sign = offset >= 0 ? "+" : "-";
      return `GMT${  sign  }${String(hours).padStart(2, "0")  }${String(minutes).padStart(2, "0")}`;
    }
    return "";
  }

  zoneName(): string {
    if (this._isUTC) {
      if (this._offset === 0) return "Coordinated Universal Time";
    }
    return "";
  }

  localeData(): Locale {
    return this._getLocale();
  }

  lang(locale?: string | string[] | false): string | Moment {
    if (locale === undefined) return this._l || getCurrentLocale();
    if (locale === false) {
      this._l = undefined as any;
      this._locale = undefined as any;
      return this;
    }
    if (Array.isArray(locale)) {
      for (const l of locale) {
        if (this._trySetLocale(l)) return this;
      }
      return this;
    }
    this._trySetLocale(locale);
    return this;
  }

  private _trySetLocale(locale: string): boolean {
    const parts = locale.toLowerCase().replaceAll('_', "-").split("-");
    for (let j = parts.length; j > 0; j--) {
      const candidate = parts.slice(0, j).join("-");
      if (hasLocale(candidate)) {
        this._l = candidate;
        this._locale = undefined as any;
        return true;
      }
    }
    return false;
  }

  locale(locale?: string | string[] | false): string | Moment {
    if (locale === undefined || locale === false) {
      if (locale === false) {
        this._l = undefined as any;
        this._locale = undefined as any;
      }
      return this._l || getCurrentLocale();
    }
    if (Array.isArray(locale)) {
      for (const l of locale) {
        if (this._trySetLocale(l)) return this;
      }
      return this;
    }
    this._trySetLocale(locale);
    return this;
  }

  creationData(): Record<string, any> {
    const loc = this._getLocale();
    const result: Record<string, any> = {
      input: this._i,
      format: this._f,
      locale: loc,
      isUTC: this._isUTC,
      strict: this._strict || false,
    };
    return result;
  }

  parsingFlags(): object {
    const result: Record<string, any> = {
      overflow: this._overflow !== undefined ? this._overflow : -1,
      unusedTokens: this._unusedTokens || [],
      unusedInput: this._unusedInput || [],
      charsLeftOver: this._charsLeftOver || 0,
      empty: this._empty || false,
      nullInput: this._nullInput || false,
      invalidMonth: this._invalidMonth !== undefined ? this._invalidMonth : null,
      invalidFormat: this._invalidFormat || false,
      userInvalidated: this._userInvalidated || false,
      iso: this._iso || false,
      parsedDateParts: this._parsedDateParts || [],
      meridiem: this._meridiem || '',
      rfc2822: this._rfc2822 || false,
      weekdayMismatch: this._weekdayMismatch || false,
      isAmPm: this._bigHour !== undefined ? this._bigHour : false,
      isParseZone: this._isParseZone || false,
      bigHour: this._bigHour || false,
    };
    if (this._invalidEra !== undefined) result.invalidEra = this._invalidEra;
    if (this._tooBusyWith !== undefined) result.tooBusyWith = this._tooBusyWith;
    return result;
  }

  isDSTShifted(): boolean {
    return false;
  }

  hasAlignedHourOffset(other?: MomentInput): boolean {
    if (!this._isValid) return false;
    const otherOffset = other ? momentFromAnything(other).utcOffset() : 0;
    return ((this.utcOffset() as number) - (otherOffset as number)) % 60 === 0;
  }

  invalidAt(): number {
    let overflow = this._overflow;
    if (overflow === undefined || overflow < 0) return -1;
    return overflow;
  }

  isBefore(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) return false;
    if (unit) {
      return this._compareCalendarValues(other, unit) < 0;
    }
    return this.valueOf() > other.valueOf();
  }

  toObject(): Record<string, number> {
    return {
      years: this.year() as number,
      months: this.month() as number,
      date: this.date() as number,
      hours: this.hours() as number,
      minutes: this.minutes() as number,
      seconds: this.seconds() as number,
      milliseconds: this.milliseconds() as number,
    };
  }

  isAfter(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) return false;
    if (unit) {
      return this._compareCalendarValues(other, unit) > 0;
    }
    return this.valueOf() > other.valueOf();
  }

  private _updateOffset(keepTime?: boolean): void {
    if (typeof updateOffsetCallback === "function") {
      (updateOffsetCallback as any)(this, keepTime);
    }
  }

  toIsoString(): string {
    return this.toISOString();
  }
}

export let nowFn: (() => number) | undefined = Date.now;

export function checkOverflow(parsed: any): number {
  if (parsed.month !== undefined && (parsed.month < 0 || parsed.month > 11)) return 1;
  if (parsed.day !== undefined) {
    const maxDay = daysInMonth(
      parsed.year !== undefined ? parsed.year : 2000,
      parsed.month !== undefined ? parsed.month : 0,
    );
    if (parsed.day < 1 || parsed.day > maxDay) return 2;
  }
  if (parsed.hour !== undefined && (parsed.hour < 0 || parsed.hour > 24)) return 3;
  if (parsed.hour === 24 && (parsed.minute || parsed.second || parsed.millisecond)) return 3;
  if (parsed.minute !== undefined && (parsed.minute < 0 || parsed.minute > 59)) return 4;
  if (parsed.second !== undefined && (parsed.second < 0 || parsed.second > 59)) return 5;
  if (parsed.millisecond !== undefined && (parsed.millisecond < 0 || parsed.millisecond > 999))
    return 6;
  if (parsed.isoWeek !== undefined && parsed.isoWeekYear !== undefined) {
    const maxWeek = weeksInYear(parsed.isoWeekYear, 1, 4, true);
    if (parsed.isoWeek < 1 || parsed.isoWeek > maxWeek) return 7;
  }
  if (parsed._weekYear !== undefined && parsed._week !== undefined && parsed.month === undefined) {
    if (parsed._week < 1) return 7;
  }
  if (parsed._localeWeekday !== undefined) {
    if (parsed._localeWeekday < 0 || parsed._localeWeekday > 6) return 8;
  }
  if (parsed._weekdayNum !== undefined) {
    if (parsed.isoWeek !== undefined) {
      if (parsed._weekdayNum < 1 || parsed._weekdayNum > 7) return 8;
    } else if (parsed._localeWeekday === undefined) {
      if (parsed._weekdayNum < 0 || parsed._weekdayNum > 6) return 8;
    }
  }
  return -1;
}

function hasAnyValue(parsed: any): boolean {
  return (
    parsed.year !== undefined ||
    parsed.month !== undefined ||
    parsed.day !== undefined ||
    parsed.hour !== undefined ||
    parsed.minute !== undefined ||
    parsed.second !== undefined ||
    parsed.millisecond !== undefined
  );
}

function parseOffsetString(offset: string): number | null {
  const match = offset.match(/([+-])(\d{2}):?(\d{2})$/);
  if (!match) return NaN;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
}

export function momentFromAnything(input: any, isUTC?: boolean): Moment {
  if (input instanceof Moment) {
    const m = new Moment(input);
    if (isUTC) m.utc();
    return m;
  }
  if (isDate(input)) {
    const m = new Moment({ _d: new Date(input.getTime()), _dClone: false });
    if (isUTC) m.utc();
    return m;
  }
  if (input === undefined || input === null) {
    const m = new Moment({ _d: new Date(nowFn ? nowFn() : Date.now()), _dClone: false });
    if (isUTC) m.utc();
    return m;
  }
  if (typeof input === "string") {
    const parsed = parseString(input);
    if (parsed && hasAnyValue(parsed)) {
      const m = new Moment({ _d: createDateSafe(parsed.year || 0, parsed.month || 0, parsed.day || 1, parsed.hour || 0, parsed.minute || 0, parsed.second || 0, parsed.millisecond || 0, false), _i: input, _dClone: false });
      if (isUTC) m.utc();
      return m;
    }
    const m = new Moment({ _d: new Date(input), _i: input, _dClone: false });
    if (isUTC) m.utc();
    return m;
  }
  if (typeof input === "number") {
    const m = new Moment({ _d: new Date(input), _dClone: false });
    if (isUTC) m.utc();
    return m;
  }
  if (isArray(input)) {
    const parsed = parseArray(input);
    if (parsed) {
      const ts = Date.UTC(
        parsed.year || 0,
        parsed.month || 0,
        parsed.day || 1,
        parsed.hour || 0,
        parsed.minute || 0,
        parsed.second || 0,
        parsed.millisecond || 0,
      );
      return new Moment({ _d: new Date(ts), _i: input, _parsedDateParts: input, _dClone: false });
    }
    return new Moment({ _d: new Date(NaN), _dClone: false, _isValid: false });
  }
  if (typeof input === "object" && !isMoment(input)) {
    const m = new Moment(input);
    if (isUTC) m.utc();
    return m;
  }
  return new Moment({ _d: new Date(NaN), _dClone: false, _isValid: false });
}
