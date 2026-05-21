import { moment, nowFn } from "../core/factory";
import { formatMoment } from "../format";
import { setFormatMomentCallback } from "../moment-class";
import { registerCoreApi } from "../plugins/core";
import { registerDisplayApi } from "../plugins/display";
import { enableCustomFormatParsing } from "../parse";
import { initializeLocaleEntry } from "./locale-init";
import { registerUtcApi } from "../plugins/utc";
import { setDurationMomentResolver } from "../duration";
import type { DurationMomentLike } from "../duration-between";
import { Moment } from "../moment-class";

type CoreInitMoment = typeof moment;
type CoreInitDeps = Parameters<typeof registerCoreApi>[1];

/** @public */
export function initializeCoreEntry(target: CoreInitMoment = moment, deps?: CoreInitDeps): void {
  setFormatMomentCallback(formatMoment);
  registerCoreApi(target, deps);
  registerDisplayApi(target);
  registerUtcApi(target as never, { nowFn, ctor: Moment });
  setDurationMomentResolver((input: unknown) => {
    if (input instanceof Moment) {
      return input as unknown as DurationMomentLike;
    }
    return target(input) as unknown as DurationMomentLike;
  });
}

export function initializeFullEntry(target: CoreInitMoment = moment, deps?: CoreInitDeps): void {
  initializeCoreEntry(target, deps);
  enableCustomFormatParsing();
  initializeLocaleEntry();
}

export { registerFormatParsePlugin as initializeFormatParsePlugin } from "../plugins/format-parse";
