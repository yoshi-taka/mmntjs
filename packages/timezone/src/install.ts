interface MomentFnProps {
  tz: (this: unknown, tz?: string) => unknown;
  [key: string]: unknown;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/** @public */
export class MomentTzZone {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  abbr(ts: number): string {
    return getAbbr(this.name, ts);
  }
  offset(ts: number): number {
    return -getOffsetByZone(this.name, ts) || 0;
  }
  utcOffset(ts: number): number {
    return -getOffsetByZone(this.name, ts) || 0;
  }
  parse(ts: number): number {
    return -getOffsetByZone(this.name, ts) || 0;
  }
}

interface MomentTz {
  (input?: unknown, formatOrZone?: unknown, zoneOrStrict?: unknown, fourth?: unknown): MomentLike;
  guess: (preferCache?: boolean) => string;
  names: () => string[];
  zone: (name: string) => MomentTzZone | null;
  add: (data: unknown) => void;
  link: (links: unknown) => void;
  setDefault: (tz: string) => void;
  countries: () => string[];
  zonesForCountry: (code: string) => string[];
}

type MomentInstance = MomentLike & {
  tz(tz?: string): MomentInstance;
  _z?: MomentTzZone;
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
};

export type MomentLike = {
  fn: MomentFnProps;
  momentProperties: string[];
  defaultZone?: string;
  tz?: MomentTz;
  (...args: unknown[]): MomentInstance;
};

/* ------------------------------------------------------------------ */
/*  Ring buffer caches                                                 */
/*  TypedArray-based, contiguous memory — no hash table overhead,      */
/*  no pointer chasing. Linear scan of 64 entries stays in L1 cache.  */
/* ------------------------------------------------------------------ */

/**
 * Direct-mapped cache: 16 slots, indexed by Math.imul(k, golden) >>> 28 & 15.
 * Uses Math.imul for correct 32-bit integer overflow (float64 loses precision
 * for timestamps > ~year 2038). Single compare, no loop → no pipeline bubbles.
 * 16 entries = 128+64 = 192 bytes, fits L1 cache line multiple.
 */
class DmCache {
  readonly keys = new Float64Array(16);
  readonly vals = new Int32Array(16);
  constructor() {
    for (let i = 0; i < 16; i++) {
      this.keys[i] = NaN;
    }
  }
  get(k: number): number | undefined {
    const i = (Math.imul(k | 0, 2654435761) >>> 28) & 15;
    if (this.keys[i] === k) {
      return this.vals[i];
    }
    return undefined;
  }
  set(k: number, v: number): void {
    const i = (Math.imul(k | 0, 2654435761) >>> 28) & 15;
    this.keys[i] = k;
    this.vals[i] = v;
  }
}

/** Direct-mapped cache for string values (abbr). Same hash layout. */
class DmStrCache {
  readonly keys = new Float64Array(16);
  readonly vals: (string | undefined)[] = Array.from({ length: 16 });
  constructor() {
    for (let i = 0; i < 16; i++) {
      this.keys[i] = NaN;
    }
  }
  get(k: number): string | undefined {
    const i = (Math.imul(k | 0, 2654435761) >>> 28) & 15;
    if (this.keys[i] === k) {
      return this.vals[i];
    }
    return undefined;
  }
  set(k: number, v: string): void {
    const i = (Math.imul(k | 0, 2654435761) >>> 28) & 15;
    this.keys[i] = k;
    this.vals[i] = v;
  }
}

/* ------------------------------------------------------------------ */
/*  Per-zone state (collocated for cache-line locality)                */
/* ------------------------------------------------------------------ */

class ZoneData {
  offsetCache = new DmCache();
  /** Day-level offset cache: key=UTC day number, value=offset. Only stored if the day is stable (start/noon/end agree). */
  dayOffsetCache = new DmCache();
  /** Set of UTC day numbers already probed for offset stability. Lazily created. */
  probedDays: Set<number> | undefined;
  offsetFormatter: Intl.DateTimeFormat | undefined;
  wallFormatter: Intl.DateTimeFormat | undefined;
  abbrCache = new DmStrCache();
  /** Day-level abbreviation cache: key=UTC day number, value=abbr. Only stored if the day is stable. */
  abbrDayCache = new DmStrCache();
  /** Set of UTC day numbers already probed for abbr stability. Lazily created. */
  abbrProbedDays: Set<number> | undefined;
  abbrFormatters = new Map<string, Intl.DateTimeFormat>();
  abbrLocale: string | undefined;
}

const zoneDataMap = new Map<string, ZoneData>();

function ensureZoneData(tz: string): ZoneData {
  let zd = zoneDataMap.get(tz);
  if (!zd) {
    zd = new ZoneData();
    zoneDataMap.set(tz, zd);
  }
  return zd;
}

/** Zone object cache — IANA zones are finite (~600), inherently bounded. */
const zoneObjectCache = new Map<string, MomentTzZone>();

/** true for normalized UTC/GMT zone names (always offset 0, abbr is the name). */
const isUtcOrGmt = (tz: string) => tz === "UTC" || tz === "GMT";

/** Try a single locale for abbreviation, returning null if it doesn't yield a short name. */
function tryLocaleAbbr(zd: ZoneData, tz: string, ts: number, locale: string): string | null {
  let dtf = zd.abbrFormatters.get(locale);
  if (!dtf) {
    try {
      dtf = new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        timeZoneName: "short",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      zd.abbrFormatters.set(locale, dtf);
    } catch {
      return null;
    }
  }
  try {
    const parts = dtf.formatToParts(new Date(ts));
    for (const p of parts) {
      if (p.type === "timeZoneName") {
        const abbr = p.value;
        if (
          abbr === "GMT" ||
          (/^[A-Z]{2,5}$/.test(abbr) && !abbr.startsWith("GMT") && abbr !== "Time")
        ) {
          return abbr;
        }
      }
    }
  } catch {
    /* skip */
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Intl helpers                                                       */
/* ------------------------------------------------------------------ */

type IntlExtended = typeof Intl & { supportedValuesOf(key: "timeZone"): string[] };
const intlTZNames: () => string[] = (Intl as IntlExtended).supportedValuesOf.bind(
  Intl,
  "timeZone",
) as () => string[];

/**
 * Extract year/month/day/hour/minute/second from formatToParts into a
 * stable-shape object. Avoids generic Record<string, number> allocation
 * and string-key lookup at call sites.
 */
function extractWallParts(
  dtf: Intl.DateTimeFormat,
  ts: number,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  let year = 0,
    month = 0,
    day = 0,
    hour = 0,
    minute = 0,
    second = 0;
  for (const p of dtf.formatToParts(new Date(ts))) {
    if (p.type === "year") {
      year = Number(p.value);
    } else if (p.type === "month") {
      month = Number(p.value);
    } else if (p.type === "day") {
      day = Number(p.value);
    } else if (p.type === "hour") {
      hour = Number(p.value);
    } else if (p.type === "minute") {
      minute = Number(p.value);
    } else if (p.type === "second") {
      second = Number(p.value);
    }
  }
  return { year, month, day, hour, minute, second };
}

/**
 * Extract hour/minute/second only. Used by getWallClock.
 */
function extractTimeParts(
  dtf: Intl.DateTimeFormat,
  ts: number,
): { hour: number; minute: number; second: number } {
  let hour = 0,
    minute = 0,
    second = 0;
  for (const p of dtf.formatToParts(new Date(ts))) {
    if (p.type === "hour") {
      hour = Number(p.value);
    } else if (p.type === "minute") {
      minute = Number(p.value);
    } else if (p.type === "second") {
      second = Number(p.value);
    }
  }
  return { hour, minute, second };
}

/* ------------------------------------------------------------------ */
/*  Abbreviation overrides                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  PAD2 lookup table (zero-padded 2-digit numbers 00-59)            */
/* ------------------------------------------------------------------ */

const PAD2 = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
];

/* ------------------------------------------------------------------ */
/*  Digit helpers (charCodeAt-based, no regex/parseInt allocation)     */
/* ------------------------------------------------------------------ */

function isDigit(str: string, i: number): boolean {
  const c = str.charCodeAt(i);
  return c >= 48 && c <= 57;
}

function p2(str: string, i: number): number {
  return (str.charCodeAt(i) - 48) * 10 + (str.charCodeAt(i + 1) - 48);
}

function p4(str: string, i: number): number {
  return p2(str, i) * 100 + p2(str, i + 2);
}

function parseMsTail(str: string, i: number, end: number): number {
  const avail = end - i;
  if (avail <= 0) {
    return 0;
  }
  const digits = avail < 3 ? avail : 3;
  let ms = 0;
  for (let j = 0; j < digits; j++) {
    ms = ms * 10 + (str.charCodeAt(i + j) - 48);
  }
  for (let j = digits; j < 3; j++) {
    ms = ms * 10;
  }
  return ms;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function normalizeTz(tz: string): string {
  // Hot path: tz is already the normalized name (no lowercase, no alias).
  // Skip toUpperCase for common non-UTC/GMT zones like America/New_York.
  const len = tz.length;
  if (len <= 4) {
    const c0 = tz.charCodeAt(0);
    if (c0 === 85 || c0 === 117) {
      // U or u — check for UTC
      if (tz.toUpperCase() === "UTC") {
        return "UTC";
      }
    } else if (c0 === 71 || c0 === 103) {
      // G or g — check for GMT
      if (tz.toUpperCase() === "GMT") {
        return "GMT";
      }
    }
  }
  const aliased = ZONE_ALIAS[tz];
  if (aliased) {
    return aliased;
  }
  return tz;
}

/** Wrapper for callers that only have the zone name. */
function getOffsetByZone(tz: string, timestamp: number): number {
  if (isUtcOrGmt(tz)) {
    return 0;
  }
  tz = normalizeTz(tz);
  if (isUtcOrGmt(tz)) {
    return 0;
  }
  return getOffset(ensureZoneData(tz), tz, timestamp);
}

/**
 * Compute offset from Intl without any caching.
 * Used by getOffset() and by day-stability probing.
 */
function computeOffsetRaw(zd: ZoneData, tz: string, timestamp: number): number {
  let dtf = zd.offsetFormatter;
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    zd.offsetFormatter = dtf;
  }
  const wall = extractWallParts(dtf, timestamp);
  const wallTs = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return Math.round((wallTs - timestamp) / MINUTE_MS) || 0;
}

function getOffset(zd: ZoneData, tz: string, timestamp: number): number {
  const dayKey = Math.floor(timestamp / DAY_MS);
  const dayCached = zd.dayOffsetCache.get(dayKey);
  if (dayCached !== undefined) {
    return dayCached;
  }

  const secKey = (timestamp / SECOND_MS) | 0;
  const cached = zd.offsetCache.get(secKey);
  if (cached !== undefined) {
    return cached;
  }

  const offset = computeOffsetRaw(zd, tz, timestamp);
  zd.offsetCache.set(secKey, offset);

  if (!zd.probedDays?.has(dayKey)) {
    (zd.probedDays ??= new Set()).add(dayKey);
    const dayStart = dayKey * DAY_MS;
    const offStart = computeOffsetRaw(zd, tz, dayStart);
    const offNoon = computeOffsetRaw(zd, tz, dayStart + 12 * HOUR_MS);
    const offEnd = computeOffsetRaw(zd, tz, dayStart + DAY_MS - 1);
    if (offStart === offNoon && offNoon === offEnd) {
      zd.dayOffsetCache.set(dayKey, offStart);
    }
  }

  return offset;
}

/** Get wall-clock components (hour, minute, second) in a given zone. */
function getWallClock(ts: number, tz: string): { hour: number; minute: number; second: number } {
  if (isUtcOrGmt(tz)) {
    const d = new Date(ts);
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds() };
  }
  const zd = ensureZoneData(tz);
  let dtf = zd.wallFormatter;
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    zd.wallFormatter = dtf;
  }
  return extractTimeParts(dtf, ts);
}

