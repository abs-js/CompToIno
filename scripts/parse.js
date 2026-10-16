"use strict";

function parse(tokens, filename, fail) {
  let p = 0;
  const peek = () => tokens[p] || tokens[tokens.length - 1];
  const next = () => tokens[p++] || tokens[tokens.length - 1];
  const at = (t) => peek().type === t;
  const eat = (t) => {
    if (!at(t)) {
      const tok = peek();
      fail("E002", tok.line, tok.col, "Expected " + t + " but found " + tok.type);
      return tok;
    }
    return next();
  };
  const skipSemi = () => { if (at(";")) return next(); return null; };

  function parseProgram() {
    const body = [];
    while (!at("eof")) body.push(parseStatement());
    return { type: "program", body };
  }

  function parseBlock() {
    eat("{");
    const body = [];
    while (!at("}") && !at("eof")) body.push(parseStatement());
    if (!at("}")) fail("E001", peek().line, peek().col, "Missing closing brace", "{");
    else eat("}");
    return body;
  }

  function varNode(tok) {
    if (tok.type === "gvar") return { type: "gvar", name: tok.value, line: tok.line, col: tok.col };
    return { type: "var", name: tok.value.name, typeName: tok.value.typeName || null, line: tok.line, col: tok.col };
  }

  function parseStatement() {
    const semiBefore = false;
    if (at("getPatient")) {
      const t = next();
      if (at("&")) return parseLoop(t, true);
      return { type: "patient", expr: parseExpression(), line: t.line };
    }
    if (at("&")) return parseLoop(next(), false);
    if (at("if")) return finish(parseIf());
    if (at("while")) return finish(parseWhile());
    if (at("for")) return finish(parseFor());
    if (at("switch")) return finish(parseSwitch());
    if (at("try")) return finish(parseTry());
    if (at("func")) return finish(parseFunc());
    if (at("class")) return finish(parseClass());
    if (at("import")) return finish(parseImport());
    if (at("export")) { next(); const name = eat("ident").value; skipSemi(); return { type: "export", name, line: peek().line }; }
    if (at("return")) {
      const t = next();
      if (at("}") || at("eof") || at(";")) { skipSemi(); return { type: "return", expr: null, line: t.line }; }
      const expr = parseExpression();
      skipSemi();
      return { type: "return", expr, line: t.line };
    }
    if (at("writable") || at("readable")) {
      const kind = next().type;
      eat("(");
      const pin = parseExpression();
      eat(")");
      skipSemi();
      return { type: kind, pin, line: pin.line };
    }
    if (at("whait") || at("wait")) {
      const t = next();
      const expr = parseExpression();
      skipSemi();
      return { type: "whait", expr, line: t.line };
    }
    if (at("var") || at("gvar")) {
      const a = next();
      const left = varNode(a);
      if (at(":")) {
        next();
        if (left.type === "gvar") fail("E017", a.line, a.col, "A global cannot be connected", "g$" + left.name);
        const b = eat("var");
        skipSemi();
        return { type: "chain", a: left.name, b: b.value.name, line: a.line, col: a.col };
      }
      if (at("->")) { next(); const b = eat("var"); skipSemi(); return { type: "move", from: left.name, to: b.value.name, line: a.line }; }
      if (at("++") || at("--")) { const op = next().type; skipSemi(); return { type: "update", op, target: left, line: a.line }; }
      if (at("=") || at("+=") || at("-=") || at("*=") || at("/=") || at("%=")) {
        const op = next().type;
        const right = parseExpression();
        skipSemi();
        return { type: "assign", left, op, right, line: a.line };
      }
      p--;
    }
    const expr = parseExpression();
    if (at("=") || at("+=") || at("-=") || at("*=") || at("/=") || at("%=")) {
      const op = next().type;
      const right = parseExpression();
      skipSemi();
      return { type: "assign", left: expr, op, right, line: expr.line || 1 };
    }
    skipSemi();
    return { type: "expr", expr, line: expr.line || 1 };
  }

  function finish(node) { skipSemi(); return node; }

  function parseLoop(mark, patient) {
    let delay = null;
    if (at("(")) {
      next();
      delay = parseExpression();
      eat(")");
    }
    return { type: "loop", patient: !!patient, delay, body: parseBlock(), line: mark.line };
  }

  function parseIf() {
    const t = eat("if");
    eat("(");
    let catchVar = null;
    if (at("catch")) { next(); catchVar = parsePrimary(); }
    const cond = catchVar ? { type: "catchtest", expr: catchVar, line: t.line } : parseExpression();
    eat(")");
    const then = parseBlock();
    const elifs = [];
    while (at("elif")) {
      next(); eat("("); const c = parseExpression(); eat(")");
      elifs.push({ cond: c, body: parseBlock() });
    }
    let els = null;
    if (at("else")) { next(); els = parseBlock(); }
    return { type: "if", cond, then, elifs, else: els, line: t.line };
  }

  function parseWhile() {
    const t = eat("while");
    eat("("); const cond = parseExpression(); eat(")");
    return { type: "while", cond, body: parseBlock(), line: t.line };
  }

  function parseFor() {
    const t = eat("for");
    eat("(");
    const init = parseForPart();
    eat(",");
    const cond = parseExpression();
    eat(",");
    const step = parseForPart();
    eat(")");
    return { type: "for", init, cond, step, body: parseBlock(), line: t.line };
  }

  function parseForPart() {
    if (at("var") || at("gvar")) {
      const a = next();
      const left = varNode(a);
      if (at("=") || at("+=") || at("-=")) {
        const op = next().type;
        return { type: "assign", left, op, right: parseExpression(), line: a.line };
      }
      if (at("++") || at("--")) return { type: "update", op: next().type, target: left, line: a.line };
      return { type: "expr", expr: left };
    }
    return { type: "expr", expr: parseExpression() };
  }

  function parseSwitch() {
    const t = eat("switch");
    const value = parseExpression();
    eat("{");
    const cases = [];
    let els = null;
    while (!at("}") && !at("eof")) {
      if (at("if")) {
        const it = next();
        eat("(");
        let cond;
        if (["==", "!=", ">", "<", ">=", "<="].includes(peek().type)) {
          const op = next().type;
          cond = { type: "binary", op, left: value, right: parseExpression(), line: it.line };
        } else cond = parseExpression();
        eat(")");
        cases.push({ cond, body: parseBlock(), line: it.line });
      } else if (at("else")) {
        next();
        els = parseBlock();
      } else {
        fail("E002", peek().line, peek().col, "Expected if or else in switch", peek().type);
        next();
      }
    }
    eat("}");
    return { type: "switch", value, cases, else: els, line: t.line };
  }

  function parseTry() {
    const t = eat("try");
    let body = null;
    let call = null;
    if (at("{")) body = parseBlock();
    else call = parseExpression();
    let handler = null;
    let code = null;
    if (at("catch")) {
      next();
      if (at("errcode")) code = next().value;
      else handler = parsePrimary();
      if (at("{")) body = body || [];
      const catchBody = at("{") ? parseBlock() : [];
      return { type: "try", body, call, handler, code, catchBody, line: t.line };
    }
    return { type: "try", body, call, handler, code, catchBody: [], line: t.line };
  }

  function parseFunc() {
    const t = eat("func");
    let name = "anon";
    if (at("ident")) name = next().value;
    else if (at("var")) name = next().value.name;
    eat("(");
    const params = [];
    if (!at(")")) {
      params.push(parseParam());
      while (at(",")) { next(); params.push(parseParam()); }
    }
    eat(")");
    return { type: "func", name, params, body: parseBlock(), line: t.line };
  }

  function nextUnused() { return "anon"; }

  function parseParam() {
    const t = eat("var");
    return { name: t.value.name, typeName: t.value.typeName || null };
  }

  function parseClass() {
    const t = eat("class");
    const name = eat("ident").value;
    eat("{");
    const fields = [];
    const methods = [];
    let main = null;
    while (!at("}") && !at("eof")) {
      if (at("Main")) { next(); main = next().value; continue; }
      if (at("func")) { methods.push(parseFunc()); continue; }
      if (at("ident") && tokens[p + 1] && tokens[p + 1].type === "(") {
        const mname = next().value;
        eat("(");
        const params = [];
        if (!at(")")) { params.push(parseParam()); while (at(",")) { next(); params.push(parseParam()); } }
        eat(")");
        methods.push({ type: "func", name: mname, params, body: parseBlock(), line: t.line });
        continue;
      }
      fail("E002", peek().line, peek().col, "Unexpected token in class", peek().type);
      next();
    }
    eat("}");
    return { type: "class", name, fields, methods, main, line: t.line };
  }

  function parseImport() {
    const t = eat("import");
    const nameTok = next();
    const name = nameTok.type === "var" ? nameTok.value.name : nameTok.value;
    let from = null;
    if (at("from")) { next(); from = eat("string").value; }
    return { type: "import", name, from, line: t.line };
  }

  function parseExpression() { return parseOr(); }
  function parseOr() {
    let left = parseAnd();
    while (at("or") || at("xor")) { const op = next().type; left = { type: "binary", op, left, right: parseAnd(), line: left.line }; }
    return left;
  }
  function parseAnd() {
    let left = parseCmp();
    while (at("and")) { next(); left = { type: "binary", op: "and", left, right: parseCmp(), line: left.line }; }
    return left;
  }
  function parseCmp() {
    let left = parseAdd();
    while (["==", "!=", ">", "<", ">=", "<="].includes(peek().type)) {
      const op = next().type;
      left = { type: "binary", op, left, right: parseAdd(), line: left.line };
    }
    return left;
  }
  function parseAdd() {
    let left = parseMul();
    while (at("+") || at("-")) { const op = next().type; left = { type: "binary", op, left, right: parseMul(), line: left.line }; }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    while (at("*") || at("/") || at("%")) { const op = next().type; left = { type: "binary", op, left, right: parseUnary(), line: left.line }; }
    return left;
  }
  function parseUnary() {
    if (at("!")) { const t = next(); return { type: "unary", op: "!", expr: parseUnary(), line: t.line }; }
    if (at("catch")) { const t = next(); return { type: "catchtest", expr: parseUnary(), line: t.line }; }
    return parsePostfix();
  }
  function parsePostfix() {
    let expr = parsePrimary();
    while (true) {
      if (at("(")) {
        next();
        const args = [];
        if (!at(")")) { args.push(parseExpression()); while (at(",")) { next(); args.push(parseExpression()); } }
        eat(")");
        expr = { type: "call", callee: expr, args, line: expr.line };
        continue;
      }
      if (at(".")) {
        next();
        const name = next().value;
        expr = { type: "member", object: expr, name, line: expr.line };
        continue;
      }
      if (at("++") || at("--")) {
        expr = { type: "update", op: next().type, target: expr, line: expr.line };
        continue;
      }
      break;
    }
    return expr;
  }
  function parsePrimary() {
    const t = peek();
    if (at("number")) { next(); return { type: "number", value: t.value, line: t.line, col: t.col }; }
    if (at("string")) { next(); return { type: "string", value: t.value, line: t.line }; }
    if (at("bool")) { next(); return { type: "bool", value: t.value, line: t.line }; }
    if (at("kill")) { next(); return { type: "kill", line: t.line, col: t.col }; }
    if (at("null")) { next(); return { type: "null", line: t.line, col: t.col }; }
    if (at("level")) { next(); return { type: "level", value: t.value, line: t.line }; }
    if (at("errcode")) { next(); return { type: "errcode", value: t.value, line: t.line }; }
    if (at("var") || at("gvar")) { next(); return varNode(t); }
    if (at("pin")) { next(); return { type: "pin", n: t.value.n, kind: t.value.kind, line: t.line, col: t.col }; }
    if (at("new")) {
      next();
      const name = eat("ident").value;
      eat("(");
      const args = [];
      if (!at(")")) { args.push(parseExpression()); while (at(",")) { next(); args.push(parseExpression()); } }
      eat(")");
      return { type: "new", name, args, line: t.line };
    }
    if (at("func")) return parseFunc();
    if (at("[")) {
      next();
      const items = [];
      if (!at("]")) { items.push(parseExpression()); while (at(",")) { next(); if (at("]")) break; items.push(parseExpression()); } }
      eat("]");
      return { type: "array", items, line: t.line };
    }
    if (at("(")) { next(); const expr = parseExpression(); eat(")"); return expr; }
    if (at("ident") || at("setPin") || at("setPwm") || at("getPin") || at("getPn") || at("pin") || at("pwm") || at("analog") || at("tone") || at("min") || at("max") || at("abs") || at("constrain") || at("log") || at("oneDivBy") || at("sqrt") || at("random") || at("pow") || at("exp") || at("serialPrint") || at("serialRead") || at("serialBeg") || at("selfSleep") || at("Math") || at("HIGH") || at("LOW")) {
      next();
      return { type: "ident", name: t.value, line: t.line };
    }
    fail("E002", t.line, t.col, "Expected an expression, found " + t.type);
    next();
    return { type: "null", line: t.line };
  }

  return parseProgram();
}

module.exports = { parse };
