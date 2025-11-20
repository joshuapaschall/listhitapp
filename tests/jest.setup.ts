// Defensive: if any BigInt leaks into JSON during tests, stringify safely.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { TextEncoder, TextDecoder } from "util"

// Polyfill encoders for libraries expecting browser globals
// @ts-ignore
global.TextEncoder = TextEncoder
// @ts-ignore
global.TextDecoder = TextDecoder
