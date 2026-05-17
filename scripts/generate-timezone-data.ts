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

type UnpackedZone = {
  name: string;
  abbrs: string[];
  offsets: number[];
  untils: number[];
  population: number;
  indices: number[];
};

const require = createRequire(import.meta.url);
const projectRoot = join(import.meta.dir, "..");
const srcDir = join(projectRoot, "packages", "timezone", "src");

const momentTimezone = require("moment-timezone/builds/moment-timezone-with-data.js") as TimezoneLike;
const tz = momentTimezone.tz;

if (!tz?._zones || !tz._links || !tz._names || !tz._countries) {
  throw new Error("moment-timezone bundled data was not available for generation");
}

/* ------------------------------------------------------------------ */
/*  base-60 helpers                                                     */
/* ------------------------------------------------------------------ */

function charCodeToInt(charCode: number): number {
  if (charCode > 96) return charCode - 87;
  if (charCode > 64) return charCode - 29;
  return charCode - 48;
}

function intToChar(d: number): string {
  if (d < 10) return String.fromCharCode(48 + d);
  if (d < 36) return String.fromCharCode(87 + d);
  return String.fromCharCode(29 + d);
}

function unpackBase60(input: string): number {
  let i = 0;
  const parts = input.split(".");
  const whole = parts[0] ?? "";
  const fractional = parts[1] ?? "";
  let multiplier = 1;
  let out = 0;
  let sign = 1;
  if (input.charCodeAt(0) === 45) {
    i = 1;
    sign = -1;
  }
  for (; i < whole.length; i++) {
    out = 60 * out + charCodeToInt(whole.charCodeAt(i));
  }
  for (i = 0; i < fractional.length; i++) {
    multiplier /= 60;
    out += charCodeToInt(fractional.charCodeAt(i)) * multiplier;
  }
  return out * sign;
}

function packBase60(n: number): string {
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const intPart = Math.floor(abs);
  const frac = abs - intPart;
  const digits: number[] = [];
  let remaining = intPart;
  while (remaining > 0) {
    digits.unshift(remaining % 60);
    remaining = Math.floor(remaining / 60);
  }
  if (digits.length === 0) digits.push(0);
  const whole = digits.map(intToChar).join("");
  if (frac > 0) {
    let fracStr = ".";
    let f = frac;
    for (let i = 0; i < 8 && f > 1e-10; i++) {
      f *= 60;
      const digit = Math.floor(f);
      fracStr += String.fromCharCode(48 + digit);
      f -= digit;
    }
    return sign + whole + fracStr;
  }
  return sign + whole;
}

function encodeIndex(i: number): string {
  return intToChar(i);
}

/* encode a numeric ID (0-3599) as 2-char base-60 */
function encodeZoneId(n: number): string {
  return intToChar(Math.floor(n / 60)) + intToChar(n % 60);
}

/* ------------------------------------------------------------------ */
/*  unpack a packed zone string                                        */
/* ------------------------------------------------------------------ */

function unpack(packed: string): UnpackedZone {
  const data = packed.split("|");
  const indicesStr = data[3] ?? "";
  const rawUntils = (data[4] ?? "").split(" ");
  const indices: number[] = [];
  for (let i = 0; i < indicesStr.length; i++) {
    indices.push(charCodeToInt(indicesStr.charCodeAt(i)));
  }
  const offsets = (data[2] ?? "").split(" ").map(unpackBase60);
  const abbrs = (data[1] ?? "").split(" ");
  const untils = rawUntils.map(unpackBase60);
  for (let i = 0; i < indices.length; i++) {
    untils[i] = Math.round((untils[i - 1] || 0) + untils[i] * 60000);
  }
  untils[indices.length - 1] = Number.POSITIVE_INFINITY;
  return {
    name: data[0] ?? "",
    abbrs,
    offsets,
    indices,
    untils,
    population: Number(data[5] ?? 0) | 0,
  };
}

/* ------------------------------------------------------------------ */
/*  pack a zone back to packed string                                  */
/* ------------------------------------------------------------------ */

