import { _setDate, _setDate28Fast } from "./_kernel";
import { asDate28 } from "./_types";

export function setDate(d: Date, date: number): Date {
  if (date >= 1 && date <= 28) {
    return _setDate28Fast(d, asDate28(date));
  }
  const out = new Date(d.getTime());
  out.setDate(date);
  return out;
}