function getAbbr(tz: string, ts: number): string {
  if (tz === "UTC") {
    return "UTC";
  }
  if (tz === "GMT") {
    return "GMT";
  }

  const zd = ensureZoneData(tz);

  const dayKey = Math.floor(ts / DAY_MS);
  const dayCached = zd.abbrDayCache.get(dayKey);
  if (dayCached !== undefined) {
    return dayCached;
  }

  const secKey = Math.floor(ts / SECOND_MS);
  const cached = zd.abbrCache.get(secKey);
  if (cached !== undefined) {
    return cached;
  }

  const abbr = computeAbbr(zd, tz, ts);

  zd.abbrCache.set(secKey, abbr);

  if (!zd.abbrProbedDays?.has(dayKey)) {
    (zd.abbrProbedDays ??= new Set()).add(dayKey);
    const dayStart = dayKey * DAY_MS;
    const a0 = computeAbbr(zd, tz, dayStart);
    const a1 = computeAbbr(zd, tz, dayStart + 12 * HOUR_MS);
    const a2 = computeAbbr(zd, tz, dayStart + DAY_MS - 1);
    if (a0 === a1 && a1 === a2) {
      zd.abbrDayCache.set(dayKey, a0);
    }
  }

  return abbr;
}

/**
 * Compute abbreviation without any caching.
 * Used by getAbbr() and by day-stability probing.
 */
