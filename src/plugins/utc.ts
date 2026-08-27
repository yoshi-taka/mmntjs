import { isString, isArray, createUTCDate } from "../utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MomentCtor = new (config: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _p: Record<string, any>;
  _isValid: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _cold?: Record<string, any>;
  valueOf(): number;
};

type UtcMomentTarget<C extends MomentCtor> = ((
  input?: unknown,
  format?: unknown,
  localeOrStrict?: unknown,
  fourthArg?: unknown,
  isUTC?: boolean,
) => InstanceType<C>) &
  Record<string, unknown>;

export type UtcApiDeps<C extends MomentCtor> = {
  nowFn: () => number;
  ctor: C;
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

function createUTCDateFromParsedParts(parts: (number | undefined)[], nowMs: number): Date {
  const current = new Date(nowMs);
  const year = parts[0] ?? current.getUTCFullYear();
  let month = parts[1];
  let day = parts[2];
  if (parts[0] === undefined) {
    if (month === undefined) {
      month = current.getUTCMonth();
      day ??= current.getUTCDate();
    }
  }
  return createUTCDate(
    year,
    month ?? 0,
    day ?? 1,
    parts[3] ?? 0,
    parts[4] ?? 0,
    parts[5] ?? 0,
    parts[6] ?? 0,
  );
}

export function registerUtcApi<C extends MomentCtor>(
  target: UtcMomentTarget<C>,
  deps: UtcApiDeps<C>,
): void {
  const { ctor: C, nowFn } = deps;
  const momentRecord = target as unknown as Record<string, unknown>;
  momentRecord.utc = function (
    input?: unknown,
    format?: unknown,
    localeOrStrict?: unknown,
    fourthArg?: unknown,
  ): InstanceType<C> {
    if (input === null) {
      return new C({
        _dClone: false,
        _d: new Date(NaN),
        _isValid: false,
        _isUTC: true,
        _offset: 0,
        _i: input,
        _nullInput: true,
      }) as InstanceType<C>;
    }
    if (input === undefined) {
      return new C({ _t: nowFn(), _isUTC: true, _offset: 0, _i: input }) as InstanceType<C>;
    }
    if (isString(input)) {
      const fixedIsoZ = parseFixedISOZ(input);
      if (fixedIsoZ) {
        return new C({
          _d: fixedIsoZ,
          _isUTC: true,
          _offset: 0,
          _i: input,
          _dClone: false,
        }) as InstanceType<C>;
      }
      const fixedIsoDate = parseFixedISODate(input);
      if (fixedIsoDate) {
        return new C({
          _d: fixedIsoDate,
          _isUTC: true,
          _offset: 0,
          _i: input,
          _dClone: false,
        }) as InstanceType<C>;
      }
    }
    if (isArray(input)) {
      const arr = input;
      const y = Number(arr[0]);
      const M = arr[1] != null ? Number(arr[1]) : 0;
      const D = arr[2] != null ? Number(arr[2]) : 1;
      const H = arr[3] != null ? Number(arr[3]) : 0;
      const min = arr[4] != null ? Number(arr[4]) : 0;
      const s = arr[5] != null ? Number(arr[5]) : 0;
      const ms = arr[6] != null ? Number(arr[6]) : 0;
      const d = createUTCDate(y, M, D, H, min, s, ms);
      if (isNaN(d.getTime())) {
        return new C({
          _d: d,
          _dClone: false,
          _isUTC: true,
          _offset: 0,
          _i: input,
          _isValid: false,
        }) as InstanceType<C>;
      }
      return new C({
        _d: d,
        _dClone: false,
        _isUTC: true,
        _offset: 0,
        _i: input,
        _presetFields: H === 24 ? undefined : { y, M, D, H, m: min, s, ms },
      }) as InstanceType<C>;
    }
    const m = target(input, format, localeOrStrict, fourthArg, true);
    const absTime = m.valueOf();
    if (isNaN(absTime)) {
      m._p.isUTC = true;
      m._p.offset = 0;
      return m;
    }
    const hasExplicitOffset =
      m._cold?._parsedOffset !== undefined ||
      (isString(input) && /(?:[zZ]|[+-]\d\d:?\d\d)\s*$/.test(input));
    if (!m._p.isUTC && isString(input) && !hasExplicitOffset) {
      if (!m._isValid) {
        const utcDate = new Date(`${input}Z`);
        m._p.d = !isNaN(utcDate.getTime()) ? utcDate : new Date(NaN);
      } else if (m._cold !== undefined) {
        const parts = m._cold._parsedDateParts;
        if (parts && parts.length > 0) {
          m._p.d = createUTCDateFromParsedParts(parts, nowFn());
        } else {
          const utcDate = new Date(`${input}Z`);
          m._p.d = !isNaN(utcDate.getTime()) ? utcDate : new Date(absTime);
        }
      } else {
        const utcDate = new Date(`${input}Z`);
        m._p.d = !isNaN(utcDate.getTime()) ? utcDate : new Date(absTime);
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
