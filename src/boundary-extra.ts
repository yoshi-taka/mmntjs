import { ISO_WEEK, QUARTER, WEEK, daysInMonth } from "./units";
import type { Locale } from "./locale-runtime";
import type { Moment } from "./moment_core";

type BoundaryAwareMoment = Moment & {
  _isUTC: boolean;
  _t: number;
  _ensureFields: () => void;
  _updateOffset: (keepTime?: boolean) => void;
  _getD: () => Date;
  _getLocale: () => Locale;
  $y: number;
  $M: number;
  $D: number;
  $W: number;
  $H: number;
  $m: number;
  $s: number;
  $ms: number;
};

function dayOfWeek(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let year = y;
  year -= m < 2 ? 1 : 0;
  return (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) + t[m] + d) % 7;
}

export function startOfExtraMoment(m: BoundaryAwareMoment, code: number): void {
  const d = m._getD();
  const utc = m._isUTC;
  switch (code) {
    case QUARTER:
      if (utc) { d.setUTCMonth(Math.floor(m.$M / 3) * 3); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); }
      else { d.setDate(1); d.setMonth(Math.floor(m.$M / 3) * 3); d.setHours(0, 0, 0, 0); }
      m.$M = Math.floor(m.$M / 3) * 3;
      m.$D = 1;
      m.$H = 0; m.$m = 0; m.$s = 0; m.$ms = 0;
      m.$W = dayOfWeek(m.$y, m.$M, m.$D);
      break;
    case WEEK: {
      const weekCfg = ((m._getLocale()._config as Record<string, unknown>).week as { dow: number; doy?: number } | undefined) ?? { dow: 0 };
      const dow = weekCfg.dow;
      const day = utc ? d.getUTCDay() : d.getDay();
      const diff = (day - dow + 7) % 7;
      if (utc) { d.setUTCDate(d.getUTCDate() - diff); d.setUTCHours(0, 0, 0, 0); }
      else { d.setDate(d.getDate() - diff); d.setHours(0, 0, 0, 0); }
      m.$D = utc ? d.getUTCDate() : d.getDate();
      m.$M = utc ? d.getUTCMonth() : d.getMonth();
      m.$y = utc ? d.getUTCFullYear() : d.getFullYear();
      m.$H = 0; m.$m = 0; m.$s = 0; m.$ms = 0;
      m.$W = dow;
      break;
    }
    case ISO_WEEK: {
      const day = utc ? d.getUTCDay() : d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      if (utc) { d.setUTCDate(d.getUTCDate() + diff); d.setUTCHours(0, 0, 0, 0); }
      else { d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); }
      m.$D = utc ? d.getUTCDate() : d.getDate();
      m.$M = utc ? d.getUTCMonth() : d.getMonth();
      m.$y = utc ? d.getUTCFullYear() : d.getFullYear();
      m.$H = 0; m.$m = 0; m.$s = 0; m.$ms = 0;
      m.$W = 1;
      break;
    }
  }
}

export function endOfExtraMoment(m: BoundaryAwareMoment, code: number): void {
  const d = m._getD();
  const utc = m._isUTC;
  switch (code) {
    case QUARTER: {
      const endMonth = Math.floor(m.$M / 3) * 3 + 2;
      const endDay = daysInMonth(m.$y, endMonth);
      if (utc) { d.setTime(Date.UTC(m.$y, endMonth, endDay, 23, 59, 59, 999)); }
      else { d.setFullYear(m.$y, endMonth, endDay); d.setHours(23, 59, 59, 999); }
      m.$M = endMonth;
      m.$D = endDay;
      m.$H = 23; m.$m = 59; m.$s = 59; m.$ms = 999;
      m.$W = dayOfWeek(m.$y, endMonth, endDay);
      break;
    }
    case WEEK: {
      const weekCfg = ((m._getLocale()._config as Record<string, unknown>).week as { dow: number; doy?: number } | undefined) ?? { dow: 0 };
      const dow = weekCfg.dow;
      const weekDay = utc ? d.getUTCDay() : d.getDay();
      const diff = (weekDay - dow + 7) % 7;
      if (utc) { d.setUTCDate(d.getUTCDate() - diff + 6); d.setUTCHours(23, 59, 59, 999); }
      else { d.setDate(d.getDate() - diff + 6); d.setHours(23, 59, 59, 999); }
      m.$D = utc ? d.getUTCDate() : d.getDate();
      m.$M = utc ? d.getUTCMonth() : d.getMonth();
      m.$y = utc ? d.getUTCFullYear() : d.getFullYear();
      m.$H = 23; m.$m = 59; m.$s = 59; m.$ms = 999;
      m.$W = dow;
      break;
    }
    case ISO_WEEK: {
      const weekDay = utc ? d.getUTCDay() : d.getDay();
      const diff = weekDay === 0 ? -6 : 1 - weekDay;
      if (utc) { d.setUTCDate(d.getUTCDate() + diff + 6); d.setUTCHours(23, 59, 59, 999); }
      else { d.setDate(d.getDate() + diff + 6); d.setHours(23, 59, 59, 999); }
      m.$D = utc ? d.getUTCDate() : d.getDate();
      m.$M = utc ? d.getUTCMonth() : d.getMonth();
      m.$y = utc ? d.getUTCFullYear() : d.getFullYear();
      m.$H = 23; m.$m = 59; m.$s = 59; m.$ms = 999;
      m.$W = 1;
      break;
    }
  }
}
