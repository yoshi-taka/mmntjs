import fs from "fs";
import path from "path";
import * as acorn from "acorn";

const sourceDir = "moment/src/locale";
const targetDir = "src/locale";

function parseLocaleJS(filePath) {
  const code = fs.readFileSync(filePath, "utf-8");
  const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: "module" });

  function findDefineLocale(node) {
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.property?.name === "defineLocale" &&
      node.arguments.length >= 2
    ) {
      return { name: node.arguments[0], config: node.arguments[1] };
    }
    for (const key of Object.keys(node)) {
      if (["type", "loc", "start", "end", "comments", "leadingComments", "trailingComments"].includes(key)) continue;
      const child = node[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === "object") {
              const r = findDefineLocale(item);
              if (r) return r;
            }
          }
        } else {
          const r = findDefineLocale(child);
          if (r) return r;
        }
      }
    }
    return null;
  }

  const result = findDefineLocale(ast);
  if (!result) return null;

  const localeName = result.name.type === "Literal" ? result.name.value : null;
  if (!localeName) return null;

  // Extract all top-level declarations (functions, variables)
  const topLevelDeclarations = [];
  for (const stmt of ast.body) {
    if (stmt.type === "ImportDeclaration") continue;
    if (stmt.type === "ExportDefaultDeclaration" || stmt.type === "ExportNamedDeclaration") continue;
    if (stmt.type === "FunctionDeclaration" || stmt.type === "VariableDeclaration") {
      const src = code.slice(stmt.start, stmt.end);
      if (src.trim()) topLevelDeclarations.push(src);
    }
  }

  return {
    name: localeName,
    configNode: result.config,
    code,
    helpers: topLevelDeclarations,
  };
}

function isSimpleStringArray(arr, minLen = 5) {
  if (!Array.isArray(arr)) return false;
  if (arr.length < minLen) return false;
  return arr.every((e) => e && typeof e === "string" && !e.includes("'"));
}

function nodeToValue(node) {
  if (!node) return undefined;
  switch (node.type) {
    case "Literal":
      if (node.regex) return { _type: "regex", source: node.regex.pattern, flags: node.regex.flags };
      return node.value;
    case "ArrayExpression":
      return node.elements.filter((e) => e !== null).map((e) => nodeToValue(e));
    case "ObjectExpression": {
      const obj = {};
      for (const prop of node.properties) {
        if (prop.type !== "Property" || prop.key.type !== "Identifier") continue;
        obj[prop.key.name] = nodeToValue(prop.value);
      }
      return obj;
    }
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return { _type: "function", source: node };
    case "UnaryExpression":
      if (node.operator === "-" && node.argument.type === "Literal") return -node.argument.value;
      return { _type: "raw", source: node };
    case "Identifier":
      if (node.name === "undefined") return undefined;
      return { _type: "raw", source: node };
    case "ConditionalExpression":
    case "TemplateLiteral":
    case "CallExpression":
    case "MemberExpression":
    case "BinaryExpression":
      return { _type: "raw", source: node };
    default:
      return { _type: "raw", source: node };
  }
}

function valueToSource(val, indent = "  ") {
  if (val === undefined || val === null) return "undefined";
  if (typeof val === "string") return JSON.stringify(val);
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    if (isSimpleStringArray(val)) {
      return `'${val.join("_")}'.split('_')`;
    }
    const items = val.map((v) => valueToSource(v, indent + "  "));
    return `[\n${indent}  ${items.join(`,\n${indent}  `)}\n${indent}]`;
  }
  if (val && typeof val === "object") {
    if (val._type === "regex") return `/${val.source}/${val.flags}`;
    if (val._type === "function") return codeSlice(val.source);
    if (val._type === "raw") return codeSlice(val.source);
    // Plain object (from ObjectExpression)
    const entries = Object.entries(val).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";
    const props = entries.map(([k, v]) => {
      const keyStr = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      return `${indent}  ${keyStr}: ${valueToSource(v, indent + "  ")}`;
    });
    return `{\n${props.join(",\n")}\n${indent}}`;
  }
  return String(val);
}

let _sourceCode = "";

function codeSlice(node) {
  if (!node || node.start === undefined || node.end === undefined) return "undefined";
  return _sourceCode.slice(node.start, node.end);
}

const files = fs.readdirSync(sourceDir)
  .filter((f) => f.endsWith(".js"))
  .sort();

let generated = 0;
let errors = [];

for (const file of files) {
  const localeName = file.replace(/\.js$/, "");
  const filePath = path.join(sourceDir, file);

  try {
    _sourceCode = fs.readFileSync(filePath, "utf-8");
    const parsed = parseLocaleJS(filePath);
    if (!parsed) {
      errors.push(`${localeName}: could not parse`);
      continue;
    }

    const { name, configNode, helpers } = parsed;

    const importName = name.replace(/-/g, "_") + "Locale";

    // Build header with helpers
    let helpersBlock = "";
    if (helpers.length > 0) {
      helpersBlock = "\n" + helpers.join("\n\n") + "\n";
    }

    const header = `// @ts-nocheck
import type { LocaleSpec } from "./en";
${helpersBlock}
export const ${importName}: LocaleSpec = `;

    const body = valueToSource(nodeToValue(configNode), "  ");

    const output = header + body + ";\n";

    fs.writeFileSync(path.join(targetDir, `${name}.ts`), output);
    generated++;
  } catch (e) {
    errors.push(`${localeName}: ${e.message}`);
  }
}

console.log(`Generated ${generated} locale files.`);
if (errors.length > 0) {
  console.log("Errors:");
  for (const err of errors) console.log(`  ${err}`);
}
