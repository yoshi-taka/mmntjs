import { MINUTE_MS } from "./units";
import { createDateSafe, isString } from "./utils";
import { parseString } from "./parse";
import type { ParseLocale } from "./parse-locale";
import type { Moment } from "./moment-class";

export type MomentFactory = (
  input?: unknown,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
) => Moment;

export type UtcMoment = Moment & {
  _i?: unknown;
  _f?: string | string[];
  _isParseZone?: boolean;
  _refreshFields: () => void;
  _getD: () => Date;
  _getLocale: () => unknown;
  _p: {
    d?: Date;
    t: number;
    isUTC: boolean;
    offset: number;
    y: number;
    M: number;
    D: number;
    H: number;
    m: number;
    s: number;
    ms: number;
  };
  valueOf: () => number;
  clone: () => Moment;
};

export function localMoment(m: UtcMoment, keepLocalTime?: boolean): Moment {
  if (m._p.isUTC) {
    if (keepLocalTime) {
      // moment.js compat: local(keepLocalTime) from isUTC:
      //   _d += _d.getTimezoneOffset() * 60000
      // where _d = p.t (display epoch) in our representation
      (m as unknown as { _ensureFields: () => void })._ensureFields();
      const _d = m._p.t;
      m._p.d = new Date(_d + new Date(_d).getTimezoneOffset() * 60000);
      m._p.t = m._p.d.getTime();
    } else {
      m._p.d = new Date(m.valueOf());
      m._p.t = m._p.d.getTime();
    }
  }
  m._p.isUTC = false;
  m._refreshFields();
  m._p.offset = -m._getD().getTimezoneOffset();
  return m;
}

