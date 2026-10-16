"use strict";

const ERRORS = {
  E000: "Broken syntax",
  E001: "Missing brace",
  E002: "Unexpected token",
  E003: "Unterminated string or comment",
  E004: "Unknown function",
  E005: "Unknown class",
  E006: "Unknown variable",
  E007: "Pin number outside compiler limits",
  E008: "Literal division by zero",
  E009: "Duplicate function",
  E010: "Duplicate class",
  E011: "Imported file not found",
  E012: "Main file not found",
  E013: "Non-numeric value in an impossible operation",
  E014: "Use of a dead function",
  E015: "Use of a dead class",
  E016: "Use of a dead variable",
  E017: "Attempt to break a linked connection",
  E018: "Library missing or unsupported",
  E019: "Isolated or nonexistent symbol",
  E020: "Library request has no handler",
  E021: "Operation on Null",
  E022: "Inadequate loop",
  E023: "Undefined error",
  E024: "Type mismatch",
  E025: "Promise used outside a patient block",
  E026: "Semicolon rule broken",
  E027: "selfSleep outside a promise",
  E999: "Internal compiler error"
};

function explain(code) {
  return ERRORS[code] || ERRORS.E999;
}

module.exports = { ERRORS, explain };
