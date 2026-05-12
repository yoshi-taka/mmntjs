import type { Moment } from "./moment2";
import { isFunction, isString, isMoment, escapeRegex } from "./utils";
import type { LocaleSpec } from "./locale/en";
import { enLocale } from "./locale/en";
import { buildRenderFns, lowerVariant, type RenderFn } from "./format-tokens";

let currentLocaleName = "en";
export const localeConfigs: Record<string, LocaleSpec | undefined> = {
  en: enLocale,
};
export const _localeCache = new Map<string, Locale>();

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function mergeConfig(base: LocaleSpec, override: Partial<LocaleSpec>): LocaleSpec {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const val = (override as Record<string, unknown>)[key];
    if (val !== undefined) {
      if (
        typeof val === "object" &&
        val !== null &&
        !Array.isArray(val) &&
        !(val instanceof RegExp) &&
        typeof base[key as keyof LocaleSpec] === "object" &&
        !Array.isArray(base[key as keyof LocaleSpec]) &&
        !(base[key as keyof LocaleSpec] instanceof RegExp)
      ) {
        result[key] = { ...(base as Record<string, unknown>)[key] as Record<string, unknown>, ...val as Record<string, unknown> };
      } else {
        result[key] = val;
      }
    }
  }
  return result as LocaleSpec;
}

export function mergeLocaleConfigs(base: LocaleSpec, override: Partial<LocaleSpec>): LocaleSpec {
  return mergeConfig(base, override);
}

function resolveLocaleConfig(locale: string): LocaleSpec {
  const config = localeConfigs[locale];
  const baseEn = { ...enLocale };
  if (!config) {
    if (locale === "en") {return { ...(localeConfigs.en ?? enLocale) };}
    const parts = locale.split("-");
    if (parts.length > 1) {
      const parentKey = parts.slice(0, -1).join("-");
      return resolveLocaleConfig(parentKey);
    }
    return baseEn;
  }
  const parentLocale = (config as LocaleSpec & { parentLocale?: string }).parentLocale;
  if (parentLocale && localeConfigs[parentLocale]) {
    const parent = resolveLocaleConfig(parentLocale);
    return mergeConfig(parent, config);
  }
  if (parentLocale && !localeConfigs[parentLocale]) {
    delete baseEn.ordinal;
    return mergeConfig(baseEn, config);
  }
  delete baseEn.ordinal;
  return mergeConfig(baseEn, config);
}

export class Locale {
  _config: LocaleSpec;
  _abbr: string;

  constructor(config: LocaleSpec, abbr?: string) {
    this._config = { ...config };
    for (const key of Object.keys(config)) {
      if (!key.startsWith('_') && !((this._config as Record<string, unknown>)[`_${  key}`] !== undefined)) {
        (this._config as Record<string, unknown>)[`_${  key}`] = (config as Record<string, unknown>)[key];
      }
    }
    this._abbr = abbr ?? currentLocaleName;
  }

  get _months(): string[] {
    const months = this._config.months ?? enLocale.months;
    if (!months) {return [];}
    if (isFunction(months)) {
      try {
        const result = (months as Function).call(this._config);
        if (Array.isArray(result)) {return result;}
      } catch {}
      return [];
    }
    if (Array.isArray(months)) {return months;}
    return months.standalone;
  }

  get _monthsShort(): string[] {
    const ms = this._config.monthsShort ?? enLocale.monthsShort;
    if (!ms) {return this._months;}
    if (isFunction(ms)) {
      const result: string[] = [];
      for (let i = 0; i < this._months.length; i++) {
        const r = (ms as Function).call(this._config, { month: () => i } as { month: () => number }, "MMM");
        result.push(r);
      }
      return result;
    }
    if (Array.isArray(ms)) {return ms;}
    return ms.standalone;
  }

  get _weekdays(): string[] {
    const wd = this._config.weekdays ?? enLocale.weekdays;
    if (!wd) {return [];}
    if (isFunction(wd)) {
      const result: string[] = [];
      for (let i = 0; i < 7; i++) {
        const r = (wd as Function)({ day: () => i }, "dddd");
        result.push(r);
      }
      return result;
    }
    if (Array.isArray(wd)) {return wd;}
    return (wd as unknown as Record<string, string[]>).standalone;
  }

