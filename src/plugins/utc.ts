import { createMomentFromDate, createSimpleMoment, Moment } from "../moment-class";
import type { MomentInput } from "../moment-class";
import { isString, isArray, createUTCDate } from "../utils";

type UtcMomentTarget = ((
  input?: unknown,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
) => Moment) &
  Record<string, unknown>;

export type UtcApiDeps = {
  nowFn: () => number;
};

function parseFixedISOZ(str: string): Date | null {
  if (str.length !== 24) {
    return null;
  }
  if (
    str.charCodeAt(4) !== 45 ||
    str.charCodeAt(7) !== 45 ||
    str.charCodeAt(10) !== 84 ||
    str.charCodeAt(13) !== 58 ||
    str.charCodeAt(16) !== 58 ||
    str.charCodeAt(19) !== 46 ||
    str.charCodeAt(23) !== 90
  ) {
    return null;
  }
  return createUTCDate(
    Number(str.slice(0, 4)),
    Number(str.slice(5, 7)) - 1,
    Number(str.slice(8, 10)),
    Number(str.slice(11, 13)),
    Number(str.slice(14, 16)),
    Number(str.slice(17, 19)),
    Number(str.slice(20, 23)),
  );
}

function parseFixedISODate(str: string): Date | null {
  const len = str.length;
  if (len !== 19 && len !== 16) {
    return null;
  }
  if (str.charCodeAt(4) !== 45 || str.charCodeAt(7) !== 45 || str.charCodeAt(10) !== 84) {
    return null;
  }
  if (len === 19 && str.charCodeAt(16) !== 58) {
    return null;
  }
  return createUTCDate(
    Number(str.slice(0, 4)),
    Number(str.slice(5, 7)) - 1,
    Number(str.slice(8, 10)),
    Number(str.slice(11, 13)),
    Number(str.slice(14, 16)),
    len === 19 ? Number(str.slice(17, 19)) : 0,
    0,
  );
}

export function registerUtcApi(target: UtcMomentTarget, deps: UtcApiDeps): void {
  const momentRecord = target as unknown as Record<string, unknown>;
  momentRecord.utc = function (
    input?: unknown,
    format?: unknown,
    localeOrStrict?: unknown,
    fourthArg?: unknown,
  ): Moment {
    if (input === null) {
      return new Moment({
        _dClone: false,
        _d: new Date(NaN),
        _isValid: false,
        _isUTC: true,
        _offset: 0,
        _i: input,
        _nullInput: true,
      });
    }
    if (input === undefined) {
      return createSimpleMoment({ _t: deps.nowFn(), _isUTC: true, _offset: 0, _i: input });
    }
    if (isString(input)) {
      const fixedIsoZ = parseFixedISOZ(input);
      if (fixedIsoZ) {
        return createMomentFromDate({
          _d: fixedIsoZ,
          _isUTC: true,
          _offset: 0,
          _i: input,
          _dClone: false,
        });
      }
      const fixedIsoDate = parseFixedISODate(input);
      if (fixedIsoDate) {
        return createMomentFromDate({
          _d: fixedIsoDate,
          _isUTC: true,
          _offset: 0,
          _i: input,
          _dClone: false,
        });
      }
    }
    if (isArray(input)) {
      const arr = input;
      const d = createUTCDate(
        arr[0] != null ? Number(arr[0]) : 0,
        arr[1] != null ? Number(arr[1]) : 0,
        arr[2] != null ? Number(arr[2]) : 1,
        arr[3] != null ? Number(arr[3]) : 0,
        arr[4] != null ? Number(arr[4]) : 0,
        arr[5] != null ? Number(arr[5]) : 0,
        arr[6] != null ? Number(arr[6]) : 0,
      );
      return createMomentFromDate({ _d: d, _dClone: false, _isUTC: true, _offset: 0, _i: input });
    }
    const m = target(input, format, localeOrStrict, fourthArg);
    const absTime = m.valueOf();
    if (isNaN(absTime)) {
      m._p.isUTC = true;
      m._p.offset = 0;
      return m;
    }
    if (!m._p.isUTC && isString(input)) {
      if (!m._isValid) {
        const utcDate = new Date(`${input} UTC`);
        if (!isNaN(utcDate.getTime())) {
          m._p.d = utcDate;
        } else {
          m._p.d = new Date(absTime);
        }
      } else if (m._cold !== undefined) {
        const parts = m._cold._parsedDateParts;
        if (parts && parts.length > 0) {
          m._p.d = createUTCDate(
            parts[0],
            parts[1] ?? 0,
            parts[2] ?? 1,
            parts[3] ?? 0,
            parts[4] ?? 0,
            parts[5] ?? 0,
            parts[6] ?? 0,
          );
        } else {
          m._p.d = new Date(absTime);
        }
      } else {
        const utcDate = new Date(`${input} UTC`);
        if (!isNaN(utcDate.getTime())) {
          m._p.d = utcDate;
        }
      }
    } else {
      m._p.d = new Date(absTime);
    }
    m._p.d ??= new Date(NaN);
    m._p.t = m._p.d.getTime();
    m._p.isUTC = true;
    m._p.offset = 0;
    (m as unknown as { _refreshFields: () => void })._refreshFields();
    return m;
  };
}
