import { DAY_MS, MINUTE_MS } from "../units";
import { localeInvalidDate } from "../locale-runtime";
import { Duration } from "../duration";
import {
  Moment,
  momentFromAnything,
  getFormatMomentCallback,
  type MomentInput,
} from "../moment-class";
import type { FormattableMoment } from "./types";
import { isArray, isObject, hasOwnProp } from "../utils";

const calendarKeys = ["sameDay", "nextDay", "nextWeek", "lastDay", "lastWeek", "sameElse"];

function isCalendarFormatObject(obj: Record<string, unknown>): boolean {
  for (const key of calendarKeys) {
    if (hasOwnProp(obj, key)) {
      return true;
    }
  }
  return false;
}

export function formatFromNow(m: Moment, pref?: boolean): string {
  if (!m._isValid) {
    return localeInvalidDate(m._getLocale());
  }
  return formatFrom(m, new Date(), pref);
}

export function formatFrom(m: Moment, input: MomentInput, pref?: boolean): string {
  if (!m._isValid) {
    return localeInvalidDate(m._getLocale());
  }
  let other: Moment;
  if (input === undefined || input === null) {
    other = new Moment({ _d: new Date(), _dClone: false });
  } else {
    other = momentFromAnything(input);
  }
  if (!other._isValid) {
    return localeInvalidDate(m._getLocale());
  }
  const dur = new Duration({ to: m, from: other });
  if (m._l) {
    dur.locale(m._l);
  }
  return dur.humanize(!pref);
}

export function formatToNow(m: Moment, pref?: boolean): string {
  if (!m._isValid) {
    return localeInvalidDate(m._getLocale());
  }
  return formatTo(m, new Date(), pref);
}

export function formatTo(m: Moment, input: MomentInput, pref?: boolean): string {
  if (!m._isValid) {
    return localeInvalidDate(m._getLocale());
  }
  const other = momentFromAnything(input);
  if (!other._isValid) {
    return localeInvalidDate(m._getLocale());
  }
  const dur = new Duration({ from: m, to: other });
  if (m._l) {
    dur.locale(m._l);
  }
  return dur.humanize(!pref);
}

export function formatCalendar(m: Moment, ref?: MomentInput, opts?: object): string {
  let reference: Moment;
  let formatOpts: Record<string, unknown> | undefined;

  if (opts !== undefined) {
    reference = !ref ? new Moment({ _d: new Date(), _dClone: false }) : momentFromAnything(ref);
    formatOpts = opts as Record<string, unknown>;
  } else if (ref !== undefined) {
    if (!ref) {
      reference = new Moment({ _d: new Date(), _dClone: false });
    } else if (isObject(ref) && isCalendarFormatObject(ref)) {
      formatOpts = ref;
      reference = new Moment({ _d: new Date(), _dClone: false });
    } else if (isArray(ref)) {
      reference = momentFromAnything(ref);
    } else {
      reference = momentFromAnything(ref);
    }
  } else {
    reference = new Moment({ _d: new Date(), _dClone: false });
  }

  const locale = m._getLocale();
  const cal = locale._config.calendar ?? ({} as Record<string, unknown>);

  let key: string;
  const calendarFormat = Moment.calendarFormat;
  if (calendarFormat) {
    key = calendarFormat(m, reference);
  } else {
    const thisOff = m.utcOffset();
    const thatOff = reference.utcOffset();
    const thisDay = Math.floor((m.valueOf() + thisOff * MINUTE_MS) / DAY_MS);
    const thatDay = Math.floor((reference.valueOf() + thatOff * MINUTE_MS) / DAY_MS);
    const sameOffset = thisOff === thatOff;
    const dayDiff = sameOffset
      ? thisDay - thatDay
      : thisDay - Math.floor((reference.valueOf() + thisOff * MINUTE_MS) / DAY_MS);

    if (dayDiff < -6) {
      key = "sameElse";
    } else if (dayDiff < -1) {
      key = "lastWeek";
    } else if (dayDiff < 0) {
      key = "lastDay";
    } else if (dayDiff < 1) {
      key = "sameDay";
    } else if (dayDiff < 2) {
      key = "nextDay";
    } else if (dayDiff < 7) {
      key = "nextWeek";
    } else {
      key = "sameElse";
    }
  }

  let formatString: unknown;
  if (typeof cal === "function") {
    formatString = (cal as Function).call(locale._config, key, m);
  } else if (formatOpts && hasOwnProp(formatOpts, key)) {
    formatString = formatOpts[key];
  } else if (hasOwnProp(cal, key)) {
    formatString = cal[key];
  } else if (hasOwnProp(cal, "sameElse")) {
    formatString = cal.sameElse;
  } else {
    formatString = "L";
  }

  if (typeof formatString === "function") {
    formatString = formatString.call(m, reference);
  }

  const formatter = getFormatMomentCallback();
  if (!formatter) {
    throw new Error("mmntjs formatter is not initialized");
  }
  return formatter(
    m as unknown as FormattableMoment,
    typeof formatString === "string" ? formatString : "L",
  );
}
