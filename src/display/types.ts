import type { Locale } from "../locale";

export interface FormattableMoment {
  _l: string | undefined;
  _isValid: boolean;
  _dirty: boolean;
  $y: number;
  $M: number;
  $D: number;
  $H: number;
  $m: number;
  $s: number;
  $ms: number;
  utcOffset(): number;
  localeData(): Locale;
  _ensureFields(): void;
}
