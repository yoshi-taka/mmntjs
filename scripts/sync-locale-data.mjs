import fs from "fs";
import path from "path";
import * as acorn from "acorn";

const sourceDir = "moment/src/locale";
const targetDir = "src/locale";

function extractLocaleConfig(sourcePath) {
  const code = fs.readFileSync(sourcePath, "utf-8");

  // Find the object expression passed to defineLocale()
  const ast = acorn.parse(code, {
    ecmaVersion: 2020,
    sourceType: "module",
  });

  function findDefineLocaleConfig(node) {
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.property?.name === "defineLocale" &&
      node.arguments.length >= 2
    ) {
      return node.arguments[1]; // The config object
    }

    // Walk all nodes
    for (const key of Object.keys(node)) {
      if (key === "type" || key === "loc" || key === "start" || key === "end" || key === "comments") continue;
      const child = node[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === "object") {
              const result = findDefineLocaleConfig(item);
              if (result) return result;
            }
          }
        } else {
          const result = findDefineLocaleConfig(child);
          if (result) return result;
        }
      }
    }
    return null;
  }

  const configNode = findDefineLocaleConfig(ast);
  if (!configNode) {
    console.error("  Could not find defineLocale config in", sourcePath);
    return null;
  }

  // Extract properties from the object expression (recursive)
  function extractProperties(objNode) {
    const result = {};
    if (objNode.type !== "ObjectExpression") return null;

    for (const prop of objNode.properties) {
      if (prop.type !== "Property" || prop.key.type !== "Identifier") continue;
      const key = prop.key.name;
      result[key] = astNodeToJS(prop.value);
    }
    return result;
  }

  function astNodeToJS(node) {
    switch (node.type) {
      case "Literal":
        if (node.regex) return new RegExp(node.regex.pattern, node.regex.flags);
        return node.value;
      case "ArrayExpression":
        return node.elements.map((e) => (e ? astNodeToJS(e) : undefined));
      case "ObjectExpression":
        return extractProperties(node);
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        // Return the source code for functions
        return code.slice(node.start, node.end);
      case "UnaryExpression":
        if (node.operator === "-" && node.argument.type === "Literal") {
          return -node.argument.value;
        }
        if (node.operator === "void" && node.argument.type === "Literal" && node.argument.value === 0) {
          return undefined;
        }
        return code.slice(node.start, node.end);
      case "Identifier":
        if (node.name === "undefined") return undefined;
        return code.slice(node.start, node.end); // e.g., variable references
      case "ConditionalExpression":
        return code.slice(node.start, node.end);
      default:
        return code.slice(node.start, node.end);
    }
  }

  return extractProperties(configNode);
}

function formatJSValue(val, indent = "  ") {
  if (val === undefined || val === null) return "undefined";
  if (typeof val === "string") {
    // Check if it's actually a code fragment (function body)
    if (val.startsWith("function") || val.startsWith("(") || val.startsWith("=>")) {
      return val;
    }
    return JSON.stringify(val);
  }
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return String(val);
  if (val instanceof RegExp) return val.toString();
  if (Array.isArray(val)) {
    if (val.length <= 4 && val.every((v) => typeof v === "string" && !v.includes("_"))) {
      return `[${val.map((v) => JSON.stringify(v)).join(", ")}]`;
    }
    if (val.every((v) => typeof v === "string")) {
      const joined = val.join("_");
      return `'${joined}'.split('_')`;
    }
    return `[${val.map((v) => formatJSValue(v, indent)).join(", ")}]`;
  }
  if (typeof val === "object") {
    const entries = Object.entries(val).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";
    const inner = entries
      .map(([k, v]) => `${indent}  ${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${formatJSValue(v, indent + "  ")}`)
      .join(",\n");
    return `{\n${inner}\n${indent}}`;
  }
  return String(val);
}

