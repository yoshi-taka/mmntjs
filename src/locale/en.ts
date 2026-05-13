import type { Moment } from "../moment-class";

export interface LocaleSpec {
  months?: string[] | ((m: Moment, format?: string) => string[] | string) | { format: string[]; standalone: string[]; isFormat?: RegExp };
  monthsShort?: string[] | ((m: Moment, format?: string) => string[] | string) | { format: string[]; standalone: string[]; isFormat?: RegExp };
  monthsParse?: RegExp[];
  monthsRegex?: RegExp;
  monthsShortRegex?: RegExp;
  monthsStrictRegex?: RegExp;
  monthsShortStrictRegex?: RegExp;
  longMonthsParse?: RegExp[];
  shortMonthsParse?: RegExp[];
  monthsParseExact?: boolean;
  fullWeekdaysParse?: boolean | RegExp[];
  weekdays?: string[] | ((m: Moment, format?: string) => string[] | string) | { format: string[]; standalone: string[]; isFormat?: RegExp };
  weekdaysShort?: string[] | ((m: Moment, format?: string) => string[]) | { format: string[]; standalone: string[]; isFormat?: RegExp };
  weekdaysMin?: string[] | ((m: Moment, format?: string) => string[]) | { format: string[]; standalone: string[]; isFormat?: RegExp };
  weekdaysParse?: RegExp[];
  shortWeekdaysParse?: RegExp[];
  minWeekdaysParse?: RegExp[];
  weekdaysParseExact?: boolean;
  weekdaysRegex?: RegExp;
  weekdaysShortRegex?: RegExp;
  weekdaysMinRegex?: RegExp;
  weekdaysStandalone?: string[];
  weekdaysShortStandalone?: string[];
  weekdaysMinStandalone?: string[];
  longDateFormat?: Record<string, string>;
  meridiem?: (hour: number, minute: number, isLower: boolean) => string;
  meridiemParse?: RegExp;
  meridiemHour?: (hour: number, meridiem: string) => number;
  isPM?: (input: string) => boolean;
  ordinal?: string | ((n: number, period?: string) => string);
  relativeTime?: {
    future: string;
    past: string;
    s: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    ss?: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    m: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    mm: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    h: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    hh: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    d: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    dd: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    w?: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    ww?: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    M: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    MM: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    y: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
    yy: string | ((n: number, withoutSuffix: boolean, key: string, isFuture: boolean) => string);
  };
  relativeTimeFn?: (n: number, key: string, isFuture: boolean) => string;
  calendar?: Record<string, string | ((this: Moment, ref: Moment) => string)>;
  calendarEl?: Record<string, string | Function>;
  dayOfMonthOrdinalParse?: RegExp;
  invalidDate?: string;
  eras?: unknown[];
  eraYearOrdinalRegex?: RegExp;
  eraYearOrdinalParse?: (input: string, match: RegExpExecArray) => number;
  week?: { dow: number; doy: number };
  parentLocale?: string;
  _monthsNominativeEl?: string[];
  _monthsGenitiveEl?: string[];
  preparse?: (str: string) => string;
  postformat?: (str: string) => string;
  _formatFastPath?: (m: Moment, format: string) => string | undefined;
}

const defaultLongDateFormat: Record<string, string> = {
  LT: "h:mm A",
  LTS: "h:mm:ss A",
  L: "MM/DD/YYYY",
  LL: "MMMM D, YYYY",
  LLL: "MMMM D, YYYY h:mm A",
  LLLL: "dddd, MMMM D, YYYY h:mm A",
};

const months = [
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

const monthsShort = [
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

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const weekdaysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdaysMin = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const enLocale: LocaleSpec = {
  months: months.slice(),
  monthsShort: monthsShort.slice(),
  weekdays: weekdays.slice(),
  weekdaysShort: weekdaysShort.slice(),
  weekdaysMin: weekdaysMin.slice(),

  week: { dow: 0, doy: 6 },

  longDateFormat: { ...defaultLongDateFormat },

  meridiem(hour: number, _minute: number, isLower: boolean): string {
    if (hour < 12) {
      return isLower ? "am" : "AM";
    }
    return isLower ? "pm" : "PM";
  },

  isPM(input: string): boolean {
    return String(input).toLowerCase().charAt(0) === "p";
  },

  meridiemParse: /[ap]\.?m?\.?/i,

  eras: [
    {
      since: "0001-01-01",
      until: Infinity,
      offset: 1,
      name: "Anno Domini",
      narrow: "AD",
      abbr: "AD",
    },
    {
      since: "0000-12-31",
      until: -Infinity,
      offset: 1,
      name: "Before Christ",
      narrow: "BC",
      abbr: "BC",
    },
  ],

  ordinal(n: number): string {
    const s = n % 10;
    const t = n % 100;
    if (t === 11 || t === 12 || t === 13) {
      return `${n  }th`;
    }
    switch (s) {
      case 1:
        return `${n  }st`;
      case 2:
        return `${n  }nd`;
      case 3:
        return `${n  }rd`;
      default:
        return `${n  }th`;
    }
  },

  relativeTime: {
    future: "in %s",
    past: "%s ago",
    s: "a few seconds",
    ss: "%d seconds",
    m: "a minute",
    mm: "%d minutes",
    h: "an hour",
    hh: "%d hours",
    d: "a day",
    dd: "%d days",
    w: "a week",
    ww: "%d weeks",
    M: "a month",
    MM: "%d months",
    y: "a year",
    yy: "%d years",
  },

  calendar: {
    sameDay: "[Today at] LT",
    nextDay: "[Tomorrow at] LT",
    nextWeek: "dddd [at] LT",
    lastDay: "[Yesterday at] LT",
    lastWeek: "[Last] dddd [at] LT",
    sameElse: "L",
  },

  invalidDate: "Invalid date",
};