function packZone(z: UnpackedZone): string {
  const abbrStr = z.abbrs.join(" ");
  const offsetStr = z.offsets.map(packBase60).join(" ");
  const indexStr = z.indices.map(encodeIndex).join("");
  let prev = 0;
  const deltas: number[] = [];
  for (let i = 0; i < z.untils.length; i++) {
    if (z.untils[i] === Infinity) {
      deltas.push(0);
    } else {
      deltas.push(Math.round((z.untils[i] - prev) / 60000));
      prev = z.untils[i];
    }
  }
  const untilStr = deltas.map(packBase60).join(" ");
  return `${z.name}|${abbrStr}|${offsetStr}|${indexStr}|${untilStr}|${z.population}`;
}

/* ------------------------------------------------------------------ */
/*  filter a zone to a time range                                      */
/* ------------------------------------------------------------------ */

const RANGE_START_1970 = 0;
const RANGE_END_2030 = 1924991999000;
const BUFFER = 365 * 2 * 86400 * 1000;

function filterZone(z: UnpackedZone, fromMs: number, toMs: number): UnpackedZone | null {
  const n = z.indices.length;
  if (n === 0) return null;

  let start = 0;
  let end = n - 1;

  for (let i = 0; i < n; i++) {
    if (z.untils[i] > fromMs) {
      start = Math.max(0, i - 1);
      break;
    }
  }

  for (let i = n - 1; i >= 0; i--) {
    if (z.untils[i] < toMs) {
      end = Math.min(n - 1, i + 1);
      break;
    }
  }

  if (start >= end) return null;

  const indices = z.indices.slice(start, end + 1);
  const untils = z.untils.slice(start, end + 1);
  untils[untils.length - 1] = Number.POSITIVE_INFINITY;

  const usedSet = new Set(indices);
  const used = [...usedSet].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  used.forEach((old, i) => remap.set(old, i));
  const newIndices = indices.map((i) => remap.get(i)!);
  const newAbbrs = used.map((i) => z.abbrs[i]);
  const newOffsets = used.map((i) => z.offsets[i]);

  return {
    name: z.name,
    abbrs: newAbbrs,
    offsets: newOffsets,
    indices: newIndices,
    untils,
    population: z.population,
  };
}

/* ------------------------------------------------------------------ */
/*  collect zone strings as arrays (for blob)                          */
/* ------------------------------------------------------------------ */

