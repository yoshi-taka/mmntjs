/* oxlint-disable no-explicit-any, no-unnecessary-type-assertion, no-unnecessary-condition, prefer-nullish-coalescing, prefer-optional-chain, prefer-string-replace-all, no-new-array, no-useless-spread, prefer-function-type, curly */

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

export interface MomentTz {
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

const ZONE_ALIAS: Record<string, string> = { "Asia/Calcutta": "Asia/Kolkata" };

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\//g, "_");
}

function normalizeTz(tz: string): string {
  const u = tz.toUpperCase();
  if (u === "UTC" || u === "GMT") return u;
  return ZONE_ALIAS[tz] ?? tz;
}

function charCodeToInt(charCode: number): number {
  if (charCode > 96) return charCode - 87;
  if (charCode > 64) return charCode - 29;
  return charCode - 48;
}

function unpackBase60(input: string): number {
  let i = 0,
    out = 0,
    sign = 1,
    multiplier = 1;
  const parts = input.split(".");
  const whole = parts[0] ?? "";
  const fractional = parts[1] ?? "";
  if (input.charCodeAt(0) === 45) {
    i = 1;
    sign = -1;
  }
  for (; i < whole.length; i++) out = 60 * out + charCodeToInt(whole.charCodeAt(i));
  for (i = 0; i < fractional.length; i++) {
    multiplier /= 60;
    out += charCodeToInt(fractional.charCodeAt(i)) * multiplier;
  }
  return out * sign;
}

function arrayToInt(values: string[]): number[] {
  return values.map(unpackBase60);
}

function mapIndices<T>(source: T[], indices: number[]): T[] {
  const out: T[] = new Array(indices.length) as T[];
  for (let i = 0; i < indices.length; i++) out[i] = source[indices[i]];
  return out;
}