function computeAbbr(zd: ZoneData, tz: string, ts: number): string {
  // Try the locale that previously succeeded for this zone.
  if (zd.abbrLocale) {
    const abbr = tryLocaleAbbr(zd, tz, ts, zd.abbrLocale);
    if (abbr !== null) {
      return abbr;
    }
  }

  // Try all configured locales.
  for (const loc of ABBR_LOCALES) {
    const abbr = tryLocaleAbbr(zd, tz, ts, loc);
    if (abbr !== null) {
      zd.abbrLocale = loc;
      return abbr;
    }
  }

  if (tz in KNOWN_ABBR) {
    return KNOWN_ABBR[tz];
  }
  if (tz === "Pacific/Chatham") {
    const offset = getOffsetByZone(tz, ts);
    const abs = Math.abs(offset);
    const sign = offset >= 0 ? "+" : "-";
    return `${sign}${PAD2[Math.floor(abs / 60)]}${PAD2[abs % 60]}`;
  }
  if (tz in ABBR_OFFSET_ZONES) {
    return ABBR_OFFSET_ZONES[tz];
  }
  const offset = getOffsetByZone(tz, ts);
  const abs = Math.abs(offset);
  const sign = offset >= 0 ? "+" : "-";
  return `GMT${sign}${PAD2[Math.floor(abs / 60)]}${abs % 60 ? PAD2[abs % 60] : ""}`;
}

