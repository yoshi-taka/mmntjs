import _moment from "../../dist/index.js";
import _originalMoment from "../../moment/moment.js";
import { weightedParseInput } from "./distributions.js";
import { applyRandomTZ } from "./tz-helper.js";

const moment = _moment;
const originalMoment = _originalMoment;
originalMoment.suppressDeprecationWarnings = true;

export function fuzz(buf) {
  applyRandomTZ(buf);
  const str = weightedParseInput(buf);
  try {
    const m2 = moment(str);
    const mOrig = originalMoment(str);

    const isValid = m2.isValid();
    const origIsValid = mOrig.isValid();

    if (isValid !== origIsValid) {
      throw new Error(
        `Validity mismatch for "${str}": moment2=${isValid}, original=${origIsValid}`,
      );
    }

    if (isValid) {
      const fmt = m2.format("YYYY-MM-DD HH:mm:ss");
      const origFmt = mOrig.format("YYYY-MM-DD HH:mm:ss");
      if (fmt !== origFmt) {
        throw new Error(`Format mismatch for "${str}": moment2="${fmt}", original="${origFmt}"`);
      }

      const ts = m2.valueOf();
      const origTs = mOrig.valueOf();
      if (ts !== origTs) {
        throw new Error(`Timestamp mismatch for "${str}": moment2=${ts}, original=${origTs}`);
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Validity mismatch") ||
        error.message.startsWith("Format mismatch") ||
        error.message.startsWith("Timestamp mismatch"))
    ) {
      throw error;
    }
  }
}
