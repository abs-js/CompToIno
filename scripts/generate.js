"use strict";

const { PRESET } = require("./libs");

function generate(ast, filename, version) {
  const headers = new Set();
  const setup = [];
  const loop = [];
  const funcs = [];
  const globals = new Set();
  const declared = new Map();
  const features = new Set();
  const use = (n) => features.add(n);

  function cstr(s) {
    return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
  }
  function cpp(name) { return "v_" + String(name).replace(/[^A-Za-z0-9_]/g, "_"); }
  function gcpp(name) { return "g_" + String(name).replace(/[^A-Za-z0-9_]/g, "_"); }
  function pinNum(node) {
    if (!node) return "0";
    if (node.type === "pin") return node.kind === "analog" ? "A" + node.n : String(node.n);
    return ex(node);
  }
  function ex(node) {
    if (!node) return "0";
    if (node.type === "number") return String(node.value);
    if (node.type === "bool") return node.value ? "true" : "false";
    if (node.type === "string") return cstr(node.value);
    if (node.type === "null") return "0";
    if (node.type === "level") return node.value;
    if (node.type === "kill") return "0";
    if (node.type === "var") return cpp(node.name);
    if (node.type === "gvar") { globals.add(node.name); return gcpp(node.name); }
    if (node.type === "pin") {
      if (node.kind === "analog") return "analogRead(A" + node.n + ")";
      if (node.kind === "pwm") return "analogRead(" + node.n + ")";
      return "digitalRead(" + node.n + ")";
    }
    if (node.type === "unary" && node.op === "!") return "(!" + ex(node.expr) + ")";
    if (node.type === "binary") return "(" + ex(node.left) + " " + ({ and: "&&", or: "||", xor: "!=" }[node.op] || node.op) + " " + ex(node.right) + ")";
    if (node.type === "call") return callOf(node);
    if (node.type === "member") return ex(node.object) + "." + node.name;
    if (node.type === "update") return ex(node.target) + node.op;
    if (node.type === "new" && (node.name === "Promisse" || node.name === "Promise")) {
      use("promise");
      const fn = (node.args || [])[0];
      return "cin_promise(" + (fn ? "1" : "0") + ")";
    }
    if (node.type === "catchtest") return "(" + ex(node.expr) + " != 0)";
    if (node.type === "errcode") return String(parseInt(node.value.slice(1), 10) || 0);
    if (node.type === "ident") return node.name;
    return "0";
  }
  function levelOf(node) {
    if (!node) return "LOW";
    if (node.type === "bool") return node.value ? "HIGH" : "LOW";
    if (node.type === "level") return node.value;
    if (node.type === "number") return node.value ? "HIGH" : "LOW";
    return ex(node);
  }
  function callOf(node) {
    const c = node.callee || {};
    const name = c.name;
    const a = node.args || [];
    if (name === "sleep" || name === "selfSleep") return "delay(" + ex(a[0]) + ")";
    if (name === "serial" || name === "serialPrint") { use("serial"); return "Serial.println(" + ex(a[0]) + ")"; }
    if (name === "serialRead") { use("serial"); return "Serial.parseInt()"; }
    if (name === "serialBeg") { use("serial"); return "Serial.begin(" + (a[0] ? ex(a[0]) : "9600") + ")"; }
    if (name === "map") return "map(" + a.map(ex).join(", ") + ")";
    if (name === "str") return "String(" + ex(a[0]) + ")";
    if (name === "int") return "(long)(" + ex(a[0]) + ")";
    if (name === "float") return "(float)(" + ex(a[0]) + ")";
    if (name === "bool") return "(bool)(" + ex(a[0]) + ")";
    if (name === "min") return "min(" + ex(a[0]) + ", " + ex(a[1]) + ")";
    if (name === "max") return "max(" + ex(a[0]) + ", " + ex(a[1]) + ")";
    if (name === "abs") return "abs(" + ex(a[0]) + ")";
    if (name === "constrain") return "constrain(" + ex(a[0]) + ", " + ex(a[1]) + ", " + ex(a[2]) + ")";
    if (name === "log") return "log(" + ex(a[0]) + ")";
    if (name === "oneDivBy") return "(1.0 / (" + ex(a[0]) + "))";
    if (name === "sqrt") return "sqrt(" + ex(a[0]) + ")";
    if (name === "random") return "random(" + ex(a[0]) + ", " + ex(a[1]) + ")";
    if (name === "pow") return "pow(" + ex(a[0]) + ", " + ex(a[1]) + ")";
    if (name === "exp") return "exp(" + ex(a[0]) + ")";
    if (name === "setPin") return "(pinMode(" + pinNum(a[0]) + ", OUTPUT), digitalWrite(" + pinNum(a[0]) + ", " + levelOf(a[1]) + "))";
    if (name === "setPwm") return "(pinMode(" + pinNum(a[0]) + ", OUTPUT), analogWrite(" + pinNum(a[0]) + ", " + ex(a[1]) + "))";
    if (name === "getPin" || name === "getPn") {
      if (a[0] && a[0].type === "pin" && a[0].kind === "analog") return "analogRead(A" + a[0].n + ")";
      return "digitalRead(" + pinNum(a[0]) + ")";
    }
    if (name === "pin") return "digitalRead(" + pinNum(a[0]) + ")";
    if (name === "pwm") return "analogRead(" + pinNum(a[0]) + ")";
    if (name === "analog") return "analogRead(A" + (a[0] && a[0].type === "pin" ? a[0].n : ex(a[0])) + ")";
    if (name === "tone") {
      if (!a[1] || a[1].type === "null") return "noTone(" + pinNum(a[0]) + ")";
      return "tone(" + pinNum(a[0]) + ", " + ex(a[1]) + ")";
    }
    if (name === "writable") return "pinMode(" + pinNum(a[0]) + ", OUTPUT)";
    if (name === "readable") return "pinMode(" + pinNum(a[0]) + ", INPUT)";
    if (c.type === "member") return ex(c.object) + "." + c.name + "(" + a.map(ex).join(", ") + ")";
    if (name) return "fn_" + name + "(" + a.map(ex).join(", ") + ")";
    return "0";
  }
  function emit(stmt, pad, out) {
    if (!stmt) return;
    const p = "  ".repeat(pad);
    if (stmt.type === "assign" && stmt.left) {
      if (stmt.left.type === "gvar") globals.add(stmt.left.name);
      if (stmt.left.type === "var") declared.set(stmt.left.name, "long");
      if (stmt.right && stmt.right.type === "new" && PRESET[stmt.right.name]) {
        const lib = PRESET[stmt.right.name];
        const ctor = lib.ctor || stmt.right.name;
        const args = (stmt.right.args || []).map(pinNum).join(", ");
        out.push(p + "/* " + ctor + " " + cpp(stmt.left.name) + "(" + args + ") */");
        if (stmt.right.name === "Servo") out.push(p + cpp(stmt.left.name) + ".attach(" + pinNum(stmt.right.args[0]) + ");");
        return;
      }
      if (stmt.left.type === "pin") {
        const level = stmt.right && stmt.right.type === "bool" ? (stmt.right.value ? "HIGH" : "LOW") : ex(stmt.right);
        if (stmt.left.kind === "pwm") out.push(p + "analogWrite(" + stmt.left.n + ", " + ex(stmt.right) + ");");
        else out.push(p + "digitalWrite(" + pinNum(stmt.left) + ", " + level + ");");
        return;
      }
      const id = stmt.left.type === "gvar" ? gcpp(stmt.left.name) : ex(stmt.left);
      out.push(p + id + " " + (stmt.op || "=") + " " + ex(stmt.right) + ";");
      return;
    }
    if (stmt.type === "expr") { out.push(p + ex(stmt.expr) + ";"); return; }
    if (stmt.type === "whait") { use("promise"); out.push(p + "cin_whait();"); out.push(p + ex(stmt.expr) + ";"); return; }
    if (stmt.type === "return") { out.push(p + "return " + (stmt.expr ? ex(stmt.expr) : "0") + ";"); return; }
    if (stmt.type === "if") {
      out.push(p + "if (" + ex(stmt.cond) + ") {");
      for (const s of stmt.then || []) emit(s, pad + 1, out);
      for (const b of stmt.elifs || []) {
        out.push(p + "} else if (" + ex(b.cond) + ") {");
        for (const s of b.body) emit(s, pad + 1, out);
      }
      if (stmt.else) { out.push(p + "} else {"); for (const s of stmt.else) emit(s, pad + 1, out); }
      out.push(p + "}");
      return;
    }
    if (stmt.type === "switch") {
      const id = ex(stmt.value);
      let first = true;
      for (const c of stmt.cases || []) {
        const op = c.cond && c.cond.op ? c.cond.op : "==";
        const right = c.cond && c.cond.right ? ex(c.cond.right) : ex(c.cond);
        out.push(p + (first ? "if" : "} else if") + " (" + id + " " + op + " " + right + ") {");
        first = false;
        for (const s of c.body) emit(s, pad + 1, out);
      }
      if (stmt.else) { out.push(p + "} else {"); for (const s of stmt.else) emit(s, pad + 1, out); }
      if (!first || stmt.else) out.push(p + "}");
      return;
    }
    if (stmt.type === "while") {
      out.push(p + "while (" + ex(stmt.cond) + ") {");
      for (const s of stmt.body) emit(s, pad + 1, out);
      out.push(p + "}");
      return;
    }
    if (stmt.type === "for") {
      const init = stmt.init && stmt.init.type === "assign" ? ex(stmt.init.left) + " = " + ex(stmt.init.right) : "0";
      const step = stmt.step && stmt.step.type === "update" ? ex(stmt.step.target) + stmt.step.op : "0";
      out.push(p + "for (" + init + "; " + ex(stmt.cond) + "; " + step + ") {");
      for (const s of stmt.body) emit(s, pad + 1, out);
      out.push(p + "}");
      return;
    }
    if (stmt.type === "try") {
      if (stmt.call) out.push(p + ex(stmt.call) + ";");
      for (const s of stmt.body || []) emit(s, pad, out);
      if (stmt.catchBody && stmt.catchBody.length) {
        out.push(p + "if (cin_err) {");
        if (stmt.handler && stmt.handler.type === "var") out.push(p + "  " + cpp(stmt.handler.name) + " = cin_err;");
        for (const s of stmt.catchBody) emit(s, pad + 1, out);
        out.push(p + "}");
      }
      return;
    }
    if (stmt.type === "loop") {
      for (const s of stmt.body) emit(s, pad, loop);
      if (stmt.delay) loop.push(p + "delay(" + ex(stmt.delay) + ");");
      return;
    }
    if (stmt.type === "update") { out.push(p + ex(stmt.target) + stmt.op + ";"); return; }
    if (stmt.type === "writable") { out.push(p + "pinMode(" + pinNum(stmt.pin) + ", OUTPUT);"); return; }
    if (stmt.type === "readable") { out.push(p + "pinMode(" + pinNum(stmt.pin) + ", INPUT);"); return; }
  }

  for (const stmt of ast.body || []) {
    if (stmt.type === "import") {
      const lib = PRESET[stmt.name];
      if (lib && lib.header) headers.add(lib.header);
      else if (stmt.from && stmt.from.endsWith(".h")) headers.add(stmt.from);
    }
    if (stmt.type === "func") {
      const body = [];
      for (const s of stmt.body) emit(s, 1, body);
      if (!body.some((l) => l.includes("return "))) body.push("  return 0;");
      funcs.push("long fn_" + stmt.name + "(" + (stmt.params || []).map((param) => "long " + cpp(param.name)).join(", ") + ") {\n" + body.join("\n") + "\n}");
      continue;
    }
    if (stmt.type === "loop") { emit(stmt, 1, loop); continue; }
    if (["class", "export", "import"].includes(stmt.type)) continue;
    emit(stmt, 1, setup);
  }

  const out = [];
  out.push("/* Generated by CompIno " + version + " from " + filename + " */");
  for (const h of headers) out.push("#include <" + h + ">");
  if (features.has("promise")) {
    out.push("static int cin_err = 0;");
    out.push("static void cin_whait() {}");
    out.push("static long cin_promise(long v) { return v; }");
  }
  for (const name of globals) out.push("long " + gcpp(name) + " = 0;");
  for (const name of declared.keys()) out.push("long " + cpp(name) + " = 0;");
  out.push(...funcs);
  out.push("void setup() {");
  if (features.has("serial")) out.push("  Serial.begin(9600);");
  out.push(...(setup.length ? setup : ["  /* setup */"]));
  out.push("}");
  out.push("void loop() {");
  out.push(...(loop.length ? loop : ["  /* empty loop */"]));
  out.push("}");
  return out.join("\n") + "\n";
}

module.exports = { generate };
