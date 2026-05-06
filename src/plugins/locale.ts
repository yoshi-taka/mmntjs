import type {
  Locale} from "../locale";
import {
  getLocale,
  setLocale,
  setLocaleFromArray,
  getCurrentLocale,
  defineLocale,
  updateLocale,
  getMonths,
  getWeekdays,
  listLocales,
} from "../locale";
import type { LocaleSpec } from "../locale/en";
import { moment } from "../core/factory";

export function registerLocaleApi(): void {
  const momentRecord = moment as unknown as Record<string, unknown>;

  momentRecord.locale = function (locale?: string | string[], ...args: unknown[]): string | Locale {
    if (locale === undefined) {return getCurrentLocale();}
    if (Array.isArray(locale)) {
      return setLocaleFromArray(locale);
    }
    if (args.length > 0 && typeof args[0] === "object") {
      defineLocale(locale, args[0] as LocaleSpec);
      return locale;
    }
    setLocale(locale);
    return getCurrentLocale();
  };
  momentRecord.localeData = function (locale?: string): Locale {
    return getLocale(locale);
  };
  momentRecord.lang = function (locale?: string, ...args: unknown[]): string | Locale {
    if (locale === undefined) {return (momentRecord.locale as () => string | Locale)();}
    if (args.length > 0 && typeof args[0] === "object") {
      return (momentRecord.locale as (locale?: string, ...args: unknown[]) => string | Locale)(locale, args[0]);
    }
    return (momentRecord.locale as (locale?: string, ...args: unknown[]) => string | Locale)(locale);
  };
  momentRecord.langData = function (locale?: string): Locale {
    return (momentRecord.localeData as (locale?: string) => Locale)(locale);
  };
  momentRecord.defineLocale = function (locale: string, config: Record<string, unknown>): Locale | void {
    return defineLocale(locale, config);
  };
  momentRecord.updateLocale = function (locale: string, config: Record<string, unknown> | null): Locale | void {
    return updateLocale(locale, config as unknown as Partial<LocaleSpec>);
  };
  momentRecord.locales = listLocales;
  momentRecord.months = function (format?: string, index?: number): string | string[] {
    return getMonths(format, index);
  };
  momentRecord.monthsShort = function (
    format?: string | number,
    index?: number,
  ): string | string[] {
    if (typeof format === "number") {
      return getLocale()._monthsShort[format];
    }
    return getMonths(format ?? "short", index);
  };
  momentRecord.weekdays = function (
    format?: string | boolean | number,
    index?: number,
  ): string | string[] {
    if (typeof format === "number") {
      return getLocale()._weekdays[format];
    }
    return getWeekdays(format as string | boolean, index);
  };
  momentRecord.weekdaysShort = function (
    format?: string | boolean | number,
    index?: number,
  ): string | string[] {
    if (typeof format === "number") {
      return getLocale().weekdaysShortArray()[format];
    }
    if (typeof format === "boolean") {
      return getWeekdays(format ? "shortFormat" : "short", index);
    }
    return getWeekdays(format ?? "short", index);
  };
  momentRecord.weekdaysMin = function (
    format?: string | boolean | number,
    index?: number,
  ): string | string[] {
    if (typeof format === "number") {
      return getLocale().weekdaysMinArray()[format];
    }
    if (typeof format === "boolean") {
      return getWeekdays(format ? "minFormat" : "min", index);
    }
    return getWeekdays(format ?? "min", index);
  };
}
