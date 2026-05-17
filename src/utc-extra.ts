import { MINUTE_MS } from "./units";
import { createDateSafe, isString } from "./utils";
import { parseString } from "./parse";
import type { ParseLocale } from "./parse-locale";
import type { Moment } from "./moment-class";

type MomentFactory = (
  input?: unknown,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
) => Moment;

type UtcMoment = Moment & {
  _d?: Date;
  _t: number;
  _isUTC: boolean;
  _offset: number;
  _i?: unknown;
  _f?: string | string[];
  _isParseZone?: boolean;
  _refreshFields: () => void;
  _getD: () => Date;
  _getLocale: () => unknown;
  $y: number;
  $M: number;
  $D: number;
  $H: number;
  $m: number;
  $s: number;
  $ms: number;
  valueOf: () => number;
  clone: () => Moment;
};

export function localMoment(m: UtcMoment, keepLocalTime?: boolean): Moment {
  if (m._isUTC) {
    if (keepLocalTime) {
      (m as unknown as { _ensureFields: () => void })._ensureFields();
      m._d = new Date(m.$y, m.$M, m.$D, m.$H, m.$m, m.$s, m.$ms);
    } else {
      m._d = new Date(m.valueOf());
    }
    m._t = m._d.getTime();
  }
  m._isUTC = false;
  m._refreshFields();
  m._offset = -m._getD().getTimezoneOffset();
  return m;
}

export function utcMoment(m: UtcMoment, keepLocalTime?: boolean): Moment {
  if (m._isUTC && m._offset !== 0) {
    if (!keepLocalTime) {
      m._d = new Date(m.valueOf());
      m._t = m._d.getTime();
    }
  } else if (!m._isUTC) {
    if (keepLocalTime) {
      (m as unknown as { _ensureFields: () => void })._ensureFields();
      m._d = new Date(Date.UTC(m.$y, m.$M, m.$D, m.$H, m.$m, m.$s, m.$ms));
    } else {
      m._d = new Date(m.valueOf());
    }
    m._t = m._d.getTime();
  }
  m._isUTC = true;
  m._offset = 0;
  m._refreshFields();
  return m;
}

function parseOffsetString(offset: string): number {
  const len = offset.length;
  if (len < 5) {
    return NaN;
  }
  const c0 = offset.charCodeAt(0);
  if (c0 !== 43 && c0 !== 45) {
    return NaN;
  }
  const sign = c0 === 43 ? 1 : -1;
  const h1 = offset.charCodeAt(1) - 48;
  const h2 = offset.charCodeAt(2) - 48;
  if (h1 < 0 || h1 > 9 || h2 < 0 || h2 > 9) {
    return NaN;
  }
  const hours = h1 * 10 + h2;
  let mi = 3;
  if (offset.charCodeAt(3) === 58) {
    mi = 4;
  }
  if (len < mi + 2) {
    return NaN;
  }
  const m1 = offset.charCodeAt(mi) - 48;
  const m2 = offset.charCodeAt(mi + 1) - 48;
  if (m1 < 0 || m1 > 9 || m2 < 0 || m2 > 9) {
    return NaN;
  }
  return sign * (hours * 60 + (m1 * 10 + m2));
}

export function utcOffsetMoment(
  m: UtcMoment,
  offset?: number | string,
  keepLocalTime?: boolean,
): number | Moment {
  if (offset === undefined) {
    (m as unknown as { _ensureFields: () => void })._ensureFields();
    return m._offset;
  }
  let numOffset: number;
  if (typeof offset === "string") {
    numOffset = parseOffsetString(offset);
    if (isNaN(numOffset)) {
      return m;
    }
  } else {
    numOffset = Math.abs(offset) < 16 ? offset * 60 : offset;
  }
  if (keepLocalTime) {
    (m as unknown as { _ensureFields: () => void })._ensureFields();
    if (!m._isUTC) {
      m._d = new Date(Date.UTC(m.$y, m.$M, m.$D, m.$H, m.$m, m.$s, m.$ms));
      m._t = m._d.getTime();
    }
    m._offset = numOffset;
    m._isUTC = true;
  } else {
    const oldAbsTime = m.valueOf();
    m._d = new Date(oldAbsTime + numOffset * MINUTE_MS);
    m._t = m._d.getTime();
    m._offset = numOffset;
    m._isUTC = true;
  }
  m._refreshFields();
  return m;
}

