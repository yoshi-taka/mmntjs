/* oxlint-disable no-explicit-any, no-unnecessary-type-assertion, no-unnecessary-condition, prefer-nullish-coalescing, prefer-optional-chain, prefer-string-replace-all, no-new-array, no-useless-spread, prefer-function-type */

import { BUILTIN_TZDATA } from "./builtin-data.generated";

interface MomentFnProps {
  tz: (this: unknown, tz?: string, keepTime?: boolean) => unknown;
  zoneName?: (this: unknown) => string;
  zoneAbbr?: (this: unknown) => string;
  isDST?: (this: unknown) => boolean;
  [key: string]: unknown;
}

interface MomentTzZone {
  name: string;
  abbr: (ts: number) => string;
  offset: (ts: number) => number;
  utcOffset: (ts: number) => number;
  parse: (ts: number) => number;
  countries?: () => string[];
}

interface CountryWithOffset {
  name: string;
  offset: number;
}

interface TimezoneDataBundle {
  version?: string;
  zones?: unknown;
  links?: unknown;
  countries?: unknown;
}

interface MomentTz {
  (
    input?: unknown,
    formatOrZone?: unknown,
    zoneOrStrict?: unknown,
    fourth?: unknown,
  ): MomentInstance;
  guess: (preferCache?: boolean) => string;
  names: () => string[];
  zone: (name: string) => MomentTzZone | null;
  zoneExists?: (name: string) => boolean;
  add: (data: unknown) => void;
  link: (links: unknown) => void;
  load?: (data: TimezoneDataBundle) => void;
  setDefault: (tz?: string) => MomentLike;
  countries: () => string[];
  zonesForCountry: (code: string, withOffset?: boolean) => string[] | CountryWithOffset[] | null;
  unpack?: (data: string) => UnpackedZone;
  unpackBase60?: (input: string) => number;
  version?: string;
  dataVersion?: string;
  Zone?: new (packedString?: string) => MomentTzZone;
  _zones?: Record<string, string | PrebuiltZonePayload | DecodedZonePayload>;
  _links?: Record<string, string>;
  _names?: Record<string, string>;
  _countries?: Record<string, { name: string; zones: string[] }>;
  moveInvalidForward?: boolean;
  moveAmbiguousForward?: boolean;
}

type MomentInstance = MomentLike & {
  tz(tz?: string, keepTime?: boolean): MomentInstance | string;
  _z?: MomentTzZone | null;
  utcOffset(offset?: number | string, keepLocalTime?: boolean): number | MomentInstance;
  isValid(): boolean;
  year(): number;
  month(): number;
  date(): number;
  hour(): number;
  minute(): number;
  second(): number;
  millisecond(): number;
  clone(): MomentInstance;
  valueOf(): number;
  utc(): MomentInstance;
};

export type MomentLike = {
  fn: MomentFnProps;
  momentProperties: string[];
  defaultZone?: string | null;
  tz?: MomentTz;
  updateOffset?: ((m: MomentInstance, keepTime?: boolean) => void) | undefined;
  (...args: unknown[]): MomentInstance;
};

interface UnpackedZone {
  name: string;
  abbrs: string[];
  offsets: number[];
  untils: number[];
  population: number;
}

interface DecodedZonePayload {
  abbrs: string[];
  offsets: Int16Array | Int32Array;
  untils: Float64Array;
  population: number;
}

interface PrebuiltZonePayload {
  abbrs: string[];
  offsets: number[];
  ut: number;
  ud: number[];
  pop: number;
}

const offsetCache = new Map<string, Map<number, number>>();
const MAX_DOMAIN_CACHE_SIZE = 1000;

const ABBR_LOCALES = [
  "en-US",
  "en-GB",
  "ja-JP",
  "en-AU",
  "en-SG",
  "en-HK",
  "af-ZA",
  "es-AR",
  "pt-BR",
  "ko-KR",
  "en-IN",
  "zh-CN",
];

const ZONE_ALIAS: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
};

