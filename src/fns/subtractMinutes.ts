import { addMinutes } from "./addMinutes";

export function subtractMinutes(d: Date, n: number): Date {
  return addMinutes(d, -n);
}
