import type { Moment } from "../moment_fixed";
import type { LocaleSpec } from "./en";

const translator = {
    words: {
        //Different grammatical cases
        ss: ['секунда', 'секунде', 'секунди'],
        m: ['један минут', 'једног минута'],
        mm: ['минут', 'минута', 'минута'],
        h: ['један сат', 'једног сата'],
        hh: ['сат', 'сата', 'сати'],
        d: ['један дан', 'једног дана'],
        dd: ['дан', 'дана', 'дана'],
        M: ['један месец', 'једног месеца'],
        MM: ['месец', 'месеца', 'месеци'],
        y: ['једну годину', 'једне године'],
        yy: ['годину', 'године', 'година'],
    },
    correctGrammaticalCase: function (number: number, wordKey: string) {
        if (
            number % 10 >= 1 &&
            number % 10 <= 4 &&
            (number % 100 < 10 || number % 100 >= 20)
        ) {
            return number % 10 === 1 ? wordKey[0] : wordKey[1];
        }
        return wordKey[2];
    },
    translate: function (number: number, withoutSuffix: boolean, key: string, isFuture: boolean) {
        let wordKey = (translator.words as Record<string, string[]>)[key],
            word;

        if (key.length === 1) {
            // Nominativ
            if (key === 'y' && withoutSuffix) {return 'једна година';}
            return isFuture || withoutSuffix ? wordKey[0] : wordKey[1];
        }

        word = translator.correctGrammaticalCase(number, wordKey);
        // Nominativ
        if (key === 'yy' && withoutSuffix && word === 'годину') {
            return `${number  } година`;
        }

        return `${number  } ${  word}`;
    },
};

export const sr_cyrlLocale: LocaleSpec = {
    months: 'јануар_фебруар_март_април_мај_јун_јул_август_септембар_октобар_новембар_децембар'.split(
        '_'
    ),
    monthsShort: 'јан._феб._мар._апр._мај_јун_јул_авг._сеп._окт._нов._дец.'.split('_'),
    monthsParseExact: true,
    weekdays: 'недеља_понедељак_уторак_среда_четвртак_петак_субота'.split('_'),
    weekdaysShort: 'нед._пон._уто._сре._чет._пет._суб.'.split('_'),
    weekdaysMin: 'не_по_ут_ср_че_пе_су'.split('_'),
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
      sameDay: "[данас у] LT",
      nextDay: "[сутра у] LT",
      nextWeek: function (this: Moment) {
            switch (this.day()) {
                case 0:
                    return '[у] [недељу] [у] LT';
                case 3:
                    return '[у] [среду] [у] LT';
                case 6:
                    return '[у] [суботу] [у] LT';
                case 1:
                case 2:
                case 4:
                case 5:
                    return '[у] dddd [у] LT';
            }
            return "";
        },
      lastDay: "[јуче у] LT",
      lastWeek: function (this: Moment) {
            const lastWeekDays = [
                '[прошле] [недеље] [у] LT',
                '[прошлог] [понедељка] [у] LT',
                '[прошлог] [уторка] [у] LT',
                '[прошле] [среде] [у] LT',
                '[прошлог] [четвртка] [у] LT',
                '[прошлог] [петка] [у] LT',
                '[прошле] [суботе] [у] LT',
            ];
            return lastWeekDays[this.day()];
        },
      sameElse: "L"
    },
    relativeTime: {
      future: "за %s",
      past: "пре %s",
      s: "неколико секунди",
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
