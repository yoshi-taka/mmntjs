import type { Moment } from "./moment_fixed";
import { isFunction, isString, isMoment, escapeRegex } from "./utils";
import type { LocaleSpec } from "./locale/en";
import { enLocale } from "./locale/en";

let currentLocaleName = "en";
const locales: Record<string, LocaleSpec> = {
  en: enLocale,
};
const _localeCache = new Map<string, Locale>();
const originalLocales: Record<string, LocaleSpec> = {};

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
        result[key] = { ...(base as Record<string, unknown>)[key], ...val };
      } else {
        result[key] = val;
      }
    }
  }
  return result as LocaleSpec;
}

function resolveLocaleConfig(locale: string): LocaleSpec {
  const config = locales[locale];
  const baseEn = { ...enLocale };
  if (!config) {
    if (locale === "en") {return { ...(locales["en"] || enLocale) };}
    const parts = locale.split("-");
    if (parts.length > 1) {
      const parentKey = parts.slice(0, -1).join("-");
      return resolveLocaleConfig(parentKey);
    }
    return baseEn;
  }
  const parentLocale = (config as LocaleSpec & { parentLocale?: string }).parentLocale;
  if (parentLocale && locales[parentLocale]) {
    const parent = resolveLocaleConfig(parentLocale);
    return mergeConfig(parent, config);
  }
  if (parentLocale && !locales[parentLocale]) {
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
    this._abbr = abbr || currentLocaleName;
  }

  get _months(): string[] {
    const months = this._config.months || enLocale.months;
    if (!months) {return [];}
    if (isFunction(months)) {
      try {
        const result = (months as Function).call(this._config);
        if (Array.isArray(result)) {return result;}
      } catch {}
      return [];
    }
    if (Array.isArray(months)) {return months;}
    if (typeof months === "object") {return (months as Record<string, string[]>).standalone || (months as Record<string, string[]>).format || [];}
    return months as string[];
  }

  get _monthsShort(): string[] {
    const ms = this._config.monthsShort || enLocale.monthsShort;
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
    if (typeof ms === "object") {return (ms as Record<string, string[]>).standalone || (ms as Record<string, string[]>).format || this._months;}
    return ms as string[];
  }

  get _weekdays(): string[] {
    const wd = this._config.weekdays || enLocale.weekdays;
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
    if (typeof wd === "object" && wd !== null) {
      return (wd as Record<string, string[]>).standalone || (wd as Record<string, string[]>).format || [];
    }
    return wd as string[];
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
    const ws = this._config.weekdaysShort || enLocale.weekdaysShort;
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
    const wm = this._config.weekdaysMin || enLocale.weekdaysMin;
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

  months(m?: Moment, format?: string): string[] | string {
    if (!isMoment(m)) {
      return this._months;
    }
    const months = this._config.months || enLocale.months;
    if (!months) {return [];}
    if (isFunction(months)) {
      return (months as Function).call(this._config, m, format);
    }
    if (isString(months)) {
      return months;
    }
    if (Array.isArray(months)) {
      const month = m.month() as number;
      if ((months as string[])[month]) {return (months as string[])[month];}
      return months as string[];
    }
    if (typeof months === "object") {
      const isFmt = (months as Record<string, unknown>).isFormat;
      const monthsInFormat = /D[oD]?(\[[^[\]]*\]|\s)+MMMM?/;
      const useFormat = format && (isFmt instanceof RegExp ? isFmt : monthsInFormat).test(format);
      const list: string[] = useFormat ? (months as Record<string, string[]>).format || (months as Record<string, string[]>).standalone : (months as Record<string, string[]>).standalone || (months as Record<string, string[]>).format;
      const month = m.month() as number;
      return list[month] || "";
    }
    return "";
  }

  monthsShort(m?: Moment, format?: string): string[] | string {
    if (!isMoment(m)) {
      return this._monthsShort;
    }
    const ms = this._config.monthsShort || enLocale.monthsShort;
    if (!ms) {return this.months(m, format);}
    if (isFunction(ms)) {
      return (ms as Function).call(this._config, m, format);
    }
    if (isString(ms)) {
      return ms;
    }
    if (Array.isArray(ms)) {
      const month = m.month() as number;
      if ((ms as string[])[month]) {return (ms as string[])[month];}
      return ms as string[];
    }
    if (typeof ms === "object") {
      const monthsInFormat = /D[oD]?(\[[^[\]]*\]|\s)+MMMM?/;
      const useFormat = format && monthsInFormat.test(format);
      const list: string[] = useFormat ? (ms as Record<string, string[]>).format || (ms as Record<string, string[]>).standalone : (ms as Record<string, string[]>).standalone || (ms as Record<string, string[]>).format;
      const month = m.month() as number;
      return list[month] || "";
    }
    return ms as string[];
  }

  private _reorderByDow(arr: string[]): string[] {
    const dow = this._week?.dow ?? 0;
    return arr.slice(dow).concat(arr.slice(0, dow));
  }

  private _resolveWeekdays(wd: string[] | Function | Record<string, unknown>, m: Moment, format?: string): string {
    if (isFunction(wd)) {return wd(m, format) as string;}
    if (Array.isArray(wd)) {return wd[m.day() as number] || "";}
    if (typeof wd === "object" && wd !== null) {
      const isFmt = (wd as Record<string, unknown>).isFormat;
      const useFormat = format && isFmt instanceof RegExp && isFmt.test(format);
      const list = useFormat ? (wd as Record<string, string[]>).format : (wd as Record<string, string[]>).standalone || (wd as Record<string, string[]>).format;
      if (Array.isArray(list)) {return list[m.day() as number] || "";}
      return "";
    }
    return "";
  }

  weekdays(m?: Moment | boolean, format?: string): string[] | string {
    if (m === true) {
      return this._reorderByDow(this._weekdays);
    }
    if (!isMoment(m)) {
      return this._weekdays;
    }
    const wd = this._config.weekdays || enLocale.weekdays;
    if (!wd) {return [];}
    if (isString(wd)) {return wd;}
    return this._resolveWeekdays(wd, m, format);
  }

  weekdaysShort(m?: Moment | boolean, format?: string): string[] | string {
    if (m === true) {
      return this._reorderByDow(this.weekdaysShortArray());
    }
    if (!isMoment(m)) {
      let ws = this._config.weekdaysShort;
      if (!ws) {ws = enLocale.weekdaysShort;}
      if (!ws) {return this._weekdays;}
      if (isFunction(ws)) {return ws(null as unknown as Moment, format);}
      return ws as string[];
    }
    let ws = this._config.weekdaysShort;
    if (!ws) {ws = enLocale.weekdaysShort;}
    if (!ws) {return this.weekdays(m) as string[];}
    if (isFunction(ws)) {return ws(m, format);}
    if (isString(ws)) {return ws;}
    return (ws as string[])[m.day() as number] || (ws as string[]);
  }

  weekdaysMin(m?: Moment | boolean, format?: string): string[] | string {
    if (m === true) {
      return this._reorderByDow(this.weekdaysMinArray());
    }
    if (!isMoment(m)) {
      let wm = this._config.weekdaysMin;
      if (!wm) {wm = enLocale.weekdaysMin;}
      if (!wm) {return this.weekdaysShortArray();}
      if (isFunction(wm)) {return wm(null as unknown as Moment, format);}
      return wm as string[];
    }
    let wm = this._config.weekdaysMin;
    if (!wm) {wm = enLocale.weekdaysMin;}
    if (!wm) {return this.weekdaysShort(m) as string[];}
    if (isFunction(wm)) {return wm(m, format);}
    if (isString(wm)) {return wm;}
    return (wm as string[])[m.day() as number] || (wm as string[]);
  }

  meridiem(hour: number, minute: number, isLower: boolean): string {
    if (this._config.meridiem) {
      return this._config.meridiem(hour, minute, isLower);
    }
    if (enLocale.meridiem) {
      return enLocale.meridiem(hour, minute, isLower);
    }
    const prefix = hour < 12 ? "AM" : "PM";
    return isLower ? prefix.toLowerCase() : prefix;
  }

  isPM(input: string): boolean {
    if (this._config.isPM) {
      return this._config.isPM(input);
    }
    if (enLocale.isPM) {
      return enLocale.isPM(input);
    }
    return (`${input  }`).toLowerCase().charAt(0) === "p";
  }

  get _longDateFormat(): Record<string, string> {
    return (this._config.longDateFormat || enLocale.longDateFormat || {}) as Record<string, string>;
  }

  longDateFormat(key: string): string {
    const ldf = this._config.longDateFormat || enLocale.longDateFormat;
    if (ldf) {
      if ((ldf as Record<string, string>)[key]) {
        return (ldf as Record<string, string>)[key];
      }
      const upperKey = key.toUpperCase().replace(/S$/, "S");
      if (key !== upperKey && key.startsWith("l") && (ldf as Record<string, string>)[upperKey]) {
        let fmt = (ldf as Record<string, string>)[upperKey];
        fmt = fmt.replaceAll('MMMM', "MMM").replaceAll('dddd', "ddd");
        const brackets: string[] = [];
        fmt = fmt.replaceAll(/\[[^\]]*\]/g, (m: string) => { brackets.push(m); return `\x00${brackets.length - 1}\x00`; });
        fmt = fmt.replaceAll(/DD(?!D)/g, "D").replaceAll(/(^|[^M])MM(?!M)([^M]|$)/g, "$1M$2");
        // oxlint-disable-next-line no-control-regex
        fmt = fmt.replaceAll(/\x00\d+\x00/g, () => brackets.shift()!);
        return fmt;
      }
      if ((ldf as Record<string, string>)[upperKey] && key !== upperKey) {
        return (ldf as Record<string, string>)[upperKey];
      }
    }
    return key;
  }

  ordinal(n: number, token?: string): string {
    if (this._config.ordinal) {
      const val = this._config.ordinal;
      if (isFunction(val)) {
        return val(n, token);
      }
      return (val as string).replace("%d", String(n));
    }
    return String(n);
  }

  relativeTime(
    n: number,
    key: string,
    isFuture: boolean | undefined,
    withoutSuffix?: boolean,
  ): string {
    if (this._config.relativeTimeFn) {
      return this._config.relativeTimeFn(n, key, isFuture as boolean);
    }
    const rt = this._config.relativeTime || enLocale.relativeTime;
    if (rt && hasOwn(rt, key) && key !== "future" && key !== "past") {
      const entry = (rt as Record<string, string | Function>)[key];
      const num = n || 1;
      let str: string;
      if (isFunction(entry)) {
        str = entry(num, withoutSuffix || false, key, isFuture || false);
      } else {
        str = (entry as string).replace("%d", String(num));
      }
      if (withoutSuffix) {return str;}
      if (isFuture) {
        const f = rt.future || "in %s";
        return isFunction(f) ? f(str) : (f as string).replace("%s", str);
      }
      const p = rt.past || "%s ago";
      return isFunction(p) ? p(str) : (p as string).replace("%s", str);
    }
    return "";
  }

  calendar(key: string, m: Moment, ref: Moment): string {
    const cal = this._config.calendar;
    if (!cal) {return m.format("L");}
    if (isFunction(cal)) {
      const fmt = (cal as Function).call(this._config, key, m);
      if (isString(fmt)) {return m.format(fmt);}
      return fmt;
    }
    const entry = (cal as Record<string, string | Function>)[key];
    if (entry !== undefined) {
      if (isFunction(entry)) {
        const fmt = entry.call(m, ref);
        if (isString(fmt)) {return fmt;}
        return m.format(fmt);
      }
      if (isString(entry)) {
        return m.format(entry);
      }
    }
    const sameElseEntry = cal["sameElse"];
    if (sameElseEntry !== undefined) {
      if (isFunction(sameElseEntry)) {
        const fmt = sameElseEntry.call(m, ref);
        if (isString(fmt)) {return fmt;}
        return m.format(fmt);
      }
      if (isString(sameElseEntry)) {
        return m.format(sameElseEntry);
      }
    }
    return m.format("L");
  }

  invalidDate(): string {
    return this._config.invalidDate || enLocale.invalidDate || "Invalid date";
  }

  get _week(): { dow: number; doy: number } | undefined {
    return this._config.week;
  }

  firstDayOfWeek(): number {
    const week = this._config.week;
    if (week && week.dow !== undefined) {return week.dow;}
    return 0;
  }

  firstDayOfYear(): number {
    const week = this._config.week;
    if (week && week.doy !== undefined) {return week.doy;}
    return 6;
  }

  meridiemParse(): RegExp | undefined {
    const mp = this._config.meridiemParse;
    if (mp instanceof RegExp) {return mp;}
    if (enLocale.meridiemParse instanceof RegExp) {return enLocale.meridiemParse;}
    return undefined;
  }

  monthsRegex(): RegExp {
    const configMonths = this._config.months;
    if (configMonths) {
      const arr = this._months;
      const shortArr = this._monthsShort;
      const all = [...new Set([...arr, ...shortArr])];
      if (all.length === 0) {return /^/;}
      return new RegExp(`^(${  all.map(escapeRegex).join("|")  })`, "i");
    }
    const arr = this._months;
    if (arr.length === 0) {return /^/;}
    return new RegExp(`^(${  arr.map(escapeRegex).join("|")  })`, "i");
  }

  monthsShortRegex(): RegExp {
    const configShort = this._config.monthsShort;
    if (configShort) {
      const arr = this._months;
      const shortArr = this._monthsShort;
      const all = [...new Set([...shortArr, ...arr])];
      if (all.length === 0) {return /^/;}
      return new RegExp(`^(${  all.map(escapeRegex).join("|")  })`, "i");
    }
    const arr = this._monthsShort;
    if (arr.length === 0) {return /^/;}
    return new RegExp(`^(${  arr.map(escapeRegex).join("|")  })`, "i");
  }

  weekdaysRegex(): RegExp {
    const arr = this._weekdays;
    if (arr.length === 0) {return /^/;}
    return new RegExp(`^(${  arr.map(escapeRegex).join("|")  })`, "i");
  }

  weekdaysShortRegex(): RegExp {
    const arr = this.weekdaysShortArray();
    if (arr.length === 0) {return /^/;}
    return new RegExp(`^(${  arr.map(escapeRegex).join("|")  })`, "i");
  }

  weekdaysMinRegex(): RegExp {
    const arr = this.weekdaysMinArray();
    if (arr.length === 0) {return /^/;}
    return new RegExp(`^(${  arr.map(escapeRegex).join("|")  })`, "i");
  }

  preparse(str: string): string {
    const fn = this._config.preparse;
    if (fn) {return fn(str);}
    return str;
  }

  postformat(str: string): string {
    const fn = this._config.postformat;
    if (fn) {return fn(str);}
    return str;
  }
}