let zoneNamesSet: Set<string> | null = null;

function isZoneName(s: string): boolean {
  const u = s.toUpperCase();
  if (u === "UTC" || u === "GMT") {
    return true;
  }
  if (!s.includes("/")) {
    return false;
  }
  return isZoneNameIntl(s);
}

function isZoneNameIntl(s: string): boolean {
  try {
    zoneNamesSet ??= new Set(intlTZNames());
    if (zoneNamesSet.has(s)) {
      return true;
    }
    if (s in ZONE_ALIAS) {
      const canonical = ZONE_ALIAS[s];
      if (zoneNamesSet.has(canonical)) {
        return true;
      }
    }
    for (const alias of Object.keys(ZONE_ALIAS)) {
      if (ZONE_ALIAS[alias] === s && zoneNamesSet.has(alias)) {
        return true;
      }
    }
    return false;
  } catch {
    return s.includes("/");
  }
}

function hasExplicitOffset(input: string): boolean {
  const len = input.length;
  let i = len;
  while (i > 0 && input.charCodeAt(i - 1) <= 32) {
    i--;
  }
  if (i < 5) {
    return false;
  }
  const last = input.charCodeAt(i - 1);
  if (last === 90 || last === 122) {
    return true;
  }
  if (last < 48 || last > 57) {
    return false;
  }
  if (
    i >= 7 &&
    isDigit(input, i - 1) &&
    isDigit(input, i - 2) &&
    input.charCodeAt(i - 3) === 58 &&
    isDigit(input, i - 4) &&
    isDigit(input, i - 5)
  ) {
    const sign = input.charCodeAt(i - 6);
    return sign === 43 || sign === 45;
  }
  if (
    i >= 5 &&
    isDigit(input, i - 1) &&
    isDigit(input, i - 2) &&
    isDigit(input, i - 3) &&
    isDigit(input, i - 4)
  ) {
    const sign = input.charCodeAt(i - 5);
    return sign === 43 || sign === 45;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Plugin installation                                               */
/* ------------------------------------------------------------------ */

export function installTimezone(moment: MomentLike): MomentLike {
  if (moment.tz) {
    return moment;
  }

  moment.momentProperties.push("_z");

  /**
   * Parse a wall-clock time string in a given timezone.
   * For ISO-like strings, components are extracted directly from the
   * input to avoid local-timezone interference (e.g. spring-forward
   * boundaries in the host TZ affecting the parsed hour value).
   */
  function parseInZone(input: string, zone: string, format?: string): MomentInstance {
    let y = 0,
      M = 0,
      d = 1,
      h = 0,
      min = 0,
      s = 0,
      ms = 0;

    if (format) {
      // oxlint-disable-next-line no-explicit-any
      const m = (moment as any)(input, format);
      if (!m.isValid()) {
        return m;
      }
      y = m.year();
      M = m.month();
      d = m.date();
      h = m.hour();
      min = m.minute();
      s = m.second();
      ms = m.millisecond();
    } else {
      const len = input.length;
      let iso = false;
      if (
        len >= 16 &&
        isDigit(input, 0) &&
        isDigit(input, 1) &&
        isDigit(input, 2) &&
        isDigit(input, 3) &&
        input.charCodeAt(4) === 45 &&
        isDigit(input, 5) &&
        isDigit(input, 6) &&
        input.charCodeAt(7) === 45 &&
        isDigit(input, 8) &&
        isDigit(input, 9)
      ) {
        const sep = input.charCodeAt(10);
        if (
          (sep === 84 || sep === 32) &&
          isDigit(input, 11) &&
          isDigit(input, 12) &&
          input.charCodeAt(13) === 58 &&
          isDigit(input, 14) &&
          isDigit(input, 15)
        ) {
          y = p4(input, 0);
          M = p2(input, 5) - 1;
          d = p2(input, 8);
          h = p2(input, 11);
          min = p2(input, 14);
          if (
            len >= 19 &&
            input.charCodeAt(16) === 58 &&
            isDigit(input, 17) &&
            isDigit(input, 18)
          ) {
            s = p2(input, 17);
            ms = len > 19 && input.charCodeAt(19) === 46 ? parseMsTail(input, 20, len) : 0;
          } else {
            s = 0;
            ms = 0;
          }
          iso = true;
        }
      }
      if (!iso) {
        // oxlint-disable-next-line no-explicit-any
        const m = (moment as any)(input);
        if (!m.isValid()) {
          return m;
        }
        y = m.year();
        M = m.month();
        d = m.date();
        h = m.hour();
        min = m.minute();
        s = m.second();
        ms = m.millisecond();
      }
    }

    const guess = Date.UTC(y, M, d, h, min, s, ms);
    const initialOffset = getOffsetByZone(zone, guess);
    let ts = guess - initialOffset * MINUTE_MS;
    let secondOffset = getOffsetByZone(zone, ts);

    if (initialOffset !== secondOffset) {
      const ts2 = guess - secondOffset * MINUTE_MS;
      const thirdOffset = getOffsetByZone(zone, ts2);
      if (thirdOffset === secondOffset) {
        const wc = getWallClock(ts2, zone);
        if (wc.hour === h && wc.minute === min) {
          ts = ts2;
        } else {
          const preOffset = Math.min(initialOffset, secondOffset);
          ts = guess - preOffset * MINUTE_MS;
          secondOffset = Math.max(initialOffset, secondOffset);
        }
      } else {
        for (const off of [initialOffset, secondOffset]) {
          const candidateTs = guess - off * MINUTE_MS;
          const wc = getWallClock(candidateTs, zone);
          if (wc.hour === h && wc.minute === min && wc.second === s) {
            ts = candidateTs;
            secondOffset = off;
            break;
          }
        }
      }
    }

    {
      const wc = getWallClock(ts, zone);
      if (wc.hour !== h || wc.minute !== min || wc.second !== s) {
        const dstOff = Math.max(initialOffset, secondOffset);
        const springGuess = Date.UTC(y, M, d, h + 1, min, s, ms);
        ts = springGuess - dstOff * MINUTE_MS;
        secondOffset = dstOff;
      }
    }

    if (initialOffset === secondOffset) {
      for (const offsetDelta of [60, -60]) {
        const testOff = secondOffset + offsetDelta;
        const testTs = guess - testOff * MINUTE_MS;
        const actualOff = getOffsetByZone(zone, testTs);
        if (actualOff !== testOff) {
          continue;
        }
        const wc = getWallClock(testTs, zone);
        if (wc.hour === h && wc.minute === min && wc.second === s) {
          if (testOff > secondOffset) {
            ts = testTs;
            secondOffset = testOff;
          }
          break;
        }
      }
    }

    // oxlint-disable-next-line no-explicit-any
    const result = (moment as any)(ts) as MomentInstance;
    result.utcOffset(secondOffset, false);
    result._z = new MomentTzZone(zone);
    return result;
  }

  // oxlint-disable-next-line no-explicit-any
  function momentTz(input?: any, formatOrZone?: any, zoneOrStrict?: any, _fourth?: any): any {
    if (typeof formatOrZone === "string" && isZoneName(formatOrZone)) {
      const tz = normalizeTz(formatOrZone);
      if (input === undefined || input === null) {
        return moment().tz(tz);
      }
      if (typeof input === "string" && !hasExplicitOffset(input)) {
        return parseInZone(input, tz);
      }
      const m = moment(input);
      return m.tz(tz);
    }

    if (
      typeof input === "string" &&
      typeof formatOrZone === "string" &&
      typeof zoneOrStrict === "string" &&
      isZoneName(zoneOrStrict)
    ) {
      const fmt = formatOrZone;
      const tz = normalizeTz(zoneOrStrict);
      return parseInZone(input, tz, fmt);
    }

    if (
      typeof input === "string" &&
      typeof formatOrZone === "string" &&
      typeof zoneOrStrict === "boolean"
    ) {
      const fmt = formatOrZone;
      const strict = zoneOrStrict;
      if (typeof _fourth === "string" && isZoneName(_fourth)) {
        const tz = normalizeTz(_fourth);
        return parseInZone(input, tz, fmt);
      }
      const m = moment(input, fmt, strict);
      return m;
    }

    if (typeof input === "string" && typeof formatOrZone === "string") {
      const m = moment(input, formatOrZone);
      return m;
    }

    if (typeof input === "string") {
      return moment().tz(input);
    }

    return input !== undefined ? moment(input) : moment();
  }

  // oxlint-disable-next-line no-explicit-any
  function fnTz(this: any, tz?: string, keepTime?: boolean): any {
    if (tz === undefined) {
      return this._z ? this._z.name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    tz = normalizeTz(tz);
    const timestamp = this.valueOf();
    const m = this.clone();

    const zoneInfo = moment.tz!.zone(tz);
    if (zoneInfo) {
      m._z = zoneInfo;
      const targetOffset = -zoneInfo.offset(timestamp) || 0;
      m.utcOffset(targetOffset, keepTime);
    } else {
      const targetOffset = getOffsetByZone(tz, timestamp) || 0;
      m.utcOffset(targetOffset, keepTime);
      m._z = new MomentTzZone(tz);
    }

    return m;
  }

  moment.tz = momentTz as unknown as MomentTz;
  moment.fn.tz = fnTz;

  const origZoneName = moment.fn.zoneName as (() => string) | undefined;
  const origZoneAbbr = moment.fn.zoneAbbr as (() => string) | undefined;
  // Patch isDST to use zone offsets instead of local TZ offsets
  // oxlint-disable-next-line no-explicit-any
  const origIsDST = (moment.fn as any).isDST as ((...args: unknown[]) => boolean) | undefined;
  // oxlint-disable-next-line no-explicit-any
  (moment.fn as any).isDST = function (this: any): boolean {
    if (this._z) {
      const ts = this.valueOf();
      const z = this._z.name;
      const d = new Date(ts);
      const year = d.getUTCFullYear();
      const janOff = getOffsetByZone(z, Date.UTC(year, 0, 1));
      const julOff = getOffsetByZone(z, Date.UTC(year, 6, 1));
      const standardOff = Math.min(janOff, julOff);
      const currentOff = getOffsetByZone(z, ts);
      return currentOff !== standardOff;
    }
    return origIsDST ? origIsDST.call(this) : false;
  };

  // oxlint-disable-next-line no-explicit-any
  (moment.fn as any).zoneName = function (this: any): string {
    if (this._z) {
      return this._z.abbr(this.valueOf());
    }
    return origZoneName ? origZoneName.call(this) : "";
  };
  // oxlint-disable-next-line no-explicit-any
  (moment.fn as any).zoneAbbr = function (this: any): string {
    if (this._z) {
      return this._z.abbr(this.valueOf());
    }
    return origZoneAbbr ? origZoneAbbr.call(this) : "";
  };

  moment.tz.guess = function (_preferCache?: boolean): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  };

  moment.tz.names = function (): string[] {
    try {
      return intlTZNames().sort();
    } catch {
      return [
        "UTC",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
        "Europe/Berlin",
        "Europe/Moscow",
        "Asia/Tokyo",
        "Asia/Shanghai",
        "Asia/Hong_Kong",
        "Asia/Singapore",
        "Asia/Seoul",
        "Asia/Kolkata",
        "Australia/Sydney",
        "Pacific/Auckland",
        "Africa/Cairo",
        "Africa/Johannesburg",
      ];
    }
  };

  moment.tz.zone = function (name: string): MomentTzZone | null {
    const normalized = normalizeTz(name);
    if (!isZoneName(name)) {
      return null;
    }

    const cached = zoneObjectCache.get(normalized);
    if (cached) {
      return cached;
    }

    const zone = new MomentTzZone(normalized);
    zoneObjectCache.set(normalized, zone);
    return zone;
  };

  moment.tz.add = function (_data: unknown): void {
    console.warn(
      "[moment2-timezone] .tz.add() is a no-op — timezone data comes from the runtime Intl API",
    );
  };

  moment.tz.link = function (_links: unknown): void {};

  moment.tz.setDefault = function (tz: string): void {
    moment.defaultZone = tz;
  };

  moment.tz.countries = function (): string[] {
    return [];
  };

  moment.tz.zonesForCountry = function (_code: string): string[] {
    return [];
  };

  return moment;
}
