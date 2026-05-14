import mmntjs from "mmntjs";
import {
  parseISO,
  getDayOfYear,
  addDays,
  addMonths,
  addSeconds,
  addMilliseconds,
  subDays,
  format,
  lightFormat,
  isAfter,
  isBefore,
  startOfMonth,
  startOfYear,
  endOfMonth,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  getDaysInMonth,
  isLeapYear,
  setYear,
} from "date-fns";

function micros(ns: number): string {
  if (ns < 1000) {
    return `${ns.toFixed(0)}ns`;
  }
  if (ns < 1_000_000) {
    return `${(ns / 1000).toFixed(2)}\u03BCs`;
  }
  return `${(ns / 1_000_000).toFixed(3)}ms`;
}

interface BenchStats {
  median: number;
  min: number;
  max: number;
}

function run(fn: () => void, iter: number, warmup = 500): number {
  for (let i = 0; i < warmup; i++) {
    fn();
  }
  const start = process.hrtime.bigint();
  for (let i = 0; i < iter; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / iter;
}

function runCold(fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return Number(end - start);
}

function relativeSpread(stats: BenchStats): number {
  if (stats.median === 0) {
    return 0;
  }
  return (stats.max - stats.min) / stats.median;
}

function ratioLabel(base: BenchStats, candidate: BenchStats): string {
  const ratio = ((candidate.median / base.median) * 100).toFixed(1);
  const unstable =
    base.median < 100 ||
    candidate.median < 100 ||
    relativeSpread(base) > 0.25 ||
    relativeSpread(candidate) > 0.25;
  return unstable ? `~${ratio}` : ratio;
}

const COLD_RUNS = 20;
const WARM_RUNS = 5;

const CASES = [
  {
    name: "parse ISO string",
    run: () => [
      () => mmntjs("2024-01-15T10:30:45.123Z"),
      () => parseISO("2024-01-15T10:30:45.123Z"),
    ],
  },
  {
    name: "get day of year",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.dayOfYear(), () => getDayOfYear(b)];
    },
  },
  {
    name: "add 1 day",
    run: () => {
      const a = mmntjs("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [
        () => a.add(1, "day"),
        () => {
          b2 = addDays(b2, 1);
        },
      ];
    },
  },
  {
    name: "format YYYY-MM-DD",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.format("YYYY-MM-DD"), () => format(b, "yyyy-MM-dd")];
    },
  },
  {
    name: "lightFormat YYYY-MM-DD",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.format("YYYY-MM-DD"), () => lightFormat(b, "yyyy-MM-dd")];
    },
  },
  {
    name: "Intl.DateTimeFormat YYYY-MM-DD (sv-SE)",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = new Date(2024, 5, 15);
      const fmt = new Intl.DateTimeFormat("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return [() => a.format("YYYY-MM-DD"), () => fmt.format(b)];
    },
  },
  {
    name: "Intl.DateTimeFormat YYYY-MM-DD (ar-SA)",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = new Date(2024, 5, 15);
      const fmt = new Intl.DateTimeFormat("ar-SA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return [() => a.format("YYYY-MM-DD"), () => fmt.format(b)];
    },
  },
  {
    name: "isAfter",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = mmntjs("2024-07-01");
      const c = new Date(2024, 5, 15);
      const d = new Date(2024, 6, 1);
      return [() => a.isAfter(b), () => isAfter(c, d)];
    },
  },
  {
    name: "startOf month",
    run: () => {
      const a = mmntjs("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [
        () => a.startOf("month"),
        () => {
          b2 = startOfMonth(b2);
        },
      ];
    },
  },
  {
    name: "diff in days",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = mmntjs("2024-07-01");
      const c = new Date(2024, 5, 15);
      const d = new Date(2024, 6, 1);
      return [() => a.diff(b, "days"), () => differenceInCalendarDays(d, c)];
    },
  },
  {
    name: "moment() / new Date()",
    run: () => [() => mmntjs(), () => new Date()],
  },
  {
    name: "startOf year",
    run: () => {
      const a = mmntjs("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [
        () => a.startOf("year"),
        () => {
          b2 = startOfYear(b2);
        },
      ];
    },
  },
  {
    name: "endOf month",
    run: () => {
      const a = mmntjs("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [
        () => a.endOf("month"),
        () => {
          b2 = endOfMonth(b2);
        },
      ];
    },
  },
  {
    name: "add 1 month",
    run: () => {
      const a = mmntjs("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      const fnDF = () => {
        b2 = addMonths(b2, 1);
      };
      return [() => a.add(1, "month"), fnDF];
    },
  },
  {
    name: "add 1 second",
    run: () => {
      const a = mmntjs("2024-06-15 10:30:45.123");
      let b2 = new Date(2024, 5, 15, 10, 30, 45, 123);
      return [
        () => a.add(1, "second"),
        () => {
          b2 = addSeconds(b2, 1);
        },
      ];
    },
  },
  {
    name: "add 1 ms",
    run: () => {
      const a = mmntjs("2024-06-15 10:30:45.123");
      let b2 = new Date(2024, 5, 15, 10, 30, 45, 123);
      return [
        () => a.add(1, "millisecond"),
        () => {
          b2 = addMilliseconds(b2, 1);
        },
      ];
    },
  },
  {
    name: "sub 1 day",
    run: () => {
      const a = mmntjs("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [
        () => a.add(-1, "day"),
        () => {
          b2 = subDays(b2, 1);
        },
      ];
    },
  },
  {
    name: "diff in months",
    run: () => {
      const a = mmntjs("2024-01-15");
      const b = mmntjs("2024-12-01");
      const c = new Date(2024, 0, 15);
      const d = new Date(2024, 11, 1);
      return [() => a.diff(b, "months"), () => differenceInCalendarMonths(d, c)];
    },
  },
  {
    name: "format HH:mm:ss",
    run: () => {
      const a = mmntjs("2024-06-15 10:30:45");
      const b = new Date(2024, 5, 15, 10, 30, 45);
      return [() => a.format("HH:mm:ss"), () => format(b, "HH:mm:ss")];
    },
  },
  {
    name: "lightFormat HH:mm:ss",
    run: () => {
      const a = mmntjs("2024-06-15 10:30:45");
      const b = new Date(2024, 5, 15, 10, 30, 45);
      return [() => a.format("HH:mm:ss"), () => lightFormat(b, "HH:mm:ss")];
    },
  },
  {
    name: "Intl.DateTimeFormat HH:mm:ss (en-US)",
    run: () => {
      const a = mmntjs("2024-06-15 10:30:45");
      const b = new Date(2024, 5, 15, 10, 30, 45);
      const fmt = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return [() => a.format("HH:mm:ss"), () => fmt.format(b)];
    },
  },
  {
    name: "Intl.DateTimeFormat HH:mm:ss (ar-SA)",
    run: () => {
      const a = mmntjs("2024-06-15 10:30:45");
      const b = new Date(2024, 5, 15, 10, 30, 45);
      const fmt = new Intl.DateTimeFormat("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return [() => a.format("HH:mm:ss"), () => fmt.format(b)];
    },
  },
  {
    name: "isBefore",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = mmntjs("2024-07-01");
      const c = new Date(2024, 5, 15);
      const d = new Date(2024, 6, 1);
      return [() => a.isBefore(b), () => isBefore(c, d)];
    },
  },
  {
    name: "daysInMonth",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.daysInMonth(), () => getDaysInMonth(b)];
    },
  },
  {
    name: "isLeapYear",
    run: () => {
      const a = mmntjs("2024-06-15");
      const b = new Date(2024, 5, 15);
      return [() => a.isLeapYear(), () => isLeapYear(b)];
    },
  },
  {
    name: "set year",
    run: () => {
      const a = mmntjs("2024-06-15");
      let b2 = new Date(2024, 5, 15);
      return [
        () => a.year(2020),
        () => {
          b2 = setYear(b2, 2020);
        },
      ];
    },
  },
];

