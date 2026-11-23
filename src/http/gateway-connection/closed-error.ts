import { WireError } from "../../gateway/wire/create-error.ts";

export const closedError = (): WireError => new WireError("CLIENT_ERROR", "Web gateway client is closed.");
