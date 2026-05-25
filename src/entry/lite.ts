import { isMoment, isDate } from "../utils";
import {
  moment as baseMoment,
  momentUTC,
  getMomentNowFunction,
  setMomentNowFunction,
} from "../core/factory-lite";
import {
  parseTwoDigitYear as parseTwoDigitYearInternal,
  setParseTwoDigitYear,
} from "../parse-lite";
import { createLiteCoreApi } from "../plugins/core-lite";
import type { LiteMomentStatic } from "./types";

export type { MomentConstructionConfig } from "../moment-lite";

const moment = createLiteCoreApi(baseMoment as never, {
  getMomentNowFunction,
  setMomentNowFunction,
  parseTwoDigitYearInternal,
  setParseTwoDigitYear,
  momentUTC,
}) as unknown as LiteMomentStatic;

export default moment;
export { moment, isMoment, isDate };
