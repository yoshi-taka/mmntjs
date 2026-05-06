import type { LocaleSpec } from "./en";

function relativeTimeWithMutation(number: number, withoutSuffix: boolean, key: string) {
    const format = {
        mm: 'munutenn',
        MM: 'miz',
        dd: 'devezh',
    };
    return `${number  } ${  mutation((format as Record<string, string>)[key], number)}`;
}

function specialMutationForYears(number: number) {
    switch (lastNumber(number)) {
        case 1:
        case 3:
        case 4:
        case 5:
        case 9:
            return `${number  } bloaz`;
        default:
            return `${number  } vloaz`;
    }
}

function lastNumber(number: number) {
    if (number > 9) {
        return lastNumber(number % 10);
    }
    return number;
}

function mutation(text: string, number: number) {
    if (number === 2) {
        return softMutation(text);
    }
    return text;
}

function softMutation(text: string) {
    const mutationTable: Record<string, string> = {
        m: 'v',
        b: 'v',
        d: 'z',
    };
    return mutationTable[text.charAt(0)] + text.substring(1);
}

const monthsParse = [
        /^gen/i,
        /^c[ʼ']hwe/i,
        /^meu/i,
        /^ebr/i,
        /^mae/i,
        /^(mez|eve)/i,
        /^gou/i,
        /^eos/i,
        /^gwe/i,
        /^her/i,
        /^du/i,
        /^ker/i,
    ],
    monthsRegex =
        /^(genver|c[ʼ']hwevrer|meurzh|ebrel|mae|mezheven|gouere|eost|gwengolo|here|du|kerzu|gen|c[ʼ']hwe|meu|ebr|mae|eve|gou|eos|gwe|her|du|ker)/i,
    monthsStrictRegex =
        /^(genver|c[ʼ']hwevrer|meurzh|ebrel|mae|mezheven|gouere|eost|gwengolo|here|du|kerzu)/i,
    monthsShortStrictRegex =
        /^(gen|c[ʼ']hwe|meu|ebr|mae|eve|gou|eos|gwe|her|du|ker)/i,
    fullWeekdaysParse = [
        /^sul/i,
        /^lun/i,
        /^meurzh/i,
        /^merc[ʼ']her/i,
        /^yaou/i,
        /^gwener/i,
        /^sadorn/i,
    ],
    shortWeekdaysParse = [
        /^Sul/i,
        /^Lun/i,
        /^Meu/i,
        /^Mer/i,
        /^Yao/i,
        /^Gwe/i,
        /^Sad/i,
    ],
    minWeekdaysParse = [
        /^Su/i,
        /^Lu/i,
        /^Me([^r]|$)/i,
        /^Mer/i,
        /^Ya/i,
        /^Gw/i,
        /^Sa/i,
    ];

export const brLocale: LocaleSpec = {
    months: 'Genver_Cʼhwevrer_Meurzh_Ebrel_Mae_Mezheven_Gouere_Eost_Gwengolo_Here_Du_Kerzu'.split(
        '_'
    ),
    monthsShort: 'Gen_Cʼhwe_Meu_Ebr_Mae_Eve_Gou_Eos_Gwe_Her_Du_Ker'.split('_'),
    weekdays: 'Sul_Lun_Meurzh_Mercʼher_Yaou_Gwener_Sadorn'.split('_'),
    weekdaysShort: 'Sul_Lun_Meu_Mer_Yao_Gwe_Sad'.split('_'),
    weekdaysMin: 'Su_Lu_Me_Mer_Ya_Gw_Sa'.split('_'),
    weekdaysParse: minWeekdaysParse,
    fullWeekdaysParse: fullWeekdaysParse,
    shortWeekdaysParse: shortWeekdaysParse,
    minWeekdaysParse: minWeekdaysParse,
    monthsRegex: monthsRegex,
    monthsShortRegex: monthsRegex,
    monthsStrictRegex: monthsStrictRegex,
    monthsShortStrictRegex: monthsShortStrictRegex,
    monthsParse: monthsParse,
    longMonthsParse: monthsParse,
    shortMonthsParse: monthsParse,
    longDateFormat: {
      LT: "HH:mm",
      LTS: "HH:mm:ss",
      L: "DD/MM/YYYY",
      LL: "D [a viz] MMMM YYYY",
      LLL: "D [a viz] MMMM YYYY HH:mm",
      LLLL: "dddd, D [a viz] MMMM YYYY HH:mm"
    },
    calendar: {
      sameDay: "[Hiziv da] LT",
      nextDay: "[Warcʼhoazh da] LT",
      nextWeek: "dddd [da] LT",
      lastDay: "[Decʼh da] LT",
      lastWeek: "dddd [paset da] LT",
      sameElse: "L"
    },
    relativeTime: {
      future: "a-benn %s",
      past: "%s ʼzo",
      s: "un nebeud segondennoù",
      ss: "%d eilenn",
      m: "ur vunutenn",
      mm: relativeTimeWithMutation,
      h: "un eur",
      hh: "%d eur",
      d: "un devezh",
      dd: relativeTimeWithMutation,
      M: "ur miz",
      MM: relativeTimeWithMutation,
      y: "ur bloaz",
      yy: specialMutationForYears
    },
    dayOfMonthOrdinalParse: /\d{1,2}(añ|vet)/,
    ordinal: function (number) {
        const output = number === 1 ? 'añ' : 'vet';
        return number + output;
    },
    week: {
      dow: 1,
      doy: 4
    },
    meridiemParse: /a.m.|g.m./,
    isPM: function (token) {
        return token === 'g.m.';
    },
    meridiem: function (hour, _minute, _isLower) {
        return hour < 12 ? 'a.m.' : 'g.m.';
    }
  };
