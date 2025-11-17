export const devBypassAgentAuth =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_DEV_BYPASS_AGENT_AUTH === "true";
