import { invalid } from "../reject-invalid-config.ts";

export function parseModel(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) invalid(`${field} must use PROVIDER/MODEL format`);
  const separator = value.indexOf("/");
  if (separator <= 0 || separator === value.length - 1 || /\s/u.test(value) || /\p{Cc}/u.test(value)) {
    invalid(`${field} must use PROVIDER/MODEL format`);
  }
  return value;
}
