import { readFileSync, writeFileSync } from "fs";

let src = readFileSync("src/moment_fixed.ts", "utf8");

// After each setter that modifies Date via _getD(), add _t sync.

// 1. year() setter: before "this._updateOffset" add this._t = dt.getTime()
// The year method has: this._updateOffset(true); return this;
src = src.replace(
  "this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();\n      // $H, $m, $s, $ms unchanged\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$y : NaN;",
  "this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();\n      // $H, $m, $s, $ms unchanged\n      this._t = dt.getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$y : NaN;"
);

// 2. month() setter: before "this._updateOffset" add this._t = this._getD().getTime()
src = src.replace(
  "this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();\n      this._updateOffset(true);",
  "this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();\n      this._t = this._getD().getTime();\n      this._updateOffset(true);"
);

// 3. date() setter
src = src.replace(
  "this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$D : NaN;",
  "this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();\n      this._t = this._getD().getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$D : NaN;"
);

// 4. day() setter
src = src.replace(
  "this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$W : NaN;\n  }\n\n  weekday(",
  "this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();\n      this._t = dt.getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$W : NaN;\n  }\n\n  weekday("
);

// 5. weekday() setter
src = src.replace(
  "this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();\n      this._updateOffset(true);\n      return this;\n    }\n    const day = this.$W;\n    const weekConfig",
  "this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();\n      this._t = dt.getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    const day = this.$W;\n    const weekConfig"
);

// 6. isoWeekday() setter
src = src.replace(
  "this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();\n      this._updateOffset(true);\n      return this;\n    }\n    return this.$W === 0 ? 7 : this.$W;\n  }\n\n  dayOfYear(",
  "this.$W = this._isUTC ? dt.getUTCDay() : dt.getDay();\n      this._t = dt.getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    return this.$W === 0 ? 7 : this.$W;\n  }\n\n  dayOfYear("
);

// 7. dayOfYear() setter
src = src.replace(
  "this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();\n      this._updateOffset(true);\n      return this;",
  "this.$W = this._isUTC ? this._getD().getUTCDay() : this._getD().getDay();\n      this._t = this._getD().getTime();\n      this._updateOffset(true);\n      return this;"
);

// 8. hour() setter
src = src.replace(
  "this.$H = this._isUTC ? this._getD().getUTCHours() : this._getD().getHours();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$H : NaN;\n  }\n\n  minute(",
  "this.$H = this._isUTC ? this._getD().getUTCHours() : this._getD().getHours();\n      this._t = this._getD().getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$H : NaN;\n  }\n\n  minute("
);

// 9. minute() setter
src = src.replace(
  "this.$m = this._isUTC ? this._getD().getUTCMinutes() : this._getD().getMinutes();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$m : NaN;\n  }\n\n  second(",
  "this.$m = this._isUTC ? this._getD().getUTCMinutes() : this._getD().getMinutes();\n      this._t = this._getD().getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$m : NaN;\n  }\n\n  second("
);

// 10. second() setter
src = src.replace(
  "this.$s = this._isUTC ? this._getD().getUTCSeconds() : this._getD().getSeconds();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$s : NaN;\n  }\n\n  millisecond(",
  "this.$s = this._isUTC ? this._getD().getUTCSeconds() : this._getD().getSeconds();\n      this._t = this._getD().getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$s : NaN;\n  }\n\n  millisecond("
);

// 11. millisecond() setter
src = src.replace(
  "this.$ms = this._isUTC ? this._getD().getUTCMilliseconds() : this._getD().getMilliseconds();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$ms : NaN;\n  }",
  "this.$ms = this._isUTC ? this._getD().getUTCMilliseconds() : this._getD().getMilliseconds();\n      this._t = this._getD().getTime();\n      this._updateOffset(true);\n      return this;\n    }\n    return this._isValid ? this.$ms : NaN;\n  }"
);

// 12. _addSimple: add _t sync before _refreshFields
const addSyncBeforeRefresh = (block) => {
  // Add this._t = d.getTime(); before this._refreshFields(); within _addSimple
  return block.replace(
    /(d\.setTime\([^)]+\);\s*)(this\._refreshFields\(\))/g,
    "$1    this._t = d.getTime();\n    $2"
  );
};
src = addSyncBeforeRefresh(src);

// 13. _addSimple year/quarter/month blocks add _t sync
src = src.replace(
  "this.$W = this._isUTC ? d.getUTCDay() : d.getDay();\n        break;\n      }\n      case \"month\":",
  "this.$W = this._isUTC ? d.getUTCDay() : d.getDay();\n        this._t = d.getTime();\n        break;\n      }\n      case \"month\":"
);

