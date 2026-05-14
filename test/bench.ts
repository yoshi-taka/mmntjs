import mmntjs from "mmntjs";
import moment from "../moment/moment.js";

interface BenchCase {
  name: string;
  setup?: () => [() => void, () => void];
  run: () => [() => void, () => void];
}

interface BenchStats {
  median: number;
  min: number;
  max: number;
}

function micros(ns: number): string {
  if (ns < 1000) {
    return `${ns.toFixed(0)}ns`;
  }
  if (ns < 1_000_000) {
    return `${(ns / 1000).toFixed(2)}μs`;
  }
  return `${(ns / 1_000_000).toFixed(3)}ms`;
}

function run(fn: () => void, iterations: number): number {
  // warmup
  for (let i = 0; i < Math.min(iterations, 100); i++) {
    fn();
  }
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / iterations;
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

const CASES: BenchCase[] = [
  {
    name: "moment()",
    run: () => [() => moment(), () => mmntjs()],
  },
  {
    name: "moment([y,M,d])",
    run: () => [() => moment([2024, 0, 15]), () => mmntjs([2024, 0, 15])],
  },
  {
    name: "moment([y,M,d,h,m,s,ms])",
    run: () => [
      () => moment([2024, 0, 15, 10, 30, 45, 123]),
      () => mmntjs([2024, 0, 15, 10, 30, 45, 123]),
    ],
  },
  {
    name: "moment('ISO string')",
    run: () => [() => moment("2024-01-15T10:30:45.123Z"), () => mmntjs("2024-01-15T10:30:45.123Z")],
  },
  {
    name: "moment(Date)",
    run: () => {
      const d = new Date();
      return [() => moment(d), () => mmntjs(d)];
    },
  },
  {
    name: "format('YYYY-MM-DD')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [() => a.format("YYYY-MM-DD"), () => b.format("YYYY-MM-DD")];
    },
  },
  {
    name: "format('dddd, MMMM Do YYYY, h:mm:ss a')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [
        () => a.format("dddd, MMMM Do YYYY, h:mm:ss a"),
        () => b.format("dddd, MMMM Do YYYY, h:mm:ss a"),
      ];
    },
  },
  {
    name: "format('LL')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [() => a.format("LL"), () => b.format("LL")];
    },
  },
  {
    name: "getters (year,month,date,hour,min,sec,ms)",
    run: () => {
      const a = moment("2024-06-15 10:30:45.123"),
        b = mmntjs("2024-06-15 10:30:45.123");
      return [
        () => {
          a.year();
          a.month();
          a.date();
          a.hour();
          a.minute();
          a.second();
          a.millisecond();
        },
        () => {
          b.year();
          b.month();
          b.date();
          b.hour();
          b.minute();
          b.second();
          b.millisecond();
        },
      ];
    },
  },
  {
    name: "setters (year,month,date)",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [
        () => {
          a.year(2020);
          a.month(0);
          a.date(1);
        },
        () => {
          b.year(2020);
          b.month(0);
          b.date(1);
        },
      ];
    },
  },
  {
    name: "add(1,'day')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [() => a.add(1, "day"), () => b.add(1, "day")];
    },
  },
  {
    name: "add(1,'month')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [() => a.add(1, "month"), () => b.add(1, "month")];
    },
  },
  {
    name: "subtract(7,'days').add(1,'month')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [
        () => a.subtract(7, "days").add(1, "month"),
        () => b.subtract(7, "days").add(1, "month"),
      ];
    },
  },
  {
    name: "isBefore/isAfter/isSame",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      const c = moment("2024-07-01"),
        d = mmntjs("2024-07-01");
      return [
        () => {
          a.isBefore(c);
          a.isAfter(c);
          a.isSame(c);
        },
        () => {
          b.isBefore(d);
          b.isAfter(d);
          b.isSame(d);
        },
      ];
    },
  },
  {
    name: "isBetween",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      const c = moment("2024-01-01"),
        d = mmntjs("2024-01-01");
      const e = moment("2024-12-31"),
        f = mmntjs("2024-12-31");
      return [
        () => {
          a.isBetween(c, e);
          a.isBetween(c, e, "month");
          a.isBetween(c, e, undefined, "()");
        },
        () => {
          b.isBetween(d, f);
          b.isBetween(d, f, "month");
          b.isBetween(d, f, undefined, "()");
        },
      ];
    },
  },
  {
    name: "diff('days')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      const c = moment("2024-07-01"),
        d = mmntjs("2024-07-01");
      return [() => a.diff(c, "days"), () => b.diff(d, "days")];
    },
  },
  {
    name: "diff('months')",
    run: () => {
      const a = moment("2024-01-15"),
        b = mmntjs("2024-01-15");
      const c = moment("2024-12-01"),
        d = mmntjs("2024-12-01");
      return [() => a.diff(c, "months"), () => b.diff(d, "months")];
    },
  },
  {
    name: "startOf('month').endOf('month')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [
        () => {
          a.startOf("month");
          a.endOf("month");
        },
        () => {
          b.startOf("month");
          b.endOf("month");
        },
      ];
    },
  },
  {
    name: "startOf('week').startOf('year')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [
        () => {
          a.startOf("week");
          a.startOf("year");
        },
        () => {
          b.startOf("week");
          b.startOf("year");
        },
      ];
    },
  },
  {
    name: "clone",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [() => a.clone(), () => b.clone()];
    },
  },
  {
    name: "moment.duration(12345)",
    run: () => [() => moment.duration(12345), () => mmntjs.duration(12345)],
  },
  {
    name: "moment.duration(7,'days')",
    run: () => [() => moment.duration(7, "days"), () => mmntjs.duration(7, "days")],
  },
  {
    name: "valueOf / unix",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [
        () => {
          a.valueOf();
          a.unix();
        },
        () => {
          b.valueOf();
          b.unix();
        },
      ];
    },
  },
  {
    name: "daysInMonth / isLeapYear",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [
        () => {
          a.daysInMonth();
          a.isLeapYear();
        },
        () => {
          b.daysInMonth();
          b.isLeapYear();
        },
      ];
    },
  },
  {
    name: "startOf('year')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [() => a.startOf("year"), () => b.startOf("year")];
    },
  },
  {
    name: "endOf('year')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [() => a.endOf("year"), () => b.endOf("year")];
    },
  },
  {
    name: "moment('ISO string') with format",
    run: () => [
      () => moment("2024-01-15T10:30:45.123Z", "YYYY-MM-DDTHH:mm:ss.SSSZ"),
      () => mmntjs("2024-01-15T10:30:45.123Z", "YYYY-MM-DDTHH:mm:ss.SSSZ"),
    ],
  },
  {
    name: "moment.utc('ISO string')",
    run: () => [() => moment.utc("2024-01-15"), () => mmntjs.utc("2024-01-15")],
  },
  {
    name: "format('HH:mm:ss')",
    run: () => {
      const a = moment("2024-06-15 10:30:45"),
        b = mmntjs("2024-06-15 10:30:45");
      return [() => a.format("HH:mm:ss"), () => b.format("HH:mm:ss")];
    },
  },
  {
    name: "add(1,'year')",
    run: () => {
      const a = moment("2024-06-15"),
        b = mmntjs("2024-06-15");
      return [() => a.add(1, "year"), () => b.add(1, "year")];
    },
  },
];

