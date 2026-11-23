import { invalid } from "../reject-invalid-history.ts";

export function validateTarget(target: string): void {
  if (typeof target !== "string" || target.length === 0 || target.trim().length === 0 || target.includes("\0")) invalid("target at /target");
}
