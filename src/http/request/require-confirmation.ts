import { exactKeys } from "./inspect-request-keys.ts";
import { HttpError } from "./create-error.ts";

export function requireConfirmation(body: Record<string, unknown>, message: string): void {
  if (!exactKeys(body, ["confirm"]) || body.confirm !== true) throw new HttpError(400, message);
}
