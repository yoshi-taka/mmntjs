import { getLiteLocale, getLiteCurrentLocale } from "./locale-lite";
import type { LiteLocale as Locale } from "./locale-lite";
import type { DurationInput } from "./duration";
import { isObject, isDate, isMoment, hasOwnProp, zeroFill, createDateSafe } from "./utils";
import {
  DAY_MS,
  endOfUnitEpoch,
  euclideanModulo,
  floorUnitEpoch,
  HOUR_MS,
  MINUTE_MS,
  normalizeUnits,
  normalizeUnitCode,
  normalizeMonth,
  daysInMonth,
  daysInMonthFast,
  isLeapYear,
  SECOND_MS,
  ymdToEpochDays,
  YEAR,
  MONTH,
  DATE,
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  MILLISECOND,
  WEEK,
  QUARTER,
  narrowCommonUnit,
  weeksInYear,
  getDayOfYear,
  getISOWeekNumber,
  getISOWeekYear,
  getLocaleWeek,
} from "./units";
import { parseString, type ParsedData } from "./parse-lite";
import { formatMomentBasic } from "./display/format-basic";
import type { ParseLocale } from "./parse-locale";
import type { FormattableMoment } from "./display/types";
import { refineHour, refineMinute, refineSecond, refineMs } from "./types";
import type {
  OrdinaryHour,
  OrdinaryMinute,
  OrdinarySecond,
  OrdinaryMillisecond,
  OrdinaryMonth,
  OrdinaryDate28,
  IntegerAmount,
  CleanUTC,
  CleanUTCWithOffset,
  UnitCode,
} from "./types";

// ---- Category-theory-inspired refinement types & morphisms (lite) ----

type _P = MomentLite["_p"];

function isCleanLocalWithDate(p: _P): p is _P & { dirty: false; d: Date } {
  return !p.dirty && p.d != null && !p.isUTC;
}

function isCleanUTC(p: _P): p is _P & CleanUTC {
  return !p.dirty && p.isUTC;
}

function isCleanUTCWithOffset(p: _P): p is _P & CleanUTCWithOffset {
  return !p.dirty && p.isUTC && p.offset !== 0;
}

// ---- Fast mutation morphisms (lite: no _tStale) ----

/** hour [0,23] → epoch delta arithmetic with DST guard.
 *  UTC: pure arithmetic, no Date allocation.
 *  Local: epoch delta + offset verification. */
function setHourFast(p: _P, h: OrdinaryHour): void {
  if (p.isUTC) {
    p.t += (h - p.H) * HOUR_MS;
    p.H = h;
    p.d = undefined;
    return;
  }
  // Local: need p.t fresh — fall back if dirty
  if (p.dirty) {
    p.H = h;
    return;
  }
  const delta = (h - p.H) * HOUR_MS;
  const newT = p.t + delta;
  if (_tzOffsetAt(newT) === p.offset) {
    // Same DST offset → pure arithmetic (no allocation)
    p.t = newT;
    p.H = h;
    if (p.d) {
      p.d.setTime(p.t);
    }
    return;
  }
  // DST transition — Date path (cold)
  if (p.d) {
    p.d.setHours(h);
    p.t = p.d.getTime();
    p.offset = -p.d.getTimezoneOffset();
    p.H = p.d.getHours();
  } else {
    const d = new Date(p.t);
    d.setHours(h);
    p.t = d.getTime();
    p.d = d;
    p.offset = -d.getTimezoneOffset();
    p.H = d.getHours();
  }
}

function setMinuteFast(p: _P & { d: Date }, m: OrdinaryMinute): void {
  p.t += (m - p.m) * 60000;
  p.m = m;
  p.d.setTime(p.t);
}
function setSecondFast(p: _P & { d: Date }, s: OrdinarySecond): void {
  p.t += (s - p.s) * 1000;
  p.s = s;
  p.d.setTime(p.t);
}
function setMsFast(p: _P & { d: Date }, ms: OrdinaryMillisecond): void {
  p.t += ms - p.ms;
  p.ms = ms;
  p.d.setTime(p.t);
}

// ---- Typed fast kernels (lite: no _tStale) ----

/** addMsFast (lite) — add integer ms on CleanUTC or CleanLocalWithDate.
 *  Precondition: amount is an integer (already refined).
 *  After t mutation, fields are stale → mark dirty. */
function addMsFastLite(
  p: _P & (CleanUTC | { dirty: false; d: Date; isUTC: false }),
  amount: IntegerAmount,
): void {
  p.t += amount;
  p.d = undefined;
  (p as { dirty: boolean }).dirty = true;
}

/** setMonthDateFast (lite) — simultaneously set month [0,11] + date [1,28]
 *  on CleanUTC. No month-boundary risk because date ≤ 28 is safe for all months. */
function setMonthDateFastLite(p: _P & CleanUTC, month: OrdinaryMonth, date: OrdinaryDate28): void {
  p.t =
    ymdToEpochDays(p.y, month, date) * DAY_MS +
    (p.H * HOUR_MS + p.m * MINUTE_MS + p.s * 1000 + p.ms);
  p.M = month;
  p.D = date;
  p.W = (() => {
    const y = p.y - (month < 2 ? 1 : 0);
    const era = Math.floor(y / 400);
    const yoe = y - era * 400;
    const mp = month >= 2 ? month - 2 : month + 10;
    const doy = Math.floor((153 * mp + 2) / 5) + date - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    const totalDays = era * 146097 + doe - 719468;
    return (((totalDays + 4) % 7) + 7) % 7;
  })();
  p.d = undefined;
}

/** startOfDayZonedFast (lite) — reset time to midnight for CleanUTCWithOffset.
 *  Re-derives y/M/D from the new epoch (may cross date boundary).
 *  No Date allocation. */
function startOfDayZonedFastLite(p: _P & CleanUTCWithOffset): void {
  if (p.H === 0 && p.m === 0 && p.s === 0 && p.ms === 0) {
    return;
  }
  const utcMidnight = ymdToEpochDays(p.y, p.M, p.D) * DAY_MS;
  p.t = utcMidnight - p.offset * MINUTE_MS;
  const totalDays = Math.floor((p.t + p.offset * MINUTE_MS) / DAY_MS);
  [p.y, p.M, p.D] = epochDaysToYMD(totalDays);
  p.W = (((totalDays + 4) % 7) + 7) % 7;
  p.H = 0;
  p.m = 0;
  p.s = 0;
  p.ms = 0;
  p.d = undefined;
}

const TIME_UNIT_MS: Record<number, number> = {
  [HOUR]: HOUR_MS,
  [MINUTE]: MINUTE_MS,
  [SECOND]: SECOND_MS,
  [MILLISECOND]: 1,
};

export type MomentInput =
  | MomentLite
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
  _meridiem?: string;
  _empty?: boolean;
  _parsedDateParts?: number[];
  _unusedTokens?: string[];
  _unusedInput?: string[];
  _charsLeftOver?: number;
  _userInvalidated?: boolean;
  _t?: number;
  _presetFields?: { y: number; M: number; D: number; H: number; m: number; s: number; ms: number };
}

const _DOW_OFFSET = new Uint8Array([0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]);

function _dayOfWeek(y: number, m: number, d: number): number {
  y -= m < 3 ? 1 : 0;
  return euclideanModulo(
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + _DOW_OFFSET[m] + d) | 0,
    7,
  );
}

// Reusable probe Date for lightweight offset verification (no allocation)
const _probeDate = new Date(0);
const _probeCache = { t: NaN, offset: NaN };
function epochDaysToYMD(z: number): [number, number, number] {
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

function _tzOffsetAt(t: number): number {
  if (t === _probeCache.t) {
    return _probeCache.offset;
  }
  _probeDate.setTime(t);
  _probeCache.t = t;
  _probeCache.offset = -_probeDate.getTimezoneOffset();
  return _probeCache.offset;
}

function valueOfInput(input: unknown): number {
  if (input instanceof MomentLite) {
    return input.valueOf();
  }
  if (isMoment(input)) {
    return (
      (input as unknown as { _t: number; _offset: number; _isUTC: boolean })._t -
      (input as unknown as { _offset: number })._offset * 60000
    );
  }
  if (isDate(input)) {
    return input.getTime();
  }
  if (typeof input === "number") {
    if (!isFinite(input)) {
      return NaN;
    }
    return input;
  }
  if (typeof input === "string") {
    const locale = getLiteCurrentLocale();
    const parsed = parseString(input, undefined, getLiteLocale(locale) as unknown as ParseLocale);
    if (parsed && !(parsed as unknown as { _claimed?: boolean })._claimed) {
      const hasOffset = parsed.offset !== undefined;
      const d = createDateSafe(
        parsed.year ?? 0,
        parsed.month ?? 0,
        parsed.day ?? 1,
        parsed.hour ?? 0,
        parsed.minute ?? 0,
        parsed.second ?? 0,
        parsed.millisecond ?? 0,
        hasOffset,
      );
      // When string has offset, adjust epoch so valueOf returns correct UTC
      return hasOffset ? d.getTime() - parsed.offset! * 60000 : d.getTime();
    }
    return new Date(input).getTime();
  }
  return NaN;
}

function isDurationLike(input: unknown): input is {
  _ms?: number;
  _milliseconds?: number;
  _days?: number;
  _months?: number;
  valueOf(): number;
} {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as { valueOf?: unknown }).valueOf === "function" &&
    ("_ms" in input || "_milliseconds" in input || "_days" in input || "_months" in input)
  );
}

