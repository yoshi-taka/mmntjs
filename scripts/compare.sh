#!/bin/bash
set -e

MODE="${1:-bench}"

case "$MODE" in
  bench)
    echo "=== Bench: moment.js vs mmntjs ==="
    bun test/bench.ts
    ;;
  test)
    echo "=== Property tests: moment.js vs mmntjs ==="
    TZ=UTC bun test ./test/properties/
    ;;
  moment-tests)
    echo "=== moment.js own tests vs mmntjs ==="
    # Swap oracle to mmntjs, run moment tests, restore
    cp test/oracle.ts test/oracle.ts.bak
    echo 'import { default as moment } from "../src/index.ts"; export default moment' > test/oracle.ts
    TZ=UTC bun test ./test/moment/*.js
    mv test/oracle.ts.bak test/oracle.ts
    ;;
  oracle-use-mmntjs)
    # Permanently switch oracle to mmntjs
    echo 'import { default as moment } from "../src/index.ts"; export default moment' > test/oracle.ts
    echo "oracle.ts switched to mmntjs"
    ;;
  oracle-use-moment)
    # Restore oracle to original moment.js
    echo 'import moment from "../moment/moment"; export default moment' > test/oracle.ts
    echo "oracle.ts switched to moment.js"
    ;;
  *)
    echo "Usage: $0 {bench|test|moment-tests|oracle-use-mmntjs|oracle-use-moment}"
    exit 1
    ;;
esac
