/**
 * Postbuild script: override auto-generated .d.ts with moment.js-compatible types.
 *
 * tsup's dts:true generates minified/obfuscated type files. These work mechanically
 * but don't provide the full moment.js API surface that consumers expect.
 *
 * We replace the main entry point .d.ts files with moment.js's own moment.d.ts
 * (plus mmntjs-specific extensions). Locale/plugin .d.ts files are left as-is
 * (tsup's output is sufficient for those).
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");
const distDir = join(projectRoot, "dist");

const MOMENT_DTS = join(projectRoot, "moment", "moment.d.ts");

const MOMENT_TZ_DTS = join(projectRoot, "node_modules", "moment-timezone", "index.d.ts");
const TZ_DIST_DIR = join(projectRoot, "packages", "timezone", "dist");

/* ------------------------------------------------------------------ */
/*  mmntjs main package                                               */
/* ------------------------------------------------------------------ */

// Extension to append after moment.d.ts content
const MMNTJS_EXTENSION = `
/* ------------------------------------------------------------------ */
/*  mmntjs-specific extensions                                        */
/* ------------------------------------------------------------------ */

declare namespace moment {
  /**
   * Convert a Temporal object back to a Moment.
   * Supports PlainDate, ZonedDateTime, PlainDateTime, PlainTime.
   */
  function fromTemporal(t: unknown): moment.Moment;

  interface MomentStatic {
    fromTemporal(t: unknown): moment.Moment;
  }
}

interface Moment {
  /**
   * Convert this Moment to a Temporal object.
   * Returns PlainDate if no time/offset, otherwise ZonedDateTime.
   */
  toTemporal(): unknown;
}
`;

function copyMomentDts(src: string, dest: string): void {
  const content = readFileSync(src, "utf-8");
  // Replace the base export with one that adds Temporal types
  const modified = content.replace(
    "export = moment;",
    "export = moment;\n" + MMNTJS_EXTENSION,
  );
  writeFileSync(dest, modified);
}

function createLiteDts(dest: string): void {
  // Lite subset: function overloads + essential types only
  const content = `/**
 * mmntjs/lite — minimal moment.js-compatible type declarations.
 */
declare function moment(inp?: moment.MomentInput, strict?: boolean): moment.Moment;
declare function moment(inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, strict?: boolean): moment.Moment;

declare namespace moment {
  type MomentInput = string | number | Date | number[] | Moment | null | undefined;
  type MomentFormatSpecification = string | string[];

  interface Moment extends MomentObject {
    format(format?: string): string;
    toString(): string;
    toDate(): Date;
    toISOString(keepOffset?: boolean): string;
    isValid(): boolean;
    invalidAt(): number;
    isLeapYear(): boolean;

    get(unit: string): number;
    set(unit: string, value: number): this;
    set(objectLiteral: Record<string, number>): this;

    add(amount: number, unit: string): this;
    add(duration: Duration): this;
    subtract(amount: number, unit: string): this;
    subtract(duration: Duration): this;

    startOf(unit: string): this;
    endOf(unit: string): this;

    unix(): number;
    valueOf(): number;

    year(): number;
    year(y: number): this;
    month(): number;
    month(m: number): this;
    date(): number;
    date(d: number): this;
    hour(): number;
    hour(h: number): this;
    minute(): number;
    minute(m: number): this;
    second(): number;
    second(s: number): this;
    millisecond(): number;
    millisecond(ms: number): this;

    day(): number;
    day(d: number): this;
    dayOfYear(): number;
    dayOfYear(d: number): this;
    week(): number;
    week(w: number): this;
    weekYear(): number;
    weekYear(w: number): this;
    weekday(): number;
    weekday(w: number): this;
    isoWeekday(): number;
    isoWeekday(w: number): this;
    isoWeek(): number;
    isoWeek(w: number): this;
    isoWeekYear(): number;
    isoWeekYear(w: number): this;

    diff(b: MomentInput, unit?: string, precise?: boolean): number;

    clone(): Moment;
    toArray(): number[];
    toObject(): Record<string, number>;
  }

  interface MomentObject {
    _isAMomentObject: boolean;
    _i: unknown;
    _f: unknown;
    _l: unknown;
    _isUTC: boolean;
    _offset: number;
    _d: Date;
    _isValid: boolean;
  }

  interface Duration {
    humanize(withSuffix?: boolean): string;
    milliseconds(): number;
    asMilliseconds(): number;
    seconds(): number;
    asSeconds(): number;
    minutes(): number;
    asMinutes(): number;
    hours(): number;
    asHours(): number;
    days(): number;
    asDays(): number;
    weeks(): number;
    asWeeks(): number;
    months(): number;
    asMonths(): number;
    years(): number;
    asYears(): number;
    valueOf(): number;
    _data: DurationData;
    toISOString(): string;
    isValid(): boolean;
  }

  interface DurationData {
    years: number;
    months: number;
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
  }

  function duration(inp?: DurationInput, unit?: string): Duration;

  type DurationInput = number | string | Duration | DurationObject | DurationInput[];
  interface DurationObject {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
  }

  export var ISO_8601: string;
  export var version: string;

  function utc(inp?: MomentInput, format?: MomentFormatSpecification, strict?: boolean): Moment;
  function unix(timestamp: number): Moment;
  function invalid(): Moment;

  var fn: Moment;
}

export = moment;
`;
  writeFileSync(dest, content);
}