function clearLocaleCache(): void {
  _localeCache.clear();
}

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

function loadLocale(name: string): Locale | null {
  if (locales[name]) {
    return getLocale(name);
  }
  return null;
}

function chooseLocale(names: string[]): Locale {
  for (let i = 0; i < names.length; i++) {
    const split = normalizeLocale(names[i]).split("-");
    let j = split.length;
    const nextName = i + 1 < names.length ? normalizeLocale(names[i + 1]) : null;
    const next = nextName ? nextName.split("-") : null;
    while (j > 0) {
      const locale = loadLocale(split.slice(0, j).join("-"));
      if (locale) {
        return locale;
      }
      if (next && next.length >= j && commonPrefix(split, next) >= j - 1) {
        break;
      }
      j--;
    }
  }
  return getLocale("en");
}

function findBestLocaleName(locale: string): string | null {
  const normalized = normalizeLocale(locale);
  if (locales[normalized]) {return normalized;}
  const parts = normalized.split("-");
  for (let i = parts.length - 1; i >= 1; i--) {
    const parent = parts.slice(0, i).join("-");
    if (locales[parent]) {return parent;}
  }
  return null;
}

export { findBestLocaleName as _findBestLocaleName };

export function getLocale(locale?: string | { _locale?: { _abbr?: string }; _l?: string }): Locale {
  if (locale && locale._locale && locale._locale._abbr) {
    locale = locale._locale._abbr;
  } else if (locale && locale._l) {
    locale = locale._l;
  }
  const key = locale || currentLocaleName;
  const cached = _localeCache.get(key);
  if (cached) {return cached;}
  const config = resolveLocaleConfig(key);
  const loc = new Locale(config, key);
  _localeCache.set(key, loc);
  return loc;
}

