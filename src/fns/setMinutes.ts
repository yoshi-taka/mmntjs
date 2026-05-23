import { _setMinutes, _setMinutesFast } from "./_kernel";
import { asMinute } from "./_types";

export function setMinutes(d: Date, minutes: number): Date {
  if (minutes >= 0 && minutes <= 59) {
    return _setMinutesFast(d, asMinute(minutes));
  }
  const out = new Date(d.getTime());
  out.setMinutes(minutes);
  return out;
}
