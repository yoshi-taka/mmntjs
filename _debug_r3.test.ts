import moment from "./src/index.ts";

// default round
const d = moment.duration(1500);
d.round();
console.log('default (1500ms):', d.asMilliseconds());

// trunc mode
const d2 = moment.duration(-500);
d2.round({ smallestUnit: "s", roundingMode: "trunc" });
console.log('trunc (-500ms):', d2.seconds(), d2.asMilliseconds());

// weeks
const d3 = moment.duration(432000000);
d3.round({ smallestUnit: "week" });
console.log('weeks (432000000ms):', d3.days(), d3.asMilliseconds());

// months
const d4 = moment.duration(45, "days");
d4.round({ smallestUnit: "month" });
console.log('months (45 days):', d4.months(), d4.asMilliseconds());

// quarter
const d5 = moment.duration(100, "days");
d5.round({ smallestUnit: "quarter", roundingMode: "halfExpand" });
console.log('quarter (100 days):', d5.months(), d5.asMilliseconds());

// ms shorthand
const d6 = moment.duration(5000);
d6.round({ smallestUnit: "ms", roundingIncrement: 1000 });
console.log('ms (5000ms):', d6.asMilliseconds());

// w shorthand
const d7 = moment.duration(864000000);
d7.round({ smallestUnit: "w" });
console.log('w (864000000ms):', d7.days(), d7.asMilliseconds());

// Q shorthand
const d8 = moment.duration(100, "days");
d8.round({ smallestUnit: "Q" });
console.log('Q (100 days):', d8.months(), d8.asMilliseconds());
