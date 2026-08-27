import Module from "node:module";
import ts6 from "@typescript/typescript6";

const load = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === "typescript") {
    return ts6;
  }
  return load.call(this, request, parent, isMain);
};
