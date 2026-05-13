import { module } from "./qunit";
import { defineCommonLocaleTests } from "./helpers/common-locale";
import moment from "../moment";

export function localeModule(name: string) {
  module(`locale:${name}`, {
    setup() {
      moment.locale(name);
    },
    teardown() {
      moment.locale("en");
    },
  });
  defineCommonLocaleTests(name, -1, -1);
}
