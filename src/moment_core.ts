import type { Locale } from "./locale-runtime";
import { getLiteCurrentLocale, getLiteLocale, hasLiteLocale } from "./locale-lite";
import {
  isArray,
  isObject,
  isDate,
  isMoment,
  hasOwnProp,
  zeroFill,
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
import { parseString, parseArray, parseObject, type ParsedData } from "./parse";
import type { FormattableMoment } from "./display/types";
import type { ParseLocale } from "./parse-locale";

export let momentProperties: string[] = [];

let updateOffsetCallback: ((m: Moment) => void) | undefined;
let formatMomentCallback: ((m: FormattableMoment, format: string) => string) | undefined;
let fromNowCallback: ((m: Moment, pref?: boolean) => string) | undefined;
let fromCallback: ((m: Moment, input: MomentInput, pref?: boolean) => string) | undefined;
let toNowCallback: ((m: Moment, pref?: boolean) => string) | undefined;
let toCallback: ((m: Moment, input: MomentInput, pref?: boolean) => string) | undefined;
let calendarCallback: ((m: Moment, ref?: MomentInput, opts?: object) => string) | undefined;
let addCallback: ((m: Moment, amount: number | string | object, unit?: string) => { ms: number; days: number; months: number } | null) | undefined;
let getCurrentLocaleCallback: (() => string) | undefined;
let getLocaleCallback: ((name?: string) => Locale) | undefined;
let hasLocaleCallback: ((name: string) => boolean) | undefined;
let weekdayCallback: ((m: Moment, d?: number) => number | Moment) | undefined;
let weekCallback: ((m: Moment, w?: number) => number | Moment) | undefined;
let weekYearCallback: ((m: Moment, y?: number) => number | Moment) | undefined;
let weeksInYearCallback: ((m: Moment) => number) | undefined;
let weeksInWeekYearCallback: ((m: Moment) => number) | undefined;
let isoWeekdayCallback: ((m: Moment, d?: unknown) => number | Moment) | undefined;
let dayOfYearCallback: ((m: Moment, d?: number) => number | Moment) | undefined;
let isoWeekCallback: ((m: Moment, w?: number) => number | Moment) | undefined;
let isoWeekYearCallback: ((m: Moment, y?: number) => number | Moment) | undefined;
let isoWeeksInYearCallback: ((m: Moment) => number) | undefined;
let isoWeeksInISOWeekYearCallback: ((m: Moment) => number) | undefined;
let calendarCompareCallback: ((left: Moment, right: Moment, unit: string) => number) | undefined;
let startOfExtraCallback: ((m: Moment, code: number) => void) | undefined;
let endOfExtraCallback: ((m: Moment, code: number) => void) | undefined;
let toArrayCallback: ((m: Moment) => number[]) | undefined;
let inspectCallback: ((m: Moment) => string) | undefined;
let creationDataCallback: ((m: Moment) => Record<string, unknown>) | undefined;
let parsingFlagsCallback: ((m: Moment) => Record<string, unknown>) | undefined;
let invalidAtCallback: ((m: Moment) => number) | undefined;
let toObjectCallback: ((m: Moment) => Record<string, number>) | undefined;
let toStringCallback: ((m: Moment) => string) | undefined;
let localeDataCallback: ((m: Moment) => Locale) | undefined;
let langCallback: ((m: Moment, locale: string | string[] | false | undefined, getCurrentLocale: () => string) => string | Moment) | undefined;
let localeCallback: ((m: Moment, locale: string | string[] | false | undefined, getCurrentLocale: () => string) => string | Moment) | undefined;
let localCallback: ((m: Moment, keepLocalTime?: boolean) => Moment) | undefined;
let utcCallback: ((m: Moment, keepLocalTime?: boolean) => Moment) | undefined;
let utcOffsetMethodCallback: ((m: Moment, offset?: number | string, keepLocalTime?: boolean) => number | Moment) | undefined;
let parseZoneCallback: ((m: Moment, input?: unknown, format?: unknown) => Moment) | undefined;
let zoneCallback: ((m: Moment, offset?: number | string, keepLocalTime?: boolean) => number | Moment) | undefined;
let zoneAbbrCallback: ((m: Moment) => string) | undefined;
let zoneNameCallback: ((m: Moment) => string) | undefined;
let isLocalCallback: ((m: Moment) => boolean) | undefined;
let isUtcCallback: ((m: Moment) => boolean) | undefined;
let isUtcOffsetCallback: ((m: Moment) => boolean) | undefined;
let isDSTCallback: ((m: Moment) => boolean) | undefined;
let hasAlignedHourOffsetCallback: ((m: Moment, other?: MomentInput) => boolean) | undefined;

export { getRelTimeRounding, setRelTimeRounding, getRelTimeThreshold, setRelTimeThreshold } from "./reltime";

export function setUpdateOffsetCallback(cb: ((m: Moment) => void) | undefined): void {
  updateOffsetCallback = cb;
}

export function getUpdateOffsetCallback(): ((m: Moment) => void) | undefined {
  return updateOffsetCallback;
}

export function setFormatMomentCallback(
  cb: ((m: FormattableMoment, format: string) => string) | undefined,
): void {
  formatMomentCallback = cb;
}

export function getFormatMomentCallback():
  | ((m: FormattableMoment, format: string) => string)
  | undefined {
  return formatMomentCallback;
}

export function setDisplayExtraCallbacks(callbacks: {
  fromNow?: ((m: Moment, pref?: boolean) => string) | undefined;
  from?: ((m: Moment, input: MomentInput, pref?: boolean) => string) | undefined;
  toNow?: ((m: Moment, pref?: boolean) => string) | undefined;
  to?: ((m: Moment, input: MomentInput, pref?: boolean) => string) | undefined;
  calendar?: ((m: Moment, ref?: MomentInput, opts?: object) => string) | undefined;
}): void {
  fromNowCallback = callbacks.fromNow;
  fromCallback = callbacks.from;
  toNowCallback = callbacks.toNow;
  toCallback = callbacks.to;
  calendarCallback = callbacks.calendar;
}

export function setAddCallback(
  cb: ((m: Moment, amount: number | string | object, unit?: string) => { ms: number; days: number; months: number } | null) | undefined,
): void {
  addCallback = cb;
}

export function setLocaleRuntimeCallbacks(callbacks: {
  getCurrentLocale?: (() => string) | undefined;
  getLocale?: ((name?: string) => Locale) | undefined;
  hasLocale?: ((name: string) => boolean) | undefined;
}): void {
  getCurrentLocaleCallback = callbacks.getCurrentLocale;
  getLocaleCallback = callbacks.getLocale;
  hasLocaleCallback = callbacks.hasLocale;
}

export function setLocaleMethodCallbacks(callbacks: {
  weekday?: ((m: Moment, d?: number) => number | Moment) | undefined;
  week?: ((m: Moment, w?: number) => number | Moment) | undefined;
  weekYear?: ((m: Moment, y?: number) => number | Moment) | undefined;
  weeksInYear?: ((m: Moment) => number) | undefined;
  weeksInWeekYear?: ((m: Moment) => number) | undefined;
  localeData?: ((m: Moment) => Locale) | undefined;
  lang?: ((m: Moment, locale: string | string[] | false | undefined, getCurrentLocale: () => string) => string | Moment) | undefined;
  locale?: ((m: Moment, locale: string | string[] | false | undefined, getCurrentLocale: () => string) => string | Moment) | undefined;
}): void {
  weekdayCallback = callbacks.weekday;
  weekCallback = callbacks.week;
  weekYearCallback = callbacks.weekYear;
  weeksInYearCallback = callbacks.weeksInYear;
  weeksInWeekYearCallback = callbacks.weeksInWeekYear;
  localeDataCallback = callbacks.localeData;
  langCallback = callbacks.lang;
  localeCallback = callbacks.locale;
}

export function setCalendarMethodCallbacks(callbacks: {
  isoWeekday?: ((m: Moment, d?: unknown) => number | Moment) | undefined;
  dayOfYear?: ((m: Moment, d?: number) => number | Moment) | undefined;
  isoWeek?: ((m: Moment, w?: number) => number | Moment) | undefined;
  isoWeekYear?: ((m: Moment, y?: number) => number | Moment) | undefined;
  isoWeeksInYear?: ((m: Moment) => number) | undefined;
  isoWeeksInISOWeekYear?: ((m: Moment) => number) | undefined;
  compare?: ((left: Moment, right: Moment, unit: string) => number) | undefined;
  startOfExtra?: ((m: Moment, code: number) => void) | undefined;
  endOfExtra?: ((m: Moment, code: number) => void) | undefined;
}): void {
  isoWeekdayCallback = callbacks.isoWeekday;
  dayOfYearCallback = callbacks.dayOfYear;
  isoWeekCallback = callbacks.isoWeek;
  isoWeekYearCallback = callbacks.isoWeekYear;
  isoWeeksInYearCallback = callbacks.isoWeeksInYear;
  isoWeeksInISOWeekYearCallback = callbacks.isoWeeksInISOWeekYear;
  calendarCompareCallback = callbacks.compare;
  startOfExtraCallback = callbacks.startOfExtra;
  endOfExtraCallback = callbacks.endOfExtra;
}

export function setDebugMethodCallbacks(callbacks: {
  toArray?: ((m: Moment) => number[]) | undefined;
  inspect?: ((m: Moment) => string) | undefined;
  creationData?: ((m: Moment) => Record<string, unknown>) | undefined;
  parsingFlags?: ((m: Moment) => Record<string, unknown>) | undefined;
  invalidAt?: ((m: Moment) => number) | undefined;
  toObject?: ((m: Moment) => Record<string, number>) | undefined;
  toString?: ((m: Moment) => string) | undefined;
}): void {
  toArrayCallback = callbacks.toArray;
  inspectCallback = callbacks.inspect;
  creationDataCallback = callbacks.creationData;
  parsingFlagsCallback = callbacks.parsingFlags;
  invalidAtCallback = callbacks.invalidAt;
  toObjectCallback = callbacks.toObject;
  toStringCallback = callbacks.toString;
}

export function setUtcMethodCallbacks(callbacks: {
  local?: ((m: Moment, keepLocalTime?: boolean) => Moment) | undefined;
  utc?: ((m: Moment, keepLocalTime?: boolean) => Moment) | undefined;
  utcOffset?: ((m: Moment, offset?: number | string, keepLocalTime?: boolean) => number | Moment) | undefined;
  parseZone?: ((m: Moment, input?: unknown, format?: unknown) => Moment) | undefined;
  zone?: ((m: Moment, offset?: number | string, keepLocalTime?: boolean) => number | Moment) | undefined;
  zoneAbbr?: ((m: Moment) => string) | undefined;
  zoneName?: ((m: Moment) => string) | undefined;
  isLocal?: ((m: Moment) => boolean) | undefined;
  isUtc?: ((m: Moment) => boolean) | undefined;
  isUtcOffset?: ((m: Moment) => boolean) | undefined;
  isDST?: ((m: Moment) => boolean) | undefined;
  hasAlignedHourOffset?: ((m: Moment, other?: MomentInput) => boolean) | undefined;
}): void {
  localCallback = callbacks.local;
  utcCallback = callbacks.utc;
  utcOffsetMethodCallback = callbacks.utcOffset;
  parseZoneCallback = callbacks.parseZone;
  zoneCallback = callbacks.zone;
  zoneAbbrCallback = callbacks.zoneAbbr;
  zoneNameCallback = callbacks.zoneName;
  isLocalCallback = callbacks.isLocal;
  isUtcCallback = callbacks.isUtc;
  isUtcOffsetCallback = callbacks.isUtcOffset;
  isDSTCallback = callbacks.isDST;
  hasAlignedHourOffsetCallback = callbacks.hasAlignedHourOffset;
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
  _isValid?: boolean;
  _isUTC?: boolean;
  _offset?: number;
  _t?: number;
  _i?: unknown;
  _f?: string | string[] | undefined;
  _l?: string;
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
  _userInvalidated?: boolean;
  _iso?: boolean;
  _rfc2822?: boolean;
  _weekdayMismatch?: boolean;
  _bigHour?: boolean;
  _meridiem?: string;
  _isParseZone?: boolean;
  _invalidEra?: number;
  _tooBusyWith?: string;
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

enum DMethod {
  FullYear, Month, Date, Day, Hours, Minutes, Seconds, Milliseconds,
}

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

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
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
  _userInvalidated?: boolean;
  _rfc2822?: boolean;
  _bigHour?: boolean;
  _meridiem?: string;
  _isParseZone?: boolean;
  _invalidEra?: number;
  _tooBusyWith?: string;
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
  declare _strict: boolean;
  declare _overflow: number | undefined;
  declare _parsedDateParts: number[] | undefined;
  declare _unusedTokens: string[] | undefined;
  declare _unusedInput: string[] | undefined;
  declare _charsLeftOver: number | undefined;
  declare _empty: boolean | undefined;
  declare _nullInput: boolean | undefined;
  declare _invalidMonth: string | null | undefined;
  declare _invalidFormat: boolean | undefined;
  declare _weekdayMismatch: boolean | undefined;
  declare _iso: boolean | undefined;
  declare _rfc2822: boolean | undefined;
  declare _invalidEra: number | undefined;
  declare _bigHour: boolean | undefined;
  declare _meridiem: string | undefined;
  declare _isParseZone: boolean | undefined;
  declare _userInvalidated: boolean | undefined;
  declare _tooBusyWith: string | undefined;

  _locale: Locale | undefined;
  _dirty: boolean;

  // Decomposed Date cache (Day.js style)
  $y = 0; $M = 0; $D = 0; $W = 0;
  $H = 0; $m = 0; $s = 0; $ms = 0;

  static _epochDaysToYMD(z: number): [number, number, number] {
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

  _ensureFields(): void {
    if (this._dirty) {
      this._dirty = false;
      this._refreshFields();
    }
  }

  _getD(): Date {
    this._ensureFields();
    if (this._d) {return this._d;}
    this._d = new Date(this._t);
    return this._d;
  }

  _refreshFields(): void {
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
        const totalSec = Math.floor(t / 1000);
        this.$W = ((totalDays + 4) % 7 + 7) % 7;
        const [y, M, D] = Moment._epochDaysToYMD(totalDays);
        this.$y = y; this.$M = M; this.$D = D;
        this.$H = ((Math.floor(totalSec / 3600) % 24) + 24) % 24;
        this.$m = ((Math.floor(totalSec / 60) % 60) + 60) % 60;
        this.$s = ((totalSec % 60) + 60) % 60;
        this.$ms = ((t % 1000) + 1000) % 1000;
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
    const c = config;
    this._isAMomentObject = true;
    this._l = c._l ?? (getCurrentLocaleCallback ? getCurrentLocaleCallback() : getLiteCurrentLocale());
    this._isUTC = c._isUTC ?? false;
    this._offset = c._offset ?? 0;
    if (c._d) {
      this._d = c._dClone === false ? c._d : new Date(c._d);
      this._t = this._d.getTime();
    } else if (c._t !== undefined) {
      this._t = c._t;
      this._d = undefined;
    } else {
      this._t = Date.now();
      this._d = undefined;
    }
    this._isValid = c._isValid ?? !isNaN(this._t);
    this._dirty = this._isValid;
    if (c._i !== undefined) {this._i = c._i;}
    if (c._f !== undefined) {this._f = c._f;}
    if (c._strict !== undefined) {this._strict = c._strict;}
    if (c._overflow !== undefined || c._empty !== undefined || c._nullInput !== undefined ||
        c._invalidMonth !== undefined || c._invalidFormat !== undefined ||
        c._weekdayMismatch !== undefined || c._userInvalidated !== undefined ||
        c._parsedDateParts !== undefined) {
      this._initCold(c);
    }
  }

  _initCold(c: MomentConfig): void {
    const hasErrorCold =
      (c._overflow !== undefined && c._overflow >= 0) ||
      c._empty === true ||
      c._nullInput === true ||
      (c._invalidMonth !== undefined && c._invalidMonth !== null) ||
      c._invalidFormat === true ||
      c._weekdayMismatch === true ||
      c._userInvalidated === true;
    if (hasErrorCold || c._unusedTokens !== undefined || c._unusedInput !== undefined ||
        c._charsLeftOver !== undefined || c._invalidEra !== undefined || c._iso !== undefined ||
        c._rfc2822 !== undefined || c._bigHour !== undefined || c._meridiem !== undefined ||
        c._isParseZone !== undefined || c._tooBusyWith !== undefined || c._parsedDateParts !== undefined) {
      const cold: Record<string, unknown> = {};
      if (c._overflow !== undefined) {cold._overflow = c._overflow;}
      if (c._parsedDateParts !== undefined) {cold._parsedDateParts = c._parsedDateParts;}
      if (c._unusedTokens !== undefined) {cold._unusedTokens = c._unusedTokens;}
      if (c._unusedInput !== undefined) {cold._unusedInput = c._unusedInput;}
      if (c._charsLeftOver !== undefined) {cold._charsLeftOver = c._charsLeftOver;}
      if (c._empty !== undefined) {cold._empty = c._empty;}
      if (c._nullInput !== undefined) {cold._nullInput = c._nullInput;}
      if (c._invalidMonth !== undefined) {cold._invalidMonth = c._invalidMonth;}
      if (c._invalidFormat !== undefined) {cold._invalidFormat = c._invalidFormat;}
      if (c._weekdayMismatch !== undefined) {cold._weekdayMismatch = c._weekdayMismatch;}
      if (c._iso !== undefined) {cold._iso = c._iso;}
      if (c._rfc2822 !== undefined) {cold._rfc2822 = c._rfc2822;}
      if (c._invalidEra !== undefined) {cold._invalidEra = c._invalidEra;}
      if (c._bigHour !== undefined) {cold._bigHour = c._bigHour;}
      if (c._meridiem !== undefined) {cold._meridiem = c._meridiem;}
      if (c._isParseZone !== undefined) {cold._isParseZone = c._isParseZone;}
      if (c._userInvalidated !== undefined) {cold._userInvalidated = c._userInvalidated;}
      if (c._tooBusyWith !== undefined) {cold._tooBusyWith = c._tooBusyWith;}
      this._cold = cold;
      if (hasErrorCold) {this._dirty = false;}
    }
  }

  _getLocale(): Locale {
    this._locale ??= (getLocaleCallback ? getLocaleCallback(this._l) : getLiteLocale(this._l));
    return this._locale;
  }

  _gdt(method: DMethod): number {
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

  _sdt(method: DMethod, value: number): void {
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

  clone(): this {
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
    m._strict = this._strict;
    this._ensureFields();
    m.$y = this.$y; m.$M = this.$M; m.$D = this.$D; m.$W = this.$W;
    m.$H = this.$H; m.$m = this.$m; m.$s = this.$s; m.$ms = this.$ms;
    m._dirty = false;
    return m as this;
  }

  year(): number;
  year(y: unknown): this;
  year(y?: unknown): number | this {
    if (y !== undefined) {
      if (
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
      this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
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
  month(m: unknown): this;
  month(m?: unknown): number | this {
    this._ensureFields();
    if (m !== undefined) {
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
      this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$M;
  }

  date(): number;
  date(d: unknown): this;
  date(d?: unknown): number | this {
    if (d !== undefined) {
      if (
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
      this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
      this._t = this._getD().getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$D;
  }

  day(): number;
  day(d: unknown): this;
  day(d?: unknown): number | this {
    this._ensureFields();
    if (d !== undefined) {
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
      this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
      this._t = dt.getTime();
      this._updateOffset(true);
      return this;
    }
    if (!this._isValid) {return NaN;}
    this._ensureFields();
    return this.$W;
  }

  weekday(): number;
  weekday(d: number): this;
  weekday(d?: number): number | this {
    if (!weekdayCallback) {throw new Error("mmntjs weekday() is not initialized");}
    return weekdayCallback(this, d) as number | this;
  }

  isoWeekday(): number;
  isoWeekday(d: unknown): this;
  isoWeekday(d?: unknown): number | this {
    if (!isoWeekdayCallback) {throw new Error("mmntjs isoWeekday() is not initialized");}
    return isoWeekdayCallback(this, d) as number | this;
  }

  dayOfYear(): number;
  dayOfYear(d: number): this;
  dayOfYear(d?: number): number | this {
    if (!dayOfYearCallback) {throw new Error("mmntjs dayOfYear() is not initialized");}
    return dayOfYearCallback(this, d) as number | this;
  }

  hour(): number;
  hour(h: unknown): this;
  hour(h?: unknown): number | this {
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
  minute(m: unknown): this;
  minute(m?: unknown): number | this {
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
  second(s: unknown): this;
  second(s?: unknown): number | this {
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
  millisecond(ms: unknown): this;
  millisecond(ms?: unknown): number | this {
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
  get(unit: object): this;
  get(unit: string | object): number | this {
    if (isObject(unit)) {return this;}
    const u = normalizeUnits(unit as string);
    if (!u) {return NaN;}
    switch (u) {
      case "year":
        return this.year();
      case "month":
        return this.month();
      case "date":
        return this.date();
      case "day":
        return this.day();
      case "hour":
        return this.hour();
      case "minute":
        return this.minute();
      case "second":
        return this.second();
      case "millisecond":
        return this.millisecond();
      case "weekday":
        return this.weekday();
      case "isoWeekday":
        return this.isoWeekday();
      case "dayOfYear":
        return this.dayOfYear();
      case "week":
        return this.week();
      case "isoWeek":
        return this.isoWeek();
      default:
        return NaN;
    }
  }

  set(unit: string | object, value?: number): this {
    if (isObject(unit)) {
      this._ensureFields();
      const obj = unit;

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

        const newYear = yearVal ?? curYear;
        const newMonth = monthVal ?? curMonth;
        const newDate = dateVal ?? curDate;
        const newHour = hourVal ?? curHour;
        const newMinute = minuteVal ?? curMinute;
        const newSecond = secondVal ?? curSecond;
        const newMs = msVal ?? curMs;

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
          this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
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
          this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
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
        this.weekYear(obj.weekYear as number);
      }
      if (hasOwnProp(obj, "week")) {
        this.week(obj.week as number);
      }
      if (hasOwnProp(obj, "isoWeekYear")) {
        this.isoWeekYear(obj.isoWeekYear as number);
      }
      if (hasOwnProp(obj, "isoWeek")) {
        this.isoWeek(obj.isoWeek as number);
      }
      if (hasOwnProp(obj, "weekday")) {
        this.weekday(obj.weekday as number);
      }
      if (hasOwnProp(obj, "isoWeekday")) {
        this.isoWeekday(obj.isoWeekday as number);
      }
      if (hasOwnProp(obj, "dayOfYear")) {
        this.dayOfYear(obj.dayOfYear as number);
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

  _addSimple(amount: number, unit: number): void {
    let changedDays = false;

    switch (unit) {
      case YEAR:
      case QUARTER:
      case MONTH: {
        changedDays = true;
        this._ensureFields();
        const rawMonths = unit === YEAR ? amount * 12 : unit === QUARTER ? amount * 3 : amount;
        const totalMonths = Number.isInteger(rawMonths) ? rawMonths : (rawMonths < 0 ? Math.round(rawMonths * -1) * -1 : Math.round(rawMonths));
        const tm = this.$y * 12 + this.$M + totalMonths;
        const y = Math.floor(tm / 12);
        const m = ((tm % 12) + 12) % 12;
        let d_ = this.$D;
        if (d_ > 28) {
          const _md = m === 1
            ? (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28)
            : (m === 3 || m === 5 || m === 8 || m === 10 ? 30 : 31);
          if (d_ > _md) {d_ = _md;}
        }
        if (this._isUTC) {
          this._t = Date.UTC(y, m, d_, this.$H, this.$m, this.$s, this.$ms);
          this._d = undefined;
          this._dirty = true;
        } else {
          const dt = this._d ?? (this._d = new Date(this._t));
          dt.setFullYear(y, m, d_);
          this._t = dt.getTime();
        }
        this.$y = y;
        this.$M = m;
        this.$D = d_;
        this.$W = this._isUTC ? _dayOfWeek(y, m, d_) : this._d!.getDay();
        break;
      }
      case ISO_WEEK:
      case WEEK:
      case DAY:
      case DATE: {
        changedDays = true;
        const raw = (unit === WEEK || unit === ISO_WEEK) ? amount * 7 : amount;
        const rounded = Number.isInteger(raw) ? raw : (raw < 0 ? Math.round(raw * -1) * -1 : Math.round(raw));
        if (rounded !== 0) {
          if (this._isUTC) {
            this._t += rounded * 86400000;
            this._d = undefined;
            this._dirty = true;
          } else {
            const dt = this._d ?? (this._d = new Date(this._t));
            dt.setDate(dt.getDate() + rounded);
            this._t = dt.getTime();
            this.$y = dt.getFullYear();
            this.$M = dt.getMonth();
            this.$D = dt.getDate();
            this.$W = dt.getDay();
            this._offset = -dt.getTimezoneOffset();
          }
        }
        break;
      }
      case HOUR: {
        const dt = this._d ?? (this._d = new Date(this._t));
        dt.setTime(dt.getTime() + Math.round(amount * 3600000));
        this._t = dt.getTime();
        this._refreshFields();
        break;
      }
      case MINUTE: {
        const dt = this._d ?? (this._d = new Date(this._t));
        dt.setTime(dt.getTime() + Math.round(amount * 60000));
        this._t = dt.getTime();
        this._refreshFields();
        break;
      }
      case SECOND: {
        const dt = this._d ?? (this._d = new Date(this._t));
        dt.setTime(dt.getTime() + Math.round(amount * 1000));
        this._t = dt.getTime();
        this._refreshFields();
        break;
      }
      case MILLISECOND: {
        const dt = this._d ?? (this._d = new Date(this._t));
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

  _parseDurationInput(
    amount: number | string | object,
    unit?: string,
  ): { ms: number; days: number; months: number } | null {
    if (!addCallback) {return null;}
    return addCallback(this, amount, unit);
  }

  _applyDuration(ms: number, days: number, months: number, sign: 1 | -1): void {
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

  add(amount: number | string | object, unit?: string): this {
    if (!this._isValid) {return this;}
    const parsed = this._parseDurationInput(amount, unit);
    if (!parsed) {return this;}
    this._applyDuration(parsed.ms, parsed.days, parsed.months, 1);
    return this;
  }

  subtract(amount: number | string | object, unit?: string): this {
    if (!this._isValid) {return this;}
    const parsed = this._parseDurationInput(amount, unit);
    if (!parsed) {return this;}
    this._applyDuration(parsed.ms, parsed.days, parsed.months, -1);
    return this;
  }

  startOf(unit: string): this {
    const code = normalizeUnitCode(unit);
    if (code < 0) {return this;}
    this._ensureFields();
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
    const utc = this._isUTC;

    switch (code) {
      case YEAR:
        if (utc) { d.setUTCMonth(0); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); }
        else { d.setDate(1); d.setMonth(0); d.setHours(0, 0, 0, 0); }
        this.$M = 0; this.$D = 1;
        this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
        this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
        break;
      case MONTH:
        if (utc) { d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); }
        else { d.setDate(1); d.setHours(0, 0, 0, 0); }
        this.$D = 1;
        this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
        this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
        break;
      case QUARTER:
      case WEEK:
      case ISO_WEEK:
        if (!startOfExtraCallback) {throw new Error("mmntjs startOf extra units are not initialized");}
        startOfExtraCallback(this, code);
        break;
      case DATE:
      case DAY:
        if (utc) { d.setUTCHours(0, 0, 0, 0); }
        else { d.setHours(0, 0, 0, 0); }
        this.$H = 0; this.$m = 0; this.$s = 0; this.$ms = 0;
        break;
      case HOUR:
        if (utc) { d.setUTCMinutes(0, 0, 0); }
        else { d.setMinutes(0, 0, 0); }
        this.$m = 0; this.$s = 0; this.$ms = 0;
        break;
      case MINUTE:
        if (utc) { d.setUTCSeconds(0, 0); }
        else { d.setSeconds(0, 0); }
        this.$s = 0; this.$ms = 0;
        break;
      case SECOND:
        if (utc) { d.setUTCMilliseconds(0); }
        else { d.setMilliseconds(0); }
        this.$ms = 0;
        break;
    }

    this._t = d.getTime();
    if (!utc) {this._offset = -d.getTimezoneOffset();}
    this._updateOffset(true);
    return this;
  }

  endOf(unit: string): this {
    const code = normalizeUnitCode(unit);
    if (code < 0) {return this;}
    this._ensureFields();
    const d = this._getD();
    const utc = this._isUTC;

    switch (code) {
      case YEAR:
        if (utc) { d.setTime(Date.UTC(this.$y, 11, 31, 23, 59, 59, 999)); }
        else { d.setFullYear(this.$y, 11, 31); d.setHours(23, 59, 59, 999); }
        this.$M = 11; this.$D = 31;
        this.$H = 23; this.$m = 59; this.$s = 59; this.$ms = 999;
        this.$W = _dayOfWeek(this.$y, 11, 31);
        break;
      case MONTH: {
        const _eomMaxDay = daysInMonth(this.$y, this.$M);
        if (utc) { d.setTime(Date.UTC(this.$y, this.$M, _eomMaxDay, 23, 59, 59, 999)); }
        else { d.setFullYear(this.$y, this.$M, _eomMaxDay); d.setHours(23, 59, 59, 999); }
        this.$D = _eomMaxDay;
        this.$H = 23; this.$m = 59; this.$s = 59; this.$ms = 999;
        this.$W = _dayOfWeek(this.$y, this.$M, _eomMaxDay);
        break;
      }
      case QUARTER:
      case WEEK:
      case ISO_WEEK:
        if (!endOfExtraCallback) {throw new Error("mmntjs endOf extra units are not initialized");}
        endOfExtraCallback(this, code);
        break;
      case DATE:
      case DAY:
        if (utc) { d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()+1); d.setUTCMilliseconds(-1); }
        else { d.setHours(0,0,0,0); d.setDate(d.getDate()+1); d.setMilliseconds(-1); }
        this.$D = utc ? d.getUTCDate() : d.getDate();
        this.$H = utc ? d.getUTCHours() : d.getHours();
        this.$m = utc ? d.getUTCMinutes() : d.getMinutes();
        this.$s = utc ? d.getUTCSeconds() : d.getSeconds();
        this.$ms = utc ? d.getUTCMilliseconds() : d.getMilliseconds();
        this.$W = _dayOfWeek(this.$y, this.$M, this.$D);
        break;
      case HOUR:
        if (utc) { d.setUTCMinutes(0,0,0); d.setUTCHours(d.getUTCHours()+1,0,0,-1); }
        else { d.setMinutes(0,0,0); d.setHours(d.getHours()+1,0,0,-1); }
        this.$H = utc ? d.getUTCHours() : d.getHours();
        this.$m = utc ? d.getUTCMinutes() : d.getMinutes();
        this.$s = utc ? d.getUTCSeconds() : d.getSeconds();
        this.$ms = utc ? d.getUTCMilliseconds() : d.getMilliseconds();
        break;
      case MINUTE:
        if (utc) { d.setUTCSeconds(0,0); d.setUTCMinutes(d.getUTCMinutes()+1,0,-1); }
        else { d.setSeconds(0,0); d.setMinutes(d.getMinutes()+1,0,-1); }
        this.$m = utc ? d.getUTCMinutes() : d.getMinutes();
        this.$s = utc ? d.getUTCSeconds() : d.getSeconds();
        this.$ms = utc ? d.getUTCMilliseconds() : d.getMilliseconds();
        break;
      case SECOND:
        if (utc) { d.setUTCSeconds(d.getUTCSeconds()+1,-1); }
        else { d.setSeconds(d.getSeconds()+1,-1); }
        this.$s = utc ? d.getUTCSeconds() : d.getSeconds();
        this.$ms = utc ? d.getUTCMilliseconds() : d.getMilliseconds();
        break;
    }

    this._t = d.getTime();
    if (!utc) {this._offset = -d.getTimezoneOffset();}
    this._updateOffset(true);
    return this;
  }

  local(keepLocalTime?: boolean): this {
    if (!localCallback) {throw new Error("mmntjs local() is not initialized");}
    return localCallback(this, keepLocalTime) as this;
  }

  utc(keepLocalTime?: boolean): this {
    if (!utcCallback) {throw new Error("mmntjs utc() is not initialized");}
    return utcCallback(this, keepLocalTime) as this;
  }

  utcOffset(): number;
  utcOffset(offset: number | string, keepLocalTime?: boolean): this;
  utcOffset(offset?: number | string, keepLocalTime?: boolean): number | this {
    if (!utcOffsetMethodCallback) {throw new Error("mmntjs utcOffset() is not initialized");}
    return utcOffsetMethodCallback(this, offset, keepLocalTime) as number | this;
  }

  format(format?: string): string {
    if (!format) {
      if (this._isUTC && this._offset === 0) {
        format = "YYYY-MM-DDTHH:mm:ss[Z]";
      } else {
        format = "YYYY-MM-DDTHH:mm:ssZ";
      }
    }
    const formatter = formatMomentCallback;
    if (!formatter) {throw new Error("mmntjs formatter is not initialized");}
    return formatter(this as unknown as FormattableMoment, format);
  }

  fromNow(pref?: boolean): string {
    if (!fromNowCallback) {throw new Error("mmntjs fromNow() is not initialized");}
    return fromNowCallback(this, pref);
  }

  from(input: MomentInput, pref?: boolean): string {
    if (!fromCallback) {throw new Error("mmntjs from() is not initialized");}
    return fromCallback(this, input, pref);
  }

  toNow(pref?: boolean): string {
    if (!toNowCallback) {throw new Error("mmntjs toNow() is not initialized");}
    return toNowCallback(this, pref);
  }

  to(input: MomentInput, pref?: boolean): string {
    if (!toCallback) {throw new Error("mmntjs to() is not initialized");}
    return toCallback(this, input, pref);
  }

  calendar(ref?: MomentInput, opts?: object): string {
    if (!calendarCallback) {throw new Error("mmntjs calendar() is not initialized");}
    return calendarCallback(this, ref, opts);
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
        const bYear = b.$y;
        const bMonth = b.$M;

        const wholeMonthDiff = (bYear - aYear) * 12 + (bMonth - aMonth);

        if (!float) {
          const aH = a.$H, am = a.$m, aS = a.$s, aMs = a.$ms;
          const bH = b.$H, bm = b.$m, bS = b.$s, bMs = b.$ms;
          const bDayOf = b.$D;
          const anchorD = aDayOf > daysInMonth(bYear, bMonth) ? daysInMonth(bYear, bMonth) : aDayOf;

          let bBeforeAnchor: boolean;
          if (bDayOf !== anchorD) {
            bBeforeAnchor = bDayOf < anchorD;
          } else {
            if (bH !== aH) {bBeforeAnchor = bH < aH;}
            else if (bm !== am) {bBeforeAnchor = bm < am;}
            else if (bS !== aS) {bBeforeAnchor = bS < aS;}
            else {bBeforeAnchor = bMs < aMs;}
          }

          let result: number;
          if (bBeforeAnchor) {
            result = wholeMonthDiff > 0 ? -(wholeMonthDiff - 1) : -wholeMonthDiff;
          } else {
            result = -wholeMonthDiff;
          }
          if (swap) {result = -result;}
          if (code === YEAR) {result /= 12;}
          else if (code === QUARTER) {result /= 3;}
          return result;
        }

        const anchorVal = anchorMs(aYear, aMonth, aDayOf, a.$H, a.$m, a.$s, a.$ms, a._isUTC, wholeMonthDiff);
        const bVal = b.valueOf();
        const sub = bVal - anchorVal;

        let adjust: number;
        if (sub < 0) {
          adjust = sub / (anchorVal - anchorMs(aYear, aMonth, aDayOf, a.$H, a.$m, a.$s, a.$ms, a._isUTC, wholeMonthDiff - 1));
        } else {
          adjust = sub / (anchorMs(aYear, aMonth, aDayOf, a.$H, a.$m, a.$s, a.$ms, a._isUTC, wholeMonthDiff + 1) - anchorVal);
        }

        let result = -(wholeMonthDiff + adjust);
        if (swap) {result = -result;}

        if (code === YEAR) {result /= 12;}
        else if (code === QUARTER) {result /= 3;}

        return result;
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
    return daysInMonth(this.year(), this.month());
  }

  toDate(): Date {
    return new Date(this.valueOf());
  }

  toArray(): number[] {
    if (!toArrayCallback) {throw new Error("mmntjs toArray() is not initialized");}
    return toArrayCallback(this);
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
    if (!toStringCallback) {throw new Error("mmntjs toString() is not initialized");}
    return toStringCallback(this);
  }

  inspect(): string {
    if (!inspectCallback) {throw new Error("mmntjs inspect() is not initialized");}
    return inspectCallback(this);
  }

  _compareCalendarValues(other: Moment, unit: string): number {
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
        const d = this.year() - other.year();
        return d;
      }
      case "month": {
        const d = this.year() - other.year();
        if (d !== 0) {return d;}
        return this.month() - other.month();
      }
      case "quarter": {
        if (!calendarCompareCallback) {throw new Error("mmntjs quarter comparison is not initialized");}
        return calendarCompareCallback(this, other, u);
      }
      case "week":
      case "isoWeek": {
        if (!calendarCompareCallback) {throw new Error(`mmntjs ${u} comparison is not initialized`);}
        return calendarCompareCallback(this, other, u);
      }
      case "day":
      case "date":
      default: {
        const d = this.year() - other.year();
        if (d !== 0) {return d;}
        const d2 = this.month() - other.month();
        if (d2 !== 0) {return d2;}
        return this.date() - other.date();
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
    return this._compareCalendarValues(other, unit ?? "millisecond") <= 0;
  }

  isSameOrAfter(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) {return false;}
    return this._compareCalendarValues(other, unit ?? "millisecond") >= 0;
  }

  isBetween(from: MomentInput, to: MomentInput, unit?: string, inclusivity?: string): boolean {
    const fromM = momentFromAnything(from);
    const toM = momentFromAnything(to);

    const fromStr = inclusivity ?? "()";
    const startOpen = fromStr[0] === "(";
    const endOpen = fromStr.at(-1) === ")";

    const startCheck = startOpen ? this.isAfter(fromM, unit) : this.isSameOrAfter(fromM, unit);
    const endCheck = endOpen ? this.isBefore(toM, unit) : this.isSameOrBefore(toM, unit);

    return startCheck && endCheck;
  }

  isLeapYear(): boolean {
    this._ensureFields();
    return isLeapYear(this.$y);
  }

  isDST(): boolean {
    if (!isDSTCallback) {throw new Error("mmntjs isDST() is not initialized");}
    return isDSTCallback(this);
  }

  isLocal(): boolean {
    if (!isLocalCallback) {throw new Error("mmntjs isLocal() is not initialized");}
    return isLocalCallback(this);
  }

  isUtc(): boolean {
    if (!isUtcCallback) {throw new Error("mmntjs isUtc() is not initialized");}
    return isUtcCallback(this);
  }

  isUtcOffset(): boolean {
    if (!isUtcOffsetCallback) {throw new Error("mmntjs isUtcOffset() is not initialized");}
    return isUtcOffsetCallback(this);
  }

  isUTC(): boolean {
    if (!isUtcCallback) {throw new Error("mmntjs isUTC() is not initialized");}
    return isUtcCallback(this);
  }

  years(): number;
  years(y: number): this;
  years(y?: number): number | this {
    return this.year(y);
  }
  months(): number;
  months(m: number): this;
  months(m?: number): number | this {
    return this.month(m);
  }
  dates(): number;
  dates(d: number): this;
  dates(d?: number): number | this {
    return this.date(d);
  }
  days(): number;
  days(d: number): this;
  days(d?: number): number | this {
    return this.day(d);
  }
  hours(): number;
  hours(h: number): this;
  hours(h?: number): number | this {
    return this.hour(h);
  }
  minutes(): number;
  minutes(m: number): this;
  minutes(m?: number): number | this {
    return this.minute(m);
  }
  seconds(): number;
  seconds(s: number): this;
  seconds(s?: number): number | this {
    return this.second(s);
  }
  milliseconds(): number;
  milliseconds(ms: number): this;
  milliseconds(ms?: number): number | this {
    return this.millisecond(ms);
  }

  quarter(): number;
  quarter(q: number): this;
  quarter(q?: number): number | this {
    if (q !== undefined) {
      this.month((q - 1) * 3 + (this.month() % 3));
      return this;
    }
    return Math.floor(this.month() / 3) + 1;
  }

  quarters(): number;
  quarters(q: number): this;
  quarters(q?: number): number | this {
    return this.quarter(q as number);
  }

  week(): number;
  week(w: number): this;
  week(w?: number): number | this {
    if (!weekCallback) {throw new Error("mmntjs week() is not initialized");}
    return weekCallback(this, w) as number | this;
  }

  weeks(): number;
  weeks(w: number): this;
  weeks(w?: number): number | this {
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
  weekYear(y: number): this;
  weekYear(y?: number): number | this {
    if (!weekYearCallback) {throw new Error("mmntjs weekYear() is not initialized");}
    return weekYearCallback(this, y) as number | this;
  }

  isoWeek(): number;
  isoWeek(w: number): this;
  isoWeek(w?: number): number | this {
    if (!isoWeekCallback) {throw new Error("mmntjs isoWeek() is not initialized");}
    return isoWeekCallback(this, w) as number | this;
  }

  isoWeeks(): number;
  isoWeeks(w: number): this;
  isoWeeks(w?: number): number | this {
    return this.isoWeek(w as number);
  }

  isoWeekYear(): number;
  isoWeekYear(y: number): this;
  isoWeekYear(y?: number): number | this {
    if (!isoWeekYearCallback) {throw new Error("mmntjs isoWeekYear() is not initialized");}
    return isoWeekYearCallback(this, y) as number | this;
  }

  isoWeeksInYear(): number {
    if (!isoWeeksInYearCallback) {throw new Error("mmntjs isoWeeksInYear() is not initialized");}
    return isoWeeksInYearCallback(this);
  }

  weeksInYear(): number {
    if (!weeksInYearCallback) {throw new Error("mmntjs weeksInYear() is not initialized");}
    return weeksInYearCallback(this);
  }

  weeksInWeekYear(): number {
    if (!weeksInWeekYearCallback) {throw new Error("mmntjs weeksInWeekYear() is not initialized");}
    return weeksInWeekYearCallback(this);
  }

  isoWeeksInISOWeekYear(): number {
    if (!isoWeeksInISOWeekYearCallback) {throw new Error("mmntjs isoWeeksInISOWeekYear() is not initialized");}
    return isoWeeksInISOWeekYearCallback(this);
  }

  parseZone(input?: unknown, format?: unknown): Moment {
    if (!parseZoneCallback) {throw new Error("mmntjs parseZone() is not initialized");}
    return parseZoneCallback(this, input, format);
  }

  zone(): number;
  zone(offset: number | string, keepLocalTime?: boolean): this;
  zone(offset?: number | string, keepLocalTime?: boolean): number | this {
    if (!zoneCallback) {throw new Error("mmntjs zone() is not initialized");}
    return zoneCallback(this, offset, keepLocalTime) as number | this;
  }

  zoneAbbr(): string {
    if (!zoneAbbrCallback) {throw new Error("mmntjs zoneAbbr() is not initialized");}
    return zoneAbbrCallback(this);
  }

  zoneName(): string {
    if (!zoneNameCallback) {throw new Error("mmntjs zoneName() is not initialized");}
    return zoneNameCallback(this);
  }

  localeData(): Locale {
    if (!localeDataCallback) {throw new Error("mmntjs localeData() is not initialized");}
    return localeDataCallback(this);
  }

  lang(): string;
  lang(locale: string | string[] | false): this;
  lang(locale?: string | string[] | false): string | this {
    if (!langCallback) {throw new Error("mmntjs lang() is not initialized");}
    return langCallback(this, locale, () => getCurrentLocaleCallback ? getCurrentLocaleCallback() : getLiteCurrentLocale()) as string | this;
  }

  _trySetLocale(locale: string): boolean {
    const parts = locale.toLowerCase().replaceAll('_', "-").split("-");
    for (let j = parts.length; j > 0; j--) {
      const candidate = parts.slice(0, j).join("-");
      if (hasLocaleCallback ? hasLocaleCallback(candidate) : hasLiteLocale(candidate)) {
        this._l = candidate;
        this._locale = undefined;
        return true;
      }
    }
    return false;
  }

  locale(): string;
  locale(locale: string | string[] | false): this;
  locale(locale?: string | string[] | false): string | this {
    if (!localeCallback) {throw new Error("mmntjs locale() is not initialized");}
    return localeCallback(this, locale, () => getCurrentLocaleCallback ? getCurrentLocaleCallback() : getLiteCurrentLocale()) as string | this;
  }

  creationData(): Record<string, unknown> {
    if (!creationDataCallback) {throw new Error("mmntjs creationData() is not initialized");}
    return creationDataCallback(this);
  }

  parsingFlags(): Record<string, unknown> {
    if (!parsingFlagsCallback) {throw new Error("mmntjs parsingFlags() is not initialized");}
    return parsingFlagsCallback(this);
  }

  isDSTShifted(): boolean {
    return false;
  }

  hasAlignedHourOffset(other?: MomentInput): boolean {
    if (!hasAlignedHourOffsetCallback) {throw new Error("mmntjs hasAlignedHourOffset() is not initialized");}
    return hasAlignedHourOffsetCallback(this, other);
  }

  invalidAt(): number {
    if (!invalidAtCallback) {throw new Error("mmntjs invalidAt() is not initialized");}
    return invalidAtCallback(this);
  }

  isBefore(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) {return false;}
    if (unit) {
      return this._compareCalendarValues(other, unit) < 0;
    }
    return this.valueOf() > other.valueOf();
  }

  toObject(): Record<string, number> {
    if (!toObjectCallback) {throw new Error("mmntjs toObject() is not initialized");}
    return toObjectCallback(this);
  }

  isAfter(input: MomentInput, unit?: string): boolean {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) {return false;}
    if (unit) {
      return this._compareCalendarValues(other, unit) > 0;
    }
    return this.valueOf() > other.valueOf();
  }

  _updateOffset(keepTime?: boolean): void {
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
        m._cold ??= {};
        (m._cold as Record<string, unknown>)[key] = v;
      }
    },
    enumerable: true,
    configurable: true,
  });
}

export let nowFn: (() => number) | undefined = Date.now;

// eslint-disable-next-line max-params
function anchorMs(year: number, month: number, day: number, hour: number, min: number, sec: number, ms: number, utc: boolean, n: number): number {
  const tm = year * 12 + month + n;
  const y = Math.floor(tm / 12);
  const m = ((tm % 12) + 12) % 12;
  const maxDay = daysInMonth(y, m);
  const d = day > maxDay ? maxDay : day;
  if (utc) {
    return Date.UTC(y, m, d, hour, min, sec, ms);
  }
  return new Date(y, m, d, hour, min, sec, ms).getTime();
}

export function checkOverflow(parsed: Record<string, unknown> | ParsedData): number {
  if (parsed.month != null && ((parsed.month as number) < 0 || (parsed.month as number) > 11)) {return 1;}
  if (parsed.day != null) {
    const maxDay = daysInMonth(
      parsed.year != null ? (parsed.year as number) : 2000,
      parsed.month != null ? (parsed.month as number) : 0,
    );
    if ((parsed.day as number) < 1 || (parsed.day as number) > maxDay) {return 2;}
  }
  if (parsed.hour != null && ((parsed.hour as number) < 0 || (parsed.hour as number) > 24)) {return 3;}
  if ((parsed.hour as number) === 24 && (parsed.minute || parsed.second || parsed.millisecond)) {return 3;}
  if (parsed.minute != null && ((parsed.minute as number) < 0 || (parsed.minute as number) > 59)) {return 4;}
  if (parsed.second != null && ((parsed.second as number) < 0 || (parsed.second as number) > 59)) {return 5;}
  if (parsed.millisecond != null && ((parsed.millisecond as number) < 0 || (parsed.millisecond as number) > 999))
    {return 6;}
  if (parsed.isoWeek != null && parsed.isoWeekYear != null) {
    const maxWeek = weeksInYear(parsed.isoWeekYear as number, 1, 4, true);
    if ((parsed.isoWeek as number) < 1 || (parsed.isoWeek as number) > maxWeek) {return 7;}
  }
  if (parsed._weekYear != null && parsed._week != null && parsed.month === undefined) {
    if ((parsed._week as number) < 1) {return 7;}
  }
  if (parsed._localeWeekday != null) {
    if ((parsed._localeWeekday as number) < 0 || (parsed._localeWeekday as number) > 6) {return 8;}
  }
  if (parsed._weekdayNum != null) {
    if (parsed.isoWeek != null) {
      if ((parsed._weekdayNum as number) < 1 || (parsed._weekdayNum as number) > 7) {return 8;}
    } else if (parsed._localeWeekday === undefined) {
      if ((parsed._weekdayNum as number) < 0 || (parsed._weekdayNum as number) > 6) {return 8;}
    }
  }
  return -1;
}

function hasAnyValue(parsed: Record<string, unknown> | ParsedData): boolean {
  return (
    parsed.year != null ||
    parsed.month != null ||
    parsed.day != null ||
    parsed.hour != null ||
    parsed.minute != null ||
    parsed.second != null ||
    parsed.millisecond != null
  );
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
    const currentLocale = getCurrentLocaleCallback ? getCurrentLocaleCallback() : getLiteCurrentLocale();
    const parsed = parseString(
      input,
      undefined,
      (getLocaleCallback ? getLocaleCallback(currentLocale) : getLiteLocale(currentLocale)) as unknown as ParseLocale,
    );
    if (parsed && hasAnyValue(parsed)) {
      const m = new Moment({ _d: createDateSafe(parsed.year ?? 0, parsed.month ?? 0, parsed.day ?? 1, parsed.hour ?? 0, parsed.minute ?? 0, parsed.second ?? 0, parsed.millisecond ?? 0, false), _i: input, _dClone: false });
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
        parsed.year ?? 0,
        parsed.month ?? 0,
        parsed.day ?? 1,
        parsed.hour ?? 0,
        parsed.minute ?? 0,
        parsed.second ?? 0,
        parsed.millisecond ?? 0,
      );
      return new Moment({ _d: new Date(ts), _i: input, _parsedDateParts: input as number[], _dClone: false });
    }
    return new Moment({ _d: new Date(NaN), _dClone: false, _isValid: false });
  }
  if (typeof input === "object" && !isMoment(input)) {
    const obj = input as Record<string, unknown>;
    const parsed = parseObject(obj);
    if (parsed.year != null || parsed.month != null || parsed.day != null) {
      const now = new Date();
      const y = parsed.year != null ? (parsed.year as number) : now.getFullYear();
      const mo = (parsed.month as number | undefined) ?? 0;
      const d = (parsed.day as number | undefined) ?? 1;
      const h = (parsed.hour as number | undefined) ?? 0;
      const min = (parsed.minute as number | undefined) ?? 0;
      const s = (parsed.second as number | undefined) ?? 0;
      const ms = (parsed.millisecond as number | undefined) ?? 0;
      return new Moment({ _d: new Date(y, mo, d, h, min, s, ms), _i: input, _dClone: false });
    }
    const m = new Moment(input);
    if (isUTC) {m.utc();}
    return m;
  }
  return new Moment({ _d: new Date(NaN), _dClone: false, _isValid: false });
}
