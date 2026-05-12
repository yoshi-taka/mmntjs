// @ts-expect-error: no types for ../moment2
import moment2 from "../moment2";
import { _localeCache } from "../src/locale-runtime";
import { setLocale } from "../src/locale";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";

function micros(ns: number) {
  if (ns < 1000) {return `${ns.toFixed(0)}ns`;}
  if (ns < 1_000_000) {return `${(ns / 1000).toFixed(2)}μs`;}
  return `${(ns / 1_000_000).toFixed(3)}ms`;
}

function run(fn: () => void, iter: number) {
  for (let i = 0; i < 10; i++) { fn(); } // warmup JIT
  const start = process.hrtime.bigint();
  for (let i = 0; i < iter; i++) { fn(); }
  return Number(process.hrtime.bigint() - start) / iter;
}

const date = new Date(2024, 5, 15, 10, 30, 45);
const ITER = 2000;

const cases = [
  {
    name: "LL (fr)",
    setupCold: () => { _localeCache.delete("fr"); setLocale("en"); },
    setupWarm: () => { moment2(date).locale("fr"); setLocale("en"); },
    m2: () => { moment2(date).locale("fr").format("LL"); },
    df: () => format(date, "PP", { locale: fr }),
  },
  {
    name: "LT (fr)",
    setupCold: () => { _localeCache.delete("fr"); setLocale("en"); },
    setupWarm: () => { moment2(date).locale("fr"); setLocale("en"); },
    m2: () => { moment2(date).locale("fr").format("LT"); },
    df: () => format(date, "p", { locale: fr }),
  },
  {
    name: "LLL (fr)",
    setupCold: () => { _localeCache.delete("fr"); setLocale("en"); },
    setupWarm: () => { moment2(date).locale("fr"); setLocale("en"); },
    m2: () => { moment2(date).locale("fr").format("LLL"); },
    df: () => format(date, "PPp", { locale: fr }),
  },
  {
    name: "LL (en)",
    setupWarm: () => { moment2(date); setLocale("en"); },
    m2: () => { moment2(date).format("LL"); },
    df: () => format(date, "PP", { locale: enUS }),
  },
  {
    name: "LT (en)",
    setupWarm: () => { moment2(date); setLocale("en"); },
    m2: () => { moment2(date).format("LT"); },
    df: () => format(date, "p", { locale: enUS }),
  },
  {
    name: "LLL (en)",
    setupWarm: () => { moment2(date); setLocale("en"); },
    m2: () => { moment2(date).format("LLL"); },
    df: () => format(date, "PPp", { locale: enUS }),
  },
];

console.log("Operation                moment2 cold   moment2 warm   date-fns      cold vs df  warm vs df");
for (const c of cases) {
  // cold
  if (c.setupCold) { c.setupCold(); }
  const cold = run(c.m2, ITER);
  // warm
  c.setupWarm();
  const warm = run(c.m2, ITER);
  // date-fns
  const dfT = run(c.df, ITER);

  const coldVs = (dfT / cold * 100).toFixed(1);
  const warmVs = (dfT / warm * 100).toFixed(1);
  console.log(
    `${c.name.padEnd(18)} ${micros(cold).padStart(11)} ${micros(warm).padStart(11)} ${micros(dfT).padStart(12)} ${coldVs.padStart(9)}% ${warmVs.padStart(9)}%`
  );
}
