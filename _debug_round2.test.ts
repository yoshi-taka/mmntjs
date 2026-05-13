import moment from "./src/index.ts";

const d = moment.duration(100);
console.log('Before round:');
console.log('  _milliseconds:', d._milliseconds);
console.log('  _days:', d._days);
console.log('  _months:', d._months);
console.log('  as("second"):', d.as("second"));

d.round({ smallestUnit: "second", roundingMode: "ceil" });
console.log('After round:');
console.log('  _milliseconds:', d._milliseconds);
console.log('  _days:', d._days);
console.log('  _months:', d._months);
console.log('  seconds:', d.seconds());
console.log('  asMilliseconds:', d.asMilliseconds());

// Let me also check as() for various units
const d2 = moment.duration(100);
console.log('\nas years:', d2.as("years"));
console.log('as months:', d2.as("months"));
console.log('as weeks:', d2.as("weeks"));
console.log('as days:', d2.as("days"));
console.log('as hours:', d2.as("hours"));
console.log('as minutes:', d2.as("minutes"));
console.log('as seconds:', d2.as("seconds"));
console.log('as milliseconds:', d2.as("milliseconds"));
console.log('as quarters:', d2.as("quarters"));
