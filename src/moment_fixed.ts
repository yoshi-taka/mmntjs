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
import {
  DATE,
  DAY,
  HOUR,
  ISO_WEEK,
  MILLISECOND,
  MINUTE,
  MONTH,
  QUARTER,
  SECOND,
  WEEK,
  YEAR,
  normalizeUnitCode,
  normalizeUnits,
  daysInMonth,
  isLeapYear,
} from "./units";
import { parseString, parseArray, parseObject } from "./parse";
import { formatMoment } from "./format";
import { Duration, isDuration } from "./duration_fixed";

export let momentProperties: string[] = [];

let updateOffsetCallback: ((m: Moment) => void) | undefined;

export { getRelTimeRounding, setRelTimeRounding, getRelTimeThreshold, setRelTimeThreshold } from "./reltime";

export function setUpdateOffsetCallback(cb: ((m: Moment) => void) | undefined): void {
  updateOffsetCallback = cb;
}

export function getUpdateOffsetCallback(): ((m: Moment) => void) | undefined {
  return updateOffsetCallback;
}

export type MomentInput =
  | Moment
  | Date
  | string
  | number
  | number[]
  | Record<string, unknown>
  | undefined
  | null;

export interface MomentConfig {
  _d?: Date;
  _dClone?: boolean;
  _i?: unknown;
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
  _parsedDateParts?: number[];
  _meridiem?: string;
  _rfc2822?: boolean;
  _invalidFormat?: boolean;
  _bigHour?: boolean;
  _isParseZone?: boolean;
  _userInvalidated?: boolean;
}

const calendarKeys = ["sameDay", "nextDay", "nextWeek", "lastDay", "lastWeek", "sameElse"];

function isCalendarFormatObject(obj: Record<string, unknown>): boolean {
  for (const key of calendarKeys) {
    if (hasOwnProp(obj, key)) {return true;}
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
    if (week > yearWeeks) {return 1;}
  }
  return week;
}

function getISOWeekYear(d: Date, utc: boolean): number {
  const getYear = utc ? (x: Date) => x.getUTCFullYear() : (x: Date) => x.getFullYear();
  const year = getYear(d);
  const weekOffset = firstWeekOffset(year, 1, 4, utc);
  const dayOfYear = getDayOfYear(d, utc);
  const week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {return year - 1;}
  if (week > weeksInYear(year, 1, 4, utc)) {return year + 1;}
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
  _i?: unknown;
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
  "_overflow", "_parsedDateParts", "_unusedTokens",
  "_unusedInput", "_charsLeftOver", "_empty", "_nullInput", "_invalidMonth",
  "_invalidFormat", "_weekdayMismatch", "_iso", "_rfc2822", "_invalidEra",
  "_bigHour", "_meridiem", "_isParseZone", "_userInvalidated", "_tooBusyWith",
];

function _dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  y -= m < 3 ? 1 : 0;
  return ((y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m] + d) | 0) % 7;
}

export class Moment {
  static calendarFormat: ((m: Moment, now: Moment) => string) | undefined;

  _d?: Date;
  _t: number;
  _isValid: boolean;
  _isUTC: boolean;
  _offset: number;
  _l: string | undefined;
  _isAMomentObject= true;
  _cold?: MomentCold;
  _i: unknown;
  _f: string | string[] | undefined;
  _strict: boolean;
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
  _dirty: boolean;

  // Decomposed Date cache (Day.js style)
  $y = 0; $M = 0; $D = 0; $W = 0;
  $H = 0; $m = 0; $s = 0; $ms = 0;

  private static _epochDaysToYMD(z: number): [number, number, number] {
    z += 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const y = yoe + era * 400;
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    const year = y + (m <= 2 ? 1 : 0);
    return [year, m - 1, d];
  }

  private _ensureFields(): void {
    if (this._dirty) {
      this._dirty = false;
      this._refreshFields();
    }
  }

  private _getD(): Date {
    this._ensureFields();
    if (this._d) {return this._d;}
    this._d = new Date(this._t);
    return this._d;
  }

