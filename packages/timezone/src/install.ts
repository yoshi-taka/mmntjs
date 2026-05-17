interface MomentFnProps {
  tz: (this: unknown, tz?: string) => unknown;
  [key: string]: unknown;
}

interface MomentTzZone {
  name: string;
  abbr: (ts: number) => string;
  offset: (ts: number) => number;
  utcOffset: (ts: number) => number;
  parse: (ts: number) => number;
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
  _z?: { name: string; abbr: (ts: number) => string };
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

function normalizeTz(tz: string): string {
  const u = tz.toUpperCase();
  if (u === "UTC" || u === "GMT") {
    return u;
  }
  const aliased = ZONE_ALIAS[tz];
  if (aliased) {
    return aliased;
  }
  return tz;
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
        const abbr = m[1];
        if (/^[A-Z]{2,5}$/.test(abbr) && abbr !== "Time") {
          return abbr;
        }
      }
    } catch {
      /* skip */
    }
  }

  if (tz in KNOWN_ABBR) {
    return KNOWN_ABBR[tz];
  }
  if (tz in ABBR_OFFSET_ZONES) {
    return ABBR_OFFSET_ZONES[tz];
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

  const key = timestamp;

  const cached = domain.get(key);
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
    const hrs = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const s = hrs >= 0 ? 1 : -1;
    offset = hrs * 60 + s * min;
  }

  domain.set(key, offset);
  return offset;
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
  try {
    zoneNamesSet ??= new Set(
      (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
        "timeZone",
      ),
    );
    if (zoneNamesSet.has(s)) {
      return true;
    }
    if (s in ZONE_ALIAS) {
      return zoneNamesSet.has(ZONE_ALIAS[s]);
    }
    // Reverse alias lookup: s may be a canonical name whose legacy key exists in Intl
    for (const [alias, canonical] of Object.entries(ZONE_ALIAS)) {
      if (canonical === s && zoneNamesSet.has(alias)) {
        return true;
      }
    }
    return false;
  } catch {
    return s.includes("/");
  }
}

/** Check if a string input has an explicit timezone offset (e.g. +09:00, Z) */
function hasExplicitOffset(input: string): boolean {
  // Strip leading/trailing whitespace, check for trailing Z or +/-HH:MM or +/-HHMM
  const trimmed = input.trim();
  return /(Z|[+-]\d{2}:?\d{2})\s*$/.test(trimmed);
}

