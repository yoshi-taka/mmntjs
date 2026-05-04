import { readFileSync, writeFileSync } from "fs";

let src = readFileSync("src/moment_fixed.ts", "utf8");

// Remaining patterns to fix:

// 1. const dt = this._d; → const dt = this._getD();
src = src.replace(/const\s+dt\s*=\s*this\._d\s*;/g, "const dt = this._getD();");

// 2. const d = this._d; (already handled but check)
// Some might have been missed with different whitespace
src = src.replace(/const\s+(d|dt)\s*=\s*this\._d\s*;?/g, (match, varName) => {
  if (match.includes("_getD")) return match; // already transformed
  return `const ${varName} = this._getD();`;
});

// 3. this._d used as function argument for helper functions
src = src.replace(/getLocaleWeek\(this\._d,/g, "getLocaleWeek(this._getD(),");
src = src.replace(/getLocaleWeekYear\(this\._d,/g, "getLocaleWeekYear(this._getD(),");
src = src.replace(/getISOWeekNumber\(this\._d,/g, "getISOWeekNumber(this._getD(),");
src = src.replace(/getISOWeekYear\(this\._d,/g, "getISOWeekYear(this._getD(),");

// 4. Local/utc/utcOffset methods - these reassign _d and then use it
// Need to fix: this._d = new Date(...) → keep as is (creates new Date)
// But the reads from this._d after assignment need _getD()
// These are already partially handled by the _d = new Date() → _t sync

// 5. toISOString uses this._d 
src = src.replace(/const\s+d\s*=\s*this\._d;\s*const\s+year/g, "const d = this._getD();\n      const year");
// unique pattern in toISOString
src = src.replace(/const utcMs = this\._isUTC \? this\._d\.getTime\(\)/g, "const utcMs = this._isUTC ? this._t");

// 6. isDST uses this._d
src = src.replace(/const jan = new Date\(this\._d\.getFullYear\(\)/g, "const jan = new Date(this._getD().getFullYear()");
src = src.replace(/const jul = new Date\(this\._d\.getFullYear\(\)/g, "const jul = new Date(this._getD().getFullYear()");
src = src.replace(/return this\._d\.getTimezoneOffset\(\)/g, "return this._getD().getTimezoneOffset()");

// 7. diff uses a._d in addMonths closure
src = src.replace(/const anchorVal = addMonths\(a\._d,/g, "const anchorVal = addMonths(a._getD(),");
src = src.replace(/addMonths\(a\._d,/g, "addMonths(a._getD(),");

// 8. _addSimple const d = this._d → should already be handled, but let me check
src = src.replace(/const d = this\._d;\s+let changedDays/g, "const d = this._getD();\n    let changedDays");

// 9. _applyDuration const d = this._d;
src = src.replace(/_applyDuration.*\n.*const d = this\._d;/g, (match) => {
  return match.replace(/const d = this\._d;/, "const d = this._getD();");
});

// 10. week method
src = src.replace(/const current = getLocaleWeek\(this\._d,/g, "const current = getLocaleWeek(this._getD(),");
src = src.replace(/const d = this\._d;\s+if \(this\._isUTC\)/g, "const d = this._getD();\n      if (this._isUTC)");

// 11. isoWeek
src = src.replace(/const current = getISOWeekNumber\(this\._d,/g, "const current = getISOWeekNumber(this._getD(),");

// 12. weekYear
src = src.replace(/let currentWeek = getLocaleWeek\(this\._d,/g, "let currentWeek = getLocaleWeek(this._getD(),");
src = src.replace(/return getISOWeekYear\(this\._d,/g, "return getISOWeekYear(this._getD(),");
src = src.replace(/return getLocaleWeekYear\(this\._d,/g, "return getLocaleWeekYear(this._getD(),");

// 13. isoWeekYear
src = src.replace(/let currentWeek = getISOWeekNumber\(this\._d,/g, "let currentWeek = getISOWeekNumber(this._getD(),");
src = src.replace(/return getISOWeekYear\(this\._d,/g, "return getISOWeekYear(this._getD(),");

// 14. parseZone references this._d
src = src.replace(/m\._d = new Date\(m\.valueOf\(\)/g, "m._d = new Date(m.valueOf()");

// 15. set method const d = this._d;
src = src.replace(/const d = this\._d;\s+const yearVal/g, "const d = this._getD();\n      const yearVal");

writeFileSync("src/moment_fixed.ts", src);
console.log("Phase 2 transform applied");