export function setLocale(locale: string): void {
  const found = findBestLocaleName(locale);
  currentLocaleName = found || "en";
  _localeCache.delete(currentLocaleName);
}

export function setLocaleFromArray(localesArr: string[]): string {
  const locale = chooseLocale(localesArr);
  const name = locale._abbr;
  setLocale(name);
  return name;
}

export function getCurrentLocale(): string {
  return currentLocaleName;
}

export function defineLocale(locale: string, config: LocaleSpec | null): Locale | undefined {
  if (config === null) {
    delete locales[locale];
    delete originalLocales[locale];
    clearLocaleCache();
    if (currentLocaleName === locale) {
      currentLocaleName = "en";
    }
    return getLocale(locale);
  }

  if (originalLocales[locale]) {
    delete originalLocales[locale];
  }

  const parentLocale = (config as LocaleSpec & { parentLocale?: string }).parentLocale;

  if (locales[locale] && !parentLocale) {
    locales[locale] = mergeConfig(locales[locale], config);
  } else {
    locales[locale] = config;
  }

  _localeCache.delete(locale);

  if (!parentLocale || locales[parentLocale]) {
    if (!parentLocale || locales[parentLocale]) {
      currentLocaleName = locale;
    }
  }
  if (parentLocale && !locales[parentLocale]) {
    return undefined;
  }
  return getLocale(locale);
}

