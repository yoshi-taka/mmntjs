// -------------------------------------------------------------------------
// TYPED INTERNAL API — core Moment class
// This file defines the core Moment class used throughout the full build.
// Hot-path functions (getters, setters, add/subtract, startOf/endOf) are
// marked with "hot path" comments. No heavy allocation in those paths.
//
// COMPATIBILITY BOUNDARY: The Moment class itself is a public export but
// its internal fields ($y, $M, $D, _d, _t etc.) are accessed directly by
// display/parse/plugin modules. Do NOT change field names without updating
// all consumers.
// -------------------------------------------------------------------------

import type { Locale } from "./locale-runtime";
import type { UnitCode } from "./types";
import { hasLiteLocale } from "./locale-lite";
import {
  localeWeekday,
  localeWeek,
  localeWeekYear,
  localeWeeksInYear,
  localeWeeksInWeekYear,
  localeData,
  lang as localeMethodLang,
  localeMethod,
} from "./locale-extra";
import type { LocaleAwareMoment } from "./locale-extra";
import {
  isoWeekdayMoment,
  dayOfYearMoment,
  isoWeekMoment,
  isoWeekYearMoment,
  isoWeeksInYearMoment,
  isoWeeksInISOWeekYearMoment,
  calendarCompareMoment,
} from "./calendar-extra";
import type { CalendarAwareMoment } from "./calendar-extra";
import { startOfExtraMoment, endOfExtraMoment } from "./boundary-extra";
import {
  toArrayMoment,
  inspectMoment,
  creationDataMoment,
  parsingFlagsMoment,
  invalidAtMoment,
  toObjectMoment,
  toStringMoment,
} from "./debug-extra";
import {
  localMoment,
  utcMoment,
  utcOffsetMoment,
  parseZoneMoment,
  zoneMoment,
  zoneAbbrMoment,
  zoneNameMoment,
  isLocalMoment,
  isUtcMoment,
  isUtcOffsetMoment,
  isDSTMoment,
  hasAlignedHourOffsetMoment,
} from "./utc-extra";
import type { UtcMoment, MomentFactory } from "./utc-extra";
import { getCurrentLocale, getLocale, hasLocale } from "./locale-runtime";
import { isArray, isObject, isDate, isMoment, hasOwnProp, zeroFill, createDateSafe } from "./utils";
import {
  DATE,
  DAY,
  DAY_MS,
  endOfUnitEpoch,
  euclideanModulo,
  floorUnitEpoch,
  HOUR,
  HOUR_MS,
  INVALID_UNIT,
  ISO_WEEK,
  MILLISECOND,
  MINUTE,
  MINUTE_MS,
  MONTH,
  QUARTER,
  SECOND,
  SECOND_MS,
  WEEK,
  YEAR,
  normalizeUnitCode,
  normalizeUnits,
  normalizeMonth,
  daysInMonth,
  daysInMonthFast,
  isLeapYear,
  ymdToEpochDays,
} from "./units";
import { parseString, parseArray, parseObject, type ParsedData } from "./parse";
import type { FormattableMoment } from "./display/types";
import type { ParseLocale } from "./parse-locale";

export let momentProperties: string[] = [];

let _defaultFormat = "YYYY-MM-DDTHH:mm:ssZ";
let _defaultFormatUtc = "YYYY-MM-DDTHH:mm:ss[Z]";

export function setDefaultFormat(fmt: string): void {
  _defaultFormat = fmt;
}
export function getDefaultFormat(): string {
  return _defaultFormat;
}
export function setDefaultFormatUtc(fmt: string): void {
  _defaultFormatUtc = fmt;
}
export function getDefaultFormatUtc(): string {
  return _defaultFormatUtc;
}

let updateOffsetCallback: ((m: Moment) => void) | undefined;
let formatMomentCallback: ((m: FormattableMoment, format: string) => string) | undefined;
let fromNowCallback: ((m: Moment, pref?: boolean) => string) | undefined;
let fromCallback: ((m: Moment, input: MomentInput, pref?: boolean) => string) | undefined;
let toNowCallback: ((m: Moment, pref?: boolean) => string) | undefined;
let toCallback: ((m: Moment, input: MomentInput, pref?: boolean) => string) | undefined;
let calendarCallback: ((m: Moment, ref?: MomentInput, opts?: object) => string) | undefined;
let addCallback:
  | ((
      m: Moment,
      amount: number | string | object,
      unit?: string,
    ) => { ms: number; days: number; months: number } | null)
  | undefined;

const TIME_UNIT_MS: Record<number, number> = {
  [HOUR]: HOUR_MS,
  [MINUTE]: MINUTE_MS,
  [SECOND]: SECOND_MS,
  [MILLISECOND]: 1,
};

/** @public */
export {
  getRelTimeRounding,
  setRelTimeRounding,
  getRelTimeThreshold,
  setRelTimeThreshold,
} from "./reltime";

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
  cb:
    | ((
        m: Moment,
        amount: number | string | object,
        unit?: string,
      ) => { ms: number; days: number; months: number } | null)
    | undefined,
): void {
  addCallback = cb;
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

export interface MomentConstructionConfig {
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
  FullYear,
  Month,
  Date,
  Day,
  Hours,
  Minutes,
  Seconds,
  Milliseconds,
}

const coldFieldKeys: (keyof MomentCold)[] = [
  "_overflow",
  "_parsedDateParts",
  "_unusedTokens",
  "_unusedInput",
  "_charsLeftOver",
  "_empty",
  "_nullInput",
  "_invalidMonth",
  "_invalidFormat",
  "_weekdayMismatch",
  "_iso",
  "_rfc2822",
  "_invalidEra",
  "_bigHour",
  "_meridiem",
  "_isParseZone",
  "_userInvalidated",
  "_tooBusyWith",
];

function isCoreMomentConstructionConfigKey(key: string): boolean {
  switch (key) {
    case "_d":
    case "_dClone":
    case "_isValid":
    case "_isUTC":
    case "_offset":
    case "_t":
    case "_i":
    case "_f":
    case "_l":
    case "_strict":
      return true;
    default:
      return false;
  }
}

function hasExtraColdConfig(c: MomentConstructionConfig): boolean {
  for (const key in c) {
    if (!hasOwnProp(c, key)) {
      continue;
    }
    if (key.charCodeAt(0) === 95 && !isCoreMomentConstructionConfigKey(key)) {
      return true;
    }
  }
  return false;
}

function _dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  y -= m < 3 ? 1 : 0;
  return euclideanModulo(
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m] + d) | 0,
    7,
  );
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

// Moment is the moment-compatible runtime object exported as moment.fn / moment.prototype.
// It is NOT merely an implementation detail — its shape IS the public API boundary.
// new Moment(config) is an internal construction primitive; prefer factory functions.

function _cast<T>(m: Moment): T {
  // oxlint-disable-next-line typescript/no-explicit-any
  return m as any;
}

export class Moment {
  static calendarFormat: ((m: Moment, now: Moment) => string) | undefined;

  _p = {
    t: 0,
    d: undefined as Date | undefined,
    dirty: false,
    isUTC: false,
    offset: 0,
    locale: undefined as Locale | undefined,
    y: 0,
    M: 0,
    D: 0,
    W: 0,
    H: 0,
    m: 0,
    s: 0,
    ms: 0,
  };

  _isValid: boolean;
  _l: string | undefined;
  _isAMomentObject = true;
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

