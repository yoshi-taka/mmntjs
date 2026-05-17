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
/*  inline unpack helpers (mirror of install.ts)                       */
/* ------------------------------------------------------------------ */

function charCodeToInt(charCode: number): number {
  if (charCode > 96) return charCode - 87;
  if (charCode > 64) return charCode - 29;
  return charCode - 48;
}

function unpackBase60(input: string): number {
  let i = 0;
  const parts = input.split(".");
  const whole = parts[0] ?? "";
  const fractional = parts[1] ?? "";
  let multiplier = 1;
  let out = 0;
  let sign = 1;
  if (input.charCodeAt(0) === 45) { i = 1; sign = -1; }
  for (; i < whole.length; i++) out = 60 * out + charCodeToInt(whole.charCodeAt(i));
  for (i = 0; i < fractional.length; i++) { multiplier /= 60; out += charCodeToInt(fractional.charCodeAt(i)) * multiplier; }
  return out * sign;
}

function arrayToInt(values: string[]): number[] {
  return values.map((v) => unpackBase60(v));
}

function mapIndices<T>(source: T[], indices: number[]): T[] {
  const out: T[] = new Array(indices.length) as T[];
  for (let i = 0; i < indices.length; i++) out[i] = source[indices[i]];
  return out;
}

function unpackPacked(packed: string): {
  name: string; abbrs: string[]; offsets: number[]; untils: number[]; population: number;
} {
  const data = packed.split("|");
  const offsets = arrayToInt((data[2] ?? "").split(" "));
  const indices = arrayToInt((data[3] ?? "").split(""));
  const untils = arrayToInt((data[4] ?? "").split(" "));
  for (let i = 0; i < indices.length; i++) {
    untils[i] = Math.round((untils[i - 1] || 0) + untils[i] * 60000);
  }
  untils[indices.length - 1] = Number.POSITIVE_INFINITY;
  return {
    name: data[0] ?? "",
    abbrs: mapIndices((data[1] ?? "").split(" "), indices),
    offsets: mapIndices(offsets, indices),
    untils,
    population: Number(data[5] ?? 0) | 0,
  };
}

/* ------------------------------------------------------------------ */
/*  pre-unpack all zones, delta-encode untils                          */
/* ------------------------------------------------------------------ */

const packedZones = Object.entries(tz._zones)
  .filter(([, v]) => typeof v === "string")
  .map(([, v]) => v as string)
  .sort();

interface PrebuiltPayload {
  abbrs: string[];
  offsets: number[];
  ut: number | null;
  ud: (number | null)[];
  pop: number;
}

const payloads: Record<string, PrebuiltPayload> = {};

for (const packed of packedZones) {
  const u = unpackPacked(packed);
  const untilsDelta: number[] = [];
  for (let i = 1; i < u.untils.length; i++) {
    untilsDelta.push(u.untils[i] - u.untils[i - 1]);
  }
  payloads[u.name] = {
    abbrs: u.abbrs,
    offsets: u.offsets,
    ut: u.untils[0],
    ud: untilsDelta,
    pop: u.population,
  };
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
  zones:Record<string,{abbrs:string[];offsets:number[];ut:number|null;ud:(number|null)[];pop:number}>;
  links:string[];countries:string[];
}={
  version:${JSON.stringify(tz.dataVersion ?? "")},
  tzVersion:${JSON.stringify(tz.version ?? "")},
  zones:${JSON.stringify(payloads)},
  links:${JSON.stringify([...linkPairs].sort())},
  countries:${JSON.stringify(countries)},
};
`;

mkdirSync(join(projectRoot, "packages", "timezone", "src"), { recursive: true });
writeFileSync(outFile, content);

console.log(`[generate-timezone-data] wrote ${outFile}`);
