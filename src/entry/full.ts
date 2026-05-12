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
import type { FullMomentStatic } from "./types";

export type { MomentConfig } from "../moment2";
export type { DurationInput } from "../duration_fixed";
export type { LocaleSpec } from "../locale/en";

initializeFullEntry();

export default moment as unknown as FullMomentStatic;
export { moment, isMoment, isDate, Duration, Locale };
