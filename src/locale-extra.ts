import { weeksInYear, getLocaleWeek, getLocaleWeekYear } from "./units";
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
