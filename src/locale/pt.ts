// @ts-expect-error Locale property shapes are intentionally loose
import type { LocaleSpec } from "./en";

export const ptLocale: LocaleSpec = {
    months: 'janeiro_fevereiro_março_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro'.split(
        '_'
    ),
    monthsShort: 'jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez'.split('_'),
    weekdays: 'Domingo_Segunda-feira_Terça-feira_Quarta-feira_Quinta-feira_Sexta-feira_Sábado'.split(
            '_'
        ),
    weekdaysShort: 'Dom_Seg_Ter_Qua_Qui_Sex_Sáb'.split('_'),
    weekdaysMin: 'Do_2ª_3ª_4ª_5ª_6ª_Sá'.split('_'),
    weekdaysParseExact: true,
    longDateFormat: {
      LT: "HH:mm",
      LTS: "HH:mm:ss",
      L: "DD/MM/YYYY",
      LL: "D [de] MMMM [de] YYYY",
      LLL: "D [de] MMMM [de] YYYY HH:mm",
      LLLL: "dddd, D [de] MMMM [de] YYYY HH:mm"
    },
    calendar: {
      sameDay: "[Hoje às] LT",
      nextDay: "[Amanhã às] LT",
      nextWeek: "dddd [às] LT",
      lastDay: "[Ontem às] LT",
      lastWeek: function () {
            return this.day() === 0 || this.day() === 6
                ? '[Último] dddd [às] LT' // Saturday + Sunday
                : '[Última] dddd [às] LT'; // Monday - Friday
        },
      sameElse: "L"
    },
    relativeTime: {
      future: "em %s",
      past: "há %s",
      s: "segundos",
      ss: "%d segundos",
      m: "um minuto",
      mm: "%d minutos",
      h: "uma hora",
      hh: "%d horas",
      d: "um dia",
      dd: "%d dias",
      w: "uma semana",
      ww: "%d semanas",
      M: "um mês",
      MM: "%d meses",
      y: "um ano",
      yy: "%d anos"
    },
    dayOfMonthOrdinalParse: /\d{1,2}º/,
    ordinal: "%dº",
    week: {
      dow: 1,
      doy: 4
    }
  };