const KNOWN_ABBR: Record<string, string> = {
  "Asia/Taipei": "CST",
  "Asia/Shanghai": "CST",
  "Asia/Macau": "CST",
  "Asia/Hong_Kong": "HKT",
  "Asia/Kuala_Lumpur": "MYT",
  "Asia/Singapore": "SGT",
  "Asia/Jakarta": "WIB",
  "Asia/Bangkok": "ICT",
  "Asia/Ho_Chi_Minh": "ICT",
  "Asia/Yangon": "MMT",
  "Asia/Dhaka": "BST",
  "Asia/Kathmandu": "NPT",
  "Asia/Colombo": "IST",
  "Pacific/Fiji": "FJT",
  "Pacific/Norfolk": "NFT",
  "Pacific/Guam": "ChST",
  "Pacific/Saipan": "ChST",
  "Africa/Cairo": "EET",
  "Africa/Johannesburg": "SAST",
  "Africa/Nairobi": "EAT",
  "Africa/Lagos": "WAT",
};

const ABBR_OFFSET_ZONES: Record<string, string> = {
  "Africa/Casablanca": "+01",
  "Africa/El_Aaiun": "+01",
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\//g, "_");
}

function normalizeTz(tz: string): string {
  const u = tz.toUpperCase();
  if (u === "UTC" || u === "GMT") {
    return u;
  }
  return ZONE_ALIAS[tz] ?? tz;
}