function collectZoneStrings(
  zoneSource: Record<string, unknown>,
  range?: { from: number; to: number },
): string[] {
  const out: string[] = [];
  for (const [norm, v] of Object.entries(zoneSource)) {
    if (typeof v !== "string") continue;
    if (!range) {
      out.push(v);
    } else {
      const unpacked = unpack(v);
      const filtered = filterZone(unpacked, range.from, range.to);
      if (filtered) {
        out.push(packZone(filtered));
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  links & countries                                                  */
/* ------------------------------------------------------------------ */

function collectLinks(): string[] {
  const linkPairs = new Set<string>();
  for (const [fromNorm, toNorm] of Object.entries(tz._links!)) {
    const fromName = tz._names![fromNorm];
    const toName = tz._names![toNorm];
    if (!fromName || !toName || fromName === toName) continue;
    const key = fromName < toName ? `${fromName}|${toName}` : `${toName}|${fromName}`;
    linkPairs.add(key);
  }
  return [...linkPairs].sort();
}

function collectCountryStrings(): string[] {
  return Object.entries(tz._countries!)
    .map(([code, info]) => `${code}|${info.zones.join(" ")}`)
    .sort();
}

/* ------------------------------------------------------------------ */
/*  Name dictionary helpers                                            */
/* ------------------------------------------------------------------ */

function buildNameTable(
  zones: string[],
  links: string[],
  countries: string[],
): { names: string[]; tblByName: Map<string, number> } {
  const all = new Set<string>();
  for (const z of zones) {
    const n = z.split("|")[0];
    if (n) all.add(n);
  }
  for (const l of links) {
    const [a, b] = l.split("|");
    if (a) all.add(a);
    if (b) all.add(b);
  }
  for (const c of countries) {
    const pipe = c.indexOf("|");
    if (pipe > 0) {
      for (const n of c.slice(pipe + 1).split(" ")) {
        if (n) all.add(n);
      }
    }
  }
  const names = [...all].sort();
  const tblByName = new Map(names.map((n, i) => [n, i]));
  return { names, tblByName };
}

function applyNameIds(
  zones: string[],
  links: string[],
  countries: string[],
  tblByName: Map<string, number>,
): { zones: string[]; links: string[]; countries: string[] } {
  return {
    zones: zones.map((z) => {
      const pipe = z.indexOf("|");
      const name = z.slice(0, pipe);
      return encodeZoneId(tblByName.get(name)!) + z.slice(pipe);
    }),
    links: links.map((l) => {
      const [a, b] = l.split("|");
      return `${encodeZoneId(tblByName.get(a)!)}|${encodeZoneId(tblByName.get(b)!)}`;
    }),
    countries: countries.map((c) => {
      const pipe = c.indexOf("|");
      const code = c.slice(0, pipe);
      const zoneRefs = c.slice(pipe + 1).split(" ").map((n) =>
        String(tblByName.get(n)!)
      ).join(" ");
      return code + "|" + zoneRefs;
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  serialize & write                                                  */
/* ------------------------------------------------------------------ */

function writeBlobFile(
  outFile: string,
  zones: string[],
  links: string[],
  countries: string[],
  label: string,
  compatExport?: boolean,
): void {
  const { names, tblByName } = buildNameTable(zones, links, countries);
  const { zones: idZones, links: idLinks, countries: idCountries } =
    applyNameIds(zones, links, countries, tblByName);

  const zonesBlob = idZones.join("\n");
  const linksBlob = idLinks.join("\n");
  const countriesBlob = idCountries.join("\n");
  const namesBlob = names.join("\n");

  // compact TS: single-char property names + compat aliases
  const compat = compatExport
    ? `\nexport const BUILTIN_TZDATA={version:V,tzVersion:T,zonesBlob:Z,linksBlob:L,countriesBlob:C,namesBlob:N};`
    : "";
  const content = `export const V=${JSON.stringify(tz.dataVersion ?? "")},T=${JSON.stringify(tz.version ?? "")},Z=${JSON.stringify(zonesBlob)},L=${JSON.stringify(linksBlob)},C=${JSON.stringify(countriesBlob)},N=${JSON.stringify(namesBlob)};${compat}
`;
  mkdirSync(join(outFile, ".."), { recursive: true });
  writeFileSync(outFile, content);

  const zLen = zonesBlob.length;
  const lLen = linksBlob.length;
  const cLen = countriesBlob.length;
  const nLen = namesBlob.length;
  console.log(`[generate-timezone-data] wrote ${outFile}  (${label})`);
  console.log(`  zones:  ${(zLen / 1024).toFixed(1)} KB  (${idZones.length} zones)`);
  console.log(`  links:  ${(lLen / 1024).toFixed(1)} KB  (${idLinks.length} links)`);
  console.log(`  countries: ${(cLen / 1024).toFixed(1)} KB  (...)`);
  console.log(`  names:  ${(nLen / 1024).toFixed(1)} KB  (${names.length} names)`);
}

/* ------------------------------------------------------------------ */
/*  main                                                               */
/* ------------------------------------------------------------------ */

const links = collectLinks();
const countries = collectCountryStrings();

// Full data
const fullZones = collectZoneStrings(tz._zones!);
writeBlobFile(
  join(srcDir, "builtin-data.generated.ts"),
  fullZones,
  links,
  countries,
  "full",
  true, // includes compat BUILTIN_TZDATA export for tests
);

// 1970-2030 range
const filteredZones = collectZoneStrings(tz._zones!, {
  from: RANGE_START_1970 - BUFFER,
  to: RANGE_END_2030 + BUFFER,
});
writeBlobFile(
  join(srcDir, "builtin-data-1970-2030.generated.ts"),
  filteredZones,
  links,
  countries,
  "1970-2030",
);
