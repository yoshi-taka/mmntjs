import { enLocale } from "./locale/en";
import type { Locale } from "./locale-runtime";

const liteLocale = {
  _config: enLocale,
  _abbr: "en",
  monthsArray: () => (enLocale.months as string[]).slice(),
  monthsShortArray: () => (enLocale.monthsShort as string[]).slice(),
  weekdaysArray: () => (enLocale.weekdays as string[]).slice(),
  weekdaysShortArray: () => (enLocale.weekdaysShort as string[]).slice(),
  weekdaysMinArray: () => (enLocale.weekdaysMin as string[]).slice(),
} as unknown as Locale;

export function getLiteCurrentLocale(): string {
  return "en";
}

export function getLiteLocale(_name?: string): Locale {
  return liteLocale;
}

export function hasLiteLocale(name: string): boolean {
  return name === "en" || name === "en-us";
}
