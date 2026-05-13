import type { LocaleLongDateFormatKey } from "./types";
import type { LocaleSpec } from "./locale/en";

// -------------------------------------------------------------------------
// TYPED INTERNAL API — parser view of a locale object
// -------------------------------------------------------------------------

export interface ParseLocale {
  _abbr?: string;
  _config: LocaleSpec;
  preparse(str: string): string;
  months(): string[] | string;
  monthsShort(): string[] | string;
  longDateFormat(key: LocaleLongDateFormatKey): string;
  meridiemParse(): RegExp | undefined;
  isPM(input: string): boolean;
}
