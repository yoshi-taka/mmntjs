import type { MomentConfig } from "../moment_fixed";
import {
  Moment,
  momentProperties,
  setUpdateOffsetCallback,
  getUpdateOffsetCallback,
} from "../moment_fixed";
import { Duration, isDuration as checkIsDuration } from "../duration_fixed";
import {
  isMoment,
  isDate,
  isString,
  isArray,
} from "../utils";
import {
  parseTwoDigitYear as parseTwoDigitYearInternal,
  setParseTwoDigitYear,
} from "../parse";
import {
  moment,
  nowFn,
  getMomentNowFunction,
  setMomentNowFunction,
} from "../core/factory";
import { normalizeUnits as normUnits } from "../units";

export function registerCoreApi(): void {
  const momentRecord = moment as unknown as Record<string, unknown>;

  momentRecord.duration = function (input?: unknown, unit?: string): Duration {
    return new Duration(input, unit);
  };
  (momentRecord.duration as Record<string, unknown>).invalid = function (): Duration {
    return Duration.invalid();
  };
  (momentRecord.duration as Record<string, unknown>).fn = Duration.prototype;
  momentRecord.fn = Moment.prototype;
  momentRecord.prototype = Moment.prototype;

  momentRecord.version = "2.30.1";
  Object.defineProperty(moment, "updateOffset", {
    get(): ((m: Moment, keepTime?: boolean) => void) | undefined {
      return getUpdateOffsetCallback();
    },
    set(v: ((m: Moment, keepTime?: boolean) => void) | undefined) {
      setUpdateOffsetCallback(v ?? undefined);
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(moment, "now", {
    get(): () => number {
      return getMomentNowFunction() ?? (() => Date.now());
    },
    set(v: (() => number) | undefined) {
      setMomentNowFunction(v ?? undefined);
    },
    enumerable: true,
    configurable: true,
  });
  momentRecord.isMoment = isMoment;
  momentRecord.isDate = isDate;
  momentRecord.isDuration = function (obj: unknown): boolean {
    return checkIsDuration(obj);
  };
  momentRecord.normalizeUnits = normUnits;
  Object.defineProperty(moment, "parseTwoDigitYear", {
    get() {
      return (str: string) => {
        const fn = parseTwoDigitYearInternal;
        return fn(str);
        const num = parseInt(str, 10);
        return num > 68 ? 1900 + num : 2000 + num;
      };
    },
    set(v: ((str: string) => number) | undefined) {
      setParseTwoDigitYear(v ?? undefined);
    },
    enumerable: true,
    configurable: true,
  });
  momentRecord.momentProperties = momentProperties;
  momentRecord.ISO_8601 = "ISO_8601";
  momentRecord.RFC_2822 = "RFC_2822";
  momentRecord.HTML5_FMT = {
    DATETIME_LOCAL: "YYYY-MM-DDTHH:mm",
    DATETIME_LOCAL_SECONDS: "YYYY-MM-DDTHH:mm:ss",
    DATETIME_LOCAL_MS: "YYYY-MM-DDTHH:mm:ss.SSS",
    DATE: "YYYY-MM-DD",
    TIME: "HH:mm",
    TIME_SECONDS: "HH:mm:ss",
    TIME_MS: "HH:mm:ss.SSS",
    WEEK: "GGGG-[W]WW",
    MONTH: "YYYY-MM",
  };
  momentRecord.utc = function (input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment {
    if (input === null) {
      return new Moment({
        _dClone: false,
        _d: new Date(NaN),
        _isValid: false,
        _isUTC: true,
        _offset: 0,
        _i: input,
        _nullInput: true,
      });
    }
    if (input === undefined) {
      return new Moment({ _dClone: false, _d: new Date(nowFn()), _isUTC: true, _offset: 0, _i: input });
    }
    const m = moment(input, format, localeOrStrict, fourthArg);
    const absTime = m.valueOf();
    if (isNaN(absTime)) {
      m._isUTC = true;
      m._offset = 0;
      return m;
    }
    if (!m._isUTC && isString(input)) {
      const utcDate = new Date(`${input} UTC`);
      if (!isNaN(utcDate.getTime())) {
        m._d = utcDate;
      } else {
        m._d = new Date(absTime - m._d!.getTimezoneOffset() * 60000);
      }
    } else {
      m._d = new Date(absTime);
    }
    m._t = m._d.getTime();
    m._isUTC = true;
    m._offset = 0;
    (m as unknown as Record<string, unknown>)._refreshFields();
    return m;
  };
  momentRecord.parseZone = function (input?: unknown, format?: unknown, strict?: boolean): Moment {
    const m = moment(input, format, strict);
    return m.parseZone();
  };
  momentRecord.unix = function (ts: number): Moment {
    return moment(ts * 1000);
  };
  momentRecord.invalid = function (input?: unknown): Moment {
    const config: Record<string, unknown> = { _d: new Date(NaN), _isValid: false, _userInvalidated: true };
    if (
      typeof input === "object" &&
      input !== null &&
      !isArray(input) &&
      !isMoment(input) &&
      !isDate(input)
    ) {
      for (const key of Object.keys(input)) {
        config[`_${key}`] = (input as Record<string, unknown>)[key];
      }
      delete config._userInvalidated;
      config._i = input;
    } else {
      config._i = input;
    }
    return new Moment(config as MomentConfig);
  };
  momentRecord.min = function (...args: unknown[]): Moment {
    if (args.length === 0) {return moment();}
    let inputList = args;
    if (args.length === 1 && isArray(args[0]) && !isMoment(args[0])) {
      inputList = args[0];
    }
    let best: Moment | null = null;
    let bestVal = Infinity;
    let bestInvalid: Moment | null = null;
    for (const item of inputList) {
      const m = isMoment(item) ? (item as Moment) : moment(item);
      const val = m.valueOf();
      if (isNaN(val) || !m.isValid()) {
        bestInvalid ??= m;
      } else if (val < bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return bestInvalid ?? best!;
  };
  momentRecord.max = function (...args: unknown[]): Moment {
    if (args.length === 0) {return moment();}
    let inputList = args;
    if (args.length === 1 && isArray(args[0]) && !isMoment(args[0])) {
      inputList = args[0];
    }
    let best: Moment | null = null;
    let bestVal = -Infinity;
    let bestInvalid: Moment | null = null;
    for (const item of inputList) {
      const m = isMoment(item) ? (item as Moment) : moment(item);
      const val = m.valueOf();
      if (isNaN(val) || !m.isValid()) {
        bestInvalid ??= m;
      } else if (val > bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return bestInvalid ?? best!;
  };
  momentRecord.suppressDeprecationWarnings = false;
  momentRecord.deprecationHandler = null as ((name: string, msg: string) => void) | null;
}
