import { getLocale, Locale, getCurrentLocale, hasLocale } from "./locale";
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
import { Duration, isDuration } from "./duration_fixed";

export let momentProperties: string[] = [];

let updateOffsetCallback: ((m: Moment) => void) | undefined;

export function setUpdateOffsetCallback(cb: ((m: Moment) => void) | undefined): void {
  updateOffsetCallback = cb;
}

export function getUpdateOffsetCallback(): ((m: Moment) => void) | undefined {
  return updateOffsetCallback;
}

let relTimeRounding: Function | boolean = Math.round;
let relTimeThreshold: Record<string, any> = {
  ss: 44,
  s: 45,
  m: 45,
  h: 22,
  d: 26,
  w: null,
  M: 11,
};

export function getRelTimeRounding(): Function | boolean {
  return relTimeRounding;
}

export function setRelTimeRounding(fn?: Function | boolean): Function | boolean {
  if (fn === undefined) {
    return typeof relTimeRounding === "function" ? relTimeRounding : Math.round;
  }
  if (fn === false) {
    relTimeRounding = false;
    return false;
  }
  relTimeRounding = fn;
  return relTimeRounding;
}

export function getRelTimeThreshold(threshold: string): any {
  return relTimeThreshold[threshold];
}

export function setRelTimeThreshold(threshold: string, limit?: number): number | boolean {
  if (relTimeThreshold[threshold] === undefined) {
    return undefined as any;
  }
  if (limit === undefined) {
    return relTimeThreshold[threshold];
  }
  relTimeThreshold[threshold] = limit;
  if (threshold === "s") {
    relTimeThreshold.ss = limit - 1;
  }
  return relTimeThreshold[threshold];
}

export type MomentInput =
  | Moment
  | Date
  | string
  | number
  | number[]
  | { [key: string]: any }
  | undefined
  | null;

