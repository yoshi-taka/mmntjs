import { _setMilliseconds, _setMillisecondsFast } from "./_kernel";
import { asMillisecond } from "./_types";

export function setMilliseconds(d: Date, ms: number): Date {
  if (ms >= 0 && ms <= 999) {
    return _setMillisecondsFast(d, asMillisecond(ms));
  }
  const out = new Date(d.getTime());
  out.setMilliseconds(ms);
  return out;
}
