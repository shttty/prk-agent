import { exactKeys } from "../request/inspect-request-keys.ts";
import { HttpError } from "../request/create-error.ts";

export function archiveRequest(body: Record<string, unknown>, confirm: boolean): void {
  if (confirm ? !exactKeys(body, ["confirm"]) || body.confirm !== true : Object.keys(body).length !== 0) {
    throw new HttpError(400, confirm ? "Permanent deletion requires exactly {confirm:true}." : "Unarchiving takes no parameters.");
  }
}
