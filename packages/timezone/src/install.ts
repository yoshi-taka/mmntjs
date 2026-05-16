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

/* ------------------------------------------------------------------ */
/*  Caches                                                             */
/* ------------------------------------------------------------------ */

const offsetCache = new Map<string, Map<number, number>>();
const MAX_DOMAIN_CACHE_SIZE = 1000;

/** Cached Intl.DateTimeFormat per timezone for offset computation. */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Cached Intl.DateTimeFormat per timezone for wall-clock extraction. */
const wallFormatters = new Map<string, Intl.DateTimeFormat>();

function getOffsetFormatter(tz: string): Intl.DateTimeFormat {
  let dtf = offsetFormatters.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(tz, dtf);
  }
  return dtf;
}

function getWallFormatter(tz: string): Intl.DateTimeFormat {
  let dtf = wallFormatters.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    wallFormatters.set(tz, dtf);
  }
  return dtf;
}

/** Extract typed wall-clock components from formatToParts output. */
function parseParts(parts: Intl.DateTimeFormatPart[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const p of parts) {
    if (
      p.type !== "literal" &&
      p.type !== "dayPeriod" &&
      p.type !== "timeZoneName" &&
      p.type !== "era"
    ) {
      result[p.type] = parseInt(p.value, 10);
    }
  }
  return result;
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

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

function getOffset(tz: string, timestamp: number): number {
  tz = normalizeTz(tz);
  let domain = offsetCache.get(tz);
  if (!domain) {
    domain = new Map();
    offsetCache.set(tz, domain);
  }

  // Use Math.floor for deterministic cache key. This returns the offset
  // for any timestamp in the same second, which is safe since DST
  // transitions never happen more frequently than once per second.
  const key = Math.floor(timestamp / 1000);

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
  const dtf = getOffsetFormatter(tz);
  const parts = dtf.formatToParts(d);
  const vals = parseParts(parts);

  // Compute offset by comparing wall-clock in target zone to UTC epoch.
  const y = vals.year || 0;
  const M = (vals.month || 1) - 1;
  const day = vals.day || 1;
  const h = vals.hour || 0;
  const min = vals.minute || 0;
  const sec = vals.second || 0;

  const wallTs = Date.UTC(y, M, day, h, min, sec);
  // Round to nearest minute: wallTs has second precision but timestamp
  // may have milliseconds, causing sub-minute drift. Use "|| 0" to
  // coerce -0 to 0 (Object.is(-0,0) === false, which breaks .toBe()).
  const offset = Math.round((wallTs - timestamp) / 60000) || 0;

  domain.set(key, offset);
  return offset;
}

/** Get wall-clock components (hour, minute, second) in a given zone. */
function getWallClock(ts: number, tz: string): { hour: number; minute: number; second: number } {
  const dtf = getWallFormatter(tz);
  const parts = dtf.formatToParts(new Date(ts));
  const vals = parseParts(parts);
  return {
    hour: vals.hour || 0,
    minute: vals.minute || 0,
    second: vals.second || 0,
  };
}

function getAbbr(tz: string, ts: number): string {
  const d = new Date(ts);
  for (const loc of ABBR_LOCALES) {
    try {
      const dtf = new Intl.DateTimeFormat(loc, {
        timeZone: tz,
        timeZoneName: "short",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      const parts = dtf.formatToParts(d);
      const tzPart = parts.find((p) => p.type === "timeZoneName");
      if (tzPart) {
        const abbr = tzPart.value;
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
  const trimmed = input.trim();
  return /(Z|[+-]\d{2}:?\d{2})\s*$/.test(trimmed);
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
    let y: number, M: number, d: number, h: number, min: number, s: number, ms: number;

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
      // Parse ISO-like "YYYY-MM-DD HH:mm:ss" directly from the input
      // string to avoid local-TZ spring-forward boundary interference.
      const isoMatch = input.match(
        /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?/,
      );
      if (isoMatch) {
        y = parseInt(isoMatch[1], 10);
        M = parseInt(isoMatch[2], 10) - 1;
        d = parseInt(isoMatch[3], 10);
        h = parseInt(isoMatch[4], 10);
        min = parseInt(isoMatch[5], 10);
        s = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
        ms = isoMatch[7] ? parseInt(isoMatch[7].padEnd(3, "0"), 10) : 0;
      } else {
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
    const initialOffset = getOffset(zone, guess);
    let ts = guess - initialOffset * 60000;
    let secondOffset = getOffset(zone, ts);

    if (initialOffset !== secondOffset) {
      const ts2 = guess - secondOffset * 60000;
      const thirdOffset = getOffset(zone, ts2);
      if (thirdOffset === secondOffset) {
        const wc = getWallClock(ts2, zone);
        if (wc.hour === h && wc.minute === min) {
          ts = ts2;
        } else {
          const preOffset = Math.min(initialOffset, secondOffset);
          ts = guess - preOffset * 60000;
          secondOffset = Math.max(initialOffset, secondOffset);
        }
      } else {
        // Transition boundary — try both offsets for wall-clock match.
        for (const off of [initialOffset, secondOffset]) {
          const candidateTs = guess - off * 60000;
          const wc = getWallClock(candidateTs, zone);
          if (wc.hour === h && wc.minute === min && wc.second === s) {
            ts = candidateTs;
            secondOffset = off;
            break;
          }
        }
      }
    }

    // Spring-forward adjustment: if wall-clock doesn't match, adjust forward by 1h.
    {
      const wc = getWallClock(ts, zone);
      if (wc.hour !== h || wc.minute !== min || wc.second !== s) {
        const dstOff = Math.max(initialOffset, secondOffset);
        const springGuess = Date.UTC(y, M, d, h + 1, min, s, ms);
        ts = springGuess - dstOff * 60000;
        secondOffset = dstOff;
      }
    }

    // Fall-back ambiguity detection: when guess falls after the UTC transition.
    if (initialOffset === secondOffset) {
      for (const offsetDelta of [60, -60]) {
        const testOff = secondOffset + offsetDelta;
        const testTs = guess - testOff * 60000;
        const actualOff = getOffset(zone, testTs);
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
      const targetOffset = -zoneInfo.offset(timestamp) || 0;
      m.utcOffset(targetOffset, keepTime);
    } else {
      const targetOffset = getOffset(tz, timestamp) || 0;
      m.utcOffset(targetOffset, keepTime);
      m._z = { name: tz, abbr: (_ts: number) => getAbbr(tz, _ts) };
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
      const janOff = getOffset(z, Date.UTC(year, 0, 1));
      const julOff = getOffset(z, Date.UTC(year, 6, 1));
      const standardOff = Math.min(janOff, julOff);
      const currentOff = getOffset(z, ts);
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
      // "|| 0" coerces -0 to 0 (Object.is(-0,0) === false)
      offset: (ts: number) => -off(ts) || 0,
      utcOffset: (ts: number) => -off(ts) || 0,
      parse: (ts: number) => -off(ts) || 0,
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