export function updateLocale(locale: string, config: Partial<LocaleSpec> | null): Locale {
  if (config === null) {
    if (originalLocales[locale]) {
      locales[locale] = { ...originalLocales[locale] };
      delete originalLocales[locale];
    } else {
      delete locales[locale];
      if (currentLocaleName === locale) {
        setLocale("en");
      }
    }
    clearLocaleCache();
    return getLocale(locale);
  }

  if (!originalLocales[locale] && locales[locale]) {
    originalLocales[locale] = { ...locales[locale] };
  }

  if (!locales[locale]) {
    locales[locale] = mergeConfig({ ...enLocale }, config as LocaleSpec);
    clearLocaleCache();
    setLocale(locale);
    return getLocale(locale);
  }

  const configParentLocale = (config as Partial<LocaleSpec> & { parentLocale?: string }).parentLocale;
  if (configParentLocale) {
    locales[locale] = { ...(config as Partial<LocaleSpec> & Record<string, unknown>) };
  } else {
    locales[locale] = mergeConfig(locales[locale], config as LocaleSpec);
  }
  clearLocaleCache();
  currentLocaleName = locale;
  return getLocale(locale);
}

export function listLocales(): string[] {
  return Object.keys(locales);
}

export function hasLocale(name: string): boolean {
  return !!locales[name];
}

