/* oxlint-disable no-explicit-any */

type MomentLike = {
  fn: Record<string, unknown>;
  momentProperties: string[];
  defaultZone?: string;
  (...args: unknown[]): any;
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

function normalizeTz(tz: string): string {
  const u = tz.toUpperCase();
  if (u === "UTC" || u === "GMT") {
    return u;
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
        if (/^[A-Z]{2,5}$/.test(abbr) && !abbr.startsWith("GMT") && abbr !== "Time") {
          return abbr;
        }
      }
    } catch {
      /* skip */
    }
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

  const key = Math.round(timestamp / 60000);

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
    return zoneNamesSet.has(s);
  } catch {
    return s.includes("/");
  }
}

export function installTimezone(moment: MomentLike): MomentLike {
  if ((moment as unknown as Record<string, unknown>).tz) {
    return moment;
  }

  moment.momentProperties.push("_z");

  function momentTz(input?: any, formatOrZone?: any, zoneOrStrict?: any, _fourth?: any): any {
    if (typeof formatOrZone === "string" && isZoneName(formatOrZone)) {
      const tz = normalizeTz(formatOrZone);
      if (input === undefined || input === null) {
        return moment().tz(tz);
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
      const m = moment(input, fmt);
      return m.tz(tz);
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

  function fnTz(this: any, tz?: string): any {
    if (tz === undefined) {
      return this._z ? this._z.name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    tz = normalizeTz(tz);
    const timestamp = this.valueOf();
    const m = this.clone();

    const zoneInfo = (moment as any).tz.zone(tz);
    if (zoneInfo) {
      m._z = zoneInfo;
      const targetOffset = zoneInfo.offset(timestamp);
      m.utcOffset(targetOffset, false);
    } else {
      const targetOffset = getOffset(tz, timestamp);
      m.utcOffset(targetOffset, false);
      m._z = { name: tz, abbr: (_ts: number) => getAbbr(tz, _ts) };
    }

    return m;
  }

  (moment as any).tz = momentTz;
  (moment as any).fn.tz = fnTz;

  (moment as any).tz.guess = function (_preferCache?: boolean): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  };

  (moment as any).tz.names = function (): string[] {
    try {
      return ((Intl as any).supportedValuesOf("timeZone") as string[]).sort();
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

  (moment as any).tz.zone = function (name: string): object | null {
    const normalized = normalizeTz(name);
    try {
      const names = (moment as any).tz.names();
      if (!names.includes(normalized)) {
        return null;
      }

      return {
        name: normalized,
        abbr: (ts: number) => getAbbr(normalized, ts),
        offset: (ts: number) => getOffset(name, ts),
        utcOffset: (ts: number) => -getOffset(normalized, ts),
        parse: (ts: number) => ({
          name: normalized,
          offset: getOffset(name, ts),
        }),
      };
    } catch {
      return null;
    }
  };

  (moment as any).tz.add = function (_data: any): void {
    console.warn(
      "[moment2-timezone] .tz.add() is a no-op — timezone data comes from the runtime Intl API",
    );
  };

  (moment as any).tz.link = function (_links: any): void {};

  (moment as any).tz.setDefault = function (tz: string): void {
    (moment as any).defaultZone = tz;
  };

  (moment as any).tz.countries = function (): string[] {
    return [];
  };

  (moment as any).tz.zonesForCountry = function (_code: string): string[] {
    return [];
  };

  return moment;
}
