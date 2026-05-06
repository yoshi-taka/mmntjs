export interface ParseLocale {
  _abbr?: string;
  _config: Record<string, unknown>;
  preparse(str: string): string;
  months(): string[] | string;
  monthsShort(): string[] | string;
  longDateFormat(key: string): string;
  meridiemParse(): RegExp | undefined;
  isPM(input: string): boolean;
}
