export interface Moment2Config {
  deprecationWarnings?: boolean;
  trackUsage?: boolean;
}

export interface Moment2UsageReport {
  apis: string[];
  temporalEquivalents: Record<string, string | null>;
}

const TEMPORAL_MAP: Record<string, string> = {
  format: "Temporal.PlainDate.from({...}).toString()",
  add: "date.add({ days: 1 })",
  subtract: "date.subtract({ days: 1 })",
  startOf: "date.with({ day: 1 })",
  endOf: "date.with({ day: 1 }).subtract({ days: 1 })",
  diff: "date.since(other)",
  fromNow: "Temporal.Now.plainDateISO().since(date)",
  isBefore: "Temporal.PlainDate.compare(a, b) < 0",
  isAfter: "Temporal.PlainDate.compare(a, b) > 0",
  isSame: "Temporal.PlainDate.compare(a, b) === 0",
  clone: "Temporal.PlainDate.from(date)",
  valueOf: "date.epochMilliseconds",
  unix: "Math.floor(date.epochMilliseconds / 1000)",
  toISOString: "date.toString()",
  toJSON: "date.toString()",
  year: "date.year",
  month: "date.month",
  date: "date.day",
  hour: "date.hour",
  minute: "date.minute",
  second: "date.second",
  millisecond: "date.millisecond",
  day: "date.dayOfWeek",
  isoWeekday: "date.dayOfWeek",
  daysInMonth: "date.daysInMonth",
  isLeapYear: "date.inLeapYear",
  isDST: "timeZone.getOffsetNanosecondsFor(date)",
  utcOffset: "timeZone.getOffsetStringFor(date)",
  toDate: "new Date(date.epochMilliseconds)",
  parse: "Temporal.PlainDate.from(string)",
  utc: "Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZone)",
};

let config: Moment2Config = {
  deprecationWarnings: true,
  trackUsage: false,
};

let usageTracker = new Set<string>();

export function configure(opts: Moment2Config): void {
  config = { ...config, ...opts };
}

export function track(apiName: string, _args?: any[]): void {
  if (config.trackUsage) {
    usageTracker.add(apiName);
  }
}

export function warn(message: string, temporalEquivalent?: string): void {
  if (config.deprecationWarnings) {
    console.warn(`[moment2] ${  message}`);
    if (temporalEquivalent) {
      console.warn(`  Temporal equivalent: ${  temporalEquivalent}`);
    }
  }
}

export function report(): Moment2UsageReport {
  const apis = Array.from(usageTracker).sort();
  const temporalEquivalents: Record<string, string | null> = {};
  for (const api of apis) {
    temporalEquivalents[api] = TEMPORAL_MAP[api] || null;
  }
  return { apis, temporalEquivalents };
}

export function getTemporalEquivalent(apiName: string): string | null {
  return TEMPORAL_MAP[apiName] || null;
}
