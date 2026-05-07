import fs from "node:fs";
import { walkSourceFiles } from "./walk-source-files";

const NEVER_MOMENT = new Set([
  "toBe", "toEqual", "toStrictEqual", "toContain", "toHaveLength",
  "toBeDefined", "toBeUndefined", "toBeNull", "toBeNaN", "toBeTruthy",
  "toBeFalsy", "toMatch", "toThrow", "toThrowError",
  "toBeGreaterThan", "toBeGreaterThanOrEqual", "toBeLessThan", "toBeLessThanOrEqual",
  "toBeCloseTo", "resolves", "rejects", "not",
  "forEach", "map", "filter", "reduce", "find", "push", "pop",
  "split", "trim", "replace", "match", "charAt",
  "toLowerCase", "toUpperCase", "toLocaleLowerCase", "toLocaleUpperCase",
  "getTime", "getFullYear", "getMonth", "getDate", "getDay",
  "getHours", "getMinutes", "getSeconds", "getMilliseconds",
  "getUTCFullYear", "getUTCMonth", "getUTCDate", "getUTCDay",
  "getUTCHours", "getUTCMinutes", "getUTCSeconds", "getUTCMilliseconds",
  "setTime", "setFullYear", "setMonth", "setDate",
  "setHours", "setMinutes", "setSeconds", "setMilliseconds",
  "log", "warn", "error", "info",
  "toFixed", "apply", "call", "bind",
  "padStart", "padEnd", "startsWith", "endsWith",
  "UTC", "isUtc", "relativeTimeIncludeWeeks",
]);

const TEMPORAL_READY = new Set([
  "format", "add", "subtract", "diff", "clone",
  "isBefore", "isAfter", "isSame", "isSameOrBefore", "isSameOrAfter", "isBetween",
  "year", "month", "date", "day", "hour", "minute", "second", "millisecond",
  "weekday", "isoWeekday", "dayOfYear", "week", "isoWeek",
  "weekYear", "isoWeekYear", "quarter", "daysInMonth",
  "startOf", "endOf", "isValid", "isLeapYear", "isDST",
  "valueOf", "unix", "toISOString", "toJSON", "toDate",
  "from", "fromNow", "to", "toNow", "calendar",
  "years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds",
  "get",
]);

export interface MomentUsageSummary {
  apiCounts: Record<string, number>;
  totalUsages: number;
  temporalReady: number;
}

export function scanMomentUsages(dir = "."): MomentUsageSummary {
  const apiCounts: Record<string, number> = {};
  let totalUsages = 0;

  walkSourceFiles(dir, (p) => {
    const content = fs.readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        if (!/\bmoment\b/.test(line)) {continue;}

        const ctorMatch = line.match(/\bmoment\s*\(/g);
        if (ctorMatch) {
          apiCounts["moment()"] = (apiCounts["moment()"] || 0) + ctorMatch.length;
          totalUsages += ctorMatch.length;
        }

        for (const m of line.matchAll(/\bmoment\s*\.\s*(\w+)\s*\(/g)) {
          apiCounts[m[1]] = (apiCounts[m[1]] || 0) + 1;
          totalUsages++;
        }

        const afterMoment = line.split(/\bmoment\b/).slice(1).join(" ");
        for (const m of afterMoment.matchAll(/\.\s*(\w+)\s*\(/g)) {
          if (NEVER_MOMENT.has(m[1])) {continue;}
          apiCounts[`.${m[1]}`] = (apiCounts[`.${m[1]}`] || 0) + 1;
          totalUsages++;
        }
      }
  });

  const temporalReady = Object.entries(apiCounts)
    .filter(([api]) => {
      const name = api.startsWith(".") ? api.slice(1) : api;
      return TEMPORAL_READY.has(name) || name === "moment()";
    })
    .reduce((sum, [, count]) => sum + count, 0);

  return { apiCounts, totalUsages, temporalReady };
}