const ITER = 5000;
const WARMUP = 1000;

console.log(
  "Operation                           cold m2      cold df      %    warm m2      warm df      %",
);
console.log("(median of repeated runs; ~ = noisy short run)");
for (const c of CASES) {
  const cm: number[] = [],
    cd: number[] = [];
  for (let r = 0; r < COLD_RUNS; r++) {
    const [fnM2, fnDF] = c.run();
    cm.push(runCold(fnM2));
    cd.push(runCold(fnDF));
  }
  cm.sort((a, b) => a - b);
  cd.sort((a, b) => a - b);
  const coldM2Stats = { median: cm[Math.floor(COLD_RUNS / 2)], min: cm[0], max: cm[COLD_RUNS - 1] };
  const coldDFStats = { median: cd[Math.floor(COLD_RUNS / 2)], min: cd[0], max: cd[COLD_RUNS - 1] };

  const tm: number[] = [],
    td: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    const [fnM2, fnDF] = c.run();
    tm.push(run(fnM2, ITER, WARMUP));
    td.push(run(fnDF, ITER, WARMUP));
  }
  tm.sort((a, b) => a - b);
  td.sort((a, b) => a - b);
  const warmM2Stats = { median: tm[Math.floor(WARM_RUNS / 2)], min: tm[0], max: tm[WARM_RUNS - 1] };
  const warmDFStats = { median: td[Math.floor(WARM_RUNS / 2)], min: td[0], max: td[WARM_RUNS - 1] };
  const coldRatio = ratioLabel(coldM2Stats, coldDFStats);
  const warmRatio = ratioLabel(warmM2Stats, warmDFStats);

  console.log(
    `${c.name.padEnd(35)} ${micros(coldM2Stats.median).padStart(10)} ${micros(coldDFStats.median).padStart(10)} ${coldRatio.padStart(6)}%  ${micros(warmM2Stats.median).padStart(10)} ${micros(warmDFStats.median).padStart(10)} ${warmRatio.padStart(6)}%`,
  );
}
