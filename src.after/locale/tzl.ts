// @ts-nocheck
import type { LocaleSpec } from "./en";

export const tzlLocale: LocaleSpec = {
    months: 'Januar_Fevraglh_Març_Avrïu_Mai_Gün_Julia_Guscht_Setemvar_Listopäts_Noemvar_Zecemvar'.split(
        '_'
    ),
    monthsShort: 'Jan_Fev_Mar_Avr_Mai_Gün_Jul_Gus_Set_Lis_Noe_Zec'.split('_'),
    weekdays: 'Súladi_Lúneçi_Maitzi_Márcuri_Xhúadi_Viénerçi_Sáturi'.split('_'),
    weekdaysShort: 'Súl_Lún_Mai_Már_Xhú_Vié_Sát'.split('_'),
    weekdaysMin: 'Sú_Lú_Ma_Má_Xh_Vi_Sá'.split('_'),
    longDateFormat: {
      LT: "HH.mm",
      LTS: "HH.mm.ss",
      L: "DD.MM.YYYY",
      LL: "D. MMMM [dallas] YYYY",
      LLL: "D. MMMM [dallas] YYYY HH.mm",
      LLLL: "dddd, [li] D. MMMM [dallas] YYYY HH.mm"
    },
    meridiemParse: /d\'o|d\'a/i,
    isPM: function (input) {
        return "d'o" === input.toLowerCase();
    },
    meridiem: function (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? "d'o" : "D'O";
        } else {
            return isLower ? "d'a" : "D'A";
        }
    },
    calendar: {
      sameDay: "[oxhi à] LT",
      nextDay: "[demà à] LT",
      nextWeek: "dddd [à] LT",
      lastDay: "[ieiri à] LT",
      lastWeek: "[sür el] dddd [lasteu à] LT",
      sameElse: "L"
    },
    relativeTime: {
      future: "osprei %s",
      past: "ja%s",
      s: processRelativeTime,
      ss: processRelativeTime,
      m: processRelativeTime,
      mm: processRelativeTime,
      h: processRelativeTime,
      hh: processRelativeTime,
      d: processRelativeTime,
      dd: processRelativeTime,
      M: processRelativeTime,
      MM: processRelativeTime,
      y: processRelativeTime,
      yy: processRelativeTime
    },
    dayOfMonthOrdinalParse: /\d{1,2}\./,
    ordinal: "%d.",
    week: {
      dow: 1,
      doy: 4
    }
  };
