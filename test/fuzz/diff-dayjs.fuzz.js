import _moment from "../../dist/index.js";
import dayjs from "dayjs";
import { applyRandomTZ } from "./tz-helper.js";

const moment = _moment;

export function fuzz(buf) {
  applyRandomTZ(buf);
  if (buf.length < 4) return;
  const ts = buf.readInt32LE(0);
  try {
    const m2 = moment(ts);
    const dj = dayjs(ts);
    if (!dj.isValid()) return;

    const m2Val = m2.valueOf();
    const djVal = dj.valueOf();
    if (m2Val !== djVal) {
      throw new Error(`valueOf mismatch for ts=${ts}: moment2=${m2Val}, dayjs=${djVal}`);
    }

    const m2Fmt = m2.format("YYYY-MM-DD");
    const djFmt = dj.format("YYYY-MM-DD");
    if (m2Fmt !== djFmt) {
      throw new Error(`format mismatch for ts=${ts}: moment2="${m2Fmt}", dayjs="${djFmt}"`);
    }

    if (buf.length >= 8) {
      const amount = buf.readInt32LE(4) % 1000;
      const units = ["day", "month", "year", "hour", "minute", "second", "week"];
      const unit = units[buf.length >= 9 ? buf[8] % units.length : 0];
      const m2Add = m2.clone().add(amount, unit);
      const djAdd = dj.add(amount, unit);
      if (!djAdd.isValid()) return;
      if (m2Add.valueOf() !== djAdd.valueOf()) {
        throw new Error(
          `add(${amount}, ${unit}) mismatch for ts=${ts}: moment2=${m2Add.valueOf()}, dayjs=${djAdd.valueOf()}`,
        );
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("valueOf mismatch") ||
        error.message.startsWith("format mismatch") ||
        error.message.startsWith("add("))
    ) {
      throw error;
    }
  }
}
