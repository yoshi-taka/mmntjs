#!/bin/bash
set -e

MODE="${1:-bench}"

case "$MODE" in
  bench)
    echo "=== Bench: moment.js vs moment2 ==="
    bun test/bench.ts
    ;;
  test)
    echo "=== Property tests: moment.js vs moment2 ==="
    TZ=UTC bun test ./test/properties/
    ;;
  moment-tests)
    echo "=== moment.js own tests vs moment2 ==="
    # Swap oracle to moment2, run moment tests, restore
    cp test/oracle.ts test/oracle.ts.bak
    echo 'import { default as moment } from "../src/index.ts"; export default moment' > test/oracle.ts
    TZ=UTC bun test ./test/moment/*.js
    mv test/oracle.ts.bak test/oracle.ts
    ;;
  oracle-use-moment2)
    # Permanently switch oracle to moment2
    echo 'import { default as moment } from "../src/index.ts"; export default moment' > test/oracle.ts
    echo "oracle.ts switched to moment2"
    ;;
  oracle-use-moment)
    # Restore oracle to original moment.js
    echo 'import moment from "../moment/moment"; export default moment' > test/oracle.ts
    echo "oracle.ts switched to moment.js"
    ;;
  *)
    echo "Usage: $0 {bench|test|moment-tests|oracle-use-moment2|oracle-use-moment}"
    exit 1
    ;;
esac
