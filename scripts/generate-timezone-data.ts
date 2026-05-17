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

/* ------------------------------------------------------------------ */
/*  collect original packed zone strings (base-60 encoded)            */
/*  → runtime will unpack lazily via install.ts :: un pack()          */
/* ------------------------------------------------------------------ */

const zones: Record<string, string> = {};
for (const [norm, v] of Object.entries(tz._zones)) {
  if (typeof v !== "string") continue;
  const name = v.split("|")[0];
  zones[name] = v;
}

/* ------------------------------------------------------------------ */
/*  links & countries (flat strings, simple format)                    */
/* ------------------------------------------------------------------ */

const linkPairs = new Set<string>();
for (const [fromNorm, toNorm] of Object.entries(tz._links)) {
  const fromName = tz._names[fromNorm];
  const toName = tz._names[toNorm];
  if (!fromName || !toName || fromName === toName) continue;
  const key = fromName < toName ? `${fromName}|${toName}` : `${toName}|${fromName}`;
  linkPairs.add(key);
}

const countries = Object.entries(tz._countries)
  .map(([code, info]) => `${code}|${info.zones.join(" ")}`)
  .sort();

/* ------------------------------------------------------------------ */
/*  serialize                                                         */
/* ------------------------------------------------------------------ */

const content = `export const BUILTIN_TZDATA:{
  version:string;tzVersion:string;
  zones:Record<string,string>;
  links:string[];countries:string[];
}={
  version:${JSON.stringify(tz.dataVersion ?? "")},
  tzVersion:${JSON.stringify(tz.version ?? "")},
  zones:${JSON.stringify(zones)},
  links:${JSON.stringify([...linkPairs].sort())},
  countries:${JSON.stringify(countries)},
};
`;

mkdirSync(join(projectRoot, "packages", "timezone", "src"), { recursive: true });
writeFileSync(outFile, content);

const zoneBytes = Object.values(zones).reduce((s, v) => s + v.length, 0);
console.log(`[generate-timezone-data] wrote ${outFile}`);
console.log(`  packed zones:  ${(zoneBytes / 1024).toFixed(1)} KB`);
