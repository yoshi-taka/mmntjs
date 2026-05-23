// -------------------------------------------------------------------------
// COMPATIBILITY BOUNDARY — extra startOf/endOf unit handlers
// -------------------------------------------------------------------------

import { ISO_WEEK, QUARTER, WEEK, daysInMonth } from "./units";
import type { UnitCode } from "./types";
import type { Locale } from "./locale-runtime";
import type { Moment } from "./moment-class";

export type BoundaryAwareMoment = Moment & {
  _l?: string;
  _p: {
    isUTC: boolean;
    t: number;
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
  _updateOffset: (keepTime?: boolean) => void;
  _getD: () => Date;
  _getLocale: () => Locale;
};

// ---------- UTC/local Date operation helpers ----------

function setUDate(d: Date, utc: boolean, v: number): void {
  if (utc) {
    d.setUTCDate(v);
  } else {
    d.setDate(v);
  }
}
function shiftDateBy(d: Date, utc: boolean, diff: number): void {
  setUDate(d, utc, (utc ? d.getUTCDate() : d.getDate()) + diff);
}
function getUDate(d: Date, utc: boolean): number {
  return utc ? d.getUTCDate() : d.getDate();
}
function getUMonth(d: Date, utc: boolean): number {
  return utc ? d.getUTCMonth() : d.getMonth();
}
function getUYear(d: Date, utc: boolean): number {
  return utc ? d.getUTCFullYear() : d.getFullYear();
}
function getUDay(d: Date, utc: boolean): number {
  return utc ? d.getUTCDay() : d.getDay();
}

function getWeekDow(m: BoundaryAwareMoment): number {
  return m._p.locale === undefined && (m._l === undefined || m._l === "en")
    ? 0
    : (
        ((m._getLocale()._config as Record<string, unknown>).week as
          | { dow: number; doy?: number }
          | undefined) ?? { dow: 0 }
      ).dow;
}

function syncFields(d: Date, m: BoundaryAwareMoment, utc: boolean): void {
  m._p.D = getUDate(d, utc);
  m._p.M = getUMonth(d, utc);
  m._p.y = getUYear(d, utc);
  m._p.H = utc ? d.getUTCHours() : d.getHours();
  m._p.m = utc ? d.getUTCMinutes() : d.getMinutes();
  m._p.s = utc ? d.getUTCSeconds() : d.getSeconds();
  m._p.ms = utc ? d.getUTCMilliseconds() : d.getMilliseconds();
  m._p.W = getUDay(d, utc);
  m._p.t = d.getTime();
}

// ---------- Day of week (Tomohiko Sakamoto, 0-indexed months) ----------

function dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  y -= m < 2 ? 1 : 0;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m] + d) % 7;
}

export function startOfExtraMoment(m: BoundaryAwareMoment, code: UnitCode): void {
  const d = m._getD();
  const utc = m._p.isUTC;
  switch (code) {
    case QUARTER:
      if (utc) {
        d.setUTCMonth(Math.floor(m._p.M / 3) * 3, 1);
        d.setUTCHours(0, 0, 0, 0);
      } else {
        d.setDate(1);
        d.setMonth(Math.floor(m._p.M / 3) * 3);
        d.setHours(0, 0, 0, 0);
      }
      m._p.M = Math.floor(m._p.M / 3) * 3;
      m._p.D = 1;
      m._p.W = dayOfWeek(m._p.y, m._p.M, m._p.D);
      syncFields(d, m, utc);
      break;
    case WEEK:
      shiftDateBy(d, utc, -((getUDay(d, utc) - getWeekDow(m) + 7) % 7));
      if (utc) {
        d.setUTCHours(0, 0, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      syncFields(d, m, utc);
      break;
    case ISO_WEEK: {
      const day = getUDay(d, utc);
      shiftDateBy(d, utc, day === 0 ? -6 : 1 - day);
      if (utc) {
        d.setUTCHours(0, 0, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      syncFields(d, m, utc);
      break;
    }
  }
}

export function endOfExtraMoment(m: BoundaryAwareMoment, code: UnitCode): void {
  const d = m._getD();
  const utc = m._p.isUTC;
  switch (code) {
    case QUARTER: {
      const endMonth = Math.floor(m._p.M / 3) * 3 + 2;
      const endDay = daysInMonth(m._p.y, endMonth);
      if (utc) {
        d.setTime(Date.UTC(m._p.y, endMonth, endDay, 23, 59, 59, 999));
      } else {
        d.setFullYear(m._p.y, endMonth, endDay);
        d.setHours(23, 59, 59, 999);
      }
      m._p.M = endMonth;
      m._p.D = endDay;
      m._p.W = dayOfWeek(m._p.y, endMonth, endDay);
      syncFields(d, m, utc);
      break;
    }
    case WEEK:
      shiftDateBy(d, utc, -((getUDay(d, utc) - getWeekDow(m) + 7) % 7) + 6);
      if (utc) {
        d.setUTCHours(23, 59, 59, 999);
      } else {
        d.setHours(23, 59, 59, 999);
      }
      syncFields(d, m, utc);
      break;
    case ISO_WEEK: {
      const day = getUDay(d, utc);
      shiftDateBy(d, utc, (day === 0 ? -6 : 1 - day) + 6);
      if (utc) {
        d.setUTCHours(23, 59, 59, 999);
      } else {
        d.setHours(23, 59, 59, 999);
      }
      syncFields(d, m, utc);
      break;
    }
  }
}
