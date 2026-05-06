import { Moment, setRelTimeRounding, setRelTimeThreshold } from "../moment_fixed";
import { moment } from "../core/factory";

export function registerDisplayApi(): void {
  const momentRecord = moment as Record<string, unknown>;

  momentRecord.relativeTimeRounding = function (fn?: Function | boolean): Function | boolean {
    return setRelTimeRounding(fn as Function | boolean);
  };
  momentRecord.relativeTimeThreshold = function (
    threshold: string,
    limit?: number,
  ): number | boolean {
    return setRelTimeThreshold(threshold, limit) as number | boolean;
  };
  Object.defineProperty(moment, "calendarFormat", {
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