  static _epochDaysToYMD(z: number): [number, number, number] {
    z += 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor(
      (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
    );
    const y = yoe + era * 400;
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    const year = y + (m <= 2 ? 1 : 0);
    return [year, m - 1, d];
  }

  /** hot path: called before every property read to ensure cached fields are fresh */
  _ensureFields(): void {
    if (this._p.dirty) {
      this._p.dirty = false;
      this._refreshFields();
    }
  }

  _getD(): Date {
    this._ensureFields();
    if (this._p.d) {
      return this._p.d;
    }
    this._p.d = new Date(this._p.t);
    return this._p.d;
  }

  /** hot path: get Date without ensure (caller must have called _ensureFields first) */
  _getDNoEnsure(): Date {
    if (this._p.d) {
      return this._p.d;
    }
    this._p.d = new Date(this._p.t);
    return this._p.d;
  }

  _refreshFields(): void {
    if (this._p.isUTC) {
      if (this._p.d) {
        this._p.y = this._p.d.getUTCFullYear();
        this._p.M = this._p.d.getUTCMonth();
        this._p.D = this._p.d.getUTCDate();
        this._p.W = this._p.d.getUTCDay();
        this._p.H = this._p.d.getUTCHours();
        this._p.m = this._p.d.getUTCMinutes();
        this._p.s = this._p.d.getUTCSeconds();
        this._p.ms = this._p.d.getUTCMilliseconds();
      } else {
        const t = this._p.t;
        const totalDays = Math.floor(t / DAY_MS);
        const totalSec = Math.floor(t / SECOND_MS);
        this._p.W = euclideanModulo(totalDays + 4, 7);
        const [y, M, D] = Moment._epochDaysToYMD(totalDays);
        this._p.y = y;
        this._p.M = M;
        this._p.D = D;
        this._p.H = euclideanModulo(Math.floor(totalSec / 3600), 24);
        this._p.m = euclideanModulo(Math.floor(totalSec / 60), 60);
        this._p.s = euclideanModulo(totalSec, 60);
        this._p.ms = euclideanModulo(t, SECOND_MS);
      }
    } else {
      const d = this._getD();
      this._p.y = d.getFullYear();
      this._p.M = d.getMonth();
      this._p.D = d.getDate();
      this._p.W = d.getDay();
      this._p.H = d.getHours();
      this._p.m = d.getMinutes();
      this._p.s = d.getSeconds();
      this._p.ms = d.getMilliseconds();
      this._p.offset = -d.getTimezoneOffset();
    }
  }

  constructor(config: MomentConstructionConfig = {}) {
    const c = config;
    this._isAMomentObject = true;
    this._l = c._l ?? getCurrentLocale();
    this._p.isUTC = c._isUTC ?? false;
    this._p.offset = c._offset ?? 0;
    if (c._d) {
      this._p.d = c._dClone === false ? c._d : new Date(c._d);
      this._p.t = this._p.d.getTime();
    } else if (c._t !== undefined) {
      this._p.t = c._t;
      this._p.d = undefined;
    } else {
      this._p.t = Date.now();
      this._p.d = undefined;
    }
    this._isValid = c._isValid ?? !isNaN(this._p.t);
    if (this._isValid) {
      this._p.dirty = false;
      this._refreshFields();
    } else {
      this._p.dirty = false;
    }
    if (c._i !== undefined) {
      this._i = c._i;
    }
    if (c._f !== undefined) {
      this._f = c._f;
    }
    if (c._strict !== undefined) {
      this._strict = c._strict;
    }
    let hasExtraCold = false;
    if (
      c._overflow !== undefined ||
      c._empty !== undefined ||
      c._nullInput !== undefined ||
      c._invalidMonth !== undefined ||
      c._invalidFormat !== undefined ||
      c._weekdayMismatch !== undefined ||
      c._userInvalidated !== undefined ||
      (hasExtraCold = hasExtraColdConfig(c))
    ) {
      this._initCold(c, hasExtraCold);
    }
  }

  _initCold(c: MomentConstructionConfig, hasExtraCold = false): void {
    const hasErrorCold =
      (c._overflow !== undefined && c._overflow >= 0) ||
      c._empty === true ||
      c._nullInput === true ||
      (c._invalidMonth !== undefined && c._invalidMonth !== null) ||
      c._invalidFormat === true ||
      c._weekdayMismatch === true ||
      c._userInvalidated !== undefined;
    if (
      hasErrorCold ||
      c._unusedTokens !== undefined ||
      c._unusedInput !== undefined ||
      c._charsLeftOver !== undefined ||
      c._invalidEra !== undefined ||
      c._iso !== undefined ||
      c._rfc2822 !== undefined ||
      c._bigHour !== undefined ||
      c._meridiem !== undefined ||
      c._isParseZone !== undefined ||
      c._tooBusyWith !== undefined ||
      c._parsedDateParts !== undefined ||
      hasExtraCold
    ) {
      const cold: Record<string, unknown> = {};
      if (c._overflow !== undefined) {
        cold._overflow = c._overflow;
      }
      if (c._parsedDateParts !== undefined) {
        cold._parsedDateParts = c._parsedDateParts;
      }
      if (c._unusedTokens !== undefined) {
        cold._unusedTokens = c._unusedTokens;
      }
      if (c._unusedInput !== undefined) {
        cold._unusedInput = c._unusedInput;
      }
      if (c._charsLeftOver !== undefined) {
        cold._charsLeftOver = c._charsLeftOver;
      }
      if (c._empty !== undefined) {
        cold._empty = c._empty;
      }
      if (c._nullInput !== undefined) {
        cold._nullInput = c._nullInput;
      }
      if (c._invalidMonth !== undefined) {
        cold._invalidMonth = c._invalidMonth;
      }
      if (c._invalidFormat !== undefined) {
        cold._invalidFormat = c._invalidFormat;
      }
      if (c._weekdayMismatch !== undefined) {
        cold._weekdayMismatch = c._weekdayMismatch;
      }
      if (c._iso !== undefined) {
        cold._iso = c._iso;
      }
      if (c._rfc2822 !== undefined) {
        cold._rfc2822 = c._rfc2822;
      }
      if (c._invalidEra !== undefined) {
        cold._invalidEra = c._invalidEra;
      }
      if (c._bigHour !== undefined) {
        cold._bigHour = c._bigHour;
      }
      if (c._meridiem !== undefined) {
        cold._meridiem = c._meridiem;
      }
      if (c._isParseZone !== undefined) {
        cold._isParseZone = c._isParseZone;
      }
      if (c._userInvalidated !== undefined) {
        cold._userInvalidated = c._userInvalidated;
      }
      if (c._tooBusyWith !== undefined) {
        cold._tooBusyWith = c._tooBusyWith;
      }
      for (const [key, value] of Object.entries(c)) {
        if (
          key.charCodeAt(0) === 95 &&
          !isCoreMomentConstructionConfigKey(key) &&
          !(key in cold) &&
          value !== undefined
        ) {
          cold[key] = value;
        }
      }
      this._cold = cold;
      if (hasErrorCold) {
        this._p.dirty = false;
      }
    }
  }

  _getLocale(): Locale {
    this._p.locale ??= getLocale(this._l);
    return this._p.locale;
  }

  _gdt(method: DMethod): number {
    const d = this._getD();
    if (this._p.isUTC) {
      switch (method) {
        case DMethod.FullYear:
          return d.getUTCFullYear();
        case DMethod.Month:
          return d.getUTCMonth();
        case DMethod.Date:
          return d.getUTCDate();
        case DMethod.Day:
          return d.getUTCDay();
        case DMethod.Hours:
          return d.getUTCHours();
        case DMethod.Minutes:
          return d.getUTCMinutes();
        case DMethod.Seconds:
          return d.getUTCSeconds();
        case DMethod.Milliseconds:
          return d.getUTCMilliseconds();
      }
    } else {
      switch (method) {
        case DMethod.FullYear:
          return d.getFullYear();
        case DMethod.Month:
          return d.getMonth();
        case DMethod.Date:
          return d.getDate();
        case DMethod.Day:
          return d.getDay();
        case DMethod.Hours:
          return d.getHours();
        case DMethod.Minutes:
          return d.getMinutes();
        case DMethod.Seconds:
          return d.getSeconds();
        case DMethod.Milliseconds:
          return d.getMilliseconds();
      }
    }
    return NaN;
  }

  _sdt(method: DMethod, value: number): void {
    const d = this._getD();
    if (this._p.isUTC) {
      switch (method) {
        case DMethod.FullYear:
          d.setUTCFullYear(value);
          break;
        case DMethod.Month:
          d.setUTCMonth(value);
          break;
        case DMethod.Date:
          d.setUTCDate(value);
          break;
        case DMethod.Hours:
          d.setUTCHours(value);
          break;
        case DMethod.Minutes:
          d.setUTCMinutes(value);
          break;
        case DMethod.Seconds:
          d.setUTCSeconds(value);
          break;
        case DMethod.Milliseconds:
          d.setUTCMilliseconds(value);
          break;
      }
    } else {
      switch (method) {
        case DMethod.FullYear:
          d.setFullYear(value);
          break;
        case DMethod.Month:
          d.setMonth(value);
          break;
        case DMethod.Date:
          d.setDate(value);
          break;
        case DMethod.Hours:
          d.setHours(value);
          break;
        case DMethod.Minutes:
          d.setMinutes(value);
          break;
        case DMethod.Seconds:
          d.setSeconds(value);
          break;
        case DMethod.Milliseconds:
          d.setMilliseconds(value);
          break;
      }
    }
    this._p.t = d.getTime();
    this._refreshFields();
  }

  isValid(): boolean {
    if (!this._isValid) {
      return false;
    }
    const cold = this._cold;
    if (!cold) {
      return true;
    }
    if (cold._userInvalidated) {
      return false;
    }
    if ((cold._overflow as number) >= 0) {
      return false;
    }
    if (cold._invalidMonth) {
      return false;
    }
    if (cold._empty) {
      return false;
    }
    if (cold._nullInput) {
      return false;
    }
    if (cold._invalidFormat) {
      return false;
    }
    if (cold._weekdayMismatch) {
      return false;
    }
    if (cold._bigHour && this._strict) {
      return false;
    }
    return true;
  }

  clone(): this {
    const m = createMomentShell(this._l, this._p.isUTC, this._p.offset, this._isValid) as this;
    m._p.t = this._p.t;
    m._p.dirty = this._p.dirty;
    m._p.locale = this._p.locale;
    m._p.y = this._p.y;
    m._p.M = this._p.M;
    m._p.D = this._p.D;
    m._p.W = this._p.W;
    m._p.H = this._p.H;
    m._p.m = this._p.m;
    m._p.s = this._p.s;
    m._p.ms = this._p.ms;
    m._i = this._i;
    m._f = this._f;
    m._strict = this._strict;
    if (this._cold) {
      m._cold = { ...this._cold } as MomentCold;
    }
    return m;
  }

  year(): number;
  year(y: unknown): this;
  year(y?: unknown): number | this {
    if (y !== undefined) {
      if (y === "" || (typeof y === "object" && !(y instanceof Date))) {
        return this;
      }
      const num = Number(y);
      if (isNaN(num)) {
        return this;
      }
      this._ensureFields();
      if (this._p.isUTC) {
        const maxDay = daysInMonth(num, this._p.M);
        const d_ = this._p.D > maxDay ? maxDay : this._p.D;
        this._p.t = Date.UTC(num, this._p.M, d_, this._p.H, this._p.m, this._p.s, this._p.ms);
        this._p.d = undefined;
        this._p.dirty = true;
        this._p.y = num;
        this._p.D = d_;
        this._p.W = _dayOfWeek(num, this._p.M, d_);
      } else {
        const maxDay = daysInMonth(num, this._p.M);
        const d_ = this._p.D > maxDay ? maxDay : this._p.D;
        const dt = new Date(this._p.y, this._p.M, d_, this._p.H, this._p.m, this._p.s, this._p.ms);
        dt.setFullYear(num);
        this._p.d = dt;
        this._p.y = dt.getFullYear();
        this._p.M = dt.getMonth();
        this._p.D = dt.getDate();
        this._p.W = dt.getDay();
        this._p.t = dt.getTime();
        this._p.offset = -dt.getTimezoneOffset();
      }
      // $H, $m, $s, $ms unchanged
      if (updateOffsetCallback) {
        this._updateOffset(true);
      }
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    this._ensureFields();
    return this._p.y;
  }

  month(): number;
  month(m: unknown): this;
  month(m?: unknown): number | this {
    if (m !== undefined) {
      this._ensureFields();
      if (typeof m === "string" && !/^-?\d+$/.test(m)) {
        const lower = m.toLowerCase();
        const localeMonthsFull = this._getLocale().monthsArray();
        for (let mi = 0; mi < localeMonthsFull.length; mi++) {
          if (localeMonthsFull[mi].toLowerCase() === lower) {
            m = mi;
            break;
          }
        }
        if (typeof m === "string") {
          const localeMonths = this._getLocale().monthsShortArray();
          for (let mi = 0; mi < localeMonths.length; mi++) {
            if (localeMonths[mi].toLowerCase() === lower) {
              m = mi;
              break;
            }
          }
        }
        if (typeof m === "string") {
          return this;
        }
      }
      const num = Number(m);
      if (isNaN(num)) {
        return this;
      }
      const utc = this._p.isUTC;
      const date = this._p.D;
      if (utc) {
        const d = this._getD();
        d.setUTCMonth(num);
        if (d.getUTCDate() !== date) {
          d.setUTCDate(0);
        }
        this._p.y = d.getUTCFullYear();
        this._p.M = d.getUTCMonth();
        this._p.D = d.getUTCDate();
        this._p.W = _dayOfWeek(this._p.y, this._p.M, this._p.D);
        this._p.t = d.getTime();
      } else {
        const y = this._p.y + Math.floor(num / 12);
        const _m = normalizeMonth(num);
        const maxDay = daysInMonth(y, _m);
        const d_ = date > maxDay ? maxDay : date;
        const d = new Date(y, _m, d_, this._p.H, this._p.m, this._p.s, this._p.ms);
        this._p.d = d;
        this._p.y = d.getFullYear();
        this._p.M = d.getMonth();
        this._p.D = d.getDate();
        this._p.W = d.getDay();
        this._p.t = d.getTime();
        this._p.offset = -d.getTimezoneOffset();
      }
      if (updateOffsetCallback) {
        this._updateOffset(true);
      }
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    this._ensureFields();
    return this._p.M;
  }

  date(): number;
  date(d: unknown): this;
  date(d?: unknown): number | this {
    if (d !== undefined) {
      if (d === "" || (typeof d === "object" && !(d instanceof Date))) {
        return this;
      }
      const num = Number(d);
      if (isNaN(num)) {
        return this;
      }
      if (num <= 0) {
        return this;
      }
      this._ensureFields();
      if (this._p.isUTC) {
        const dt = this._getD();
        dt.setUTCDate(num);
        this._p.t = dt.getTime();
      } else {
        const dt = new Date(this._p.y, this._p.M, num, this._p.H, this._p.m, this._p.s, this._p.ms);
        this._p.d = dt;
        this._p.y = dt.getFullYear();
        this._p.M = dt.getMonth();
        this._p.D = dt.getDate();
        this._p.W = dt.getDay();
        this._p.H = dt.getHours();
        this._p.m = dt.getMinutes();
        this._p.s = dt.getSeconds();
        this._p.ms = dt.getMilliseconds();
        this._p.t = dt.getTime();
        this._p.offset = -dt.getTimezoneOffset();
      }
      if (this._p.isUTC) {
        this._refreshFields();
      }
      if (updateOffsetCallback) {
        this._updateOffset(true);
      }
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    this._ensureFields();
    return this._p.D;
  }

  day(): number;
  day(d: unknown): this;
  day(d?: unknown): number | this {
    if (d !== undefined) {
      this._ensureFields();
      let dayNum = Number(d);
      if (typeof d === "string") {
        const lower = d.toLowerCase();
        let found = false;
        const localeDaysFull = this._getLocale().weekdaysArray();
        for (let di = 0; di < localeDaysFull.length; di++) {
          if (localeDaysFull[di].toLowerCase() === lower) {
            dayNum = di % 7;
            found = true;
            break;
          }
        }
        if (!found) {
          const localeDays = this._getLocale().weekdaysShortArray();
          for (let di = 0; di < localeDays.length; di++) {
            if (localeDays[di].toLowerCase() === lower) {
              dayNum = di % 7;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          const localeDaysMin = this._getLocale().weekdaysMinArray();
          for (let di = 0; di < localeDaysMin.length; di++) {
            if (localeDaysMin[di].toLowerCase() === lower) {
              dayNum = di % 7;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          return this;
        }
      }
      if (isNaN(dayNum)) {
        return this;
      }
      const currentDay = this._p.W;
      const diff = dayNum - currentDay;
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff);
      } else {
        dt.setDate(dt.getDate() + diff);
      }
      this._p.t = dt.getTime();
      this._refreshFields();
      if (updateOffsetCallback) {
        this._updateOffset(true);
      }
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    this._ensureFields();
    return this._p.W;
  }

  weekday(): number;
  weekday(d: number): this;
  weekday(d?: number): number | this {
    if (!this._isValid) {
      return NaN;
    }
    return localeWeekday(this, d as never) as number | this;
  }

  isoWeekday(): number;
  isoWeekday(d: unknown): this;
  isoWeekday(d?: unknown): number | this {
    if (!this._isValid) {
      return d !== undefined ? this : NaN;
    }
    this._ensureFields();
    // oxlint-disable-next-line typescript/no-explicit-any
    return isoWeekdayMoment(_cast<CalendarAwareMoment>(this), d) as number | this;
  }

  dayOfYear(): number;
  dayOfYear(d: number): this;
  dayOfYear(d?: number): number | this {
    if (!this._isValid) {
      return d !== undefined ? this : NaN;
    }
    this._ensureFields();
    return dayOfYearMoment(_cast<CalendarAwareMoment>(this), d) as number | this;
  }

  hour(): number;
  hour(h: unknown): this;
  hour(h?: unknown): number | this {
    if (h !== undefined) {
      if (h === null) {
        return this;
      }
      const num = Number(h);
      if (isNaN(num)) {
        return this;
      }
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCHours(num);
      } else {
        dt.setHours(num);
      }
      this._p.t = dt.getTime();
      this._refreshFields();
      if (updateOffsetCallback) {
        this._updateOffset(true);
      }
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    this._ensureFields();
    return this._p.H;
  }

  minute(): number;
  minute(m: unknown): this;
  minute(m?: unknown): number | this {
    if (m !== undefined) {
      if (m === null) {
        return this;
      }
      const num = Number(m);
      if (isNaN(num)) {
        return this;
      }
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCMinutes(num);
      } else {
        dt.setMinutes(num);
      }
      this._p.t = dt.getTime();
      this._refreshFields();
      if (updateOffsetCallback) {
        this._updateOffset(true);
      }
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    this._ensureFields();
    return this._p.m;
  }

  second(): number;
  second(s: unknown): this;
  second(s?: unknown): number | this {
    if (s !== undefined) {
      if (s === null) {
        return this;
      }
      const num = Number(s);
      if (isNaN(num)) {
        return this;
      }
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCSeconds(num);
      } else {
        dt.setSeconds(num);
      }
      this._p.t = dt.getTime();
      this._refreshFields();
      if (updateOffsetCallback) {
        this._updateOffset(true);
      }
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    this._ensureFields();
    return this._p.s;
  }

  millisecond(): number;
  millisecond(ms: unknown): this;
  millisecond(ms?: unknown): number | this {
    if (ms !== undefined) {
      if (ms === null) {
        return this;
      }
      const num = Number(ms);
      if (isNaN(num)) {
        return this;
      }
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCMilliseconds(num);
      } else {
        dt.setMilliseconds(num);
      }
      this._p.t = dt.getTime();
      this._refreshFields();
      if (updateOffsetCallback) {
        this._updateOffset(true);
      }
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    this._ensureFields();
    return this._p.ms;
  }

  get(unit: string): number;
  get(unit: object): this;
  get(unit: string | object): number | this {
    if (isObject(unit)) {
      return this;
    }
    const u = normalizeUnits(unit as string);
    if (!u) {
      return this as unknown as number;
    }
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
        const curYear = this._p.y;
        const curMonth = this._p.M;
        const curDate = this._p.D;
        const curHour = this._p.H;
        const curMinute = this._p.m;
        const curSecond = this._p.s;
        const curMs = this._p.ms;

        const newYear = yearVal ?? curYear;
        const newMonth = monthVal ?? curMonth;
        const newDate = dateVal ?? curDate;
        const newHour = hourVal ?? curHour;
        const newMinute = minuteVal ?? curMinute;
        const newSecond = secondVal ?? curSecond;
        const newMs = msVal ?? curMs;

        if (this._p.isUTC) {
          const tmp = new Date(
            Date.UTC(newYear, newMonth, 1, newHour, newMinute, newSecond, newMs),
          );
          const maxDays = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
          tmp.setUTCDate(Math.min(newDate, maxDays));
          this._p.d = tmp;
          this._p.t = this._p.d.getTime();
          this._p.y = tmp.getUTCFullYear();
          this._p.M = tmp.getUTCMonth();
          this._p.D = tmp.getUTCDate();
          this._p.W = _dayOfWeek(this._p.y, this._p.M, this._p.D);
          this._p.H = tmp.getUTCHours();
          this._p.m = tmp.getUTCMinutes();
          this._p.s = tmp.getUTCSeconds();
          this._p.ms = tmp.getUTCMilliseconds();
        } else {
          const tmp = new Date(newYear, newMonth, 1, newHour, newMinute, newSecond, newMs);
          const maxDays = new Date(newYear, newMonth + 1, 0).getDate();
          tmp.setDate(Math.min(newDate, maxDays));
          this._p.d = tmp;
          this._p.t = this._p.d.getTime();
          this._p.y = tmp.getFullYear();
          this._p.M = tmp.getMonth();
          this._p.D = tmp.getDate();
          this._p.W = _dayOfWeek(this._p.y, this._p.M, this._p.D);
          this._p.H = tmp.getHours();
          this._p.m = tmp.getMinutes();
          this._p.s = tmp.getSeconds();
          this._p.ms = tmp.getMilliseconds();
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
    if (!u) {
      return this;
    }
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
    const utc = this._p.isUTC;

    switch (unit) {
      case YEAR:
      case QUARTER:
      case MONTH: {
        changedDays = true;
        this._ensureFields();
        const rawMonths = unit === YEAR ? amount * 12 : unit === QUARTER ? amount * 3 : amount;
        const totalMonths = Number.isInteger(rawMonths)
          ? rawMonths
          : rawMonths < 0
            ? Math.round(rawMonths * -1) * -1
            : Math.round(rawMonths);
        const tm = this._p.y * 12 + this._p.M + totalMonths;
        const y = Math.floor(tm / 12);
        const m = normalizeMonth(tm);
        let d_ = this._p.D;
        if (d_ > 28) {
          const _md = daysInMonthFast(y, m);
          if (d_ > _md) {
            d_ = _md;
          }
        }
        if (utc) {
          this._p.t =
            ymdToEpochDays(y, m, d_) * 86400000 +
            this._p.H * 3600000 +
            this._p.m * 60000 +
            this._p.s * 1000 +
            this._p.ms;
          this._p.d = undefined;
          this._p.dirty = true;
        } else {
          const dt = this._p.d ?? (this._p.d = new Date(this._p.t));
          dt.setFullYear(y, m, d_);
          this._p.t = dt.getTime();
        }
        this._p.y = y;
        this._p.M = m;
        this._p.D = d_;
        this._p.W = utc ? _dayOfWeek(y, m, d_) : this._p.d!.getDay();
        if (!utc) {
          this._p.offset = -this._p.d!.getTimezoneOffset();
        }
        break;
      }
      case ISO_WEEK:
      case WEEK:
      case DAY:
      case DATE: {
        changedDays = true;
        const raw = unit === WEEK || unit === ISO_WEEK ? amount * 7 : amount;
        const rounded = Number.isInteger(raw)
          ? raw
          : raw < 0
            ? Math.round(raw * -1) * -1
            : Math.round(raw);
        if (rounded !== 0) {
          if (utc) {
            this._p.t += rounded * 86400000;
            this._p.d = undefined;
          } else {
            const dt = this._p.d ?? (this._p.d = new Date(this._p.t));
            dt.setDate(dt.getDate() + rounded);
            this._p.t = dt.getTime();
          }
          this._p.dirty = true;
        }
        break;
      }
      case HOUR:
      case MINUTE:
      case SECOND:
      case MILLISECOND: {
        this._p.t += Math.round(amount * TIME_UNIT_MS[unit]);
        this._p.d = undefined;
        this._p.dirty = true;
        break;
      }
      default:
        return;
    }
    this._updateOffset(changedDays);
    if (isNaN(this._p.t)) {
      this._isValid = false;
    }
  }

  _updateOffset(_keepTime?: boolean): void {
    // hot path: called after every mutation via _dirty flag
    // _keepTime is accepted for Moment.js compat but unused internally
    if (typeof updateOffsetCallback === "function") {
      updateOffsetCallback(this);
    }
  }

  _parseDurationInput(
    amount: number | string | object,
    unit?: string,
  ): { ms: number; days: number; months: number } | null {
    if (!addCallback) {
      return null;
    }
    return addCallback(this, amount, unit);
  }

  _applyDuration(ms: number, days: number, months: number, sign: 1 | -1): void {
    this._ensureFields();
    const d = this._getDNoEnsure();
    const utc = this._p.isUTC;
    if (months) {
      const curMonth = this._p.M;
      const day = this._p.D;
      if (utc) {
        d.setUTCMonth(curMonth + sign * months);
      } else {
        d.setMonth(curMonth + sign * months);
      }
      if ((utc ? d.getUTCDate() : d.getDate()) !== day) {
        if (utc) {
          d.setUTCDate(0);
        } else {
          d.setDate(0);
        }
      }
    }
    if (days) {
      if (utc) {
        d.setUTCDate(d.getUTCDate() + sign * days);
      } else {
        d.setDate(d.getDate() + sign * days);
      }
    }
    if (ms) {
      d.setTime(d.getTime() + sign * ms);
    }
    this._p.t = d.getTime();
    if (months || ms) {
      this._refreshFields();
    } else if (days) {
      if (utc) {
        this._p.y = d.getUTCFullYear();
        this._p.M = d.getUTCMonth();
        this._p.D = d.getUTCDate();
        this._p.W = d.getUTCDay();
      } else {
        this._p.y = d.getFullYear();
        this._p.M = d.getMonth();
        this._p.D = d.getDate();
        this._p.W = d.getDay();
        this._p.offset = -d.getTimezoneOffset();
      }
    }
    this._updateOffset(!(!months && !days));
    if (isNaN(this._p.t)) {
      this._isValid = false;
    }
  }

  add(amount: number | string | object, unit?: string): this {
    if (!this._isValid) {
      return this;
    }
    if (typeof amount === "number" && amount === 0) {
      return this;
    }
    if (typeof amount === "number") {
      if (unit !== undefined) {
        const code = normalizeUnitCode(unit);
        if (code >= 0) {
          switch (code) {
            case DAY: {
              if (this._p.isUTC) {
                this._p.t += Math.round(amount * 86400000);
                this._p.d = undefined;
              } else {
                const dt = this._p.d ?? (this._p.d = new Date(this._p.t));
                dt.setDate(dt.getDate() + amount);
                this._p.t = dt.getTime();
              }
              this._p.dirty = true;
              return this;
            }
            case MONTH: {
              this._ensureFields();
              const totalMonths = Number.isInteger(amount)
                ? amount
                : amount < 0
                  ? Math.round(-amount) * -1
                  : Math.round(amount);
              const tm = this._p.y * 12 + this._p.M + totalMonths;
              const y = Math.floor(tm / 12);
              const m = normalizeMonth(tm);
              let d_ = this._p.D;
              if (d_ > 28) {
                const md = daysInMonthFast(y, m);
                if (d_ > md) {
                  d_ = md;
                }
              }
              if (this._p.isUTC) {
                this._p.t =
                  ymdToEpochDays(y, m, d_) * 86400000 +
                  this._p.H * 3600000 +
                  this._p.m * 60000 +
                  this._p.s * 1000 +
                  this._p.ms;
                this._p.d = undefined;
                this._p.dirty = true;
              } else {
                const dt = this._p.d ?? (this._p.d = new Date(this._p.t));
                dt.setFullYear(y, m, d_);
                this._p.t = dt.getTime();
              }
              this._p.y = y;
              this._p.M = m;
              this._p.D = d_;
              this._p.W = this._p.isUTC ? _dayOfWeek(y, m, d_) : this._p.d!.getDay();
              if (!this._p.isUTC) {
                this._p.offset = -this._p.d!.getTimezoneOffset();
              }
              if (isNaN(this._p.t)) {
                this._isValid = false;
              }
              return this;
            }
            case HOUR:
            case MINUTE:
            case SECOND:
            case MILLISECOND: {
              const ms = TIME_UNIT_MS[code];
              this._p.t += Number.isInteger(amount) ? amount * ms : Math.round(amount * ms);
              this._p.d = undefined;
              this._p.dirty = true;
              if (isNaN(this._p.t)) {
                this._isValid = false;
              }
              return this;
            }
            default:
              this._addSimple(amount, code);
              if (isNaN(this._p.t)) {
                this._isValid = false;
              }
              return this;
          }
        }
      } else {
        this._addSimple(amount, MILLISECOND);
        if (isNaN(this._p.t)) {
          this._isValid = false;
        }
        return this;
      }
    }
    const parsed = this._parseDurationInput(amount, unit);
    if (!parsed) {
      return this;
    }
    this._applyDuration(parsed.ms, parsed.days, parsed.months, 1);
    if (isNaN(this._p.t)) {
      this._isValid = false;
    }
    return this;
  }

  subtract(amount: number | string | object, unit?: string): this {
    if (!this._isValid) {
      return this;
    }
    if (typeof amount === "number") {
      if (unit !== undefined) {
        return this.add(-amount, unit);
      }
      return this.add(-amount);
    }
    const parsed = this._parseDurationInput(amount, unit);
    if (!parsed) {
      return this;
    }
    this._applyDuration(parsed.ms, parsed.days, parsed.months, -1);
    if (isNaN(this._p.t)) {
      this._isValid = false;
    }
    return this;
  }

  startOf(unit: string): this {
    const code = fastNormalizeBoundaryUnit(unit);
    if (code < 0) {
      return this;
    }
    if (!this._isValid) {
      return this;
    }
    this._ensureFields();
    if (!updateOffsetCallback) {
      if (code === MONTH) {
        if (
          this._p.D === 1 &&
          this._p.H === 0 &&
          this._p.m === 0 &&
          this._p.s === 0 &&
          this._p.ms === 0
        ) {
          return this;
        }
      } else if (code === DATE || code === DAY) {
        if (this._p.H === 0 && this._p.m === 0 && this._p.s === 0 && this._p.ms === 0) {
          return this;
        }
      } else if (code === HOUR) {
        if (this._p.m === 0 && this._p.s === 0 && this._p.ms === 0) {
          return this;
        }
      } else if (code === MINUTE) {
        if (this._p.s === 0 && this._p.ms === 0) {
          return this;
        }
      } else if (code === SECOND) {
        if (this._p.ms === 0) {
          return this;
        }
      }
    }
    if (this._p.isUTC) {
      this._startOfUTC(code);
    } else {
      this._startOfLocal(code);
    }
    return this;
  }

  _startOfUTC(code: UnitCode): void {
    switch (code) {
      case YEAR:
        this._p.t = ymdToEpochDays(this._p.y, 0, 1) * DAY_MS;
        this._p.d = undefined;
        this._p.M = 0;
        this._p.D = 1;
        this._p.H = 0;
        this._p.m = 0;
        this._p.s = 0;
        this._p.ms = 0;
        this._p.W = _dayOfWeek(this._p.y, 0, 1);
        break;
      case MONTH:
        this._p.t = ymdToEpochDays(this._p.y, this._p.M, 1) * DAY_MS;
        this._p.d = undefined;
        this._p.D = 1;
        this._p.H = 0;
        this._p.m = 0;
        this._p.s = 0;
        this._p.ms = 0;
        this._p.W = _dayOfWeek(this._p.y, this._p.M, 1);
        break;
      case QUARTER:
      case WEEK:
      case ISO_WEEK:
        startOfExtraMoment(this, code);
        break;
      case DATE:
      case DAY:
        this._p.t = floorUnitEpoch(this._p.t, DAY_MS);
        this._p.d = undefined;
        this._p.H = 0;
        this._p.m = 0;
        this._p.s = 0;
        this._p.ms = 0;
        break;
      case HOUR:
        this._p.t = floorUnitEpoch(this._p.t, HOUR_MS);
        this._p.d = undefined;
        this._p.m = 0;
        this._p.s = 0;
        this._p.ms = 0;
        break;
      case MINUTE:
        this._p.t = floorUnitEpoch(this._p.t, MINUTE_MS);
        this._p.d = undefined;
        this._p.s = 0;
        this._p.ms = 0;
        break;
      case SECOND:
        this._p.t = floorUnitEpoch(this._p.t, SECOND_MS);
        this._p.d = undefined;
        this._p.ms = 0;
        break;
    }
    if (updateOffsetCallback) {
      this._updateOffset(true);
    }
  }

  _startOfLocal(code: UnitCode): void {
    const d = this._getDNoEnsure();
    switch (code) {
      case YEAR:
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        this._p.t = d.getTime();
        this._p.M = 0;
        this._p.D = 1;
        this._p.H = 0;
        this._p.m = 0;
        this._p.s = 0;
        this._p.ms = 0;
        this._p.W = d.getDay();
        break;
      case MONTH:
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        this._p.t = d.getTime();
        this._p.D = 1;
        this._p.H = 0;
        this._p.m = 0;
        this._p.s = 0;
        this._p.ms = 0;
        this._p.W = d.getDay();
        break;
      case QUARTER:
      case WEEK:
      case ISO_WEEK:
        startOfExtraMoment(this, code);
        break;
      case DATE:
      case DAY:
        d.setHours(0, 0, 0, 0);
        this._p.t = d.getTime();
        this._p.H = 0;
        this._p.m = 0;
        this._p.s = 0;
        this._p.ms = 0;
        break;
      case HOUR:
        d.setMinutes(0, 0, 0);
        this._p.t = d.getTime();
        this._p.m = 0;
        this._p.s = 0;
        this._p.ms = 0;
        break;
      case MINUTE:
        d.setSeconds(0, 0);
        this._p.t = d.getTime();
        this._p.s = 0;
        this._p.ms = 0;
        break;
      case SECOND:
        d.setMilliseconds(0);
        this._p.t = d.getTime();
        this._p.ms = 0;
        break;
    }
    this._p.offset = -d.getTimezoneOffset();
    if (updateOffsetCallback) {
      this._updateOffset(true);
    }
  }

  endOf(unit: string): this {
    const code = fastNormalizeBoundaryUnit(unit);
    if (code < 0) {
      return this;
    }
    if (!this._isValid) {
      return this;
    }
    this._ensureFields();
    if (!updateOffsetCallback && code === MONTH) {
      if (this._p.isUTC) {
        const endDay = daysInMonthFast(this._p.y, this._p.M);
        if (
          this._p.D === endDay &&
          this._p.H === 23 &&
          this._p.m === 59 &&
          this._p.s === 59 &&
          this._p.ms === 999
        ) {
          return this;
        }
      } else if (
        this._p.D === 1 &&
        this._p.H === 0 &&
        this._p.m === 0 &&
        this._p.s === 0 &&
        this._p.ms === 0
      ) {
        const endDay = daysInMonthFast(this._p.y, this._p.M);
        const d = new Date(this._p.y, this._p.M, endDay, 23, 59, 59, 999);
        this._p.d = d;
        this._p.t = d.getTime();
        this._p.D = endDay;
        this._p.H = 23;
        this._p.m = 59;
        this._p.s = 59;
        this._p.ms = 999;
        this._p.W = d.getDay();
        this._p.offset = -d.getTimezoneOffset();
        return this;
      }
    }
    if (this._p.isUTC) {
      this._endOfUTC(code);
    } else {
      this._endOfLocal(code);
    }
    return this;
  }

  _endOfUTC(code: UnitCode): void {
    switch (code) {
      case YEAR:
        this._p.t = (ymdToEpochDays(this._p.y, 11, 31) + 1) * DAY_MS - 1;
        this._p.d = undefined;
        this._p.M = 11;
        this._p.D = 31;
        this._p.H = 23;
        this._p.m = 59;
        this._p.s = 59;
        this._p.ms = 999;
        this._p.W = _dayOfWeek(this._p.y, 11, 31);
        break;
      case MONTH: {
        const _eomMaxDay = daysInMonthFast(this._p.y, this._p.M);
        this._p.t = (ymdToEpochDays(this._p.y, this._p.M, _eomMaxDay) + 1) * DAY_MS - 1;
        this._p.d = undefined;
        this._p.D = _eomMaxDay;
        this._p.H = 23;
        this._p.m = 59;
        this._p.s = 59;
        this._p.ms = 999;
        this._p.W = _dayOfWeek(this._p.y, this._p.M, _eomMaxDay);
        break;
      }
      case QUARTER:
      case WEEK:
      case ISO_WEEK:
        endOfExtraMoment(this, code);
        break;
      case DATE:
      case DAY:
        this._p.t = endOfUnitEpoch(this._p.t, DAY_MS);
        this._p.d = undefined;
        this._p.dirty = true;
        break;
      case HOUR:
        this._p.t = endOfUnitEpoch(this._p.t, HOUR_MS);
        this._p.d = undefined;
        this._p.dirty = true;
        break;
      case MINUTE:
        this._p.t = endOfUnitEpoch(this._p.t, MINUTE_MS);
        this._p.d = undefined;
        this._p.dirty = true;
        break;
      case SECOND:
        this._p.t = endOfUnitEpoch(this._p.t, SECOND_MS);
        this._p.d = undefined;
        this._p.dirty = true;
        break;
    }
    if (updateOffsetCallback) {
      this._updateOffset(true);
    }
  }

  _endOfLocal(code: UnitCode): void {
    const d = this._getDNoEnsure();
    switch (code) {
      case YEAR:
        d.setFullYear(this._p.y, 11, 31);
        d.setHours(23, 59, 59, 999);
        this._p.t = d.getTime();
        this._p.M = 11;
        this._p.D = 31;
        this._p.H = 23;
        this._p.m = 59;
        this._p.s = 59;
        this._p.ms = 999;
        this._p.W = d.getDay();
        break;
      case MONTH: {
        d.setMonth(this._p.M + 1, 0);
        d.setHours(23, 59, 59, 999);
        this._p.t = d.getTime();
        this._p.D = d.getDate();
        this._p.H = 23;
        this._p.m = 59;
        this._p.s = 59;
        this._p.ms = 999;
        this._p.W = d.getDay();
        break;
      }
      case QUARTER:
      case WEEK:
      case ISO_WEEK:
        endOfExtraMoment(this, code);
        break;
      case DATE:
      case DAY:
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 1);
        d.setMilliseconds(-1);
        this._p.D = d.getDate();
        this._p.H = d.getHours();
        this._p.m = d.getMinutes();
        this._p.s = d.getSeconds();
        this._p.ms = d.getMilliseconds();
        this._p.W = d.getDay();
        this._p.t = d.getTime();
        break;
      case HOUR:
        d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() + 1, 0, 0, -1);
        this._p.H = d.getHours();
        this._p.m = d.getMinutes();
        this._p.s = d.getSeconds();
        this._p.ms = d.getMilliseconds();
        this._p.t = d.getTime();
        break;
      case MINUTE:
        d.setSeconds(0, 0);
        d.setMinutes(d.getMinutes() + 1, 0, -1);
        this._p.m = d.getMinutes();
        this._p.s = d.getSeconds();
        this._p.ms = d.getMilliseconds();
        this._p.t = d.getTime();
        break;
      case SECOND:
        d.setSeconds(d.getSeconds() + 1, -1);
        this._p.s = d.getSeconds();
        this._p.ms = d.getMilliseconds();
        this._p.t = d.getTime();
        break;
    }
    this._p.offset = -d.getTimezoneOffset();
    if (updateOffsetCallback) {
      this._updateOffset(true);
    }
  }

  local(keepLocalTime?: boolean): this {
    if (!this._isValid) {
      return this;
    }
    // Already local, no keepLocalTime transform needed — skip callback entirely
    if (!this._p.isUTC && !keepLocalTime) {
      return this;
    }
    this._ensureFields();
    return localMoment(_cast<UtcMoment>(this), keepLocalTime) as this;
  }

  utc(keepLocalTime?: boolean): this {
    if (!this._isValid) {
      return this;
    }
    // Already pure UTC (offset 0), no keepLocalTime transform needed — skip callback
    if (this._p.isUTC && this._p.offset === 0 && !keepLocalTime) {
      return this;
    }
    this._ensureFields();
    return utcMoment(_cast<UtcMoment>(this), keepLocalTime) as this;
  }

  utcOffset(): number;
  utcOffset(offset: number | string, keepLocalTime?: boolean): this;
  utcOffset(offset?: number | string, keepLocalTime?: boolean): number | this {
    this._ensureFields();
    return utcOffsetMoment(_cast<UtcMoment>(this), offset, keepLocalTime) as number | this;
  }

  format(format?: string): string {
    if (!format) {
      if (this._p.isUTC && this._p.offset === 0) {
        format = _defaultFormatUtc;
      } else {
        format = _defaultFormat;
      }
    }
    const formatter = formatMomentCallback;
    if (!formatter) {
      throw new Error("mmntjs formatter is not initialized");
    }
    return formatter(this as unknown as FormattableMoment, format);
  }

  fromNow(pref?: boolean): string {
    if (!fromNowCallback) {
      throw new Error("mmntjs fromNow() is not initialized");
    }
    return fromNowCallback(this, pref);
  }

  from(input: MomentInput, pref?: boolean): string {
    if (!fromCallback) {
      throw new Error("mmntjs from() is not initialized");
    }
    return fromCallback(this, input, pref);
  }

  toNow(pref?: boolean): string {
    if (!toNowCallback) {
      throw new Error("mmntjs toNow() is not initialized");
    }
    return toNowCallback(this, pref);
  }

  to(input: MomentInput, pref?: boolean): string {
    if (!toCallback) {
      throw new Error("mmntjs to() is not initialized");
    }
    return toCallback(this, input, pref);
  }

  calendar(ref?: MomentInput, opts?: object): string {
    if (!calendarCallback) {
      throw new Error("mmntjs calendar() is not initialized");
    }
    return calendarCallback(this, ref, opts);
  }

  diff(input: MomentInput, unit?: string, float?: boolean): number {
    const other = momentFromAnything(input);
    if (!this._isValid || !other._isValid) {
      return NaN;
    }
    const isUTC = this._p.isUTC;
    const otherUTC = other._p.isUTC;
    const code = unit ? normalizeUnitCode(unit) : (INVALID_UNIT as -1);
    if (code < 0) {
      const a = isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
      const b = otherUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
      return a - b || 0;
    }

    switch (code) {
      case DATE:
      case DAY: {
        const a = isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
        const b = otherUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
        const zoneDelta = isUTC || otherUTC ? 0 : (other._p.offset - this._p.offset) * 60000;
        if (isUTC && otherUTC) {
          if (float) {
            return (a - b) / 86400000;
          }
          const days = Math.floor(a / 86400000) - Math.floor(b / 86400000);
          return days || 0;
        }
        const r = (a - b - zoneDelta) / 86400000;
        if (float) {
          return r;
        }
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return t || 0;
      }
      case HOUR:
      case MINUTE:
      case SECOND: {
        const a = isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
        const b = otherUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
        const r = (a - b) / TIME_UNIT_MS[code];
        if (float) {
          return r;
        }
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return t || 0;
      }
      case MILLISECOND: {
        const a = isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
        const b = otherUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
        const diffMs = a - b || 0;
        if (float) {
          return diffMs;
        }
        const t = diffMs < 0 ? -Math.floor(-diffMs) : Math.floor(diffMs);
        return t || 0;
      }
      case WEEK: {
        const a = isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
        const b = otherUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
        const zoneDelta = isUTC || otherUTC ? 0 : (other._p.offset - this._p.offset) * 60000;
        if (isUTC && otherUTC) {
          const days = Math.floor(a / 86400000) - Math.floor(b / 86400000);
          const r = days / 7;
          return float ? r : Math.trunc(r) || 0;
        }
        const r = (a - b - zoneDelta) / 604800000;
        if (float) {
          return r;
        }
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return t || 0;
      }
      case YEAR:
      case MONTH:
      case QUARTER: {
        this._ensureFields();
        other._ensureFields();

        const aDay = this._p.D;
        const bDay = other._p.D;
        const swap = aDay < bDay;
        const a = swap ? other : this;
        const b = swap ? this : other;

        const aYear = a._p.y;
        const aMonth = a._p.M;
        const aDayOf = a._p.D;
        const bYear = b._p.y;
        const bMonth = b._p.M;

        const wholeMonthDiff = (bYear - aYear) * 12 + (bMonth - aMonth);

        const anchorVal = anchorMs(
          aYear,
          aMonth,
          aDayOf,
          a._p.H,
          a._p.m,
          a._p.s,
          a._p.ms,
          a._p.isUTC,
          wholeMonthDiff,
        );
        if (!float) {
          let wholeMonths = -wholeMonthDiff;
          if (swap) {
            wholeMonths = -wholeMonths;
          }
          const bEpoch = b._p.isUTC ? b._p.t - b._p.offset * 60000 : b._p.t;
          const delta = swap ? anchorVal - bEpoch : bEpoch - anchorVal;
          if (wholeMonths > 0) {
            if (delta > 0) {
              wholeMonths -= 1;
            }
          } else if (wholeMonths < 0) {
            if (delta < 0) {
              wholeMonths += 1;
            }
          }
          if (code === MONTH) {
            return Object.is(wholeMonths, -0) ? 0 : wholeMonths;
          }
          const scaled = code === YEAR ? Math.trunc(wholeMonths / 12) : Math.trunc(wholeMonths / 3);
          return Object.is(scaled, -0) ? 0 : scaled;
        }

        const bEpoch = b._p.isUTC ? b._p.t - b._p.offset * 60000 : b._p.t;
        const sub = bEpoch - anchorVal;

        let adjust: number;
        if (sub < 0) {
          adjust =
            sub /
            (anchorVal -
              anchorMs(
                aYear,
                aMonth,
                aDayOf,
                a._p.H,
                a._p.m,
                a._p.s,
                a._p.ms,
                a._p.isUTC,
                wholeMonthDiff - 1,
              ));
        } else {
          adjust =
            sub /
            (anchorMs(
              aYear,
              aMonth,
              aDayOf,
              a._p.H,
              a._p.m,
              a._p.s,
              a._p.ms,
              a._p.isUTC,
              wholeMonthDiff + 1,
            ) -
              anchorVal);
        }

        let result = -(wholeMonthDiff + adjust);
        if (swap) {
          result = -result;
        }

        if (code === YEAR) {
          result /= 12;
        } else if (code === QUARTER) {
          result /= 3;
        }
        return result || 0;
      }
      default: {
        const a = isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
        const b = otherUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
        return a - b || 0;
      }
    }
  }

  valueOf(): number {
    if (!this._isValid) {
      return NaN;
    }
    if (this._p.isUTC) {
      return this._p.t - this._p.offset * 60000;
    }
    return this._p.t;
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
    return toArrayMoment(this);
  }

  toISOString(keepOffset?: boolean): string {
    if (!this._isValid) {
      return null as unknown as string;
    }
    if (keepOffset) {
      const d = this._getD();
      const year = this._p.isUTC ? d.getUTCFullYear() : d.getFullYear();
      const month = zeroFill((this._p.isUTC ? d.getUTCMonth() : d.getMonth()) + 1, 2);
      const day = zeroFill(this._p.isUTC ? d.getUTCDate() : d.getDate(), 2);
      const hour = zeroFill(this._p.isUTC ? d.getUTCHours() : d.getHours(), 2);
      const min = zeroFill(this._p.isUTC ? d.getUTCMinutes() : d.getMinutes(), 2);
      const sec = zeroFill(this._p.isUTC ? d.getUTCSeconds() : d.getSeconds(), 2);
      const ms = zeroFill(this._p.isUTC ? d.getUTCMilliseconds() : d.getMilliseconds(), 3);
      let offset: number;
      if (this._p.isUTC) {
        offset = this._p.offset;
      } else {
        offset = -d.getTimezoneOffset();
      }
      const sign = offset >= 0 ? "+" : "-";
      const absOffset = Math.abs(offset);
      const offsetStr = `${sign + zeroFill(Math.floor(absOffset / 60), 2)}:${zeroFill(absOffset % 60, 2)}`;
      let yearStr: string;
      if (year >= 0) {
        yearStr = year >= 10000 ? `+${zeroFill(year, 6)}` : zeroFill(year, 4);
      } else {
        yearStr = `-${zeroFill(-year, 6)}`;
      }
      return `${yearStr}-${month}-${day}T${hour}:${min}:${sec}.${ms}${offsetStr}`;
    }
    const utcMs = this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
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
        yearStr = `+${zeroFill(year, 6)}`;
      } else {
        yearStr = zeroFill(year, 4);
      }
    } else {
      yearStr = `-${zeroFill(-year, 6)}`;
    }

    return `${yearStr}-${month}-${day}T${hour}:${min}:${sec}.${ms}${offsetStr}`;
  }

  toJSON(): string {
    return this.toISOString();
  }

  toString(): string {
    return toStringMoment(this);
  }

  inspect(): string {
    return inspectMoment(this);
  }

  _compareCalendarValues(other: Moment, unit: string): number {
    const u = normalizeUnits(unit);
    if (!u) {
      return NaN;
    }
    if (u === "millisecond") {
      const a = this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
      const b = other._p.isUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
      return a - b;
    }
    if (u === "second") {
      const a = this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
      const b = other._p.isUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
      return Math.floor(a / 1000) - Math.floor(b / 1000);
    }
    if (u === "minute") {
      const a = this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
      const b = other._p.isUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
      return Math.floor(a / 60000) - Math.floor(b / 60000);
    }
    if (u === "hour") {
      const a = this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
      const b = other._p.isUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
      return Math.floor(a / 3600000) - Math.floor(b / 3600000);
    }
    switch (u) {
      case "year": {
        const d = this.year() - other.year();
        return d;
      }
      case "month": {
        const d = this.year() - other.year();
        if (d !== 0) {
          return d;
        }
        return this.month() - other.month();
      }
      case "quarter":
      case "week":
      case "isoWeek": {
        return calendarCompareMoment(this, other, u);
      }
      case "day":
      case "date":
      default: {
        if (this._p.isUTC && other._p.isUTC) {
          const thisDays = Math.floor((this._p.t - this._p.offset * 60000) / 86400000);
          const otherDays = Math.floor((other._p.t - other._p.offset * 60000) / 86400000);
          if (thisDays !== otherDays) {
            return thisDays - otherDays;
          }
        }
        const d = this.year() - other.year();
        if (d !== 0) {
          return d;
        }
        const d2 = this.month() - other.month();
        if (d2 !== 0) {
          return d2;
        }
        return this.date() - other.date();
      }
    }
  }

  isSame(input: MomentInput, unit?: string): boolean {
    const other = input instanceof Moment ? input : momentFromAnything(input);
    if (!this._isValid || !other._isValid) {
      return false;
    }
    if (unit) {
      return this._compareCalendarValues(other, unit) === 0;
    }
    const a = this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
    const b = other._p.isUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
    return a === b;
  }

  isSameOrBefore(input: MomentInput, unit?: string): boolean {
    const other = input instanceof Moment ? input : momentFromAnything(input);
    if (!this._isValid || !other._isValid) {
      return false;
    }
    return this._compareCalendarValues(other, unit ?? "millisecond") <= 0;
  }

  isSameOrAfter(input: MomentInput, unit?: string): boolean {
    const other = input instanceof Moment ? input : momentFromAnything(input);
    if (!this._isValid || !other._isValid) {
      return false;
    }
    return this._compareCalendarValues(other, unit ?? "millisecond") >= 0;
  }

  isBefore(input: MomentInput, unit?: string): boolean {
    const other = input instanceof Moment ? input : momentFromAnything(input);
    if (!this._isValid || !other._isValid) {
      return false;
    }
    if (unit) {
      return this._compareCalendarValues(other, unit) < 0;
    }
    const a = this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
    const b = other._p.isUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
    return a < b;
  }

  isAfter(input: MomentInput, unit?: string): boolean {
    const other = input instanceof Moment ? input : momentFromAnything(input);
    if (!this._isValid || !other._isValid) {
      return false;
    }
    if (unit) {
      return this._compareCalendarValues(other, unit) > 0;
    }
    const a = this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
    const b = other._p.isUTC ? other._p.t - other._p.offset * 60000 : other._p.t;
    return a > b;
  }

  isBetween(from: MomentInput, to: MomentInput, unit?: string, inclusivity?: string): boolean {
    const fromM = from instanceof Moment ? from : momentFromAnything(from);
    const toM = to instanceof Moment ? to : momentFromAnything(to);

    const fromStr = inclusivity ?? "()";
    const startOpen = fromStr[0] === "(";
    const endOpen = fromStr.at(-1) === ")";

    const startCheck = startOpen ? this.isAfter(fromM, unit) : this.isSameOrAfter(fromM, unit);
    const endCheck = endOpen ? this.isBefore(toM, unit) : this.isSameOrBefore(toM, unit);

    return startCheck && endCheck;
  }

  isLeapYear(): boolean {
    this._ensureFields();
    return !this._isValid ? false : isLeapYear(this._p.y);
  }

  isDST(): boolean {
    return isDSTMoment(_cast<UtcMoment>(this));
  }

  isLocal(): boolean {
    return isLocalMoment(_cast<UtcMoment>(this));
  }

  isUtc(): boolean {
    return isUtcMoment(_cast<UtcMoment>(this));
  }

  isUtcOffset(): boolean {
    return isUtcOffsetMoment(_cast<UtcMoment>(this));
  }

  isUTC(): boolean {
    return isUtcMoment(_cast<UtcMoment>(this));
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
    if (!this._isValid) {
      return w !== undefined ? this : NaN;
    }
    this._ensureFields();
    return localeWeek(_cast<LocaleAwareMoment>(this), w) as number | this;
  }

  weeks(): number;
  weeks(w: number): this;
  weeks(w?: number): number | this {
    return this.week(w as number);
  }

  max(other?: MomentInput): Moment {
    if (!this._isValid) {
      return this;
    }
    const otherM =
      other !== undefined
        ? momentFromAnything(other)
        : createSimpleMoment({ _t: nowFn ? nowFn() : Date.now() });
    if (!otherM._isValid) {
      return otherM;
    }
    if (otherM.valueOf() > this.valueOf()) {
      return otherM;
    }
    return this;
  }

  min(other?: MomentInput): Moment {
    if (!this._isValid) {
      return this;
    }
    const otherM =
      other !== undefined
        ? momentFromAnything(other)
        : createSimpleMoment({ _t: nowFn ? nowFn() : Date.now() });
    if (!otherM._isValid) {
      return otherM;
    }
    if (otherM.valueOf() < this.valueOf()) {
      return otherM;
    }
    return this;
  }

  weekYear(): number;
  weekYear(y: number): this;
  weekYear(y?: number): number | this {
    if (!this._isValid) {
      return y !== undefined ? this : NaN;
    }
    this._ensureFields();
    return localeWeekYear(_cast<LocaleAwareMoment>(this), y) as number | this;
  }

  isoWeek(): number;
  isoWeek(w: number): this;
  isoWeek(w?: number): number | this {
    if (!this._isValid) {
      return w !== undefined ? this : NaN;
    }
    this._ensureFields();
    return isoWeekMoment(_cast<CalendarAwareMoment>(this), w) as number | this;
  }

  isoWeeks(): number;
  isoWeeks(w: number): this;
  isoWeeks(w?: number): number | this {
    return this.isoWeek(w as number);
  }

  isoWeekYear(): number;
  isoWeekYear(y: number): this;
  isoWeekYear(y?: number): number | this {
    if (!this._isValid) {
      return y !== undefined ? this : NaN;
    }
    this._ensureFields();
    return isoWeekYearMoment(_cast<CalendarAwareMoment>(this), y) as number | this;
  }

  isoWeeksInYear(): number {
    if (!this._isValid) {
      return NaN;
    }
    return isoWeeksInYearMoment(_cast<CalendarAwareMoment>(this));
  }

  weeksInYear(): number {
    if (!this._isValid) {
      return NaN;
    }
    return localeWeeksInYear(_cast<LocaleAwareMoment>(this));
  }

  weeksInWeekYear(): number {
    if (!this._isValid) {
      return NaN;
    }
    return localeWeeksInWeekYear(_cast<LocaleAwareMoment>(this));
  }

  isoWeeksInISOWeekYear(): number {
    if (!this._isValid) {
      return NaN;
    }
    return isoWeeksInISOWeekYearMoment(_cast<CalendarAwareMoment>(this));
  }

  parseZone(input?: unknown, format?: unknown): this {
    if (input === undefined) {
      return parseZoneMoment(_cast<UtcMoment>(this), undefined, format) as this;
    }
    return parseZoneMoment(
      _cast<UtcMoment>(this),
      input,
      format,
      momentFromAnything as unknown as MomentFactory,
    ) as this;
  }

  zone(): number;
  zone(offset: number | string, keepLocalTime?: boolean): this;
  zone(offset?: number | string, keepLocalTime?: boolean): number | this {
    this._ensureFields();
    return zoneMoment(_cast<UtcMoment>(this), offset, keepLocalTime) as number | this;
  }

  zoneAbbr(): string {
    return zoneAbbrMoment(_cast<UtcMoment>(this));
  }

  zoneName(): string {
    return zoneNameMoment(_cast<UtcMoment>(this));
  }

  localeData(): Locale {
    return localeData(_cast<LocaleAwareMoment>(this));
  }

  lang(locale?: string | string[] | false): string | this {
    this._ensureFields();
    return localeMethodLang(_cast<LocaleAwareMoment>(this), locale, getCurrentLocale) as
      | string
      | this;
  }

  _trySetLocale(locale: string): boolean {
    const parts = locale.toLowerCase().replaceAll("_", "-").split("-");
    for (let j = parts.length; j > 0; j--) {
      const candidate = parts.slice(0, j).join("-");
      if (hasLocale(candidate) || hasLiteLocale(candidate)) {
        this._l = candidate;
        this._p.locale = undefined;
        return true;
      }
    }
    return false;
  }

  locale(locale?: string | string[] | false): string | this {
    this._ensureFields();
    return localeMethod(_cast<LocaleAwareMoment>(this), locale, getCurrentLocale) as string | this;
  }

  creationData(): Record<string, unknown> {
    return creationDataMoment(this);
  }

  parsingFlags(): Record<string, unknown> {
    return parsingFlagsMoment(this);
  }

  isDSTShifted(): boolean {
    return false;
  }

  hasAlignedHourOffset(other?: MomentInput): boolean {
    const otherMoment = other !== undefined ? momentFromAnything(other) : undefined;
    return hasAlignedHourOffsetMoment(_cast<UtcMoment>(this), otherMoment);
  }

  invalidAt(): number {
    return invalidAtMoment(this);
  }

  toObject(): Record<string, number> {
    return toObjectMoment(this);
  }

  toIsoString(): string {
    return this.toISOString();
  }
}

Object.defineProperty(Moment.prototype, "_isUTC", {
  get(this: Moment): boolean {
    return this._p.isUTC;
  },
  set(this: Moment, v: boolean) {
    this._p.isUTC = v;
  },
  enumerable: true,
  configurable: true,
});

function fastNormalizeBoundaryUnit(unit: string): UnitCode {
  switch (unit) {
    case "year":
    case "years":
      return YEAR;
    case "month":
    case "months":
      return MONTH;
    case "week":
    case "weeks":
      return WEEK;
    case "isoWeek":
      return ISO_WEEK;
    case "day":
    case "days":
      return DAY;
    case "date":
    case "dates":
      return DATE;
    case "hour":
    case "hours":
      return HOUR;
    case "minute":
    case "minutes":
      return MINUTE;
    case "second":
    case "seconds":
      return SECOND;
    case "quarter":
    case "quarters":
      return QUARTER;
    default:
      return normalizeUnitCode(unit);
  }
}

function createMomentShell(
  l: string | undefined,
  isUTC: boolean,
  offset: number,
  isValid: boolean,
): Moment {
  const m = Object.create(Moment.prototype) as Moment;
  m._isAMomentObject = true;
  m._l = l;
  m._p = {
    t: 0,
    d: undefined,
    dirty: false,
    isUTC,
    offset,
    locale: undefined,
    y: 0,
    M: 0,
    D: 0,
    W: 0,
    H: 0,
    m: 0,
    s: 0,
    ms: 0,
  };
  m._isValid = isValid;
  return m;
}

function initMomentMeta(
  m: Moment,
  config: {
    _i?: unknown;
    _f?: string | string[];
    _strict?: boolean;
  },
): void {
  if (config._i !== undefined) {
    m._i = config._i;
  }
  if (config._f !== undefined) {
    m._f = config._f;
  }
  if (config._strict !== undefined) {
    m._strict = config._strict;
  }
}

export function createMomentFromDate(config: {
  _d: Date;
  _i?: unknown;
  _f?: string | string[];
  _l?: string;
  _isUTC?: boolean;
  _offset?: number;
  _strict?: boolean;
  _isValid?: boolean;
  _dClone?: boolean;
}): Moment {
  const isUTC = !!config._isUTC;
  const d = config._dClone === false ? config._d : new Date(config._d);
  const t = d.getTime();
  const isValid = config._isValid ?? !isNaN(t);
  const m = createMomentShell(config._l ?? getCurrentLocale(), isUTC, config._offset ?? 0, isValid);
  m._p.d = d;
  m._p.t = t;
  if (isValid) {
    m._p.dirty = true;
    if (!isUTC) {
      m._p.offset = -d.getTimezoneOffset();
    }
  }
  initMomentMeta(m, config);
  return m;
}

export function createSimpleMoment(config: {
  _t: number;
  _i?: unknown;
  _f?: string | string[];
  _l?: string;
  _isUTC?: boolean;
  _offset?: number;
  _isValid?: boolean;
}): Moment {
  const isUTC = !!config._isUTC;
  const t = config._t;
  const isValid = config._isValid ?? !isNaN(t);
  const m = createMomentShell(config._l ?? getCurrentLocale(), isUTC, config._offset ?? 0, isValid);
  m._p.t = t;
  if (isValid) {
    m._p.dirty = true;
    if (!isUTC) {
      m._p.d = new Date(t);
      m._p.offset = -m._p.d.getTimezoneOffset();
    }
  }
  initMomentMeta(m, config);
  return m;
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

/** @public */
export let nowFn: (() => number) | undefined = Date.now;

// eslint-disable-next-line max-params
function anchorMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  min: number,
  sec: number,
  ms: number,
  utc: boolean,
  n: number,
): number {
  const tm = year * 12 + month + n;
  const y = Math.floor(tm / 12);
  const m = normalizeMonth(tm);
  const maxDay = daysInMonth(y, m);
  const d = day > maxDay ? maxDay : day;
  if (utc) {
    return Date.UTC(y, m, d, hour, min, sec, ms);
  }
  return new Date(y, m, d, hour, min, sec, ms).getTime();
}

export function checkOverflow(parsed: Record<string, unknown> | ParsedData): number {
  if (parsed.month != null && ((parsed.month as number) < 0 || (parsed.month as number) > 11)) {
    return 1;
  }
  if (parsed.day != null) {
    const maxDay = daysInMonth(
      parsed.year != null ? (parsed.year as number) : 2000,
      parsed.month != null ? (parsed.month as number) : 0,
    );
    if ((parsed.day as number) < 1 || (parsed.day as number) > maxDay) {
      return 2;
    }
  }
  if (parsed.hour != null && ((parsed.hour as number) < 0 || (parsed.hour as number) > 24)) {
    return 3;
  }
  if ((parsed.hour as number) === 24 && (parsed.minute || parsed.second || parsed.millisecond)) {
    return 3;
  }
  if (parsed.minute != null && ((parsed.minute as number) < 0 || (parsed.minute as number) > 59)) {
    return 4;
  }
  if (parsed.second != null && ((parsed.second as number) < 0 || (parsed.second as number) > 59)) {
    return 5;
  }
  if (
    parsed.millisecond != null &&
    ((parsed.millisecond as number) < 0 || (parsed.millisecond as number) > 999)
  ) {
    return 6;
  }
  if (parsed.isoWeek != null && parsed.isoWeekYear != null) {
    const maxWeek = weeksInYear(parsed.isoWeekYear as number, 1, 4, true);
    if ((parsed.isoWeek as number) < 1 || (parsed.isoWeek as number) > maxWeek) {
      return 7;
    }
  }
  if (parsed._weekYear != null && parsed._week != null && parsed.month === undefined) {
    if ((parsed._week as number) < 1) {
      return 7;
    }
  }
  if (parsed._localeWeekday != null) {
    if ((parsed._localeWeekday as number) < 0 || (parsed._localeWeekday as number) > 6) {
      return 8;
    }
  }
  if (parsed._weekdayNum != null) {
    if (parsed.isoWeek != null) {
      if ((parsed._weekdayNum as number) < 1 || (parsed._weekdayNum as number) > 7) {
        return 8;
      }
    } else if (parsed._localeWeekday === undefined) {
      if ((parsed._weekdayNum as number) < 0 || (parsed._weekdayNum as number) > 6) {
        return 8;
      }
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
    if (isUTC && !input._p.isUTC) {
      const m = new Moment(input);
      m.utc();
      return m;
    }
    return input;
  }
  if (isDate(input)) {
    const m = createMomentFromDate({ _d: input });
    if (isUTC) {
      m.utc();
    }
    return m;
  }
  if (input === null) {
    return new Moment({ _dClone: false, _d: new Date(NaN), _i: null, _isValid: false });
  }
  if (input === undefined) {
    const m = createSimpleMoment({ _t: nowFn ? nowFn() : Date.now() });
    if (isUTC) {
      m.utc();
    }
    return m;
  }
  if (typeof input === "string") {
    const currentLocale = getCurrentLocale();
    const parsed = parseString(
      input,
      undefined,
      getLocale(currentLocale) as unknown as ParseLocale,
    );
    if (parsed && hasAnyValue(parsed)) {
      const hasOffset = parsed.offset !== undefined;
      const m = createMomentFromDate({
        _d: createDateSafe(
          parsed.year ?? 0,
          parsed.month ?? 0,
          parsed.day ?? 1,
          parsed.hour ?? 0,
          parsed.minute ?? 0,
          parsed.second ?? 0,
          parsed.millisecond ?? 0,
          hasOffset || isUTC,
        ),
        _isUTC: hasOffset || isUTC ? true : undefined,
        _offset: hasOffset ? parsed.offset : undefined,
        _i: input,
        _dClone: false,
      });
      // When parsed has an offset, set it directly (don't call .utc() as it recomputes)
      if (isUTC && !hasOffset) {
        m.utc();
      }
      return m;
    }
    const m = createMomentFromDate({ _d: new Date(input), _i: input, _dClone: false });
    if (isUTC) {
      m.utc();
    }
    return m;
  }
  if (typeof input === "number") {
    if (!isFinite(input)) {
      return new Moment({ _dClone: false, _d: new Date(NaN), _i: input, _isValid: false });
    }
    const m = createSimpleMoment({ _t: input });
    if (isUTC) {
      m.utc();
    }
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
      return new Moment({
        _d: new Date(ts),
        _i: input,
        _parsedDateParts: input as number[],
        _dClone: false,
      });
    }
    return new Moment({ _d: new Date(NaN), _dClone: false, _isValid: false });
  }
  if (typeof input === "object" && !isMoment(input)) {
    const obj = input as Record<string, unknown>;
    const parsed = parseObject(obj);
    if (parsed.year != null || parsed.month != null || parsed.day != null) {
      const now = new Date();
      const y = parsed.year ?? now.getFullYear();
      const mo = parsed.month ?? 0;
      const d = parsed.day ?? 1;
      const h = parsed.hour ?? 0;
      const min = parsed.minute ?? 0;
      const s = parsed.second ?? 0;
      const ms = parsed.millisecond ?? 0;
      return new Moment({ _d: new Date(y, mo, d, h, min, s, ms), _i: input, _dClone: false });
    }
    const m = new Moment(input);
    if (isUTC) {
      m.utc();
    }
    return m;
  }
  return new Moment({ _d: new Date(NaN), _dClone: false, _isValid: false });
}