export interface MomentConfig {
  _d?: Date;
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

const nonLeapLadder = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const leapLadder = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function getDayOfYear(d: Date, utc: boolean): number {
  const month = utc ? d.getUTCMonth() : d.getMonth();
  const day = utc ? d.getUTCDate() : d.getDate();
  const year = utc ? d.getUTCFullYear() : d.getFullYear();
  return day + (isLeapYear(year) ? leapLadder : nonLeapLadder)[month];
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

export interface MomentCold {
  _i?: any;
  _f?: string | string[];
  _strict?: boolean;
  _overflow?: number;
  _parsedDateParts?: number[];
  _unusedTokens?: string[];
  _unusedInput?: string[];
  _charsLeftOver?: number;
  _empty?: boolean;
  _nullInput?: boolean;
  _invalidMonth?: string | null;
  _invalidFormat?: boolean;
  _weekdayMismatch?: boolean;
  _iso?: boolean;
  _rfc2822?: boolean;
  _invalidEra?: number;
  _bigHour?: boolean;
  _meridiem?: string;
  _isParseZone?: boolean;
  _userInvalidated?: boolean;
  _tooBusyWith?: string;
}

const enum DMethod { FullYear, Month, Date, Day, Hours, Minutes, Seconds, Milliseconds }

const coldFieldKeys: (keyof MomentCold)[] = [
  "_i", "_f", "_strict", "_overflow", "_parsedDateParts", "_unusedTokens",
  "_unusedInput", "_charsLeftOver", "_empty", "_nullInput", "_invalidMonth",
  "_invalidFormat", "_weekdayMismatch", "_iso", "_rfc2822", "_invalidEra",
  "_bigHour", "_meridiem", "_isParseZone", "_userInvalidated", "_tooBusyWith",
];

export class Moment {
  static calendarFormat: ((m: Moment, now: Moment) => string) | undefined;

  _d: Date;
  _isValid: boolean;
  _isUTC: boolean;
  _offset: number;
  _l: string | undefined;
  _isAMomentObject: boolean = true;
  _cold?: MomentCold;
  declare _i: any;
  declare _f: string | string[] | undefined;
  declare _strict: boolean;
  declare _overflow: number;
  declare _parsedDateParts: number[];
  declare _unusedTokens: string[];
  declare _unusedInput: string[];
  declare _charsLeftOver: number;
  declare _empty: boolean;
  declare _nullInput: boolean;
  declare _invalidMonth: string | null;
  declare _invalidFormat: boolean;
  declare _weekdayMismatch: boolean;
  declare _iso: boolean;
  declare _rfc2822: boolean;
  declare _invalidEra: number | undefined;
  declare _bigHour: boolean;
  declare _meridiem: string;
  declare _isParseZone: boolean;
  declare _userInvalidated: boolean;
  declare _tooBusyWith: string | undefined;

  private _locale: Locale | undefined;

  // Decomposed Date cache (Day.js style)
  $y = 0; $M = 0; $D = 0; $W = 0;
  $H = 0; $m = 0; $s = 0; $ms = 0;

  private _refreshFields(): void {
    const d = this._d;
    if (this._isUTC) {
      this.$y = d.getUTCFullYear();
      this.$M = d.getUTCMonth();
      this.$D = d.getUTCDate();
      const t = d.getTime();
      const day = Math.floor(t / 86400000);
      this.$W = ((day + 4) % 7 + 7) % 7;
      const totalSec = Math.floor(t / 1000);
      this.$H = ((Math.floor(totalSec / 3600) % 24) + 24) % 24;
      this.$m = ((Math.floor(totalSec / 60) % 60) + 60) % 60;
      this.$s = ((totalSec % 60) + 60) % 60;
      this.$ms = ((t % 1000) + 1000) % 1000;
    } else {
      this.$y = d.getFullYear();
      this.$M = d.getMonth();
      this.$D = d.getDate();
      this.$W = d.getDay();
      this.$H = d.getHours();
      this.$m = d.getMinutes();
      this.$s = d.getSeconds();
      this.$ms = d.getMilliseconds();
      this._offset = -d.getTimezoneOffset();
    }
  }

  private _truncate(unitMs: number): void {
    const d = this._d;
    if (this._isUTC) {
      d.setTime(Math.floor(d.getTime() / unitMs) * unitMs);
    } else {
      const tz = d.getTimezoneOffset() * 60000;
      d.setTime(Math.floor((d.getTime() - tz) / unitMs) * unitMs + tz);
    }
  }

  constructor(config: MomentConfig = {}) {
    const c = config as any;
    this._isAMomentObject = true;
    this._d = c._dClone === false && c._d ? c._d : (c._d ? new Date(c._d) : new Date(NaN));
    this._l = c._l || getCurrentLocale();
    this._isValid = c._isValid !== undefined ? c._isValid : !isNaN(this._d.getTime());
    this._isUTC = c._isUTC || false;
    this._offset = c._offset !== undefined ? c._offset : 0;
    let cold: any;
    for (let i = 0; i < coldFieldKeys.length; i++) {
      const key = coldFieldKeys[i];
      const val = c[key];
      if (val !== undefined) {
        if (!cold) cold = {};
        cold[key] = val;
      }
    }
    if (cold) this._cold = cold;
    this._refreshFields();
  }

  private _getLocale(): Locale {
    if (!this._locale) {
      this._locale = getLocale(this._l);
    }
    return this._locale;
  }

  private _gdt(method: DMethod): number {
    if (this._isUTC) {
      switch (method) {
        case DMethod.FullYear: return this._d.getUTCFullYear();
        case DMethod.Month: return this._d.getUTCMonth();
        case DMethod.Date: return this._d.getUTCDate();
        case DMethod.Day: return this._d.getUTCDay();
        case DMethod.Hours: return this._d.getUTCHours();
        case DMethod.Minutes: return this._d.getUTCMinutes();
        case DMethod.Seconds: return this._d.getUTCSeconds();
        case DMethod.Milliseconds: return this._d.getUTCMilliseconds();
      }
    } else {
      switch (method) {
        case DMethod.FullYear: return this._d.getFullYear();
        case DMethod.Month: return this._d.getMonth();
        case DMethod.Date: return this._d.getDate();
        case DMethod.Day: return this._d.getDay();
        case DMethod.Hours: return this._d.getHours();
        case DMethod.Minutes: return this._d.getMinutes();
        case DMethod.Seconds: return this._d.getSeconds();
        case DMethod.Milliseconds: return this._d.getMilliseconds();
      }
    }
    return NaN;
  }

  private _sdt(method: DMethod, value: number): void {
    const d = this._d;
    if (this._isUTC) {
      switch (method) {
        case DMethod.FullYear: d.setUTCFullYear(value); break;
        case DMethod.Month: d.setUTCMonth(value); break;
        case DMethod.Date: d.setUTCDate(value); break;
        case DMethod.Hours: d.setUTCHours(value); break;
        case DMethod.Minutes: d.setUTCMinutes(value); break;
        case DMethod.Seconds: d.setUTCSeconds(value); break;
        case DMethod.Milliseconds: d.setUTCMilliseconds(value); break;
      }
    } else {
      switch (method) {
        case DMethod.FullYear: d.setFullYear(value); break;
        case DMethod.Month: d.setMonth(value); break;
        case DMethod.Date: d.setDate(value); break;
        case DMethod.Hours: d.setHours(value); break;
        case DMethod.Minutes: d.setMinutes(value); break;
        case DMethod.Seconds: d.setSeconds(value); break;
        case DMethod.Milliseconds: d.setMilliseconds(value); break;
      }
    }
    this._refreshFields();
  }

  isValid(): boolean {
    if (!this._isValid) return false;
    const cold = this._cold;
    if (!cold) return true;
    if (cold._userInvalidated) return false;
    if (cold._overflow >= 0) return false;
    if (cold._invalidMonth) return false;
    if (cold._empty) return false;
    if (cold._nullInput) return false;
    if (cold._invalidFormat) return false;
    if (cold._weekdayMismatch) return false;
    if (cold._bigHour && this._strict) return false;
    return true;
  }

  clone(): Moment {
    const m = Object.create(Moment.prototype) as Moment;
    m._isAMomentObject = true;
    m._d = new Date(this._d.getTime());
    m._isValid = this._isValid;
    m._isUTC = this._isUTC;
    m._offset = this._offset;
    m._l = this._l;
    m.$y = this.$y; m.$M = this.$M; m.$D = this.$D; m.$W = this.$W;
    m.$H = this.$H; m.$m = this.$m; m.$s = this.$s; m.$ms = this.$ms;
    const srcCold = this._cold;
    if (srcCold) {
      const dstCold: any = {};
      for (const key of Object.keys(srcCold)) {
        dstCold[key] = (srcCold as any)[key];
      }
      m._cold = dstCold;
    }
    const mpLen = momentProperties.length;
    if (mpLen > 0) {
      for (let i = 0; i < mpLen; i++) {
        const val = (this as any)[momentProperties[i]];
        if (val !== undefined) (m as any)[momentProperties[i]] = val;
      }
    }
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
      const dt = this._d;
      const date = this.$D;
      if (this._isUTC) dt.setUTCFullYear(num);
      else dt.setFullYear(num);
      if ((this._isUTC ? dt.getUTCDate() : dt.getDate()) !== date) {
        if (this._isUTC) dt.setUTCDate(0);
        else dt.setDate(0);
      }
      this.$y = this._isUTC ? dt.getUTCFullYear() : dt.getFullYear();
      this.$M = this._isUTC ? dt.getUTCMonth() : dt.getMonth();
      this.$D = this._isUTC ? dt.getUTCDate() : dt.getDate();
      this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();
      // $H, $m, $s, $ms unchanged
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this.$y : NaN;
  }

  month(m?: any): number | Moment {
    if (m !== undefined) {
      if (m === null || m === undefined) return this;
      if (typeof m === "string" && !/^-?\d+$/.test(m)) {
        const lower = m.toLowerCase();
        const localeMonthsFull = this._getLocale().monthsArray();
        for (let mi = 0; mi < localeMonthsFull.length; mi++) {
          if (localeMonthsFull[mi].toLowerCase() === lower) { m = mi; break; }
        }
        if (typeof m === "string") {
          const localeMonths = this._getLocale().monthsShortArray();
          for (let mi = 0; mi < localeMonths.length; mi++) {
            if (localeMonths[mi].toLowerCase() === lower) { m = mi; break; }
          }
        }
        if (typeof m === "string") return this;
      }
      const num = Number(m);
      if (isNaN(num)) return this;
      const date = this.$D;
      if (this._isUTC) this._d.setUTCMonth(num);
      else this._d.setMonth(num);
      if ((this._isUTC ? this._d.getUTCDate() : this._d.getDate()) !== date) {
        if (this._isUTC) this._d.setUTCDate(0);
        else this._d.setDate(0);
      }
      this.$y = this._isUTC ? this._d.getUTCFullYear() : this._d.getFullYear();
      this.$M = this._isUTC ? this._d.getUTCMonth() : this._d.getMonth();
      this.$D = this._isUTC ? this._d.getUTCDate() : this._d.getDate();
      this.$W = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this.$M : NaN;
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
      if (this._isUTC) this._d.setUTCDate(num);
      else this._d.setDate(num);
      this.$D = this._isUTC ? this._d.getUTCDate() : this._d.getDate();
      this.$M = this._isUTC ? this._d.getUTCMonth() : this._d.getMonth();
      this.$W = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this.$D : NaN;
  }

  day(d?: any): number | Moment {
    if (d !== undefined) {
      if (d === null || d === undefined) return this;
      let dayNum = Number(d);
      if (typeof d === "string") {
        const lower = d.toLowerCase();
        let found = false;
        const localeDaysFull = this._getLocale().weekdaysArray();
        for (let di = 0; di < localeDaysFull.length; di++) {
          if (localeDaysFull[di].toLowerCase() === lower) { dayNum = di % 7; found = true; break; }
        }
        if (!found) {
          const localeDays = this._getLocale().weekdaysShortArray();
          for (let di = 0; di < localeDays.length; di++) {
            if (localeDays[di].toLowerCase() === lower) { dayNum = di % 7; found = true; break; }
          }
        }
        if (!found) {
          const localeDaysMin = this._getLocale().weekdaysMinArray();
          for (let di = 0; di < localeDaysMin.length; di++) {
            if (localeDaysMin[di].toLowerCase() === lower) { dayNum = di % 7; found = true; break; }
          }
        }
        if (!found) return this;
      }
      if (isNaN(dayNum)) return this;
      const currentDay = this.$W;
      const diff = dayNum - currentDay;
      const dt = this._d;
      if (this._isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff);
      } else {
        dt.setDate(dt.getDate() + diff);
      }
      this.$D = this._isUTC ? dt.getUTCDate() : dt.getDate();
      this.$M = this._isUTC ? dt.getUTCMonth() : dt.getMonth();
      this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this.$W : NaN;
  }

  weekday(d?: number): number | Moment {
    if (d !== undefined) {
      const current = this.$W;
      const weekConfig = (this._getLocale()._config as any).week || { dow: 0 };
      const dow = weekConfig.dow;
      const weekday = (current - dow + 7) % 7;
      const diff = (d as number) - weekday;
      const dt = this._d;
      if (this._isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff);
      } else {
        dt.setDate(dt.getDate() + diff);
      }
      this.$D = this._isUTC ? dt.getUTCDate() : dt.getDate();
      this.$M = this._isUTC ? dt.getUTCMonth() : dt.getMonth();
      this.$y = this._isUTC ? dt.getUTCFullYear() : dt.getFullYear();
      this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();
      this._updateOffset(true);
      return this;
    }
    const day = this.$W;
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
      const current = this.$W;
      const currentIso = current === 0 ? 7 : current;
      const diff = target - currentIso;
      const dt = this._d;
      if (this._isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff);
      } else {
        dt.setDate(dt.getDate() + diff);
      }
      this.$D = this._isUTC ? dt.getUTCDate() : dt.getDate();
      this.$M = this._isUTC ? dt.getUTCMonth() : dt.getMonth();
      this.$y = this._isUTC ? dt.getUTCFullYear() : dt.getFullYear();
      this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();
      this._updateOffset(true);
      return this;
    }
    return this.$W === 0 ? 7 : this.$W;
  }

