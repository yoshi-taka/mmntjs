import moment from "./src/index.ts";

const d5 = moment.duration(100, "days");
console.log('before:', '_months:', d5._months, '_days:', d5._days, '_milliseconds:', d5._milliseconds);
const d5a = d5.as("quarters");
console.log('as quarters:', d5a, '_months:', d5._months, '_days:', d5._days, '_milliseconds:', d5._milliseconds);
d5._months, d5.quarter, d5._months, d5._days, d5._milliseconds;

const d = moment.duration(100, "days");
console.log('\nstep by step:');
const unitKey = "quarters";
const total = d.as(unitKey);
console.log('  as("quarters"):', total);
const divided = total / 1;
console.log('  divided:', divided);
const rounded = Math.round(divided);
console.log('  rounded:', rounded);
d._months = 0; d._days = 0; d._milliseconds = 0;
console.log('  after zeroing out:', d._months, d._days, d._milliseconds);
d._months = rounded * 1 * 3;
console.log('  after setting months:', d._months, d._days, d._milliseconds);
d._bubble();
console.log('  after _bubble:', d._months, d._days, d._milliseconds);
const unit = "quarter";
console.log('  switch unit:', unit);
console.log('  _months again:', d._months);
console.log('  asMilliseconds:', d.asMilliseconds());
console.log('  valueOf:', d.valueOf());
