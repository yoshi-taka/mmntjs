import type { TimeZone } from "./at-grafana-schema";

export interface RawTimeRange {
  from: unknown;
  to: unknown;
}

export interface TimeRange {
  from: unknown;
  to: unknown;
  raw: RawTimeRange;
}

export interface RelativeTimeRange {
  from: number;
  to: number;
}

export interface IntervalValues {
  interval: string;
  intervalMs: number;
}

export interface TimeOption {
  from: string;
  to: string;
  display: string;
  invalid?: boolean;
  section?: number;
}

export { type TimeZone };
export const DefaultTimeZone: TimeZone = "browser";
