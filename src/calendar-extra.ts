import type { Moment } from "./moment-class";
import { weeksInYear, getISOWeekNumber, getISOWeekYear, isLeapYear } from "./units";

export type CalendarAwareMoment = Moment & {
  _p: { isUTC: boolean; t: number; y: number; M: number; D: number; W: number };
  _ensureFields: () => void;
  _refreshFields: () => void;
  _updateOffset: (keepTime?: boolean) => void;
  _getD: () => Date;
};

export function isoWeekdayMoment(m: CalendarAwareMoment, d?: unknown): number | Moment {
  m._ensureFields();
  if (d !== undefined) {
    let target = d;
    if (typeof target === "string") {
      const map: Record<string, number> = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 7,
        mon: 1,
        tue: 2,
        wed: 3,
        thu: 4,
        fri: 5,
        sat: 6,
        sun: 7,
      };
      const lower = target.toLowerCase();
      if (!(lower in map)) {
        return m;
      }
      target = map[lower];
    }
    const currentIso = m._p.W === 0 ? 7 : m._p.W;
    const diff = Number(target) - currentIso;
    const dt = m._getD();
    if (m._p.isUTC) {
      dt.setUTCDate(dt.getUTCDate() + diff);
    } else {
      dt.setDate(dt.getDate() + diff);
    }
    m._p.t = dt.getTime();
    m._refreshFields();
    m._updateOffset(true);
    return m;
  }
  return m._p.W === 0 ? 7 : m._p.W;
}

export function dayOfYearMoment(m: CalendarAwareMoment, d?: number): number | Moment {
  if (d !== undefined) {
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
  const nonLeap = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leap = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  return m._p.D + (isLeapYear(m._p.y) ? leap : nonLeap)[m._p.M];
}

export function isoWeekMoment(m: CalendarAwareMoment, w?: number): number | Moment {
  if (w !== undefined) {
    const current = getISOWeekNumber(m._getD(), m._p.isUTC);
    const diff = w - current;
    const dt = m._getD();
    if (m._p.isUTC) {
      dt.setUTCDate(dt.getUTCDate() + diff * 7);
    } else {
      dt.setDate(dt.getDate() + diff * 7);
    }
    m._p.t = dt.getTime();
    m._refreshFields();
    return m;
  }
  return getISOWeekNumber(m._getD(), m._p.isUTC);
}

export function isoWeekYearMoment(m: CalendarAwareMoment, y?: number): number | Moment {
  if (y !== undefined) {
    let currentWeek = getISOWeekNumber(m._getD(), m._p.isUTC);
    const currentDay = isoWeekdayMoment(m) as number;
    const maxWeek = weeksInYear(y, 1, 4, m._p.isUTC);
    if (currentWeek > maxWeek) {
      currentWeek = maxWeek;
    }
    const jan4 = m._p.isUTC ? new Date(Date.UTC(y, 0, 4)) : new Date(y, 0, 4);
    const jan4Day = m._p.isUTC ? jan4.getUTCDay() || 7 : jan4.getDay() || 7;
    const mondayOfWeek1 = m._p.isUTC
      ? new Date(Date.UTC(y, 0, 4 - (jan4Day - 1)))
      : new Date(y, 0, 4 - (jan4Day - 1));
    const origDt = m._getD();
    const origMs = origDt.getTime();
    const targetMs =
      mondayOfWeek1.getTime() + ((currentWeek - 1) * 7 + (currentDay - 1)) * 86400000;
    const timeOfDay = m._p.isUTC
      ? origMs % 86400000
      : origMs - new Date(origMs).setHours(0, 0, 0, 0);
    m._p.t = targetMs + timeOfDay;
    m._p.d = undefined;
    m._refreshFields();
    return m;
  }
  return getISOWeekYear(m._getD(), m._p.isUTC);
}

export function isoWeeksInYearMoment(m: CalendarAwareMoment): number {
  m._ensureFields();
  return weeksInYear(m._p.y, 1, 4, m._p.isUTC);
}

export function isoWeeksInISOWeekYearMoment(m: CalendarAwareMoment): number {
  return weeksInYear(getISOWeekYear(m._getD(), m._p.isUTC), 1, 4, m._p.isUTC);
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