export class MomentLite {
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
  _cold?: Record<string, unknown>;
  _i: unknown;
  _f: string | string[] | undefined;
  _strict?: boolean;

  private static _epochDaysToYMD(z: number): [number, number, number] {
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

  private _ensureFields(): void {
    if (this._p.dirty) {
      this._p.dirty = false;
      this._refreshFields();
    }
  }

  private _getD(): Date {
    if (this._p.dirty) {
      this._p.dirty = false;
      this._refreshFields();
    }
    if (this._p.d) {
      return this._p.d;
    }
    this._p.d = new Date(this._p.t);
    return this._p.d;
  }

  private _getDNoEnsure(): Date {
    if (this._p.d) {
      return this._p.d;
    }
    this._p.d = new Date(this._p.t);
    return this._p.d;
  }

  private _refreshFields(): void {
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
        const totalDays = Math.floor(t / 86400000);
        const totalSec = Math.floor(t / 1000);
        this._p.W = euclideanModulo(totalDays + 4, 7);
        const [y, M, D] = MomentLite._epochDaysToYMD(totalDays);
        this._p.y = y;
        this._p.M = M;
        this._p.D = D;
        this._p.H = euclideanModulo(Math.floor(totalSec / 3600), 24);
        this._p.m = euclideanModulo(Math.floor(totalSec / 60), 60);
        this._p.s = euclideanModulo(totalSec, 60);
        this._p.ms = euclideanModulo(t, 1000);
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

  private _getLocale(): Locale {
    this._p.locale ??= getLiteLocale(this._l);
    return this._p.locale;
  }

  constructor(config: MomentConstructionConfig = {}) {
    const c = config;
    this._isAMomentObject = true;
    this._l = c._l ?? getLiteCurrentLocale();
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
    if (c._presetFields) {
      const f = c._presetFields;
      this._p.y = f.y;
      this._p.M = f.M;
      this._p.D = f.D;
      this._p.W = this._p.d ? (this._p.isUTC ? this._p.d.getUTCDay() : this._p.d.getDay()) : 0;
      this._p.H = f.H;
      this._p.m = f.m;
      this._p.s = f.s;
      this._p.ms = f.ms;
      this._p.offset = this._p.d ? (this._p.isUTC ? 0 : -this._p.d.getTimezoneOffset()) : 0;
      this._p.dirty = false;
    } else if (this._isValid) {
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
    const hasExtraCold = Object.keys(c).some(
      (key) =>
        key.startsWith("_") &&
        ![
          "_d",
          "_dClone",
          "_isValid",
          "_isUTC",
          "_offset",
          "_t",
          "_i",
          "_f",
          "_l",
          "_strict",
          "_presetFields",
        ].includes(key),
    );
    if (
      c._overflow !== undefined ||
      c._empty !== undefined ||
      c._nullInput !== undefined ||
      c._invalidMonth !== undefined ||
      c._userInvalidated !== undefined ||
      hasExtraCold
    ) {
      this._initCold(c);
    }
  }

  private _initCold(c: MomentConstructionConfig): void {
    const cold: Record<string, unknown> = {};
    if (c._overflow !== undefined) {
      cold._overflow = c._overflow;
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
    if (c._userInvalidated !== undefined) {
      cold._userInvalidated = c._userInvalidated;
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
    for (const [key, value] of Object.entries(c)) {
      if (
        key.startsWith("_") &&
        ![
          "_d",
          "_dClone",
          "_isValid",
          "_isUTC",
          "_offset",
          "_t",
          "_i",
          "_f",
          "_l",
          "_strict",
          "_overflow",
          "_empty",
          "_nullInput",
          "_invalidMonth",
          "_userInvalidated",
          "_unusedTokens",
          "_unusedInput",
          "_charsLeftOver",
        ].includes(key) &&
        value !== undefined
      ) {
        cold[key] = value;
      }
    }
    this._cold = cold;
    const hasError =
      (c._overflow !== undefined && c._overflow >= 0) ||
      c._empty === true ||
      c._nullInput === true ||
      (c._invalidMonth !== undefined && c._invalidMonth !== null) ||
      c._userInvalidated !== undefined;
    if (hasError) {
      this._p.dirty = false;
    }
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
    return true;
  }

  clone(): this {
    return this._cloneFast();
  }

  /** Fast clone — no _cold copy, no _i/_f/_strict copy.
   *  Safe when caller does not need _cold metadata. */
  _cloneFast(): this {
    const p = this._p;
    const m = Object.create(MomentLite.prototype) as this;
    m._isAMomentObject = true;
    m._l = this._l;
    m._p = {
      t: p.t,
      d: p.d ? new Date(p.t) : undefined,
      dirty: false,
      isUTC: p.isUTC,
      offset: p.offset,
      locale: p.locale,
      y: p.y,
      M: p.M,
      D: p.D,
      W: p.W,
      H: p.H,
      m: p.m,
      s: p.s,
      ms: p.ms,
    };
    m._isValid = this._isValid;
    m._i = this._i;
    m._f = this._f;
    m._strict = this._strict;
    return m;
  }

  valueOf(): number {
    return this._valueOfFast();
  }

  /** Fast valueOf — skips _tStale check (lite has none always clean). */
  _valueOfFast(): number {
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

  toDate(): Date {
    return new Date(this.valueOf());
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
      const offset = this._p.isUTC ? this._p.offset : -d.getTimezoneOffset();
      const sign = offset >= 0 ? "+" : "-";
      const absOffset = Math.abs(offset);
      const offsetStr = `${sign + zeroFill(Math.floor(absOffset / 60), 2)}:${zeroFill(absOffset % 60, 2)}`;
      const yearStr =
        year >= 0
          ? year >= 10000
            ? `+${zeroFill(year, 6)}`
            : zeroFill(year, 4)
          : `-${zeroFill(-year, 6)}`;
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
    const yearStr =
      year >= 0
        ? year >= 10000
          ? `+${zeroFill(year, 6)}`
          : zeroFill(year, 4)
        : `-${zeroFill(-year, 6)}`;
    return `${yearStr}-${month}-${day}T${hour}:${min}:${sec}.${ms}Z`;
  }

  toJSON(): string {
    return this.toISOString();
  }

  toIsoString(): string {
    return this.toISOString();
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
      const dt = this._getD();
      const date = this._p.D;
      const utc = this._p.isUTC;
      if (utc) {
        dt.setUTCFullYear(num);
      } else {
        dt.setFullYear(num);
      }
      // D ≤ 28: no clamping possible (all months have 28+ days)
      if (date > 28 && (utc ? dt.getUTCDate() : dt.getDate()) !== date) {
        if (utc) {
          dt.setUTCDate(0);
        } else {
          dt.setDate(0);
        }
      }
      this._p.y = num;
      this._p.M = utc ? dt.getUTCMonth() : dt.getMonth();
      this._p.D = utc ? dt.getUTCDate() : dt.getDate();
      this._p.W = _dayOfWeek(this._p.y, this._p.M, this._p.D);
      this._p.t = dt.getTime();
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    const d = this._getDNoEnsure();
    return this._p.isUTC ? d.getUTCFullYear() : d.getFullYear();
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
      const date = this._p.D;
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCMonth(num);
      } else {
        dt.setMonth(num);
      }
      if ((this._p.isUTC ? dt.getUTCDate() : dt.getDate()) !== date) {
        if (this._p.isUTC) {
          dt.setUTCDate(0);
        } else {
          dt.setDate(0);
        }
      }
      this._p.y = this._p.isUTC ? dt.getUTCFullYear() : dt.getFullYear();
      this._p.M = this._p.isUTC ? dt.getUTCMonth() : dt.getMonth();
      this._p.D = this._p.isUTC ? dt.getUTCDate() : dt.getDate();
      this._p.W = _dayOfWeek(this._p.y, this._p.M, this._p.D);
      this._p.t = dt.getTime();
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
      const p = this._p;
      let dt: Date;
      // Fast path: clean + p.d present
      if (!p.dirty && p.d != null) {
        dt = p.d;
      } else {
        if (p.dirty) {
          p.dirty = false;
          this._refreshFields();
        }
        dt = p.d ?? (p.d = new Date(p.t));
      }
      if (p.isUTC) {
        dt.setUTCDate(num);
      } else {
        dt.setDate(num);
      }
      p.D = p.isUTC ? dt.getUTCDate() : dt.getDate();
      p.M = p.isUTC ? dt.getUTCMonth() : dt.getMonth();
      p.W = _dayOfWeek(p.y, p.M, p.D);
      p.t = dt.getTime();
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    const _dd = this._getDNoEnsure();
    return this._p.isUTC ? _dd.getUTCDate() : _dd.getDate();
  }

  day(): number;
  day(d: unknown): this;
  day(d?: unknown): number | this {
    if (d !== undefined) {
      this._ensureFields();
      let dayNum = Number(d);
      if (typeof d === "string") {
        const lower = d.toLowerCase();
        const localeDaysFull = this._getLocale().weekdaysArray();
        for (let di = 0; di < localeDaysFull.length; di++) {
          if (localeDaysFull[di].toLowerCase() === lower) {
            dayNum = di % 7;
            break;
          }
        }
      }
      if (isNaN(dayNum)) {
        return this;
      }
      const diff = dayNum - this._p.W;
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff);
      } else {
        dt.setDate(dt.getDate() + diff);
      }
      this._p.D = this._p.isUTC ? dt.getUTCDate() : dt.getDate();
      this._p.M = this._p.isUTC ? dt.getUTCMonth() : dt.getMonth();
      this._p.W = _dayOfWeek(this._p.y, this._p.M, this._p.D);
      this._p.t = dt.getTime();
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    const _dd = this._getDNoEnsure();
    return this._p.isUTC ? _dd.getUTCDay() : _dd.getDay();
  }

  hour(): number;
  hour(h: unknown): this;
  hour(h?: unknown): number | this {
    if (h !== undefined) {
      if (h === null) {
        return this;
      }
      const p = this._p;
      const refined = refineHour(h);
      // Fast path: clean state → setHourFast (epoch delta + DST guard)
      if (refined !== null && !p.dirty) {
        if (refined === p.H) {
          return this;
        }
        setHourFast(p, refined);
        return this;
      }
      const num = refined ?? Number(h);
      if (isNaN(num)) {
        return this;
      }
      // Slow path: refresh dirty + allocate Date if needed
      if (p.dirty) {
        p.dirty = false;
        this._refreshFields();
      }
      if (num === p.H) {
        return this;
      }
      const d = p.d ?? (p.d = new Date(p.t));
      if (p.isUTC) {
        d.setUTCHours(num);
        p.H = d.getUTCHours();
      } else {
        d.setHours(num);
        p.H = d.getHours();
      }
      p.t = d.getTime();
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    const d = this._getDNoEnsure();
    return this._p.isUTC ? d.getUTCHours() : d.getHours();
  }

  minute(): number;
  minute(m: unknown): this;
  minute(m?: unknown): number | this {
    if (m !== undefined) {
      if (m === null) {
        return this;
      }
      const p = this._p;
      const refined = refineMinute(m);
      if (refined !== null && isCleanLocalWithDate(p)) {
        if (refined === p.m) {
          return this;
        }
        setMinuteFast(p, refined);
        return this;
      }
      const num = refined ?? Number(m);
      if (isNaN(num)) {
        return this;
      }
      if (p.dirty) {
        p.dirty = false;
        this._refreshFields();
      }
      if (num === p.m) {
        return this;
      }
      const d = p.d ?? (p.d = new Date(p.t));
      if (p.isUTC) {
        d.setUTCMinutes(num);
        p.m = d.getUTCMinutes();
      } else {
        d.setMinutes(num);
        p.m = d.getMinutes();
      }
      p.t = d.getTime();
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    const d = this._getDNoEnsure();
    return this._p.isUTC ? d.getUTCMinutes() : d.getMinutes();
  }

  second(): number;
  second(s: unknown): this;
  second(s?: unknown): number | this {
    if (s !== undefined) {
      if (s === null) {
        return this;
      }
      const p = this._p;
      const refined = refineSecond(s);
      if (refined !== null && isCleanLocalWithDate(p)) {
        if (refined === p.s) {
          return this;
        }
        setSecondFast(p, refined);
        return this;
      }
      const num = refined ?? Number(s);
      if (isNaN(num)) {
        return this;
      }
      if (p.dirty) {
        p.dirty = false;
        this._refreshFields();
      }
      if (num === p.s) {
        return this;
      }
      const d = p.d ?? (p.d = new Date(p.t));
      if (p.isUTC) {
        d.setUTCSeconds(num);
        p.s = d.getUTCSeconds();
      } else {
        d.setSeconds(num);
        p.s = d.getSeconds();
      }
      p.t = d.getTime();
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    const d = this._getDNoEnsure();
    return this._p.isUTC ? d.getUTCSeconds() : d.getSeconds();
  }

  millisecond(): number;
  millisecond(ms: unknown): this;
  millisecond(ms?: unknown): number | this {
    if (ms !== undefined) {
      if (ms === null) {
        return this;
      }
      const p = this._p;
      const refined = refineMs(ms);
      if (refined !== null && isCleanLocalWithDate(p)) {
        if (refined === p.ms) {
          return this;
        }
        setMsFast(p, refined);
        return this;
      }
      const num = refined ?? Number(ms);
      if (isNaN(num)) {
        return this;
      }
      if (p.dirty) {
        p.dirty = false;
        this._refreshFields();
      }
      if (num === p.ms) {
        return this;
      }
      const d = p.d ?? (p.d = new Date(p.t));
      if (p.isUTC) {
        d.setUTCMilliseconds(num);
        p.ms = d.getUTCMilliseconds();
      } else {
        d.setMilliseconds(num);
        p.ms = d.getMilliseconds();
      }
      p.t = d.getTime();
      return this;
    }
    if (!this._isValid) {
      return NaN;
    }
    const d = this._getDNoEnsure();
    return this._p.isUTC ? d.getUTCMilliseconds() : d.getMilliseconds();
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
      case "quarter":
        return this.quarter();
      case "week":
        return this.week();
      case "isoWeek":
        return this.isoWeek();
      case "weekday":
        return this.weekday();
      case "isoWeekday":
        this._ensureFields();
        return ((this._p.W + 6) % 7) + 1;
      case "dayOfYear":
        return this.dayOfYear();
      case "isoWeekYear":
        return this.isoWeekYear();
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
          ? Number(obj.year ?? obj.years ?? obj.y)
          : undefined;
      const monthVal =
        hasOwnProp(obj, "month") || hasOwnProp(obj, "months") || hasOwnProp(obj, "M")
          ? Number(obj.month ?? obj.months ?? obj.M)
          : undefined;
      const dateVal =
        hasOwnProp(obj, "date") ||
        hasOwnProp(obj, "dates") ||
        hasOwnProp(obj, "day") ||
        hasOwnProp(obj, "days") ||
        hasOwnProp(obj, "d")
          ? Number(obj.date ?? obj.dates ?? obj.day ?? obj.days ?? obj.d)
          : undefined;
      const hourVal =
        hasOwnProp(obj, "hour") || hasOwnProp(obj, "hours") || hasOwnProp(obj, "h")
          ? Number(obj.hour ?? obj.hours ?? obj.h)
          : undefined;
      const minuteVal =
        hasOwnProp(obj, "minute") || hasOwnProp(obj, "minutes") || hasOwnProp(obj, "m")
          ? Number(obj.minute ?? obj.minutes ?? obj.m)
          : undefined;
      const secondVal =
        hasOwnProp(obj, "second") || hasOwnProp(obj, "seconds") || hasOwnProp(obj, "s")
          ? Number(obj.second ?? obj.seconds ?? obj.s)
          : undefined;
      const msVal =
        hasOwnProp(obj, "millisecond") || hasOwnProp(obj, "milliseconds") || hasOwnProp(obj, "ms")
          ? Number(obj.millisecond ?? obj.milliseconds ?? obj.ms)
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
        const newYear = yearVal ?? this._p.y;
        const newMonth = monthVal ?? this._p.M;
        const newDate = dateVal ?? this._p.D;
        const newHour = hourVal ?? this._p.H;
        const newMinute = minuteVal ?? this._p.m;
        const newSecond = secondVal ?? this._p.s;
        const newMs = msVal ?? this._p.ms;

        if (this._p.isUTC) {
          const tmp = new Date(Date.UTC(2000, newMonth, 1, newHour, newMinute, newSecond, newMs));
          tmp.setUTCFullYear(newYear);
          const maxDays = daysInMonthFast(newYear, newMonth);
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
          const tmp = new Date(2000, newMonth, 1, newHour, newMinute, newSecond, newMs);
          tmp.setFullYear(newYear);
          const maxDays = daysInMonthFast(newYear, newMonth);
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
        this.quarter(obj.quarter !== undefined ? Number(obj.quarter) : Number(obj.Q));
      }
      if (hasOwnProp(obj, "week") || hasOwnProp(obj, "weeks") || hasOwnProp(obj, "w")) {
        this.week(
          obj.week !== undefined
            ? Number(obj.week)
            : obj.weeks !== undefined
              ? Number(obj.weeks)
              : Number(obj.w),
        );
      }
      if (hasOwnProp(obj, "isoWeek") || hasOwnProp(obj, "isoWeeks")) {
        this.isoWeek(obj.isoWeek !== undefined ? Number(obj.isoWeek) : Number(obj.isoWeeks));
      }
      if (hasOwnProp(obj, "weekday") || hasOwnProp(obj, "weekdays") || hasOwnProp(obj, "e")) {
        this.weekday(
          obj.weekday !== undefined
            ? Number(obj.weekday)
            : obj.weekdays !== undefined
              ? Number(obj.weekdays)
              : Number(obj.e),
        );
      }
      if (hasOwnProp(obj, "isoWeekday") || hasOwnProp(obj, "isoWeekdays") || hasOwnProp(obj, "E")) {
        const v =
          obj.isoWeekday !== undefined
            ? Number(obj.isoWeekday)
            : obj.isoWeekdays !== undefined
              ? Number(obj.isoWeekdays)
              : Number(obj.E);
        if (!isNaN(v)) {
          this.day(this._p.W - (((this._p.W + 6) % 7) + 1) + v);
        }
      }
      if (hasOwnProp(obj, "dayOfYear") || hasOwnProp(obj, "dayOfYears") || hasOwnProp(obj, "doy")) {
        this.dayOfYear(
          obj.dayOfYear !== undefined
            ? Number(obj.dayOfYear)
            : obj.dayOfYears !== undefined
              ? Number(obj.dayOfYears)
              : Number(obj.doy),
        );
      }
      if (
        hasOwnProp(obj, "isoWeekYear") ||
        hasOwnProp(obj, "isoWeekYears") ||
        hasOwnProp(obj, "GG")
      ) {
        this.isoWeekYear(
          obj.isoWeekYear !== undefined
            ? Number(obj.isoWeekYear)
            : obj.isoWeekYears !== undefined
              ? Number(obj.isoWeekYears)
              : Number(obj.GG),
        );
      }

      return this;
    }

    const u = normalizeUnits(unit as string);
    if (!u) {
      return this;
    }
    switch (u) {
      case "year":
        this.year(value!);
        break;
      case "month":
        this.month(value!);
        break;
      case "date":
        this.date(value!);
        break;
      case "hour":
        this.hour(value!);
        break;
      case "minute":
        this.minute(value!);
        break;
      case "second":
        this.second(value!);
        break;
      case "millisecond":
        this.millisecond(value!);
        break;
      case "day":
        this.day(value!);
        break;
      case "quarter":
        this.quarter(value!);
        break;
      case "week":
        this.week(value!);
        break;
      case "isoWeek":
        this.isoWeek(value!);
        break;
      case "weekday":
        this.weekday(value!);
        break;
      case "isoWeekday": {
        const w = Number(value);
        if (!isNaN(w)) {
          this.day(this._p.W - ((this._p.W + 6) % 7) - 1 + w);
        }
        break;
      }
      case "dayOfYear":
        this.dayOfYear(value!);
        break;
      case "isoWeekYear":
        this.isoWeekYear(value!);
        break;
    }
    return this;
  }

  /** Hot-path helper — inlined by V8 for add(number, "day"/"week"/"date") */
  private _addDay(amount: number): void {
    const p = this._p;
    if (p.isUTC) {
      p.t += Number.isInteger(amount) ? amount * 86400000 : Math.round(amount * 86400000);
      p.dirty = true;
      return;
    }
    if (!p.dirty && Number.isInteger(amount)) {
      // Fields-master path: avoid Date allocation for clean state
      p.D = Math.trunc(p.D + amount);
      if (p.D > 28 || p.D < 1) {
        let dm;
        while (p.D > (dm = daysInMonthFast(p.y, p.M))) {
          p.D -= dm;
          if (++p.M > 11) {
            p.M = 0;
            p.y++;
          }
        }
        while (p.D < 1) {
          if (--p.M < 0) {
            p.M = 11;
            p.y--;
          }
          p.D += daysInMonthFast(p.y, p.M);
        }
        p.W = _dayOfWeek(p.y, p.M, p.D);
      } else {
        // D ∈ [1,28]: no overflow possible
        p.W = (((p.W + amount) % 7) + 7) % 7;
      }
      // Single Date allocation for epoch reconstruction
      p.t = new Date(p.y, p.M, p.D, p.H, p.m, p.s, p.ms).getTime();
      p.d = undefined;
      p.dirty = true;
      return;
    }
    // Dirty or non-integer path: use Date for DST correctness
    const newT =
      p.t + (Number.isInteger(amount) ? amount * 86400000 : Math.round(amount * 86400000));
    const temp = new Date(newT);
    if (p.offset === -temp.getTimezoneOffset()) {
      p.t = newT;
      p.d = temp;
    } else {
      let dt = p.d;
      if (dt == null) {
        dt = new Date(p.t);
        p.d = dt;
      }
      p.t = dt.setDate(dt.getDate() + amount);
    }
    p.dirty = true;
  }

  /** Hot-path helper — inlined by V8 for add(number, "hour"/"minute"/"second"/"ms") */
  private _addTime(amount: number, unitMs: number): void {
    const p = this._p;
    p.t += Number.isInteger(amount) ? amount * unitMs : Math.round(amount * unitMs);
    p.d = undefined;
    p.dirty = true;
    if (isNaN(p.t)) {
      this._isValid = false;
    }
  }

  /** Hot-path helper — inlined by V8 for add(number, "month"/"year"/"quarter") */
  private _addMonth(amount: number): void {
    this._ensureFields();
    const p = this._p;
    const totalMonths = Number.isInteger(amount)
      ? amount
      : amount < 0
        ? Math.round(-amount) * -1
        : Math.round(amount);
    const tm = p.y * 12 + p.M + totalMonths;
    const y = Math.floor(tm / 12);
    const m = normalizeMonth(tm);
    let d_ = p.D;
    if (d_ > 28) {
      const md =
        m === 1
          ? y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
            ? 29
            : 28
          : m === 3 || m === 5 || m === 8 || m === 10
            ? 30
            : 31;
      if (d_ > md) {
        d_ = md;
      }
    }
    if (p.isUTC) {
      p.t = Date.UTC(y, m, d_, p.H, p.m, p.s, p.ms);
      p.d = undefined;
      p.dirty = true;
    } else {
      let dt = p.d;
      if (dt == null) {
        dt = new Date(p.t);
        p.d = dt;
      }
      p.t = dt.setFullYear(y, m, d_);
    }
    p.y = y;
    p.M = m;
    p.D = d_;
    p.W = p.isUTC ? _dayOfWeek(y, m, d_) : p.d!.getDay();
    if (!p.isUTC) {
      p.offset = -p.d!.getTimezoneOffset();
    }
    if (isNaN(p.t)) {
      this._isValid = false;
    }
  }

  private _addSimple(amount: number, unit: number): void {
    switch (unit) {
      case YEAR:
      case QUARTER:
      case MONTH: {
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
          const _md =
            m === 1
              ? y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
                ? 29
                : 28
              : m === 3 || m === 5 || m === 8 || m === 10
                ? 30
                : 31;
          if (d_ > _md) {
            d_ = _md;
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
          this._p.offset = -dt.getTimezoneOffset();
        }
        this._p.y = y;
        this._p.M = m;
        this._p.D = d_;
        this._p.W = this._p.isUTC ? _dayOfWeek(y, m, d_) : this._p.d!.getDay();
        break;
      }
      case WEEK:
      case DAY:
      case DATE: {
        const raw = unit === WEEK ? amount * 7 : amount;
        const rounded = Number.isInteger(raw)
          ? raw
          : raw < 0
            ? Math.round(raw * -1) * -1
            : Math.round(raw);
        if (rounded !== 0) {
          if (this._p.isUTC) {
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
    }
    if (isNaN(this._p.t)) {
      this._isValid = false;
    }
  }

  private _parseDurationInput(
    amount: number | DurationInput | string,
    unit?: string,
  ): { ms: number; days: number; months: number } | null {
    if (typeof amount === "number") {
      if (unit) {
        const norm = normalizeUnits(unit);
        if (!norm) {
          return null;
        }
        switch (norm) {
          case "year":
            return { ms: 0, days: 0, months: amount * 12 };
          case "month":
            return { ms: 0, days: 0, months: amount };
          case "quarter":
            return { ms: 0, days: 0, months: amount * 3 };
          case "week":
            return { ms: 0, days: amount * 7, months: 0 };
          case "date":
          case "day":
            return { ms: 0, days: amount, months: 0 };
          case "hour":
            return { ms: Math.round(amount * 3600000), days: 0, months: 0 };
          case "minute":
            return { ms: Math.round(amount * 60000), days: 0, months: 0 };
          case "second":
            return { ms: Math.round(amount * 1000), days: 0, months: 0 };
          case "millisecond":
            return { ms: Math.round(amount), days: 0, months: 0 };
        }
      }
      return { ms: amount, days: 0, months: 0 };
    }
    if (typeof amount === "object") {
      let ms = 0,
        days = 0,
        months = 0;
      if (isDurationLike(amount)) {
        return {
          ms: amount._milliseconds ?? amount._ms ?? 0,
          days: amount._days ?? 0,
          months: amount._months ?? 0,
        };
      }
      for (const key in amount as Record<string, unknown>) {
        if (!hasOwnProp(amount, key)) {
          continue;
        }
        const norm = normalizeUnits(key);
        if (!norm) {
          continue;
        }
        const v = Number((amount as Record<string, unknown>)[key]) || 0;
        switch (norm) {
          case "year":
            months += v * 12;
            break;
          case "month":
            months += v;
            break;
          case "quarter":
            months += v * 3;
            break;
          case "week":
            days += v * 7;
            break;
          case "date":
          case "day":
            days += v;
            break;
          case "hour":
            ms += Math.round(v * 3600000);
            break;
          case "minute":
            ms += Math.round(v * 60000);
            break;
          case "second":
            ms += Math.round(v * 1000);
            break;
          case "millisecond":
            ms += Math.round(v);
            break;
        }
      }
      return { ms, days, months };
    }
    return null;
  }

  private _applyDuration(ms: number, days: number, months: number, sign: 1 | -1): void {
    this._ensureFields();
    const d = this._getDNoEnsure();
    if (months) {
      const curMonth = this._p.M;
      const day = this._p.D;
      if (this._p.isUTC) {
        d.setUTCMonth(curMonth + sign * months);
      } else {
        d.setMonth(curMonth + sign * months);
      }
      if ((this._p.isUTC ? d.getUTCDate() : d.getDate()) !== day) {
        if (this._p.isUTC) {
          d.setUTCDate(0);
        } else {
          d.setDate(0);
        }
      }
    }
    if (days) {
      if (this._p.isUTC) {
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
      if (this._p.isUTC) {
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
    if (isNaN(this._p.t)) {
      this._isValid = false;
    }
  }

  add(amount: number, unit?: string): this;
  add(amount: DurationInput): this;
  add(amount: string, unit?: string): this;
  add(amount: number | DurationInput | string, unit?: string): this {
    if (!this._isValid) {
      return this;
    }
    if (typeof amount !== "number") {
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
    if (amount === 0) {
      return this;
    }
    if (unit === undefined) {
      this._addSimple(amount, MILLISECOND);
      if (isNaN(this._p.t)) {
        this._isValid = false;
      }
      return this;
    }
    const narrowCode = narrowCommonUnit(unit);
    if (narrowCode >= 0) {
      switch (narrowCode) {
        case MILLISECOND:
          this._addTime(amount, 1);
          return this;
        case SECOND:
          this._addTime(amount, 1000);
          return this;
        case MINUTE:
          this._addTime(amount, 60000);
          return this;
        case HOUR:
          this._addTime(amount, 3600000);
          return this;
        case DAY:
        case DATE:
          this._addDay(amount);
          return this;
        case MONTH:
          this._addMonth(amount);
          return this;
        case YEAR:
          this._addMonth(amount * 12);
          return this;
        case WEEK:
          this._addDay(amount * 7);
          return this;
        case QUARTER:
          this._addMonth(amount * 3);
          return this;
      }
    }
    return this._addSlow(amount, unit);
  }

  private _addSlow(amount: number, unit: string): this {
    const code = normalizeUnitCode(unit);
    if (code < 0) {
      return this;
    }
    switch (code) {
      case DAY:
        this._addDay(amount);
        return this;
      case MONTH:
        this._addMonth(amount);
        return this;
      case YEAR:
        this._addMonth(amount * 12);
        return this;
      case QUARTER:
        this._addMonth(amount * 3);
        return this;
      case WEEK:
        this._addDay(amount * 7);
        return this;
      case HOUR:
        this._addTime(amount, 3600000);
        return this;
      case MINUTE:
        this._addTime(amount, 60000);
        return this;
      case SECOND:
        this._addTime(amount, 1000);
        return this;
      case MILLISECOND:
        this._addTime(amount, 1);
        return this;
      default:
        this._addSimple(amount, code);
        if (isNaN(this._p.t)) {
          this._isValid = false;
        }
        return this;
    }
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

  diff(input: MomentInput, unit?: string, float?: boolean): number {
    if (!this._isValid) {
      return NaN;
    }
    const other = new MomentLite({ _t: valueOfInput(input), _dClone: false });
    const diff = this.valueOf() - other.valueOf();

    if (!unit) {
      return diff;
    }

    const code = normalizeUnitCode(unit);
    if (code < 0) {
      return NaN;
    }

    switch (code) {
      case DATE:
      case DAY: {
        if (this._p.isUTC && other._p.isUTC) {
          const days =
            Math.floor(this.valueOf() / 86400000) - Math.floor(other.valueOf() / 86400000);
          return float ? days : days || 0;
        }
        const zoneDelta =
          this._p.isUTC || other._p.isUTC ? 0 : (other._p.offset - this._p.offset) * 60000;
        const r = (diff - zoneDelta) / 86400000;
        if (float) {
          return r;
        }
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return t || 0;
      }
      case HOUR:
      case MINUTE:
      case SECOND: {
        const r = diff / TIME_UNIT_MS[code];
        if (float) {
          return r;
        }
        const t = r < 0 ? -Math.floor(-r) : Math.floor(r);
        return t || 0;
      }
      case MILLISECOND: {
        if (float) {
          return diff;
        }
        const t = diff < 0 ? -Math.floor(-diff) : Math.floor(diff);
        return t || 0;
      }
      case WEEK: {
        if (this._p.isUTC && other._p.isUTC) {
          const days =
            Math.floor(this.valueOf() / 86400000) - Math.floor(other.valueOf() / 86400000);
          const r = days / 7;
          return float ? r : Math.trunc(r) || 0;
        }
        const zoneDelta =
          this._p.isUTC || other._p.isUTC ? 0 : (other._p.offset - this._p.offset) * 60000;
        const r = (diff - zoneDelta) / 604800000;
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

        // Narrow fast path for diff('months'): same day-of-month, same offset semantics
        if (
          code === MONTH &&
          !float &&
          this._p.D === other._p.D &&
          this._p.H === other._p.H &&
          this._p.m === other._p.m &&
          this._p.s === other._p.s &&
          this._p.ms === other._p.ms
        ) {
          if (
            (this._p.isUTC && other._p.isUTC) ||
            (!this._p.isUTC && !other._p.isUTC && this._p.offset === other._p.offset)
          ) {
            const result = (this._p.y - other._p.y) * 12 + (this._p.M - other._p.M);
            return Object.is(result, -0) ? 0 : result;
          }
        }

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
          const bEpoch = b.valueOf();
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

        const bVal = b.valueOf();
        const sub = bVal - anchorVal;

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
        return result;
      }
      default:
        return diff;
    }
  }

  startOf(unit: string): this {
    // Narrow common unit tokens first
    const narrowCode = narrowCommonUnit(unit);
    if (narrowCode >= 0) {
      switch (narrowCode) {
        case YEAR:
        case QUARTER:
          // year paths need full normalization for quarter
          break;
        default:
          if (!this._p.dirty && isCleanLocalWithDate(this._p) && narrowCode === DAY) {
            this._startOfDay();
            return this;
          }
          break;
      }
    }
    if ((unit === "year" || unit === "years" || unit === "y") && !this._p.dirty) {
      return this._startOfYearFast();
    }
    const code = narrowCode >= 0 ? narrowCode : normalizeUnitCode(unit);
    if (code < 0) {
      return this;
    }
    this._ensureFields();
    return this._startOfByCode(code);
  }

  /** Fast startOf('year') — bypass normalizeUnitCode + switch + _ensureFields.
   *  Caller must guarantee !p.dirty (fields are fresh). */
  _startOfYearFast(): this {
    const p = this._p;
    if (p.M === 0 && p.D === 1 && p.H === 0 && p.m === 0 && p.s === 0 && p.ms === 0) {
      return this;
    }
    if (p.isUTC) {
      p.t = ymdToEpochDays(p.y, 0, 1) * DAY_MS;
      p.d = undefined;
    } else if (p.d != null) {
      p.d.setMonth(0, 1);
      p.d.setHours(0, 0, 0, 0);
      p.t = p.d.getTime();
      p.offset = -p.d.getTimezoneOffset();
    } else {
      p.d = new Date(p.y, 0, 1);
      p.t = p.d.getTime();
      p.offset = -p.d.getTimezoneOffset();
    }
    p.M = 0;
    p.D = 1;
    p.H = 0;
    p.m = 0;
    p.s = 0;
    p.ms = 0;
    p.W = _dayOfWeek(p.y, 0, 1);
    return this;
  }

  private _startOfByCode(code: UnitCode): this {
    switch (code) {
      case YEAR:
        this._startOfYear();
        break;
      case MONTH:
        this._startOfMonth();
        break;
      case DATE:
      case DAY:
        this._startOfDay();
        break;
      case HOUR:
        this._startOfHour();
        break;
      case MINUTE:
        this._startOfMinute();
        break;
      case SECOND:
        this._startOfSecond();
        break;
    }
    return this;
  }

  private _startOfYear(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = ymdToEpochDays(p.y, 0, 1) * DAY_MS;
      p.d = undefined;
    } else {
      let d: Date;
      if (p.d != null) {
        d = p.d;
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
      } else {
        d = p.d = new Date(p.y, 0, 1);
      }
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
    }
    p.M = 0;
    p.D = 1;
    p.H = 0;
    p.m = 0;
    p.s = 0;
    p.ms = 0;
    p.W = _dayOfWeek(p.y, 0, 1);
  }

  private _startOfMonth(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = ymdToEpochDays(p.y, p.M, 1) * DAY_MS;
      p.d = undefined;
    } else {
      let d: Date;
      if (p.d != null) {
        d = p.d;
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
      } else {
        d = p.d = new Date(p.y, p.M, 1);
      }
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
    }
    p.D = 1;
    p.H = 0;
    p.m = 0;
    p.s = 0;
    p.ms = 0;
    p.W = _dayOfWeek(p.y, p.M, 1);
  }

  private _startOfDay(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = floorUnitEpoch(p.t, DAY_MS);
      p.d = undefined;
    } else if (p.d != null) {
      const phase = euclideanModulo(p.t + p.offset * 60000, DAY_MS);
      const candidateT = p.t - phase;
      if (_tzOffsetAt(candidateT) === p.offset) {
        p.t = candidateT;
        p.d.setTime(candidateT);
      } else {
        p.d.setHours(0, 0, 0, 0);
        p.t = p.d.getTime();
        p.offset = -p.d.getTimezoneOffset();
      }
    } else {
      const phase = euclideanModulo(p.t + p.offset * 60000, DAY_MS);
      const candidateT = p.t - phase;
      const offAtTarget = _tzOffsetAt(candidateT);
      if (offAtTarget === p.offset) {
        p.t = candidateT;
      } else {
        p.d = new Date(candidateT);
        p.t = p.d.getTime();
        p.offset = offAtTarget;
      }
    }
    p.H = 0;
    p.m = 0;
    p.s = 0;
    p.ms = 0;
  }

  private _startOfHour(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = floorUnitEpoch(p.t, HOUR_MS);
      p.d = undefined;
    } else if (p.d != null) {
      const phase = euclideanModulo(p.t + p.offset * 60000, HOUR_MS);
      const candidateT = p.t - phase;
      if (_tzOffsetAt(candidateT) === p.offset) {
        p.t = candidateT;
        p.d.setTime(candidateT);
      } else {
        p.d.setMinutes(0, 0, 0);
        p.t = p.d.getTime();
        p.offset = -p.d.getTimezoneOffset();
      }
    } else {
      const phase = euclideanModulo(p.t + p.offset * 60000, HOUR_MS);
      const candidateT = p.t - phase;
      const offAtTarget = _tzOffsetAt(candidateT);
      if (offAtTarget === p.offset) {
        p.t = candidateT;
      } else {
        p.d = new Date(candidateT);
        p.t = p.d.getTime();
        p.offset = offAtTarget;
      }
    }
    p.m = 0;
    p.s = 0;
    p.ms = 0;
  }

  private _startOfMinute(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = floorUnitEpoch(p.t, MINUTE_MS);
      p.d = undefined;
    } else if (p.d != null) {
      const phase = euclideanModulo(p.t + p.offset * 60000, MINUTE_MS);
      const candidateT = p.t - phase;
      if (_tzOffsetAt(candidateT) === p.offset) {
        p.t = candidateT;
        p.d.setTime(candidateT);
      } else {
        p.d.setSeconds(0, 0);
        p.t = p.d.getTime();
        p.offset = -p.d.getTimezoneOffset();
      }
    } else {
      const phase = euclideanModulo(p.t + p.offset * 60000, MINUTE_MS);
      const candidateT = p.t - phase;
      const offAtTarget = _tzOffsetAt(candidateT);
      if (offAtTarget === p.offset) {
        p.t = candidateT;
      } else {
        p.d = new Date(candidateT);
        p.t = p.d.getTime();
        p.offset = offAtTarget;
      }
    }
    p.s = 0;
    p.ms = 0;
  }

  private _startOfSecond(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = floorUnitEpoch(p.t, SECOND_MS);
      p.d = undefined;
    } else if (p.d != null) {
      const phase = euclideanModulo(p.t + p.offset * 60000, SECOND_MS);
      const candidateT = p.t - phase;
      if (_tzOffsetAt(candidateT) === p.offset) {
        p.t = candidateT;
        p.d.setTime(candidateT);
      } else {
        p.d.setMilliseconds(0);
        p.t = p.d.getTime();
        p.offset = -p.d.getTimezoneOffset();
      }
    } else {
      const phase = euclideanModulo(p.t + p.offset * 60000, SECOND_MS);
      const candidateT = p.t - phase;
      const offAtTarget = _tzOffsetAt(candidateT);
      if (offAtTarget === p.offset) {
        p.t = candidateT;
      } else {
        p.d = new Date(candidateT);
        p.t = p.d.getTime();
        p.offset = offAtTarget;
      }
    }
    p.ms = 0;
  }

  endOf(unit: string): this {
    if ((unit === "year" || unit === "years" || unit === "y") && !this._p.dirty) {
      return this._endOfYearFast();
    }
    if (unit === "month" && !this._p.dirty) {
      const p = this._p;
      if (p.D === 1 && p.H === 0 && p.m === 0 && p.s === 0 && p.ms === 0) {
        this._endOfMonthFromStartFast();
        return this;
      }
    }
    const code = normalizeUnitCode(unit);
    if (code < 0) {
      return this;
    }
    this._ensureFields();
    switch (code) {
      case YEAR:
        this._endOfYear();
        break;
      case MONTH:
        this._endOfMonth();
        break;
      case DATE:
      case DAY:
        this._endOfDay();
        break;
      case HOUR:
        this._endOfHour();
        break;
      case MINUTE:
        this._endOfMinute();
        break;
      case SECOND:
        this._endOfSecond();
        break;
    }
    return this;
  }

  /** Fast endOf('year') — bypass normalizeUnitCode + switch + _ensureFields.
   *  Caller must guarantee !p.dirty (fields are fresh). */
  _endOfYearFast(): this {
    const p = this._p;
    if (
      p.isUTC &&
      p.M === 11 &&
      p.D === 31 &&
      p.H === 23 &&
      p.m === 59 &&
      p.s === 59 &&
      p.ms === 999
    ) {
      return this;
    }
    if (p.isUTC) {
      p.t = (ymdToEpochDays(p.y, 11, 31) + 1) * DAY_MS - 1;
      p.d = undefined;
    } else {
      const d = p.d ?? new Date(p.t);
      p.d = d;
      d.setFullYear(p.y, 11, 31);
      d.setHours(23, 59, 59, 999);
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
    }
    p.M = 11;
    p.D = 31;
    p.H = 23;
    p.m = 59;
    p.s = 59;
    p.ms = 999;
    p.W = _dayOfWeek(p.y, 11, 31);
    return this;
  }

  /** Fast path for endOf('month') after startOf('month') (D=1, H=0, …). */
  private _endOfMonthFromStartFast(): void {
    const p = this._p;
    if (p.isUTC) {
      const endDay = daysInMonthFast(p.y, p.M);
      p.t = (ymdToEpochDays(p.y, p.M, endDay) + 1) * DAY_MS - 1;
      p.d = undefined;
      p.D = endDay;
    } else if (p.d != null) {
      p.d.setFullYear(p.y, p.M + 1, 0);
      p.d.setHours(23, 59, 59, 999);
      p.t = p.d.getTime();
      p.offset = -p.d.getTimezoneOffset();
      p.D = p.d.getDate();
    } else {
      const d = new Date(p.y, p.M + 1, 0, 23, 59, 59, 999);
      p.t = d.getTime();
      p.d = d;
      p.offset = -d.getTimezoneOffset();
      p.D = d.getDate();
    }
    p.H = 23;
    p.m = 59;
    p.s = 59;
    p.ms = 999;
    p.W = _dayOfWeek(p.y, p.M, p.D);
  }

  private _endOfYear(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = (ymdToEpochDays(p.y, 11, 31) + 1) * DAY_MS - 1;
      p.d = undefined;
    } else {
      const d = this._getDNoEnsure();
      d.setFullYear(p.y, 11, 31);
      d.setHours(23, 59, 59, 999);
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
    }
    p.M = 11;
    p.D = 31;
    p.H = 23;
    p.m = 59;
    p.s = 59;
    p.ms = 999;
    p.W = _dayOfWeek(p.y, 11, 31);
  }

  private _endOfMonth(): void {
    const p = this._p;
    if (p.isUTC) {
      const _eomMaxDay = daysInMonthFast(p.y, p.M);
      p.t = (ymdToEpochDays(p.y, p.M, _eomMaxDay) + 1) * DAY_MS - 1;
      p.d = undefined;
      p.D = _eomMaxDay;
    } else {
      const d = this._getDNoEnsure();
      d.setFullYear(p.y, p.M + 1, 0);
      d.setHours(23, 59, 59, 999);
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
      p.D = d.getDate();
    }
    p.H = 23;
    p.m = 59;
    p.s = 59;
    p.ms = 999;
    p.W = _dayOfWeek(p.y, p.M, p.D);
  }

  private _endOfDay(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = endOfUnitEpoch(p.t, DAY_MS);
      p.d = undefined;
    } else {
      const d = this._getDNoEnsure();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 1);
      d.setMilliseconds(-1);
      p.D = d.getDate();
      p.H = d.getHours();
      p.m = d.getMinutes();
      p.s = d.getSeconds();
      p.ms = d.getMilliseconds();
      p.W = _dayOfWeek(p.y, p.M, p.D);
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
    }
  }

  private _endOfHour(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = endOfUnitEpoch(p.t, HOUR_MS);
      p.d = undefined;
    } else {
      const d = this._getDNoEnsure();
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1, 0, 0, -1);
      p.H = d.getHours();
      p.m = d.getMinutes();
      p.s = d.getSeconds();
      p.ms = d.getMilliseconds();
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
    }
  }

  private _endOfMinute(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = endOfUnitEpoch(p.t, MINUTE_MS);
      p.d = undefined;
    } else {
      const d = this._getDNoEnsure();
      d.setSeconds(0, 0);
      d.setMinutes(d.getMinutes() + 1, 0, -1);
      p.m = d.getMinutes();
      p.s = d.getSeconds();
      p.ms = d.getMilliseconds();
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
    }
  }

  private _endOfSecond(): void {
    const p = this._p;
    if (p.isUTC) {
      p.t = endOfUnitEpoch(p.t, SECOND_MS);
      p.d = undefined;
    } else {
      const d = this._getDNoEnsure();
      d.setSeconds(d.getSeconds() + 1, -1);
      p.s = d.getSeconds();
      p.ms = d.getMilliseconds();
      p.t = d.getTime();
      p.offset = -d.getTimezoneOffset();
    }
  }

  format(formatStr?: string): string {
    formatStr ??= "YYYY-MM-DDTHH:mm:ss";
    if (!this._isValid) {
      return "Invalid date";
    }
    if (this._p.dirty) {
      this._ensureFields();
    }
    return formatMomentBasic(this as unknown as FormattableMoment, formatStr);
  }

  private _calcStartOfMs(unit: string): number {
    const u = normalizeUnits(unit);
    if (!u || u === "millisecond") {
      return this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
    }
    this._ensureFields();
    const p = this._p;
    if (p.isUTC) {
      const offsetMs = p.offset * 60000;
      switch (u) {
        case "year":
          return Date.UTC(p.y, 0, 1) - offsetMs;
        case "month":
          return Date.UTC(p.y, p.M, 1) - offsetMs;
        case "day":
        case "date":
          return Date.UTC(p.y, p.M, p.D) - offsetMs;
        case "hour":
          return Date.UTC(p.y, p.M, p.D, p.H) - offsetMs;
        case "minute":
          return Date.UTC(p.y, p.M, p.D, p.H, p.m) - offsetMs;
        case "second":
          return Date.UTC(p.y, p.M, p.D, p.H, p.m, p.s) - offsetMs;
        case "quarter": {
          const qM = Math.floor(p.M / 3) * 3;
          return Date.UTC(p.y, qM, 1) - offsetMs;
        }
      }
    } else {
      switch (u) {
        case "year":
          return new Date(p.y, 0, 1).valueOf();
        case "month":
          return new Date(p.y, p.M, 1).valueOf();
        case "day":
        case "date":
          return new Date(p.y, p.M, p.D).valueOf();
        case "hour":
          return new Date(p.y, p.M, p.D, p.H).valueOf();
        case "minute":
          return new Date(p.y, p.M, p.D, p.H, p.m).valueOf();
        case "second":
          return new Date(p.y, p.M, p.D, p.H, p.m, p.s).valueOf();
        case "quarter": {
          const qM = Math.floor(p.M / 3) * 3;
          return new Date(p.y, qM, 1).valueOf();
        }
      }
    }
    return this.clone().startOf(u).valueOf();
  }

  private _calcEndOfMs(unit: string): number {
    const u = normalizeUnits(unit);
    if (!u || u === "millisecond") {
      return this._p.isUTC ? this._p.t - this._p.offset * 60000 : this._p.t;
    }
    this._ensureFields();
    const p = this._p;
    if (p.isUTC) {
      const offsetMs = p.offset * 60000;
      switch (u) {
        case "year":
          return Date.UTC(p.y + 1, 0, 1) - offsetMs - 1;
        case "month": {
          const nextM = p.M === 11 ? 0 : p.M + 1;
          const nextY = p.M === 11 ? p.y + 1 : p.y;
          return Date.UTC(nextY, nextM, 1) - offsetMs - 1;
        }
        case "day":
        case "date":
          return Date.UTC(p.y, p.M, p.D + 1) - offsetMs - 1;
        case "hour":
          return Date.UTC(p.y, p.M, p.D, p.H + 1) - offsetMs - 1;
        case "minute":
          return Date.UTC(p.y, p.M, p.D, p.H, p.m + 1) - offsetMs - 1;
        case "second":
          return Date.UTC(p.y, p.M, p.D, p.H, p.m, p.s + 1) - offsetMs - 1;
        case "quarter": {
          const qM = Math.floor(p.M / 3) * 3 + 3;
          const nextQY = qM >= 12 ? p.y + 1 : p.y;
          return Date.UTC(nextQY, qM % 12, 1) - offsetMs - 1;
        }
      }
    } else {
      switch (u) {
        case "year":
          return new Date(p.y + 1, 0, 1).valueOf() - 1;
        case "month": {
          const nextM = p.M === 11 ? 0 : p.M + 1;
          const nextY = p.M === 11 ? p.y + 1 : p.y;
          return new Date(nextY, nextM, 1).valueOf() - 1;
        }
        case "day":
        case "date":
          return new Date(p.y, p.M, p.D + 1).valueOf() - 1;
        case "hour":
          return new Date(p.y, p.M, p.D, p.H + 1).valueOf() - 1;
        case "minute":
          return new Date(p.y, p.M, p.D, p.H, p.m + 1).valueOf() - 1;
        case "second":
          return new Date(p.y, p.M, p.D, p.H, p.m, p.s + 1).valueOf() - 1;
        case "quarter": {
          const qM = Math.floor(p.M / 3) * 3 + 3;
          const nextQY = qM >= 12 ? p.y + 1 : p.y;
          return new Date(nextQY, qM % 12, 1).valueOf() - 1;
        }
      }
    }
    return this.clone().endOf(u).valueOf();
  }

  isBefore(input: MomentInput, unit?: string): boolean {
    const other = new MomentLite({ _t: valueOfInput(input), _dClone: false });
    if (!this._isValid || !other._isValid) {
      return false;
    }
    if (unit) {
      return this._calcEndOfMs(unit) < other.valueOf();
    }
    return this.valueOf() < other.valueOf();
  }

  isAfter(input: MomentInput, unit?: string): boolean {
    const other = new MomentLite({ _t: valueOfInput(input), _dClone: false });
    if (!this._isValid || !other._isValid) {
      return false;
    }
    if (unit) {
      return other.valueOf() < this._calcStartOfMs(unit);
    }
    return this.valueOf() > other.valueOf();
  }

  isSame(input: MomentInput, unit?: string): boolean {
    const other = new MomentLite({ _t: valueOfInput(input), _dClone: false });
    if (!this._isValid || !other._isValid) {
      return false;
    }
    if (unit) {
      const ms = other.valueOf();
      return this._calcStartOfMs(unit) <= ms && ms <= this._calcEndOfMs(unit);
    }
    return this.valueOf() === other.valueOf();
  }

  isSameOrBefore(input: MomentInput, unit?: string): boolean {
    const other = new MomentLite({ _t: valueOfInput(input), _dClone: false });
    if (!this._isValid || !other._isValid) {
      return false;
    }
    if (unit) {
      return this._calcStartOfMs(unit) <= other.valueOf();
    }
    return this._compareCalendarValues(other, "millisecond") <= 0;
  }

  isSameOrAfter(input: MomentInput, unit?: string): boolean {
    const other = new MomentLite({ _t: valueOfInput(input), _dClone: false });
    if (!this._isValid || !other._isValid) {
      return false;
    }
    if (unit) {
      return other.valueOf() <= this._calcEndOfMs(unit);
    }
    return this._compareCalendarValues(other, "millisecond") >= 0;
  }

  isBetween(from: MomentInput, to: MomentInput, unit?: string, inclusivity?: string): boolean {
    const fromM = new MomentLite({ _t: valueOfInput(from), _dClone: false });
    const toM = new MomentLite({ _t: valueOfInput(to), _dClone: false });
    const fromStr = inclusivity ?? "()";
    const startOpen = fromStr[0] === "(";
    const endOpen = fromStr.at(-1) === ")";
    const startCheck = startOpen ? this.isAfter(fromM, unit) : this.isSameOrAfter(fromM, unit);
    const endCheck = endOpen ? this.isBefore(toM, unit) : this.isSameOrBefore(toM, unit);
    return startCheck && endCheck;
  }

  private _compareCalendarValues(other: MomentLite, unit: string): number {
    const u = normalizeUnits(unit);
    if (!u) {
      return NaN;
    }
    if (u === "millisecond") {
      return this.valueOf() - other.valueOf();
    }
    if (u === "second") {
      return Math.floor(this.valueOf() / 1000) - Math.floor(other.valueOf() / 1000);
    }
    if (u === "minute") {
      return Math.floor(this.valueOf() / 60000) - Math.floor(other.valueOf() / 60000);
    }
    if (u === "hour") {
      return Math.floor(this.valueOf() / 3600000) - Math.floor(other.valueOf() / 3600000);
    }
    switch (u) {
      case "year":
        return this.year() - other.year();
      case "month": {
        const d = this.year() - other.year();
        if (d !== 0) {
          return d;
        }
        return this.month() - other.month();
      }
      case "day":
      case "date":
      default: {
        if (this._p.isUTC && other._p.isUTC) {
          const thisDays = Math.floor(this._p.t / 86400000);
          const otherDays = Math.floor(other._p.t / 86400000);
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

  isLeapYear(): boolean {
    const p = this._p;
    if (p.dirty) {
      p.dirty = false;
      this._refreshFields();
    }
    return this._isValid && isLeapYear(p.y);
  }

  daysInMonth(): number {
    const p = this._p;
    if (p.dirty) {
      p.dirty = false;
      this._refreshFields();
    }
    return daysInMonthFast(p.y, p.M);
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

  years(): number;
  years(y: number): this;
  years(y?: number): number | this {
    return this.year(y as number);
  }

  months(): number;
  months(m: number): this;
  months(m?: number): number | this {
    return this.month(m as number);
  }

  dates(): number;
  dates(d: number): this;
  dates(d?: number): number | this {
    return this.date(d as number);
  }

  days(): number;
  days(d: number): this;
  days(d?: number): number | this {
    return this.day(d as number);
  }

  hours(): number;
  hours(h: number): this;
  hours(h?: number): number | this {
    return this.hour(h as number);
  }

  minutes(): number;
  minutes(m: number): this;
  minutes(m?: number): number | this {
    return this.minute(m as number);
  }

  seconds(): number;
  seconds(s: number): this;
  seconds(s?: number): number | this {
    return this.second(s as number);
  }

  milliseconds(): number;
  milliseconds(ms: number): this;
  milliseconds(ms?: number): number | this {
    return this.millisecond(ms as number);
  }

  quarters(): number;
  quarters(q: number): this;
  quarters(q?: number): number | this {
    return this.quarter(q as number);
  }

  toString(): string {
    const d = this._getD();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
    const y = this._p.y;
    const yStr = y < 0 ? `-${zeroFill(-y, 6)}` : y > 9999 ? `+${zeroFill(y, 6)}` : String(y);
    const tz = this._p.isUTC
      ? "GMT"
      : (() => {
          const offset = -d.getTimezoneOffset();
          const sign = offset >= 0 ? "+" : "-";
          const abs = Math.abs(offset);
          return `GMT${sign}${pad2(Math.floor(abs / 60))}${pad2(abs % 60)}`;
        })();
    return `${dayNames[this._p.W]} ${monthNames[this._p.M]} ${pad2(this._p.D)} ${yStr} ${pad2(this._p.H)}:${pad2(this._p.m)}:${pad2(this._p.s)} ${tz}`;
  }

  dayOfYear(): number;
  dayOfYear(d: number): this;
  dayOfYear(d?: number): number | this {
    if (d !== undefined) {
      this._ensureFields();
      const dt = this._getD();
      const year = this._p.y;
      const maxDay = isLeapYear(year) ? 366 : 365;
      const dayNum = Math.min(Math.max(1, d), maxDay);
      const date = new Date(year, 0, dayNum);
      if (this._p.isUTC) {
        this._p.d = new Date(
          Date.UTC(
            year,
            date.getMonth(),
            date.getDate(),
            this._p.H,
            this._p.m,
            this._p.s,
            this._p.ms,
          ),
        );
        this._p.t = this._p.d.getTime();
        this._p.dirty = true;
      } else {
        dt.setMonth(date.getMonth(), date.getDate());
        this._p.t = dt.getTime();
      }
      return this;
    }
    this._ensureFields();
    return this._p.isUTC ? getDayOfYear(this._getD(), true) : getDayOfYear(this._getD(), false);
  }

  week(): number;
  week(w: number): this;
  week(w?: number): number | this {
    if (w !== undefined) {
      this._ensureFields();
      const dow = 0;
      const doy = 6;
      const current = getLocaleWeek(this._getD(), this._p.isUTC, dow, doy);
      const diff = w - current;
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff * 7);
      } else {
        dt.setDate(dt.getDate() + diff * 7);
      }
      this._p.d = dt;
      this._p.t = dt.getTime();
      this._refreshFields();
      return this;
    }
    this._ensureFields();
    return getLocaleWeek(this._getD(), this._p.isUTC, 0, 6);
  }

  isoWeek(): number;
  isoWeek(w: number): this;
  isoWeek(w?: number): number | this {
    if (w !== undefined) {
      this._ensureFields();
      const current = getISOWeekNumber(this._getD(), this._p.isUTC);
      const diff = w - current;
      const dt = this._getD();
      if (this._p.isUTC) {
        dt.setUTCDate(dt.getUTCDate() + diff * 7);
      } else {
        dt.setDate(dt.getDate() + diff * 7);
      }
      this._p.d = dt;
      this._p.t = dt.getTime();
      this._refreshFields();
      return this;
    }
    this._ensureFields();
    return getISOWeekNumber(this._getD(), this._p.isUTC);
  }

  isoWeekYear(): number;
  isoWeekYear(y: number): this;
  isoWeekYear(y?: number): number | this {
    if (y !== undefined) {
      this._ensureFields();
      let currentWeek = getISOWeekNumber(this._getD(), this._p.isUTC);
      const currentDay = ((this._p.W + 6) % 7) + 1;
      const maxWeek = weeksInYear(y, 1, 4, this._p.isUTC);
      if (currentWeek > maxWeek) {
        currentWeek = maxWeek;
      }
      const jan4 = this._p.isUTC ? new Date(Date.UTC(y, 0, 4)) : new Date(y, 0, 4);
      const dayOfJan4 = this._p.isUTC ? jan4.getUTCDay() || 7 : jan4.getDay() || 7;
      const week1Start = this._p.isUTC
        ? new Date(Date.UTC(y, 0, 4 - (dayOfJan4 - 1)))
        : new Date(y, 0, 4 - (dayOfJan4 - 1));
      const target = new Date(
        week1Start.getTime() + ((currentWeek - 1) * 7 + (currentDay - 1)) * 86400000,
      );
      if (this._p.isUTC) {
        this._p.d = new Date(
          Date.UTC(
            target.getFullYear(),
            target.getMonth(),
            target.getDate(),
            this._p.H,
            this._p.m,
            this._p.s,
            this._p.ms,
          ),
        );
      } else {
        this._p.d = new Date(
          target.getFullYear(),
          target.getMonth(),
          target.getDate(),
          this._p.H,
          this._p.m,
          this._p.s,
          this._p.ms,
        );
      }
      this._p.t = this._p.d.getTime();
      this._refreshFields();
      return this;
    }
    this._ensureFields();
    return getISOWeekYear(this._getD(), this._p.isUTC);
  }

  weekday(): number;
  weekday(d: number | string): this;
  weekday(d?: number | string): number | this {
    this._ensureFields();
    if (d !== undefined) {
      let dayNum = Number(d);
      if (typeof d === "string") {
        const lower = d.toLowerCase();
        const localeDaysFull = this._getLocale().weekdaysArray();
        for (let di = 0; di < localeDaysFull.length; di++) {
          if (localeDaysFull[di].toLowerCase() === lower) {
            dayNum = di % 7;
            break;
          }
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
      this._p.D = this._p.isUTC ? dt.getUTCDate() : dt.getDate();
      this._p.M = this._p.isUTC ? dt.getUTCMonth() : dt.getMonth();
      this._p.W = _dayOfWeek(this._p.y, this._p.M, this._p.D);
      this._p.t = dt.getTime();
      return this;
    }
    return this._p.W;
  }

  utc(keepLocalTime?: boolean): this {
    if (this._p.isUTC) {
      return this;
    }
    const offsetBefore = this._p.offset;
    this._p.isUTC = true;
    this._p.offset = 0;
    if (!keepLocalTime) {
      this._p.t -= offsetBefore * 60000;
    }
    this._p.d = undefined;
    this._p.dirty = true;
    return this;
  }

  local(keepLocalTime?: boolean): this {
    if (!this._p.isUTC) {
      return this;
    }
    const offsetBefore = -new Date(this._p.t).getTimezoneOffset();
    this._p.isUTC = false;
    this._p.offset = -new Date(this._p.t).getTimezoneOffset();
    if (!keepLocalTime) {
      this._p.t += offsetBefore * 60000;
    }
    this._p.d = undefined;
    this._p.dirty = true;
    return this;
  }

  utcOffset(): number;
  utcOffset(offset: number | string, keepLocalTime?: boolean): this;
  utcOffset(offset?: number | string, keepLocalTime?: boolean): number | this {
    if (offset === undefined) {
      return this._p.offset;
    }
    let numOffset: number;
    if (typeof offset === "string") {
      const m = offset.match(/([+-])(\d{2}):?(\d{2})$/);
      if (!m) {
        return this;
      }
      numOffset = (m[1] === "+" ? 1 : -1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
    } else {
      numOffset = offset;
    }
    const prevOffset = this._p.offset;
    this._p.offset = numOffset;
    this._p.isUTC = true;
    if (!keepLocalTime) {
      this._p.t -= (numOffset - prevOffset) * 60000;
    }
    this._p.d = undefined;
    this._p.dirty = true;
    return this;
  }
}

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

/** @public */
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