  monthsArray(): string[] {
    return this._months;
  }

  monthsShortArray(): string[] {
    return this._monthsShort;
  }

  weekdaysArray(): string[] {
    return this._weekdays;
  }

  weekdaysShortArray(): string[] {
    const ws = this._config.weekdaysShort ?? enLocale.weekdaysShort;
    if (!ws) {return this._weekdays;}
    if (isFunction(ws)) {
      const result: string[] = [];
      for (let i = 0; i < 7; i++) {
        const r = (ws as Function)({ day: () => i } as { day: () => number }, "ddd");
        result.push(r);
      }
      return result;
    }
    return ws as string[];
  }

  weekdaysMinArray(): string[] {
    const wm = this._config.weekdaysMin ?? enLocale.weekdaysMin;
    if (!wm) {return this.weekdaysShortArray();}
    if (isFunction(wm)) {
      const result: string[] = [];
      for (let i = 0; i < 7; i++) {
        const r = (wm as Function)({ day: () => i } as { day: () => number }, "dd");
        result.push(r);
      }
      return result;
    }
    return wm as string[];
  }

  get _longDateFormat(): Record<string, string> {
    return this._config.longDateFormat ?? enLocale.longDateFormat ?? {};
  }

  get _week(): { dow: number; doy: number } | undefined {
    return this._config.week;
  }

  meridiemParse(): RegExp | undefined {
    const mp = this._config.meridiemParse;
    if (mp instanceof RegExp) {return mp;}
    if (enLocale.meridiemParse instanceof RegExp) {return enLocale.meridiemParse;}
    return undefined;
  }

}

export function localeMeridiem(loc: Locale, hour: number, minute: number, isLower: boolean): string {
  if (loc._config.meridiem) {
    return loc._config.meridiem(hour, minute, isLower);
  }
  if (enLocale.meridiem) {
    return enLocale.meridiem(hour, minute, isLower);
  }
  const prefix = hour < 12 ? "AM" : "PM";
  return isLower ? prefix.toLowerCase() : prefix;
}

export function localeMonths(loc: Locale, m?: Moment, format?: string): string[] | string {
  if (!isMoment(m)) {
    return loc._months;
  }
  const months = loc._config.months ?? enLocale.months;
  if (!months) {return [];}
  if (isFunction(months)) {
    return months.call(loc._config, m, format);
  }
  if (isString(months)) {
    return months;
  }
  if (Array.isArray(months)) {
    const month = m.month();
    if (months[month]) {return months[month];}
    return months;
  }
  const isFmt = months.isFormat;
  const monthsInFormat = /D[oD]?(\[[^[\]]*\]|\s)+MMMM?/;
  const useFormat = format && (isFmt instanceof RegExp ? isFmt : monthsInFormat).test(format);
  const list: string[] = useFormat ? months.format : months.standalone;
  const month = m.month();
  return list[month] || "";
}

export function localeMonthsShort(loc: Locale, m?: Moment, format?: string): string[] | string {
  if (!isMoment(m)) {
    return loc._monthsShort;
  }
  const ms = loc._config.monthsShort ?? enLocale.monthsShort;
  if (!ms) {return localeMonths(loc, m, format);}
  if (isFunction(ms)) {
    return ms.call(loc._config, m, format);
  }
  if (isString(ms)) {
    return ms;
  }
  if (Array.isArray(ms)) {
    const month = m.month();
    if (ms[month]) {return ms[month];}
    return ms;
  }
  const monthsInFormat = /D[oD]?(\[[^[\]]*\]|\s)+MMMM?/;
  const useFormat = format && monthsInFormat.test(format);
  const list: string[] = useFormat ? ms.format : ms.standalone;
  const month = m.month();
  return list[month] || "";
}

