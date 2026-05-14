import { Moment, checkOverflow } from "../moment-class";
import type { InternalParsedData } from "../types";
import { isObjectEmpty, createDate, createDateSafe } from "../utils";

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
  const parsed = parseArray(arr);
  if (!parsed) {
    return new Moment({ _dClone: false, _d: new Date(NaN), _i: arr, _isValid: false });
  }
  const overflow = checkOverflow(parsed);
  const d = createDateSafe(
    parsed.year,
    parsed.month,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
    parsed.millisecond,
    isUTC,
  );
  if (overflow >= 0) {
    return new Moment({ _dClone: false, _d: d, _i: arr, _isValid: false, _overflow: overflow });
  }
  return new Moment({ _dClone: false, _d: d, _i: arr });
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
  const year = parsed.year !== undefined ? (parsed.year as number) : now.getFullYear();
  const month =
    parsed.month !== undefined
      ? (parsed.month as number)
      : parsed.year !== undefined
        ? 0
        : now.getMonth();
  const day =
    parsed.day !== undefined
      ? (parsed.day as number)
      : parsed.year !== undefined || parsed.month !== undefined
        ? 1
        : now.getDate();
  const hour = parsed.hour !== undefined ? (parsed.hour as number) : 0;
  const minute = parsed.minute !== undefined ? (parsed.minute as number) : 0;
  const second = parsed.second !== undefined ? (parsed.second as number) : 0;
  const ms = parsed.millisecond !== undefined ? (parsed.millisecond as number) : 0;
  const overflow = checkOverflow({ year, month, day, hour, minute, second, millisecond: ms });
  const d = createDate(year, month, day, hour, minute, second, ms);
  if (overflow >= 0) {
    return new Moment({ _dClone: false, _d: d, _i: obj, _isValid: false, _overflow: overflow });
  }
  return new Moment({ _dClone: false, _d: d, _i: obj });
}
