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

export type OutputFormat = "text" | "markdown";

interface AuditData {
  totalLines: number;
  constructorCalls: number;
  staticMethodCalls: number;
  chainMethodCalls: number;
  unrecognizedCalls: number;
  unrecognized: Set<string>;
  unrecognizedLines: string[];
  totalCalls: number;
  recognizedCalls: number;
  confidence: number;
}

function collectAuditData(dir: string): AuditData {
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

  return {
    totalLines,
    constructorCalls,
    staticMethodCalls,
    chainMethodCalls,
    unrecognizedCalls,
    unrecognized,
    unrecognizedLines,
    totalCalls,
    recognizedCalls,
    confidence,
  };
}

function printTextAudit(d: AuditData): void {
  console.log(`  moment():         ${d.constructorCalls}`);
  console.log(`  moment.xxx():      ${d.staticMethodCalls}`);
  console.log(`  .xxx() chain:    ${d.chainMethodCalls}`);
  console.log(`  ───────────────────────`);
  console.log(`  Total usages:      ${d.totalCalls}`);
  console.log(`  Recognized calls:   ${d.recognizedCalls} / ${d.totalCalls}`);
  console.log(`  Confidence:        ${d.confidence}%`);

  if (d.unrecognized.size > 0) {
    console.log(`\n  Unrecognized API(s): ${[...d.unrecognized].join(", ") || "(none)"}`);
  }

  if (d.unrecognizedLines.length > 0) {
    console.log(`\n  Details:`);
    for (const detail of d.unrecognizedLines) {
      console.log(`    - ${detail}`);
    }
  }

  console.log();
}

function printMarkdownAudit(d: AuditData, dir: string): void {
  const unknownList = [...d.unrecognized].sort();
  const unknownDetail = d.unrecognizedLines;

  console.log(`# Moment.js Usage Audit

## Summary

- **Directory:** \`${dir}\`
- **Files containing moment:** ${d.totalLines}
- **Total moment usages:** ${d.totalCalls}
- **Recognized:** ${d.recognizedCalls} / ${d.totalCalls} (${d.confidence}%)
- **Unknown:** ${d.unrecognizedCalls}

## Call Breakdown

| Category | Count |
|----------|-------|
| \`moment()\` constructor | ${d.constructorCalls} |
| \`moment.xxx()\` static | ${d.staticMethodCalls} |
| \`.xxx()\` chain | ${d.chainMethodCalls} |

${
  unknownList.length > 0
    ? `## Unknown APIs

The following APIs were not recognized and may require manual review:

| API | Occurrences |
|-----|-------------|
${unknownList.map((api) => `| \`${api}\` | ${unknownDetail.filter((l) => l.includes(api)).length} |`).join("\n")}

### Locations

${unknownDetail.map((l) => `- ${l}`).join("\n")}
`
    : `## Result

All moment.js usages are recognized. Migration is safe.
`
}

## Confidence Score

${d.confidence >= 90 ? "✅ **High** — The vast majority of moment.js APIs are recognized." : d.confidence >= 70 ? "⚠️ **Medium** — Some APIs need manual verification before migration." : "❌ **Low** — Significant manual review required before migration."}
`);
}

export function runAudit(format: OutputFormat, dir = ".") {
  const resolvedDir = path.resolve(dir);
  const d = collectAuditData(resolvedDir);

  if (format === "markdown") {
    printMarkdownAudit(d, dir);
  } else {
    console.log(`\nAuditing moment usages in ${resolvedDir}...\n`);
    printTextAudit(d);
  }
}
