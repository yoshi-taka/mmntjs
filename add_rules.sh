#!/bin/bash
set -e

OX="bun x oxlint"

RULES=(
  "typescript/consistent-type-imports"
  "typescript/prefer-optional-chain"
  "typescript/prefer-nullish-coalescing"
  "typescript/prefer-find"
  "unicorn/throw-new-error"
  "typescript/consistent-type-exports"
  "import/no-duplicates"
  "eslint/prefer-template"
  "typescript/prefer-includes"
  "typescript/no-unnecessary-type-assertion"
  "unicorn/prefer-node-protocol"
  "typescript/require-await"
  "typescript/no-unnecessary-condition"
  "typescript/prefer-for-of"
  "eslint/no-constant-condition"
  "eslint/no-shadow"
  "typescript/prefer-reduce-type-parameter"
  "eslint/max-params"
  "unicorn/prefer-array-flat-map"
  "unicorn/prefer-set-has"
  "oxc/no-accumulating-spread"
  "typescript/array-type"
  "typescript/no-inferrable-types"
  "unicorn/no-useless-undefined"
  "unicorn/prefer-array-some"
  "typescript/no-unnecessary-template-expression"
  "typescript/prefer-function-type"
  "unicorn/prefer-date-now"
  "unicorn/prefer-string-replace-all"
  "unicorn/no-typeof-undefined"
  "eslint/prefer-object-spread"
  "unicorn/error-message"
  "unicorn/prefer-at"
  "typescript/return-await"
  "typescript/no-unnecessary-type-constraint"
  "unicorn/no-instanceof-builtins"
  "unicorn/catch-error-name"
  "unicorn/prefer-negative-index"
  "unicorn/prefer-optional-catch-binding"
  "eslint/no-useless-computed-key"
  "oxc/no-map-spread"
  "typescript/prefer-readonly"
  "typescript/dot-notation"
  "typescript/consistent-indexed-object-style"
  "eslint/curly"
  "typescript/consistent-type-assertions"
  "typescript/no-import-type-side-effects"
  "typescript/prefer-return-this-type"
  "unicorn/no-length-as-slice-end"
  "unicorn/no-useless-promise-resolve-reject"
  "eslint/no-unneeded-ternary"
  "eslint/no-useless-concat"
  "eslint/no-var"
  "typescript/no-explicit-any"
  "typescript/ban-ts-comment"
  "typescript/no-empty-interface"
  "eslint/no-useless-call"
)

# Special rules that need --import-plugin
IMPORT_RULES=("import/no-duplicates")

for rule in "${RULES[@]}"; do
  echo ""
  echo "======================================================"
  echo "=== Rule: $rule"
  echo "======================================================"

  # Build the config value
  config_val='"error"'
  if [ "$rule" = "eslint/max-params" ]; then
    config_val='["error", { "max": 5 }]'
  fi

  # Add rule to .oxlintrc.json
  python3 -c "
import json
with open('.oxlintrc.json') as f:
    c = json.load(f)
c['rules']['$rule'] = json.loads('$config_val')
with open('.oxlintrc.json', 'w') as f:
    json.dump(c, f, indent=2)
    f.write('\n')
"

  # Determine flags
  flags=""
  for ir in "${IMPORT_RULES[@]}"; do
    if [ "$ir" = "$rule" ]; then
      flags="--import-plugin"
      break
    fi
  done

  # Run oxlint to count errors for this rule
  echo "--- Checking violations for '$rule' ---"
  $OX $flags src/ test/ 2>&1 | rg "$rule" || true

  # Run oxlint --fix
  echo "--- Running oxlint --fix ---"
  $OX --fix $flags src/ test/ 2>&1 | rg "$rule" || true

  # Check if there are remaining violations
  remaining=$($OX $flags src/ test/ 2>&1 | rg -c "$rule" || true)
  if [ "$remaining" -gt 0 ] 2>/dev/null; then
    echo "⚠️  $remaining remaining violation(s) for '$rule' (not auto-fixable)"
  else
    echo "✅ No remaining violations for '$rule'"
  fi

  # Check if there are any changes
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "chore: apply oxlint rule $rule"
    echo "--- Committed changes for $rule ---"
  else
    echo "--- No changes to commit for $rule ---"
  fi
done

echo ""
echo "=== All rules processed ==="
