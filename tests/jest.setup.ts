// Defensive: if any BigInt leaks into JSON during tests, stringify safely.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
