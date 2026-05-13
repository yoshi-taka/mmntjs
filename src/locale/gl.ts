import type { Moment } from "../moment_core";
import type { LocaleSpec } from "./en";

export const glLocale: LocaleSpec = {
    months: 'xaneiro_febreiro_marzo_abril_maio_xuño_xullo_agosto_setembro_outubro_novembro_decembro'.split(
        '_'
    ),
    monthsShort: 'xan._feb._mar._abr._mai._xuñ._xul._ago._set._out._nov._dec.'.split(
            '_'
        ),
    monthsParseExact: true,
    weekdays: 'domingo_luns_martes_mércores_xoves_venres_sábado'.split('_'),
    weekdaysShort: 'dom._lun._mar._mér._xov._ven._sáb.'.split('_'),
    weekdaysMin: 'do_lu_ma_mé_xo_ve_sá'.split('_'),
    weekdaysParseExact: true,
    longDateFormat: {
      LT: "H:mm",
      LTS: "H:mm:ss",
      L: "DD/MM/YYYY",
      LL: "D [de] MMMM [de] YYYY",
      LLL: "D [de] MMMM [de] YYYY H:mm",
      LLLL: "dddd, D [de] MMMM [de] YYYY H:mm"
    },
    calendar: {
      sameDay: function (this: Moment) {
            return `[hoxe ${  this.hours() !== 1 ? 'ás' : 'á'  }] LT`;
        },
      nextDay: function (this: Moment) {
            return `[mañá ${  this.hours() !== 1 ? 'ás' : 'á'  }] LT`;
        },
      nextWeek: function (this: Moment) {
            return `dddd [${  this.hours() !== 1 ? 'ás' : 'a'  }] LT`;
        },
      lastDay: function (this: Moment) {
            return `[onte ${  this.hours() !== 1 ? 'á' : 'a'  }] LT`;
        },
      lastWeek: function (this: Moment) {
            return (
                `[o] dddd [pasado ${  this.hours() !== 1 ? 'ás' : 'a'  }] LT`
            );
        },
      sameElse: "L"
    },
    relativeTime: {
      future: function (str: string) {
            if (str.indexOf('un') === 0) {
                return `n${  str}`;
            }
            return `en ${  str}`;
        } as unknown as string,
      past: "hai %s",
      s: "uns segundos",
      ss: "%d segundos",
      m: "un minuto",
      mm: "%d minutos",
      h: "unha hora",
      hh: "%d horas",
      d: "un día",
      dd: "%d días",
      M: "un mes",
      MM: "%d meses",
      y: "un ano",
      yy: "%d anos"
    },
    dayOfMonthOrdinalParse: /\d{1,2}º/,
    ordinal: "%dº",
    week: {
      dow: 1,
      doy: 4
    }
  };