src = src.replace(
  "this.$W = this._isUTC ? d.getUTCDay() : d.getDay();\n        break;\n      }\n      case \"isoWeek\":",
  "this.$W = this._isUTC ? d.getUTCDay() : d.getDay();\n        this._t = d.getTime();\n        break;\n      }\n      case \"isoWeek\":"
);

// 14. _applyDuration: add _t sync after modifications
src = src.replace(
  "    this._refreshFields();\n    this._updateOffset(!(!months && !days));\n    if (isNaN(d.getTime())) this._isValid = false;\n  }",
  "    this._t = d.getTime();\n    this._refreshFields();\n    this._updateOffset(!(!months && !days));\n    if (isNaN(d.getTime())) this._isValid = false;\n  }"
);

// 15. startOf UTC: after each case, add _t sync
// For startOf, after the switch and offset check, add _t sync
src = src.replace(
  "    if (!this._isUTC) this._offset = -this._getD().getTimezoneOffset();\n    this._updateOffset(true);\n    return this;\n  }",
  "    this._t = this._getD().getTime();\n    if (!this._isUTC) this._offset = -this._getD().getTimezoneOffset();\n    this._updateOffset(true);\n    return this;\n  }"
);

// But we need to be specific to startOf method. Let me replace with more context.
// The two startOf methods (startOf and endOf) both have this pattern.
// Let me replace for startOf only:
src = src.replace(
  "  startOf(unit: string): Moment {\n    const u = normalizeUnits(unit);\n    if (!u) return this;\n    const d = this._getD();\n\n    if (this._isUTC) {\n      switch (u)",
  "  startOf(unit: string): Moment {\n    const u = normalizeUnits(unit);\n    if (!u) return this;\n    const d = this._getD();\n\n    if (this._isUTC) {\n      switch (u)"
);
// startOf already uses _getD(), need to add _t sync after it
src = src.replace(
  "    if (!this._isUTC) this._offset = -this._getD().getTimezoneOffset();\n    this._updateOffset(true);\n    return this;\n  }\n\n  endOf(",
  "    this._t = this._getD().getTime();\n    if (!this._isUTC) this._offset = -this._getD().getTimezoneOffset();\n    this._updateOffset(true);\n    return this;\n  }\n\n  endOf("
);

// 16. endOf: same pattern - but must be after startOf replacement
src = src.replace(
  "  endOf(unit: string): Moment {\n    const u = normalizeUnits(unit);\n    if (!u) return this;\n    this.startOf(u);",
  "  endOf(unit: string): Moment {\n    const u = normalizeUnits(unit);\n    if (!u) return this;\n    this.startOf(u);"
);
// endOf also has offset sync at the end
src = src.replace(
  "    if (!this._isUTC) this._offset = -this._getD().getTimezoneOffset();\n    this._updateOffset(true);\n    return this;\n  }\n\n  local(",
  "    this._t = this._getD().getTime();\n    if (!this._isUTC) this._offset = -this._getD().getTimezoneOffset();\n    this._updateOffset(true);\n    return this;\n  }\n\n  local("
);

// 17. week setter
src = src.replace(
  "      if (this._isUTC) {\n        d.setUTCDate(d.getUTCDate() + diff * 7);\n      } else {\n        d.setDate(d.getDate() + diff * 7);\n      }\n      this._refreshFields();\n      return this;\n    }",
  "      if (this._isUTC) {\n        d.setUTCDate(d.getUTCDate() + diff * 7);\n      } else {\n        d.setDate(d.getDate() + diff * 7);\n      }\n      this._t = d.getTime();\n      this._refreshFields();\n      return this;\n    }"
);

// 18. isoWeek setter  
src = src.replace(
  "      if (this._isUTC) {\n        d.setUTCDate(d.getUTCDate() + diff * 7);\n      } else {\n        d.setDate(d.getDate() + diff * 7);\n      }\n      this._refreshFields();\n      return this;\n    }\n    return getISOWeekNumber",
  "      if (this._isUTC) {\n        d.setUTCDate(d.getUTCDate() + diff * 7);\n      } else {\n        d.setDate(d.getDate() + diff * 7);\n      }\n      this._t = d.getTime();\n      this._refreshFields();\n      return this;\n    }\n    return getISOWeekNumber"
);

writeFileSync("src/moment_fixed.ts", src);
console.log("Phase 3 transform (t sync) applied");