function charCodeToInt(charCode: number): number {
  if (charCode > 96) {
    return charCode - 87;
  }
  if (charCode > 64) {
    return charCode - 29;
  }
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

function arrayToInt(values: string[]): number[] {
  return values.map((value) => unpackBase60(value));
}

function mapIndices<T>(source: T[], indices: number[]): T[] {
  const out: T[] = new Array(indices.length) as T[];
  for (let i = 0; i < indices.length; i++) {
    out[i] = source[indices[i]];
  }
  return out;
}

function unpack(packed: string): UnpackedZone {
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

function closest(num: number, arr: ArrayLike<number>): number {
  const len = arr.length;
  if (len === 0) {
    return -1;
  }
  if (num < arr[0]) {
    return 0;
  }
  if (len > 1 && arr[len - 1] === Number.POSITIVE_INFINITY && num >= (arr[len - 2] ?? 0)) {
    return len - 1;
  }
  if (num >= (arr[len - 1] ?? 0)) {
    return -1;
  }

  let lo = 0;
  let hi = len - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if ((arr[mid] ?? 0) <= num) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return hi;
}

class InternalZone implements MomentTzZone {
  name: string;
  private readonly canonicalKey: string;
  private lastIndex = -1;
  private lastStart = Number.NEGATIVE_INFINITY;
  private lastEnd = Number.POSITIVE_INFINITY;

  constructor(name: string, canonicalKey: string) {
    this.name = name;
    this.canonicalKey = canonicalKey;
  }

  _index(timestamp: number): number {
    const target = +timestamp;
    if (this.lastIndex >= 0 && target >= this.lastStart && target < this.lastEnd) {
      return this.lastIndex;
    }
    const untils = getDecodedZonePayload(this.canonicalKey).untils;
    const idx = closest(target, untils);
    if (idx >= 0) {
      this.lastIndex = idx;
      this.lastStart =
        idx > 0 ? (untils[idx - 1] ?? Number.NEGATIVE_INFINITY) : Number.NEGATIVE_INFINITY;
      this.lastEnd = untils[idx] ?? Number.POSITIVE_INFINITY;
    }
    return idx;
  }

  countries(): string[] {
    const out: string[] = [];
    for (const [code, country] of Object.entries(countryStore)) {
      if (country.zones.includes(this.name)) {
        out.push(code);
      }
    }
    return out;
  }

  parse(timestamp: number): number {
    const payload = getDecodedZonePayload(this.canonicalKey);
    const target = +timestamp;
    const max = payload.untils.length - 1;
    for (let i = 0; i < max; i++) {
      let offset = payload.offsets[i] ?? 0;
      const offsetNext = payload.offsets[i + 1] ?? offset;
      const offsetPrev = payload.offsets[i ? i - 1 : i] ?? offset;

      if (offset < offsetNext && timezoneFlags.moveAmbiguousForward) {
        offset = offsetNext;
      } else if (offset > offsetPrev && timezoneFlags.moveInvalidForward) {
        offset = offsetPrev;
      }

      if (target < (payload.untils[i] ?? Number.POSITIVE_INFINITY) - offset * 60000) {
        return payload.offsets[i] ?? 0;
      }
    }
    return payload.offsets[max] ?? 0;
  }

  abbr(ts: number): string {
    const idx = this._index(ts);
    const payload = getDecodedZonePayload(this.canonicalKey);
    return idx >= 0 ? (payload.abbrs[idx] ?? "") : "";
  }

  offset(ts: number): number {
    return this.utcOffset(ts);
  }

  utcOffset(ts: number): number {
    const idx = this._index(ts);
    const payload = getDecodedZonePayload(this.canonicalKey);
    return idx >= 0 ? (payload.offsets[idx] ?? 0) : 0;
  }
}

class CompatZone implements MomentTzZone {
  name = "";
  private readonly payload: DecodedZonePayload;
  private lastIndex = -1;
  private lastStart = Number.NEGATIVE_INFINITY;
  private lastEnd = Number.POSITIVE_INFINITY;

  constructor(packedString?: string) {
    const unpacked = unpack(packedString ?? "||0|0||0");
    this.name = unpacked.name;
    this.payload = createDecodedZonePayload(unpacked);
  }

  private index(timestamp: number): number {
    const target = +timestamp;
    if (this.lastIndex >= 0 && target >= this.lastStart && target < this.lastEnd) {
      return this.lastIndex;
    }
    const idx = closest(target, this.payload.untils);
    if (idx >= 0) {
      this.lastIndex = idx;
      this.lastStart =
        idx > 0
          ? (this.payload.untils[idx - 1] ?? Number.NEGATIVE_INFINITY)
          : Number.NEGATIVE_INFINITY;
      this.lastEnd = this.payload.untils[idx] ?? Number.POSITIVE_INFINITY;
    }
    return idx;
  }

  countries(): string[] {
    const out: string[] = [];
    for (const [code, country] of Object.entries(countryStore)) {
      if (country.zones.includes(this.name)) {
        out.push(code);
      }
    }
    return out;
  }

  parse(timestamp: number): number {
    const target = +timestamp;
    const max = this.payload.untils.length - 1;
    for (let i = 0; i < max; i++) {
      let offset = this.payload.offsets[i] ?? 0;
      const offsetNext = this.payload.offsets[i + 1] ?? offset;
      const offsetPrev = this.payload.offsets[i ? i - 1 : i] ?? offset;
      if (offset < offsetNext && timezoneFlags.moveAmbiguousForward) {
        offset = offsetNext;
      } else if (offset > offsetPrev && timezoneFlags.moveInvalidForward) {
        offset = offsetPrev;
      }
      if (target < (this.payload.untils[i] ?? Number.POSITIVE_INFINITY) - offset * 60000) {
        return this.payload.offsets[i] ?? 0;
      }
    }
    return this.payload.offsets[max] ?? 0;
  }

  abbr(ts: number): string {
    const idx = this.index(ts);
    return idx >= 0 ? (this.payload.abbrs[idx] ?? "") : "";
  }

  offset(ts: number): number {
    return this.utcOffset(ts);
  }

  utcOffset(ts: number): number {
    const idx = this.index(ts);
    return idx >= 0 ? (this.payload.offsets[idx] ?? 0) : 0;
  }
}

const zoneStore: Record<string, string | PrebuiltZonePayload | DecodedZonePayload> = Object.create(
  null,
) as Record<string, string | PrebuiltZonePayload | DecodedZonePayload>;
const linkStore: Record<string, string> = Object.create(null) as Record<string, string>;
const nameStore: Record<string, string> = Object.create(null) as Record<string, string>;
const countryStore: Record<string, { name: string; zones: string[] }> = Object.create(
  null,
) as Record<string, { name: string; zones: string[] }>;
const zoneWrapperCache = new Map<string, MomentTzZone>();
const decodedZonePayloadCache = new Map<string, DecodedZonePayload>();
const abbrInternPool = new Map<string, string>();
const timezoneFlags = {
  moveInvalidForward: true,
  moveAmbiguousForward: false,
};

let builtinZoneDataLoaded = false;
let sortedZoneNamesCache: string[] | null = null;

function internString(value: string): string {
  const cached = abbrInternPool.get(value);
  if (cached) {
    return cached;
  }
  abbrInternPool.set(value, value);
  return value;
}

function createDecodedZonePayload(unpacked: UnpackedZone): DecodedZonePayload {
  const offsets = unpacked.offsets.some((value) => value > 32767 || value < -32768)
    ? Int32Array.from(unpacked.offsets)
    : Int16Array.from(unpacked.offsets);
  return {
    abbrs: unpacked.abbrs.map((abbr) => internString(abbr)),
    offsets,
    untils: Float64Array.from(unpacked.untils),
    population: unpacked.population,
  };
}

function getDecodedZonePayload(canonicalKey: string): DecodedZonePayload {
  const cached = decodedZonePayloadCache.get(canonicalKey);
  if (cached) {
    return cached;
  }
  const source = zoneStore[canonicalKey];
  if (!source) {
    throw new Error(`Missing timezone payload for ${canonicalKey}`);
  }
  let payload: DecodedZonePayload;
  if (typeof source === "string") {
    payload = createDecodedZonePayload(unpack(source));
  } else if ("ut" in source) {
    const prebuilt = source as PrebuiltZonePayload;
    const untils: number[] = [prebuilt.ut];
    for (let i = 0; i < prebuilt.ud.length; i++) {
      untils.push(untils[i] + prebuilt.ud[i]);
    }
    untils[untils.length - 1] = Number.POSITIVE_INFINITY;
    payload = createDecodedZonePayload({
      name: "",
      abbrs: prebuilt.abbrs,
      offsets: prebuilt.offsets,
      untils,
      population: prebuilt.pop,
    });
  } else {
    payload = source;
  }
  zoneStore[canonicalKey] = payload;
  decodedZonePayloadCache.set(canonicalKey, payload);
  return payload;
}

function addPackedZoneEntry(
  name: string,
  value: string | PrebuiltZonePayload | DecodedZonePayload,
): void {
  const normalized = normalizeName(name);
  zoneStore[normalized] = value;
  nameStore[normalized] = name;
  zoneWrapperCache.delete(name);
  decodedZonePayloadCache.delete(normalized);
  sortedZoneNamesCache = null;
}

function addZone(packed: unknown): void {
  if (typeof packed === "string") {
    const split = packed.split("|");
    addPackedZoneEntry(split[0] ?? "", packed);
    return;
  }
  if (Array.isArray(packed)) {
    for (const item of packed) {
      addZone(item);
    }
    return;
  }
  if (packed && typeof packed === "object") {
    for (const [name, value] of Object.entries(packed as Record<string, unknown>)) {
      if (typeof value === "string") {
        addZone(value);
        continue;
      }
      if (value && typeof value === "object") {
        if ("ut" in (value as Record<string, unknown>)) {
          addPackedZoneEntry(name, value as PrebuiltZonePayload);
        } else {
          const entry = value as Partial<UnpackedZone>;
          addPackedZoneEntry(
            name,
            createDecodedZonePayload({
              name,
              abbrs: [...(entry.abbrs ?? [])],
              offsets: [...(entry.offsets ?? [])],
              untils: [...(entry.untils ?? [])],
              population: entry.population ?? 0,
            }),
          );
        }
      }
    }
  }
}

function addLink(links: unknown): void {
  const linkList: string[] = [];
  if (typeof links === "string") {
    linkList.push(links);
  } else if (Array.isArray(links)) {
    for (const entry of links) {
      if (typeof entry === "string") {
        linkList.push(entry);
      }
    }
  } else if (links && typeof links === "object") {
    for (const [alias, target] of Object.entries(links as Record<string, unknown>)) {
      if (typeof target === "string") {
        linkList.push(`${alias}|${target}`);
      }
    }
  }

  for (const aliasEntry of linkList) {
    const alias = aliasEntry.split("|");
    const name0 = alias[0];
    const name1 = alias[1];
    if (!name0 || !name1) {
      continue;
    }
    const normal0 = normalizeName(name0);
    const normal1 = normalizeName(name1);
    linkStore[normal0] = normal1;
    nameStore[normal0] = name0;
    linkStore[normal1] = normal0;
    nameStore[normal1] = name1;
    sortedZoneNamesCache = null;
  }
}

function addCountries(data: unknown): void {
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item !== "string") {
        continue;
      }
      const split = item.split("|");
      const code = (split[0] ?? "").toUpperCase();
      const zones = (split[1] ?? "").split(" ").filter(Boolean);
      if (code) {
        countryStore[code] = { name: code, zones };
      }
    }
    return;
  }

  if (data && typeof data === "object") {
    for (const [codeKey, value] of Object.entries(data as Record<string, unknown>)) {
      const code = codeKey.toUpperCase();
      if (Array.isArray(value)) {
        countryStore[code] = {
          name: code,
          zones: value.filter((v): v is string => typeof v === "string"),
        };
        continue;
      }
      if (value && typeof value === "object") {
        const zones = (value as { zones?: unknown }).zones;
        if (Array.isArray(zones)) {
          countryStore[code] = {
            name: code,
            zones: zones.filter((v): v is string => typeof v === "string"),
          };
        }
      }
    }
  }
}

