// src/index.ts
import moment from "@compat/moment2";
var offsetCache = /* @__PURE__ */ new Map();
var MAX_DOMAIN_CACHE_SIZE = 1e3;
function getOffset(tz, timestamp) {
  let domain = offsetCache.get(tz);
  if (!domain) {
    domain = /* @__PURE__ */ new Map();
    offsetCache.set(tz, domain);
  }
  const key = Math.round(timestamp / 6e4);
  const cached = domain.get(key);
  if (cached !== void 0) return cached;
  if (domain.size >= MAX_DOMAIN_CACHE_SIZE) {
    const first = domain.keys().next().value;
    if (first !== void 0) domain.delete(first);
  }
  const d = new Date(timestamp);
  const parts = d.toLocaleString("en-US", {
    timeZone: tz,
    timeZoneName: "short"
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
moment.momentProperties.push("_z");
function isZoneName(s) {
  return s.includes("/") || s === "UTC" || s === "GMT";
}
function momentTz(input, formatOrZone, zoneOrStrict, fourth) {
  if (typeof formatOrZone === "string" && isZoneName(formatOrZone)) {
    const tz = formatOrZone;
    if (input === void 0 || input === null) {
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
moment.tz = momentTz;
function fnTz(tz) {
  if (tz === void 0) {
    return this._z ? this._z.name : Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  const timestamp = this.valueOf();
  const targetOffset = getOffset(tz, timestamp);
  const m = this.clone();
  m.utcOffset(targetOffset, false);
  m._z = { name: tz };
  return m;
}
moment.fn.tz = fnTz;
moment.tz.guess = function() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};
moment.tz.names = function() {
  try {
    return Intl.supportedValuesOf("timeZone").sort();
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
      "Africa/Johannesburg"
    ];
  }
};
moment.tz.zone = function(name) {
  try {
    const names = moment.tz.names();
    if (!names.includes(name)) return null;
    return {
      name,
      abbr: (ts) => {
        const offset = getOffset(name, ts);
        const abs = Math.abs(offset);
        const hrs = Math.floor(abs / 60);
        const min = abs % 60;
        const sign = offset >= 0 ? "+" : "-";
        return `GMT${sign}${String(hrs).padStart(2, "0")}${min ? String(min).padStart(2, "0") : ""}`;
      },
      offset: (ts) => getOffset(name, ts),
      utcOffset: (ts) => -getOffset(name, ts),
      parse: (ts) => ({
        name,
        offset: getOffset(name, ts)
      })
    };
  } catch {
    return null;
  }
};
moment.tz.add = function(_data) {
  console.warn("[moment2-timezone] .tz.add() is a no-op \u2014 timezone data comes from the runtime Intl API");
};
moment.tz.link = function(_links) {
};
moment.tz.setDefault = function(tz) {
  ;
  moment.defaultZone = tz;
};
var index_default = moment;
export {
  index_default as default,
  momentTz as tz
};
//# sourceMappingURL=index.js.map