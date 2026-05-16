import type { Moment } from "./moment-class";
import { isLeapYear } from "./units";

type CalendarAwareMoment = Moment & {
  _isUTC: boolean;
  _t: number;
  _ensureFields: () => void;
  _refreshFields: () => void;
  _updateOffset: (keepTime?: boolean) => void;
  _getD: () => Date;
  $y: number;
  $M: number;
  $D: number;
  $W: number;
};

function dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let year = y;
  year -= m < 2 ? 1 : 0;
  return (
    (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) + t[m] + d) % 7
  );
}

function firstWeekOffset(year: number, dow: number, doy: number, _utc: boolean): number {
  const fwd = 7 + dow - doy;
  const janFwd = new Date(Date.UTC(year, 0, fwd));
  const janFwdDay = janFwd.getUTCDay();
  const fwdlw = (7 + janFwdDay - dow) % 7;
  return -fwdlw + fwd - 1;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
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
  return day + (isLeapYear(year) ? leap : nonLeap)[month];
}

function getISOWeekNumber(d: Date, utc: boolean): number {
  const getYear = utc ? (x: Date) => x.getUTCFullYear() : (x: Date) => x.getFullYear();
  const year = getYear(d);
  const weekOffset = firstWeekOffset(year, 1, 4, utc);
  const dayOfYear = getDayOfYear(d, utc);
  let week = Math.floor((dayOfYear - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    week += weeksInYear(year - 1, 1, 4, utc);
  } else {
    const yearWeeks = weeksInYear(year, 1, 4, utc);
    if (week > yearWeeks) {
      return 1;
    }
  }
  return week;
}

function getISOWeekYear(d: Date, utc: boolean): number {
  const getDow = utc ? (x: Date) => x.getUTCDay() : (x: Date) => x.getDay();
  const getDate = utc ? (x: Date) => x.getUTCDate() : (x: Date) => x.getDate();
  const getFullYear = utc ? (x: Date) => x.getUTCFullYear() : (x: Date) => x.getFullYear();
  const setDate = utc
    ? (x: Date, v: number) => x.setUTCDate(v)
    : (x: Date, v: number) => x.setDate(v);
  const clone = new Date(d.getTime());
  const isoDow = getDow(clone) || 7;
  setDate(clone, getDate(clone) + 4 - isoDow);
  return getFullYear(clone);
}

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
    const currentIso = m.$W === 0 ? 7 : m.$W;
    const diff = Number(target) - currentIso;
    const dt = m._getD();
    if (m._isUTC) {
      dt.setUTCDate(dt.getUTCDate() + diff);
    } else {
      dt.setDate(dt.getDate() + diff);
    }
    m.$D = m._isUTC ? dt.getUTCDate() : dt.getDate();
    m.$M = m._isUTC ? dt.getUTCMonth() : dt.getMonth();
    m.$y = m._isUTC ? dt.getUTCFullYear() : dt.getFullYear();
    m.$W = dayOfWeek(m.$y, m.$M, m.$D);
    m._t = dt.getTime();
    m._updateOffset(true);
    return m;
  }
  return m.$W === 0 ? 7 : m.$W;
}

export function dayOfYearMoment(m: CalendarAwareMoment, d?: number): number | Moment {
  if (d !== undefined) {
    const year = m.$y;
    const day = Number(d);
    const dt = m._getD();
    if (m._isUTC) {
      dt.setUTCFullYear(year, 0, day);
    } else {
      dt.setFullYear(year, 0, day);
    }
    m.$D = m._isUTC ? dt.getUTCDate() : dt.getDate();
    m.$M = m._isUTC ? dt.getUTCMonth() : dt.getMonth();
    m.$W = dayOfWeek(m.$y, m.$M, m.$D);
    m._t = dt.getTime();
    m._updateOffset(true);
    return m;
  }
  m._ensureFields();
  const nonLeap = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leap = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  return m.$D + (isLeapYear(m.$y) ? leap : nonLeap)[m.$M];
}

export function isoWeekMoment(m: CalendarAwareMoment, w?: number): number | Moment {
  if (w !== undefined) {
    const current = getISOWeekNumber(m._getD(), m._isUTC);
    const diff = w - current;
    const dt = m._getD();
    if (m._isUTC) {
      dt.setUTCDate(dt.getUTCDate() + diff * 7);
    } else {
      dt.setDate(dt.getDate() + diff * 7);
    }
    m._t = dt.getTime();
    m._refreshFields();
    return m;
  }
  return getISOWeekNumber(m._getD(), m._isUTC);
}

export function isoWeekYearMoment(m: CalendarAwareMoment, y?: number): number | Moment {
  if (y !== undefined) {
    let currentWeek = getISOWeekNumber(m._getD(), m._isUTC);
    const currentDay = isoWeekdayMoment(m) as number;
    const maxWeek = weeksInYear(y, 1, 4, m._isUTC);
    if (currentWeek > maxWeek) {
      currentWeek = maxWeek;
    }
    const jan4 = m._isUTC ? new Date(Date.UTC(y, 0, 4)) : new Date(y, 0, 4);
    const jan4Day = m._isUTC ? jan4.getUTCDay() || 7 : jan4.getDay() || 7;
    const mondayOfWeek1 = m._isUTC
      ? new Date(Date.UTC(y, 0, 4 - (jan4Day - 1)))
      : new Date(y, 0, 4 - (jan4Day - 1));
    const target = new Date(
      mondayOfWeek1.getTime() + ((currentWeek - 1) * 7 + (currentDay - 1)) * 86400000,
    );
    m._t = target.getTime();
    m._d = target;
    m._refreshFields();
    return m;
  }
  return getISOWeekYear(m._getD(), m._isUTC);
}

export function isoWeeksInYearMoment(m: CalendarAwareMoment): number {
  m._ensureFields();
  return weeksInYear(m.$y, 1, 4, m._isUTC);
}

export function isoWeeksInISOWeekYearMoment(m: CalendarAwareMoment): number {
  return weeksInYear(getISOWeekYear(m._getD(), m._isUTC), 1, 4, m._isUTC);
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
