import { Moment, checkOverflow } from "../moment-class";
import { getLocale, getCurrentLocale, localeHasMissingParent } from "../locale-runtime";
import type { ParseLocale } from "../parse-locale";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedDataLike = Record<string, any>;

type FormatDeps = {
  parseString: (str: string, format?: string | string[], locale?: ParseLocale, strict?: boolean) => ParsedDataLike | null;
  isCustomFormatParsingEnabled: () => boolean;
};

type FormatArgs = {
  str: string;
  format?: unknown;
  localeOrStrict?: unknown;
  fourthArg?: unknown;
  deps: FormatDeps;
  createMomentFromParsed: (parsed: ParsedDataLike, str?: string, format?: string, locale?: string, strict?: boolean) => Moment;
};

function hasAnyValue(parsed: ParsedDataLike): boolean {
  return parsed.year !== undefined || parsed.month !== undefined || parsed.day !== undefined || parsed.hour !== undefined || parsed.minute !== undefined || parsed.second !== undefined || parsed.millisecond !== undefined || parsed.isoWeek !== undefined || parsed.isoWeekYear !== undefined || parsed.dayOfYear !== undefined || parsed.quarter !== undefined || parsed._week !== undefined || parsed._weekYear !== undefined || parsed._weekdayNum !== undefined;
}

function scoreParsedResult(parsed: ParsedDataLike): number {
  let score = 0;
  if (parsed.year !== undefined) {score += 10;}
  if (parsed.month !== undefined) {score += 10;}
  if (parsed.day !== undefined) {score += 10;}
  if (parsed.hour !== undefined) {score += 3;}
  if (parsed.minute !== undefined) {score += 2;}
  if (parsed.second !== undefined) {score += 1;}
  if (parsed.millisecond !== undefined) {score += 1;}
  return score;
}

function createInvalidParsedMoment(str: string, format: string | string[] | undefined, locale: string | undefined, strict: boolean, parsed: ParsedDataLike): Moment {
  return new Moment({ _d: new Date(NaN), _i: str, _f: format, _l: locale, _strict: strict, _isValid: false, _unusedTokens: parsed._unusedTokens, _unusedInput: parsed._unusedInput, _charsLeftOver: parsed._charsLeftOver, _empty: parsed._empty, _invalidMonth: parsed._invalidMonth, _weekdayMismatch: parsed._weekdayMismatch, _parsedDateParts: parsed._parsedDateParts, _meridiem: parsed._meridiem });
}

export function createFromFormattedStringInput(args: FormatArgs): Moment {
  const { str, format, localeOrStrict, fourthArg, deps, createMomentFromParsed } = args;
  let strict = false;
  let locale: string | undefined;
  let fmt: string | string[] | undefined;
  const formatParsingEnabled = deps.isCustomFormatParsingEnabled();
  if (typeof format === "boolean") { strict = format; }
  else if (typeof localeOrStrict === "boolean") { fmt = format as string | string[] | undefined; strict = localeOrStrict; }
  else {
    fmt = format as string | string[] | undefined;
    if (typeof localeOrStrict === "string") {
      locale = localeOrStrict;
      if (locale && localeHasMissingParent(locale)) {locale = "en";}
    }
    if (typeof fourthArg === "boolean") {strict = fourthArg;}
  }
  if (Array.isArray(fmt)) {
    const parseLocale = getLocale(locale ?? getCurrentLocale()) as unknown as ParseLocale;
    let bestParsed: ParsedDataLike | null = null;
    let bestScore = -99999;
    let bestFormat: string | undefined;
    for (const singleFmt of fmt) {
      if (singleFmt === "ISO_8601" || singleFmt === "RFC_2822") {
        const parsed = deps.parseString(str, undefined, parseLocale);
        if (parsed && hasAnyValue(parsed)) {
          let score = scoreParsedResult(parsed) + 30;
          if (parsed._empty === true) {score -= 50;}
          if (checkOverflow(parsed) >= 0) {score -= 100;}
          if (score > bestScore) {bestParsed = parsed; bestScore = score; bestFormat = singleFmt;}
        }
        continue;
      }
      if (!formatParsingEnabled) {continue;}
      const parsed = deps.parseString(str, singleFmt, parseLocale, strict);
      if (!parsed) {continue;}
      const hasValue = hasAnyValue(parsed);
      let score = scoreParsedResult(parsed) + 30;
      if (checkOverflow(parsed) >= 0) {score -= 100;}
      if (parsed._empty === true) {score -= 50;}
      if ((parsed._unusedTokens?.length ?? 0) > 0) {score -= 10 * (parsed._unusedTokens?.length ?? 0);}
      if ((parsed._charsLeftOver ?? 0) > 0) {score -= (parsed._charsLeftOver ?? 0) * 3;}
      if ((parsed._unusedInput?.length ?? 0) > 0) {score -= (parsed._unusedInput ?? []).reduce((a: number, s: string) => a + s.length, 0) * 2;}
      if (hasValue && (score > bestScore || (score === bestScore && bestFormat && singleFmt.length < bestFormat.length))) {
        bestParsed = parsed;
        bestScore = score;
        bestFormat = singleFmt;
      }
    }
    if (bestParsed && hasAnyValue(bestParsed)) {
      const overflow = checkOverflow(bestParsed);
      if (overflow < 0) {
        if (strict && (((bestParsed._unusedTokens?.length ?? 0) > 0) || ((bestParsed._charsLeftOver ?? 0) > 0))) {
          return createInvalidParsedMoment(str, bestFormat, locale, strict, bestParsed);
        }
        const m = createMomentFromParsed(bestParsed, str, bestFormat as string, locale, strict);
        m._f = bestFormat;
        return m;
      }
      return new Moment({ _d: new Date(NaN), _i: str, _f: bestFormat, _l: locale, _strict: strict, _isValid: false, _overflow: overflow });
    }
    return new Moment({ _d: new Date(NaN), _i: str, _f: fmt, _l: locale, _strict: strict, _isValid: false, _invalidFormat: fmt.length === 0 });
  }
  if (fmt === "ISO_8601" || fmt === "RFC_2822") {
    const parsed = deps.parseString(str, undefined, getLocale(locale ?? getCurrentLocale()) as unknown as ParseLocale);
    if (parsed && hasAnyValue(parsed) && checkOverflow(parsed) < 0) {return createMomentFromParsed(parsed, str, fmt, locale, strict);}
    return new Moment({ _dClone: false, _d: new Date(NaN), _i: str, _f: fmt, _l: locale, _strict: strict, _isValid: false });
  }
  if (fmt) {
    if (!formatParsingEnabled) {return new Moment({ _dClone: false, _d: new Date(NaN), _i: str, _f: fmt, _l: locale, _strict: strict, _isValid: false });}
    const parsed = deps.parseString(str, fmt, getLocale(locale ?? getCurrentLocale()) as unknown as ParseLocale, strict);
    if (parsed && hasAnyValue(parsed) && checkOverflow(parsed) < 0) {return createMomentFromParsed(parsed, str, fmt, locale, strict);}
    return new Moment({ _d: new Date(NaN), _i: str, _f: fmt, _l: locale, _strict: strict, _isValid: false });
  }
  return new Moment({ _dClone: false, _d: new Date(NaN), _i: str, _isValid: false });
}
