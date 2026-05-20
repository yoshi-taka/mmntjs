#!/bin/bash
# Run a command with noisy stderr filtered out (jazzer/libFuzzer progress)
# Preserves the exit code of the original command.

export NODE_OPTIONS="--no-deprecation"
stderr_file=$(mktemp)
"$@" 2>"$stderr_file"
ecode=$?
filtered=$(grep -vE "^(INFO:|Dictionary:|#[0-9]+[[:space:]]|Done |###### )" "$stderr_file")
if [ "$ecode" -eq 0 ]; then
  if [ -n "$filtered" ]; then
    echo "$filtered" >&2
  fi
else
  echo "$filtered" >&2
  echo "FAILED (exit $ecode)" >&2
fi
rm -f "$stderr_file"
exit "$ecode"
