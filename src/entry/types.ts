import type { Duration } from "../duration";
import type { Locale } from "../locale";
import type { Moment } from "../moment-class";
import type { MomentLite } from "../moment-lite";

export interface CoreMomentStatic {
  (input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment;
  duration(input?: unknown, unit?: string): Duration;
  utc(input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment;
  isMoment(obj: unknown): boolean;
  isDate(obj: unknown): boolean;
  isDuration(obj: unknown): boolean;
  normalizeUnits(unit: string): string;
  unix(ts: number): Moment;
  invalid(input?: unknown): Moment;
  parseZone(input?: unknown, format?: unknown, strict?: boolean): Moment;
  min(...args: unknown[]): Moment;
  max(...args: unknown[]): Moment;
  relativeTimeRounding(fn?: Function | boolean): Function | boolean;
  relativeTimeThreshold(threshold: string, limit?: number): number | boolean;
  now: () => number;
  updateOffset: ((m: Moment, keepTime?: boolean) => void) | undefined;
  calendarFormat: ((m: Moment, now: Moment) => string) | undefined;
  fn: Moment;
  prototype: Moment;
  version: string;
  ISO_8601: string;
  RFC_2822: string;
  HTML5_FMT: {
    DATETIME_LOCAL: string;
    DATETIME_LOCAL_SECONDS: string;
    DATETIME_LOCAL_MS: string;
    DATE: string;
    TIME: string;
    TIME_SECONDS: string;
    TIME_MS: string;
    WEEK: string;
    MONTH: string;
  };
  parseTwoDigitYear: (str: string) => number;
  suppressDeprecationWarnings: boolean;
  deprecationHandler: ((name: string, msg: string) => void) | null;
}

export interface BaseMomentStatic {
  (input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment;
  utc(input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): Moment;
  isMoment(obj: unknown): boolean;
  isDate(obj: unknown): boolean;
  unix(ts: number): Moment;
  invalid(input?: unknown): Moment;
  now: () => number;
  updateOffset: ((m: Moment, keepTime?: boolean) => void) | undefined;
  fn: Moment;
  prototype: Moment;
  version: string;
  ISO_8601: string;
  RFC_2822: string;
  parseTwoDigitYear: (str: string) => number;
}

export interface LiteMomentStatic {
  (input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): MomentLite;
  utc(input?: unknown, format?: unknown, localeOrStrict?: unknown, fourthArg?: unknown): MomentLite;
  isMoment(obj: unknown): boolean;
  isDate(obj: unknown): boolean;
  unix(ts: number): MomentLite;
  invalid(input?: unknown): MomentLite;
  now: () => number;
  fn: MomentLite;
  prototype: MomentLite;
  version: string;
  ISO_8601: string;
  parseTwoDigitYear: (str: string) => number;
}

export interface FullMomentStatic extends CoreMomentStatic {
  locale(locale?: string | string[], ...args: unknown[]): string | Locale;
  localeData(locale?: string): Locale;
  defineLocale(locale: string, config: Record<string, unknown>): Locale | void;
  updateLocale(locale: string, config: Record<string, unknown>): Locale | void;
  months(format?: string, index?: number): string | string[];
  monthsShort(format?: string | number, index?: number): string | string[];
  weekdays(format?: string | boolean | number, index?: number): string | string[];
  weekdaysShort(format?: string | boolean | number, index?: number): string | string[];
  weekdaysMin(format?: string | boolean | number, index?: number): string | string[];
  config(key: string, value?: unknown): void;
  report(type?: string): void;
  fromTemporal(t: unknown): unknown;
}

export type MomentStatic = FullMomentStatic;
