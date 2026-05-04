import type { Moment } from "./moment_fixed";
import type { Temporal } from "@js-temporal/polyfill";

let _T: typeof Temporal | null = null;
function getT(): typeof Temporal {
  if (!_T) {_T = require("@js-temporal/polyfill").Temporal;}
  return _T!;
}

export function getTemporalNamespace(): typeof Temporal {
  return getT();
}

export function toTemporal(m: Moment): Temporal.PlainDate | Temporal.ZonedDateTime {
  if (!m.isValid()) {throw new Error("Cannot convert invalid moment to Temporal");}

  const year = m.year() as number;
  const month = (m.month() as number) + 1;
  const day = m.date() as number;
  const hour = m.hour() as number;
  const minute = m.minute() as number;
  const second = m.second() as number;
  const ms = m.millisecond() as number;

  const hasTime = hour !== 0 || minute !== 0 || second !== 0 || ms !== 0;
  const hasOffset = m._isUTC || m._offset !== 0;

  if (hasTime || hasOffset) {
    const offsetMinutes = m.utcOffset() as number;
    const offsetHours = Math.floor(offsetMinutes / 60);
    const offsetMinRemainder = offsetMinutes % 60;
    const offsetStr =
      `${(offsetMinutes >= 0 ? "+" : "-") +
      String(Math.abs(offsetHours)).padStart(2, "0") 
      }:${ 
      String(Math.abs(offsetMinRemainder)).padStart(2, "0")}`;

    let timezone: string;
    if (m._isUTC && m._offset === 0) {
      timezone = "UTC";
    } else {
      timezone = offsetStr;
    }

    return getT().ZonedDateTime.from({
      timeZone: timezone,
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond: ms,
    });
  }

  return getT().PlainDate.from({ year, month, day });
}

export function fromTemporal(t: any): Moment {
  const { default: moment } = require("./index");
  const T = getT();

  if (t instanceof T.PlainDate) {
    return moment([t.year, t.month - 1, t.day]);
  }

  if (t instanceof T.ZonedDateTime) {
    const msSinceEpoch = t.epochMilliseconds;
    const m = moment(msSinceEpoch);
    const offset = t.offsetNanoseconds ? Math.round(t.offsetNanoseconds / 60e9) : 0;
    if (offset !== 0) {
      m.utcOffset(offset);
    }
    return m;
  }

  if (t instanceof T.PlainDateTime) {
    return moment([t.year, t.month - 1, t.day, t.hour, t.minute, t.second, t.millisecond]);
  }

  if (t instanceof T.PlainTime) {
    const now = new Date();
    return moment([
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      t.hour,
      t.minute,
      t.second,
      t.millisecond,
    ]);
  }

  throw new Error(`Unsupported Temporal type: ${  t && t.constructor && t.constructor.name}`);
}
