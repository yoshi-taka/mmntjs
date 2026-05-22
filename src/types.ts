// =========================================================================
// TYPED INTERNAL API — Central type definitions for mmntjs core
// =========================================================================
// This module defines the strongly-typed internal interface. Public API
// boundary modules (entry/*, full.ts, lite.ts) cast to weaker types for
// Moment.js compatibility. No file outside src/core/ should import this
// directly unless it is itself a compatibility boundary.
// =========================================================================

// -------------------------------------------------------------------------
// Unit system — normalized unit names, alias strings, numeric codes
// -------------------------------------------------------------------------

export type NormalizedUnit =
  | "year"
  | "month"
  | "date"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "week"
  | "isoWeek"
  | "weekday"
  | "isoWeekday"
  | "quarter"
  | "dayOfYear"
  | "weekYear"
  | "isoWeekYear";

export type UnitAlias =
  | NormalizedUnit
  | "Y"
  | "y"
  | "years"
  | "M"
  | "months"
  | "Mo"
  | "D"
  | "d"
  | "days"
  | "date"
  | "dates"
  | "h"
  | "hours"
  | "m"
  | "minutes"
  | "s"
  | "seconds"
  | "ms"
  | "milliseconds"
  | "w"
  | "W"
  | "weeks"
  | "isoWeeks"
  | "weekdays"
  | "e"
  | "isoWeekdays"
  | "E"
  | "quarter"
  | "quarters"
  | "Q"
  | "dayOfYear"
  | "dayOfYears"
  | "doy"
  | "DDD"
  | "gg"
  | "weekYear"
  | "weekYears"
  | "GG"
  | "isoWeekYear"
  | "isoWeekYears"
  | "isoWeek";

export type UnitCode =
  | 0 // YEAR
  | 1 // MONTH
  | 2 // DATE
  | 3 // HOUR
  | 4 // MINUTE
  | 5 // SECOND
  | 6 // MILLISECOND
  | 7 // WEEK
  | 8 // WEEKDAY
  | 9 // DAY_OF_YEAR
  | 10 // QUARTER
  | 11 // ISO_WEEK
  | 12 // ISO_WEEKDAY
  | 13 // WEEK_YEAR
  | 14 // ISO_WEEK_YEAR
  | 15 // DAY
  | -1; // INVALID_UNIT

// -------------------------------------------------------------------------
// Format token system
// -------------------------------------------------------------------------

export type FormatToken =
  | "YYYY"
  | "YY"
  | "Y"
  | "YYYYY"
  | "YYYYYY"
  | "GGGGG"
  | "GGGG"
  | "GGG"
  | "GG"
  | "G"
  | "ggggg"
  | "gggg"
  | "ggg"
  | "gg"
  | "g"
  | "Q"
  | "Qo"
  | "M"
  | "MM"
  | "MMM"
  | "MMMM"
  | "Mo"
  | "D"
  | "DD"
  | "Do"
  | "do"
  | "d"
  | "dd"
  | "ddd"
  | "dddd"
  | "e"
  | "E"
  | "w"
  | "ww"
  | "wo"
  | "W"
  | "WW"
  | "Wo"
  | "DDDo"
  | "DDD"
  | "DDDD"
  | "H"
  | "HH"
  | "h"
  | "hh"
  | "k"
  | "kk"
  | "m"
  | "mm"
  | "s"
  | "ss"
  | "S"
  | "SS"
  | "SSS"
  | "SSSS"
  | "SSSSS"
  | "SSSSSS"
  | "SSSSSSS"
  | "SSSSSSSS"
  | "SSSSSSSSS"
  | "Z"
  | "ZZ"
  | "z"
  | "zz"
  | "t"
  | "tt"
  | "A"
  | "a"
  | "hmm"
  | "hmmss"
  | "Hmm"
  | "Hmmss"
  | "N"
  | "NN"
  | "NNN"
  | "NNNN"
  | "NNNNN"
  | "y"
  | "yy"
  | "yyy"
  | "yyyy"
  | "yo"
  | "X"
  | "x";

// -------------------------------------------------------------------------
// Locale system
// -------------------------------------------------------------------------

export type LocaleLongDateFormatKey =
  | "LT"
  | "LTS"
  | "L"
  | "LL"
  | "LLL"
  | "LLLL"
  | "lt"
  | "lts"
  | "l"
  | "ll"
  | "lll"
  | "llll";

export type LocaleRelativeTimeKey =
  | "s"
  | "ss"
  | "m"
  | "mm"
  | "h"
  | "hh"
  | "d"
  | "dd"
  | "w"
  | "ww"
  | "M"
  | "MM"
  | "y"
  | "yy";

export type LocaleWeekdayFormatKey =
  | "short"
  | "min"
  | "format"
  | "shortFormat"
  | "minFormat"
  | undefined;

// -------------------------------------------------------------------------
// Parsing system
// -------------------------------------------------------------------------

export type ParserMode = "ISO" | "RFC_2822" | "JSON" | "FORMAT" | "ARRAY" | "OBJECT" | "FALLBACK";

