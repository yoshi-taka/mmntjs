#!/bin/bash
# Usage: ./scripts/git-push.sh
# Restore remote URL and push, then re-block.
# This is the ONLY way to push from this repo.

ORIGINAL_REMOTE="git@github.com:yoshi-taka/mmntjs.git"
BLOCK_REMOTE="git@github.com:BLOCKED-PUSH-mmntjs.git"

case "${1:-}" in
  enable)
    git remote set-url origin "$ORIGINAL_REMOTE"
    echo "Remote restored. Now you can push."
    ;;
  disable)
    git remote set-url origin "$BLOCK_REMOTE"
    echo "Remote blocked again."
    ;;
  *)
    echo "Usage: $0 {enable|disable}"
    echo "  enable   - restore remote URL and push"
    echo "  disable  - re-block remote URL"
    exit 1
    ;;
esac
