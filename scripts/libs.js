"use strict";

const PRESET = {
  Servo: { header: "Servo.h" },
  LQ: { header: "LiquidCrystal.h", ctor: "LiquidCrystal" },
  LiquidCrystal: { header: "LiquidCrystal.h" },
  DHT: { header: "DHT.h" },
  Stepper: { header: "Stepper.h" },
  Adafruit_NeoPixel: { header: "Adafruit_NeoPixel.h" },
  keyboard: { header: "Keyboard.h", headerOnly: true },
  Keyboard: { header: "Keyboard.h", headerOnly: true },
  sd: { header: "SD.h", headerOnly: true },
  SD: { header: "SD.h", headerOnly: true },
  mouse: { header: "Mouse.h", headerOnly: true },
  Mouse: { header: "Mouse.h", headerOnly: true },
  bluetooth: { header: "BluetoothSerial.h", ctor: "BluetoothSerial" },
  Bluetooth: { header: "BluetoothSerial.h", ctor: "BluetoothSerial" },
  bluethooth: { header: "BluetoothSerial.h", ctor: "BluetoothSerial" },
  EEPROM: { header: "EEPROM.h", headerOnly: true },
  IRremote: { header: "IRremote.h", ctor: "IRrecv" },
  Math: { builtin: true }
};

function libOf(name) {
  return PRESET[name] || null;
}

module.exports = { PRESET, libOf };
