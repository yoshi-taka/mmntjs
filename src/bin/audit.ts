import fs from "node:fs";
import path from "node:path";
import { walkSourceFiles } from "./walk-source-files";

const NEVER_MOMENT = new Set([
  "toBe",
  "toEqual",
  "toStrictEqual",
  "toContain",
  "toContainEqual",
  "toHaveLength",
  "toHaveProperty",
  "toBeDefined",
  "toBeUndefined",
  "toBeNull",
  "toBeNaN",
  "toBeTruthy",
  "toBeFalsy",
  "toMatch",
  "toMatchObject",
  "toThrow",
  "toThrowError",
  "toBeGreaterThan",
  "toBeGreaterThanOrEqual",
  "toBeLessThan",
  "toBeLessThanOrEqual",
  "toBeCloseTo",
  "resolves",
  "rejects",
  "not",
  "forEach",
  "map",
  "filter",
  "reduce",
  "find",
  "findIndex",
  "some",
  "every",
  "includes",
  "indexOf",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "slice",
  "concat",
  "join",
  "sort",
  "reverse",
  "split",
  "trim",
  "replace",
  "match",
  "search",
  "charAt",
  "charCodeAt",
  "padStart",
  "padEnd",
  "startsWith",
  "endsWith",
  "toLowerCase",
  "toUpperCase",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "getTime",
  "getFullYear",
  "getMonth",
  "getDate",
  "getDay",
  "getHours",
  "getMinutes",
  "getSeconds",
  "getMilliseconds",
  "getUTCFullYear",
  "getUTCMonth",
  "getUTCDate",
  "getUTCDay",
  "getUTCHours",
  "getUTCMinutes",
  "getUTCSeconds",
  "getUTCMilliseconds",
  "setTime",
  "setFullYear",
  "setMonth",
  "setDate",
  "setHours",
  "setMinutes",
  "setSeconds",
  "setMilliseconds",
  "log",
  "warn",
  "error",
  "info",
  "debug",
  "toFixed",
  "apply",
  "call",
  "bind",
  "isUtc",
  "UTC",
  "relativeTimeIncludeWeeks",
]);

const KNOWN_MOMENT_STATICS = [
  "utc",
  "parseZone",
  "unix",
  "invalid",
  "locale",
  "localeData",
  "lang",
  "langData",
  "defineLocale",
  "updateLocale",
  "locales",
  "months",
  "monthsShort",
  "weekdays",
  "weekdaysShort",
  "weekdaysMin",
  "normalizeUnits",
  "min",
  "max",
  "now",
  "duration",
  "relativeTimeRounding",
  "relativeTimeThreshold",
  "fn",
  "suppressDeprecationWarnings",
  "deprecationHandler",
  "version",
  "defaultFormat",
  "defaultFormatUtc",
  "createFromInputFallback",
  "isDuration",
  "isMoment",
  "isDate",
  "normalizeUnits",
];

const KNOWN_MOMENT_INSTANCE = [
  "format",
  "add",
  "subtract",
  "diff",
  "clone",
  "isBefore",
  "isAfter",
  "isSame",
  "isSameOrBefore",
  "isSameOrAfter",
  "isBetween",
  "isValid",
  "isLeapYear",
  "isDST",
  "isUTC",
  "isLocal",
  "isUtcOffset",
  "year",
  "month",
  "date",
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "weekday",
  "isoWeekday",
  "dayOfYear",
  "week",
  "isoWeek",
  "weekYear",
  "isoWeekYear",
  "weeksInYear",
  "isoWeeksInYear",
  "quarter",
  "daysInMonth",
  "startOf",
  "endOf",
  "valueOf",
  "unix",
  "toISOString",
  "toJSON",
  "toDate",
  "toArray",
  "toObject",
  "toString",
  "locale",
  "localeData",
  "get",
  "set",
  "max",
  "min",
  "utc",
  "local",
  "utcOffset",
  "parseZone",
  "zone",
  "lang",
  "from",
  "to",
  "calendar",
  "creationData",
  "parsingFlags",
  "inspect",
  // Duration methods
  "as",
  "asMilliseconds",
  "asSeconds",
  "asMinutes",
  "asHours",
  "asDays",
  "asWeeks",
  "asMonths",
  "asQuarters",
  "asYears",
  "humanize",
  "toISOString",
  "toJSON",
  "toIsoString",
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "get",
  "_milliseconds",
  // Locale methods
  "firstDayOfWeek",
  "firstDayOfYear",
  // Display methods
  "from",
  "fromNow",
  "to",
  "toNow",
  // Zone methods
  "zoneAbbr",
  "zoneName",
  "hasAlignedHourOffset",
  // Others
  "invalidAt",
  "isDuration",
  "isMoment",
  "isDate",
  "isoWeeks",
  "weeksInWeekYear",
  "isoWeeksInISOWeekYear",
];