function getZoneRecord(name: string, caller?: typeof getZoneRecord): InternalZone | null {
  const normalized = normalizeName(normalizeTz(name));
  const cached = zoneWrapperCache.get(name);
  if (cached instanceof InternalZone) {
    return cached;
  }
  const zone = zoneStore[normalized];
  if (zone) {
    const resolved = new InternalZone(nameStore[normalized] ?? name, normalized);
    zoneWrapperCache.set(name, resolved);
    return resolved;
  }
  if (linkStore[normalized] && caller !== getZoneRecord) {
    const target = getZoneRecord(linkStore[normalized], getZoneRecord);
    if (target) {
      const alias = new InternalZone(nameStore[normalized] ?? name, normalizeName(target.name));
      zoneWrapperCache.set(name, alias);
      return alias;
    }
  }
  return null;
}

function getZone(name: string): MomentTzZone | null {
  return getZoneRecord(name);
}

function getAbbr(tz: string, ts: number): string {
  if (tz === "UTC") {
    return "UTC";
  }
  if (tz === "GMT") {
    return "GMT";
  }

  const d = new Date(ts);
  for (const loc of ABBR_LOCALES) {
    try {
      const full = d.toLocaleString(loc, { timeZone: tz, timeZoneName: "short" });
      const m = full.match(/\s(\S+)$/);
      if (m) {
        const abbr = m[1] ?? "";
        if (/^[A-Z]{2,5}$/.test(abbr) && abbr !== "Time") {
          return abbr;
        }
      }
    } catch {
      /* skip */
    }
  }

  if (tz in KNOWN_ABBR) {
    return KNOWN_ABBR[tz] ?? "";
  }
  if (tz in ABBR_OFFSET_ZONES) {
    return ABBR_OFFSET_ZONES[tz] ?? "";
  }

  const offset = getOffset(tz, ts);
  const abs = Math.abs(offset);
  const hrs = Math.floor(abs / 60);
  const min = abs % 60;
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(hrs).padStart(2, "0");
  const mm = String(min).padStart(2, "0");
  return `${sign}${hh}${min ? mm : "00"}`;
}

