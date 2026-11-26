import { isAbsolute } from "node:path";
export function capabilityId(value: unknown): value is string {
  if (typeof value !== "string" || /\p{Cc}/u.test(value)) return false;
  if (value.startsWith("lazy:")) return /^lazy:tool:\S+$/u.test(value)
    || /^lazy:group:tools:library$/u.test(value)
    || /^lazy:group:tools:remote:[^:\s]+:\S.*$/u.test(value)
    || /^lazy:group:tools:(?:package|mcp):\S.*$/u.test(value);
  if (value.startsWith("skill:")) return isAbsolute(value.slice("skill:".length));
  return /^(?:tool|kernel):\S.*$/u.test(value)
    || /^load:package:\S.*$/u.test(value)
    || /^group:tools:(?:kernel|library|local)$/u.test(value)
    || /^group:skills:(?:shared|home|global)$/u.test(value)
    || /^group:skills:dir:[^:\s]+:\/.*$/u.test(value)
    || /^group:tools:remote:[^:\s]+:\S.*$/u.test(value)
    || /^group:(?:tools:(?:package|mcp)|skills:package):\S.*$/u.test(value);
}
