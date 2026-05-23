import { addSeconds } from "./addSeconds";

export function subtractSeconds(d: Date, n: number): Date {
  return addSeconds(d, -n);
}
