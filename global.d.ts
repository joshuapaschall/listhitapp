// global.d.ts
export { }; // ensures this file is treated as a module

declare global {
  var callMap: Map<string, string>;
  var callDirection: Map<string, string>;
}