export function parseZoneMoment(
  m: UtcMoment,
  input?: unknown,
  format?: unknown,
  createMoment?: MomentFactory,
): Moment {
  if (!m._isValid) {
    const clone = m.clone() as unknown as UtcMoment;
    clone._isParseZone = true;
    return clone;
  }
  if (input === undefined) {
    const clone = m.clone() as unknown as UtcMoment;
    clone._isParseZone = true;
    if (isString(m._i)) {
      const fmt = m._f;
      const parsed =
        fmt && fmt !== "RFC_2822" && fmt !== "ISO_8601"
          ? parseString(m._i, fmt, m._getLocale() as unknown as ParseLocale)
          : parseString(m._i, undefined, m._getLocale() as unknown as ParseLocale);
      if (parsed?.offset !== undefined) {
        (clone as unknown as { _ensureFields: () => void })._ensureFields();
        clone._d = new Date(clone.valueOf() + parsed.offset * MINUTE_MS);
        clone._t = clone._d.getTime();
        clone._offset = parsed.offset;
        clone._isUTC = true;
        clone._refreshFields();
      } else {
        const unusedInput =
          ((m as unknown as Record<string, unknown>)._unusedInput as string[] | undefined) ?? [];
        const allInput = `${String(m._i ?? "")} ${unusedInput.join("")}`; // eslint-disable-line no-unnecessary-condition
        const tzMatch = allInput.match(/([+-]\d{2}):?(\d{2})\s*$/);
        if (tzMatch) {
          const sign = tzMatch[1][0] === "+" ? 1 : -1;
          const hours = parseInt(tzMatch[1].substring(1), 10);
          const minutes = parseInt(tzMatch[2], 10);
          clone._offset = sign * (hours * 60 + minutes);
          clone._isUTC = true;
        } else {
          // No offset found — treat wall-clock as UTC (+00:00)
          (clone as unknown as { _ensureFields: () => void })._ensureFields();
          clone._d = new Date(
            Date.UTC(clone.$y, clone.$M, clone.$D, clone.$H, clone.$m, clone.$s, clone.$ms),
          );
          clone._t = clone._d.getTime();
          clone._offset = 0;
          clone._isUTC = true;
          clone._refreshFields();
        }
      }
    }
    return clone;
  }
  if (!createMoment) {
    throw new Error("mmntjs parseZone() requires initialized moment factory");
  }
  const next = createMoment(input) as UtcMoment;
  next._isParseZone = true;
  if (format && isString(input)) {
    const parsed = parseString(
      input,
      format as string | string[],
      next._getLocale() as unknown as ParseLocale,
    );
    if (parsed?.offset !== undefined) {
      const d = createDateSafe(
        parsed.year ?? 0,
        parsed.month ?? 0,
        parsed.day ?? 1,
        parsed.hour ?? 0,
        parsed.minute ?? 0,
        parsed.second ?? 0,
        parsed.millisecond ?? 0,
        true,
      );
      next._d = d;
      next._t = d.getTime();
      next._offset = parsed.offset;
      next._isUTC = true;
      next._refreshFields();
    } else {
      const allInput = `${input} ${parsed?._unusedInput.join("") ?? ""}`;
      const tzMatch = allInput.match(/([+-]\d{2}):?(\d{2})\s*$/);
      if (tzMatch) {
        const sign = tzMatch[1][0] === "+" ? 1 : -1;
        const hours = parseInt(tzMatch[1].substring(1), 10);
        const minutes = parseInt(tzMatch[2], 10);
        next._offset = sign * (hours * 60 + minutes);
        next._isUTC = true;
      } else if (!next._isUTC) {
        (next as unknown as { _ensureFields: () => void })._ensureFields();
        const d = createDateSafe(
          next.$y,
          next.$M,
          next.$D,
          next.$H,
          next.$m,
          next.$s,
          next.$ms,
          true,
        );
        next._d = d;
        next._t = d.getTime();
        next._offset = 0;
        next._isUTC = true;
        next._refreshFields();
      }
    }
  } else if (!next._isUTC && isString(input)) {
    // No format, no offset — treat wall-clock as UTC (+00:00)
    (next as unknown as { _ensureFields: () => void })._ensureFields();
    const d = createDateSafe(next.$y, next.$M, next.$D, next.$H, next.$m, next.$s, next.$ms, true);
    next._d = d;
    next._t = d.getTime();
    next._offset = 0;
    next._isUTC = true;
    next._refreshFields();
  }
  return next;
}