function getOffset(tz: string, timestamp: number): number {
  tz = normalizeTz(tz);
  let domain = offsetCache.get(tz);
  if (!domain) {
    domain = new Map();
    offsetCache.set(tz, domain);
  }

  const cached = domain.get(timestamp);
  if (cached !== undefined) {
    return cached;
  }

  if (domain.size >= MAX_DOMAIN_CACHE_SIZE) {
    const first = domain.keys().next().value;
    if (first !== undefined) {
      domain.delete(first);
    }
  }

  const d = new Date(timestamp);
  const parts = d.toLocaleString("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  });

  const m = parts.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  let offset = 0;
  if (m) {
    const hrs = parseInt(m[1] ?? "0", 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const s = hrs >= 0 ? 1 : -1;
    offset = hrs * 60 + s * min;
  }

  domain.set(timestamp, offset);
  return offset;
}

function hasExplicitOffset(input: string): boolean {
  return /(Z|[+-]\d{2}:?\d{2})\s*$/.test(input.trim());
}

function getNames(): string[] {
  if (sortedZoneNamesCache) {
    return [...sortedZoneNamesCache];
  }
  const out = new Set<string>();
  for (const key of Object.keys(nameStore)) {
    if (nameStore[key] && (zoneStore[key] || zoneStore[linkStore[key] ?? ""] || linkStore[key])) {
      out.add(nameStore[key]);
    }
  }

  for (const name of Object.keys(ZONE_ALIAS)) {
    out.add(name);
    out.add(ZONE_ALIAS[name]);
  }

  sortedZoneNamesCache = [...out].sort();
  return [...sortedZoneNamesCache];
}

function getCountryNames(): string[] {
  return Object.keys(countryStore).sort();
}

function zonesForCountry(
  code: string,
  withOffset?: boolean,
): string[] | CountryWithOffset[] | null {
  const country = countryStore[code.toUpperCase()];
  if (!country) {
    return null;
  }
  const zones = [...country.zones].sort();
  if (withOffset) {
    const now = Date.now();
    return zones
      .map((name) => {
        const zone = getZone(name);
        return zone ? { name, offset: zone.utcOffset(now) } : null;
      })
      .filter((entry): entry is CountryWithOffset => entry !== null);
  }
  return zones;
}

function isZoneName(s: string): boolean {
  const u = s.toUpperCase();
  if (u === "UTC" || u === "GMT") {
    return true;
  }
  return !!getZoneRecord(s);
}

function loadData(data: TimezoneDataBundle): void {
  addZone(data.zones);
  addLink(data.links);
  addCountries(data.countries);
}

function ensureBuiltinZoneData(moment?: MomentLike): void {
  if (builtinZoneDataLoaded) {
    return;
  }
  addZone(BUILTIN_TZDATA.zones);
  addLink(BUILTIN_TZDATA.links);
  addCountries(BUILTIN_TZDATA.countries);
  if (moment?.tz) {
    moment.tz.dataVersion = BUILTIN_TZDATA.version;
    if (BUILTIN_TZDATA.tzVersion) {
      moment.tz.version = BUILTIN_TZDATA.tzVersion;
    }
  }
  builtinZoneDataLoaded = true;
}

export function installTimezone(moment: MomentLike): MomentLike {
  if (moment.tz) {
    return moment;
  }

  ensureBuiltinZoneData(moment);

  moment.momentProperties.push("_z");

  function parseInZone(input: string, zone: string, format?: string): MomentInstance {
    const parsed = format ? (moment as any).utc(input, format) : (moment as any).utc(input);
    if (!parsed.isValid()) {
      return parsed;
    }

    const y = parsed.year();
    const M = parsed.month();
    const d = parsed.date();
    const h = parsed.hour();
    const min = parsed.minute();
    const s = parsed.second();
    const ms = parsed.millisecond();
    const zoneInfo = getZone(zone);

    if (zoneInfo instanceof InternalZone) {
      const base = Date.UTC(y, M, d, h, min, s, ms);
      const offset = zoneInfo.parse(base);
      const result = moment(base + offset * 60000);
      const resolvedOffset = zoneInfo.utcOffset(result.valueOf());
      result.utcOffset(resolvedOffset === 0 ? 0 : -resolvedOffset, false);
      result._z = zoneInfo;
      return result;
    }

    function wallParts(ts: number): { h: number; min: number; s: number } | null {
      try {
        const wall = new Date(ts).toLocaleString("en-US", {
          timeZone: zone,
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const parts = wall.match(/^(\d{2}):(\d{2}):(\d{2})$/);
        if (!parts) {
          return null;
        }
        return {
          h: parseInt(parts[1] ?? "0", 10),
          min: parseInt(parts[2] ?? "0", 10),
          s: parseInt(parts[3] ?? "0", 10),
        };
      } catch {
        return null;
      }
    }

    const guess = Date.UTC(y, M, d, h, min, s, ms);
    const trialOffsets = new Set<number>();
    for (const ref of [
      guess,
      Date.UTC(y, M, d),
      Date.UTC(y, M, d, 12),
      Date.UTC(y, M, d - 1, 12),
    ]) {
      trialOffsets.add(getOffset(zone, ref));
    }
    for (const offset of [...trialOffsets]) {
      trialOffsets.add(offset + 30);
      trialOffsets.add(offset - 30);
    }

    const sorted = [...trialOffsets].sort((a, b) => b - a);
    let bestTs = 0;
    let bestOffset = sorted[0] ?? 0;
    let found = false;
    for (const offset of sorted) {
      const candidateTs = guess - offset * 60000;
      if (getOffset(zone, candidateTs) !== offset) {
        continue;
      }
      const wp = wallParts(candidateTs);
      if (wp && wp.h === h && wp.min === min && wp.s === s) {
        bestTs = candidateTs;
        bestOffset = offset;
        found = true;
        break;
      }
    }

    if (!found) {
      const offA = getOffset(zone, guess);
      const tsA = guess - offA * 60000;
      const offB = getOffset(zone, tsA);
      const postGapOff = Math.max(offA, offB);
      const gapMinutes = Math.abs(offB - offA);
      bestOffset = postGapOff;
      bestTs = guess + gapMinutes * 60000 - bestOffset * 60000;
    }

    const result = moment(bestTs);
    result.utcOffset(bestOffset === 0 ? 0 : bestOffset, false);
    result._z = zoneInfo ?? {
      name: zone,
      abbr: (t: number) => getAbbr(zone, t),
      offset: () => -bestOffset,
      utcOffset: () => -bestOffset,
      parse: () => -bestOffset,
    };
    return result;
  }

  function momentTz(
    input?: unknown,
    formatOrZone?: unknown,
    zoneOrStrict?: unknown,
    fourth?: unknown,
  ): MomentInstance {
    if (typeof formatOrZone === "string" && isZoneName(formatOrZone)) {
      const tz = normalizeTz(formatOrZone);
      if (input === undefined || input === null) {
        return moment().tz(tz);
      }
      if (typeof input === "string" && !hasExplicitOffset(input)) {
        return parseInZone(input, tz);
      }
      return moment(input).tz(tz);
    }

    if (
      typeof input === "string" &&
      typeof formatOrZone === "string" &&
      typeof zoneOrStrict === "string" &&
      isZoneName(zoneOrStrict)
    ) {
      return parseInZone(input, normalizeTz(zoneOrStrict), formatOrZone);
    }

    if (
      typeof input === "string" &&
      typeof formatOrZone === "string" &&
      typeof zoneOrStrict === "boolean" &&
      typeof fourth === "string" &&
      isZoneName(fourth)
    ) {
      return parseInZone(input, normalizeTz(fourth), formatOrZone);
    }

    if (typeof input === "string" && typeof formatOrZone === "string") {
      return moment(input, formatOrZone);
    }
    if (typeof input === "string") {
      return moment().tz(input);
    }
    return input !== undefined ? moment(input) : moment();
  }

  function fnTz(this: MomentInstance, tz?: string, keepTime?: boolean): MomentInstance | string {
    if (tz === undefined) {
      return this._z ? this._z.name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    const normalized = normalizeTz(tz);
    const zoneInfo = getZone(normalized);
    if (!zoneInfo) {
      return this.clone();
    }

    const m = this.clone();
    m._z = zoneInfo;
    const targetOffset = -zoneInfo.utcOffset(m.valueOf());
    m.utcOffset(targetOffset === 0 ? 0 : targetOffset, keepTime);
    m._z = zoneInfo;
    return m;
  }

  moment.tz = momentTz as MomentTz;
  moment.fn.tz = fnTz as unknown as (this: unknown, tz?: string, keepTime?: boolean) => unknown;
  moment.defaultZone = null;

  moment.tz.version = BUILTIN_TZDATA.tzVersion || "0.6.2";
  moment.tz.dataVersion = BUILTIN_TZDATA.version || "";
  moment.tz.Zone = CompatZone;
  moment.tz._zones = zoneStore;
  moment.tz._links = linkStore;
  moment.tz._names = nameStore;
  moment.tz._countries = countryStore;
  moment.tz.unpack = unpack;
  moment.tz.unpackBase60 = unpackBase60;
  moment.tz.load = function (data: TimezoneDataBundle): void {
    loadData(data);
    moment.tz!.dataVersion = data.version ?? "";
  };
  moment.tz.add = function (data: unknown): void {
    addZone(data);
  };
  moment.tz.link = function (links: unknown): void {
    addLink(links);
  };
  moment.tz.zone = function (name: string): MomentTzZone | null {
    return getZone(name);
  };
  moment.tz.zoneExists = function (name: string): boolean {
    return !!getZone(name);
  };
  moment.tz.guess = function (_preferCache?: boolean): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  };
  moment.tz.names = function (): string[] {
    return getNames();
  };
  moment.tz.countries = function (): string[] {
    return getCountryNames();
  };
  moment.tz.zonesForCountry = function (
    code: string,
    withOffset?: boolean,
  ): string[] | CountryWithOffset[] | null {
    return zonesForCountry(code, withOffset);
  };
  moment.tz.setDefault = function (tz?: string): MomentLike {
    moment.defaultZone = tz ? normalizeTz(tz) : undefined;
    return moment;
  };
  Object.defineProperty(moment.tz, "moveInvalidForward", {
    get() {
      return timezoneFlags.moveInvalidForward;
    },
    set(value: boolean) {
      timezoneFlags.moveInvalidForward = !!value;
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(moment.tz, "moveAmbiguousForward", {
    get() {
      return timezoneFlags.moveAmbiguousForward;
    },
    set(value: boolean) {
      timezoneFlags.moveAmbiguousForward = !!value;
    },
    enumerable: true,
    configurable: true,
  });

  const origZoneName = moment.fn.zoneName;
  const origZoneAbbr = moment.fn.zoneAbbr;
  const origIsDST = moment.fn.isDST;

  moment.fn.isDST = function (this: { _z?: MomentTzZone | null; valueOf(): number }): boolean {
    if (this._z) {
      const z = this._z.name;
      const ts = this.valueOf();
      if (this._z instanceof InternalZone) {
        const year = new Date(ts).getUTCFullYear();
        const janOff = this._z.utcOffset(Date.UTC(year, 0, 1));
        const julOff = this._z.utcOffset(Date.UTC(year, 6, 1));
        return this._z.utcOffset(ts) !== Math.max(janOff, julOff);
      }
      const year = new Date(ts).getUTCFullYear();
      const janOff = getOffset(z, Date.UTC(year, 0, 1));
      const julOff = getOffset(z, Date.UTC(year, 6, 1));
      return getOffset(z, ts) !== Math.min(janOff, julOff);
    }
    return origIsDST ? origIsDST.call(this) : false;
  } as unknown as (this: unknown) => boolean;
  moment.fn.zoneName = function (this: { _z?: MomentTzZone | null; valueOf(): number }): string {
    if (this._z) {
      return this._z.abbr(this.valueOf());
    }
    return origZoneName ? origZoneName.call(this) : "";
  } as unknown as (this: unknown) => string;
  moment.fn.zoneAbbr = function (this: { _z?: MomentTzZone | null; valueOf(): number }): string {
    if (this._z) {
      return this._z.abbr(this.valueOf());
    }
    return origZoneAbbr ? origZoneAbbr.call(this) : "";
  } as unknown as (this: unknown) => string;

  return moment;
}