export function localeWeekdays(loc: Locale, m?: Moment | boolean, format?: string): string[] | string {
  if (m === true) {
    const dow = loc._week?.dow ?? 0;
    return loc._weekdays.slice(dow).concat(loc._weekdays.slice(0, dow));
  }
  if (!isMoment(m)) {
    return loc._weekdays;
  }
  const wd = loc._config.weekdays ?? enLocale.weekdays;
  if (!wd) {return [];}
  if (isString(wd)) {return wd;}
  if (isFunction(wd)) {return wd(m, format) as string;}
  if (Array.isArray(wd)) {return wd[m.day()] || "";}
  const isFmt = wd.isFormat;
  const useFormat = format && isFmt instanceof RegExp && isFmt.test(format);
  const list = useFormat ? wd.format : wd.standalone ?? wd.format;
  if (Array.isArray(list)) {return list[m.day()] ?? "";}
  return "";
}

export function localeWeekdaysShort(loc: Locale, m?: Moment | boolean, format?: string): string[] | string {
  if (m === true) {
    const arr = loc.weekdaysShortArray();
    const dow = loc._week?.dow ?? 0;
    return arr.slice(dow).concat(arr.slice(0, dow));
  }
  if (!isMoment(m)) {
    let ws = loc._config.weekdaysShort;
    ws ??= enLocale.weekdaysShort;
    if (!ws) {return loc._weekdays;}
    if (isFunction(ws)) {return ws(null as unknown as Moment, format);}
    return ws as string[] | string;
  }
  let ws = loc._config.weekdaysShort;
  ws ??= enLocale.weekdaysShort;
  if (!ws) {return localeWeekdays(loc, m) as string[];}
  if (isFunction(ws)) {return ws(m, format);}
  if (isString(ws)) {return ws;}
  return (ws as unknown as Record<string, string[]>).standalone;
}

export function localeWeekdaysMin(loc: Locale, m?: Moment | boolean, format?: string): string[] | string {
  if (m === true) {
    const arr = loc.weekdaysMinArray();
    const dow = loc._week?.dow ?? 0;
    return arr.slice(dow).concat(arr.slice(0, dow));
  }
  if (!isMoment(m)) {
    let wm = loc._config.weekdaysMin;
    wm ??= enLocale.weekdaysMin;
    if (!wm) {return loc.weekdaysShortArray();}
    if (isFunction(wm)) {return wm(null as unknown as Moment, format);}
    return wm as string[] | string;
  }
  let wm = loc._config.weekdaysMin;
  wm ??= enLocale.weekdaysMin;
  if (!wm) {return localeWeekdaysShort(loc, m) as string[];}
  if (isFunction(wm)) {return wm(m, format);}
  if (isString(wm)) {return wm;}
  return (wm as unknown as Record<string, string[]>).standalone;
}

export function localeIsPM(loc: Locale, input: string): boolean {
  if (loc._config.isPM) {
    return loc._config.isPM(input);
  }
  if (enLocale.isPM) {
    return enLocale.isPM(input);
  }
  return String(input).toLowerCase().charAt(0) === "p";
}

export function localeLongDateFormat(loc: Locale, key: string): string {
  const ldf = loc._config.longDateFormat ?? enLocale.longDateFormat;
  if (ldf) {
    if (ldf[key]) {
      return ldf[key];
    }
    const upperKey = key.toUpperCase().replace(/S$/, "S");
    if (key !== upperKey && key.startsWith("l") && ldf[upperKey]) {
      let fmt = ldf[upperKey];
      fmt = fmt.replaceAll("MMMM", "MMM").replaceAll("dddd", "ddd");
      const brackets: string[] = [];
      fmt = fmt.replaceAll(/\[[^\]]*\]/g, (m: string) => {
        brackets.push(m);
        return `\x00${brackets.length - 1}\x00`;
      });
      fmt = fmt.replaceAll(/DD(?!D)/g, "D").replaceAll(/(^|[^M])MM(?!M)([^M]|$)/g, "$1M$2");
      // oxlint-disable-next-line no-control-regex
      fmt = fmt.replaceAll(/\x00\d+\x00/g, () => brackets.shift()!);
      return fmt;
    }
    if (ldf[upperKey] && key !== upperKey) {
      return ldf[upperKey];
    }
  }
  return key;
}

