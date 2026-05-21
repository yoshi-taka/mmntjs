import { isMoment, isDate } from "../utils";
import {
  moment,
  momentUTC,
  getMomentNowFunction,
  setMomentNowFunction,
} from "../core/factory-lite";
import {
  parseTwoDigitYear as parseTwoDigitYearInternal,
  setParseTwoDigitYear,
} from "../parse-lite";
import { registerLiteCoreApi } from "../plugins/core-lite";
import type { LiteMomentStatic } from "./types";

export type { MomentConstructionConfig } from "../moment-lite";

registerLiteCoreApi(moment as never, {
  getMomentNowFunction,
  setMomentNowFunction,
  parseTwoDigitYearInternal,
  setParseTwoDigitYear,
  momentUTC,
});

export default moment as unknown as LiteMomentStatic;
export { moment, isMoment, isDate };