export function zoneMoment(
  m: UtcMoment,
  offset?: number | string,
  keepLocalTime?: boolean,
): number | Moment {
  if (offset === undefined) {
    const off = -(utcOffsetMoment(m) as number);
    return off || 0;
  }
  if (typeof offset === "string") {
    const tzMatch = offset.match(/([+-]\d{1,2}):?(\d{2})?$/);
    if (tzMatch) {
      const sign = tzMatch[1][0] === "+" ? 1 : -1;
      const hours = parseInt(tzMatch[1].substring(1), 10);
      const minutes = tzMatch[2] ? parseInt(tzMatch[2], 10) : 0;
      return utcOffsetMoment(m, sign * (hours * 60 + minutes), keepLocalTime);
    }
    if (/^[+-]\d{1,2}$/.test(offset.trim())) {
      const num = parseInt(offset, 10);
      return utcOffsetMoment(m, Math.abs(num) < 16 ? -num * 60 : -num, keepLocalTime);
    }
    const num = Number(offset);
    if (!isNaN(num)) {
      return utcOffsetMoment(m, -num, keepLocalTime);
    }
    return m;
  }
  return utcOffsetMoment(m, Math.abs(offset) < 16 ? -offset * 60 : -offset, keepLocalTime);
}

export function zoneAbbrMoment(m: UtcMoment): string {
  if ((m as unknown as Record<string, unknown>)._z) {
    return ((m as unknown as Record<string, unknown>)._z as { abbr: (ts: number) => string }).abbr(
      m.valueOf(),
    );
  }
  if (m._isUTC) {
    if (m._offset === 0) {
      return "UTC";
    }
    const offset = m._offset;
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? "+" : "-";
    return `GMT${sign}${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
  }
  return "";
}

export function zoneNameMoment(m: UtcMoment): string {
  if ((m as unknown as Record<string, unknown>)._z) {
    return ((m as unknown as Record<string, unknown>)._z as { name: string }).name;
  }
  if (m._isUTC && m._offset === 0) {
    return "Coordinated Universal Time";
  }
  return "";
}

export function isLocalMoment(m: UtcMoment): boolean {
  return !m._isUTC;
}

export function isUtcMoment(m: UtcMoment): boolean {
  return m._isUTC && m._offset === 0;
}

export function isUtcOffsetMoment(m: UtcMoment): boolean {
  return m._isUTC;
}

export function isDSTMoment(m: UtcMoment): boolean {
  if (m._isUTC) {
    return false;
  }
  const dt = m._getD();
  const jan = new Date(dt.getFullYear(), 0, 1);
  const jul = new Date(dt.getFullYear(), 6, 1);
  const janOff = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return dt.getTimezoneOffset() < janOff;
}

export function hasAlignedHourOffsetMoment(m: UtcMoment, other?: Moment): boolean {
  if (!m._isValid) {
    return false;
  }
  const otherOffset = other ? (other as unknown as UtcMoment).utcOffset() : 0;
  return (m.utcOffset() - otherOffset) % 60 === 0;
}
