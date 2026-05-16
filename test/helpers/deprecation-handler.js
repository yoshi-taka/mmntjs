import each from './each';

export function setupDeprecationHandler(test, moment, _scope) {
    test._expectedDeprecations = null;
    test._observedDeprecations = null;
    test._oldSupress = moment.suppressDeprecationWarnings;
    test._oldDeprecationHandler = moment.deprecationHandler;
    moment.suppressDeprecationWarnings = true;
    test.expectedDeprecations = function () {
        test._expectedDeprecations = arguments;
        test._observedDeprecations = [];
    };
    moment.deprecationHandler = function (name, msg) {
        const deprecationId = matchedDeprecation(
            name,
            msg,
            test._expectedDeprecations
        );
        if (deprecationId === -1) {
            throw new Error(
                `Unexpected deprecation thrown name=${  name  } msg=${  msg}`
            );
        }
        test._observedDeprecations[deprecationId] = 1;
    };
}

export function teardownDeprecationHandler(test, moment, _scope) {
    moment.suppressDeprecationWarnings = test._oldSupress;
    moment.deprecationHandler = test._oldDeprecationHandler;

    if (test._expectedDeprecations != null) {
        const missedDeprecations = [];
        each(test._expectedDeprecations, function (deprecationPattern, id) {
            if (test._observedDeprecations[id] !== 1) {
                missedDeprecations.push(deprecationPattern);
            }
        });
        if (missedDeprecations.length !== 0) {
            throw new Error(
                `Expected deprecation warnings did not happen: ${ 
                    missedDeprecations.join(' ')}`
            );
        }
    }
}

function matchedDeprecation(name, msg, deprecations) {
    if (deprecations == null) {
        return -1;
    }
    for (let i = 0; i < deprecations.length; ++i) {
        if (name != null && name === deprecations[i]) {
            return i;
        }
        if (
            msg != null &&
            msg.substring(0, deprecations[i].length) === deprecations[i]
        ) {
            return i;
        }
    }
    return -1;
}
