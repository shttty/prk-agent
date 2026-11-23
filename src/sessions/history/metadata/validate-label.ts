import { invalid } from "../reject-invalid-history.ts";

export function validateLabel(label: string): void {
  if (typeof label !== "string" || label.trim().length === 0) invalid("label");
}