export function localeHasMissingParent(name: string): boolean {
  const config = locales[name];
  if (!config) {return false;}
  const parentLocale = (config as LocaleSpec & { parentLocale?: string }).parentLocale;
  return !!parentLocale && !locales[parentLocale];
}

export function getMonths(format?: string | number, index?: number): string | string[] {
  const loc = getLocale();
  if (typeof format === "number") {
    const ms = loc._months;
    return ms[format];
  }
  const isShort = format === "short" || (typeof format === "string" && format !== undefined);
  if (isShort) {
    const cfgShort = loc._config.monthsShort || enLocale.monthsShort;
    if (isFunction(cfgShort)) {
      const fmt = typeof format === "string" && format !== "short" ? format : "MMM";
      if (index !== undefined) {
        const r = (cfgShort as Function)({ month: () => index } as { month: () => number }, fmt);
        return r;
      }
      const all: string[] = [];
      for (let i = 0; i < (loc._months || []).length; i++) {
        const r = (cfgShort as Function)({ month: () => i } as { month: () => number }, fmt);
        if (Array.isArray(r)) {return r;}
        all.push(r);
      }
      return all;
    }
    const ms = loc._monthsShort;
    if (index !== undefined) {return ms[index];}
    return ms;
  }
  if (index !== undefined) {
    const ms = loc._months;
    return ms[index];
  }
  return loc._months;
}

function reorderByDow(arr: string[], dow: number): string[] {
  return arr.slice(dow).concat(arr.slice(0, dow));
}

export function getWeekdays(format?: string | number | boolean, index?: number): string | string[] {
  const loc = getLocale();
  const weekCfg = (loc._config as LocaleSpec & Record<string, unknown>).week || { dow: 0 };
  const dow = weekCfg.dow;
  if (typeof format === "number") {
    const ws = loc._weekdays;
    return ws[format];
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
  if (index !== undefined) {
    const ws = loc._weekdays;
    return ws[index];
  }
  return loc._weekdays;
}
