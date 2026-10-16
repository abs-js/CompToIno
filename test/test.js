"use strict";

const assert = require("assert");
const { compile, CompileError } = require("../index");

function run(source) {
  return compile(source, { filename: "t.cno" }).code;
}
function fails(source, code) {
  try {
    compile(source, { filename: "bad.cno" });
    assert.fail("expected " + code);
  } catch (err) {
    assert(err instanceof CompileError);
    assert(err.errors.some((e) => e.code === code), err.message);
  }
}

const math = run("import Math\n$n = min(1, 4)\n$p = pow(2, 3)\n$r = random(1, 10)\n$d = oneDivBy(2)\n");
assert(math.includes("min(1, 4)"));
assert(math.includes("pow(2, 3)"));
assert(math.includes("random(1, 10)"));
assert(math.includes("(1.0 / (2))"));

const pins = run("setPin(@6, true)\nsetPin(@7, HIGH)\nsetPwm(@5, 200)\n$on = getPin(@8)\n$a = analog(0)\n");
assert(pins.includes("digitalWrite(6, HIGH)"));
assert(pins.includes("analogWrite(5, 200)"));
assert(pins.includes("digitalRead(8)"));
assert(pins.includes("analogRead(A0)"));
assert(!pins.includes("Arduino.h"));

const tone = run("tone(@8, 440)\ntone(@8, null)\n");
assert(tone.includes("tone(8, 440)"));
assert(tone.includes("noTone(8)"));

const loop = run("&(250) {\n  setPin(@6, true)\n}\n");
assert(loop.includes("delay(250)"));

const sw = run("$n = 1\nswitch $n {\n  if(== 0) { serialPrint(0) }\n}\n");
assert(sw.includes("if (v_n == 0)"));

const servo = run("import Servo\n$s = new Servo(@9)\n");
assert(servo.includes("#include <Servo.h>"));
assert(servo.includes(".attach(9)"));

fails("$n<int> = 1\n$n = \"no\"\n", "E024");
fails("import Missing\n", "E018");

console.log("ok: CompIno 2.0.0");