  private _refreshFields(): void {
    if (this._isUTC) {
      if (this._d) {
        this.$y = this._d.getUTCFullYear();
        this.$M = this._d.getUTCMonth();
        this.$D = this._d.getUTCDate();
        this.$W = this._d.getUTCDay();
        this.$H = this._d.getUTCHours();
        this.$m = this._d.getUTCMinutes();
        this.$s = this._d.getUTCSeconds();
        this.$ms = this._d.getUTCMilliseconds();
      } else {
        const t = this._t;
        const totalDays = Math.floor(t / 86400000);
        this.$W = ((totalDays + 4) % 7 + 7) % 7;
        const totalSec = Math.floor(t / 1000);
        this.$H = ((Math.floor(totalSec / 3600) % 24) + 24) % 24;
        this.$m = ((Math.floor(totalSec / 60) % 60) + 60) % 60;
        this.$s = ((totalSec % 60) + 60) % 60;
        this.$ms = ((t % 1000) + 1000) % 1000;
        const [y, M, D] = Moment._epochDaysToYMD(totalDays);
        this.$y = y; this.$M = M; this.$D = D;
      }
    } else {
      const d = this._getD();
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

  constructor(config: MomentConfig = {}) {
    const c = config as MomentConfig;
    this._isAMomentObject = true;
    this._l = c._l || getCurrentLocale();
    this._isUTC = c._isUTC || false;
    this._offset = c._offset !== undefined ? c._offset : 0;
    if (c._d) {
      this._d = c._dClone === false ? c._d : new Date(c._d);
      this._t = this._d!.getTime();
    } else if (c._t !== undefined) {
      this._t = c._t;
      this._d = undefined;
    } else {
      this._t = Date.now();
      this._d = undefined;
    }
    this._isValid = c._isValid !== undefined ? c._isValid : !isNaN(this._t);
    this._dirty = this._isValid;
    if (c._i !== undefined) {this._i = c._i;}
    if (c._f !== undefined) {this._f = c._f;}
    if (c._strict !== undefined) {this._strict = c._strict;}
    const hasErrorCold = c._overflow !== undefined || c._empty !== undefined ||
      c._nullInput !== undefined || c._invalidMonth !== undefined || c._invalidFormat !== undefined ||
      c._weekdayMismatch !== undefined || c._userInvalidated !== undefined;
    const hasInfoCold = hasErrorCold || c._unusedTokens !== undefined || c._unusedInput !== undefined ||
      c._charsLeftOver !== undefined || c._invalidEra !== undefined || c._iso !== undefined ||
      c._rfc2822 !== undefined || c._bigHour !== undefined || c._meridiem !== undefined ||
      c._isParseZone !== undefined || c._tooBusyWith !== undefined || c._parsedDateParts !== undefined;
    if (hasInfoCold) {
      const cold: Record<string, unknown> = {};
      if (c._overflow !== undefined) cold._overflow = c._overflow;
      if (c._parsedDateParts !== undefined) cold._parsedDateParts = c._parsedDateParts;
      if (c._unusedTokens !== undefined) cold._unusedTokens = c._unusedTokens;
      if (c._unusedInput !== undefined) cold._unusedInput = c._unusedInput;
      if (c._charsLeftOver !== undefined) cold._charsLeftOver = c._charsLeftOver;
      if (c._empty !== undefined) cold._empty = c._empty;
      if (c._nullInput !== undefined) cold._nullInput = c._nullInput;
      if (c._invalidMonth !== undefined) cold._invalidMonth = c._invalidMonth;
      if (c._invalidFormat !== undefined) cold._invalidFormat = c._invalidFormat;
      if (c._weekdayMismatch !== undefined) cold._weekdayMismatch = c._weekdayMismatch;
      if (c._iso !== undefined) cold._iso = c._iso;
      if (c._rfc2822 !== undefined) cold._rfc2822 = c._rfc2822;
      if (c._invalidEra !== undefined) cold._invalidEra = c._invalidEra;
      if (c._bigHour !== undefined) cold._bigHour = c._bigHour;
      if (c._meridiem !== undefined) cold._meridiem = c._meridiem;
      if (c._isParseZone !== undefined) cold._isParseZone = c._isParseZone;
      if (c._userInvalidated !== undefined) cold._userInvalidated = c._userInvalidated;
      if (c._tooBusyWith !== undefined) cold._tooBusyWith = c._tooBusyWith;
      this._cold = cold;
      if (hasErrorCold) {this._dirty = false;}
    }
  }

  private _getLocale(): Locale {
    if (!this._locale) {
      this._locale = getLocale(this._l);
    }
    return this._locale;
  }

  private _gdt(method: DMethod): number {
    const d = this._getD();
    if (this._isUTC) {
      switch (method) {
        case DMethod.FullYear: return d.getUTCFullYear();
        case DMethod.Month: return d.getUTCMonth();
        case DMethod.Date: return d.getUTCDate();
        case DMethod.Day: return d.getUTCDay();
        case DMethod.Hours: return d.getUTCHours();
        case DMethod.Minutes: return d.getUTCMinutes();
        case DMethod.Seconds: return d.getUTCSeconds();
        case DMethod.Milliseconds: return d.getUTCMilliseconds();
      }
    } else {
      switch (method) {
        case DMethod.FullYear: return d.getFullYear();
        case DMethod.Month: return d.getMonth();
        case DMethod.Date: return d.getDate();
        case DMethod.Day: return d.getDay();
        case DMethod.Hours: return d.getHours();
        case DMethod.Minutes: return d.getMinutes();
        case DMethod.Seconds: return d.getSeconds();
        case DMethod.Milliseconds: return d.getMilliseconds();
      }
    }
    return NaN;
  }

  private _sdt(method: DMethod, value: number): void {
    const d = this._getD();
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
    this._t = d.getTime();
    this._refreshFields();
  }

  isValid(): boolean {
    if (!this._isValid) {return false;}
    const cold = this._cold;
    if (!cold) {return true;}
    if (cold._userInvalidated) {return false;}
    if ((cold._overflow as number) >= 0) {return false;}
    if (cold._invalidMonth) {return false;}
    if (cold._empty) {return false;}
    if (cold._nullInput) {return false;}
    if (cold._invalidFormat) {return false;}
    if (cold._weekdayMismatch) {return false;}
    if (cold._bigHour && this._strict) {return false;}
    return true;
  }

  clone(): Moment {
    const m = Object.create(Moment.prototype) as Moment;
    m._isAMomentObject = true;
    m._t = this._t;
    m._d = undefined;
    m._isValid = this._isValid;
    m._isUTC = this._isUTC;
    m._offset = this._offset;
    m._l = this._l;
    if (this._i !== undefined) {m._i = this._i;}
    if (this._f !== undefined) {m._f = this._f;}
    if (this._strict !== undefined) {m._strict = this._strict;}
    this._ensureFields();
    m.$y = this.$y; m.$M = this.$M; m.$D = this.$D; m.$W = this.$W;
    m.$H = this.$H; m.$m = this.$m; m.$s = this.$s; m.$ms = this.$ms;
    m._dirty = false;
    return m;
  }

  year(): number;
  year(y: unknown): Moment;
  year(y?: unknown): number | Moment {
    if (y !== undefined) {
      if (
        y === null ||
        y === undefined ||
        y === "" ||
        (typeof y === "object" && !(y instanceof Date))
      )
        {return this;}
      const num = Number(y);
      if (isNaN(num)) {return this;}
      const dt = this._getD();
      const date = this.$D;
      if (this._isUTC) {dt.setUTCFullYear(num);}
      else {dt.setFullYear(num);}
      if ((this._isUTC ? dt.getUTCDate() : dt.getDate()) !== date) {
        if (this._isUTC) {dt.setUTCDate(0);}
        else {dt.setDate(0);}
      }
      this.$y = this._isUTC ? dt.getUTCFullYear() : dt.getFullYear();
      this.$M = this._isUTC ? dt.getUTCMonth() : dt.getMonth();
      this.$D = this._isUTC ? dt.getUTCDate() : dt.getDate();
      this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();
      // $H, $m, $s, $ms unchanged
      this._t = dt.getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$y;
  }

  month(): number;
  month(m: unknown): Moment;
  month(m?: unknown): number | Moment {
    if (m !== undefined) {
      if (m === null || m === undefined) {return this;}
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
        if (typeof m === "string") {return this;}
      }
      const num = Number(m);
      if (isNaN(num)) {return this;}
      const date = this.$D;
      if (this._isUTC) {this._getD().setUTCMonth(num);}
      else {this._getD().setMonth(num);}
      if ((this._isUTC ? this._getD().getUTCDate() : this._getD().getDate()) !== date) {
        if (this._isUTC) {this._getD().setUTCDate(0);}
        else {this._getD().setDate(0);}
      }
      this.$y = this._isUTC ? this._getD().getUTCFullYear() : this._getD().getFullYear();
      this.$M = this._isUTC ? this._getD().getUTCMonth() : this._getD().getMonth();
      this.$D = this._isUTC ? this._getD().getUTCDate() : this._getD().getDate();
      this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$M;
  }

  date(): number;
  date(d: unknown): Moment;
  date(d?: unknown): number | Moment {
    if (d !== undefined) {
      if (
        d === null ||
        d === undefined ||
        d === "" ||
        (typeof d === "object" && !(d instanceof Date))
      )
        {return this;}
      const num = Number(d);
      if (isNaN(num)) {return this;}
      if (num <= 0) {return this;}
      if (this._isUTC) {this._getD().setUTCDate(num);}
      else {this._getD().setDate(num);}
      this.$D = this._isUTC ? this._getD().getUTCDate() : this._getD().getDate();
      this.$M = this._isUTC ? this._getD().getUTCMonth() : this._getD().getMonth();
      this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$D;
  }

  day(): number;
  day(d: unknown): Moment;
  day(d?: unknown): number | Moment {
    if (d !== undefined) {
      if (d === null || d === undefined) {return this;}
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
        if (!found) {return this;}
      }
      if (isNaN(dayNum)) {return this;}
      const currentDay = this.$W;
      const diff = dayNum - currentDay;
      const dt = this._getD();
      if (this._isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff);
      } else {
        dt.setDate(dt.getDate() + diff);
      }
      this.$D = this._isUTC ? dt.getUTCDate() : dt.getDate();
      this.$M = this._isUTC ? dt.getUTCMonth() : dt.getMonth();
      this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();
      this._t = dt.getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$W;
  }

  weekday(): number;
  weekday(d: number): Moment;
  weekday(d?: number): number | Moment {
    if (d !== undefined) {
      const current = this.$W;
      const weekConfig = (this._getLocale()._config as Record<string, unknown>).week || { dow: 0 };
      const dow = weekConfig.dow;
      const weekday = (current - dow + 7) % 7;
      const diff = (d as number) - weekday;
      const dt = this._getD();
      if (this._isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff);
      } else {
        dt.setDate(dt.getDate() + diff);
      }
      this.$D = this._isUTC ? dt.getUTCDate() : dt.getDate();
      this.$M = this._isUTC ? dt.getUTCMonth() : dt.getMonth();
      this.$y = this._isUTC ? dt.getUTCFullYear() : dt.getFullYear();
      this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();
      this._t = dt.getTime();
      this._updateOffset(true);
      return this;
    }
    const day = this.$W;
    const weekConfig = (this._getLocale()._config as Record<string, unknown>).week || { dow: 0 };
    const dow = weekConfig.dow;
    return (day - dow + 7) % 7;
  }

  isoWeekday(): number;
  isoWeekday(d: unknown): Moment;
  isoWeekday(d?: unknown): number | Moment {
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
        if (d === undefined) {return this;}
      }
      const target = d as number;
      const current = this.$W;
      const currentIso = current === 0 ? 7 : current;
      const diff = target - currentIso;
      const dt = this._getD();
      if (this._isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff);
      } else {
        dt.setDate(dt.getDate() + diff);
      }
      this.$D = this._isUTC ? dt.getUTCDate() : dt.getDate();
      this.$M = this._isUTC ? dt.getUTCMonth() : dt.getMonth();
      this.$y = this._isUTC ? dt.getUTCFullYear() : dt.getFullYear();
      this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();
      this._t = dt.getTime();
      this._updateOffset(true);
      return this;
    }
    this._ensureFields();
    return this.$W === 0 ? 7 : this.$W;
  }

  dayOfYear(): number;
  dayOfYear(d: number): Moment;
  dayOfYear(d?: number): number | Moment {
    if (d !== undefined) {
      const year = this.$y;
      const day = Number(d);
      if (this._isUTC) {
        this._getD().setUTCFullYear(year, 0, day);
      } else {
        this._getD().setFullYear(year, 0, day);
      }
      this.$D = this._isUTC ? this._getD().getUTCDate() : this._getD().getDate();
      this.$M = this._isUTC ? this._getD().getUTCMonth() : this._getD().getMonth();
      this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    this._ensureFields();
    return this.$D + (isLeapYear(this.$y) ? leapLadder : nonLeapLadder)[this.$M];
  }

  hour(): number;
  hour(h: unknown): Moment;
  hour(h?: unknown): number | Moment {
    if (h !== undefined) {
      if (h === null) {return this;}
      const num = Number(h);
      if (isNaN(num)) {return this;}
      if (this._isUTC) {this._getD().setUTCHours(num);}
      else {this._getD().setHours(num);}
      this.$H = this._isUTC ? this._getD().getUTCHours() : this._getD().getHours();
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$H;
  }

  minute(): number;
  minute(m: unknown): Moment;
  minute(m?: unknown): number | Moment {
    if (m !== undefined) {
      if (m === null) {return this;}
      const num = Number(m);
      if (isNaN(num)) {return this;}
      if (this._isUTC) {this._getD().setUTCMinutes(num);}
      else {this._getD().setMinutes(num);}
      this.$m = this._isUTC ? this._getD().getUTCMinutes() : this._getD().getMinutes();
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$m;
  }

  second(): number;
  second(s: unknown): Moment;
  second(s?: unknown): number | Moment {
    if (s !== undefined) {
      if (s === null) {return this;}
      const num = Number(s);
      if (isNaN(num)) {return this;}
      if (this._isUTC) {this._getD().setUTCSeconds(num);}
      else {this._getD().setSeconds(num);}
      this.$s = this._isUTC ? this._getD().getUTCSeconds() : this._getD().getSeconds();
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$s;
  }

  millisecond(): number;
  millisecond(ms: unknown): Moment;
  millisecond(ms?: unknown): number | Moment {
    if (ms !== undefined) {
      if (ms === null) {return this;}
      const num = Number(ms);
      if (isNaN(num)) {return this;}
      if (this._isUTC) {this._getD().setUTCMilliseconds(num);}
      else {this._getD().setMilliseconds(num);}
      this.$ms = this._isUTC ? this._getD().getUTCMilliseconds() : this._getD().getMilliseconds();
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$ms;
  }

  get(unit: string): number;
  get(unit: object): Moment;
  get(unit: string | object): number | Moment {
    if (isObject(unit)) {return this;}
    const u = normalizeUnits(unit as string);
    if (!u) {return NaN;}
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
      const obj = unit as Record<string, unknown>;

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
    this._t = this._d.getTime();
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
    this._t = this._d.getTime();
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
    if (!u) {return this;}
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

  private _addSimple(amount: number, unit: number): void {
    let changedDays = false;

    switch (unit) {
      case YEAR:
      case QUARTER:
      case MONTH: {
        changedDays = true;
        this._ensureFields();
        const totalMonths = absRound(unit === YEAR ? amount * 12 : unit === QUARTER ? amount * 3 : amount);

        const tm = this.$y * 12 + this.$M + totalMonths;
        const y = Math.floor(tm / 12);
        const m = ((tm % 12) + 12) % 12;
        const maxDay = daysInMonth(y, m);
        const d_ = this.$D > maxDay ? maxDay : this.$D;

        if (this._isUTC) {
          this._t = Date.UTC(y, m, d_, this.$H, this.$m, this.$s, this.$ms);
        } else {
          this._d = new Date(y, m, d_, this.$H, this.$m, this.$s, this.$ms);
          this._t = this._d.getTime();
        }
        this.$y = y;
        this.$M = m;
        this.$D = d_;
        this.$W = _dayOfWeek(y, m, d_);
        break;
      }
      case ISO_WEEK:
      case WEEK:
      case DAY:
      case DATE: {
        changedDays = true;
        this._ensureFields();
        const rounded = absRound((unit === WEEK || unit === ISO_WEEK) ? amount * 7 : amount);
        if (rounded !== 0) {
          this.$D += rounded;
          const maxDay = daysInMonth(this.$y, this.$M);
          if (this.$D > maxDay) {
            this.$D -= maxDay;
            this.$M++;
            if (this.$M >= 12) { this.$M = 0; this.$y++; }
            if (this.$D > daysInMonth(this.$y, this.$M)) { this.$D = daysInMonth(this.$y, this.$M); }
          } else if (this.$D < 1) {
            this.$M--;
            if (this.$M < 0) { this.$M = 11; this.$y--; }
            this.$D += daysInMonth(this.$y, this.$M);
          }
          this.$W = ((this.$W + rounded) % 7 + 7) % 7;
        }

        if (this._isUTC) {
          this._t = Date.UTC(this.$y, this.$M, this.$D, this.$H, this.$m, this.$s, this.$ms);
        } else {
          const dt = this._getD();
          dt.setFullYear(this.$y, this.$M, this.$D);
          this._t = dt.getTime();
          this.$W = dt.getDay();
          this._offset = -dt.getTimezoneOffset();
        }
        break;
      }
      case HOUR: {
        const dt = this._getD();
        dt.setTime(dt.getTime() + Math.round(amount * 3600000));
        this._t = dt.getTime();
        this._refreshFields();
        break;
      }
      case MINUTE: {
        const dt = this._getD();
        dt.setTime(dt.getTime() + Math.round(amount * 60000));
        this._t = dt.getTime();
        this._refreshFields();
        break;
      }
      case SECOND: {
        const dt = this._getD();
        dt.setTime(dt.getTime() + Math.round(amount * 1000));
        this._t = dt.getTime();
        this._refreshFields();
        break;
      }
      case MILLISECOND: {
        const dt = this._getD();
        dt.setTime(dt.getTime() + Math.round(amount));
        this._t = dt.getTime();
        this._refreshFields();
        break;
      }
      default:
        return;
    }
    this._updateOffset(changedDays);
    if (isNaN(this._t)) {this._isValid = false;}
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
      const obj = amount as Record<string, unknown>;
      let ms = 0, days = 0, months = 0;
      for (const key in obj) {
        if (!hasOwnProp(obj, key)) {continue;}
        const a = normalizeUnits(key);
        if (!a) {continue;}
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
    const d = this._getD();
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
    this._t = d.getTime();
    this._refreshFields();
    this._updateOffset(!(!months && !days));
    if (isNaN(d.getTime())) {this._isValid = false;}
  }

  add(amount: number | string | Duration | object, unit?: string): Moment {
    if (!this._isValid) {return this;}
    if (typeof amount === "number" && typeof unit === "string") {
      const u = normalizeUnitCode(unit);
      if (u >= 0) {this._addSimple(amount, u);}
      return this;
    }
    const parsed = this._parseDurationInput(amount, unit);
    if (!parsed) {return this;}
    this._applyDuration(parsed.ms, parsed.days, parsed.months, 1);
    return this;
  }

  subtract(amount: number | string | Duration | object, unit?: string): Moment {
    if (!this._isValid) {return this;}
    if (typeof amount === "number" && typeof unit === "string") {
      const u = normalizeUnitCode(unit);
      if (u >= 0) {this._addSimple(-amount, u);}
      return this;
    }
    const parsed = this._parseDurationInput(amount, unit);
    if (!parsed) {return this;}
    this._applyDuration(parsed.ms, parsed.days, parsed.months, -1);
    return this;
  }

  startOf(unit: string): Moment {
    const code = normalizeUnitCode(unit);
    if (code < 0) {return this;}
    if (!updateOffsetCallback) {
      if (code === MONTH) {
        if (this.$D === 1 && this.$H === 0 && this.$m === 0 && this.$s === 0 && this.$ms === 0) {return this;}
      } else if (code === DATE || code === DAY) {
        if (this.$H === 0 && this.$m === 0 && this.$s === 0 && this.$ms === 0) {return this;}
      } else if (code === HOUR) {
        if (this.$m === 0 && this.$s === 0 && this.$ms === 0) {return this;}
      } else if (code === MINUTE) {
        if (this.$s === 0 && this.$ms === 0) {return this;}
      } else if (code === SECOND) {
        if (this.$ms === 0) {return this;}
      }
    }
    const d = this._getD();

    if (this._isUTC) {
      switch (code) {
        case YEAR:
          d.setUTCMonth(0);
          d.setUTCDate(1);
          d.setUTCHours(0, 0, 0, 0);
          this.$M = 0; this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getUTCDay();
          break;
        case QUARTER:
          d.setUTCMonth(Math.floor(this.$M / 3) * 3);
          d.setUTCDate(1);
          d.setUTCHours(0, 0, 0, 0);
          this.$M = Math.floor(this.$M / 3) * 3; this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getUTCDay();
          break;
        case MONTH:
          d.setUTCDate(1);
          d.setUTCHours(0, 0, 0, 0);
          this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getUTCDay();
          break;
        case WEEK: {
          const _locWeek = this._getLocale();
          const _weekCfg = (_locWeek._config as Record<string, unknown>).week || { dow: 0 };
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
        case ISO_WEEK: {
          const day = d.getUTCDay();
          const diff = day === 0 ? -6 : 1 - day;
          d.setUTCDate(d.getUTCDate() + diff);
          d.setUTCHours(0, 0, 0, 0);
          this.$D = d.getUTCDate(); this.$M = d.getUTCMonth(); this.$y = d.getUTCFullYear();
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = 1;
          break;
        }
        case DATE:
        case DAY:
          d.setUTCHours(0, 0, 0, 0);
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          break;
        case HOUR:
          d.setUTCMinutes(0, 0, 0);
          this.$m = 0; this.$s = 0; this.$ms = 0;
          break;
        case MINUTE:
          d.setUTCSeconds(0, 0);
          this.$s = 0; this.$ms = 0;
          break;
        case SECOND:
          d.setUTCMilliseconds(0);
          this.$ms = 0;
          break;
      }
    } else {
      switch (code) {
        case YEAR:
          d.setDate(1);
          d.setMonth(0);
          d.setHours(0, 0, 0, 0);
          this.$M = 0; this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getDay();
          break;
        case QUARTER:
          d.setDate(1);
          d.setMonth(Math.floor(this.$M / 3) * 3);
          d.setHours(0, 0, 0, 0);
          this.$M = Math.floor(this.$M / 3) * 3; this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getDay();
          break;
        case MONTH:
          d.setDate(1);
          d.setHours(0, 0, 0, 0);
          this.$D = 1;
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = d.getDay();
          break;
        case WEEK: {
          const _locWeek = this._getLocale();
          const _weekCfg = (_locWeek._config as Record<string, unknown>).week || { dow: 0 };
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
        case ISO_WEEK: {
          const day = d.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          d.setDate(d.getDate() + diff);
          d.setHours(0, 0, 0, 0);
          this.$D = d.getDate(); this.$M = d.getMonth(); this.$y = d.getFullYear();
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          this.$W = 1;
          break;
        }
        case DATE:
        case DAY:
          d.setHours(0, 0, 0, 0);
          this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
          break;
        case HOUR:
          d.setMinutes(0, 0, 0);
          this.$m = 0; this.$s = 0; this.$ms = 0;
          break;
        case MINUTE:
          d.setSeconds(0, 0);
          this.$s = 0; this.$ms = 0;
          break;
        case SECOND:
          d.setMilliseconds(0);
          this.$ms = 0;
          break;
      }
    }

    this._t = d.getTime();
    if (!this._isUTC) {this._offset = -d.getTimezoneOffset();}
    this._updateOffset(true);
    return this;
  }

  endOf(unit: string): Moment {
    const code = normalizeUnitCode(unit);
    if (code < 0) {return this;}
    this.startOf(unit);
    const d = this._getD();

    if (this._isUTC) {
      switch (code) {
        case YEAR:
          d.setUTCFullYear(d.getUTCFullYear() + 1);
          d.setUTCMilliseconds(-1);
          this.$y = d.getUTCFullYear();
          this.$M = d.getUTCMonth(); this.$D = d.getUTCDate();
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          this.$W = d.getUTCDay();
          break;
        case QUARTER:
          d.setUTCMonth(d.getUTCMonth() + 3);
          d.setUTCMilliseconds(-1);
          this.$M = d.getUTCMonth(); this.$D = d.getUTCDate();
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          this.$W = d.getUTCDay();
          break;
        case MONTH:
          d.setUTCMonth(d.getUTCMonth() + 1);
          d.setUTCMilliseconds(-1);
          this.$M = d.getUTCMonth(); this.$D = d.getUTCDate();
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          this.$W = d.getUTCDay();
          break;
        case WEEK:
          d.setUTCDate(d.getUTCDate() + 6);
          d.setUTCHours(23, 59, 59, 999);
          this.$D = d.getUTCDate(); this.$M = d.getUTCMonth(); this.$y = d.getUTCFullYear();
          this.$H = 23; this.$m = 59; this.$s = 59; this.$ms = 999;
          this.$W = d.getUTCDay();
          break;
        case ISO_WEEK:
          d.setUTCDate(d.getUTCDate() + 6);
          d.setUTCHours(23, 59, 59, 999);
          this.$D = d.getUTCDate(); this.$M = d.getUTCMonth(); this.$y = d.getUTCFullYear();
          this.$H = 23; this.$m = 59; this.$s = 59; this.$ms = 999;
          this.$W = d.getUTCDay();
          break;
        case DATE:
        case DAY:
          d.setUTCDate(d.getUTCDate() + 1);
          d.setUTCMilliseconds(-1);
          this.$D = d.getUTCDate();
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          this.$W = d.getUTCDay();
          break;
        case HOUR:
          d.setUTCHours(d.getUTCHours() + 1);
          d.setUTCMilliseconds(-1);
          this.$H = d.getUTCHours(); this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          break;
        case MINUTE:
          d.setUTCMinutes(d.getUTCMinutes() + 1);
          d.setUTCMilliseconds(-1);
          this.$m = d.getUTCMinutes();
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          break;
        case SECOND:
          d.setUTCSeconds(d.getUTCSeconds() + 1);
          d.setUTCMilliseconds(-1);
          this.$s = d.getUTCSeconds(); this.$ms = d.getUTCMilliseconds();
          break;
      }
    } else {
      switch (code) {
        case YEAR:
          d.setFullYear(d.getFullYear() + 1);
          d.setMilliseconds(-1);
          this.$y = d.getFullYear();
          this.$M = d.getMonth(); this.$D = d.getDate();
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          this.$W = d.getDay();
          break;
        case QUARTER:
          d.setMonth(d.getMonth() + 3);
          d.setMilliseconds(-1);
          this.$M = d.getMonth(); this.$D = d.getDate();
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          this.$W = d.getDay();
          break;
        case MONTH:
          d.setMonth(d.getMonth() + 1);
          d.setMilliseconds(-1);
          this.$M = d.getMonth(); this.$D = d.getDate();
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          this.$W = d.getDay();
          break;
        case WEEK:
        case ISO_WEEK:
          d.setDate(d.getDate() + 6);
          d.setHours(23, 59, 59, 999);
          this.$D = d.getDate(); this.$M = d.getMonth(); this.$y = d.getFullYear();
          this.$H = 23; this.$m = 59; this.$s = 59; this.$ms = 999;
          this.$W = d.getDay();
          break;
        case DATE:
        case DAY:
          d.setDate(d.getDate() + 1);
          d.setMilliseconds(-1);
          this.$D = d.getDate();
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          this.$W = d.getDay();
          break;
        case HOUR:
          d.setHours(d.getHours() + 1);
          d.setMilliseconds(-1);
          this.$H = d.getHours(); this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          break;
        case MINUTE:
          d.setMinutes(d.getMinutes() + 1);
          d.setMilliseconds(-1);
          this.$m = d.getMinutes();
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          break;
        case SECOND:
          d.setSeconds(d.getSeconds() + 1);
          d.setMilliseconds(-1);
          this.$s = d.getSeconds(); this.$ms = d.getMilliseconds();
          break;
      }
    }

    this._t = this._getD().getTime();
    if (!this._isUTC) {this._offset = -this._getD().getTimezoneOffset();}
    this._updateOffset(true);
    return this;
  }

  local(keepLocalTime?: boolean): Moment {
    if (this._isUTC) {
      if (keepLocalTime) {
        this._d = new Date(
          this.$y,
          this.$M,
          this.$D,
          this.$H,
          this.$m,
          this.$s,
          this.$ms,
        );
    this._t = this._d.getTime();
      } else {
        this._d = new Date(this.valueOf());
    this._t = this._d.getTime();
      }
    }
    this._isUTC = false;
    this.$y = this._getD().getFullYear();
    this.$M = this._getD().getMonth();
    this.$D = this._getD().getDate();
    this.$W = this._getD().getDay();
    this.$H = this._getD().getHours();
    this.$m = this._getD().getMinutes();
    this.$s = this._getD().getSeconds();
    this.$ms = this._getD().getMilliseconds();
    this._offset = -this._getD().getTimezoneOffset();
    return this;
  }

  utc(keepLocalTime?: boolean): Moment {
    if (this._isUTC && this._offset !== 0) {
      if (!keepLocalTime) {
        this._d = new Date(this.valueOf());
    this._t = this._d.getTime();
      }
    } else if (!this._isUTC) {
      if (keepLocalTime) {
        this._d = new Date(
          Date.UTC(this.$y, this.$M, this.$D, this.$H, this.$m, this.$s, this.$ms),
        );
    this._t = this._d.getTime();
      } else {
        this._d = new Date(this.valueOf());
    this._t = this._d.getTime();
      }
    }
    this._isUTC = true;
    this._offset = 0;
    this.$y = this._getD().getUTCFullYear();
    this.$M = this._getD().getUTCMonth();
    this.$D = this._getD().getUTCDate();
    this.$W = this._getD().getUTCDay();
    this.$H = this._getD().getUTCHours();
    this.$m = this._getD().getUTCMinutes();
    this.$s = this._getD().getUTCSeconds();
    this.$ms = this._getD().getUTCMilliseconds();
    return this;
  }

  utcOffset(): number;
  utcOffset(offset: number | string, keepLocalTime?: boolean): Moment;
  utcOffset(offset?: number | string, keepLocalTime?: boolean): number | Moment {
    if (offset === undefined) {
      return this._offset;
    }

    let numOffset: number;
    if (typeof offset === "string") {
      numOffset = parseOffsetString(offset) as number;
      if (numOffset === null || isNaN(numOffset)) {return this;}
    } else {
      numOffset = Math.abs(offset) < 16 ? offset * 60 : offset;
    }
    if (keepLocalTime) {
      if (!this._isUTC) {
        this._d = new Date(
          Date.UTC(this.$y, this.$M, this.$D, this.$H, this.$m, this.$s, this.$ms),
        );
    this._t = this._d.getTime();
      }
      this._offset = numOffset;
      this._isUTC = true;
    } else {
      const oldAbsTime = this.valueOf();
      this._d = new Date(oldAbsTime + numOffset * 60000);
    this._t = this._d.getTime();
      this._offset = numOffset;
      this._isUTC = true;
    }
    this.$y = this._getD().getUTCFullYear();
    this.$M = this._getD().getUTCMonth();
    this.$D = this._getD().getUTCDate();
    this.$W = this._getD().getUTCDay();
    this.$H = this._getD().getUTCHours();
    this.$m = this._getD().getUTCMinutes();
    this.$s = this._getD().getUTCSeconds();
    this.$ms = this._getD().getUTCMilliseconds();
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
    return formatMoment(this as Moment, format);
  }

  fromNow(pref?: boolean): string {
    if (!this._isValid) {return this._getLocale().invalidDate();}
    return this.from(new Date(), pref);
  }

  from(input: MomentInput, pref?: boolean): string {
    if (!this._isValid) {return this._getLocale().invalidDate();}
    let other: Moment;
    if (input === undefined || input === null) {
      other = new Moment({ _d: new Date(), _dClone: false });
    } else {
      other = momentFromAnything(input);
    }

    if (!other._isValid) {return this._getLocale().invalidDate();}

    const dur = new Duration({ to: this, from: other });
    if (this._l) {dur.locale(this._l);}
    return dur.humanize(!pref);
  }

  toNow(pref?: boolean): string {
    if (!this._isValid) {return this._getLocale().invalidDate();}
    return this.to(new Date(), pref);
  }

  to(input: MomentInput, pref?: boolean): string {
    if (!this._isValid) {return this._getLocale().invalidDate();}
    const other = momentFromAnything(input);
    if (!other._isValid) {return this._getLocale().invalidDate();}

    const dur = new Duration({ from: this, to: other });
    if (this._l) {dur.locale(this._l);}
    return dur.humanize(!pref);
  }

  calendar(ref?: MomentInput, opts?: object): string {
    let reference: Moment;
    let formatOpts: Record<string, unknown> | undefined;

    if (opts !== undefined) {
      if (!ref) {
        reference = new Moment({ _d: new Date(), _dClone: false });
      } else {
        reference = momentFromAnything(ref);
      }
      formatOpts = opts as Record<string, unknown>;
    } else if (ref !== undefined) {
      if (!ref) {
        reference = new Moment({ _d: new Date(), _dClone: false });
      } else if (isObject(ref)) {
        const obj = ref as Record<string, unknown>;
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
    const cal = locale._config.calendar || ({} as Record<string, unknown>);

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

    let formatString: unknown;

    if (typeof cal === "function") {
      formatString = (cal as Function).call(locale._config, key, this);
    } else if (formatOpts && hasOwnProp(formatOpts, key)) {
      formatString = formatOpts[key];
    } else if (hasOwnProp(cal as Record<string, unknown>, key)) {
      formatString = (cal as Record<string, unknown>)[key];
    } else if (hasOwnProp(cal as Record<string, unknown>, "sameElse")) {
      formatString = (cal as Record<string, unknown>)["sameElse"];
    } else {
      formatString = "L";
    }

    if (typeof formatString === "function") {
      formatString = formatString.call(this, reference);
    }

    if (typeof formatString === "string") {
      return formatMoment(this as Moment, formatString);
    }

    return formatMoment(this as Moment, "L");
  }

  diff(input: MomentInput, unit?: string, float?: boolean): number {
    const other = momentFromAnything(input);
    const diff = this.valueOf() - other.valueOf();

    if (!unit) {return diff;}

    const code = normalizeUnitCode(unit);
    if (code < 0) {return NaN;}

    switch (code) {
      case DATE:
      case DAY: {
        const r = diff / 86400000;
        if (float) {return r;}
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return Object.is(t, -0) ? 0 : t;
      }
      case HOUR: {
        const r = diff / 3600000;
        if (float) {return r;}
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return Object.is(t, -0) ? 0 : t;
      }
      case MINUTE: {
        const r = diff / 60000;
        if (float) {return r;}
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return Object.is(t, -0) ? 0 : t;
      }
      case SECOND: {
        const r = diff / 1000;
        if (float) {return r;}
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return Object.is(t, -0) ? 0 : t;
      }
      case MILLISECOND: {
        if (float) {return diff;}
        const t = diff < 0 ? -Math.floor(-diff) : Math.floor(diff);
        return Object.is(t, -0) ? 0 : t;
      }
      case WEEK: {
        const r = diff / 604800000;
        if (float) {return r;}
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return Object.is(t, -0) ? 0 : t;
      }
      case YEAR:
      case MONTH:
      case QUARTER: {
        this._ensureFields();
        other._ensureFields();

        const aDay = this.$D;
        const bDay = other.$D;
        const swap = aDay < bDay;
        const a = swap ? other : this;
        const b = swap ? this : other;

        const aYear = a.$y;
        const aMonth = a.$M;
        const aDayOf = a.$D;
        const aHour = a.$H;
        const aMin = a.$m;
        const aSec = a.$s;
        const aMs = a.$ms;
        const bYear = b.$y;
        const bMonth = b.$M;

        const wholeMonthDiff = (bYear - aYear) * 12 + (bMonth - aMonth);

        const addAnchorMs = (n: number): number => {
          const tm = aYear * 12 + aMonth + n;
          const y = Math.floor(tm / 12);
          const m = ((tm % 12) + 12) % 12;
          const maxDay = daysInMonth(y, m);
          const d = aDayOf > maxDay ? maxDay : aDayOf;
          if (a._isUTC) {
            return Date.UTC(y, m, d, aHour, aMin, aSec, aMs);
          }
          return new Date(y, m, d, aHour, aMin, aSec, aMs).getTime();
        };

        const anchorVal = addAnchorMs(wholeMonthDiff);
        const bVal = b.valueOf();
        const sub = bVal - anchorVal;

        let adjust: number;
        if (sub < 0) {
          adjust = sub / (anchorVal - addAnchorMs(wholeMonthDiff - 1));
        } else {
          adjust = sub / (addAnchorMs(wholeMonthDiff + 1) - anchorVal);
        }

        let result = -(wholeMonthDiff + adjust);
        if (swap) {result = -result;}

        if (code === YEAR) {result /= 12;}
        else if (code === QUARTER) {result /= 3;}

        if (float) {return result;}
        const t = result < 0 ? -Math.floor(-result) : Math.floor(result);
        return Object.is(t, -0) ? 0 : t;
      }
      default:
        return diff;
    }
  }

  valueOf(): number {
    if (!this._isValid) {return NaN;}
    if (this._isUTC) {
      return this._t - this._offset * 60000;
    }
    return this._t;
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
      const d = this._getD();
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
    const utcMs = this._isUTC ? this._t - this._offset * 60000 : this._t;
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
    if (!this._isValid) {return "Invalid date";}
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
    if (!u) {return NaN;}
    if (u === "millisecond") {return this.valueOf() - other.valueOf();}
    if (u === "second")
      {return Math.floor(this.valueOf() / 1000) - Math.floor(other.valueOf() / 1000);}
    if (u === "minute")
      {return Math.floor(this.valueOf() / 60000) - Math.floor(other.valueOf() / 60000);}
    if (u === "hour")
      {return Math.floor(this.valueOf() / 3600000) - Math.floor(other.valueOf() / 3600000);}
    switch (u) {
      case "year": {
        const d = (this.year() as number) - (other.year() as number);
        return d;
      }
      case "month": {
        const d = (this.year() as number) - (other.year() as number);
        if (d !== 0) {return d;}
        return (this.month() as number) - (other.month() as number);
      }
      case "quarter": {
        const d = (this.year() as number) - (other.year() as number);
        if (d !== 0) {return d;}
        return (this.quarter() as number) - (other.quarter() as number);
      }
      case "week":
      case "isoWeek": {
        const isIso = u === "isoWeek";
        const d = (isIso ? this.isoWeekYear() as number : this.weekYear() as number) - (isIso ? other.isoWeekYear() as number : other.weekYear() as number);
        if (d !== 0) {return d;}
        return (isIso ? this.isoWeek() as number : this.week() as number) - (isIso ? other.isoWeek() as number : other.week() as number);
      }
      case "day":
      case "date":
      default: {
        const d = (this.year() as number) - (other.year() as number);
        if (d !== 0) {return d;}
        const d2 = (this.month() as number) - (other.month() as number);
        if (d2 !== 0) {return d2;}
        return (this.date() as number) - (other.date() as number);
      }
    }
  }

  isSame(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) {return false;}
    if (unit) {
      return this._compareCalendarValues(other, unit) === 0;
    }
    return this.valueOf() === other.valueOf();
  }

  isSameOrBefore(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) {return false;}
    return this._compareCalendarValues(other, unit || "millisecond") <= 0;
  }

  isSameOrAfter(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) {return false;}
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
    const jan = new Date(this._getD().getFullYear(), 0, 1);
    const jul = new Date(this._getD().getFullYear(), 6, 1);
    const janOff = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    return this._getD().getTimezoneOffset() < janOff;
  }

  isLocal(): boolean {
    if (!this._isValid) {return false;}
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

  years(): number;
  years(y: number): Moment;
  years(y?: number): number | Moment {
    return this.year(y);
  }
  months(): number;
  months(m: number): Moment;
  months(m?: number): number | Moment {
    return this.month(m);
  }
  dates(): number;
  dates(d: number): Moment;
  dates(d?: number): number | Moment {
    return this.date(d);
  }
  days(): number;
  days(d: number): Moment;
  days(d?: number): number | Moment {
    return this.day(d);
  }
  hours(): number;
  hours(h: number): Moment;
  hours(h?: number): number | Moment {
    return this.hour(h);
  }
  minutes(): number;
  minutes(m: number): Moment;
  minutes(m?: number): number | Moment {
    return this.minute(m);
  }
  seconds(): number;
  seconds(s: number): Moment;
  seconds(s?: number): number | Moment {
    return this.second(s);
  }
  milliseconds(): number;
  milliseconds(ms: number): Moment;
  milliseconds(ms?: number): number | Moment {
    return this.millisecond(ms);
  }

  quarter(): number;
  quarter(q: number): Moment;
  quarter(q?: number): number | Moment {
    if (q !== undefined) {
      this.month((q - 1) * 3 + ((this.month() as number) % 3));
      return this;
    }
    return Math.floor((this.month() as number) / 3) + 1;
  }

  quarters(): number;
  quarters(q: number): Moment;
  quarters(q?: number): number | Moment {
    return this.quarter(q as number);
  }

  week(): number;
  week(w: number): Moment;
  week(w?: number): number | Moment {
    const weekConfig = (this._getLocale()._config as Record<string, unknown>).week || { dow: 0, doy: 6 };
    const dow = weekConfig.dow;
    const doy = weekConfig.doy;

    if (w !== undefined) {
      const current = getLocaleWeek(this._getD(), this._isUTC, dow, doy);
      const diff = w - current;
      const d = this._getD();
      if (this._isUTC) {
        d.setUTCDate(d.getUTCDate() + diff * 7);
      } else {
        d.setDate(d.getDate() + diff * 7);
      }
      this._t = d.getTime();
      this._refreshFields();
      return this;
    }

    return getLocaleWeek(this._getD(), this._isUTC, dow, doy);
  }

  weeks(): number;
  weeks(w: number): Moment;
  weeks(w?: number): number | Moment {
    return this.week(w as number);
  }

  max(other?: MomentInput): Moment {
    if (!this._isValid) {return this;}
    const otherM =
      other !== undefined ? momentFromAnything(other) : new Moment({ _d: new Date(NaN), _dClone: false });
    if (!otherM._isValid) {return otherM;}
    if (otherM.valueOf() > this.valueOf()) {return otherM;}
    return this;
  }

  min(other?: MomentInput): Moment {
    if (!this._isValid) {return this;}
    const otherM =
      other !== undefined ? momentFromAnything(other) : new Moment({ _d: new Date(NaN), _dClone: false });
    if (!otherM._isValid) {return otherM;}
    if (otherM.valueOf() < this.valueOf()) {return otherM;}
    return this;
  }

  weekYear(): number;
  weekYear(y: number): Moment;
  weekYear(y?: number): number | Moment {
    const weekConfig = (this._getLocale()._config as Record<string, unknown>).week || { dow: 0, doy: 6 };
    const dow = weekConfig.dow;
    const doy = weekConfig.doy;

    if (y !== undefined) {
      let currentWeek = getLocaleWeek(this._getD(), this._isUTC, dow, doy);
      const currentDay = this.weekday() as number;
      const maxWeek = weeksInYear(y, dow, doy, this._isUTC);
      if (currentWeek > maxWeek) {currentWeek = maxWeek;}
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
    this._t = this._d.getTime();
      this._refreshFields();
      this._updateOffset(true);
      return this;
    }

    if (dow === 1 && doy === 4) {
      return getISOWeekYear(this._getD(), this._isUTC);
    }
    return getLocaleWeekYear(this._getD(), this._isUTC, dow, doy);
  }

  isoWeek(): number;
  isoWeek(w: number): Moment;
  isoWeek(w?: number): number | Moment {
    if (w !== undefined) {
      const current = getISOWeekNumber(this._getD(), this._isUTC);
      const diff = w - current;
      const d = this._getD();
      if (this._isUTC) {
        d.setUTCDate(d.getUTCDate() + diff * 7);
      } else {
        d.setDate(d.getDate() + diff * 7);
      }
      this._t = d.getTime();
      this._refreshFields();
      return this;
    }
    return getISOWeekNumber(this._getD(), this._isUTC);
  }

  isoWeeks(): number;
  isoWeeks(w: number): Moment;
  isoWeeks(w?: number): number | Moment {
    return this.isoWeek(w as number);
  }

  isoWeekYear(): number;
  isoWeekYear(y: number): Moment;
  isoWeekYear(y?: number): number | Moment {
    if (y !== undefined) {
      let currentWeek = getISOWeekNumber(this._getD(), this._isUTC);
      const currentDay = this.isoWeekday() as number;
      const maxWeek = weeksInYear(y, 1, 4, this._isUTC);
      if (currentWeek > maxWeek) {currentWeek = maxWeek;}
      const jan4 = new Date(Date.UTC(y, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const mondayOfWeek1 = new Date(Date.UTC(y, 0, 4 - (jan4Day - 1)));
      const target = new Date(
        mondayOfWeek1.getTime() + ((currentWeek - 1) * 7 + (currentDay - 1)) * 86400000,
      );
      this._d = target;
    this._t = this._d.getTime();
      this._refreshFields();
      return this;
    }
    return getISOWeekYear(this._getD(), this._isUTC);
  }

  isoWeeksInYear(): number {
    const year = this.year() as number;
    return weeksInYear(year, 1, 4, this._isUTC);
  }

  weeksInYear(): number {
    const weekConfig = (this._getLocale()._config as Record<string, unknown>).week || { dow: 0, doy: 6 };
    const dow = weekConfig.dow;
    const doy = weekConfig.doy;
    const year = this.year() as number;
    return weeksInYear(year, dow, doy, this._isUTC);
  }

  weeksInWeekYear(): number {
    const weekConfig = (this._getLocale()._config as Record<string, unknown>).week || { dow: 0, doy: 6 };
    const dow = weekConfig.dow;
    const doy = weekConfig.doy;
    const weekYear = getLocaleWeekYear(this._getD(), this._isUTC, dow, doy);
    return weeksInYear(weekYear, dow, doy, this._isUTC);
  }

  isoWeeksInISOWeekYear(): number {
    const year = this.isoWeekYear() as number;
    return weeksInYear(year, 1, 4, this._isUTC);
  }

  parseZone(input?: unknown, format?: unknown): Moment {
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
          m._t = m._d.getTime();
          m._offset = p.offset;
          m._isUTC = true;
          m._refreshFields();
        } else {
          const allInput = `${this._i as string  } ${  ((this as Record<string, unknown>)._unusedInput || []).join("")}`;
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
        m._t = d.getTime();
        m._offset = parsed.offset;
        m._isUTC = true;
        m._refreshFields();
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

  zone(): number;
  zone(offset: number | string, keepLocalTime?: boolean): Moment;
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
      if (this._offset === 0) {return "UTC";}
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
      if (this._offset === 0) {return "Coordinated Universal Time";}
    }
    return "";
  }

  localeData(): Locale {
    return this._getLocale();
  }

  lang(): string;
  lang(locale: string | string[] | false): Moment;
  lang(locale?: string | string[] | false): string | Moment {
    if (locale === undefined) {return this._l || getCurrentLocale();}
    if (locale === false) {
      this._l = undefined;
      this._locale = undefined;
      return this;
    }
    if (Array.isArray(locale)) {
      for (const l of locale) {
        if (this._trySetLocale(l)) {return this;}
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
        this._locale = undefined;
        return true;
      }
    }
    return false;
  }

  locale(): string;
  locale(locale: string | string[] | false): Moment;
  locale(locale?: string | string[] | false): string | Moment {
    if (locale === undefined || locale === false) {
      if (locale === false) {
        this._l = undefined;
        this._locale = undefined;
      }
      return this._l || getCurrentLocale();
    }
    if (Array.isArray(locale)) {
      for (const l of locale) {
        if (this._trySetLocale(l)) {return this;}
      }
      return this;
    }
    this._trySetLocale(locale);
    return this;
  }

  creationData(): Record<string, unknown> {
    const loc = this._getLocale();
    const result: Record<string, unknown> = {
      input: this._i,
      format: this._f,
      locale: loc,
      isUTC: this._isUTC,
      strict: this._strict || false,
    };
    return result;
  }

  parsingFlags(): object {
    const result: Record<string, unknown> = {
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
    if (this._invalidEra !== undefined) {result.invalidEra = this._invalidEra;}
    if (this._tooBusyWith !== undefined) {result.tooBusyWith = this._tooBusyWith;}
    return result;
  }

  isDSTShifted(): boolean {
    return false;
  }

  hasAlignedHourOffset(other?: MomentInput): boolean {
    if (!this._isValid) {return false;}
    const otherOffset = other ? momentFromAnything(other).utcOffset() : 0;
    return ((this.utcOffset() as number) - (otherOffset as number)) % 60 === 0;
  }

  invalidAt(): number {
    let overflow = this._overflow;
    if (overflow === undefined || overflow < 0) {return -1;}
    return overflow;
  }

  isBefore(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) {return false;}
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
    if (!this._isValid || !other._isValid) {return false;}
    if (unit) {
      return this._compareCalendarValues(other, unit) > 0;
    }
    return this.valueOf() > other.valueOf();
  }

  private _updateOffset(keepTime?: boolean): void {
    if (typeof updateOffsetCallback === "function") {
      (updateOffsetCallback as Function)(this, keepTime);
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
      return cold ? (cold as Record<string, unknown>)[key] : undefined;
    },
    set(v: unknown) {
      const m = this as Moment;
      if (v !== undefined) {
        if (!m._cold) {m._cold = {};}
        (m._cold as Record<string, unknown>)[key] = v;
      }
    },
    enumerable: true,
    configurable: true,
  });
}

export let nowFn: (() => number) | undefined = Date.now;

export function checkOverflow(parsed: Record<string, unknown>): number {
  if (parsed.month !== undefined && (parsed.month < 0 || parsed.month > 11)) {return 1;}
  if (parsed.day !== undefined) {
    const maxDay = daysInMonth(
      parsed.year !== undefined ? parsed.year : 2000,
      parsed.month !== undefined ? parsed.month : 0,
    );
    if (parsed.day < 1 || parsed.day > maxDay) {return 2;}
  }
  if (parsed.hour !== undefined && (parsed.hour < 0 || parsed.hour > 24)) {return 3;}
  if (parsed.hour === 24 && (parsed.minute || parsed.second || parsed.millisecond)) {return 3;}
  if (parsed.minute !== undefined && (parsed.minute < 0 || parsed.minute > 59)) {return 4;}
  if (parsed.second !== undefined && (parsed.second < 0 || parsed.second > 59)) {return 5;}
  if (parsed.millisecond !== undefined && (parsed.millisecond < 0 || parsed.millisecond > 999))
    {return 6;}
  if (parsed.isoWeek !== undefined && parsed.isoWeekYear !== undefined) {
    const maxWeek = weeksInYear(parsed.isoWeekYear, 1, 4, true);
    if (parsed.isoWeek < 1 || parsed.isoWeek > maxWeek) {return 7;}
  }
  if (parsed._weekYear !== undefined && parsed._week !== undefined && parsed.month === undefined) {
    if (parsed._week < 1) {return 7;}
  }
  if (parsed._localeWeekday !== undefined) {
    if (parsed._localeWeekday < 0 || parsed._localeWeekday > 6) {return 8;}
  }
  if (parsed._weekdayNum !== undefined) {
    if (parsed.isoWeek !== undefined) {
      if (parsed._weekdayNum < 1 || parsed._weekdayNum > 7) {return 8;}
    } else if (parsed._localeWeekday === undefined) {
      if (parsed._weekdayNum < 0 || parsed._weekdayNum > 6) {return 8;}
    }
  }
  return -1;
}

function hasAnyValue(parsed: Record<string, unknown>): boolean {
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
  if (!match) {return NaN;}
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
}

export function momentFromAnything(input: unknown, isUTC?: boolean): Moment {
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
    if (isUTC) {m.utc();}
    return m;
  }
  if (input === undefined || input === null) {
    const m = new Moment({ _d: new Date(nowFn ? nowFn() : Date.now()), _dClone: false });
    if (isUTC) {m.utc();}
    return m;
  }
  if (typeof input === "string") {
    const parsed = parseString(input);
    if (parsed && hasAnyValue(parsed)) {
      const m = new Moment({ _d: createDateSafe(parsed.year || 0, parsed.month || 0, parsed.day || 1, parsed.hour || 0, parsed.minute || 0, parsed.second || 0, parsed.millisecond || 0, false), _i: input, _dClone: false });
      if (isUTC) {m.utc();}
      return m;
    }
    const m = new Moment({ _d: new Date(input), _i: input, _dClone: false });
    if (isUTC) {m.utc();}
    return m;
  }
  if (typeof input === "number") {
    const m = new Moment({ _d: new Date(input), _dClone: false });
    if (isUTC) {m.utc();}
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
    const obj = input as Record<string, unknown>;
    const parsed = parseObject(obj);
    if (parsed && (parsed.year !== undefined || parsed.month !== undefined || parsed.day !== undefined)) {
      const now = new Date();
      const y = parsed.year !== undefined ? parsed.year : now.getFullYear();
      const mo = parsed.month !== undefined ? parsed.month : 0;
      const d = parsed.day !== undefined ? parsed.day : 1;
      const h = parsed.hour !== undefined ? parsed.hour : 0;
      const min = parsed.minute !== undefined ? parsed.minute : 0;
      const s = parsed.second !== undefined ? parsed.second : 0;
      const ms = parsed.millisecond !== undefined ? parsed.millisecond : 0;
      return new Moment({ _d: new Date(y, mo, d, h, min, s, ms), _i: input, _dClone: false });
    }
    const m = new Moment(input);
    if (isUTC) {m.utc();}
    return m;
  }
  return new Moment({ _d: new Date(NaN), _dClone: false, _isValid: false });
}

function parseDurationNumUnit(amount: number, unit: string): { ms: number; days: number; months: number } {
  const u = normalizeUnits(unit);
  if (!u) {return { ms: 0, days: 0, months: 0 };}
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
