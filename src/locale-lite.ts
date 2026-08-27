export interface LiteLocale {
  _config: {
    months: string[];
    monthsShort: string[];
    weekdays: string[];
    weekdaysShort: string[];
    weekdaysMin: string[];
    preparse?: (str: string) => string;
  };
  _abbr: string;
  monthsArray(): string[];
  monthsShortArray(): string[];
  weekdaysArray(): string[];
  weekdaysShortArray(): string[];
  weekdaysMinArray(): string[];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_MIN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const enLiteConfig = {
  months: MONTHS,
  monthsShort: MONTHS_SHORT,
  weekdays: WEEKDAYS,
  weekdaysShort: WEEKDAYS_SHORT,
  weekdaysMin: WEEKDAYS_MIN,
};

const liteLocale = {
  _config: enLiteConfig,
  _abbr: "en",
  monthsArray: () => MONTHS.slice(),
  monthsShortArray: () => MONTHS_SHORT.slice(),
  weekdaysArray: () => WEEKDAYS.slice(),
  weekdaysShortArray: () => WEEKDAYS_SHORT.slice(),
  weekdaysMinArray: () => WEEKDAYS_MIN.slice(),
};

export function getLiteCurrentLocale(): string {
  return "en";
}

export function getLiteLocale(_name?: string): LiteLocale {
  return liteLocale;
}

export function hasLiteLocale(name: string): boolean {
  return name === "en" || name === "en-us";
}
