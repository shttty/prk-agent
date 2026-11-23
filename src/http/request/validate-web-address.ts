import { WireError } from "../../gateway/wire/create-error.ts";

export function validateWebAddress(_host: string, port: number): void {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new WireError("CLI_ERROR", "Web port must be an integer from 0 to 65535.");
  }
}
