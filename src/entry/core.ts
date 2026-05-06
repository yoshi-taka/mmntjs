import { Duration } from "../duration_fixed";
import {
  isMoment,
  isDate,
} from "../utils";
import {
  Locale,
} from "../locale";
import { moment } from "../core/factory";
import { initializeCoreEntry } from "./init";
import type { CoreMomentStatic } from "./types";

export type { MomentConfig } from "../moment_fixed";
export type { DurationInput } from "../duration_fixed";
export type { LocaleSpec } from "../locale/en";

initializeCoreEntry();

export default moment as unknown as CoreMomentStatic;
export { moment, isMoment, isDate, Duration, Locale };
