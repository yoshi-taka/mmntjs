"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default,
  tz: () => momentTz
});
module.exports = __toCommonJS(index_exports);
var import_moment2 = __toESM(require("@compat/moment2"), 1);
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
import_moment2.default.momentProperties.push("_z");
function isZoneName(s) {
  return s.includes("/") || s === "UTC" || s === "GMT";
}
function momentTz(input, formatOrZone, zoneOrStrict, fourth) {
  if (typeof formatOrZone === "string" && isZoneName(formatOrZone)) {
    const tz = formatOrZone;
    if (input === void 0 || input === null) {
      return (0, import_moment2.default)().tz(tz);
    }
    const m = (0, import_moment2.default)(input);
    return m.tz(tz);
  }
  if (typeof input === "string" && typeof formatOrZone === "string" && typeof zoneOrStrict === "string" && isZoneName(zoneOrStrict)) {
    const fmt = formatOrZone;
    const tz = zoneOrStrict;
    const m = (0, import_moment2.default)(input, fmt);
    return m.tz(tz);
  }
  if (typeof input === "string" && typeof formatOrZone === "string") {
    const m = (0, import_moment2.default)(input, formatOrZone);
    return m;
  }
  if (typeof input === "string") {
    return (0, import_moment2.default)().tz(input);
  }
  return (0, import_moment2.default)();
}
import_moment2.default.tz = momentTz;
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
import_moment2.default.fn.tz = fnTz;
import_moment2.default.tz.guess = function() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};
import_moment2.default.tz.names = function() {
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
import_moment2.default.tz.zone = function(name) {
  try {
    const names = import_moment2.default.tz.names();
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
import_moment2.default.tz.add = function(_data) {
  console.warn("[moment2-timezone] .tz.add() is a no-op \u2014 timezone data comes from the runtime Intl API");
};
import_moment2.default.tz.link = function(_links) {
};
import_moment2.default.tz.setDefault = function(tz) {
  ;
  import_moment2.default.defaultZone = tz;
};
var index_default = import_moment2.default;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  tz
});
//# sourceMappingURL=index.cjs.map