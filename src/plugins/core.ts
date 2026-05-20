import type { Moment } from "../moment-class";
import { momentProperties } from "../moment-class";
import { Duration, createDurationFast, isDuration as checkIsDuration } from "../duration";
import { isMoment, isArray } from "../utils";
import { parseTwoDigitYear as parseTwoDigitYearInternal, setParseTwoDigitYear } from "../parse";
import { moment, nowFn, getMomentNowFunction, setMomentNowFunction } from "../core/factory";
import { normalizeUnits as normUnits } from "../units";
import { registerBaseCoreApi, type CoreApiDeps } from "./core-base";

type CoreMomentTarget = typeof moment;

const defaultDeps: CoreApiDeps = {
  getMomentNowFunction,
  setMomentNowFunction,
  nowFn,
  parseTwoDigitYearInternal,
  setParseTwoDigitYear,
};

export function registerCoreApi(
  target: CoreMomentTarget = moment,
  deps: CoreApiDeps = defaultDeps,
): void {
  const momentRecord = target as unknown as Record<string, unknown>;

  registerBaseCoreApi(target as unknown as Parameters<typeof registerBaseCoreApi>[0], deps);
  momentRecord.duration = createDurationFast;
  (momentRecord.duration as Record<string, unknown>).invalid = function (): Duration {
    return Duration.invalid();
  };
  (momentRecord.duration as Record<string, unknown>).fn = Duration.prototype;
  momentRecord.isDuration = function (obj: unknown): boolean {
    return checkIsDuration(obj);
  };
  momentRecord.normalizeUnits = normUnits;
  momentRecord.momentProperties = momentProperties;
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
  momentRecord.parseZone = function (input?: unknown, format?: unknown, strict?: boolean): Moment {
    const m = target(input, format, strict);
    return m.parseZone();
  };
  momentRecord.min = function (...args: unknown[]): Moment {
    if (args.length === 0) {
      return target();
    }
    let inputList = args;
    if (args.length === 1 && isArray(args[0]) && !isMoment(args[0])) {
      inputList = args[0];
    }
    let best: Moment | null = null;
    let bestVal = Infinity;
    let bestInvalid: Moment | null = null;
    for (const item of inputList) {
      const m = isMoment(item) ? (item as Moment) : target(item);
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
    if (args.length === 0) {
      return target();
    }
    let inputList = args;
    if (args.length === 1 && isArray(args[0]) && !isMoment(args[0])) {
      inputList = args[0];
    }
    let best: Moment | null = null;
    let bestVal = -Infinity;
    let bestInvalid: Moment | null = null;
    for (const item of inputList) {
      const m = isMoment(item) ? (item as Moment) : target(item);
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
