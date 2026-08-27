import type { Moment } from "./moment-class";
import {
  weeksInYear,
  weekDateToYearMonthDay,
  getISOWeekNumber,
  getISOWeekYear,
  getDayOfYear,
  isLeapYear,
  daysInMonthFast,
  roundMomentDays,
} from "./units";

export type CalendarAwareMoment = Moment & {
  _p: {
    isUTC: boolean;
    t: number;
    d?: Date;
    y: number;
    M: number;
    D: number;
    W: number;
    H: number;
    m: number;
    s: number;
    ms: number;
  };
  _ensureFields: () => void;
  _refreshFields: () => void;
  _updateOffset: (keepTime?: boolean) => void;
  _getD: () => Date;
};

function addCalendarDays(m: CalendarAwareMoment, days: number): Moment {
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

export function isoWeekdayMoment(m: CalendarAwareMoment, d?: unknown): number | Moment {
  m._ensureFields();
  if (d != null) {
    let target = d;
    if (typeof target === "string") {
      const parsed = m.localeData().weekdaysParse(target);
      target = parsed < 0 ? 7 : parsed % 7 || 7;
    }
    const currentIso = m._p.W === 0 ? 7 : m._p.W;
    const days = roundMomentDays(Number(target) - currentIso);
    if (!Number.isFinite(days)) {
      if (isNaN(days)) {
        return m._p.W === 0 ? addCalendarDays(m, -7) : m;
      }
      m._p.t = NaN;
      m._p.d = new Date(NaN);
      m._isValid = false;
      return m;
    }
    return addCalendarDays(m, days);
  }
  return m._p.W === 0 ? 7 : m._p.W;
}

export function dayOfYearMoment(m: CalendarAwareMoment, d?: number): number | Moment {
  if (d != null) {
    m._ensureFields();
    const year = m._p.y;
    const day = Number(d);
    const dt = m._getD();
    if (m._p.isUTC) {
      dt.setUTCFullYear(year, 0, day);
    } else {
      dt.setFullYear(year, 0, day);
    }
    m._p.t = dt.getTime();
    m._refreshFields();
    m._updateOffset(true);
    return m;
  }
  m._ensureFields();
  return getDayOfYear(m._p.y, m._p.M, m._p.D);
}

export function isoWeekMoment(m: CalendarAwareMoment, w?: number): number | Moment {
  m._ensureFields();
  if (w != null) {
    const current = getISOWeekNumber(m._p.y, m._p.M, m._p.D);
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
    return addCalendarDays(m, days);
  }
  return getISOWeekNumber(m._p.y, m._p.M, m._p.D);
}

export function isoWeekYearMoment(m: CalendarAwareMoment, y?: number): number | Moment {
  m._ensureFields();
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
    let currentWeek = getISOWeekNumber(m._p.y, m._p.M, m._p.D);
    const currentDay = isoWeekdayMoment(m) as number;
    const maxWeek = weeksInYear(y, 1, 4);
    if (currentWeek > maxWeek) {
      currentWeek = maxWeek;
    }
    const [targetYear, targetMonth, targetDate] = weekDateToYearMonthDay(
      y,
      currentWeek,
      currentDay - 1,
      1,
      4,
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
        dt.setUTCMonth(
          targetMonth,
          date < 29 ? date : Math.min(dt.getUTCDate(), daysInMonthFast(targetYear, targetMonth)),
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
        dt.setMonth(
          targetMonth,
          date < 29 ? date : Math.min(dt.getDate(), daysInMonthFast(targetYear, targetMonth)),
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
  return getISOWeekYear(m._p.y, m._p.M, m._p.D);
}

export function isoWeeksInYearMoment(m: CalendarAwareMoment): number {
  m._ensureFields();
  return weeksInYear(m._p.y, 1, 4);
}

export function isoWeeksInISOWeekYearMoment(m: CalendarAwareMoment): number {
  m._ensureFields();
  return weeksInYear(getISOWeekYear(m._p.y, m._p.M, m._p.D), 1, 4);
}

export function calendarCompareMoment(
  left: CalendarAwareMoment,
  right: CalendarAwareMoment,
  unit: string,
): number {
  switch (unit) {
    case "quarter": {
      const d = left.year() - right.year();
      if (d !== 0) {
        return d;
      }
      return left.quarter() - right.quarter();
    }
    case "week": {
      const d = left.weekYear() - right.weekYear();
      if (d !== 0) {
        return d;
      }
      return left.week() - right.week();
    }
    case "isoWeek": {
      const d = left.isoWeekYear() - right.isoWeekYear();
      if (d !== 0) {
        return d;
      }
      return left.isoWeek() - right.isoWeek();
    }
    default:
      return NaN;
  }
}
