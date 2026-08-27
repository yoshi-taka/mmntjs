import type { Moment } from "./moment-class";
import { isFunction, lowerVariant } from "./utils";
import type { LocaleSpec } from "./locale/en";
import { enLocale } from "./locale/en";

type RenderFn = (m: Moment) => string;

let _buildRenderFns: ((fmt: string) => RenderFn[]) | null = null;

export function setBuildRenderFns(fn: (fmt: string) => RenderFn[]): void {
  _buildRenderFns = fn;
}

let currentLocaleName = "en";
export const localeConfigs: Record<string, LocaleSpec | undefined> = {
  en: enLocale,
};
/** @public */
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
        result[key] = {
          ...((base as Record<string, unknown>)[key] as Record<string, unknown>),
          ...(val as Record<string, unknown>),
        };
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
    if (locale === "en") {
      return { ...(localeConfigs.en ?? enLocale) };
    }
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
      if (
        !key.startsWith("_") &&
        !((this._config as Record<string, unknown>)[`_${key}`] !== undefined)
      ) {
        (this._config as Record<string, unknown>)[`_${key}`] = (config as Record<string, unknown>)[
          key
        ];
      }
    }
    this._abbr = abbr ?? currentLocaleName;
  }

  get _months(): string[] {
    const months = this._config.months ?? enLocale.months;
    if (!months) {
      return [];
    }
    if (isFunction(months)) {
      try {
        const result = (months as Function).call(this._config);
        if (Array.isArray(result)) {
          return result;
        }
      } catch {}
      return [];
    }
    if (Array.isArray(months)) {
      return months;
    }
    return months.standalone;
  }

  get _monthsShort(): string[] {
    const ms = this._config.monthsShort ?? enLocale.monthsShort;
    if (!ms) {
      return this._months;
    }
    if (isFunction(ms)) {
      const result: string[] = [];
      for (let i = 0; i < this._months.length; i++) {
        const r = (ms as Function).call(
          this._config,
          { month: () => i } as { month: () => number },
          "MMM",
        );
        result.push(r);
      }
      return result;
    }
    if (Array.isArray(ms)) {
      return ms;
    }
    return ms.standalone;
  }

  get _weekdays(): string[] {
    const wd = this._config.weekdays ?? enLocale.weekdays;
    if (!wd) {
      return [];
    }
    if (isFunction(wd)) {
      const result: string[] = [];
      for (let i = 0; i < 7; i++) {
        const r = (wd as Function)({ day: () => i }, "dddd");
        result.push(r);
      }
      return result;
    }
    if (Array.isArray(wd)) {
      return wd;
    }
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
    if (!ws) {
      return this._weekdays;
    }
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
    if (!wm) {
      return this.weekdaysShortArray();
    }
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

  firstDayOfWeek(): number {
    return this._config.week?.dow ?? 0;
  }

  firstDayOfYear(): number {
    return this._config.week?.doy ?? 6;
  }

  meridiemParse(): RegExp | undefined {
    const mp = this._config.meridiemParse;
    if (mp instanceof RegExp) {
      return mp;
    }
    if (enLocale.meridiemParse instanceof RegExp) {
      return enLocale.meridiemParse;
    }
    return undefined;
  }

  months(m?: Moment, format?: string): string[] | string {
    return localeMonths(this, m, format);
  }
  monthsShort(m?: Moment, format?: string): string[] | string {
    return localeMonthsShort(this, m, format);
  }
  weekdays(m?: Moment | boolean, format?: string): string[] | string {
    return localeWeekdays(this, m, format);
  }
  weekdaysShort(m?: Moment | boolean, format?: string): string[] | string {
    return localeWeekdaysShort(this, m, format);
  }
  weekdaysMin(m?: Moment | boolean, format?: string): string[] | string {
    return localeWeekdaysMin(this, m, format);
  }
  invalidDate(): string {
    return localeInvalidDate(this);
  }
  // compatibility boundary: accepts any relative time key from locale config
  relativeTime(n: number, key: string, isFuture: boolean, withSuffix: boolean): string {
    return localeRelativeTime(this, n, key, isFuture, withSuffix);
  }
  postformat(str: string): string {
    return localePostformat(this, str);
  }

  // ---------- parsing helpers (months/weekdays) ----------

  private _configCache(): Record<string, unknown> {
    return this._config as unknown as Record<string, unknown>;
  }

  private _buildMonthsRegex(strict: boolean, short: boolean): RegExp {
    const cacheKey = `_${short ? "monthsShort" : "months"}${strict ? "Strict" : ""}Regex`;
    const cfg = this._configCache();
    const cached = cfg[cacheKey] as RegExp | undefined;
    if (cached) {
      return cached;
    }

    if (short) {
      const names = this._monthsShort;
      const escaped = names.map((n: string) => n.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
      const prefix = strict ? "^(?:" : "(?:";
      const suffix = strict ? ")$" : ")";
      const pattern = prefix + escaped.join("|") + suffix;
      const regex = new RegExp(pattern, "i");
      cfg[cacheKey] = regex;
      return regex;
    }

    const fullNames = this._months;
    const escapedFull = fullNames.map((n: string) => n.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
    if (strict) {
      const pattern = `^(${escapedFull.join("|")})$`;
      const regex = new RegExp(pattern, "i");
      cfg[cacheKey] = regex;
      return regex;
    }
    const shortNames = this._monthsShort;
    const shortLower = shortNames.map((n: string) => n.replaceAll(/\.$/g, "").toLowerCase());
    const escapedShort = shortLower.map((n: string) =>
      n.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"),
    );
    const all = [...new Set([...escapedFull, ...escapedShort])];
    const sorted = [...all].sort((a, b) => b.length - a.length);
    const pattern = `^(${sorted.join("|")})`;
    const regex = new RegExp(pattern, "i");
    cfg[cacheKey] = regex;
    return regex;
  }

  private _buildWeekdaysRegex(strict: boolean, kind: "format" | "short" | "min"): RegExp {
    const keyMap = { format: "weekdays", short: "weekdaysShort", min: "weekdaysMin" };
    const cacheKey = `_${keyMap[kind]}${strict ? "Strict" : ""}Regex`;
    const cfg = this._configCache();
    const cached = cfg[cacheKey] as RegExp | undefined;
    if (cached) {
      return cached;
    }

    let primaryNames: string[];
    if (kind === "format") {
      primaryNames = this._weekdays;
    } else if (kind === "short") {
      primaryNames = this.weekdaysShortArray();
    } else {
      primaryNames = this.weekdaysMinArray();
    }

    const escaped = primaryNames.map((n: string) => n.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
    if (strict) {
      const pattern = `^(${escaped.join("|")})$`;
      const regex = new RegExp(pattern, "i");
      cfg[cacheKey] = regex;
      return regex;
    }
    const allNames: string[] = [];
    const collectEscaped = (arr: string[]) => {
      for (const n of arr) {
        allNames.push(n.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
      }
    };
    collectEscaped(this._weekdays);
    collectEscaped(this.weekdaysShortArray());
    collectEscaped(this.weekdaysMinArray());
    const unique = [...new Set(allNames)];
    const sorted = [...unique].sort((a, b) => b.length - a.length);
    const pattern = `^(${sorted.join("|")})`;
    const regex = new RegExp(pattern, "i");
    cfg[cacheKey] = regex;
    return regex;
  }

  monthsParse(monthName: string, format?: string, strict?: boolean): number {
    if (typeof monthName !== "string") {
      return -1;
    }
    const short = format === "MMM" || format === "MM";
    const names = short ? this._monthsShort : this._months;
    const idx = names.findIndex((n: string) => n.toLowerCase() === monthName.toLowerCase());
    if (idx >= 0) {
      return idx;
    }
    const lower = monthName.toLowerCase();
    for (let i = 0; i < names.length; i++) {
      if (names[i].toLowerCase().startsWith(lower)) {
        return i;
      }
    }
    return -1;
  }

  monthsRegex(strict: boolean): RegExp {
    return this._buildMonthsRegex(strict, false);
  }

  monthsShortRegex(strict: boolean): RegExp {
    const cacheKey = `_monthsShort${strict ? "Strict" : ""}Regex`;
    const cfg = this._configCache();
    const cached = cfg[cacheKey] as RegExp | undefined;
    if (cached) {
      return cached;
    }

    const shortNames = this._monthsShort;
    const escaped = shortNames.map((n: string) => n.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
    if (strict) {
      const pattern = `^(${escaped.join("|")})$`;
      const regex = new RegExp(pattern, "i");
      cfg[cacheKey] = regex;
      return regex;
    }
    const fullNames = this._months;
    const fullEscaped = fullNames.map((n: string) => n.replaceAll(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const all = [...new Set([...escaped, ...fullEscaped])];
    const sorted = [...all].sort((a, b) => b.length - a.length);
    const pattern = `^(${sorted.join("|")})`;
    const regex = new RegExp(pattern, "i");
    cfg[cacheKey] = regex;
    return regex;
  }

  weekdaysParse(weekdayName: string, format?: string, strict?: boolean): number {
    if (typeof weekdayName !== "string") {
      return -1;
    }
    const lower = weekdayName.toLowerCase();
    const full = this._weekdays;
    const short = this.weekdaysShortArray();
    const min = this.weekdaysMinArray();
    if (this._config.weekdaysParseExact) {
      const groups = strict
        ? [format === "dddd" ? full : format === "ddd" ? short : min]
        : format === "dddd"
          ? [full, short, min]
          : format === "ddd"
            ? [short, full, min]
            : [min, full, short];
      for (const names of groups) {
        const index = names.findIndex((name: string) => name.toLowerCase() === lower);
        if (index >= 0) {
          return index;
        }
      }
      return -1;
    }

    const configured = strict
      ? format === "dddd"
        ? this._config.fullWeekdaysParse
        : format === "ddd"
          ? this._config.shortWeekdaysParse
          : this._config.minWeekdaysParse
      : this._config.weekdaysParse;
    for (let i = 0; i < 7; i++) {
      if (Array.isArray(configured) && configured[i] instanceof RegExp) {
        configured[i].lastIndex = 0;
        if (configured[i].test(weekdayName)) {
          return i;
        }
      } else if (strict) {
        const name = (format === "dd" ? min : format === "ddd" ? short : full)[i];
        if (new RegExp(`^${name.replace(".", "\\.?")}$`, "i").test(weekdayName)) {
          return i;
        }
      } else if (
        new RegExp(`^${full[i]}|^${short[i]}|^${min[i]}`.replace(".", ""), "i").test(weekdayName)
      ) {
        return i;
      }
    }
    return -1;
  }

  weekdaysRegex(strict: boolean): RegExp {
    return this._buildWeekdaysRegex(strict, "format");
  }

  weekdaysShortRegex(strict: boolean): RegExp {
    return this._buildWeekdaysRegex(strict, "short");
  }

  weekdaysMinRegex(strict: boolean): RegExp {
    return this._buildWeekdaysRegex(strict, "min");
  }

  // ---------- calendar / display ----------

  calendar(key?: string, m?: Moment, now?: Moment): string {
    const cal = this._config.calendar as Record<string, unknown> | undefined;
    if (!cal) {
      const defaults: Record<string, string> = {
        sameDay: "[Today at] LT",
        nextDay: "[Tomorrow at] LT",
        nextWeek: "dddd [at] LT",
        lastDay: "[Yesterday at] LT",
        lastWeek: "[Last] dddd [at] LT",
        sameElse: "L",
      };
      return defaults[key ?? "sameElse"] ?? defaults.sameElse;
    }
    const val = cal[key ?? "sameElse"];
    if (typeof val === "function") {
      return val(m, now);
    }
    // oxlint-disable-next-line typescript/no-base-to-string
    return String(val ?? "");
  }

  // ---------- relative time ----------

  pastFuture(diff: number, relTime: string): string {
    const rt = this._config.relativeTime as Record<string, unknown> | undefined;
    if (diff > 0) {
      const f = rt?.future ?? "in %s";
      if (typeof f === "function") {
        return f(relTime);
      }
      // oxlint-disable-next-line typescript/no-base-to-string
      return String(f).replace("%s", relTime);
    }
    const p = rt?.past ?? "%s ago";
    if (typeof p === "function") {
      return p(relTime);
    }
    // oxlint-disable-next-line typescript/no-base-to-string
    return String(p).replace("%s", relTime);
  }

  // ---------- locale config merge ----------

  set(config: Record<string, unknown>): void {
    for (const key of Object.keys(config)) {
      const val = config[key];
      if (val !== undefined) {
        (this._config as Record<string, unknown>)[key] = val;
        // Also update underscore-prefixed cache if applicable
        if (!key.startsWith("_")) {
          (this._config as Record<string, unknown>)[`_${key}`] = val;
        }
      }
    }
  }

  // ---------- eras ----------

  eras(): Record<string, unknown>[] {
    const e = this._config.eras;
    return Array.isArray(e) ? (e as Record<string, unknown>[]) : [];
  }

  // ---------- locale week ----------

  week(m: Moment): number {
    // locale-aware week of year — delegates to moment's week()
    return m.week();
  }
}

export {
  localeMeridiem,
  localeMonths,
  localeMonthsShort,
  localeOrdinal,
  localeWeekdays,
  localeWeekdaysMin,
  localeWeekdaysShort,
} from "./locale-format";
import {
  localeMonths,
  localeMonthsShort,
  localeWeekdays,
  localeWeekdaysMin,
  localeWeekdaysShort,
} from "./locale-format";

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
  // compatibility boundary: accepts arbitrary key strings at public API but
  // internal calls use LocaleLongDateFormatKey
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

export function localeRelativeTime(
  loc: Locale,
  n: number,
  key: string,
  isFuture: boolean | undefined,
  withoutSuffix?: boolean,
): string {
  // compatibility boundary: accepts any relative time key from locale config
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
    if (withoutSuffix) {
      return str;
    }
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

// Idempotence: localePreparse(loc, localePreparse(loc, s)) ≡ localePreparse(loc, s)
//   For locales defining both preparse and postformat,
//   localePreparse(loc, localePostformat(loc, s)) should approach identity (roundtrip law).
export function localePreparse(loc: Locale, str: string): string {
  const fn = loc._config.preparse;
  if (fn) {
    return fn(str);
  }
  return str;
}

// Idempotence: localePostformat(loc, localePostformat(loc, s)) ≡ localePostformat(loc, s)
//   Inverse of localePreparse when both are defined.
export function localePostformat(loc: Locale, str: string): string {
  const fn = loc._config.postformat;
  if (fn) {
    return fn(str);
  }
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
  // compatibility boundary: accepts Moment-like duck objects at public API
  if (typeof locale === "object" && locale._locale?._abbr) {
    locale = locale._locale._abbr;
  } else if (typeof locale === "object" && locale._l) {
    locale = locale._l;
  }
  const key = (locale as string | undefined) ?? currentLocaleName;
  const cached = _localeCache.get(key);
  if (cached) {
    return cached;
  }
  const config = resolveLocaleConfig(key);
  const loc = new Locale(config, key);
  precompileLocaleFormats(loc);
  _localeCache.set(key, loc);
  return loc;
}

function precompileLocaleFormats(loc: Locale): void {
  const ldf = (loc._config as Record<string, unknown>).longDateFormat as
    | Record<string, string>
    | undefined;
  if (!ldf || !_buildRenderFns) {
    return;
  }
  const cache: Record<string, RenderFn[]> = {};
  for (const key of Object.keys(ldf)) {
    cache[key] = _buildRenderFns(ldf[key]);
  }
  for (const upper of ["L", "LL", "LLL", "LLLL"]) {
    const lower = upper.toLowerCase();
    cache[lower] ??= _buildRenderFns(lowerVariant(ldf[upper]));
  }
  cache.lt = _buildRenderFns(lowerVariant(ldf.LT));
  cache.lts = _buildRenderFns(lowerVariant(ldf.LTS));
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
  if (!config) {
    return false;
  }
  const parentLocale = (config as LocaleSpec & { parentLocale?: string }).parentLocale;
  return !!parentLocale && !localeConfigs[parentLocale];
}