export function utcMoment(m: UtcMoment, keepLocalTime?: boolean): Moment {
  if (m._p.isUTC && m._p.offset !== 0) {
    if (!keepLocalTime) {
      m._p.d = new Date(m.valueOf());
      m._p.t = m._p.d.getTime();
    }
  } else if (!m._p.isUTC) {
    if (keepLocalTime) {
      (m as unknown as { _ensureFields: () => void })._ensureFields();
      m._p.d = new Date(Date.UTC(m._p.y, m._p.M, m._p.D, m._p.H, m._p.m, m._p.s, m._p.ms));
    } else {
      m._p.d = new Date(m.valueOf());
    }
    m._p.t = m._p.d.getTime();
  }
  m._p.isUTC = true;
  m._p.offset = 0;
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
    if (!m._isValid) {
      return NaN;
    }
    (m as unknown as { _ensureFields: () => void })._ensureFields();
    return Number.isNaN(m._p.offset) ? 0 : m._p.offset;
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
    if (!m._p.isUTC) {
      // moment.js compat: localAdjust = getDateOffset(this) = this._p.offset
      // then add(localAdjust, 'm') after setting offset/isUTC
      const localAdjust = m._p.offset;
      m._p.offset = numOffset;
      m._p.isUTC = true;
      m._p.t += localAdjust * MINUTE_MS;
      m._p.d = undefined;
    } else {
      m._p.offset = numOffset;
      m._p.isUTC = true;
    }
  } else {
    // moment.js compat: _d += (new_offset - old_offset) * 60000
    const oldOffset = m._p.isUTC ? m._p.offset || 0 : 0;
    if (!Number.isNaN(numOffset)) {
      m._p.t = m._p.t + (numOffset - oldOffset) * MINUTE_MS;
    }
    m._p.d = undefined;
    m._p.offset = numOffset;
    m._p.isUTC = true;
  }
  if (!Number.isFinite(m._p.t) || Math.abs(m._p.t) > 8.64e15) {
    m._p.t = NaN;
    m._p.d = new Date(NaN);
    m._isValid = false;
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
    const clone = m.clone();
    clone._isParseZone = true;
    return clone;
  }
  if (input === undefined) {
    const clone = m.clone();
    clone._isParseZone = true;
    if (isString(m._i)) {
      const fmt = m._f;
      const parsed =
        fmt && fmt !== "RFC_2822" && fmt !== "ISO_8601"
          ? parseString(m._i, fmt, m._getLocale() as unknown as ParseLocale)
          : parseString(m._i, undefined, m._getLocale() as unknown as ParseLocale);
      if (parsed?.offset !== undefined) {
        (clone as unknown as { _ensureFields: () => void })._ensureFields();
        clone._p.d = new Date(clone.valueOf() + parsed.offset * MINUTE_MS);
        clone._p.t = clone._p.d.getTime();
        clone._p.offset = parsed.offset;
        clone._p.isUTC = true;
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
          clone._p.offset = sign * (hours * 60 + minutes);
          clone._p.isUTC = true;
        } else {
          // No offset found — treat wall-clock as UTC (+00:00)
          (clone as unknown as { _ensureFields: () => void })._ensureFields();
          clone._p.d = new Date(
            Date.UTC(
              clone._p.y,
              clone._p.M,
              clone._p.D,
              clone._p.H,
              clone._p.m,
              clone._p.s,
              clone._p.ms,
            ),
          );
          clone._p.t = clone._p.d.getTime();
          clone._p.offset = 0;
          clone._p.isUTC = true;
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
      (next as unknown as { _ensureFields: () => void })._ensureFields();
      const d = createDateSafe(
        next._p.y,
        next._p.M,
        next._p.D,
        next._p.H,
        next._p.m,
        next._p.s,
        next._p.ms,
        true,
      );
      next._p.d = d;
      next._p.t = d.getTime();
      next._p.offset = parsed.offset;
      next._p.isUTC = true;
      next._refreshFields();
    } else {
      const allInput = `${input} ${parsed?._unusedInput.join("") ?? ""}`;
      const tzMatch = allInput.match(/([+-]\d{2}):?(\d{2})\s*$/);
      if (tzMatch) {
        const sign = tzMatch[1][0] === "+" ? 1 : -1;
        const hours = parseInt(tzMatch[1].substring(1), 10);
        const minutes = parseInt(tzMatch[2], 10);
        next._p.offset = sign * (hours * 60 + minutes);
        next._p.isUTC = true;
      } else if (!next._p.isUTC) {
        (next as unknown as { _ensureFields: () => void })._ensureFields();
        const d = createDateSafe(
          next._p.y,
          next._p.M,
          next._p.D,
          next._p.H,
          next._p.m,
          next._p.s,
          next._p.ms,
          true,
        );
        next._p.d = d;
        next._p.t = d.getTime();
        next._p.offset = 0;
        next._p.isUTC = true;
        next._refreshFields();
      }
    }
  } else if (!next._p.isUTC && isString(input)) {
    // No format, no offset — treat wall-clock as UTC (+00:00)
    (next as unknown as { _ensureFields: () => void })._ensureFields();
    const d = createDateSafe(
      next._p.y,
      next._p.M,
      next._p.D,
      next._p.H,
      next._p.m,
      next._p.s,
      next._p.ms,
      true,
    );
    next._p.d = d;
    next._p.t = d.getTime();
    next._p.offset = 0;
    next._p.isUTC = true;
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
  if (m._p.isUTC) {
    return "UTC";
  }
  return "";
}

export function zoneNameMoment(m: UtcMoment): string {
  if ((m as unknown as Record<string, unknown>)._z) {
    return ((m as unknown as Record<string, unknown>)._z as { name: string }).name;
  }
  if (m._p.isUTC) {
    return "Coordinated Universal Time";
  }
  return "";
}

export function isLocalMoment(m: UtcMoment): boolean {
  return !m._p.isUTC;
}

export function isUtcMoment(m: UtcMoment): boolean {
  return m._p.isUTC && m._p.offset === 0;
}

export function isUtcOffsetMoment(m: UtcMoment): boolean {
  return m._p.isUTC;
}

export function isDSTMoment(m: UtcMoment): boolean {
  if (m._p.isUTC) {
    return false;
  }
  const currentOffset = m.utcOffset();
  return (
    currentOffset > m.clone().month(0).utcOffset() || currentOffset > m.clone().month(5).utcOffset()
  );
}

export function hasAlignedHourOffsetMoment(m: UtcMoment, other?: Moment): boolean {
  if (!m._isValid) {
    return false;
  }
  if (other && !other._isValid) {
    return false;
  }
  const otherOffset = other ? other.utcOffset() : 0;
  return (m.utcOffset() - otherOffset) % 60 === 0;
}
