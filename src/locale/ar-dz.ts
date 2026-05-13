import type { LocaleSpec } from "./en";

const pluralForm = function (n: number) {
    return n === 0
      ? 0
      : n === 1
        ? 1
        : n === 2
          ? 2
          : n % 100 >= 3 && n % 100 <= 10
            ? 3
            : n % 100 >= 11
              ? 4
              : 5;
  },
  plurals = {
    s: ["أقل من ثانية", "ثانية واحدة", ["ثانيتان", "ثانيتين"], "%d ثوان", "%d ثانية", "%d ثانية"],
    m: ["أقل من دقيقة", "دقيقة واحدة", ["دقيقتان", "دقيقتين"], "%d دقائق", "%d دقيقة", "%d دقيقة"],
    h: ["أقل من ساعة", "ساعة واحدة", ["ساعتان", "ساعتين"], "%d ساعات", "%d ساعة", "%d ساعة"],
    d: ["أقل من يوم", "يوم واحد", ["يومان", "يومين"], "%d أيام", "%d يومًا", "%d يوم"],
    M: ["أقل من شهر", "شهر واحد", ["شهران", "شهرين"], "%d أشهر", "%d شهرا", "%d شهر"],
    y: ["أقل من عام", "عام واحد", ["عامان", "عامين"], "%d أعوام", "%d عامًا", "%d عام"],
  },
  pluralize = function (u: string) {
    return function (number: number, withoutSuffix: boolean, _string: string, _isFuture: boolean) {
      let f = pluralForm(number),
        str = (plurals as Record<string, string | string[] | string[][]>)[u][pluralForm(number)];
      if (f === 2) {
        str = str[withoutSuffix ? 0 : 1];
      }
      return (str as string).replace(/%d/i, String(number));
    };
  },
  months = [
    "جانفي",
    "فيفري",
    "مارس",
    "أفريل",
    "ماي",
    "جوان",
    "جويلية",
    "أوت",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];

export const ar_dzLocale: LocaleSpec = {
  months: months,
  monthsShort: months,
  weekdays: "الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت".split("_"),
  weekdaysShort: "أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت".split("_"),
  weekdaysMin: "ح_ن_ث_ر_خ_ج_س".split("_"),
  weekdaysParseExact: true,
  longDateFormat: {
    LT: "HH:mm",
    LTS: "HH:mm:ss",
    L: "D/‏M/‏YYYY",
    LL: "D MMMM YYYY",
    LLL: "D MMMM YYYY HH:mm",
    LLLL: "dddd D MMMM YYYY HH:mm",
  },
  meridiemParse: /ص|م/,
  isPM: function (input: string) {
    return "م" === input;
  },
  meridiem: function (hour, _minute, _isLower) {
    if (hour < 12) {
      return "ص";
    } else {
      return "م";
    }
  },
  calendar: {
    sameDay: "[اليوم عند الساعة] LT",
    nextDay: "[غدًا عند الساعة] LT",
    nextWeek: "dddd [عند الساعة] LT",
    lastDay: "[أمس عند الساعة] LT",
    lastWeek: "dddd [عند الساعة] LT",
    sameElse: "L",
  },
  relativeTime: {
    future: "بعد %s",
    past: "منذ %s",
    s: pluralize("s"),
    ss: pluralize("s"),
    m: pluralize("m"),
    mm: pluralize("m"),
    h: pluralize("h"),
    hh: pluralize("h"),
    d: pluralize("d"),
    dd: pluralize("d"),
    M: pluralize("M"),
    MM: pluralize("M"),
    y: pluralize("y"),
    yy: pluralize("y"),
  },
  postformat: function (string) {
    return string.replaceAll(",", "،");
  },
  week: {
    dow: 0,
    doy: 4,
  },
};
