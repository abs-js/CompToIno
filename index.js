"use strict";

const fs = require("fs");
const path = require("path");
const { ERRORS, explain } = require("./scripts/errors");
const { tokenize } = require("./scripts/tokenize");
const { parse } = require("./scripts/parse");
const { check } = require("./scripts/check");
const { generate } = require("./scripts/generate");
const { libOf } = require("./scripts/libs");

const VERSION = "2.0.0";

class CompileError extends Error {
  constructor(errors) {
    super(errors.map((e) => e.file + ":" + e.line + " " + e.code + " " + e.message).join("\n"));
    this.errors = errors;
  }
}

function compile(source, options) {
  const opts = options || {};
  const filename = opts.filename || "sketch.cno";
  const errors = [];
  const fail = (code, line, col, message, hint) => {
    errors.push({ file: filename, code, line: line || 1, col: col || 1, message, hint: hint || "", explain: explain(code) });
  };
  let tokens = [];
  let ast = { type: "program", body: [] };
  try {
    tokens = tokenize(source, filename, fail);
    ast = parse(tokens, filename, fail);
    resolveImports(ast, opts.baseDir || process.cwd(), fail);
    check(ast, fail);
  } catch (err) {
    fail("E999", 1, 1, err && err.message ? err.message : "Internal compiler error", "js");
  }
  if (errors.length) {
    const error = new CompileError(errors);
    throw error;
  }
  return { code: generate(ast, filename, VERSION), ast, errors, version: VERSION };
}

function resolveImports(ast, baseDir, fail) {
  for (const stmt of ast.body || []) {
    if (stmt.type !== "import") continue;
    if (!stmt.from) {
      if (libOf(stmt.name)) stmt.resolved = true;
      else {
        const dir = path.join(baseDir, "cno-libs", stmt.name);
        if (fs.existsSync(path.join(dir, "index.js")) || fs.existsSync(path.join(dir, "package.json"))) stmt.resolved = true;
      }
      continue;
    }
    if (stmt.from.endsWith(".h")) { stmt.resolved = true; continue; }
    const full = path.resolve(baseDir, stmt.from);
    if (fs.existsSync(full)) stmt.resolved = true;
  }
}

function compileFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return compile(source, { filename: path.basename(filePath), baseDir: path.dirname(filePath) });
}

module.exports = { compile, compileFile, CompileError, ERRORS, VERSION };
