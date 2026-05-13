import moment from "./src/index.ts";

const d = moment.duration(1500);
d.round();
console.log('round default (1500ms):', d.asMilliseconds());

const d2 = moment.duration(6500);
d2.round({ smallestUnit: "seconds" });
console.log('round seconds (6500ms):', d2.seconds(), d2.asMilliseconds(), 'milliseconds:', d2.milliseconds());

const d3 = moment.duration(125000);
d3.round({ smallestUnit: "minute", roundingMode: "halfExpand" });
console.log('round minute (125000ms):', d3.minutes(), d3.asMilliseconds());

const d4 = moment.duration(100);
d4.round({ smallestUnit: "second", roundingMode: "ceil" });
console.log('round ceil (100ms):', d4.seconds(), d4.asMilliseconds());

const d5 = moment.duration(1800);
d5.round({ smallestUnit: "second", roundingMode: "floor" });
console.log('round floor (1800ms):', d5.seconds(), d5.asMilliseconds());

const d6 = moment.duration(-500);
d6.round({ smallestUnit: "second", roundingMode: "trunc" });
console.log('round trunc (-500ms):', d6.seconds(), d6.asMilliseconds());

// Check the state of a rounded duration
const d7 = moment.duration(100);
d7.round({ smallestUnit: "second", roundingMode: "ceil" });
console.log('After ceil round of 100ms:');
console.log('  _milliseconds:', d7._milliseconds);
console.log('  _days:', d7._days);
console.log('  _months:', d7._months);
console.log('  hours:', d7.hours(), 'minutes:', d7.minutes(), 'seconds:', d7.seconds(), 'ms:', d7.milliseconds());
