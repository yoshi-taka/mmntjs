import _moment from "../../dist/index.js";
import {
  format,
  addDays,
  addMonths,
  addYears,
  addHours,
  addMinutes,
  addSeconds,
  addWeeks,
} from "date-fns";
import { applyRandomTZ } from "./tz-helper.js";

const moment = _moment;

export function fuzz(buf) {
  applyRandomTZ(buf);
  if (buf.length < 4) {
    return;
  }
  const ts = buf.readInt32LE(0);
  try {
    const m2 = moment(ts);
    const date = new Date(ts);
    const m2Val = m2.valueOf();
    const dateVal = date.getTime();
    if (m2Val !== dateVal) {
      throw new Error(`valueOf mismatch for ts=${ts}: mmntjs=${m2Val}, date-fns=${dateVal}`);
    }
    const m2Fmt = m2.format("YYYY-MM-DD");
    const dateFmt = format(date, "yyyy-MM-dd");
    if (m2Fmt !== dateFmt) {
      throw new Error(`format mismatch for ts=${ts}: mmntjs="${m2Fmt}", date-fns="${dateFmt}"`);
    }
    if (buf.length >= 8) {
      const amount = buf.readInt32LE(4) % 1000;
      const units = ["day", "month", "year", "hour", "minute", "second", "week"];
      const unit = units[buf.length >= 9 ? buf[8] % units.length : 0];
      const addFn = {
        day: addDays,
        month: addMonths,
        year: addYears,
        hour: addHours,
        minute: addMinutes,
        second: addSeconds,
        week: addWeeks,
      }[unit];
      if (addFn) {
        const m2Add = m2.clone().add(amount, unit);
        const dateAdd = addFn(date, amount);
        if (m2Add.valueOf() !== dateAdd.getTime()) {
          throw new Error(
            `add(${amount}, ${unit}) mismatch for ts=${ts}: mmntjs=${m2Add.valueOf()}, date-fns=${dateAdd.getTime()}`,
          );
        }
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
