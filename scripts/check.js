"use strict";

const { libOf } = require("./libs");

const BUILTINS = new Set([
  "map", "sleep", "serial", "serialPrint", "serialRead", "serialBeg", "writable", "readable",
  "high", "low", "typeof", "str", "int", "float", "bool", "setPin", "setPwm", "getPin", "getPn",
  "pin", "pwm", "analog", "tone", "selfSleep", "min", "max", "abs", "constrain", "log",
  "oneDivBy", "sqrt", "random", "pow", "exp"
]);

function check(ast, fail) {
  const funcs = new Set();
  const classes = new Set(Object.keys(require("./libs").PRESET));
  const types = new Map();
  const known = new Set();
  let sawSemi = false;
  let sawBare = false;
  let patient = false;
  let inPromise = false;

  function noteAssign(left, right) {
    if (!left || left.type !== "var" && left.type !== "gvar") return;
    known.add(left.name);
    const got = infer(right);
    if (left.typeName) {
      types.set(left.name, left.typeName);
      if (got && !sameType(left.typeName, got)) fail("E024", left.line, left.col || 1, "Type mismatch for $" + left.name, left.typeName + "," + got);
    } else if (types.has(left.name) && got && !sameType(types.get(left.name), got)) {
      fail("E024", left.line, left.col || 1, "Type mismatch for $" + left.name, types.get(left.name) + "," + got);
    } else if (got && !types.has(left.name)) types.set(left.name, got);
  }

  function infer(node) {
    if (!node) return null;
    if (node.type === "number") return Number.isInteger(node.value) ? "int" : "float";
    if (node.type === "string") return "str";
    if (node.type === "bool" || node.type === "level") return "bool";
    if (node.type === "pin") return "pin";
    if (node.type === "var" && types.has(node.name)) return types.get(node.name);
    if (node.type === "call" && node.callee && node.callee.name === "str") return "str";
    if (node.type === "call" && node.callee && ["int", "getPin", "getPn"].includes(node.callee.name)) return "int";
    if (node.type === "call" && node.callee && node.callee.name === "float") return "float";
    return null;
  }

  function sameType(a, b) {
    const n = (t) => t === "string" ? "str" : t === "long" ? "int" : t;
    return n(a) === n(b);
  }

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "func") {
      if (funcs.has(node.name) && node.name !== "anon") fail("E009", node.line, 1, "Duplicate function " + node.name, node.name);
      funcs.add(node.name);
      for (const param of node.params || []) {
        known.add(param.name);
        if (param.typeName) types.set(param.name, param.typeName);
      }
    }
    if (node.type === "class") {
      if (classes.has(node.name)) fail("E010", node.line, 1, "Duplicate class " + node.name, node.name);
      classes.add(node.name);
    }
    if (node.type === "assign") noteAssign(node.left, node.right);
    if (node.type === "import" && node.from && node.from.endsWith(".cnl") && !node.resolved) {
      fail("E011", node.line, 1, "Imported file not found", node.from);
    }
    if (node.type === "import" && !node.from && !libOf(node.name) && !node.resolved) {
      fail("E018", node.line, 1, "Library missing or unsupported", node.name);
    }
    if (node.type === "call" && node.callee && node.callee.type === "ident") {
      const name = node.callee.name;
      if (!BUILTINS.has(name) && !funcs.has(name)) fail("E004", node.line || 1, 1, "Unknown function " + name, name);
      if (name === "selfSleep" && !inPromise) fail("E027", node.line || 1, 1, "selfSleep only inside a promise", "selfSleep");
    }
    if (node.type === "new" && node.name === "Promisse") inPromise = true;
    if (node.type === "whait" && !patient) fail("E025", node.line, 1, "whait needs a patient block", "whait");
    if (node.type === "loop" && node.patient) patient = true;
    if (node.type === "pin") {
      const max = node.kind === "analog" ? 21 : 127;
      if (node.n < 0 || node.n > max) fail("E007", node.line, node.col, "Pin out of range", "@" + node.n);
    }
    if (node.type === "binary" && (node.op === "/" || node.op === "%") && node.right && node.right.type === "number" && node.right.value === 0) {
      fail("E008", node.line || 1, 1, "Division by zero", "/");
    }
    if (node.type === "var" && !known.has(node.name) && !node.binding) fail("E006", node.line, node.col || 1, "Unknown variable $" + node.name, "$" + node.name);
    if (node.semi) sawSemi = true;
    else if (node.needsSemi) sawBare = true;
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (Array.isArray(val)) for (const item of val) walk(item);
      else if (val && typeof val === "object" && val.type) walk(val);
    }
    if (node.type === "new" && node.name === "Promisse") inPromise = false;
    if (node.type === "loop" && node.patient) patient = false;
  }

  for (const stmt of ast.body || []) {
    if (stmt.type === "assign" && stmt.left) stmt.left.binding = true;
  }
  walk(ast);
  if (sawSemi && sawBare) fail("E026", 1, 1, "If one command ends with ; every command must", ";");
}

module.exports = { check, BUILTINS };
