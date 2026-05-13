import { test } from "bun:test";
import moment from "../moment";

test("check resolved module", () => {
  // Check if we can figure out what path this came from
  const momentStr = moment.fn.clone.toString();
  console.log("clone src:", momentStr.slice(0, 200));
  console.log("moment version:", moment.version);
});
