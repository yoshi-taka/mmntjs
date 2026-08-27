import {
  weeksInYear,
  weekDateToYearMonthDay,
  getLocaleWeek,
  getLocaleWeekYear,
  isLeapYear,
  daysInMonthFast,
  roundMomentDays,
} from "./units";
import type { Locale } from "./locale-runtime";
import type { Moment } from "./moment-class";

export type LocaleAwareMoment = Moment & {
  _getLocale: () => Locale;
  _trySetLocale: (locale: string) => boolean;
  _l?: string;
  _p: {
    locale?: Locale;
    isUTC: boolean;
    y: number;
    M: number;
    D: number;
    W: number;
    H: number;
    m: number;
    s: number;
    ms: number;
    t: number;
    d?: Date;
  };
  _getD: () => Date;
  _ensureFields: () => void;
  _refreshFields: () => void;
  _updateOffset: (keepTime?: boolean) => void;
  weekday: (d?: number) => number | Moment;
  year: () => number;
};

function addLocaleDays(m: LocaleAwareMoment, days: number): Moment {
  if (!days) {
    return m;
  }
  const dt = m._getD();
  if (m._p.isUTC) {
    dt.setUTCDate(dt.getUTCDate() + days);
  } else {
    dt.setDate(dt.getDate() + days);
  }
  m._p.t = dt.getTime();
  m._p.d = dt;
  if (isNaN(m._p.t)) {
    m._isValid = false;
  }
  m._refreshFields();
  m._updateOffset(true);
  return m;
}

export function localeWeekday(m: LocaleAwareMoment, d?: number): number | Moment {
  m._ensureFields();
  const weekConfig = ((m._getLocale()._config as Record<string, unknown>).week as
    | { dow: number; doy?: number }
    | undefined) ?? { dow: 0 };
  const dow = weekConfig.dow;
  if (d != null) {
    const current = m._p.W;
    const weekday = (current - dow + 7) % 7;
    const days = roundMomentDays(d - weekday);
    if (!Number.isFinite(days)) {
      if (isNaN(days)) {
        return m;
      }
      m._p.t = NaN;
      m._p.d = new Date(NaN);
      m._isValid = false;
      return m;
    }
    return addLocaleDays(m, days);
  }
  return (m._p.W - dow + 7) % 7;
}

export function localeWeek(m: LocaleAwareMoment, w?: number): number | Moment {
  m._ensureFields();
  const weekConfig = ((m._getLocale()._config as Record<string, unknown>).week as
    | { dow: number; doy: number }
    | undefined) ?? { dow: 0, doy: 6 };
  const { dow, doy } = weekConfig;
  if (w != null) {
    const current = getLocaleWeek(m._p.y, m._p.M, m._p.D, dow, doy);
    const days = roundMomentDays((w - current) * 7);
    if (!Number.isFinite(days)) {
      if (isNaN(days)) {
        return m;
      }
      m._p.t = NaN;
      m._p.d = new Date(NaN);
      m._isValid = false;
      return m;
    }
    return addLocaleDays(m, days);
  }
  return getLocaleWeek(m._p.y, m._p.M, m._p.D, dow, doy);
}

export function localeWeekYear(m: LocaleAwareMoment, y?: number): number | Moment {
  m._ensureFields();
  const weekConfig = ((m._getLocale()._config as Record<string, unknown>).week as
    | { dow: number; doy: number }
    | undefined) ?? { dow: 0, doy: 6 };
  const { dow, doy } = weekConfig;
  if (y != null) {
    if (!m.isValid()) {
      return m;
    }
    y = Number(y);
    if (!Number.isFinite(y)) {
      m._p.t = NaN;
      m._p.d = new Date(NaN);
      m._isValid = false;
      return m;
    }
    y = Math.trunc(y);
    let currentWeek = getLocaleWeek(m._p.y, m._p.M, m._p.D, dow, doy);
    const currentDay = m.weekday();
    const maxWeek = weeksInYear(y, dow, doy);
    if (currentWeek > maxWeek) {
      currentWeek = maxWeek;
    }
    const [targetYear, targetMonth, targetDate] = weekDateToYearMonthDay(
      y,
      currentWeek,
      currentDay,
      dow,
      doy,
    );
    const dt = m._getD();
    if (m._p.isUTC) {
      const month = dt.getUTCMonth();
      const date = dt.getUTCDate();
      dt.setUTCFullYear(
        targetYear,
        month,
        date === 29 && month === 1 && !isLeapYear(targetYear) ? 28 : date,
      );
      if (!isNaN(dt.getTime())) {
        const currentDate = dt.getUTCDate();
        dt.setUTCMonth(
          targetMonth,
          currentDate < 29
            ? currentDate
            : Math.min(currentDate, daysInMonthFast(targetYear, targetMonth)),
        );
        dt.setUTCDate(targetDate);
      }
    } else {
      const month = dt.getMonth();
      const date = dt.getDate();
      dt.setFullYear(
        targetYear,
        month,
        date === 29 && month === 1 && !isLeapYear(targetYear) ? 28 : date,
      );
      if (!isNaN(dt.getTime())) {
        const currentDate = dt.getDate();
        dt.setMonth(
          targetMonth,
          currentDate < 29
            ? currentDate
            : Math.min(currentDate, daysInMonthFast(targetYear, targetMonth)),
        );
        dt.setDate(targetDate);
      }
    }
    m._p.t = dt.getTime();
    m._p.d = dt;
    if (isNaN(m._p.t)) {
      m._isValid = false;
    }
    m._refreshFields();
    return m;
  }
  return getLocaleWeekYear(m._p.y, m._p.M, m._p.D, dow, doy);
}

export function localeWeeksInYear(m: LocaleAwareMoment): number {
  const weekConfig = m._getLocale()._config.week ?? { dow: 0, doy: 6 };
  return weeksInYear(m.year(), weekConfig.dow, weekConfig.doy);
}

export function localeWeeksInWeekYear(m: LocaleAwareMoment): number {
  const weekConfig = m._getLocale()._config.week ?? { dow: 0, doy: 6 };
  m._ensureFields();
  const weekYear = getLocaleWeekYear(m._p.y, m._p.M, m._p.D, weekConfig.dow, weekConfig.doy);
  return weeksInYear(weekYear, weekConfig.dow, weekConfig.doy);
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
