import type { Moment } from "./moment-class";
import type { Locale } from "./locale-runtime";
import { enLocale } from "./locale/en";
import { isFunction, isString, isMoment } from "./utils";

export function localeMeridiem(
  loc: Locale,
  hour: number,
  minute: number,
  isLower: boolean,
): string {
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
  if (!months) {
    return [];
  }
  if (isFunction(months)) {
    return months.call(loc._config, m, format);
  }
  if (isString(months)) {
    return months;
  }
  if (Array.isArray(months)) {
    const month = m.month();
    if (months[month]) {
      return months[month];
    }
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
  if (!ms) {
    return localeMonths(loc, m, format);
  }
  if (isFunction(ms)) {
    return ms.call(loc._config, m, format);
  }
  if (isString(ms)) {
    return ms;
  }
  if (Array.isArray(ms)) {
    const month = m.month();
    if (ms[month]) {
      return ms[month];
    }
    return ms;
  }
  const monthsInFormat = /D[oD]?(\[[^[\]]*\]|\s)+MMMM?/;
  const useFormat = format && monthsInFormat.test(format);
  const list: string[] = useFormat ? ms.format : ms.standalone;
  const month = m.month();
  return list[month] || "";
}

export function localeWeekdays(
  loc: Locale,
  m?: Moment | boolean,
  format?: string,
): string[] | string {
  if (m === true) {
    const dow = loc._week?.dow ?? 0;
    return loc._weekdays.slice(dow).concat(loc._weekdays.slice(0, dow));
  }
  if (!isMoment(m)) {
    return loc._weekdays;
  }
  const wd = loc._config.weekdays ?? enLocale.weekdays;
  if (!wd) {
    return [];
  }
  if (isString(wd)) {
    return wd;
  }
  if (isFunction(wd)) {
    return wd(m, format) as string;
  }
  if (Array.isArray(wd)) {
    return wd[m.day()] || "";
  }
  const isFmt = wd.isFormat;
  const useFormat = format && isFmt instanceof RegExp && isFmt.test(format);
  const list = useFormat ? wd.format : wd.standalone;
  if (Array.isArray(list)) {
    return list[m.day()] ?? "";
  }
  return "";
}

export function localeWeekdaysShort(
  loc: Locale,
  m?: Moment | boolean,
  format?: string,
): string[] | string {
  if (m === true) {
    const arr = loc.weekdaysShortArray();
    const dow = loc._week?.dow ?? 0;
    return arr.slice(dow).concat(arr.slice(0, dow));
  }
  if (!isMoment(m)) {
    let ws = loc._config.weekdaysShort;
    ws ??= enLocale.weekdaysShort;
    if (!ws) {
      return loc._weekdays;
    }
    if (isFunction(ws)) {
      return ws(null as unknown as Moment, format);
    }
    return ws as string[] | string;
  }
  let ws = loc._config.weekdaysShort;
  ws ??= enLocale.weekdaysShort;
  if (!ws) {
    return localeWeekdays(loc, m) as string[];
  }
  if (isFunction(ws)) {
    return ws(m, format);
  }
  if (isString(ws)) {
    return ws;
  }
  if (Array.isArray(ws)) {
    return ws[(m as unknown as { day(): number }).day()];
  }
  return (ws as unknown as Record<string, string[]>).standalone;
}

export function localeWeekdaysMin(
  loc: Locale,
  m?: Moment | boolean,
  format?: string,
): string[] | string {
  if (m === true) {
    const arr = loc.weekdaysMinArray();
    const dow = loc._week?.dow ?? 0;
    return arr.slice(dow).concat(arr.slice(0, dow));
  }
  if (!isMoment(m)) {
    let wm = loc._config.weekdaysMin;
    wm ??= enLocale.weekdaysMin;
    if (!wm) {
      return loc.weekdaysShortArray();
    }
    if (isFunction(wm)) {
      return wm(null as unknown as Moment, format);
    }
    return wm as string[] | string;
  }
  let wm = loc._config.weekdaysMin;
  wm ??= enLocale.weekdaysMin;
  if (!wm) {
    return localeWeekdaysShort(loc, m) as string[];
  }
  if (isFunction(wm)) {
    return wm(m, format);
  }
  if (isString(wm)) {
    return wm;
  }
  if (Array.isArray(wm)) {
    return wm[(m as unknown as { day(): number }).day()];
  }
  return (wm as unknown as Record<string, string[]>).standalone;
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
