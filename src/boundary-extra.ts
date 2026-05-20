// -------------------------------------------------------------------------
// COMPATIBILITY BOUNDARY — extra startOf/endOf unit handlers
// These are only reachable via callback from moment-class.ts for units
// (isoWeek, quarter) that the core Moment class cannot handle inline.
// UnitCode is used internally; no runtime overhead.
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

function dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let year = y;
  year -= m < 2 ? 1 : 0;
  return (
    (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) + t[m] + d) % 7
  );
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
      m._p.H = 0;
      m._p.m = 0;
      m._p.s = 0;
      m._p.ms = 0;
      m._p.W = dayOfWeek(m._p.y, m._p.M, m._p.D);
      m._p.t = d.getTime();
      break;
    case WEEK: {
      const dow =
        m._p.locale === undefined && (m._l === undefined || m._l === "en")
          ? 0
          : (
              ((m._getLocale()._config as Record<string, unknown>).week as
                | { dow: number; doy?: number }
                | undefined) ?? { dow: 0 }
            ).dow;
      const day = utc ? d.getUTCDay() : d.getDay();
      const diff = (day - dow + 7) % 7;
      if (utc) {
        d.setUTCDate(d.getUTCDate() - diff);
        d.setUTCHours(0, 0, 0, 0);
      } else {
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
      }
      m._p.D = utc ? d.getUTCDate() : d.getDate();
      m._p.M = utc ? d.getUTCMonth() : d.getMonth();
      m._p.y = utc ? d.getUTCFullYear() : d.getFullYear();
      m._p.H = 0;
      m._p.m = 0;
      m._p.s = 0;
      m._p.ms = 0;
      m._p.W = utc ? d.getUTCDay() : d.getDay();
      m._p.t = d.getTime();
      break;
    }
    case ISO_WEEK: {
      const day = utc ? d.getUTCDay() : d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      if (utc) {
        d.setUTCDate(d.getUTCDate() + diff);
        d.setUTCHours(0, 0, 0, 0);
      } else {
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
      }
      m._p.D = utc ? d.getUTCDate() : d.getDate();
      m._p.M = utc ? d.getUTCMonth() : d.getMonth();
      m._p.y = utc ? d.getUTCFullYear() : d.getFullYear();
      m._p.H = 0;
      m._p.m = 0;
      m._p.s = 0;
      m._p.ms = 0;
      m._p.W = utc ? d.getUTCDay() : d.getDay();
      m._p.t = d.getTime();
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
      m._p.H = 23;
      m._p.m = 59;
      m._p.s = 59;
      m._p.ms = 999;
      m._p.W = dayOfWeek(m._p.y, endMonth, endDay);
      m._p.t = d.getTime();
      break;
    }
    case WEEK: {
      const dow =
        m._p.locale === undefined && (m._l === undefined || m._l === "en")
          ? 0
          : (
              ((m._getLocale()._config as Record<string, unknown>).week as
                | { dow: number; doy?: number }
                | undefined) ?? { dow: 0 }
            ).dow;
      const weekDay = utc ? d.getUTCDay() : d.getDay();
      const diff = (weekDay - dow + 7) % 7;
      if (utc) {
        d.setUTCDate(d.getUTCDate() - diff + 6);
        d.setUTCHours(23, 59, 59, 999);
      } else {
        d.setDate(d.getDate() - diff + 6);
        d.setHours(23, 59, 59, 999);
      }
      m._p.D = utc ? d.getUTCDate() : d.getDate();
      m._p.M = utc ? d.getUTCMonth() : d.getMonth();
      m._p.y = utc ? d.getUTCFullYear() : d.getFullYear();
      m._p.H = 23;
      m._p.m = 59;
      m._p.s = 59;
      m._p.ms = 999;
      m._p.W = utc ? d.getUTCDay() : d.getDay();
      m._p.t = d.getTime();
      break;
    }
    case ISO_WEEK: {
      const weekDay = utc ? d.getUTCDay() : d.getDay();
      const diff = weekDay === 0 ? -6 : 1 - weekDay;
      if (utc) {
        d.setUTCDate(d.getUTCDate() + diff + 6);
        d.setUTCHours(23, 59, 59, 999);
      } else {
        d.setDate(d.getDate() + diff + 6);
        d.setHours(23, 59, 59, 999);
      }
      m._p.D = utc ? d.getUTCDate() : d.getDate();
      m._p.M = utc ? d.getUTCMonth() : d.getMonth();
      m._p.y = utc ? d.getUTCFullYear() : d.getFullYear();
      m._p.H = 23;
      m._p.m = 59;
      m._p.s = 59;
      m._p.ms = 999;
      m._p.W = utc ? d.getUTCDay() : d.getDay();
      m._p.t = d.getTime();
      break;
    }
  }
}
