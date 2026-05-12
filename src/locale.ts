import { isFunction } from "./utils";
import type { LocaleSpec } from "./locale/en";
import { enLocale } from "./locale/en";
import {
  Locale,
  clearLocaleRuntimeCache,
  getCurrentLocale,
  getLocale,
  hasLocale,
  localeConfigs,
  localeHasMissingParent,
  mergeLocaleConfigs,
  setCurrentLocaleName,
  setLocale,
} from "./locale-runtime";

export {
  Locale,
  getLocale,
  getCurrentLocale,
  setLocale,
  hasLocale,
  localeHasMissingParent,
};

const originalLocales: Record<string, LocaleSpec | undefined> = {};

function normalizeLocale(key: string): string {
  return key ? key.toLowerCase().replaceAll('_', "-") : key;
}

function commonPrefix(arr1: string[], arr2: string[]): number {
  const minl = Math.min(arr1.length, arr2.length);
  for (let i = 0; i < minl; i++) {
    if (arr1[i] !== arr2[i]) {return i;}
  }
  return minl;
}

export function _findBestLocaleName(locale: string): string | null {
  const normalized = normalizeLocale(locale);
  if (hasLocale(normalized)) {return normalized;}
  const parts = normalized.split("-");
  for (let i = parts.length - 1; i >= 1; i--) {
    const parent = parts.slice(0, i).join("-");
    if (hasLocale(parent)) {return parent;}
  }
  return null;
}

export function setLocaleFromArray(localesArr: string[]): string {
  for (let i = 0; i < localesArr.length; i++) {
    const split = normalizeLocale(localesArr[i]).split("-");
    let j = split.length;
    const nextName = i + 1 < localesArr.length ? normalizeLocale(localesArr[i + 1]) : null;
    const next = nextName ? nextName.split("-") : null;
    while (j > 0) {
      const candidate = split.slice(0, j).join("-");
      if (hasLocale(candidate)) {
        setLocale(candidate);
        return candidate;
      }
      if (next && next.length >= j && commonPrefix(split, next) >= j - 1) {
        break;
      }
      j--;
    }
  }
  setLocale("en");
  return "en";
}

export function defineLocale(locale: string, config: LocaleSpec | null): Locale | undefined {
  if (config === null) {
    delete localeConfigs[locale];
    delete originalLocales[locale];
    clearLocaleRuntimeCache();
    if (getCurrentLocale() === locale) {
      setCurrentLocaleName("en");
    }
    return getLocale(locale);
  }

  if (originalLocales[locale]) {
    delete originalLocales[locale];
  }

  const parentLocale = (config as LocaleSpec & { parentLocale?: string }).parentLocale;
  const currentConfig = localeConfigs[locale];
  if (currentConfig && !parentLocale) {
    localeConfigs[locale] = mergeLocaleConfigs(currentConfig, config);
  } else {
    localeConfigs[locale] = config;
  }

  clearLocaleRuntimeCache();
  if (!parentLocale || hasLocale(parentLocale)) {
    setCurrentLocaleName(locale);
  }
  if (parentLocale && !hasLocale(parentLocale)) {
    return undefined;
  }
  return getLocale(locale);
}

export function updateLocale(locale: string, config: Partial<LocaleSpec> | null): Locale {
  if (config === null) {
    const original = originalLocales[locale];
    if (original) {
      localeConfigs[locale] = { ...original };
      delete originalLocales[locale];
    } else {
      delete localeConfigs[locale];
      if (getCurrentLocale() === locale) {
        setLocale("en");
      }
    }
    clearLocaleRuntimeCache();
    return getLocale(locale);
  }

  const currentConfig = localeConfigs[locale];
  if (!originalLocales[locale] && currentConfig) {
    originalLocales[locale] = { ...currentConfig };
  }

  if (!currentConfig) {
    localeConfigs[locale] = mergeLocaleConfigs({ ...enLocale }, config as LocaleSpec);
    clearLocaleRuntimeCache();
    setLocale(locale);
    return getLocale(locale);
  }

  const configParentLocale = (config as Partial<LocaleSpec> & { parentLocale?: string }).parentLocale;
  if (configParentLocale) {
    localeConfigs[locale] = { ...(config as Partial<LocaleSpec> & Record<string, unknown>) } as LocaleSpec;
  } else {
    localeConfigs[locale] = mergeLocaleConfigs(currentConfig, config as LocaleSpec);
  }
  clearLocaleRuntimeCache();
  setCurrentLocaleName(locale);
  return getLocale(locale);
}

export function listLocales(): string[] {
  return Object.keys(localeConfigs);
}

export function getMonths(format?: string | number, index?: number): string | string[] {
  const loc = getLocale();
  if (typeof format === "number") {
    return loc._months[format];
  }
  const isShort = format === "short" || format !== undefined;
  if (isShort) {
    const cfgShort = loc._config.monthsShort ?? enLocale.monthsShort;
    if (isFunction(cfgShort)) {
      const fmt = typeof format === "string" && format !== "short" ? format : "MMM";
      if (index !== undefined) {
        return (cfgShort as Function)({ month: () => index } as { month: () => number }, fmt);
      }
      const all: string[] = [];
      for (let i = 0; i < loc._months.length; i++) {
        const r = (cfgShort as Function)({ month: () => i } as { month: () => number }, fmt);
        if (Array.isArray(r)) {return r;}
        all.push(r);
      }
      return all;
    }
    if (index !== undefined) {return loc._monthsShort[index];}
    return loc._monthsShort;
  }
  if (index !== undefined) {return loc._months[index];}
  return loc._months;
}

function reorderByDow(arr: string[], dow: number): string[] {
  return arr.slice(dow).concat(arr.slice(0, dow));
}

export function getWeekdays(format?: string | number | boolean, index?: number): string | string[] {
  const loc = getLocale();
  const weekCfg = (loc._config as LocaleSpec & Record<string, unknown>).week ?? { dow: 0 };
  const dow = weekCfg.dow;
  if (typeof format === "number") {
    return loc._weekdays[format];
  }
  if (format === true) {
    const reordered = reorderByDow(loc._weekdays, dow);
    if (index !== undefined) {return reordered[index];}
    return reordered;
  }
  if (format === "short") {
    const ws = loc.weekdaysShortArray();
    if (index !== undefined) {return ws[index];}
    return ws;
  }
  if (format === "min") {
    const wm = loc.weekdaysMinArray();
    if (index !== undefined) {return wm[index];}
    return wm;
  }
  if (format === "format") {
    const reordered = reorderByDow(loc._weekdays, dow);
    if (index !== undefined) {return reordered[index];}
    return reordered;
  }
  if (format === "shortFormat") {
    const reordered = reorderByDow(loc.weekdaysShortArray(), dow);
    if (index !== undefined) {return reordered[index];}
    return reordered;
  }
  if (format === "minFormat") {
    const reordered = reorderByDow(loc.weekdaysMinArray(), dow);
    if (index !== undefined) {return reordered[index];}
    return reordered;
  }
  if (index !== undefined) {return loc._weekdays[index];}
  return loc._weekdays;
}