function unpack(packed: string): UnpackedZone {
  const data = packed.split("|");
  const offsets = arrayToInt((data[2] ?? "").split(" "));
  const indices = arrayToInt((data[3] ?? "").split(""));
  const untils = arrayToInt((data[4] ?? "").split(" "));
  for (let i = 0; i < indices.length; i++)
    untils[i] = Math.round((untils[i - 1] || 0) + untils[i] * 60000);
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
  if (len === 0) return -1;
  if (num < arr[0]) return 0;
  if (len > 1 && arr[len - 1] === Number.POSITIVE_INFINITY && num >= (arr[len - 2] ?? 0))
    return len - 1;
  if (num >= (arr[len - 1] ?? 0)) return -1;
  let lo = 0,
    hi = len - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if ((arr[mid] ?? 0) <= num) lo = mid;
    else hi = mid;
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
    if (this.lastIndex >= 0 && target >= this.lastStart && target < this.lastEnd)
      return this.lastIndex;
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

  parse(timestamp: number): number {
    const payload = getDecodedZonePayload(this.canonicalKey);
    const target = +timestamp;
    const max = payload.untils.length - 1;
    for (let i = 0; i < max; i++) {
      let offset = payload.offsets[i] ?? 0;
      const offsetNext = payload.offsets[i + 1] ?? offset;
      const offsetPrev = payload.offsets[i ? i - 1 : i] ?? offset;
      if (offset < offsetNext && timezoneFlags.moveAmbiguousForward) offset = offsetNext;
      else if (offset > offsetPrev && timezoneFlags.moveInvalidForward) offset = offsetPrev;
      if (target < (payload.untils[i] ?? Number.POSITIVE_INFINITY) - offset * 60000)
        return payload.offsets[i] ?? 0;
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
  name: string;
  private readonly p: DecodedZonePayload;
  private li = -1;
  private ls = Number.NEGATIVE_INFINITY;
  private le = Number.POSITIVE_INFINITY;

  constructor(packedString?: string) {
    const u = unpack(packedString ?? "||0|0||0");
    this.name = u.name;
    this.p = createDecodedZonePayload(u);
  }

  private _i(ts: number): number {
    const t = +ts;
    if (this.li >= 0 && t >= this.ls && t < this.le) return this.li;
    const idx = closest(t, this.p.untils);
    if (idx >= 0) {
      this.li = idx;
      this.ls = idx > 0 ? this.p.untils[idx - 1]! : Number.NEGATIVE_INFINITY;
      this.le = this.p.untils[idx]!;
    }
    return idx;
  }

  abbr(ts: number): string {
    const i = this._i(ts);
    return i >= 0 ? this.p.abbrs[i]! : "";
  }
  offset(ts: number): number {
    return this.utcOffset(ts);
  }
  utcOffset(ts: number): number {
    const i = this._i(ts);
    return i >= 0 ? this.p.offsets[i]! : 0;
  }
  parse(ts: number): number {
    const target = +ts;
    const max = this.p.untils.length - 1;
    for (let i = 0; i < max; i++) {
      let off = this.p.offsets[i]!;
      const nxt = this.p.offsets[i + 1] ?? off,
        prv = this.p.offsets[i ? i - 1 : i] ?? off;
      if (off < nxt && timezoneFlags.moveAmbiguousForward) off = nxt;
      else if (off > prv && timezoneFlags.moveInvalidForward) off = prv;
      if (target < this.p.untils[i]! - off * 60000) return this.p.offsets[i]!;
    }
    return this.p.offsets[max]!;
  }
}

/* ------------------------------------------------------------------ */
/*  Module-level stores (lazy-populated from blobs)                    */
/* ------------------------------------------------------------------ */

const zoneStore: Record<string, string | PrebuiltZonePayload | DecodedZonePayload> =
  Object.create(null);
const linkStore: Record<string, string> = Object.create(null);
const nameStore: Record<string, string> = Object.create(null);
const countryStore: Record<string, { name: string; zones: string[] }> = Object.create(null);
const zoneWrapperCache = new Map<string, MomentTzZone>();
const decodedZonePayloadCache = new Map<string, DecodedZonePayload>();
const abbrInternPool = new Map<string, string>();
const timezoneFlags = { moveInvalidForward: true, moveAmbiguousForward: false };

let builtinZoneDataLoaded = false;
let storesPopulated = false;
let sortedZoneNamesCache: string[] | null = null;

/* lazy blob data */
let _zonesBlob = "";
let _linksBlob = "";
let _countriesBlob = "";

/* ------------------------------------------------------------------ */
/*  Blob indexing (lazy, called on first zone access)                  */
/* ------------------------------------------------------------------ */

function ensureStoresPopulated(): void {
  if (storesPopulated || !builtinZoneDataLoaded) return;
  storesPopulated = true;

  // Zones blob: one packed string per line
  for (const line of _zonesBlob.split("\n")) {
    if (!line) continue;
    const name = line.split("|")[0];
    const key = normalizeName(name);
    if (!(key in zoneStore)) {
      addPackedZoneEntry(name, line);
    }
  }
  _zonesBlob = ""; // free blob memory after parsing

  // Links blob: "from|to" per line
  for (const line of _linksBlob.split("\n")) {
    if (!line) continue;
    const parts = line.split("|");
    const n0 = normalizeName(parts[0]!),
      n1 = normalizeName(parts[1]!);
    if (!(n0 in linkStore)) {
      linkStore[n0] = n1;
      nameStore[n0] = parts[0]!;
    }
    if (!(n1 in linkStore)) {
      linkStore[n1] = n0;
      nameStore[n1] = parts[1]!;
    }
    sortedZoneNamesCache = null;
  }
  _linksBlob = "";

  // Countries blob: "CODE|zone1 zone2 ..." per line
  for (const line of _countriesBlob.split("\n")) {
    if (!line) continue;
    const idx = line.indexOf("|");
    if (idx < 0) continue;
    const code = line.slice(0, idx).toUpperCase();
    const zones = line
      .slice(idx + 1)
      .split(" ")
      .filter(Boolean);
    if (code) countryStore[code] = { name: code, zones };
  }
  _countriesBlob = "";
}

/* ------------------------------------------------------------------ */
/*  Payload cache & zone entry helpers                                 */
/* ------------------------------------------------------------------ */

function internString(value: string): string {
  const cached = abbrInternPool.get(value);
  if (cached) return cached;
  abbrInternPool.set(value, value);
  return value;
}

function createDecodedZonePayload(unpacked: UnpackedZone): DecodedZonePayload {
  const offsets = unpacked.offsets.some((v) => v > 32767 || v < -32768)
    ? Int32Array.from(unpacked.offsets)
    : Int16Array.from(unpacked.offsets);
  return {
    abbrs: unpacked.abbrs.map(internString),
    offsets,
    untils: Float64Array.from(unpacked.untils),
    population: unpacked.population,
  };
}

function getDecodedZonePayload(canonicalKey: string): DecodedZonePayload {
  const cached = decodedZonePayloadCache.get(canonicalKey);
  if (cached) return cached;
  const source = zoneStore[canonicalKey];
  if (!source) throw new Error(`Missing timezone payload for ${canonicalKey}`);
  let payload: DecodedZonePayload;
  if (typeof source === "string") {
    payload = createDecodedZonePayload(unpack(source));
  } else if ("ut" in source) {
    const pb = source as PrebuiltZonePayload;
    const untils: number[] = [pb.ut];
    for (let i = 0; i < pb.ud.length; i++) untils.push(untils[i] + pb.ud[i]);
    untils[untils.length - 1] = Number.POSITIVE_INFINITY;
    payload = createDecodedZonePayload({
      name: "",
      abbrs: pb.abbrs,
      offsets: pb.offsets,
      untils,
      population: pb.pop,
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
    addPackedZoneEntry(packed.split("|")[0] ?? "", packed);
    return;
  }
  if (Array.isArray(packed)) {
    for (const item of packed) addZone(item);
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
  const list: string[] = [];
  if (typeof links === "string") {
    list.push(links);
  } else if (Array.isArray(links)) {
    for (const e of links) {
      if (typeof e === "string") list.push(e);
    }
  } else if (links && typeof links === "object") {
    for (const [alias, target] of Object.entries(links as Record<string, unknown>)) {
      if (typeof target === "string") list.push(`${alias}|${target}`);
    }
  }
  for (const entry of list) {
    const parts = entry.split("|");
    const n0 = normalizeName(parts[0]!),
      n1 = normalizeName(parts[1]!);
    if (n0 && n1) {
      linkStore[n0] = n1;
      nameStore[n0] = parts[0]!;
      linkStore[n1] = n0;
      nameStore[n1] = parts[1]!;
      sortedZoneNamesCache = null;
    }
  }
}

function addCountries(data: unknown): void {
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item !== "string") continue;
      const split = item.split("|");
      const code = (split[0] ?? "").toUpperCase();
      if (code)
        countryStore[code] = { name: code, zones: (split[1] ?? "").split(" ").filter(Boolean) };
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
        if (Array.isArray(zones))
          countryStore[code] = {
            name: code,
            zones: zones.filter((v): v is string => typeof v === "string"),
          };
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Zone lookup                                                        */
/* ------------------------------------------------------------------ */

function getZoneRecord(name: string, caller?: typeof getZoneRecord): InternalZone | null {
  ensureStoresPopulated();
  const normalized = normalizeName(normalizeTz(name));
  const cached = zoneWrapperCache.get(name);
  if (cached instanceof InternalZone) return cached;
  const zone = zoneStore[normalized];
  if (zone) {
    const r = new InternalZone(nameStore[normalized] ?? name, normalized);
    zoneWrapperCache.set(name, r);
    return r;
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

function isZoneName(s: string): boolean {
  const u = s.toUpperCase();
  return u === "UTC" || u === "GMT" || !!getZoneRecord(s);
}

function hasExplicitOffset(input: string): boolean {
  return /(Z|[+-]\d{2}:?\d{2})\s*$/.test(input.trim());
}

function getNames(): string[] {
  ensureStoresPopulated();
  if (sortedZoneNamesCache) return [...sortedZoneNamesCache];
  const out = new Set<string>();
  for (const key of Object.keys(nameStore)) {
    if (nameStore[key] && (zoneStore[key] || zoneStore[linkStore[key] ?? ""] || linkStore[key]))
      out.add(nameStore[key]);
  }
  for (const name of Object.keys(ZONE_ALIAS)) {
    out.add(name);
    out.add(ZONE_ALIAS[name]);
  }
  sortedZoneNamesCache = [...out].sort();
  return [...sortedZoneNamesCache];
}

function getCountryNames(): string[] {
  ensureStoresPopulated();
  return Object.keys(countryStore).sort();
}

function zonesForCountry(
  code: string,
  withOffset?: boolean,
): string[] | CountryWithOffset[] | null {
  ensureStoresPopulated();
  const country = countryStore[code.toUpperCase()];
  if (!country) return null;
  const zones = [...country.zones].sort();
  if (withOffset) {
    const now = Date.now();
    return zones
      .map((name) => {
        const z = getZone(name);
        return z ? { name, offset: z.utcOffset(now) } : null;
      })
      .filter((e): e is CountryWithOffset => e !== null);
  }
  return zones;
}

function loadData(data: TimezoneDataBundle): void {
  addZone(data.zones);
  addLink(data.links);
  addCountries(data.countries);
}

function ensureBuiltinZoneData(
  moment: MomentLike | undefined,
  data:
    | {
        version: string;
        tzVersion: string;
        zonesBlob: string;
        linksBlob: string;
        countriesBlob: string;
      }
    | undefined,
): void {
  if (builtinZoneDataLoaded || !data) return;
  _zonesBlob = data.zonesBlob;
  _linksBlob = data.linksBlob;
  _countriesBlob = data.countriesBlob;
  if (moment?.tz) {
    moment.tz.dataVersion = data.version;
    if (data.tzVersion) moment.tz.version = data.tzVersion;
  }
  builtinZoneDataLoaded = true;
}

/* ------------------------------------------------------------------ */
/*  Public install entry                                               */
/* ------------------------------------------------------------------ */

export function installTimezone(
  moment: MomentLike,
  data?: {
    version: string;
    tzVersion: string;
    zonesBlob: string;
    linksBlob: string;
    countriesBlob: string;
  },
): MomentLike {
  if (moment.tz) return moment;

  ensureBuiltinZoneData(moment, data);

  moment.momentProperties.push("_z");

  function parseInZone(input: string, zone: string, format?: string): MomentInstance {
    const parsed = format ? (moment as any).utc(input, format) : (moment as any).utc(input);
    if (!parsed.isValid()) return parsed;
    const y = parsed.year(),
      M = parsed.month(),
      d = parsed.date();
    const h = parsed.hour(),
      min = parsed.minute(),
      s = parsed.second(),
      ms = parsed.millisecond();
    const zoneInfo = getZone(zone);
    if (zoneInfo instanceof InternalZone) {
      const base = Date.UTC(y, M, d, h, min, s, ms);
      const offset = zoneInfo.parse(base);
      const result = moment(base + offset * 60000);
      result.utcOffset(
        zoneInfo.utcOffset(result.valueOf()) ? -zoneInfo.utcOffset(result.valueOf()) : 0,
        false,
      );
      result._z = zoneInfo;
      return result;
    }
    return parsed;
  }

  function momentTz(
    input?: unknown,
    foz?: unknown,
    zos?: unknown,
    fourth?: unknown,
  ): MomentInstance {
    if (typeof foz === "string") {
      if (isZoneName(foz)) {
        const tz = normalizeTz(foz);
        if (input == null) return moment().tz(tz);
        if (typeof input === "string" && !hasExplicitOffset(input)) return parseInZone(input, tz);
        return moment(input).tz(tz);
      }
      if (typeof input === "string") {
        if (typeof zos === "string" && isZoneName(zos))
          return parseInZone(input, normalizeTz(zos), foz);
        if (typeof zos === "boolean" && typeof fourth === "string" && isZoneName(fourth))
          return parseInZone(input, normalizeTz(fourth), foz);
        return moment(input, foz);
      }
    }
    if (typeof input === "string") return moment().tz(input);
    return input != null ? moment(input) : moment();
  }

  function fnTz(this: MomentInstance, tz?: string, keepTime?: boolean): MomentInstance | string {
    if (tz === undefined)
      return this._z ? this._z.name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zi = getZone(normalizeTz(tz));
    if (!zi) return this.clone();
    const m = this.clone();
    m._z = zi;
    const to = -zi.utcOffset(m.valueOf());
    m.utcOffset(to ? to : 0, keepTime);
    return m;
  }

  moment.tz = momentTz as MomentTz;
  moment.fn.tz = fnTz as unknown as (this: unknown, tz?: string, keepTime?: boolean) => unknown;
  moment.defaultZone = null;

  moment.tz.version = data?.tzVersion || "0.6.2";
  moment.tz.dataVersion = data?.version || "";
  moment.tz.Zone = CompatZone;
  moment.tz._zones = zoneStore;
  moment.tz._links = linkStore;
  moment.tz._names = nameStore;
  moment.tz._countries = countryStore;
  moment.tz.unpack = unpack;
  moment.tz.unpackBase60 = unpackBase60;
  moment.tz.load = function (bundle: TimezoneDataBundle): void {
    loadData(bundle);
    moment.tz!.dataVersion = bundle.version ?? "";
  };
  moment.tz.add = function (zoneData: unknown): void {
    addZone(zoneData);
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
  moment.tz.guess = function (): string {
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
    set(v: boolean) {
      timezoneFlags.moveInvalidForward = !!v;
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(moment.tz, "moveAmbiguousForward", {
    get() {
      return timezoneFlags.moveAmbiguousForward;
    },
    set(v: boolean) {
      timezoneFlags.moveAmbiguousForward = !!v;
    },
    enumerable: true,
    configurable: true,
  });

  const _zn = moment.fn.zoneName,
    _za = moment.fn.zoneAbbr;

  moment.fn.isDST = function (this: { _z?: MomentTzZone | null; valueOf(): number }): boolean {
    const z = this._z;
    if (!z) return false;
    const ts = this.valueOf(),
      y = new Date(ts).getUTCFullYear();
    const jan = Date.UTC(y, 0, 1),
      jul = Date.UTC(y, 6, 1);
    if (z instanceof InternalZone)
      return z.utcOffset(ts) !== Math.max(z.utcOffset(jan), z.utcOffset(jul));
    return false;
  } as unknown as (this: unknown) => boolean;
  moment.fn.zoneName = function (this: { _z?: MomentTzZone | null; valueOf(): number }): string {
    return this._z ? this._z.abbr(this.valueOf()) : _zn ? _zn.call(this) : "";
  } as unknown as (this: unknown) => string;
  moment.fn.zoneAbbr = function (this: { _z?: MomentTzZone | null; valueOf(): number }): string {
    return this._z ? this._z.abbr(this.valueOf()) : _za ? _za.call(this) : "";
  } as unknown as (this: unknown) => string;

  return moment;
}
