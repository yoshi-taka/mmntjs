import { readFileSync, writeFileSync } from "fs";

let src = readFileSync("src/moment_fixed.ts", "utf8");

// 1. const d = this._d; → const d = this._getD();
src = src.replace(/const\s+d\s*=\s*this\._d\s*;/g, "const d = this._getD();");

// 2. this._d.getTime() → this._t (standalone, not part of larger expression)
// Do this carefully
src = src.replace(/this\._d\.getTime\(\)/g, "this._t");

// 3. this._d.setUTC → this._getD().setUTC
src = src.replace(/this\._d\.setUTC/g, "this._getD().setUTC");

// 4. this._d.setFullYear → this._getD().setFullYear
src = src.replace(/this\._d\.setFullYear/g, "this._getD().setFullYear");

// 5. this._d.setMonth → this._getD().setMonth
src = src.replace(/this\._d\.setMonth/g, "this._getD().setMonth");

// 6. this._d.setDate → this._getD().setDate
src = src.replace(/this\._d\.setDate/g, "this._getD().setDate");

// 7. this._d.setHours → this._getD().setHours
src = src.replace(/this\._d\.setHours/g, "this._getD().setHours");

// 8. this._d.setMinutes → this._getD().setMinutes
src = src.replace(/this\._d\.setMinutes/g, "this._getD().setMinutes");

// 9. this._d.setSeconds → this._getD().setSeconds
src = src.replace(/this\._d\.setSeconds/g, "this._getD().setSeconds");

// 10. this._d.setMilliseconds → this._getD().setMilliseconds
src = src.replace(/this\._d\.setMilliseconds/g, "this._getD().setMilliseconds");

// 11. this._d.getUTC → this._getD().getUTC
src = src.replace(/this\._d\.getUTC/g, "this._getD().getUTC");

// 12. this._d.getFullYear → this._getD().getFullYear
src = src.replace(/this\._d\.getFullYear/g, "this._getD().getFullYear");

// 13. this._d.getMonth → this._getD().getMonth
src = src.replace(/this\._d\.getMonth/g, "this._getD().getMonth");

// 14. this._d.getDate → this._getD().getDate
src = src.replace(/this\._d\.getDate/g, "this._getD().getDate");

// 15. this._d.getDay → this._getD().getDay
src = src.replace(/this\._d\.getDay/g, "this._getD().getDay");

// 16. this._d.getHours → this._getD().getHours
src = src.replace(/this\._d\.getHours/g, "this._getD().getHours");

// 17. this._d.getMinutes → this._d.getMinutes — wait, getMinutes conflicts with Date method
// Actually Date.getMinutes() exists. But there's also this._d.getMinutes() in the locale code.
// Let me be more specific by using the 'getXxx' pattern.
src = src.replace(/this\._d\.getMinutes/g, "this._getD().getMinutes");
src = src.replace(/this\._d\.getSeconds/g, "this._getD().getSeconds");
src = src.replace(/this\._d\.getMilliseconds/g, "this._getD().getMilliseconds");
src = src.replace(/this\._d\.getTimezoneOffset/g, "this._getD().getTimezoneOffset");

// 18. remaining: this._d = assignment (not in _getD or _dClone)
// We need to add this._t = d.getTime() after these
// But this is tricky to do automatically. Let me handle assignments.
// Pattern: this._d = ... → this._d = ...; this._t = this._d.getTime();
// But only for non-undefined assignments in non-_getD context

// Handle the common case: this._d = tmp or this._d = new Date(...)
// We need to be careful: some this._d = undefined assignments should stay as-is
src = src.replace(/this\._d\s*=\s*new\s+Date\s*\(/g, (match) => {
  return `this._d = new Date(`;
});

// Add _t sync after _d assignment (not including undefined/null)
// This regex matches: this._d = <expression>;  (but not undefined/null)
const assignmentRegex = /this\._d\s*=\s*([^;]+);(?!\s*this\._t)/g;
src = src.replace(assignmentRegex, (match, assignExpr) => {
  if (assignExpr.trim() === 'undefined') return match;
  return `this._d = ${assignExpr};\n    this._t = this._d.getTime();`;
});

// 19. Fix: this._d = this._getD() pattern shouldn't add _t sync
// The transform added _t sync after _getD() calls which is wrong
// Let me fix that
src = src.replace(/this\._d\s*=\s*this\._getD\(\);\n\s+this\._t = this\._d\.getTime\(\);/g, "this._d = this._getD();");

writeFileSync("src/moment_fixed.ts", src);
console.log("Transform applied successfully");