function knownApis(): Set<string> {
  const s = new Set(KNOWN_MOMENT_STATICS);
  for (const m of KNOWN_MOMENT_INSTANCE) {
    s.add(m);
  }
  return s;
}

export function runAudit(dir = ".") {
  console.log(`\nAuditing moment usages in ${path.resolve(dir)}...\n`);

  const known = knownApis();
  let totalLines = 0;
  let constructorCalls = 0;
  let staticMethodCalls = 0;
  let chainMethodCalls = 0;
  let unrecognizedCalls = 0;
  const unrecognized = new Set<string>();
  const unrecognizedLines: string[] = [];

  walkSourceFiles(dir, (p) => {
    const content = fs.readFileSync(p, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/\bmoment\b/.test(line)) {
        continue;
      }

      totalLines++;

      const ctorMatches = line.match(/\bmoment\s*\(/g);
      if (ctorMatches) {
        constructorCalls += ctorMatches.length;
      }

      const staticMatches = line.matchAll(/\bmoment\s*\.\s*(\w+)\s*\(/g);
      for (const m of staticMatches) {
        staticMethodCalls++;
        if (!known.has(m[1])) {
          unrecognized.add(m[1]);
          unrecognizedCalls++;
          unrecognizedLines.push(`${p}:${i + 1} — moment.${m[1]}()`);
        }
      }

      const afterMoment = line
        .split(/\bmoment\b/)
        .slice(1)
        .join(" ");
      const chainMatches = afterMoment.matchAll(/\.\s*(\w+)\s*\(/g);
      for (const m of chainMatches) {
        if (NEVER_MOMENT.has(m[1])) {
          continue;
        }
        chainMethodCalls++;
        if (!known.has(m[1])) {
          unrecognized.add(m[1]);
          unrecognizedCalls++;
          unrecognizedLines.push(`${p}:${i + 1} — .${m[1]}()`);
        }
      }

      if (line.includes("Object.freeze(")) {
        unrecognizedLines.push(`${p}:${i + 1} — Object.freeze() on moment instance`);
      }
    }
  });

  const totalCalls = constructorCalls + staticMethodCalls + chainMethodCalls;
  const recognizedCalls = totalCalls - unrecognizedCalls;
  const confidence = totalCalls > 0 ? Math.round((recognizedCalls / totalCalls) * 100) : 100;

  console.log(`  moment():         ${constructorCalls}`);
  console.log(`  moment.xxx():      ${staticMethodCalls}`);
  console.log(`  .xxx() chain:    ${chainMethodCalls}`);
  console.log(`  ───────────────────────`);
  console.log(`  Total usages:      ${totalCalls}`);
  console.log(`  Recognized calls:   ${recognizedCalls} / ${totalCalls}`);
  console.log(`  Confidence:        ${confidence}%`);

  if (unrecognized.size > 0) {
    console.log(`\n  Unrecognized API(s): ${[...unrecognized].join(", ") || "(none)"}`);
  }

  if (unrecognizedLines.length > 0) {
    console.log(`\n  Details:`);
    for (const detail of unrecognizedLines) {
      console.log(`    - ${detail}`);
    }
  }

  console.log();
}
