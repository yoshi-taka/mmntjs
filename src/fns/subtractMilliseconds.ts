import { addMilliseconds } from "./addMilliseconds";

export function subtractMilliseconds(d: Date, n: number): Date {
  return addMilliseconds(d, -n);
}
