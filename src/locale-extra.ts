import type { Locale } from "./locale-runtime";
import type { Moment } from "./moment-class";

export type LocaleAwareMoment = Moment & {
  _getLocale: () => Locale;
  _trySetLocale: (locale: string) => boolean;
  _l?: string;
  _p: { locale?: Locale; isUTC: boolean; W: number; t: number };
  _getD: () => Date;
  _ensureFields: () => void;
  _refreshFields: () => void;
  weekday: (d?: number) => number | Moment;
  year: () => number;
};

function firstWeekOffset(year: number, dow: number, doy: number, utc: boolean): number {
  const fwd = 7 + dow - doy;
  const janFwd = utc ? new Date(Date.UTC(year, 0, fwd)) : new Date(year, 0, fwd);
  const janFwdDay = utc ? janFwd.getUTCDay() : janFwd.getDay();
  const fwdlw = (7 + janFwdDay - dow) % 7;
  return -fwdlw + fwd - 1;
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

function weeksInYear(year: number, dow: number, doy: number, utc: boolean): number {
  const weekOffset = firstWeekOffset(year, dow, doy, utc);
  const weekOffsetNext = firstWeekOffset(year + 1, dow, doy, utc);
  return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
}

function getDayOfYear(d: Date, utc: boolean): number {
  const month = utc ? d.getUTCMonth() : d.getMonth();
  const day = utc ? d.getUTCDate() : d.getDate();
  const year = utc ? d.getUTCFullYear() : d.getFullYear();
  const nonLeap = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leap = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  return day + ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? leap : nonLeap)[month];
}

function getLocaleWeek(d: Date, utc: boolean, dow: number, doy: number): number {
  const year = utc ? d.getUTCFullYear() : d.getFullYear();
  const weekOffset = firstWeekOffset(year, dow, doy, utc);
  const dayOfYear = getDayOfYear(d, utc);
  let week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    week += weeksInYear(year - 1, dow, doy, utc);
  } else {
    const yearWeeks = weeksInYear(year, dow, doy, utc);
    if (week > yearWeeks) {
      week = 1;
    }
  }
  return week;
}

function getLocaleWeekYear(d: Date, utc: boolean, dow: number, doy: number): number {
  const year = utc ? d.getUTCFullYear() : d.getFullYear();
  const weekOffset = firstWeekOffset(year, dow, doy, utc);
  const dayOfYear = getDayOfYear(d, utc);
  const week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    return year - 1;
  }
  if (week > weeksInYear(year, dow, doy, utc)) {
    return year + 1;
  }
  return year;
}

export function localeWeekday(m: LocaleAwareMoment, d?: number): number | Moment {
  m._ensureFields();
  const weekConfig = ((m._getLocale()._config as Record<string, unknown>).week as
    | { dow: number; doy?: number }
    | undefined) ?? { dow: 0 };
  const dow = weekConfig.dow;
  if (d !== undefined) {
    const current = m._p.W;
    const weekday = (current - dow + 7) % 7;
    const diff = d - weekday;
    const dt = m._getD();
    if (m._p.isUTC) {
      dt.setUTCDate(dt.getUTCDate() + diff);
    } else {
      dt.setDate(dt.getDate() + diff);
    }
    m._p.d = dt;
    m._p.t = dt.getTime();
    m._refreshFields();
    return m;
  }
  return (m._p.W - dow + 7) % 7;
}

export function localeWeek(m: LocaleAwareMoment, w?: number): number | Moment {
  const weekConfig = ((m._getLocale()._config as Record<string, unknown>).week as
    | { dow: number; doy: number }
    | undefined) ?? { dow: 0, doy: 6 };
  const { dow, doy } = weekConfig;
  if (w !== undefined) {
    const current = getLocaleWeek(m._getD(), m._p.isUTC, dow, doy);
    const diff = w - current;
    const d = m._getD();
    if (m._p.isUTC) {
      d.setUTCDate(d.getUTCDate() + diff * 7);
    } else {
      d.setDate(d.getDate() + diff * 7);
    }
    m._p.d = d;
    m._p.t = d.getTime();
    m._refreshFields();
    return m;
  }
  return getLocaleWeek(m._getD(), m._p.isUTC, dow, doy);
}

