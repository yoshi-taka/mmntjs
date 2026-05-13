import { moment, nowFn } from "../core/factory";
import { formatMoment } from "../format";
import { setCalendarMethodCallbacks, setDebugMethodCallbacks, setFormatMomentCallback, setLocaleRuntimeCallbacks, setLocaleMethodCallbacks } from "../moment-class";
import { getCurrentLocale, getLocale, hasLocale } from "../locale-runtime";
import { lang, localeData, localeMethod, localeWeek, localeWeekYear, localeWeekday, localeWeeksInWeekYear, localeWeeksInYear } from "../locale-extra";
import { calendarCompareMoment, dayOfYearMoment, isoWeekdayMoment, isoWeekMoment, isoWeekYearMoment, isoWeeksInISOWeekYearMoment, isoWeeksInYearMoment } from "../calendar-extra";
import { endOfExtraMoment, startOfExtraMoment } from "../boundary-extra";
import { creationDataMoment, inspectMoment, invalidAtMoment, parsingFlagsMoment, toArrayMoment, toObjectMoment, toStringMoment } from "../debug-extra";
import { registerCoreApi } from "../plugins/core";
import { registerDisplayApi } from "../plugins/display";
import { enableCustomFormatParsing } from "../parse";
import { initializeLocaleEntry } from "./locale-init";
import { registerUtcApi } from "../plugins/utc";
import { setDurationMomentResolver } from "../duration";
import type { DurationMomentLike } from "../duration-between";
import { Moment } from "../moment-class";

type CoreInitMoment = typeof moment;
type CoreInitDeps = Parameters<typeof registerCoreApi>[1];

export function initializeCoreEntry(
  target: CoreInitMoment = moment,
  deps?: CoreInitDeps,
): void {
  setFormatMomentCallback(formatMoment);
  setLocaleRuntimeCallbacks({ getCurrentLocale, getLocale, hasLocale });
  setLocaleMethodCallbacks({
    weekday: localeWeekday,
    week: localeWeek,
    weekYear: localeWeekYear,
    weeksInYear: localeWeeksInYear,
    weeksInWeekYear: localeWeeksInWeekYear,
    localeData,
    lang,
    locale: localeMethod,
  });
  setCalendarMethodCallbacks({
    isoWeekday: isoWeekdayMoment,
    dayOfYear: dayOfYearMoment,
    isoWeek: isoWeekMoment,
    isoWeekYear: isoWeekYearMoment,
    isoWeeksInYear: isoWeeksInYearMoment,
    isoWeeksInISOWeekYear: isoWeeksInISOWeekYearMoment,
    compare: calendarCompareMoment,
    startOfExtra: startOfExtraMoment,
    endOfExtra: endOfExtraMoment,
  });
  setDebugMethodCallbacks({
    toArray: toArrayMoment,
    inspect: inspectMoment,
    creationData: creationDataMoment,
    parsingFlags: parsingFlagsMoment,
    invalidAt: invalidAtMoment,
    toObject: toObjectMoment,
    toString: toStringMoment,
  });
  registerCoreApi(target, deps);
  registerDisplayApi(target);
  registerUtcApi(target as unknown as Parameters<typeof registerUtcApi>[0], { nowFn });
  setDurationMomentResolver((input: unknown) => {
    if (input instanceof Moment) {return input as unknown as DurationMomentLike;}
    return target(input as any) as unknown as DurationMomentLike;
  });
}

export function initializeFullEntry(
  target: CoreInitMoment = moment,
  deps?: CoreInitDeps,
): void {
  initializeCoreEntry(target, deps);
  enableCustomFormatParsing();
  initializeLocaleEntry();
}

export { registerFormatParsePlugin as initializeFormatParsePlugin } from "../plugins/format-parse";
