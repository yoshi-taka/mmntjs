import { test as bunTest, expect } from 'bun:test';
import {
    setupDeprecationHandler,
    teardownDeprecationHandler,
} from './helpers/deprecation-handler';
import moment from '../moment';
import { defineLocale } from '../src/locale';
import { deLocale } from "../src/locale/de";
defineLocale("de", deLocale);

import "../src/locale/bs";  import { bsLocale } from "../src/locale/bs";  defineLocale("bs", bsLocale);
import "../src/locale/ca";  import { caLocale } from "../src/locale/ca";  defineLocale("ca", caLocale);
import "../src/locale/es";  import { esLocale } from "../src/locale/es";  defineLocale("es", esLocale);
import "../src/locale/es-do";  import { es_doLocale } from "../src/locale/es-do";  defineLocale("es-do", es_doLocale);
import "../src/locale/es-us";  import { es_usLocale } from "../src/locale/es-us";  defineLocale("es-us", es_usLocale);
import "../src/locale/eu";  import { euLocale } from "../src/locale/eu";  defineLocale("eu", euLocale);
import "../src/locale/fr";  import { frLocale } from "../src/locale/fr";  defineLocale("fr", frLocale);
import "../src/locale/fr-ca";  import { fr_caLocale } from "../src/locale/fr-ca";  defineLocale("fr-ca", fr_caLocale);
import "../src/locale/fr-ch";  import { fr_chLocale } from "../src/locale/fr-ch";  defineLocale("fr-ch", fr_chLocale);
import "../src/locale/fy";  import { fyLocale } from "../src/locale/fy";  defineLocale("fy", fyLocale);
import "../src/locale/gl";  import { glLocale } from "../src/locale/gl";  defineLocale("gl", glLocale);
import "../src/locale/gom-deva";  import { gom_devaLocale } from "../src/locale/gom-deva";  defineLocale("gom-deva", gom_devaLocale);
import "../src/locale/gom-latn";  import { gom_latnLocale } from "../src/locale/gom-latn";  defineLocale("gom-latn", gom_latnLocale);
import "../src/locale/hr";  import { hrLocale } from "../src/locale/hr";  defineLocale("hr", hrLocale);
import "../src/locale/lb";  import { lbLocale } from "../src/locale/lb";  defineLocale("lb", lbLocale);
import "../src/locale/me";  import { meLocale } from "../src/locale/me";  defineLocale("me", meLocale);
import "../src/locale/nb";  import { nbLocale } from "../src/locale/nb";  defineLocale("nb", nbLocale);
import "../src/locale/ne";  import { neLocale } from "../src/locale/ne";  defineLocale("ne", neLocale);
import "../src/locale/nl";  import { nlLocale } from "../src/locale/nl";  defineLocale("nl", nlLocale);
import "../src/locale/nl-be";  import { nl_beLocale } from "../src/locale/nl-be";  defineLocale("nl-be", nl_beLocale);
import "../src/locale/nn";  import { nnLocale } from "../src/locale/nn";  defineLocale("nn", nnLocale);
import "../src/locale/oc-lnc";  import { oc_lncLocale } from "../src/locale/oc-lnc";  defineLocale("oc-lnc", oc_lncLocale);
import "../src/locale/sl";  import { slLocale } from "../src/locale/sl";  defineLocale("sl", slLocale);
import "../src/locale/sr";  import { srLocale } from "../src/locale/sr";  defineLocale("sr", srLocale);
import "../src/locale/sr-cyrl";  import { sr_cyrlLocale } from "../src/locale/sr-cyrl";  defineLocale("sr-cyrl", sr_cyrlLocale);
import "../src/locale/sv";  import { svLocale } from "../src/locale/sv";  defineLocale("sv", svLocale);

let currentLifecycle = null;
let currentTestName = '';

function createAssert() {
    let plan = -1;
    let count = 0;
    var assertLog = [];
    var summary = {};

    function verify() {
        if (plan !== -1 && count !== plan) {
            var diff = count - plan;
            var detail =
                diff < 0
                    ? `${-diff  } missing`
                    : `${diff  } extra`;
            var msg = `[${  currentTestName  }] Expected ${  plan  } assertions, got ${  count  } (${  detail  })`;
            if (assertLog.length > 0) {
                var breakdown = Object.keys(summary)
                    .sort()
                    .map(function (k) { return `${k  }: ${  summary[k]}`; })
                    .join(', ');
                msg += `\nAssertions run (${  breakdown  }):`;
                for (var i = 0; i < assertLog.length; i++) {
                    var entry = assertLog[i];
                    msg += `\n  #${  i + 1  } ${  entry.method  }${entry.msg ? ' - ' + entry.msg : ''}`;
                }
            }
            throw new Error(msg);
        }
    }

    function log(method, m) {
        assertLog.push({ method: method, msg: m || '' });
        summary[method] = (summary[method] || 0) + 1;
    }

    return {
        ok(val, msg) {
            count++;
            log('ok', msg);
            if (!val) throw new Error(msg || 'expected truthy');
        },
        equal(a, b, msg) {
            count++;
            log('equal', msg);
            if (a != b) throw new Error(`${msg || ''  } — actual: ${  JSON.stringify(a)  }, expected: ${  JSON.stringify(b)}`);
        },
        strictEqual(a, b, msg) {
            count++;
            log('strictEqual', msg);
            if (a !== b) throw new Error(msg || `expected ${  a  } === ${  b}`);
        },
        deepEqual(a, b, msg) {
            count++;
            log('deepEqual', msg);
            try {
                expect(a).toEqual(b);
            } catch (e) {
                throw new Error(msg || e.message);
            }
        },
        notEqual(a, b, msg) {
            count++;
            log('notEqual', msg);
            if (a == b) throw new Error(msg || `expected ${  a  } != ${  b}`);
        },
        throws(fn, msg) {
            count++;
            log('throws', msg);
            var threw = false;
            try {
                fn();
            } catch {
                threw = true;
            }
            if (!threw) throw new Error(msg || 'expected function to throw');
        },
        expect(n) {
            plan = n;
        },
        _verify: verify,
    };
}

function runWithLifecycle(name, fn) {
    moment.locale('en');
    if (moment.createFromInputFallback !== undefined) {
        moment.createFromInputFallback = function (config) {
            throw new Error(`input not handled by moment: ${  config._i}`);
        };
    }
    try {
        setupDeprecationHandler(test, moment, 'core');
    } catch {
        // deprecation handler setup may fail if moment2 hasn't implemented
        // suppressDeprecationWarnings / deprecationHandler yet
    }

    if (currentLifecycle && currentLifecycle.setup) {
        currentLifecycle.setup();
    }

    var assert = createAssert();
    try {
        fn(assert);
        assert._verify();
    } finally {
        if (currentLifecycle && currentLifecycle.teardown) {
            currentLifecycle.teardown();
        }
        try {
            teardownDeprecationHandler(test, moment, 'core');
        } catch {
            // ignore teardown errors if deprecation handler wasn't set up
        }
    }
}

export function test(name, fn) {
    // Store in a local to break any potential reference tracking
    var _name = name;
    var _fn = fn;
    bunTest(_name, function () {
        currentTestName = _name;
        runWithLifecycle(_name, _fn);
    });
}

export function only(name, fn) {
    var _name = name;
    var _fn = fn;
    bunTest.only(_name, function () {
        currentTestName = _name;
        runWithLifecycle(_name, _fn);
    });
}

export function module(name, lifecycle) {
    currentLifecycle = lifecycle || null;
}
