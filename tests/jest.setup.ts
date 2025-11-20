import { jest } from "@jest/globals";
import { TextDecoder, TextEncoder } from "util";

// Polyfill TextEncoder/TextDecoder for jose / NextAuth / web crypto usage
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder as any;

// Stub Audio so components that touch `new Audio()` don't explode in tests
(global as any).Audio = class {
  play = jest.fn().mockResolvedValue(undefined);
  pause = jest.fn();
  load = jest.fn();
  currentTime = 0;
  loop = false;
};

// Defensive: if any BigInt leaks into JSON during tests, stringify safely.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
