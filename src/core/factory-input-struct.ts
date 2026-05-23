import { Moment, checkOverflow } from "../moment-class";
import type { InternalParsedData } from "../types";
import { isObjectEmpty, createDate, createDateSafe, createUTCDate } from "../utils";
import { daysInMonth } from "../units";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedDataLike = Record<string, any>;

export function createFromArrayInput(
  arr: unknown[],
  parseArray: (arr: unknown[]) => ParsedDataLike | null,
  nowFn: () => number,
  isUTC?: boolean,
): Moment {
  if (arr.length === 0) {
    return new Moment({ _dClone: false, _t: nowFn(), _i: arr });
  }

  // Fast path: validate and extract fields without creating ParsedData object,
  // then populate Moment._p fields directly to skip the Date getter round-trip
  // in _refreshFields.

  for (const val of arr) {
    if (val === null || val === undefined) {
      return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });
    }
    const n = Number(val);
    if (isNaN(n)) {
      return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });
    }
  }

  const y = Number(arr[0]);
  if (isNaN(y)) {
    return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });
  }

  const M = arr[1] !== undefined ? Number(arr[1]) : 0;
  const D = arr[2] !== undefined ? Number(arr[2]) : 1;
  const H = arr[3] !== undefined ? Number(arr[3]) : 0;
  const min = arr[4] !== undefined ? Number(arr[4]) : 0;
  const s = arr[5] !== undefined ? Number(arr[5]) : 0;
  const ms = arr[6] !== undefined ? Number(arr[6]) : 0;

  // Inline checkOverflow for the array case (month, day, hour, minute, second, ms)
  if (M < 0 || M > 11) {
    const d = createDateSafe(y, M, D, H, min, s, ms, isUTC);
    return new Moment({
      _dClone: false,
      _d: d,
      _i: arr,
      _isValid: false,
      _overflow: 1,
      _isUTC: !!isUTC,
    });
  }
  const maxDay = daysInMonth(y, M);
  if (D < 1 || D > maxDay) {
    const d = createDateSafe(y, M, D, H, min, s, ms, isUTC);
    return new Moment({
      _dClone: false,
      _d: d,
      _i: arr,
      _isValid: false,
      _overflow: 2,
      _isUTC: !!isUTC,
    });
  }
  if (H < 0 || H > 24) {
    const d = createDateSafe(y, M, D, H, min, s, ms, isUTC);
    return new Moment({
      _dClone: false,
      _d: d,
      _i: arr,
      _isValid: false,
      _overflow: 3,
      _isUTC: !!isUTC,
    });
  }
  if (H === 24 && (min || s || ms)) {
    const d = createDateSafe(y, M, D, H, min, s, ms, isUTC);
    return new Moment({
      _dClone: false,
      _d: d,
      _i: arr,
      _isValid: false,
      _overflow: 3,
      _isUTC: !!isUTC,
    });
  }
  if (min < 0 || min > 59) {
    const d = createDateSafe(y, M, D, H, min, s, ms, isUTC);
    return new Moment({
      _dClone: false,
      _d: d,
      _i: arr,
      _isValid: false,
      _overflow: 4,
      _isUTC: !!isUTC,
    });
  }
  if (s < 0 || s > 59) {
    const d = createDateSafe(y, M, D, H, min, s, ms, isUTC);
    return new Moment({
      _dClone: false,
      _d: d,
      _i: arr,
      _isValid: false,
      _overflow: 5,
      _isUTC: !!isUTC,
    });
  }
  if (ms < 0 || ms > 999) {
    const d = createDateSafe(y, M, D, H, min, s, ms, isUTC);
    return new Moment({
      _dClone: false,
      _d: d,
      _i: arr,
      _isValid: false,
      _overflow: 6,
      _isUTC: !!isUTC,
    });
  }

  // Create Date once (handles 0-99 year via setFullYear in createDateSafe / createUTCDate)
  const d = isUTC ? createUTCDate(y, M, D, H, min, s, ms) : createDate(y, M, D, H, min, s, ms);

  if (isNaN(d.getTime())) {
    return new Moment({ _dClone: false, _d: d, _i: arr, _isValid: false, _isUTC: !!isUTC });
  }

  // Use _presetFields to skip _refreshFields Date getter round-trip.
  // H === 24 is the only normalization edge case for valid arrays —
  // Date normalizes 24:00:00.000 to next day 00:00:00.000, so fields
  // would be inconsistent. Fall through to normal constructor for H === 24.
  if (H === 24) {
    return new Moment({ _dClone: false, _d: d, _i: arr, _isUTC: !!isUTC });
  }

  return new Moment({
    _dClone: false,
    _d: d,
    _i: arr,
    _isUTC: !!isUTC,
    _presetFields: { y, M, D, H: H, m: min, s, ms },
  });
}

export function createFromObjectInput(
  obj: Record<string, unknown>,
  parseObject: (obj: Record<string, unknown>) => InternalParsedData,
  nowFn: () => number,
): Moment {
  const parsed = parseObject(obj);
  if (isObjectEmpty(parsed)) {
    return new Moment({ _dClone: false, _t: nowFn(), _i: obj });
  }
  const now = new Date(nowFn());
  const year = parsed.year ?? now.getFullYear();
  const month = parsed.month ?? (parsed.year !== undefined ? 0 : now.getMonth());
  const day =
    parsed.day ?? (parsed.year !== undefined || parsed.month !== undefined ? 1 : now.getDate());
  const hour = parsed.hour ?? 0;
  const minute = parsed.minute ?? 0;
  const second = parsed.second ?? 0;
  const ms = parsed.millisecond ?? 0;
  const overflow = checkOverflow({ year, month, day, hour, minute, second, millisecond: ms });
  const d = createDate(year, month, day, hour, minute, second, ms);
  if (overflow >= 0) {
    return new Moment({ _dClone: false, _d: d, _i: obj, _isValid: false, _overflow: overflow });
  }
  return new Moment({ _dClone: false, _d: d, _i: obj });
}
