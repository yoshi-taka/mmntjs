import type { RelTimeRoundingFn, RelTimeThresholdKey } from "../types";
import {
  Moment,
  setDisplayExtraCallbacks,
  setRelTimeRounding,
  setRelTimeThreshold,
} from "../moment-class";
import { moment } from "../core/factory";
import { formatCalendar, formatFrom, formatFromNow, formatTo, formatToNow } from "../display/extra";

type DisplayMoment = typeof moment;

export function registerDisplayApi(target: DisplayMoment = moment): void {
  const momentRecord = target as unknown as Record<string, unknown>;
  setDisplayExtraCallbacks({
    fromNow: formatFromNow,
    from: formatFrom,
    toNow: formatToNow,
    to: formatTo,
    calendar: formatCalendar,
  });

  // compatibility boundary: public API accepts any function|boolean
  momentRecord.relativeTimeRounding = function (fn?: RelTimeRoundingFn): RelTimeRoundingFn {
    return setRelTimeRounding(fn);
  };
  momentRecord.relativeTimeThreshold = function (
    threshold: RelTimeThresholdKey,
    limit?: number,
  ): number | boolean | null {
    return setRelTimeThreshold(threshold, limit);
  };
  Object.defineProperty(target, "calendarFormat", {
    get(): ((m: Moment, now: Moment) => string) | undefined {
      return Moment.calendarFormat;
    },
    set(v: ((m: Moment, now: Moment) => string) | undefined) {
      Moment.calendarFormat = v ?? undefined;
    },
    enumerable: true,
    configurable: true,
  });
}
