import { Moment, setDisplayExtraCallbacks, setRelTimeRounding, setRelTimeThreshold } from "../moment-class";
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

  momentRecord.relativeTimeRounding = function (fn?: Function | boolean): Function | boolean {
    return setRelTimeRounding(fn as Function | boolean);
  };
  momentRecord.relativeTimeThreshold = function (
    threshold: string,
    limit?: number,
  ): number | boolean {
    return setRelTimeThreshold(threshold, limit) as number | boolean;
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
