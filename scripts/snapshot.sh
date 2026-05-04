#!/bin/bash
set -e
SNAPSHOT_DIR="src.snapshot"
CMD="${1:-help}"

case "$CMD" in
  save)
    echo "Saving current src/ as $SNAPSHOT_DIR ..."
    rm -rf "$SNAPSHOT_DIR"
    cp -r src "$SNAPSHOT_DIR"
    echo "Saved. Run 'bash scripts/snapshot.sh restore' to revert."
    ;;
  restore)
    if [ ! -d "$SNAPSHOT_DIR" ]; then
      echo "No snapshot found. Run 'bash scripts/snapshot.sh save' first."
      exit 1
    fi
    echo "Restoring $SNAPSHOT_DIR → src/ ..."
    rm -rf src
    cp -r "$SNAPSHOT_DIR" src
    echo "Restored."
    ;;
  bench-before)
    if [ ! -d "$SNAPSHOT_DIR" ]; then
      echo "No snapshot found. Run 'bash scripts/snapshot.sh save' first."
      exit 1
    fi
    echo "=== Bench BEFORE (snapshot) ==="
    cp -r src src.current
    cp -r "$SNAPSHOT_DIR"/* src/
    bun test/bench.ts 2>&1 | tee /tmp/bench-before.txt
    cp -r src.current/* src/
    rm -rf src.current
    ;;
  bench-after)
    echo "=== Bench AFTER (current) ==="
    bun test/bench.ts 2>&1 | tee /tmp/bench-after.txt
    ;;
  compare)
    bash "$0" bench-before
    bash "$0" bench-after
    echo ""
    echo "=== DIFF ==="
    if command -v column &>/dev/null; then
      paste <(grep "│" /tmp/bench-before.txt | grep -v "─" | grep -v "Operation") \
            <(grep "│" /tmp/bench-after.txt | grep -v "─" | grep -v "Operation") | head -30
    else
      echo "Before: /tmp/bench-before.txt"
      echo "After:  /tmp/bench-after.txt"
    fi
    ;;
  *)
    echo "Usage: bash scripts/snapshot.sh {save|restore|bench-before|bench-after|compare}"
    echo ""
    echo "  save        現在の src/ をスナップショット保存"
    echo "  restore     src/ をスナップショットに戻す"
    echo "  compare     スナップショット(前) ←→ 現在(後) の bench を比較"
    exit 1
    ;;
esac