export function installTimezone(moment: MomentLike): MomentLike {
  if (moment.tz) {
    return moment;
  }

  moment.momentProperties.push("_z");

  /**
   * Parse a wall-clock time string in a given timezone.
   * moment-timezone interprets the wall-clock components as being in the target zone,
   * NOT as local time followed by conversion.
   */
  function parseInZone(input: string, zone: string, format?: string): MomentInstance {
    // oxlint-disable-next-line no-explicit-any
    const m = format ? (moment as any)(input, format) : (moment as any)(input);
    if (!m.isValid()) {
      return m;
    }

    const y = m.year();
    const M = m.month();
    const d = m.date();
    const h = m.hour();
    const min = m.minute();
    const s = m.second();
    const ms = m.millisecond();

    // Determine wall clock in target zone at a given UTC timestamp
    function wallParts(ts: number): { h: number; min: number; s: number } | null {
      try {
        const dt = new Date(ts);
        const wall = dt.toLocaleString("en-US", {
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
          h: parseInt(parts[1], 10),
          min: parseInt(parts[2], 10),
          s: parseInt(parts[3], 10),
        };
      } catch {
        return null;
      }
    }

    // Build the set of candidate offsets to try.
    // Start with the offset at the wall-clock-as-UTC timestamp.
    const guess = Date.UTC(y, M, d, h, min, s, ms);
    const trialOffsets = new Set<number>();

    // Gather offsets from interesting reference points
    const refs = [
      guess,
      Date.UTC(y, M, d, 0, 0, 0, 0), // midnight UTC
      Date.UTC(y, M, d, 12, 0, 0, 0), // noon UTC
      Date.UTC(y, M, d - 1, 12, 0, 0, 0), // previous noon UTC
    ];
    for (const r of refs) {
      trialOffsets.add(getOffset(zone, r));
    }

    // Also add ±30m around each candidate
    const baseOffsets = [...trialOffsets];
    for (const o of baseOffsets) {
      trialOffsets.add(o + 30);
      trialOffsets.add(o - 30);
    }

    // Try offsets sorted by preference: larger (DST side) first for fall-back.
    const sorted = [...trialOffsets].sort((a, b) => b - a);
    let bestTs = 0;
    let bestOffset = sorted[0];
    let found = false;

    for (const o of sorted) {
      const candidateTs = guess - o * 60000;
      const actualO = getOffset(zone, candidateTs);
      if (actualO !== o) {
        continue;
      } // this offset isn't actually in use here
      const wp = wallParts(candidateTs);
      if (wp && wp.h === h && wp.min === min && wp.s === s) {
        bestTs = candidateTs;
        bestOffset = o;
        found = true;
        break;
      }
    }

    if (!found) {
      // Spring-forward gap: no wall-clock time exists for this input.
      const offA = getOffset(zone, guess);
      const tsA = guess - offA * 60000;
      const offB = getOffset(zone, tsA);
      const postGapOff = Math.max(offA, offB);
      const gapMinutes = Math.abs(offB - offA);
      // Advance wall-clock by the gap duration, then apply post-gap offset
      const adjustedGuess = guess + gapMinutes * 60000;
      bestOffset = postGapOff;
      bestTs = adjustedGuess - bestOffset * 60000;
    }

    // oxlint-disable-next-line no-explicit-any
    const result = (moment as any)(bestTs) as MomentInstance;
    result.utcOffset(bestOffset === 0 ? 0 : bestOffset, false);
    result._z = { name: zone, abbr: (t: number) => getAbbr(zone, t) };
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
      const targetOffset = -zoneInfo.offset(timestamp);
      m.utcOffset(targetOffset === 0 ? 0 : targetOffset, keepTime);
    } else {
      const targetOffset = getOffset(tz, timestamp);
      m.utcOffset(targetOffset === 0 ? 0 : targetOffset, keepTime);
      m._z = { name: tz, abbr: (_ts: number) => getAbbr(tz, _ts) };
    }

    return m;
  }

  moment.tz = momentTz as unknown as MomentTz;
  moment.fn.tz = fnTz;

  const origZoneName = moment.fn.zoneName as (() => string) | undefined;
  const origZoneAbbr = moment.fn.zoneAbbr as (() => string) | undefined;
  const origIsDST = (moment.fn as unknown as Record<string, unknown>).isDST as
    | ((...args: unknown[]) => boolean)
    | undefined;
  (moment.fn as unknown as Record<string, unknown>).isDST = function (
    this: Record<string, unknown>,
  ): boolean {
    if (this._z) {
      const z = (this._z as MomentTzZone).name;
      const ts = (this as unknown as { valueOf(): number }).valueOf();
      const d = new Date(ts);
      const year = d.getUTCFullYear();
      const janOff = getOffset(z, Date.UTC(year, 0, 1));
      const julOff = getOffset(z, Date.UTC(year, 6, 1));
      const standardOff = Math.min(janOff, julOff);
      const currentOff = getOffset(z, ts);
      return currentOff !== standardOff;
    }
    return origIsDST ? origIsDST.call(this) : false;
  };
  (moment.fn as unknown as Record<string, unknown>).zoneName = function (
    this: Record<string, unknown>,
  ): string {
    if (this._z) {
      return (this._z as MomentTzZone).abbr((this as unknown as { valueOf(): number }).valueOf());
    }
    return origZoneName ? origZoneName.call(this) : "";
  };
  (moment.fn as unknown as Record<string, unknown>).zoneAbbr = function (
    this: Record<string, unknown>,
  ): string {
    if (this._z) {
      return (this._z as MomentTzZone).abbr((this as unknown as { valueOf(): number }).valueOf());
    }
    return origZoneAbbr ? origZoneAbbr.call(this) : "";
  };

  moment.tz.guess = function (_preferCache?: boolean): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  };

  moment.tz.names = function (): string[] {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] })
        .supportedValuesOf("timeZone")
        .sort();
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

  function resolveZoneName(name: string): string | null {
    const normalized = normalizeTz(name);
    try {
      const names = moment.tz!.names();
      if (names.includes(normalized)) {
        return normalized;
      }
    } catch {
      /* skip */
    }
    // Check reverse alias (e.g. Asia/Kolkata → Asia/Calcutta on macOS)
    for (const [alias, target] of Object.entries(ZONE_ALIAS)) {
      if (normalized === target || normalized === alias) {
        try {
          const names = moment.tz!.names();
          if (names.includes(alias)) {
            return alias;
          }
          if (names.includes(target)) {
            return target;
          }
        } catch {
          /* skip */
        }
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      }
    }
    return null;
  }
  moment.tz.zone = function (name: string): MomentTzZone | null {
    const resolved = resolveZoneName(name);
    if (!resolved) {
      return null;
    }
    return {
      name,
      abbr: (ts: number) => getAbbr(resolved, ts),
      offset: (ts: number) => {
        const o = -getOffset(resolved, ts);
        return o === 0 ? 0 : o;
      },
      utcOffset: (ts: number) => {
        const o = -getOffset(resolved, ts);
        return o === 0 ? 0 : o;
      },
      parse: (ts: number) => {
        const o = -getOffset(resolved, ts);
        return o === 0 ? 0 : o;
      },
    };
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
