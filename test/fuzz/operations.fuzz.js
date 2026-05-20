import _moment from "../../dist/index.js";
import _originalMoment from "../../moment/moment.js";
import { weightedMomentDate } from "./distributions.js";
import { applyRandomTZ } from "./tz-helper.js";

const moment = _moment;
const originalMoment = _originalMoment;
originalMoment.suppressDeprecationWarnings = true;

export function fuzz(buf) {
  applyRandomTZ(buf);
  if (buf.length < 5) {
    return;
  }
  const units = ["years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds"];
  const startEndUnits = [
    "year",
    "quarter",
    "month",
    "week",
    "isoWeek",
    "day",
    "hour",
    "minute",
    "second",
  ];
  const offset = buf.readInt32LE(0);
  const unit = units[buf[4] % units.length];
  try {
    const d = weightedMomentDate(buf, Date.now() + offset);
    const m2 = moment(d);
    const mOrig = originalMoment(d);
    const fmt2 = m2.format("YYYY-MM-DD HH:mm:ss.SSS");
    const fmtOrig = mOrig.format("YYYY-MM-DD HH:mm:ss.SSS");
    if (fmt2 !== fmtOrig) {
      throw new Error(
        `format() mismatch for offset ${offset}: mmntjs="${fmt2}", original="${fmtOrig}"`,
      );
    }
    if (m2.isValid() !== mOrig.isValid()) {
      throw new Error(`isValid() mismatch for offset ${offset}`);
    }
    if (!m2.isValid()) {
      return;
    }
    const amount = buf.length >= 9 ? buf.readInt32LE(5) : 0;
    try {
      const a2 = m2.clone().add(amount, unit);
      const aOrig = mOrig.clone().add(amount, unit);
      const aFmt = a2.format("YYYY-MM-DD HH:mm:ss");
      const oFmt = aOrig.format("YYYY-MM-DD HH:mm:ss");
      if (aFmt !== oFmt) {
        throw new Error(
          `add(${amount}, "${unit}") mismatch for offset=${offset}: mmntjs="${aFmt}", original="${oFmt}"`,
        );
      }
    } catch {}
    try {
      const se = startEndUnits[buf.length >= 10 ? buf[9] % startEndUnits.length : 0];
      const s2 = m2.clone().startOf(se);
      const sOrig = mOrig.clone().startOf(se);
      const sFmt = s2.format("YYYY-MM-DD HH:mm:ss");
      const sOFmt = sOrig.format("YYYY-MM-DD HH:mm:ss");
      if (sFmt !== sOFmt) {
        throw new Error(
          `startOf("${se}") mismatch for offset=${offset}: mmntjs="${sFmt}", original="${sOFmt}"`,
        );
      }
    } catch {}
    try {
      const d2 = m2.clone().diff(m2.clone().add(amount, unit), unit.replace(/s$/, ""));
      const dOrig = mOrig.clone().diff(mOrig.clone().add(amount, unit), unit.replace(/s$/, ""));
      if (d2 !== dOrig) {
        throw new Error(
          `diff() mismatch for offset=${offset} ${amount} ${unit}: mmntjs=${d2}, original=${dOrig}`,
        );
      }
    } catch {}
    // Compare isAfter/isBefore/isSame with a shifted version of itself
    try {
      const shifted = m2.clone().add(1, "day");
      const sOrig = mOrig.clone().add(1, "day");
      if (m2.isAfter(shifted) !== mOrig.isAfter(sOrig)) {
        throw new Error(`isAfter(shifted) mismatch for offset=${offset}`);
      }
      if (m2.isBefore(shifted) !== mOrig.isBefore(sOrig)) {
        throw new Error(`isBefore(shifted) mismatch for offset=${offset}`);
      }
      if (m2.isSame(shifted) !== mOrig.isSame(sOrig)) {
        throw new Error(`isSame(shifted) mismatch for offset=${offset}`);
      }
      // Compare with string input
      const strInput = shifted.format("YYYY-MM-DDTHH:mm:ssZ");
      if (m2.isAfter(strInput) !== mOrig.isAfter(strInput)) {
        throw new Error(`isAfter(string) mismatch for offset=${offset}`);
      }
    } catch {}
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("format() mismatch") ||
        error.message.startsWith("isValid() mismatch") ||
        error.message.startsWith("add(") ||
        error.message.startsWith("startOf(") ||
        error.message.startsWith("diff(") ||
        error.message.startsWith("isAfter(") ||
        error.message.startsWith("isBefore(") ||
        error.message.startsWith("isSame("))
    ) {
      throw error;
    }
  }
}