function createTemporalEntryDts(dest: string): void {
  const content = `/**
 * mmntjs/temporal — Temporal bridge declarations.
 */
import { Moment } from "./index";

export function toTemporal(m: Moment): unknown;
export function fromTemporal(t: unknown): Moment;
export type { Temporal } from "@js-temporal/polyfill";
`;
  writeFileSync(dest, content);
}

/* ------------------------------------------------------------------ */
/*  mmntjs-timezone package                                           */
/* ------------------------------------------------------------------ */

function createTimezoneDts(dest: string): void {
  // Based on moment-timezone/index.d.ts (DefinitelyTyped-derived, MIT),
  // adapted for mmntjs module augmentation and mmntjs-timezone capabilities.
  const content = `// Type declarations for mmntjs-timezone
// Based on moment-timezone types (DefinitelyTyped, MIT)

import moment = require("mmntjs");

declare module "mmntjs" {
  interface MomentZone {
    name: string;
    abbr(timestamp: number): string;
    offset(timestamp: number): number;
    utcOffset(timestamp: number): number;
    parse(timestamp: number): number;
  }

  interface MomentTimezone {
    (timezone?: string): moment.Moment;
    (input: moment.MomentInput, timezone: string): moment.Moment;
    (input: string, format: moment.MomentFormatSpecification, timezone: string): moment.Moment;
    (input: string, format: moment.MomentFormatSpecification, strict: boolean, timezone: string): moment.Moment;

    zone(timezone: string): MomentZone | null;
    names(): string[];
    guess(ignoreCache?: boolean): string;
    setDefault(timezone?: string): typeof moment;

    add(data: unknown): void;
    link(links: unknown): void;
    countries(): string[];
    zonesForCountry(country: string, withOffset?: boolean): string[];
  }

  interface Moment {
    tz(): string | undefined;
    tz(timezone: string, keepLocalTime?: boolean): moment.Moment;
    zoneAbbr(): string;
    zoneName(): string;
  }

  const tz: MomentTimezone;
}

export = moment;
`;
  mkdirSync(TZ_DIST_DIR, { recursive: true });
  writeFileSync(dest, content);
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

function main(): void {
  // 1. Copy moment.d.ts → dist/index.d.ts + extensions
  console.log("[copy-dts] Copying moment.d.ts → dist/index.d.ts");
  copyMomentDts(MOMENT_DTS, join(distDir, "index.d.ts"));

  // 2. Copy index.d.ts → dist/full.d.ts
  console.log("[copy-dts] Copying dist/index.d.ts → dist/full.d.ts");
  copyFileSync(join(distDir, "index.d.ts"), join(distDir, "full.d.ts"));

  // 3. Create dist/lite.d.ts
  console.log("[copy-dts] Creating dist/lite.d.ts");
  createLiteDts(join(distDir, "lite.d.ts"));

  // 4. Create dist/temporal-entry.d.ts
  console.log("[copy-dts] Creating dist/temporal-entry.d.ts");
  createTemporalEntryDts(join(distDir, "temporal-entry.d.ts"));

  // 5. Create mmntjs-timezone dist/index.d.ts
  console.log("[copy-dts] Creating packages/timezone/dist/index.d.ts");
  createTimezoneDts(join(TZ_DIST_DIR, "index.d.ts"));

  // Also copy for CJS path
  console.log("[copy-dts] Creating packages/timezone/dist/index.d.cts");
  copyFileSync(join(TZ_DIST_DIR, "index.d.ts"), join(TZ_DIST_DIR, "index.d.cts"));
}

main();
