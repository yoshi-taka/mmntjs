import { Duration } from "../duration_fixed";
import {
  isMoment,
  isDate,
} from "../utils";
import {
  Locale,
} from "../locale";
import { moment } from "../core/factory";
import { initializeFullEntry } from "./init";
import type { MomentStatic } from "./types";

export type { MomentConfig } from "../moment_fixed";
export type { DurationInput } from "../duration_fixed";
export type { LocaleSpec } from "../locale/en";

initializeFullEntry();

export default moment as unknown as MomentStatic;
export { moment, isMoment, isDate, Duration, Locale };
