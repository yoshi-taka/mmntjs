import type { Moment } from "../moment_fixed";
import type { LocaleSpec } from "./en";

const jaMonths = '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_');
const jaMonthsShort = jaMonths;
const jaWeekdays = '日曜日_月曜日_火曜日_水曜日_木曜日_金曜日_土曜日'.split('_');
const jaWeekdaysShort = '日_月_火_水_木_金_土'.split('_');

function _jaFormatFastPath(m: Moment, format: string): string | undefined {
  const raw = m as unknown as Record<string, number | boolean>;
  if (!raw._isValid) {return undefined;}
  const y = raw.$y as number;
  if (y < 0 || y > 9999) {return undefined;}
  const Y = y < 10 ? `000${  y}` : y < 100 ? `00${  y}` : y < 1000 ? `0${  y}` : `${  y}`;
  const M = (raw.$M as number) + 1;
  const D = raw.$D as number;
  const H = raw.$H as number;
  const min = raw.$m as number;
  const s = raw.$s as number;
  switch (format) {
    case 'YYYY/MM/DD':
      return `${Y  }/${  M < 10 ? `0${  M}` : `${  M}`  }/${  D < 10 ? `0${  D}` : `${  D}`}`;
    case 'YYYY年M月D日':
      return `${Y  }年${  M  }月${  D  }日`;
    case 'YYYY年M月D日 HH:mm':
      return `${Y  }年${  M  }月${  D  }日 ${  H < 10 ? `0${  H}` : `${  H}`  }:${  min < 10 ? `0${  min}` : `${  min}`}`;
    case 'YYYY年M月D日 dddd HH:mm':
      return `${Y  }年${  M  }月${  D  }日 ${  jaWeekdays[raw.$W]  } ${  H < 10 ? `0${  H}` : `${  H}`  }:${  min < 10 ? `0${  min}` : `${  min}`}`;
    case 'YYYY年M月D日(ddd) HH:mm':
      return `${Y  }年${  M  }月${  D  }日(${  jaWeekdaysShort[raw.$W]  }) ${  H < 10 ? `0${  H}` : `${  H}`  }:${  min < 10 ? `0${  min}` : `${  min}`}`;
    case 'HH:mm':
      return `${H < 10 ? `0${  H}` : `${  H}`  }:${  min < 10 ? `0${  min}` : `${  min}`}`;
    case 'HH:mm:ss':
      return `${H < 10 ? `0${  H}` : `${  H}`  }:${  min < 10 ? `0${  min}` : `${  min}`  }:${  s < 10 ? `0${  s}` : `${  s}`}`;
  }
  return undefined;
}

export const jaLocale: LocaleSpec = {
    eras: [
      {
        since: "2019-05-01",
        offset: 1,
        name: "令和",
        narrow: "㋿",
        abbr: "R"
      },
      {
        since: "1989-01-08",
        until: "2019-04-30",
        offset: 1,
        name: "平成",
        narrow: "㍻",
        abbr: "H"
      },
      {
        since: "1926-12-25",
        until: "1989-01-07",
        offset: 1,
        name: "昭和",
        narrow: "㍼",
        abbr: "S"
      },
      {
        since: "1912-07-30",
        until: "1926-12-24",
        offset: 1,
        name: "大正",
        narrow: "㍽",
        abbr: "T"
      },
      {
        since: "1873-01-01",
        until: "1912-07-29",
        offset: 6,
        name: "明治",
        narrow: "㍾",
        abbr: "M"
      },
      {
        since: "0001-01-01",
        until: "1873-12-31",
        offset: 1,
        name: "西暦",
        narrow: "AD",
        abbr: "AD"
      },
      {
        since: "0000-12-31",
        until: -Infinity,
        offset: 1,
        name: "紀元前",
        narrow: "BC",
        abbr: "BC"
      }
    ],
    eraYearOrdinalRegex: /(元|\d+)年/,
    eraYearOrdinalParse: function (input: string, match: RegExpMatchArray) {
        return match[1] === '元' ? 1 : parseInt(match[1] || input, 10);
    },
    months: jaMonths,
    monthsShort: jaMonthsShort,
    weekdays: jaWeekdays,
    weekdaysShort: jaWeekdaysShort,
    weekdaysMin: jaWeekdaysShort,
    longDateFormat: {
      LT: "HH:mm",
      LTS: "HH:mm:ss",
      L: "YYYY/MM/DD",
      LL: "YYYY年M月D日",
      LLL: "YYYY年M月D日 HH:mm",
      LLLL: "YYYY年M月D日 dddd HH:mm",
      l: "YYYY/MM/DD",
      ll: "YYYY年M月D日",
      lll: "YYYY年M月D日 HH:mm",
      llll: "YYYY年M月D日(ddd) HH:mm"
    },
    meridiemParse: /午前|午後/i,
    isPM: function(input: string) {
        return input === '午後';
    },
    meridiem: function (hour, _minute, _isLower) {
        if (hour < 12) {
            return '午前';
        } else {
            return '午後';
        }
    },
    calendar: {
      sameDay: "[今日] LT",
      nextDay: "[明日] LT",
      nextWeek: function (this: Moment, now: Moment) {
            if (now.week() !== this.week()) {
                return '[来週]dddd LT';
            } else {
                return 'dddd LT';
            }
        },
      lastDay: "[昨日] LT",
      lastWeek: function (this: Moment, now: Moment) {
            if (this.week() !== now.week()) {
                return '[先週]dddd LT';
            } else {
                return 'dddd LT';
            }
        },
      sameElse: "L"
    },
    dayOfMonthOrdinalParse: /\d{1,2}日/,
    ordinal: function (number: number, period?: string) {
        switch (period) {
            case 'y':
                return number === 1 ? '元年' : `${number  }年`;
            case 'd':
            case 'D':
            case 'DDD':
                return `${number  }日`;
            default:
                return `${number}`;
        }
    },
    relativeTime: {
      future: "%s後",
      past: "%s前",
      s: "数秒",
      ss: "%d秒",
      m: "1分",
      mm: "%d分",
      h: "1時間",
      hh: "%d時間",
      d: "1日",
      dd: "%d日",
      M: "1ヶ月",
      MM: "%dヶ月",
      y: "1年",
      yy: "%d年"
    },
    _formatFastPath: _jaFormatFastPath
  };