  dayOfYear(d?: number): number | Moment {
    if (d !== undefined) {
      const year = this.$y;
      const day = Number(d);
      if (this._isUTC) {
        this._d.setUTCFullYear(year, 0, day);
      } else {
        this._d.setFullYear(year, 0, day);
      }
      this.$D = this._isUTC ? this._d.getUTCDate() : this._d.getDate();
      this.$M = this._isUTC ? this._d.getUTCMonth() : this._d.getMonth();
      this.$W = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
      this._updateOffset(true);
      return this;
    }
    return this.$D + (isLeapYear(this.$y) ? leapLadder : nonLeapLadder)[this.$M];
  }

  hour(h?: any): number | Moment {
    if (h !== undefined) {
      if (h === null) return this;
      const num = Number(h);
      if (isNaN(num)) return this;
      if (this._isUTC) this._d.setUTCHours(num);
      else this._d.setHours(num);
      this.$H = this._isUTC ? this._d.getUTCHours() : this._d.getHours();
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this.$H : NaN;
  }

  minute(m?: any): number | Moment {
    if (m !== undefined) {
      if (m === null) return this;
      const num = Number(m);
      if (isNaN(num)) return this;
      if (this._isUTC) this._d.setUTCMinutes(num);
      else this._d.setMinutes(num);
      this.$m = this._isUTC ? this._d.getUTCMinutes() : this._d.getMinutes();
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this.$m : NaN;
  }

  second(s?: any): number | Moment {
    if (s !== undefined) {
      if (s === null) return this;
      const num = Number(s);
      if (isNaN(num)) return this;
      if (this._isUTC) this._d.setUTCSeconds(num);
      else this._d.setSeconds(num);
      this.$s = this._isUTC ? this._d.getUTCSeconds() : this._d.getSeconds();
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this.$s : NaN;
  }

  millisecond(ms?: any): number | Moment {
    if (ms !== undefined) {
      if (ms === null) return this;
      const num = Number(ms);
      if (isNaN(num)) return this;
      if (this._isUTC) this._d.setUTCMilliseconds(num);
      else this._d.setMilliseconds(num);
      this.$ms = this._isUTC ? this._d.getUTCMilliseconds() : this._d.getMilliseconds();
      this._updateOffset(true);
      return this;
    }
    return this._isValid ? this.$ms : NaN;
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

      const d = this._d;

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
        const curYear = this.$y;
        const curMonth = this.$M;
        const curDate = this.$D;
        const curHour = this.$H;
        const curMinute = this.$m;
        const curSecond = this.$s;
        const curMs = this.$ms;

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
          this.$y = tmp.getUTCFullYear();
          this.$M = tmp.getUTCMonth();
          this.$D = tmp.getUTCDate();
          this.$W = tmp.getUTCDay();
          this.$H = tmp.getUTCHours();
          this.$m = tmp.getUTCMinutes();
          this.$s = tmp.getUTCSeconds();
          this.$ms = tmp.getUTCMilliseconds();
        } else {
          const tmp = new Date(newYear, newMonth, 1, newHour, newMinute, newSecond, newMs);
          const maxDays = new Date(newYear, newMonth + 1, 0).getDate();
          tmp.setDate(Math.min(newDate, maxDays));
          this._d = tmp;
          this.$y = tmp.getFullYear();
          this.$M = tmp.getMonth();
          this.$D = tmp.getDate();
          this.$W = tmp.getDay();
          this.$H = tmp.getHours();
          this.$m = tmp.getMinutes();
          this.$s = tmp.getSeconds();
          this.$ms = tmp.getMilliseconds();
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

  private _addSimple(amount: number, unit: string): void {
    const d = this._d;
    let changedDays = false;

    switch (unit) {
      case "year":
      case "quarter": {
        changedDays = true;
        const months = absRound(unit === "year" ? amount * 12 : amount * 3);
        const curMonth = this.$M;
        const day = this.$D;
        if (this._isUTC) d.setUTCMonth(curMonth + months);
        else d.setMonth(curMonth + months);
        if ((this._isUTC ? d.getUTCDate() : d.getDate()) !== day) {
          if (this._isUTC) d.setUTCDate(0);
          else d.setDate(0);
        }
        this.$y = this._isUTC ? d.getUTCFullYear() : d.getFullYear();
        this.$M = this._isUTC ? d.getUTCMonth() : d.getMonth();
        this.$D = this._isUTC ? d.getUTCDate() : d.getDate();
        this.$W = this._isUTC ? d.getUTCDay() : d.getDay();
        break;
      }
      case "month": {
        changedDays = true;
        const rounded = absRound(amount);
        const curMonth = this.$M;
        const day = this.$D;
        if (this._isUTC) d.setUTCMonth(curMonth + rounded);
        else d.setMonth(curMonth + rounded);
        if ((this._isUTC ? d.getUTCDate() : d.getDate()) !== day) {
          if (this._isUTC) d.setUTCDate(0);
          else d.setDate(0);
        }
        this.$y = this._isUTC ? d.getUTCFullYear() : d.getFullYear();
        this.$M = this._isUTC ? d.getUTCMonth() : d.getMonth();
        this.$D = this._isUTC ? d.getUTCDate() : d.getDate();
        this.$W = this._isUTC ? d.getUTCDay() : d.getDay();
        break;
      }
      case "isoWeek":
      case "week":
        changedDays = true;
        if (this._isUTC) {
          d.setTime(d.getTime() + absRound(amount * 7) * 86400000);
        } else {
          const tz1 = d.getTimezoneOffset();
          d.setTime(d.getTime() + absRound(amount * 7) * 86400000);
          const tz2 = d.getTimezoneOffset();
          if (tz1 !== tz2) d.setTime(d.getTime() + (tz2 - tz1) * 60000);
        }
        this._refreshFields();
        break;
      case "day":
      case "date":
        changedDays = true;
        if (this._isUTC) {
          d.setTime(d.getTime() + absRound(amount) * 86400000);
        } else {
          const tz1 = d.getTimezoneOffset();
          d.setTime(d.getTime() + absRound(amount) * 86400000);
          const tz2 = d.getTimezoneOffset();
          if (tz1 !== tz2) d.setTime(d.getTime() + (tz2 - tz1) * 60000);
        }
        this._refreshFields();
        break;
      case "hour":
        d.setTime(d.getTime() + Math.round(amount * 3600000));
        this._refreshFields();
        break;
      case "minute":
        d.setTime(d.getTime() + Math.round(amount * 60000));
        this._refreshFields();
        break;
      case "second":
        d.setTime(d.getTime() + Math.round(amount * 1000));
        this._refreshFields();
        break;
      case "millisecond":
        d.setTime(d.getTime() + Math.round(amount));
        this._refreshFields();
        break;
      default:
        return;
    }
    this._updateOffset(changedDays);
    if (isNaN(d.getTime())) this._isValid = false;
  }

  private _parseDurationInput(
    amount: number | string | Duration | object,
    unit?: string,
  ): { ms: number; days: number; months: number } | null {
    if (isDuration(amount)) {
      const d = amount as Duration;
      return { ms: d._milliseconds, days: absRound(d._days), months: absRound(d._months) };
    }
    if (typeof amount === "number") {
      if (unit) {
        return parseDurationNumUnit(amount, unit);
      }
      return { ms: amount, days: 0, months: 0 };
    }
    if (isObject(amount)) {
      const obj = amount as Record<string, any>;
      let ms = 0, days = 0, months = 0;
      for (const key in obj) {
        if (!hasOwnProp(obj, key)) continue;
        const a = normalizeUnits(key);
        if (!a) continue;
        const v = Number(obj[key]) || 0;
        switch (a) {
          case "year": months += v * 12; break;
          case "month": months += v; break;
          case "quarter": months += v * 3; break;
          case "week": days += v * 7; break;
          case "date":
          case "day": days += v; break;
          case "hour": ms += Math.round(v * 3600000); break;
          case "minute": ms += Math.round(v * 60000); break;
          case "second": ms += Math.round(v * 1000); break;
          case "millisecond": ms += Math.round(v); break;
        }
      }
      return { ms, days, months };
    }
    if (typeof amount === "string") {
      if (unit !== undefined) {
        const normUnit = normalizeUnits(amount);
        if (normUnit) {
          return parseDurationNumUnit(typeof unit === "string" ? Number(unit) : unit, normUnit);
        }
        if (normalizeUnits(unit)) {
          return parseDurationNumUnit(Number(amount) || 0, unit);
        }
        const dur = new Duration(amount);
        return { ms: dur._milliseconds, days: absRound(dur._days), months: absRound(dur._months) };
      }
      const dur = new Duration(amount);
      return { ms: dur._milliseconds, days: absRound(dur._days), months: absRound(dur._months) };
    }
    return null;
  }

  private _applyDuration(ms: number, days: number, months: number, sign: 1 | -1): void {
    const d = this._d;
    if (months) {
      const curMonth = this.$M;
      const day = this.$D;
      if (this._isUTC) {
        d.setUTCMonth(curMonth + sign * months);
      } else {
        d.setMonth(curMonth + sign * months);
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
        d.setUTCDate(d.getUTCDate() + sign * days);
      } else {
        d.setDate(d.getDate() + sign * days);
      }
    }
    if (ms) {
      d.setTime(d.getTime() + sign * ms);
    }
    this._refreshFields();
    this._updateOffset(!(!months && !days));
    if (isNaN(d.getTime())) this._isValid = false;
  }

  add(amount: number | string | Duration | object, unit?: string): Moment {
    if (!this._isValid) return this;
    if (typeof amount === "number" && typeof unit === "string") {
      const u = normalizeUnits(unit);
      if (u) this._addSimple(amount, u);
      return this;
    }
    const parsed = this._parseDurationInput(amount, unit);
    if (!parsed) return this;
    this._applyDuration(parsed.ms, parsed.days, parsed.months, 1);
    return this;
  }

  subtract(amount: number | string | Duration | object, unit?: string): Moment {
    if (!this._isValid) return this;
    if (typeof amount === "number" && typeof unit === "string") {
      const u = normalizeUnits(unit);
      if (u) this._addSimple(-amount, u);
      return this;
    }
    const parsed = this._parseDurationInput(amount, unit);
    if (!parsed) return this;
    this._applyDuration(parsed.ms, parsed.days, parsed.months, -1);
    return this;
  }

  startOf(unit: string): Moment {
    const u = normalizeUnits(unit);
    if (!u) return this;
    const d = this._d;

    if (this._isUTC) {
      switch (u) {
        case "year":
          d.setUTCMonth(0);
          d.setUTCDate(1);
          this._truncate(86400000);
          this.$M = 0; this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getUTCDay();
          break;
        case "quarter":
          d.setUTCMonth(Math.floor(this.$M / 3) * 3);
          d.setUTCDate(1);
          d.setUTCHours(0, 0, 0, 0);
          this.$M = Math.floor(this.$M / 3) * 3; this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getUTCDay();
          break;
        case "month":
          d.setUTCDate(1);
          d.setUTCHours(0, 0, 0, 0);
          this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getUTCDay();
          break;
        case "week": {
          const _locWeek = this._getLocale();
          const _weekCfg = (_locWeek._config as any).week || { dow: 0 };
          const dow = _weekCfg.dow;
          const day = d.getUTCDay();
          const diff = (day - dow + 7) % 7;
          d.setUTCDate(d.getUTCDate() - diff);
          d.setUTCHours(0, 0, 0, 0);
          this.$D = d.getUTCDate(); this.$M = d.getUTCMonth(); this.$y = d.getUTCFullYear();
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = dow;
          break;
        }
        case "isoWeek": {
          const day = d.getUTCDay();
          const diff = day === 0 ? -6 : 1 - day;
          d.setUTCDate(d.getUTCDate() + diff);
          d.setUTCHours(0, 0, 0, 0);
          this.$D = d.getUTCDate(); this.$M = d.getUTCMonth(); this.$y = d.getUTCFullYear();
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = 1;
          break;
        }
        case "date":
        case "day":
          d.setUTCHours(0, 0, 0, 0);
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          break;
        case "hour":
          this._truncate(3600000);
          this.$m = 0; this.$s = 0; this.$ms = 0;
          break;
        case "minute":
          this._truncate(60000);
          this.$s = 0; this.$ms = 0;
          break;
        case "second":
          this._truncate(1000);
          this.$ms = 0;
          break;
      }
    } else {
      switch (u) {
        case "year":
          d.setDate(1);
          d.setMonth(0);
          this._truncate(86400000);
          this.$M = 0; this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getDay();
          break;
        case "quarter":
          d.setDate(1);
          d.setMonth(Math.floor(this.$M / 3) * 3);
          d.setHours(0, 0, 0, 0);
          this.$M = Math.floor(this.$M / 3) * 3; this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getDay();
          break;
        case "month":
          d.setDate(1);
          d.setHours(0, 0, 0, 0);
          this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getDay();
          break;
        case "week": {
          const _locWeek = this._getLocale();
          const _weekCfg = (_locWeek._config as any).week || { dow: 0 };
          const dow = _weekCfg.dow;
          const day = d.getDay();
          const diff = (day - dow + 7) % 7;
          d.setDate(d.getDate() - diff);
          d.setHours(0, 0, 0, 0);
          this.$D = d.getDate(); this.$M = d.getMonth(); this.$y = d.getFullYear();
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = dow;
          break;
        }
        case "isoWeek": {
          const day = d.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          d.setDate(d.getDate() + diff);
          d.setHours(0, 0, 0, 0);
          this.$D = d.getDate(); this.$M = d.getMonth(); this.$y = d.getFullYear();
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = 1;
          break;
        }
        case "date":
        case "day":
          d.setHours(0, 0, 0, 0);
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          break;
        case "hour":
          this._truncate(3600000);
          this.$m = 0; this.$s = 0; this.$ms = 0;
          break;
        case "minute":
          this._truncate(60000);
          this.$s = 0; this.$ms = 0;
          break;
        case "second":
          this._truncate(1000);
          this.$ms = 0;
          break;
      }
    }

    if (!this._isUTC) this._offset = -this._d.getTimezoneOffset();
    this._updateOffset(true);
    return this;
  }

  endOf(unit: string): Moment {
    const u = normalizeUnits(unit);
    if (!u) return this;
    this.startOf(u);
    const d = this._d;

    if (this._isUTC) {
      switch (u) {
        case "year":
          d.setUTCFullYear(d.getUTCFullYear() + 1);
          d.setUTCMilliseconds(-1);
          this.$y = d.getUTCFullYear();
          this.$M = d.getUTCMonth(); this.$D = d.getUTCDate();
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          this.$W = d.getUTCDay();
          break;
        case "quarter":
          d.setUTCMonth(d.getUTCMonth() + 3);
          d.setUTCMilliseconds(-1);
          this.$M = d.getUTCMonth(); this.$D = d.getUTCDate();
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          this.$W = d.getUTCDay();
          break;
        case "month":
          d.setUTCMonth(d.getUTCMonth() + 1);
          d.setUTCMilliseconds(-1);
          this.$M = d.getUTCMonth(); this.$D = d.getUTCDate();
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          this.$W = d.getUTCDay();
          break;
        case "week":
          d.setUTCDate(d.getUTCDate() + 6);
          d.setUTCHours(23, 59, 59, 999);
          this.$D = d.getUTCDate(); this.$M = d.getUTCMonth(); this.$y = d.getUTCFullYear();
          this.$H = 23; this.$m = 59; this.$s = 59; this.$ms = 999;
          this.$W = d.getUTCDay();
          break;
        case "isoWeek":
          d.setUTCDate(d.getUTCDate() + 6);
          d.setUTCHours(23, 59, 59, 999);
          this.$D = d.getUTCDate(); this.$M = d.getUTCMonth(); this.$y = d.getUTCFullYear();
          this.$H = 23; this.$m = 59; this.$s = 59; this.$ms = 999;
          this.$W = d.getUTCDay();
          break;
        case "date":
        case "day":
          d.setUTCDate(d.getUTCDate() + 1);
          d.setUTCMilliseconds(-1);
          this.$D = d.getUTCDate();
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          this.$W = d.getUTCDay();
          break;
        case "hour":
          d.setUTCHours(d.getUTCHours() + 1);
          d.setUTCMilliseconds(-1);
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          break;
        case "minute":
          d.setUTCMinutes(d.getUTCMinutes() + 1);
          d.setUTCMilliseconds(-1);
          this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          break;
        case "second":
          d.setUTCSeconds(d.getUTCSeconds() + 1);
          d.setUTCMilliseconds(-1);
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          break;
      }
    } else {
      switch (u) {
        case "year":
          d.setFullYear(d.getFullYear() + 1);
          d.setMilliseconds(-1);
          this.$y = d.getFullYear();
          this.$M = d.getMonth(); this.$D = d.getDate();
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          this.$W = d.getDay();
          break;
        case "quarter":
          d.setMonth(d.getMonth() + 3);
          d.setMilliseconds(-1);
          this.$M = d.getMonth(); this.$D = d.getDate();
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          this.$W = d.getDay();
          break;
        case "month":
          d.setMonth(d.getMonth() + 1);
          d.setMilliseconds(-1);
          this.$M = d.getMonth(); this.$D = d.getDate();
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          this.$W = d.getDay();
          break;
        case "week":
        case "isoWeek":
          d.setDate(d.getDate() + 6);
          d.setHours(23, 59, 59, 999);
          this.$D = d.getDate(); this.$M = d.getMonth(); this.$y = d.getFullYear();
          this.$H = 23; this.$m = 59; this.$s = 59; this.$ms = 999;
          this.$W = d.getDay();
          break;
        case "date":
        case "day":
          d.setDate(d.getDate() + 1);
          d.setMilliseconds(-1);
          this.$D = d.getDate();
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          this.$W = d.getDay();
          break;
        case "hour":
          d.setHours(d.getHours() + 1);
          d.setMilliseconds(-1);
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          break;
        case "minute":
          d.setMinutes(d.getMinutes() + 1);
          d.setMilliseconds(-1);
          this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          break;
        case "second":
          d.setSeconds(d.getSeconds() + 1);
          d.setMilliseconds(-1);
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          break;
      }
    }

    if (!this._isUTC) this._offset = -this._d.getTimezoneOffset();
    this._updateOffset(true);
    return this;
  }

  local(keepLocalTime?: boolean): Moment {
    if (this._isUTC) {
      if (keepLocalTime) {
        const d = this._d;
        this._d = new Date(
          this.$y,
          this.$M,
          this.$D,
          this.$H,
          this.$m,
          this.$s,
          this.$ms,
        );
      } else {
        this._d = new Date(this.valueOf());
      }
    }
    this._isUTC = false;
    this.$y = this._d.getFullYear();
    this.$M = this._d.getMonth();
    this.$D = this._d.getDate();
    this.$W = this._d.getDay();
    this.$H = this._d.getHours();
    this.$m = this._d.getMinutes();
    this.$s = this._d.getSeconds();
    this.$ms = this._d.getMilliseconds();
    this._offset = -this._d.getTimezoneOffset();
    return this;
  }

  utc(keepLocalTime?: boolean): Moment {
    if (this._isUTC && this._offset !== 0) {
      if (!keepLocalTime) {
        this._d = new Date(this.valueOf());
      }
    } else if (!this._isUTC) {
      if (keepLocalTime) {
        this._d = new Date(
          Date.UTC(this.$y, this.$M, this.$D, this.$H, this.$m, this.$s, this.$ms),
        );
      } else {
        this._d = new Date(this.valueOf());
      }
    }
    this._isUTC = true;
    this._offset = 0;
    this.$y = this._d.getUTCFullYear();
    this.$M = this._d.getUTCMonth();
    this.$D = this._d.getUTCDate();
    this.$W = this._d.getUTCDay();
    this.$H = this._d.getUTCHours();
    this.$m = this._d.getUTCMinutes();
    this.$s = this._d.getUTCSeconds();
    this.$ms = this._d.getUTCMilliseconds();
    return this;
  }

  utcOffset(offset?: number | string, keepLocalTime?: boolean): number | Moment {
    if (offset === undefined) {
      return this._offset;
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
        this._d = new Date(
          Date.UTC(this.$y, this.$M, this.$D, this.$H, this.$m, this.$s, this.$ms),
        );
      }
      this._offset = numOffset;
      this._isUTC = true;
    } else {
      const oldAbsTime = this.valueOf();
      this._d = new Date(oldAbsTime + numOffset * 60000);
      this._offset = numOffset;
      this._isUTC = true;
    }
    this.$y = this._d.getUTCFullYear();
    this.$M = this._d.getUTCMonth();
    this.$D = this._d.getUTCDate();
    this.$W = this._d.getUTCDay();
    this.$H = this._d.getUTCHours();
    this.$m = this._d.getUTCMinutes();
    this.$s = this._d.getUTCSeconds();
    this.$ms = this._d.getUTCMilliseconds();
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
      formatString = formatString.call(this, reference);
    }

    if (typeof formatString === "string") {
      return formatMoment(this as any, formatString);
    }

    return formatMoment(this as any, "L");
  }

  diff(input: MomentInput, unit?: string, float?: boolean): number {
    const other = momentFromAnything(input);
    const diff = this.valueOf() - other.valueOf();

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
        const aDay = this.$D;
        const bDay = other.$D;
        const swap = aDay < bDay;
        const a = swap ? other : this;
        const b = swap ? this : other;

        const aYear = a.$y;
        const aMonth = a.$M;
        const bYear = b.$y;
        const bMonth = b.$M;

        const wholeMonthDiff = (bYear - aYear) * 12 + (bMonth - aMonth);

        const addMonths = (base: Date, n: number): number => {
          const d = new Date(base.getTime());
          const origDate = d.getDate();
          d.setMonth(d.getMonth() + n);
          if (d.getDate() !== origDate) d.setDate(0);
          return d.getTime();
        };

        const anchorVal = addMonths(a._d, wholeMonthDiff);
        const bVal = b.valueOf();
        const sub = bVal - anchorVal;

        let adjust: number;
        if (sub < 0) {
          adjust = sub / (anchorVal - addMonths(a._d, wholeMonthDiff - 1));
        } else {
          adjust = sub / (addMonths(a._d, wholeMonthDiff + 1) - anchorVal);
        }

        let resultMonths = -(wholeMonthDiff + adjust);
        if (swap) resultMonths = -resultMonths;

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
        sign + zeroFill(Math.floor(absOffset / 60), 2) + ":" + zeroFill(absOffset % 60, 2);
      let yearStr: string;
      if (year >= 0) {
        yearStr = year >= 10000 ? "+" + zeroFill(year, 6) : zeroFill(year, 4);
      } else {
        yearStr = "-" + zeroFill(-year, 6);
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
        yearStr = "+" + zeroFill(year, 6);
      } else {
        yearStr = zeroFill(year, 4);
      }
    } else {
      yearStr = "-" + zeroFill(-year, 6);
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
      return Math.floor(this.valueOf() / 1000) - Math.floor(other.valueOf() / 1000);
    if (u === "minute")
      return Math.floor(this.valueOf() / 60000) - Math.floor(other.valueOf() / 60000);
    if (u === "hour")
      return Math.floor(this.valueOf() / 3600000) - Math.floor(other.valueOf() / 3600000);
    switch (u) {
      case "year": {
        const d = (this.year() as number) - (other.year() as number);
        return d;
      }
      case "month": {
        const d = (this.year() as number) - (other.year() as number);
        if (d !== 0) return d;
        return (this.month() as number) - (other.month() as number);
      }
      case "quarter": {
        const d = (this.year() as number) - (other.year() as number);
        if (d !== 0) return d;
        return (this.quarter() as number) - (other.quarter() as number);
      }
      case "week":
      case "isoWeek": {
        const isIso = u === "isoWeek";
        const d = (isIso ? this.isoWeekYear() : this.weekYear()) - (isIso ? other.isoWeekYear() : other.weekYear());
        if (d !== 0) return d;
        return (isIso ? this.isoWeek() : this.week()) - (isIso ? other.isoWeek() : other.week());
      }
      case "day":
      case "date":
      default: {
        const d = (this.year() as number) - (other.year() as number);
        if (d !== 0) return d;
        const d2 = (this.month() as number) - (other.month() as number);
        if (d2 !== 0) return d2;
        return (this.date() as number) - (other.date() as number);
      }
    }
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
    const endOpen = fromStr[fromStr.length - 1] === ")";

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
      const d = this._d;
      if (this._isUTC) {
        d.setUTCDate(d.getUTCDate() + diff * 7);
      } else {
        d.setDate(d.getDate() + diff * 7);
      }
      this._refreshFields();
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
      this._refreshFields();
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
      const d = this._d;
      if (this._isUTC) {
        d.setUTCDate(d.getUTCDate() + diff * 7);
      } else {
        d.setDate(d.getDate() + diff * 7);
      }
      this._refreshFields();
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
      this._refreshFields();
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
          m._offset = p.offset;
          m._isUTC = true;
          m._refreshFields();
        } else {
          const allInput = (this._i as string) + " " + ((this as any)._unusedInput || []).join("");
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
        m._offset = parsed.offset;
        m._isUTC = true;
        m._refreshFields();
      } else if (isString(input)) {
        const allInput =
          (input as string) +
          " " +
          (parsed && parsed._unusedInput ? parsed._unusedInput.join("") : "");
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
      return "GMT" + sign + String(hours).padStart(2, "0") + String(minutes).padStart(2, "0");
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
    const parts = locale.toLowerCase().replace(/_/g, "-").split("-");
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
    return this.valueOf() < other.valueOf();
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

for (const key of coldFieldKeys) {
  Object.defineProperty(Moment.prototype, key, {
    get() {
      const cold = (this as Moment)._cold;
      return cold ? (cold as any)[key] : undefined;
    },
    set(v: any) {
      const m = this as Moment;
      if (v !== undefined) {
        if (!m._cold) m._cold = {};
        (m._cold as any)[key] = v;
      }
    },
    enumerable: true,
    configurable: true,
  });
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
    if (isUTC && !input._isUTC) {
      const m = new Moment(input);
      m.utc();
      return m;
    }
    return input;
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

function parseDurationNumUnit(amount: number, unit: string): { ms: number; days: number; months: number } {
  const u = normalizeUnits(unit);
  if (!u) return { ms: 0, days: 0, months: 0 };
  switch (u) {
    case "year": return { ms: 0, days: 0, months: amount * 12 };
    case "month": return { ms: 0, days: 0, months: amount };
    case "quarter": return { ms: 0, days: 0, months: amount * 3 };
    case "week": return { ms: 0, days: amount * 7, months: 0 };
    case "date":
    case "day": return { ms: 0, days: amount, months: 0 };
    case "hour": return { ms: Math.round(amount * 3600000), days: 0, months: 0 };
    case "minute": return { ms: Math.round(amount * 60000), days: 0, months: 0 };
    case "second": return { ms: Math.round(amount * 1000), days: 0, months: 0 };
    case "millisecond": return { ms: Math.round(amount), days: 0, months: 0 };
    default: return { ms: 0, days: 0, months: 0 };
  }
}
