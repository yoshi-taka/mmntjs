interface MomentFnProps {
  tz: (this: unknown, tz?: string) => unknown;
  [key: string]: unknown;
}

interface MomentTzZone {
  name: string;
  abbr: (ts: number) => string;
  offset: (ts: number) => number;
  utcOffset: (ts: number) => number;
  parse: (ts: number) => { name: string; offset: number };
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

/** Hardcoded abbreviation overrides for zones where Intl doesn't return traditional abbreviations. */
/** Map IANA alias → canonical name for zones renamed by CLDR. */
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
  "Pacific/Chatham": "",
  "Pacific/Fiji": "FJT",
  "Pacific/Norfolk": "NFT",
  "Pacific/Guam": "ChST",
  "Pacific/Saipan": "ChST",
  "Africa/Cairo": "EET",
  "Africa/Johannesburg": "SAST",
  "Africa/Nairobi": "EAT",
  "Africa/Lagos": "WAT",
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
  const d = new Date(ts);
  for (const loc of ABBR_LOCALES) {
    try {
      const full = d.toLocaleString(loc, { timeZone: tz, timeZoneName: "short" });
      const m = full.match(/\s(\S+)$/);
      if (m) {
        const abbr = m[1];
        if (
          abbr === "GMT" ||
          (/^[A-Z]{2,5}$/.test(abbr) && !abbr.startsWith("GMT") && abbr !== "Time")
        ) {
          return abbr;
        }
      }
    } catch {
      /* skip */
    }
  }
  if (tz in KNOWN_ABBR) {
    const known = KNOWN_ABBR[tz];
    if (known === "") {
      const offset = getOffset(tz, ts);
      const abs = Math.abs(offset);
      const hrs = Math.floor(abs / 60);
      const min = abs % 60;
      const sign = offset >= 0 ? "+" : "-";
      return `${sign}${String(hrs).padStart(2, "0")}${String(min).padStart(2, "0")}`;
    }
    if (known.startsWith("+") || known.startsWith("-")) {
      return known;
    }
    return known;
  }
  const offset = getOffset(tz, ts);
  const abs = Math.abs(offset);
  const hrs = Math.floor(abs / 60);
  const min = abs % 60;
  const sign = offset >= 0 ? "+" : "-";
  return `GMT${sign}${String(hrs).padStart(2, "0")}${min ? String(min).padStart(2, "0") : ""}`;
}

function getOffset(tz: string, timestamp: number): number {
  tz = normalizeTz(tz);
  let domain = offsetCache.get(tz);
  if (!domain) {
    domain = new Map();
    offsetCache.set(tz, domain);
  }

  const key = Math.round(timestamp / 1000);

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
    // Direct hit (canonical name in Intl)
    if (zoneNamesSet.has(s)) { return true; }
    // Check if s is an alias whose canonical form is in Intl
    if (s in ZONE_ALIAS) {
      const canonical = ZONE_ALIAS[s];
      if (zoneNamesSet.has(canonical)) { return true; }
    }
    // Check if s is a canonical name whose alias is in Intl
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

    const guess = Date.UTC(y, M, d, h, min, s, ms);
    const initialOffset = getOffset(zone, guess);
    let ts = guess - initialOffset * 60000;
    let secondOffset = getOffset(zone, ts);

    if (initialOffset !== secondOffset) {
      const ts2 = guess - secondOffset * 60000;
      const thirdOffset = getOffset(zone, ts2);
      if (thirdOffset === secondOffset) {
        const d2 = new Date(ts2);
        const wall = d2.toLocaleString("en-US", {
          timeZone: zone,
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        });
        const wallH = parseInt(wall.slice(0, 2), 10);
        if (wallH === h && wall.slice(3, 5) === String(min).padStart(2, "0")) {
          ts = ts2;
        } else {
          const preOffset = Math.min(initialOffset, secondOffset);
          ts = guess - preOffset * 60000;
          secondOffset = Math.max(initialOffset, secondOffset);
        }
      } else {
        const preOffset = Math.min(initialOffset, secondOffset);
        ts = guess - preOffset * 60000;
        secondOffset = Math.max(initialOffset, secondOffset);
      }
    }

    // oxlint-disable-next-line no-explicit-any
    const result = (moment as any)(ts) as MomentInstance;
    result.utcOffset(secondOffset, false);
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
      m.utcOffset(targetOffset, keepTime);
    } else {
      const targetOffset = getOffset(tz, timestamp);
      m.utcOffset(targetOffset, keepTime);
      m._z = { name: tz, abbr: (_ts: number) => getAbbr(tz, _ts) };
    }

    return m;
  }

  moment.tz = momentTz as unknown as MomentTz;
  moment.fn.tz = fnTz;

  // Patch zoneName/zoneAbbr to return abbreviation when _z is set (moment-timezone compat)
  const origZoneName = moment.fn.zoneName as (() => string) | undefined;
  const origZoneAbbr = moment.fn.zoneAbbr as (() => string) | undefined;
  // oxlint-disable-next-line no-explicit-any
  (moment.fn as any).zoneName = function (this: any): string {
    if (this._z) { return this._z.abbr(this.valueOf()); }
    return origZoneName ? origZoneName.call(this) : "";
  };
  // oxlint-disable-next-line no-explicit-any
  (moment.fn as any).zoneAbbr = function (this: any): string {
    if (this._z) { return this._z.abbr(this.valueOf()); }
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

  moment.tz.zone = function (name: string): MomentTzZone | null {
    const normalized = normalizeTz(name);
    if (!isZoneName(name)) {
      return null;
    }

    const off = (ts: number) => getOffset(normalized, ts);

    return {
      name: normalized,
      abbr: (ts: number) => getAbbr(normalized, ts),
      offset: (ts: number) => -off(ts),
      utcOffset: (ts: number) => -off(ts),
      parse: (ts: number) => ({
        name: normalized,
        offset: -off(ts),
      }),
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