function getTopLevelKeys(originalSource) {
  const code = fs.readFileSync(originalSource, "utf-8");
  const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: "module" });
  const configNode = (() => {
    function walk(node) {
      if (
        node.type === "CallExpression" &&
        node.callee.type === "MemberExpression" &&
        node.callee.property?.name === "defineLocale" &&
        node.arguments.length >= 2
      ) {
        return node.arguments[1];
      }
      for (const key of Object.keys(node)) {
        if (key === "type" || key === "loc" || key === "start" || key === "end" || key === "comments") continue;
        const child = node[key];
        if (child && typeof child === "object") {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item === "object") {
                const result = walk(item);
                if (result) return result;
              }
            }
          } else {
            const result = walk(child);
            if (result) return result;
          }
        }
      }
      return null;
    }
    return walk(ast);
  })();

  if (!configNode || configNode.type !== "ObjectExpression") return [];
  return configNode.properties
    .filter((p) => p.type === "Property" && p.key.type === "Identifier")
    .map((p) => p.key.name);
}

// Main
const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith(".js"));
let updatedCount = 0;
let unchangedCount = 0;
let skippedCount = 0;

for (const file of files) {
  const localeName = file.replace(/\.js$/, "");
  const tsPath = path.join(targetDir, `${localeName}.ts`);

  if (!fs.existsSync(tsPath)) {
    skippedCount++;
    continue;
  }

  // Read existing TS file
  let tsContent = fs.readFileSync(tsPath, "utf-8");

  // Extract config from original JS
  const originalConfig = extractLocaleConfig(path.join(sourceDir, file));
  if (!originalConfig) {
    skippedCount++;
    continue;
  }

  // Read current TS export to see what keys exist
  // We only patch fields that differ
  const originalKeys = getTopLevelKeys(path.join(sourceDir, file));

  // Fields to compare and patch
  const patchableFields = [
    "months", "monthsShort",
    "weekdays", "weekdaysShort", "weekdaysMin",
    "longDateFormat",
    "calendar",
    "relativeTime",
    "week",
    "dayOfMonthOrdinalParse",
    "invalidDate",
    "meridiemParse",
    "meridiem",
    "isPM",
    "preparse", "postformat",
    "eras", "eraYearOrdinalRegex", "eraYearOrdinalParse",
  ];

  let patches = 0;

  for (const field of patchableFields) {
    if (originalConfig[field] === undefined) continue;
    if (originalKeys.indexOf(field) === -1) continue; // Not in original locale

    const origVal = originalConfig[field];
    const formatted = formatJSValue(origVal, "  ");
    const formattedStr = typeof formatted === "string" ? formatted : String(formatted);

    // Find the field in the TS file and replace its value
    // Match pattern: `fieldName: ...,` or `fieldName:\n      ...`
    const fieldRegex = new RegExp(
      `(${field}:\\s*)([^;{]+?(?:\\{[^}]*\\}[^;]*?)?(?:function[^{]*\\{[^}]*\\}[^;]*?)?(?:=>[^,;]*)?)`,
      "s"
    );

    // More robust: match field name, then capture value until next field or closing brace
    const startMatch = tsContent.match(new RegExp(`\\b${field}:\\s*`));
    if (!startMatch) {
      // Field might be missing from TS file entirely
      continue;
    }

    // Replace existing value with original's value
    // We use a simpler approach: find the exact line and replace
    const lines = tsContent.split("\n");
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      const lineMatch = lines[i].match(new RegExp(`^\\s*${field}:\\s*(.*)`));
      if (lineMatch) {
        const oldVal = lineMatch[1].replace(/,$/, "");
        const newVal = formattedStr.endsWith(",") ? formattedStr.slice(0, -1) : formattedStr;
        if (oldVal.trim() !== newVal.trim()) {
          lines[i] = lines[i].replace(lineMatch[1], formattedStr.endsWith(",") ? formattedStr : formattedStr + ",");
          patches++;
          found = true;
        } else {
          found = true;
        }
        break;
      }
    }

    if (found) {
      tsContent = lines.join("\n");
    }
  }

  if (patches > 0) {
    fs.writeFileSync(tsPath, tsContent);
    updatedCount++;
    console.log(`  PATCHED ${localeName}: ${patches} fields`);
  } else {
    unchangedCount++;
  }
}

console.log(`\nDone! Updated: ${updatedCount}, Unchanged: ${unchangedCount}, Skipped: ${skippedCount}`);