const ITER = 5000;

console.log(
  `\ncold/warm benchmark (cold=median of ${COLD_RUNS}, warm=median of ${WARM_RUNS} runs; ~ = noisy short run):\n`,
);
console.log(
  "Operation                           cold mom     cold m2      %   warm mom     warm m2      %",
);
for (const c of CASES) {
  const coldMomentRuns: number[] = [];
  const coldMoment2Runs: number[] = [];
  for (let r = 0; r < COLD_RUNS; r++) {
    const [fnMoment, fnMoment2] = c.run();
    coldMomentRuns.push(runCold(fnMoment));
    coldMoment2Runs.push(runCold(fnMoment2));
  }
  coldMomentRuns.sort((a, b) => a - b);
  coldMoment2Runs.sort((a, b) => a - b);
  const coldMomentStats = {
    median: coldMomentRuns[Math.floor(COLD_RUNS / 2)],
    min: coldMomentRuns[0],
    max: coldMomentRuns[COLD_RUNS - 1],
  };
  const coldMoment2Stats = {
    median: coldMoment2Runs[Math.floor(COLD_RUNS / 2)],
    min: coldMoment2Runs[0],
    max: coldMoment2Runs[COLD_RUNS - 1],
  };

  const warmMomentRuns: number[] = [];
  const warmMoment2Runs: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    const [fnMoment, fnMoment2] = c.run();
    warmMomentRuns.push(run(fnMoment, ITER));
    warmMoment2Runs.push(run(fnMoment2, ITER));
  }
  warmMomentRuns.sort((a, b) => a - b);
  warmMoment2Runs.sort((a, b) => a - b);
  const warmMomentStats = {
    median: warmMomentRuns[Math.floor(WARM_RUNS / 2)],
    min: warmMomentRuns[0],
    max: warmMomentRuns[WARM_RUNS - 1],
  };
  const warmMoment2Stats = {
    median: warmMoment2Runs[Math.floor(WARM_RUNS / 2)],
    min: warmMoment2Runs[0],
    max: warmMoment2Runs[WARM_RUNS - 1],
  };

  const coldRatio = ratioLabel(coldMomentStats, coldMoment2Stats);
  const warmRatio = ratioLabel(warmMomentStats, warmMoment2Stats);

  console.log(
    `${c.name.padEnd(35)} ${micros(coldMomentStats.median).padStart(10)} ${micros(coldMoment2Stats.median).padStart(10)} ${coldRatio.padStart(6)}%  ${micros(warmMomentStats.median).padStart(10)} ${micros(warmMoment2Stats.median).padStart(10)} ${warmRatio.padStart(6)}%`,
  );
}
