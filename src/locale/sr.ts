import type { Moment } from "../moment_fixed";
import type { LocaleSpec } from "./en";

const translator = {
    words: {
        //Different grammatical cases
        ss: ['sekunda', 'sekunde', 'sekundi'],
        m: ['jedan minut', 'jednog minuta'],
        mm: ['minut', 'minuta', 'minuta'],
        h: ['jedan sat', 'jednog sata'],
        hh: ['sat', 'sata', 'sati'],
        d: ['jedan dan', 'jednog dana'],
        dd: ['dan', 'dana', 'dana'],
        M: ['jedan mesec', 'jednog meseca'],
        MM: ['mesec', 'meseca', 'meseci'],
        y: ['jednu godinu', 'jedne godine'],
        yy: ['godinu', 'godine', 'godina'],
    },
    correctGrammaticalCase: function (number: number, wordKey: string[]) {
        return number === 1
            ? wordKey[0]
            : number >= 2 && number <= 4
              ? wordKey[1]
              : wordKey[2];
    },
    translate: function (number: number, withoutSuffix: boolean, key: string, isFuture: boolean) {
        let wordKey = (translator.words as Record<string, string[]>)[key],
            word;

        if (key.length === 1) {
            // Nominativ
            if (key === 'y' && withoutSuffix) {return 'jedna godina';}
            return isFuture || withoutSuffix ? wordKey[0] : wordKey[1];
        }

        word = translator.correctGrammaticalCase(number, wordKey);
        // Nominativ
        if (key === 'yy' && withoutSuffix && word === 'godinu') {
            return `${number  } godina`;
        }

        return `${number  } ${  word}`;
    },
};

export const srLocale: LocaleSpec = {
    months: 'januar_februar_mart_april_maj_jun_jul_avgust_septembar_oktobar_novembar_decembar'.split(
        '_'
    ),
    monthsShort: 'jan._feb._mar._apr._maj_jun_jul_avg._sep._okt._nov._dec.'.split('_'),
    monthsParseExact: true,
    weekdays: 'nedelja_ponedeljak_utorak_sreda_četvrtak_petak_subota'.split(
        '_'
    ),
    weekdaysShort: 'ned._pon._uto._sre._čet._pet._sub.'.split('_'),
    weekdaysMin: 'ne_po_ut_sr_če_pe_su'.split('_'),
    weekdaysParseExact: true,
    longDateFormat: {
      LT: "H:mm",
      LTS: "H:mm:ss",
      L: "D. M. YYYY.",
      LL: "D. MMMM YYYY.",
      LLL: "D. MMMM YYYY. H:mm",
      LLLL: "dddd, D. MMMM YYYY. H:mm"
    },
    calendar: {
      sameDay: "[danas u] LT",
      nextDay: "[sutra u] LT",
      nextWeek: function (this: Moment) {
            switch (this.day()) {
                case 0:
                    return '[u] [nedelju] [u] LT';
                case 3:
                    return '[u] [sredu] [u] LT';
                case 6:
                    return '[u] [subotu] [u] LT';
                case 1:
                case 2:
                case 4:
                case 5:
                    return '[u] dddd [u] LT';
            }
            return "";
        },
      lastDay: "[juče u] LT",
      lastWeek: function (this: Moment) {
            const lastWeekDays = [
                '[prošle] [nedelje] [u] LT',
                '[prošlog] [ponedeljka] [u] LT',
                '[prošlog] [utorka] [u] LT',
                '[prošle] [srede] [u] LT',
                '[prošlog] [četvrtka] [u] LT',
                '[prošlog] [petka] [u] LT',
                '[prošle] [subote] [u] LT',
            ];
            return lastWeekDays[this.day()];
        },
      sameElse: "L"
    },
    relativeTime: {
      future: "za %s",
      past: "pre %s",
      s: "nekoliko sekundi",
      ss: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      m: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      mm: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      h: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      hh: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      d: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      dd: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      M: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      MM: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      y: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture),
      yy: (number, withoutSuffix, key, isFuture) => translator.translate(number, withoutSuffix, key, isFuture)
    },
    dayOfMonthOrdinalParse: /\d{1,2}\./,
    ordinal: "%d.",
    week: {
      dow: 1,
      doy: 7
    }
  };
