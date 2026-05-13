type MomentLike = {
  fn: Record<string, unknown>;
  momentProperties: string[];
  defaultZone?: string;
  (...args: unknown[]): any;
};

const offsetCache = new Map<string, Map<number, number>>();
const MAX_DOMAIN_CACHE_SIZE = 1000;

function getOffset(tz: string, timestamp: number): number {
  let domain = offsetCache.get(tz);
  if (!domain) {
    domain = new Map();
    offsetCache.set(tz, domain);
  }

  const key = Math.round(timestamp / 60000);

  const cached = domain.get(key);
  if (cached !== undefined) {return cached;}

  if (domain.size >= MAX_DOMAIN_CACHE_SIZE) {
    const first = domain.keys().next().value;
    if (first !== undefined) {domain.delete(first);}
  }

  const d = new Date(timestamp);
  const parts = d.toLocaleString("en-US", {
    timeZone: tz,
    timeZoneName: "short",
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

function isZoneName(s: string): boolean {
  return s.includes("/") || s === "UTC" || s === "GMT";
}

export function installTimezone(moment: MomentLike): MomentLike {
  if ((moment as Record<string, unknown>).tz) {
    return moment;
  }

  moment.momentProperties.push("_z");

  function momentTz(input?: any, formatOrZone?: any, zoneOrStrict?: any, fourth?: any): any {
    if (typeof formatOrZone === "string" && isZoneName(formatOrZone)) {
      const tz = formatOrZone;
      if (input === undefined || input === null) {
        return moment().tz(tz);
      }
      const m = moment(input);
      return m.tz(tz);
    }

    if (typeof input === "string" && typeof formatOrZone === "string" && typeof zoneOrStrict === "string" && isZoneName(zoneOrStrict)) {
      const fmt = formatOrZone;
      const tz = zoneOrStrict;
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

    return moment();
  }

  function fnTz(this: any, tz?: string): any {
    if (tz === undefined) {
      return this._z ? this._z.name : Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    const timestamp = this.valueOf();
    const targetOffset = getOffset(tz, timestamp);
    const m = this.clone();
    m.utcOffset(targetOffset, false);
    m._z = { name: tz };
    return m;
  }

  (moment as any).tz = momentTz;
  (moment as any).fn.tz = fnTz;

  (moment as any).tz.guess = function (): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  };

  (moment as any).tz.names = function (): string[] {
    try {
      return ((Intl as any).supportedValuesOf("timeZone") as string[]).sort();
    } catch {
      return [
        "UTC", "America/New_York", "America/Chicago", "America/Denver",
        "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
        "Europe/Moscow", "Asia/Tokyo", "Asia/Shanghai", "Asia/Hong_Kong",
        "Asia/Singapore", "Asia/Seoul", "Asia/Kolkata", "Australia/Sydney",
        "Pacific/Auckland", "Africa/Cairo", "Africa/Johannesburg",
      ];
    }
  };

  (moment as any).tz.zone = function (name: string): object | null {
    try {
      const names = (moment as any).tz.names();
      if (!names.includes(name)) {return null;}

      return {
        name,
        abbr: (ts: number) => {
          const offset = getOffset(name, ts);
          const abs = Math.abs(offset);
          const hrs = Math.floor(abs / 60);
          const min = abs % 60;
          const sign = offset >= 0 ? "+" : "-";
          return `GMT${sign}${String(hrs).padStart(2, "0")}${min ? String(min).padStart(2, "0") : ""}`;
        },
        offset: (ts: number) => getOffset(name, ts),
        utcOffset: (ts: number) => -getOffset(name, ts),
        parse: (ts: number) => ({
          name,
          offset: getOffset(name, ts),
        }),
      };
    } catch {
      return null;
    }
  };

  (moment as any).tz.add = function (_data: any): void {
    console.warn("[moment2-timezone] .tz.add() is a no-op — timezone data comes from the runtime Intl API");
  };

  (moment as any).tz.link = function (_links: any): void {};

  (moment as any).tz.setDefault = function (tz: string): void {
    (moment as any).defaultZone = tz;
  };

  return moment;
}
