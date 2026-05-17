import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

type TimezoneLike = {
  tz?: {
    _zones?: Record<string, unknown>;
    _links?: Record<string, string>;
    _names?: Record<string, string>;
    _countries?: Record<string, { name: string; zones: string[] }>;
    version?: string;
    dataVersion?: string;
  };
};

const require = createRequire(import.meta.url);
const projectRoot = join(import.meta.dir, "..");
const outFile = join(projectRoot, "packages", "timezone", "src", "builtin-data.generated.ts");

const momentTimezone = require("moment-timezone/builds/moment-timezone-with-data.js") as TimezoneLike;
const tz = momentTimezone.tz;

if (!tz?._zones || !tz._links || !tz._names || !tz._countries) {
  throw new Error("moment-timezone bundled data was not available for generation");
}

const zones = Object.entries(tz._zones)
  .filter(([, value]) => typeof value === "string")
  .map(([, value]) => value as string)
  .sort();

const linkPairs = new Set<string>();
for (const [fromNorm, toNorm] of Object.entries(tz._links)) {
  const fromName = tz._names[fromNorm];
  const toName = tz._names[toNorm];
  if (!fromName || !toName || fromName === toName) {
    continue;
  }
  const key = fromName < toName ? `${fromName}|${toName}` : `${toName}|${fromName}`;
  linkPairs.add(key);
}

const countries = Object.entries(tz._countries)
  .map(([code, info]) => `${code}|${info.zones.join(" ")}`)
  .sort();

const content = `export const BUILTIN_TIMEZONE_DATA_RAW={version:${JSON.stringify(
  tz.dataVersion ?? "",
)},tzVersion:${JSON.stringify(tz.version ?? "")},zones:${JSON.stringify(zones.join("\n"))},links:${JSON.stringify(
  [...linkPairs].sort().join("\n"),
)},countries:${JSON.stringify(countries.join("\n"))}} as const;
`;

mkdirSync(join(projectRoot, "packages", "timezone", "src"), { recursive: true });
writeFileSync(outFile, content);

console.log(`[generate-timezone-data] wrote ${outFile}`);
