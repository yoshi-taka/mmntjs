import moment from "./src/index.ts";

// trunc mode
const d2 = moment.duration(-500);
d2.round({ smallestUnit: "s", roundingMode: "trunc" });
console.log('trunc (-500ms):');
console.log('  seconds:', d2.seconds(), '_milliseconds:', d2._milliseconds, '_days:', d2._days, '_months:', d2._months);
console.log('  asMilliseconds:', d2.asMilliseconds());

// weeks
const d3 = moment.duration(432000000);
const d3a = d3.as("weeks");
console.log('\nweeks test: as("weeks") =', d3a);
d3.round({ smallestUnit: "week" });
console.log('  days:', d3.days(), '_days:', d3._days, '_milliseconds:', d3._milliseconds);
console.log('  asMilliseconds:', d3.asMilliseconds());

// months 45 days
const d4 = moment.duration(45, "days");
const d4a = d4.as("months");
console.log('\nmonths test: as("months") =', d4a);
d4.round({ smallestUnit: "month" });
console.log('  months:', d4.months(), '_months:', d4._months, '_days:', d4._days, '_milliseconds:', d4._milliseconds);
console.log('  asMilliseconds:', d4.asMilliseconds());

// quarter
const d5 = moment.duration(100, "days");
const d5a = d5.as("quarters");
console.log('\nquarter test: as("quarters") =', d5a);
d5.round({ smallestUnit: "quarter", roundingMode: "halfExpand" });
console.log('  months:', d5.months(), '_months:', d5._months, '_days:', d5._days, '_milliseconds:', d5._milliseconds);
console.log('  asMilliseconds:', d5.asMilliseconds());

// Q shorthand
const d8 = moment.duration(100, "days");
d8.round({ smallestUnit: "Q" });
console.log('\nQ test: as("quarters") =', moment.duration(100, "days").as("quarters"));
console.log('  months:', d8.months(), '_months:', d8._months);
