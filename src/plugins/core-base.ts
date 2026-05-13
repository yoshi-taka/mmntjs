import type { MomentConfig } from "../moment-class";
import {
  Moment,
  setAddCallback,
  setUpdateOffsetCallback,
  getUpdateOffsetCallback,
} from "../moment-class";
import {
  isMoment,
  isDate,
  isArray,
  hasOwnProp,
} from "../utils";
import { normalizeUnits } from "../units";
import { isDuration } from "../duration";

type CoreMomentTarget = ((input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown) => Moment) & Record<string, unknown>;

export type CoreApiDeps = {
  getMomentNowFunction: () => (() => number) | undefined;
  setMomentNowFunction: (fn: (() => number) | undefined) => void;
  nowFn: () => number;
  parseTwoDigitYearInternal: (str: string) => number;
  setParseTwoDigitYear: (fn: ((str: string) => number) | undefined) => void;
};

export function registerBaseCoreApi(
  target: CoreMomentTarget,
  deps: CoreApiDeps,
): void {
  const momentRecord = target as unknown as Record<string, unknown>;
  momentRecord.fn = Moment.prototype;
  momentRecord.prototype = Moment.prototype;

  momentRecord.version = "2.30.1";
  Object.defineProperty(target, "updateOffset", {
    get(): ((m: Moment, keepTime?: boolean) => void) | undefined {
      return getUpdateOffsetCallback();
    },
    set(v: ((m: Moment, keepTime?: boolean) => void) | undefined) {
      setUpdateOffsetCallback(v ?? undefined);
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(target, "now", {
    get(): () => number {
      return deps.getMomentNowFunction() ?? (() => Date.now());
    },
    set(v: (() => number) | undefined) {
      deps.setMomentNowFunction(v ?? undefined);
    },
    enumerable: true,
    configurable: true,
  });
  momentRecord.isMoment = isMoment;
  momentRecord.isDate = isDate;
  Object.defineProperty(target, "parseTwoDigitYear", {
    get() {
      return (str: string) => {
        const fn = deps.parseTwoDigitYearInternal;
        return fn(str);
      };
    },
    set(v: ((str: string) => number) | undefined) {
      deps.setParseTwoDigitYear(v ?? undefined);
    },
    enumerable: true,
    configurable: true,
  });
  momentRecord.ISO_8601 = "ISO_8601";
  momentRecord.RFC_2822 = "RFC_2822";
  momentRecord.unix = function (ts: number): Moment {
    return target(ts * 1000);
  };
  setAddCallback((_m, amount, unit) => {
    if (typeof amount === "number") {
      if (unit) {
        const norm = normalizeUnits(unit);
        if (!norm) {return null;}
        switch (norm) {
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
        }
      }
      return { ms: amount, days: 0, months: 0 };
    }
    if (typeof amount === "object" && amount !== null) { // eslint-disable-line no-unnecessary-condition
      let ms = 0, days = 0, months = 0;
      if (isDuration(amount)) {
        ms = amount._milliseconds;
        days = amount._days;
        months = amount._months;
        return { ms, days, months };
      }
      for (const key in amount as Record<string, unknown>) {
        if (!hasOwnProp(amount, key)) {continue;}
        const norm = normalizeUnits(key);
        if (!norm) {continue;}
        const v = Number((amount as Record<string, unknown>)[key]) || 0;
        switch (norm) {
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
    return null;
  });
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
      config._userInvalidated = true;
      config._i = input;
    } else {
      config._i = input;
    }
    return new Moment(config as MomentConfig);
  };
}
