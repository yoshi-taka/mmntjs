/**
 * Timezone fuzz harness: compares mmntjs-timezone against moment-timezone
 * for random (timestamp, zone) pairs.
 *
 * This follows the same pattern as root test/fuzz/*.fuzz.js:
 * - coverage-guided random input via libFuzzer
 * - oracle comparison against moment-timezone
 * - throws Error on mismatch
 */
import _moment from "mmntjs";
import _momentTimezone from "moment-timezone";
import { installTimezone } from "../../src/install";
import { BUILTIN_TZDATA } from "../../src/builtin-data.generated";

installTimezone(_moment, BUILTIN_TZDATA);

const moment = _moment;
const momentTimezone = _momentTimezone;

const ZONES = [
  "UTC",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Asia/Taipei",
  "America/New_York",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Stockholm",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Africa/Cairo",
  "Pacific/Fiji",
];

function pickZone(buf, offset) {
  const idx = buf.length > offset ? (buf[offset] & 0xff) % ZONES.length : 0;
  return ZONES[idx];
}

function readInt32LE(buf, offset) {
  return buf.length >= offset + 4 ? buf.readInt32LE(offset) : 0;
}

export function fuzz(buf) {
  if (buf.length < 4) {
    return;
  }

  // Generate timestamp in [2000-01-01, 2030-12-31] range
  const MIN_TS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
  const MAX_TS = Date.UTC(2030, 11, 31, 23, 59, 59, 999);
  const tsRange = MAX_TS - MIN_TS;
  const ts = MIN_TS + ((readInt32LE(buf, 0) >>> 0) % tsRange);
  const zone = pickZone(buf, 4);
  const mode = buf.length > 5 ? buf[5] % 4 : 0;

  try {
    let mm, om;

    switch (mode) {
      case 0:
        // moment(ts).tz(zone) — convert instant to zone
        mm = moment(ts).tz(zone);
        om = momentTimezone(ts).tz(zone);
        break;
      case 1:
        // moment.utc(ts).tz(zone) — convert UTC to zone
        mm = moment.utc(ts).tz(zone);
        om = momentTimezone.utc(ts).tz(zone);
        break;
      case 2:
        // moment.tz(input, zone) — parse wall-clock in zone
        {
          const d = new Date(ts);
          const y = d.getUTCFullYear();
          const M = String(d.getUTCMonth() + 1).padStart(2, "0");
          const day = String(d.getUTCDate()).padStart(2, "0");
          const h = String(d.getUTCHours()).padStart(2, "0");
          const min = String(d.getUTCMinutes()).padStart(2, "0");
          const input = `${y}-${M}-${day} ${h}:${min}`;
          mm = moment.tz(input, zone);
          om = momentTimezone.tz(input, zone);
        }
        break;
      case 3:
        // moment.tz(ts, zone) — timestamp + zone
        mm = moment.tz(ts, zone);
        om = momentTimezone.tz(ts, zone);
        break;
    }

    const mmValid = mm.isValid();
    const omValid = om.isValid();
    if (mmValid !== omValid) {
      throw new Error(
        `Validity mismatch: mode=${mode} ts=${ts} zone=${zone} mm2=${mmValid} oracle=${omValid}`,
      );
    }

    if (mmValid) {
      const mmTs = mm.valueOf();
      const omTs = om.valueOf();
      if (mmTs !== omTs) {
        throw new Error(
          `valueOf mismatch: mode=${mode} ts=${ts} zone=${zone} mm2=${mmTs} oracle=${omTs}`,
        );
      }

      const mmOff = mm.utcOffset();
      const omOff = om.utcOffset();
      if (mmOff !== omOff) {
        throw new Error(
          `utcOffset mismatch: mode=${mode} ts=${ts} zone=${zone} mm2=${mmOff} oracle=${omOff}`,
        );
      }

      const mmAbbr = mm.zoneAbbr();
      const omAbbr = om.zoneAbbr();
      if (mmAbbr !== omAbbr) {
        throw new Error(
          `zoneAbbr mismatch: mode=${mode} ts=${ts} zone=${zone} mm2=${mmAbbr} oracle=${omAbbr}`,
        );
      }

      const mmFmt = mm.format("YYYY-MM-DD HH:mm:ss");
      const omFmt = om.format("YYYY-MM-DD HH:mm:ss");
      if (mmFmt !== omFmt) {
        throw new Error(
          `format mismatch: mode=${mode} ts=${ts} zone=${zone} mm2=${mmFmt} oracle=${omFmt}`,
        );
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Validity mismatch") ||
        error.message.startsWith("valueOf mismatch") ||
        error.message.startsWith("utcOffset mismatch") ||
        error.message.startsWith("zoneAbbr mismatch") ||
        error.message.startsWith("format mismatch"))
    ) {
      throw error;
    }
  }
}