export function localeOrdinal(loc: Locale, n: number, token?: string): string {
  if (loc._config.ordinal) {
    const val = loc._config.ordinal;
    if (isFunction(val)) {
      return val(n, token);
    }
    return val.replace("%d", String(n));
  }
  return String(n);
}

export function localeRelativeTime(
  loc: Locale,
  n: number,
  key: string,
  isFuture: boolean | undefined,
  withoutSuffix?: boolean,
): string {
  if (loc._config.relativeTimeFn) {
    return loc._config.relativeTimeFn(n, key, isFuture as boolean);
  }
  const rt = loc._config.relativeTime ?? enLocale.relativeTime;
  if (rt && hasOwn(rt, key) && key !== "future" && key !== "past") {
    const entry = (rt as Record<string, string | Function>)[key];
    const num = n || 1;
    let str: string;
    if (isFunction(entry)) {
      str = entry(num, withoutSuffix ?? false, key, isFuture ?? false);
    } else {
      str = entry.replace("%d", String(num));
    }
    if (withoutSuffix) {return str;}
    if (isFuture) {
      const f = rt.future || "in %s";
      return isFunction(f) ? f(str) : f.replace("%s", str);
    }
    const p = rt.past || "%s ago";
    return isFunction(p) ? p(str) : p.replace("%s", str);
  }
  return "";
}

export function localeInvalidDate(loc: Locale): string {
  return loc._config.invalidDate ?? enLocale.invalidDate ?? "Invalid date";
}

export function localePreparse(loc: Locale, str: string): string {
  const fn = loc._config.preparse;
  if (fn) {return fn(str);}
  return str;
}

export function localePostformat(loc: Locale, str: string): string {
  const fn = loc._config.postformat;
  if (fn) {return fn(str);}
  return str;
}

function clearLocaleCache(): void {
  _localeCache.clear();
}

export function clearLocaleRuntimeCache(): void {
  clearLocaleCache();
}

export function setCurrentLocaleName(name: string): void {
  currentLocaleName = name;
}

export function getLocale(locale?: string | { _locale?: { _abbr?: string }; _l?: string }): Locale {
  if (typeof locale === "object" && locale._locale?._abbr) {
    locale = locale._locale._abbr;
  } else if (typeof locale === "object" && locale._l) {
    locale = locale._l;
  }
  const key = (locale as string | undefined) ?? currentLocaleName;
  const cached = _localeCache.get(key);
  if (cached) {return cached;}
  const config = resolveLocaleConfig(key);
  const loc = new Locale(config, key);
  precompileLocaleFormats(loc);
  _localeCache.set(key, loc);
  return loc;
}

function precompileLocaleFormats(loc: Locale): void {
  const ldf = (loc._config as Record<string, unknown>).longDateFormat as Record<string, string> | undefined;
  if (!ldf) {return;}
  const cache: Record<string, RenderFn[]> = {};
  for (const key of Object.keys(ldf)) {
    cache[key] = buildRenderFns(ldf[key]);
  }
  for (const upper of ["L", "LL", "LLL", "LLLL"]) {
    const lower = upper.toLowerCase();
    cache[lower] ??= buildRenderFns(lowerVariant(ldf[upper]));
    }
    cache.lt = buildRenderFns(lowerVariant(ldf.LT));
    cache.lts = buildRenderFns(lowerVariant(ldf.LTS));
  (loc._config as Record<string, unknown>)._localeRenderFns = cache;
}

export function setLocale(locale: string): void {
  currentLocaleName = locale;
  _localeCache.delete(currentLocaleName);
}

export function getCurrentLocale(): string {
  return currentLocaleName;
}

export function hasLocale(name: string): boolean {
  return !!localeConfigs[name];
}

export function localeHasMissingParent(name: string): boolean {
  const config = localeConfigs[name];
  if (!config) {return false;}
  const parentLocale = (config as LocaleSpec & { parentLocale?: string }).parentLocale;
  return !!parentLocale && !localeConfigs[parentLocale];
}
