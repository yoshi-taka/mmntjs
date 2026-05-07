import type { Moment } from "./moment_fixed";

let _T: unknown = null;
let _momentFn: ((...args: unknown[]) => Moment) | null = null;

export function setTemporalMomentFactory(fn: (...args: unknown[]) => Moment): void {
  _momentFn = fn;
}

function getT(): unknown {
  if (!_T) {
    const g = globalThis as Record<string, unknown>;
    _T = (typeof g.Temporal === "object" && g.Temporal !== null)
      ? g.Temporal
      : require("@js-temporal/polyfill").Temporal;
  }
  return _T;
}

function getMoment(): (...args: unknown[]) => Moment {
  const fn = _momentFn;
  if (!fn) {
    const loaded = require("./core/factory").moment as (...args: unknown[]) => Moment;
    _momentFn = loaded;
    return loaded;
  }
  return fn;
}

function offsetToString(offsetMinutes: number): string {
  if (offsetMinutes === 0) {return "UTC";}
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

export function getTemporalNamespace(): unknown {
  return getT();
}

export function toTemporal(m: Moment): unknown {
  if (!m.isValid()) {throw new Error("Cannot convert invalid moment to Temporal");}

  const year = m.year();
  const month = m.month() + 1;
  const day = m.date();
  const T = getT() as {
    PlainDate: new (y: number, m: number, d: number) => { year: number; month: number; day: number };
    ZonedDateTime: { from(o: Record<string, unknown>): unknown };
  };

  const hasTime = m.hour() !== 0 || m.minute() !== 0 || m.second() !== 0 || m.millisecond() !== 0;
  const hasOffset = m._isUTC || m._offset !== 0;

  if (!hasTime && !hasOffset) {
    return new T.PlainDate(year, month, day);
  }

  return T.ZonedDateTime.from({
    timeZone: offsetToString(m.utcOffset()),
    year, month, day,
    hour: m.hour(), minute: m.minute(), second: m.second(), millisecond: m.millisecond(),
  });
}

function isTemporalInstance(t: unknown, cls: string): t is Record<string, unknown> {
  try {
    return t != null && typeof t === "object" && (t as Record<string, unknown>).constructor.name === cls;
  } catch { return false; }
}

export function fromTemporal(t: unknown): Moment {
  const moment = getMoment();

  if (isTemporalInstance(t, "PlainDate")) {
    return moment([t.year as number, (t.month as number) - 1, t.day as number]);
  }

  if (isTemporalInstance(t, "ZonedDateTime")) {
    const m = moment(t.epochMilliseconds as number);
    if (t.offsetNanoseconds) {
      m.utcOffset(Math.round(Number(t.offsetNanoseconds) / 6e10));
    }
    return m;
  }

  if (isTemporalInstance(t, "PlainDateTime")) {
    return moment([t.year as number, (t.month as number) - 1, t.day as number, t.hour as number, t.minute as number, t.second as number, t.millisecond as number]);
  }

  if (isTemporalInstance(t, "PlainTime")) {
    const now = new Date();
    return moment([now.getFullYear(), now.getMonth(), now.getDate(), t.hour as number, t.minute as number, t.second as number, t.millisecond as number]);
  }

  throw new Error(`Unsupported Temporal type: ${typeof t === "object" && t !== null ? (t as Record<string, unknown>).constructor.name : typeof t}`);
}