// -------------------------------------------------------------------------
// Relative time
// -------------------------------------------------------------------------

// boolean: true = use default (Math.round), false = disable rounding
export type RelTimeRoundingFn = ((n: number) => number) | boolean;

export type RelTimeThresholdKey = "ss" | "s" | "m" | "h" | "d" | "w" | "M";

// All keys used in locale relativeTime blocks
export type RelTimeKey =
  | RelTimeThresholdKey
  | "future"
  | "past"
  | "mm"
  | "hh"
  | "dd"
  | "ww"
  | "MM"
  | "yy"
  | "ss"
  | "m"
  | "h"
  | "d"
  | "w"
  | "M"
  | "y";

// -------------------------------------------------------------------------
// Overflows / validation
// -------------------------------------------------------------------------

export type OverflowField = "year" | "month" | "day" | "hour" | "minute" | "second" | "millisecond";

// -------------------------------------------------------------------------
// Branded internal types (zero-cost at runtime)
// -------------------------------------------------------------------------

declare const __normalizedUnit: unique symbol;
export type NormalizedUnitBrand = string & { [__normalizedUnit]: true };

declare const __unitAlias: unique symbol;
export type UnitAliasBrand = string & { [__unitAlias]: true };

declare const __ordHour: unique symbol;
declare const __ordMinute: unique symbol;
declare const __ordSecond: unique symbol;
declare const __ordMs: unique symbol;
declare const __ordDate28: unique symbol;

/** 0–23 */
export type OrdinaryHour = number & { [__ordHour]: true };
/** 0–59 */
export type OrdinaryMinute = number & { [__ordMinute]: true };
/** 0–59 */
export type OrdinarySecond = number & { [__ordSecond]: true };
/** 0–999 */
export type OrdinaryMillisecond = number & { [__ordMs]: true };
/** 1–28 (safe for all months) */
export type OrdinaryDate28 = number & { [__ordDate28]: true };

// -------------------------------------------------------------------------
// Refined internal state types (zero-cost at runtime)
// -------------------------------------------------------------------------

/** Local time, fields + t both fresh, p.d present */
export interface LocalDCClean {
  dirty: false;
  _tStale: false;
  isUTC: false;
  d: Date;
  offset: number;
}

/** Local time, fields fresh, t stale, no Date object */
export interface LocalNDClean {
  dirty: false;
  _tStale: true;
  isUTC: false;
  d: undefined;
}

/** UTC mode, fields fresh */
export interface UTCClean {
  dirty: false;
  isUTC: true;
}

/** Dirty — fields stale, must refresh from Date before reading */
export interface DirtyState {
  dirty: true;
}

// -------------------------------------------------------------------------
// Parsed data shape (internal)
// -------------------------------------------------------------------------

export interface InternalParsedData {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  isoWeek?: number;
  isoWeekYear?: number;
  isoWeekday?: number;
  dayOfYear?: number;
  quarter?: number;
  week?: number;
  weekYear?: number;
  weekday?: number;
  offset?: number;
  amp?: string;
  _weekdayNum?: number;
  _week?: number;
  _weekYear?: number;
  _unusedTokens?: string[];
  _unusedInput?: string[];
  _charsLeftOver?: number;
  _empty?: boolean;
  _invalidMonth?: string | null;
  _weekdayMismatch?: boolean;
  _parsedDateParts?: number[];
  _meridiem?: string;
  _claimed?: boolean;
  _hasDate?: boolean;
  _hasTime?: boolean;
  _iso?: boolean;
  _rfc2822?: boolean;
  _nullInput?: boolean;
  _invalidFormat?: boolean;
  _userInvalidated?: boolean;
  _isParseZone?: boolean;
  _bigHour?: boolean;
  _eraYear?: number;
  _era?: unknown;
  _f?: string;
  _useConstructor?: boolean;
  _localeWeekday?: number;
  _weekdayName?: string;
  overflow?: number;
}

// -------------------------------------------------------------------------
// Locale cache interface — fields attached at runtime to parser's locale
// -------------------------------------------------------------------------

export interface CachedParseLocale {
  _abbr?: string;
  _config: Record<string, unknown>;
  preparse(str: string): string;
  months(): string[] | string;
  monthsShort(): string[] | string;
  longDateFormat(key: string): string;
  meridiemParse(): RegExp | undefined;
  isPM(input: string): boolean;
  // Runtime caches populated by parse helpers (zero-cost, attached once):
  _monthsCache?: string[];
  _monthsStrictRegex?: RegExp;
  _monthsRegex?: RegExp;
  _monthsShortCache?: string[];
  _monthsShortStrictRegex?: RegExp;
  _monthsShortRegex?: RegExp;
  _weekdaysCache?: string[];
  _weekdaysRegex?: RegExp;
  _weekdaysShortCache?: string[];
  _weekdaysShortRegex?: RegExp;
  _weekdaysMinCache?: string[];
  _weekdaysMinRegex?: RegExp;
}
