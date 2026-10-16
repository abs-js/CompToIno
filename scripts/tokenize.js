"use strict";

const KEYWORDS = new Set([
  "func", "return", "if", "elif", "else", "while", "for", "class", "new", "import",
  "from", "export", "writable", "readable", "and", "or", "xor", "Main",
  "request", "req", "typeof", "try", "catch", "switch", "whait", "wait",
  "getPatient", "Promisse", "Promise", "selfSleep", "serialBeg", "serialRead",
  "serialPrint", "serial", "setPin", "setPwm", "getPin", "getPn", "pin", "pwm",
  "analog", "tone", "HIGH", "LOW", "True", "False", "true", "false", "Kill",
  "Null", "Pin", "min", "max", "abs", "constrain", "log", "oneDivBy", "sqrt",
  "random", "pow", "exp", "Math"
]);

function tokenize(source, filename, fail) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const push = (type, value, l, c) => tokens.push({ type, value, line: l, col: c });
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\n") { line++; col = 1; i++; continue; }
    if (ch === " " || ch === "\t" || ch === "\r") { i++; col++; continue; }
    const sl = line;
    const sc = col;
    if (ch === "#" && source[i + 1] === "+") {
      i += 2; col += 2;
      let closed = false;
      while (i < source.length) {
        if (source[i] === "+" && source[i + 1] === "#") { closed = true; i += 2; col += 2; break; }
        if (source[i] === "\n") { line++; col = 1; } else col++;
        i++;
      }
      if (!closed) fail("E003", sl, sc, "Unterminated #+ comment", "#+");
      continue;
    }
    if (ch === "#") { while (i < source.length && source[i] !== "\n") i++; continue; }
    if (ch === "/" && source[i + 1] === "/") { while (i < source.length && source[i] !== "\n") i++; continue; }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2; col += 2;
      let closed = false;
      while (i < source.length) {
        if (source[i] === "*" && source[i + 1] === "/") { closed = true; i += 2; col += 2; break; }
        if (source[i] === "\n") { line++; col = 1; } else col++;
        i++;
      }
      if (!closed) fail("E003", sl, sc, "Unterminated block comment", "/*");
      continue;
    }
    if (ch === '"') {
      i++; col++;
      let s = "";
      let closed = false;
      while (i < source.length) {
        if (source[i] === "\\") {
          const n = source[i + 1];
          s += n === "n" ? "\n" : n === "t" ? "\t" : n || "";
          i += 2; col += 2; continue;
        }
        if (source[i] === '"') { closed = true; i++; col++; break; }
        if (source[i] === "\n") { line++; col = 1; } else col++;
        s += source[i]; i++;
      }
      if (!closed) fail("E003", sl, sc, "Unterminated string", '"');
      push("string", s, sl, sc);
      continue;
    }
    if (ch === "$") {
      i++; col++;
      const id = readIdent(source, i);
      if (!id) fail("E000", sl, sc, "Expected a name after $", "$");
      i += id.length; col += id.length;
      let typeName = null;
      if (source[i] === "<") {
        i++; col++;
        typeName = readIdent(source, i);
        i += (typeName || "").length; col += (typeName || "").length;
        if (source[i] === ">") { i++; col++; }
        else fail("E024", sl, sc, "Missing > after type", typeName || "");
      }
      push("var", { name: id, typeName }, sl, sc);
      continue;
    }
    if (ch === "g" && source[i + 1] === "$") {
      i += 2; col += 2;
      const id = readIdent(source, i);
      if (!id) fail("E000", sl, sc, "Expected a name after g$", "g$");
      i += id.length; col += id.length;
      push("gvar", id, sl, sc);
      continue;
    }
    if (ch === "@") {
      i++; col++;
      let kind = "digital";
      if (source[i] === "~") { kind = "pwm"; i++; col++; }
      else if (source[i] === "A" || source[i] === "a") { kind = "analog"; i++; col++; }
      let num = "";
      while (i < source.length && /[0-9]/.test(source[i])) { num += source[i]; i++; col++; }
      if (!num) fail("E000", sl, sc, "Expected a pin number after @", "@");
      push("pin", { n: Number(num), kind }, sl, sc);
      continue;
    }
    if (/[0-9]/.test(ch)) {
      if (ch === "0" && (source[i + 1] === "x" || source[i + 1] === "X")) {
        let hex = "0x";
        i += 2; col += 2;
        while (i < source.length && /[0-9a-fA-F]/.test(source[i])) { hex += source[i]; i++; col++; }
        push("number", Number(hex), sl, sc);
        continue;
      }
      let num = "";
      while (i < source.length && /[0-9.]/.test(source[i])) { num += source[i]; i++; col++; }
      push("number", Number(num), sl, sc);
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const id = readIdent(source, i);
      i += id.length; col += id.length;
      if (id === "True" || id === "true") push("bool", true, sl, sc);
      else if (id === "False" || id === "false") push("bool", false, sl, sc);
      else if (id === "Kill") push("kill", "Kill", sl, sc);
      else if (id === "Null" || id === "null") push("null", "Null", sl, sc);
      else if (id === "HIGH") push("level", "HIGH", sl, sc);
      else if (id === "LOW") push("level", "LOW", sl, sc);
      else if (/^E\d{3}$/.test(id)) push("errcode", id, sl, sc);
      else if (KEYWORDS.has(id)) push(id, id, sl, sc);
      else push("ident", id, sl, sc);
      continue;
    }
    const three = source.slice(i, i + 3);
    const pair = source.slice(i, i + 2);
    if (three === "<=>") { push("swap", "<=>", sl, sc); i += 3; col += 3; continue; }
    if (["==", "!=", ">=", "<=", "->", "=>", "+=", "-=", "*=", "/=", "%=", "++", "--"].includes(pair)) {
      push(pair, pair, sl, sc); i += 2; col += 2; continue;
    }
    if ("=><+-*/%!(){}[],.:&<>;".includes(ch)) { push(ch, ch, sl, sc); i++; col++; continue; }
    fail("E019", sl, sc, "Isolated or unknown symbol " + JSON.stringify(ch), ch);
    i++; col++;
  }
  tokens.push({ type: "eof", value: "", line, col });
  return tokens;
}

function readIdent(source, i) {
  if (!/[A-Za-z_]/.test(source[i] || "")) return "";
  let j = i + 1;
  while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++;
  return source.slice(i, j);
}

module.exports = { tokenize, KEYWORDS };
