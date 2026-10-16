#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { compileFile, CompileError, ERRORS, VERSION } = require("../index");

function help() {
  return [
    "CompIno " + VERSION,
    "Transpile a .cno file into an Arduino .ino sketch.",
    "",
    "Usage:",
    "  CompToIno [flags] <file.cno>",
    "  npx comptoino <file.cno>",
    "",
    "Flags:",
    "  -h, --help       Show this help",
    "  -v, --version    Show version",
    "  -d, --detailed   Print the detailed error log",
    "  -l, --learn      Open the lesson"
  ].join("\n");
}

function printErrors(err, file) {
  const errors = err && err.errors ? err.errors : null;
  if (!errors) {
    console.error("CompIno error: " + (err && err.message ? err.message : err));
    return;
  }
  const first = errors[0];
  const rel = file || first.file || "file.cno";
  console.error("Got err " + first.code + " on line " + first.line + ". See npx comptoino " + rel + " -d to get detailed log");
  const lines = [];
  for (const item of errors) {
    lines.push("=> GOT ERR " + item.code + " <=");
    lines.push("<Line: " + item.line + ">");
    lines.push("<Code: " + item.code + " - " + (ERRORS[item.code] || item.message) + ">");
    lines.push("<Involveds: " + (item.hint || item.message || "-") + ">");
    lines.push("");
  }
  lines.push("Complete log in " + first.code + ".log in same directory.");
  const dir = path.dirname(path.resolve(process.cwd(), rel));
  fs.writeFileSync(path.join(dir, first.code + ".log"), lines.join("\n"), "utf8");
  if (process.argv.includes("-d") || process.argv.includes("--detailed")) console.error(lines.join("\n"));
}

function main(argv) {
  const args = argv.slice(2);
  let file = null;
  for (const arg of args) {
    if (arg === "-h" || arg === "--help") { console.log(help()); return 0; }
    if (arg === "-v" || arg === "--version") { console.log(VERSION); return 0; }
    if (arg === "-d" || arg === "--detailed" || arg === "--detalhed") continue;
    if (arg === "-l" || arg === "--learn") {
      console.log(path.join(__dirname, "..", "docs", "index.html"));
      return 0;
    }
    if (arg.startsWith("-")) { console.error("Unknown flag: " + arg); return 1; }
    file = arg;
  }
  if (!file) { console.log(help()); return 0; }
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error("Got err E012 on line 1. See npx comptoino " + file + " -d to get detailed log");
    return 1;
  }
  try {
    const result = compileFile(abs);
    const out = abs.replace(/\.cno$/i, ".ino");
    fs.writeFileSync(out, result.code, "utf8");
    console.log("Wrote " + out);
    return 0;
  } catch (err) {
    if (err instanceof CompileError) printErrors(err, file);
    else console.error("Got err E999 on line 1. See npx comptoino " + file + " -d to get detailed log");
    return 1;
  }
}

if (require.main === module) process.exit(main(process.argv));
module.exports = { main, VERSION };
