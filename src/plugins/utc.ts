import { Moment, setUtcMethodCallbacks } from "../moment-class";
import type { MomentInput } from "../moment-class";
import { isString, isArray, createUTCDate } from "../utils";
import {
  hasAlignedHourOffsetMoment,
  isDSTMoment,
  isLocalMoment,
  isUtcMoment,
  isUtcOffsetMoment,
  localMoment,
  parseZoneMoment,
  utcMoment,
  utcOffsetMoment,
  zoneAbbrMoment,
  zoneMoment,
  zoneNameMoment,
} from "../utc-extra";

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

export function registerUtcApi(target: UtcMomentTarget, deps: UtcApiDeps): void {
  setUtcMethodCallbacks({
    local: localMoment,
    utc: utcMoment,
    utcOffset: utcOffsetMoment,
    parseZone: (m, input, format) => parseZoneMoment(m, input, format, target),
    zone: zoneMoment,
    zoneAbbr: zoneAbbrMoment,
    zoneName: zoneNameMoment,
    isLocal: isLocalMoment,
    isUtc: isUtcMoment,
    isUtcOffset: isUtcOffsetMoment,
    isDST: isDSTMoment,
    hasAlignedHourOffset: hasAlignedHourOffsetMoment as (m: Moment, other?: MomentInput) => boolean,
  });
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
      return new Moment({
        _dClone: false,
        _d: new Date(deps.nowFn()),
        _isUTC: true,
        _offset: 0,
        _i: input,
      });
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
      return new Moment({
        _d: d,
        _dClone: false,
        _isUTC: true,
        _offset: 0,
        _i: input,
      });
    }
    const m = target(input, format, localeOrStrict, fourthArg);
    const absTime = m.valueOf();
    if (isNaN(absTime)) {
      m._isUTC = true;
      m._offset = 0;
      return m;
    }
    if (!m._isUTC && isString(input)) {
      if (!m._isValid) {
        const utcDate = new Date(`${input} UTC`);
        if (!isNaN(utcDate.getTime())) {
          m._d = utcDate;
        } else {
          m._d = new Date(absTime - m._d!.getTimezoneOffset() * 60000);
        }
      } else if (m._cold !== undefined) {
        m._d = new Date(absTime - m._d!.getTimezoneOffset() * 60000);
      } else {
        const utcDate = new Date(`${input} UTC`);
        if (!isNaN(utcDate.getTime())) {
          m._d = utcDate;
        }
      }
    } else {
      m._d = new Date(absTime);
    }
    m._d ??= new Date(NaN);
    m._t = m._d.getTime();
    m._isUTC = true;
    m._offset = 0;
    (m as unknown as { _refreshFields: () => void })._refreshFields();
    return m;
  };
}