export function localeWeekYear(m: LocaleAwareMoment, y?: number): number | Moment {
  const weekConfig = ((m._getLocale()._config as Record<string, unknown>).week as
    | { dow: number; doy: number }
    | undefined) ?? { dow: 0, doy: 6 };
  const { dow, doy } = weekConfig;
  if (y !== undefined) {
    let currentWeek = getLocaleWeek(m._getD(), m._p.isUTC, dow, doy);
    const currentDay = m.weekday();
    const maxWeek = weeksInYear(y, dow, doy, m._p.isUTC);
    if (currentWeek > maxWeek) {
      currentWeek = maxWeek;
    }
    const jan1 = m._p.isUTC ? new Date(Date.UTC(y, 0, 1)) : new Date(y, 0, 1);
    const fwd = 7 + dow - doy;
    const fwdDate = m._p.isUTC ? new Date(Date.UTC(y, 0, fwd)) : new Date(y, 0, fwd);
    const fwdDay = m._p.isUTC ? fwdDate.getUTCDay() : fwdDate.getDay();
    const fwdlw = (7 + fwdDay - dow) % 7;
    const offset = -fwdlw + fwd - 1;
    const week1Start = new Date(jan1.getTime() + offset * 86400000);
    const origDt = m._getD();
    const origMs = origDt.getTime();
    const timeOfDay = m._p.isUTC
      ? origMs % 86400000
      : origMs - new Date(origMs).setHours(0, 0, 0, 0);
    const targetMs = week1Start.getTime() + ((currentWeek - 1) * 7 + currentDay) * 86400000;
    m._p.t = targetMs + timeOfDay;
    m._p.d = undefined;
    m._refreshFields();
    return m;
  }
  return getLocaleWeekYear(m._getD(), m._p.isUTC, dow, doy);
}

export function localeWeeksInYear(m: LocaleAwareMoment): number {
  const weekConfig = m._getLocale()._config.week ?? { dow: 0, doy: 6 };
  return weeksInYear(m.year(), weekConfig.dow, weekConfig.doy, m._p.isUTC);
}

export function localeWeeksInWeekYear(m: LocaleAwareMoment): number {
  const weekConfig = m._getLocale()._config.week ?? { dow: 0, doy: 6 };
  const weekYear = getLocaleWeekYear(m._getD(), m._p.isUTC, weekConfig.dow, weekConfig.doy);
  return weeksInYear(weekYear, weekConfig.dow, weekConfig.doy, m._p.isUTC);
}

export function localeData(m: LocaleAwareMoment): Locale {
  return m._getLocale();
}

export function lang(
  m: LocaleAwareMoment,
  locale: string | string[] | false | undefined,
  getCurrentLocale: () => string,
): string | Moment {
  if (locale === undefined) {
    return m._l ?? getCurrentLocale();
  }
  if (locale === false) {
    m._l = undefined;
    m._p.locale = undefined;
    return m;
  }
  if (Array.isArray(locale)) {
    for (const l of locale) {
      if (m._trySetLocale(l)) {
        return m;
      }
    }
    return m;
  }
  m._trySetLocale(locale);
  return m;
}

export function localeMethod(
  m: LocaleAwareMoment,
  locale: string | string[] | false | undefined,
  getCurrentLocale: () => string,
): string | Moment {
  if (locale === undefined) {
    return m._l ?? getCurrentLocale();
  }
  if (locale === false) {
    m._l = undefined;
    m._p.locale = undefined;
    return m;
  }
  if (Array.isArray(locale)) {
    for (const l of locale) {
      if (m._trySetLocale(l)) {
        return m;
      }
    }
    return m;
  }
  m._trySetLocale(locale);
  return m;
}
